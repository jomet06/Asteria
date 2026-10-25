"use server";

import { revalidatePath } from "next/cache";

import { getMyAccount } from "@/features/profile/data";
import { discordBotToken } from "./config";
import { createDiscordLinkCode, disconnectDiscord } from "./link";

export type DiscordLinkResult =
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; error: "not_configured" };

export async function createDiscordLinkCodeAction(): Promise<DiscordLinkResult> {
  const { user } = await getMyAccount();
  if (!discordBotToken()) return { ok: false, error: "not_configured" };

  const { code, expiresAt } = await createDiscordLinkCode(user.id);
  return { ok: true, code, expiresAt: expiresAt.toISOString() };
}

export async function disconnectDiscordAction(): Promise<void> {
  const { user } = await getMyAccount();
  await disconnectDiscord(user.id);
  revalidatePath("/settings");
}
