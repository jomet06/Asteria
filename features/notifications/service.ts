import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { loadCalendarEvents } from "@/features/calendar/data";
import { readCalendarTimezone } from "@/features/calendar/date-time";
import { categoryEnabled, publicPreferences } from "./preferences";
import { atHour, DAY_MS, dayAfter, eventCandidate, localDay, planFingerprint, taskCandidates } from "./policy";
import type { NotificationCandidate, NotificationPreferences } from "./types";

/** Shared lock used by generation and preference changes; never held across network I/O. */
export async function lockPreferences(tx: Prisma.TransactionClient, ownerId: string) {
  await tx.notificationPreference.upsert({ where: { ownerId }, create: { ownerId }, update: {} });
  await tx.$queryRaw`SELECT owner_id FROM notification_preferences WHERE owner_id = ${ownerId}::uuid FOR UPDATE`;
  return tx.notificationPreference.findUniqueOrThrow({ where: { ownerId } });
}

// Candidates are constructed ONLY from owner-scoped server queries below. There is no
// public/client creation endpoint accepting resource IDs or a caller-supplied owner.
async function persistCandidates(ownerId: string, candidates: NotificationCandidate[], now: Date, evaluatedPreferences: NotificationPreferences) {
  return prisma.$transaction(async (tx) => {
    const preferences = await lockPreferences(tx, ownerId);
    // Recollect on the next tick if timing/channel choices changed during the
    // source reads. Do not publish an obsolete preference snapshot.
    if (JSON.stringify(publicPreferences(preferences)) !== JSON.stringify(publicPreferences(evaluatedPreferences))) return 0;
    const connection = preferences.discordEnabled ? await tx.discordConnection.findUnique({ where: { ownerId } }) : null;
    const profile = await tx.profile.findUniqueOrThrow({ where: { id: ownerId }, select: { timezone: true } });
    const todayStart = atHour(localDay(now, readCalendarTimezone(profile.timezone)), 0, readCalendarTimezone(profile.timezone));
    if (candidates.length) await tx.notificationLog.updateMany({ where: { ownerId, title: null, legacyDiscordSent: false, OR: candidates.map(({ kind, refKey }) => ({ kind, refKey })) }, data: { legacyDiscordSent: true } });
    let created = 0;
    const batch: NotificationCandidate[] = [];
    for (const candidate of candidates) {
      if (!categoryEnabled(preferences, candidate.kind) || (!preferences.inAppEnabled && !preferences.discordEnabled)) continue;
      if (candidate.scheduledAt > now || candidate.expiresAt <= now) continue;
      if (candidate.sourceType === "planner") {
        // Historical summaries have no fingerprint. Establish a silent baseline
        // instead of replaying the first observed plan after migration.
        await tx.notificationLog.updateMany({ where: { ownerId, kind: "daily_plan", refKey: `plan:${candidate.sourceId}`, legacyDiscordSent: true, sourceVersion: null }, data: { sourceType: "planner", sourceId: candidate.sourceId, sourceVersion: candidate.sourceVersion } });
        // A stable ordered-task fingerprint dedupes planner regeneration and morning
        // summaries. A plan announced yesterday may still receive today's recap.
        const same = await tx.notificationLog.findFirst({ where: {
          ownerId, sourceType: "planner", sourceId: candidate.sourceId, sourceVersion: candidate.sourceVersion,
          ...(candidate.kind === "daily_plan" ? { createdAt: { gte: todayStart } } : {}),
        } });
        if (same) continue;
      }
      if (candidate.sourceType === "planner") {
        // Persist each planner version before evaluating the following candidate
        // so availability and the morning summary share the same dedupe decision.
        const inserted = await tx.notificationLog.createMany({ data: [{ ownerId, ...candidate, inApp: preferences.inAppEnabled }], skipDuplicates: true });
        created += inserted.count;
      } else {
        batch.push(candidate);
      }
    }
    if (batch.length) {
      const inserted = await tx.notificationLog.createMany({ data: batch.map((candidate) => ({ ownerId, ...candidate, inApp: preferences.inAppEnabled })), skipDuplicates: true });
      created += inserted.count;
    }
    // Bulk persistence keeps high-volume owners from using hundreds of network
    // round trips while holding the preference lock.
    const active = candidates.filter((candidate) => categoryEnabled(preferences, candidate.kind) && candidate.scheduledAt <= now && candidate.expiresAt > now);
    if (active.length && preferences.discordEnabled && connection?.dmChannelId) {
      const logs = await tx.notificationLog.findMany({ where: { ownerId, dismissedAt: null, legacyDiscordSent: false, OR: active.map(({ kind, refKey, sourceVersion }) => ({ kind, refKey, sourceVersion })) }, select: { id: true } });
      if (logs.length) await tx.notificationDelivery.createMany({ data: logs.map((notification) => ({ ownerId, notificationId: notification.id, channel: "discord", nextAttemptAt: now })), skipDuplicates: true });
    }
    return created;
  }, { timeout: 20_000 });
}

export async function reconcileOwner(ownerId: string, now: Date) {
  const profile = await prisma.profile.findUnique({ where: { id: ownerId }, select: { timezone: true } });
  if (!profile) return { created: 0, truncated: false };
  const timezone = readCalendarTimezone(profile.timezone);
  const preferences = await prisma.notificationPreference.upsert({ where: { ownerId }, create: { ownerId }, update: {} });
  if (!preferences.inAppEnabled && !preferences.discordEnabled) return { created: 0, truncated: false };
  const today = localDay(now, timezone);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const candidates: NotificationCandidate[] = [];
  let truncated = false;

  if (preferences.calendarEnabled) {
    const calendar = await loadCalendarEvents(ownerId, new Date(now.getTime() - DAY_MS), new Date(now.getTime() + DAY_MS));
    truncated = calendar.truncated;
    const eventCandidates: NotificationCandidate[] = [];
    const historicalKeys = new Map<string, string>();
    for (const event of calendar.events) {
      const candidate = eventCandidate(event, preferences, now, timezone);
      if (candidate) {
        const rawKey = `event:${event.id}:${Date.parse(candidate.sourceVersion)}`;
        if (rawKey.length > 120) historicalKeys.set(candidate.refKey, rawKey.slice(0, 120));
        eventCandidates.push(candidate);
      }
    }
    const legacy = historicalKeys.size ? await prisma.notificationLog.findMany({ where: { ownerId, kind: "event_starting", refKey: { in: [...historicalKeys.values()] }, OR: [{ legacyDiscordSent: true }, { title: null }] }, select: { refKey: true } }) : [];
    const previouslySent = new Set(legacy.map((item) => item.refKey));
    candidates.push(...eventCandidates.filter((candidate) => !previouslySent.has(historicalKeys.get(candidate.refKey) ?? "")));
  }

  // Keyset traversal advances even through already-notified rows. Every eligible
  // task eventually gets a turn instead of the first 20 monopolizing the limit.
  if (preferences.deadlineEnabled || preferences.overdueEnabled) {
    const tasks = await prisma.task.findMany({
      where: { ownerId, status: { in: ["TODO", "IN_PROGRESS"] }, dueAt: { not: null }, ...(preferences.taskCursor ? { id: { gt: preferences.taskCursor } } : {}) },
      select: { id: true, title: true, status: true, dueAt: true }, orderBy: { id: "asc" }, take: 100,
    });
    for (const task of tasks) candidates.push(...taskCandidates(task, preferences, now, timezone));
    await prisma.notificationPreference.updateMany({ where: { ownerId }, data: { taskCursor: tasks.length === 100 ? tasks.at(-1)!.id : null } });
  }

  if (preferences.plannerEnabled) {
    const dates = await prisma.dailyPlanItem.groupBy({
      by: ["plannedDate"], where: { ownerId, plannedDate: { gte: todayDate, ...(preferences.plannerCursor ? { gt: preferences.plannerCursor } : {}) } },
      orderBy: { plannedDate: "asc" }, take: 5,
    });
    const days = [...new Set([today, ...dates.map((item) => item.plannedDate.toISOString().slice(0, 10))])];
    for (const day of days) {
      const items = await prisma.dailyPlanItem.findMany({ where: { ownerId, plannedDate: new Date(`${day}T00:00:00Z`), task: { ownerId, status: { in: ["TODO", "IN_PROGRESS"] } } }, include: { task: { select: { title: true } } }, orderBy: [{ position: "asc" }, { id: "asc" }], take: 101 });
      if (!items.length) continue;
      if (items.length > 100) { truncated = true; continue; }
      const fingerprint = planFingerprint(day, items);
      const morning = atHour(day, preferences.morningHour, timezone);
      const previous = await prisma.notificationLog.findFirst({ where: { ownerId, sourceType: "planner", sourceId: day }, select: { id: true } });
      const common = { sourceType: "planner" as const, sourceId: day, sourceVersion: fingerprint, href: `/tasks/planner?date=${day}`, expiresAt: atHour(dayAfter(day), 0, timezone), message: `${day} · ${items.length} task${items.length === 1 ? "" : "s"}: ${items.slice(0, 8).map((item) => item.task.title.slice(0, 60)).join(" → ")}${items.length > 8 ? " …" : ""}` };
      // Morning first: the subsequent availability candidate sees the same version
      // already persisted and cannot produce a second identical summary.
      if (day === today && now >= morning && now < atHour(day, 12, timezone)) candidates.push({ ...common, kind: "daily_plan", refKey: `plan:${day}`, title: "Your morning plan", scheduledAt: morning });
      candidates.push({ ...common, kind: "plan_ready", refKey: `plan:${day}:${fingerprint}`, title: previous ? "Daily plan updated" : "Your daily plan is ready", scheduledAt: now });
    }
    await prisma.notificationPreference.updateMany({ where: { ownerId }, data: { plannerCursor: dates.length === 5 ? dates.at(-1)!.plannedDate : null } });
  }

  return { created: await persistCandidates(ownerId, candidates, now, preferences), truncated };
}

/** Revalidate source ownership and relevance immediately before delivery. */
export async function sourceStillRelevant(notification: { ownerId: string; kind: string; sourceType: string | null; sourceId: string | null; sourceVersion: string | null }, preferences: NotificationPreferences, now: Date): Promise<boolean> {
  const { ownerId, sourceId, sourceVersion } = notification;
  if (!sourceId || !sourceVersion) return false;
  const profile = await prisma.profile.findUnique({ where: { id: ownerId }, select: { timezone: true } });
  if (!profile) return false;
  const timezone = readCalendarTimezone(profile.timezone);
  if (notification.sourceType === "task") {
    const task = await prisma.task.findFirst({ where: { id: sourceId, ownerId }, select: { id: true, title: true, status: true, dueAt: true } });
    return Boolean(task && task.dueAt?.toISOString() === sourceVersion && taskCandidates(task, preferences, now, timezone).some((item) => item.kind === notification.kind));
  }
  if (notification.sourceType === "event") {
    const start = Date.parse(sourceVersion);
    if (!Number.isFinite(start)) return false;
    const calendar = await loadCalendarEvents(ownerId, new Date(start - DAY_MS), new Date(start + DAY_MS));
    return calendar.events.some((item) => item.id === sourceId && eventCandidate(item, preferences, now, timezone)?.sourceVersion === sourceVersion);
  }
  if (notification.sourceType === "planner") {
    const items = await prisma.dailyPlanItem.findMany({ where: { ownerId, plannedDate: new Date(`${sourceId}T00:00:00Z`), task: { ownerId, status: { in: ["TODO", "IN_PROGRESS"] } } }, orderBy: [{ position: "asc" }, { id: "asc" }], select: { taskId: true, position: true }, take: 101 });
    return items.length > 0 && items.length <= 100 && planFingerprint(sourceId, items) === sourceVersion;
  }
  return false;
}
