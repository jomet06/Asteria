import { randomBytes, randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

const CODE_TTL_MS = 10 * 60_000;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no lookalikes
const CODE_LENGTH = 6;

export type LinkCodeResult = { code: string; expiresAt: Date };

/** Generate a short-lived pairing code shown in Settings. */
export async function createDiscordLinkCode(ownerId: string): Promise<LinkCodeResult> {
  const code = Array.from(randomBytes(CODE_LENGTH))
    .map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
    .join("");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.discordLinkCode.deleteMany({ where: { ownerId } });
  await prisma.discordLinkCode.create({ data: { code, ownerId, expiresAt } });

  return { code, expiresAt };
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
  if (!record || record.expiresAt.getTime() < Date.now()) {
    await prisma.discordLinkCode.deleteMany({ where: { code: normalized } });
    return { ok: false, message: "That link code expired or was already used. Generate a new one in Asteria Settings." };
  }

  // One Discord user maps to one Asteria account; re-linking moves it.
  await prisma.$transaction([
    prisma.discordConnection.upsert({
      where: { discordUserId },
      create: { ownerId: record.ownerId, discordUserId, discordUsername, dmChannelId },
      update: { ownerId: record.ownerId, discordUsername, dmChannelId },
    }),
    prisma.discordLinkCode.delete({ where: { code: normalized } }),
  ]);

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
