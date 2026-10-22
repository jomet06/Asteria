import { NextResponse } from "next/server";

import { getMyAccount } from "@/features/profile/data";
import {
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_OAUTH_MAX_AGE_SECONDS,
  getGoogleOAuthConfig,
} from "@/features/calendar/google/config";
import { buildGoogleAuthorizationUrl } from "@/features/calendar/google/oauth";
import { createGoogleOAuthState } from "@/features/calendar/google/state";

export async function POST(request: Request) {
  // The browser initiates this action from the Asteria Settings page only.
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const expectedOrigin = process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
    : url.origin;
  if (!origin || origin !== url.origin || origin !== expectedOrigin) {
    return new Response("Invalid request origin", { status: 403 });
  }

  const { user } = await getMyAccount();
  let authorizationUrl: string;
  try {
    getGoogleOAuthConfig();
    const { nonce, cookieValue } = createGoogleOAuthState(user.id);
    authorizationUrl = buildGoogleAuthorizationUrl(nonce);
    const response = NextResponse.redirect(authorizationUrl, { status: 303 });
    response.cookies.set({
      name: GOOGLE_OAUTH_COOKIE,
      value: cookieValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/integrations/google",
      maxAge: GOOGLE_OAUTH_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/settings?google=config_error", url.origin), { status: 303 });
  }
}
