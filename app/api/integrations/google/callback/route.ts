import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { GOOGLE_OAUTH_COOKIE } from "@/features/calendar/google/config";
import { encryptGoogleRefreshToken } from "@/features/calendar/google/crypto";
import { exchangeGoogleCode, getGoogleAccount } from "@/features/calendar/google/oauth";
import { verifyGoogleOAuthState } from "@/features/calendar/google/state";

function finish(origin: string, code: string) {
  const response = NextResponse.redirect(new URL(`/settings?google=${code}`, origin), { status: 303 });
  // Remove same-path cookie even on OAuth denial or failure.
  response.cookies.set({
    name: GOOGLE_OAUTH_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/google",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectOrigin = process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
    : url.origin;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return finish(redirectOrigin, "session_expired");

  const cookieValue = (await cookies()).get(GOOGLE_OAUTH_COOKIE)?.value;
  if (!verifyGoogleOAuthState(cookieValue, url.searchParams.get("state"), user.id)) {
    return finish(redirectOrigin, "invalid_state");
  }
  if (url.searchParams.has("error")) return finish(redirectOrigin, "cancelled");
  const code = url.searchParams.get("code");
  if (!code) return finish(redirectOrigin, "oauth_error");

  try {
    const tokens = await exchangeGoogleCode(code);
    const google = await getGoogleAccount(tokens.accessToken);
    const previous = await prisma.googleCalendarConnection.findUnique({
      where: { ownerId: user.id },
      select: { googleAccountId: true, refreshTokenEncrypted: true },
    });

    // Google may omit a new refresh token for a previously authorized account.
    // Only reuse an existing token when it belongs to the same Google account.
    const encryptedToken = tokens.refreshToken
      ? encryptGoogleRefreshToken(tokens.refreshToken)
      : previous?.googleAccountId === google.accountId
        ? previous.refreshTokenEncrypted
        : null;
    if (!encryptedToken) return finish(redirectOrigin, "refresh_required");

    await prisma.googleCalendarConnection.upsert({
      where: { ownerId: user.id },
      create: {
        ownerId: user.id,
        googleAccountId: google.accountId,
        googleEmail: google.email,
        refreshTokenEncrypted: encryptedToken,
        grantedScopes: tokens.grantedScopes,
      },
      update: {
        googleAccountId: google.accountId,
        googleEmail: google.email,
        refreshTokenEncrypted: encryptedToken,
        grantedScopes: tokens.grantedScopes,
      },
    });
    return finish(redirectOrigin, "connected");
  } catch {
    // Do not leak authorization codes, tokens, or Google API response bodies.
    return finish(redirectOrigin, "oauth_error");
  }
}
