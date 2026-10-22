import { randomBytes, timingSafeEqual } from "node:crypto";

import { GOOGLE_OAUTH_MAX_AGE_SECONDS } from "./config";

export function createGoogleOAuthState(ownerId: string, now = Date.now()) {
  const nonce = randomBytes(32).toString("base64url");
  const payload = JSON.stringify({ nonce, ownerId, issuedAt: now });
  return { nonce, cookieValue: Buffer.from(payload).toString("base64url") };
}

/** Verifies CSRF nonce, expiration, and the currently signed-in Asteria account. */
export function verifyGoogleOAuthState(
  cookieValue: string | undefined,
  returnedState: string | null,
  ownerId: string,
  now = Date.now()
): boolean {
  if (!cookieValue || !returnedState) return false;
  try {
    const payload = JSON.parse(Buffer.from(cookieValue, "base64url").toString("utf8")) as {
      nonce?: unknown;
      ownerId?: unknown;
      issuedAt?: unknown;
    };
    if (
      typeof payload.nonce !== "string" ||
      typeof payload.ownerId !== "string" ||
      typeof payload.issuedAt !== "number" ||
      payload.ownerId !== ownerId ||
      !Number.isFinite(payload.issuedAt) ||
      payload.issuedAt > now ||
      now - payload.issuedAt > GOOGLE_OAUTH_MAX_AGE_SECONDS * 1000
    ) return false;
    const expected = Buffer.from(payload.nonce);
    const actual = Buffer.from(returnedState);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
