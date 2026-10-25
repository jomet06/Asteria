import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { discordBotToken } from "@/features/discord/config";
import { sendDiscordMessage } from "@/features/discord/rest";
import { categoryEnabled, notificationSchemaPending } from "./preferences";
import { MAX_ATTEMPTS, retryAt } from "./policy";
import { reconcileOwner, sourceStillRelevant } from "./service";

const KEY = "notifications";
const OWNER_BATCH = 25;
const DELIVERY_USERS = 20;
const SEND_BUDGET = 20;
const RUN_MS = 50_000;
const LEASE_MS = 120_000;
const CLAIM_MS = 30_000;

export type TickResult = { sent: number; skipped: number; created: number; processedOwners: number; errors: number; truncated: number; busy?: boolean; schemaPending?: boolean };

function ready(now: Date) {
  return { channel: "discord", OR: [
    { status: { in: ["pending", "retry"] }, nextAttemptAt: { lte: now } },
    { status: "sending", leaseUntil: { lte: now } },
  ] };
}

async function deliveryOwners(cursor: string | null, now: Date) {
  // DISTINCT owners BEFORE LIMIT; sent entries never occupy the ready window.
  return prisma.$queryRaw<{ ownerId: string }[]>`
    SELECT DISTINCT owner_id AS "ownerId" FROM notification_deliveries
    WHERE channel = 'discord'
      AND ((status IN ('pending','retry') AND next_attempt_at <= ${now})
        OR (status = 'sending' AND lease_until <= ${now}))
      AND (${cursor}::uuid IS NULL OR owner_id > ${cursor}::uuid)
    ORDER BY owner_id ASC LIMIT ${DELIVERY_USERS}`;
}

/** A fenced atomic claim; network calls never run inside a DB transaction. */
export async function deliverOne(ownerId: string): Promise<"sent" | "skipped" | "empty"> {
  const now = new Date();
  const delivery = await prisma.notificationDelivery.findFirst({ where: { ownerId, ...ready(now) }, orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }], include: { notification: true } });
  if (!delivery) return "empty";
  const claimToken = randomUUID();
  const claimed = await prisma.notificationDelivery.updateMany({ where: { id: delivery.id, ownerId, ...ready(now) }, data: { status: "sending", claimToken, leaseUntil: new Date(now.getTime() + CLAIM_MS), attempts: { increment: 1 } } });
  if (!claimed.count) return "skipped";
  const fence = { id: delivery.id, ownerId, claimToken, status: "sending" };
  const attempt = delivery.attempts + 1;
  const finish = (data: { status: string; lastError?: string | null; nextAttemptAt?: Date; sentAt?: Date }) => prisma.notificationDelivery.updateMany({ where: fence, data: { ...data, claimToken: null, leaseUntil: null } });
  try {
    if (attempt > MAX_ATTEMPTS) { await finish({ status: "failed", lastError: "attempts_exhausted" }); return "skipped"; }
    const [preferences, connection, current] = await Promise.all([
      prisma.notificationPreference.findUnique({ where: { ownerId } }),
      prisma.discordConnection.findUnique({ where: { ownerId } }),
      prisma.notificationLog.findFirst({ where: { id: delivery.notificationId, ownerId } }),
    ]);
    if (!preferences?.discordEnabled || !current || !categoryEnabled(preferences, current.kind) || current.dismissedAt || current.legacyDiscordSent || !current.expiresAt || current.expiresAt <= now || !connection?.dmChannelId || !await sourceStillRelevant(current, preferences, now)) {
      await finish({ status: "cancelled", lastError: "no_longer_relevant" }); return "skipped";
    }
    // Recheck after source validation. Already in-flight requests cannot be unsent.
    const stillClaimed = await prisma.notificationDelivery.findFirst({ where: { ...fence, leaseUntil: { gt: new Date() } } });
    const [latestPreferences, latestLink, latestNotification] = await Promise.all([
      prisma.notificationPreference.findUnique({ where: { ownerId } }),
      prisma.discordConnection.findUnique({ where: { ownerId } }),
      prisma.notificationLog.findFirst({ where: { id: current.id, ownerId } }),
    ]);
    if (!stillClaimed || !latestPreferences?.discordEnabled || !categoryEnabled(latestPreferences, current.kind) || !latestNotification || latestNotification.dismissedAt || latestLink?.discordUserId !== connection.discordUserId || latestLink?.dmChannelId !== connection.dmChannelId || current.expiresAt <= new Date()) {
      await finish({ status: "cancelled", lastError: "delivery_changed" }); return "skipped";
    }
    const renewed = await prisma.notificationDelivery.updateMany({ where: { ...fence, leaseUntil: { gt: new Date() } }, data: { leaseUntil: new Date(Date.now() + CLAIM_MS) } });
    if (!renewed.count) return "skipped";
    const response = await sendDiscordMessage(connection.dmChannelId, `${current.title ?? "Asteria"}\n${current.message ?? ""}`);
    if (response.ok) {
      const saved = await finish({ status: "sent", sentAt: new Date(), lastError: null });
      return saved.count ? "sent" : "skipped";
    }
    await finish({ status: response.retryable && attempt < MAX_ATTEMPTS ? "retry" : "failed", lastError: response.error, nextAttemptAt: retryAt(new Date(), attempt, response.retryAfterMs) });
    return "skipped";
  } catch {
    // If the update also fails, lease expiry recovers the claim. Never erase logs.
    await finish({ status: attempt < MAX_ATTEMPTS ? "retry" : "failed", lastError: "processing_failed", nextAttemptAt: retryAt(new Date(), attempt) });
    return "skipped";
  }
}

export async function runNotificationTick(): Promise<TickResult> {
  const result: TickResult = { sent: 0, skipped: 0, created: 0, processedOwners: 0, errors: 0, truncated: 0 };
  const leaseToken = randomUUID();
  const started = Date.now();
  const now = new Date();
  let held = false;
  try {
    await prisma.notificationSchedulerState.upsert({ where: { key: KEY }, create: { key: KEY }, update: {} });
    const lock = await prisma.notificationSchedulerState.updateMany({ where: { key: KEY, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }, data: { leaseToken, leaseUntil: new Date(now.getTime() + LEASE_MS) } });
    if (!lock.count) return { ...result, busy: true };
    held = true;
    const state = await prisma.notificationSchedulerState.findUniqueOrThrow({ where: { key: KEY } });
    const renew = async (data: { ownerCursor?: string | null; deliveryCursor?: string | null } = {}) => {
      const updated = await prisma.notificationSchedulerState.updateMany({ where: { key: KEY, leaseToken }, data: { ...data, leaseUntil: new Date(Date.now() + LEASE_MS) } });
      return updated.count > 0;
    };
    let owners = await prisma.profile.findMany({ where: state.ownerCursor ? { id: { gt: state.ownerCursor } } : {}, select: { id: true }, orderBy: { id: "asc" }, take: OWNER_BATCH });
    if (!owners.length && state.ownerCursor) owners = await prisma.profile.findMany({ select: { id: true }, orderBy: { id: "asc" }, take: OWNER_BATCH });
    for (const owner of owners) {
      if (Date.now() - started >= RUN_MS / 2 || !await renew()) break;
      try {
        const collected = await reconcileOwner(owner.id, new Date());
        result.created += collected.created;
        result.truncated += Number(collected.truncated);
      } catch (error) {
        if (notificationSchemaPending(error)) throw error;
        result.errors += 1;
      }
      result.processedOwners += 1;
      if (!await renew({ ownerCursor: owner.id })) break;
    }
    // Missing Discord token never blocks in-app collection or burns attempts.
    if (discordBotToken()) {
      let users = await deliveryOwners(state.deliveryCursor, new Date());
      if (!users.length && state.deliveryCursor) users = await deliveryOwners(null, new Date());
      let attempts = 0;
      for (let round = 0; round < 5 && users.length && attempts < SEND_BUDGET; round += 1) {
        const remaining = [];
        for (const user of users) {
          if (attempts >= SEND_BUDGET || Date.now() - started >= RUN_MS || !await renew()) break;
          try {
            const status = await deliverOne(user.ownerId);
            if (status !== "empty") { attempts += 1; result[status] += 1; remaining.push(user); }
          } catch { result.errors += 1; attempts += 1; }
          if (!await renew({ deliveryCursor: user.ownerId })) break;
        }
        users = remaining;
      }
    }
    return result;
  } catch (error) {
    if (notificationSchemaPending(error)) return { ...result, schemaPending: true };
    throw error;
  } finally {
    if (held) await prisma.notificationSchedulerState.updateMany({ where: { key: KEY, leaseToken }, data: { leaseToken: null, leaseUntil: null } });
  }
}
