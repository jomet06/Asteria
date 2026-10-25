import { randomBytes, randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

const CODE_TTL_MS = 10 * 60_000;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no lookalikes
const CODE_LENGTH = 6;

export type LinkCodeResult = { code: string; expiresAt: Date };

/** Generate a short-lived pairing code shown in Settings. */
export async function createDiscordLinkCode(ownerId: string): Promise<LinkCodeResult> {
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = Array.from(randomBytes(CODE_LENGTH)).map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM profiles WHERE id = ${ownerId}::uuid FOR UPDATE`;
        await tx.discordLinkCode.deleteMany({ where: { ownerId } });
        await tx.discordLinkCode.create({ data: { code, ownerId, expiresAt } });
      });
      return { code, expiresAt };
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002" || attempt === 2) throw error;
    }
  }
  throw new Error("Could not generate a pairing code.");
}

export type ConnectOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string };

/** Bind a Discord user to the Asteria account that owns `code`. */
export async function connectByCode({
  discordUserId,
  discordUsername,
  dmChannelId,
  code,
}: {
  discordUserId: string;
  discordUsername: string;
  dmChannelId: string | null;
  code: string;
}): Promise<ConnectOutcome> {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(normalized)) {
    return { ok: false, message: "That link code is not valid. Generate a new one in Asteria Settings." };
  }

  const record = await prisma.discordLinkCode.findUnique({ where: { code: normalized } });
  if (!record || record.expiresAt.getTime() <= Date.now()) {
    await prisma.discordLinkCode.deleteMany({ where: { code: normalized, expiresAt: { lte: new Date() } } });
    return { ok: false, message: "That link code expired or was already used. Generate a new one in Asteria Settings." };
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM profiles WHERE id = ${record.ownerId}::uuid FOR UPDATE`;
      const existing = await tx.discordConnection.findUnique({ where: { discordUserId } });
      if (existing && existing.ownerId !== record.ownerId) return "conflict";
      // Consume exactly once in the same transaction as linking. Any unique
      // conflict rolls this back, preserving the unused code and original link.
      const consumed = await tx.discordLinkCode.deleteMany({ where: { code: normalized, ownerId: record.ownerId, expiresAt: { gt: new Date() } } });
      if (!consumed.count) return "expired";
      await tx.discordConnection.upsert({
        where: { ownerId: record.ownerId },
        create: { ownerId: record.ownerId, discordUserId, discordUsername, dmChannelId },
        update: { discordUserId, discordUsername, dmChannelId },
      });
      return "linked";
    });
    if (outcome === "conflict") return { ok: false, message: "This Discord account is already linked to another Asteria account. Disconnect it from that account's Settings first." };
    if (outcome === "expired") return { ok: false, message: "That link code expired or was already used. Generate a new one in Asteria Settings." };
  } catch (error) {
    if (!["P2002", "P2034", "P2025"].includes((error as { code?: string }).code ?? "")) throw error;
    return { ok: false, message: "The connection changed while linking. No account was moved. Generate a new code and retry." };
  }

  return {
    ok: true,
    message: `✅ Linked to Asteria (${discordUsername}). You can now ask me to create tasks and events, and I will send your reminders here.`,
  };
}

export async function disconnectDiscord(ownerId: string): Promise<void> {
  await prisma.discordConnection.deleteMany({ where: { ownerId } });
}

export function newInternalId(): string {
  return randomUUID();
}
