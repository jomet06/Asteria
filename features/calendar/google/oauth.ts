import { GOOGLE_CALENDAR_SCOPES, getGoogleOAuthConfig } from "./config";

type GoogleTokens = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expires_in?: number;
};

export function buildGoogleAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getGoogleOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  grantedScopes: string;
}> {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Google OAuth code exchange failed.");
  const tokens = (await response.json()) as GoogleTokens;
  if (!tokens.access_token || typeof tokens.scope !== "string") {
    throw new Error("Incomplete Google OAuth response.");
  }
  const granted = new Set(tokens.scope.split(/\s+/));
  const required = GOOGLE_CALENDAR_SCOPES.filter((scope) => scope !== "openid" && scope !== "email");
  if (!required.every((scope) => granted.has(scope))) {
    throw new Error("Required read-only Calendar permissions were not granted.");
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    grantedScopes: tokens.scope,
  };
}

/** Uses the access token returned by the verified Google token endpoint. */
export async function getGoogleAccount(accessToken: string): Promise<{
  accountId: string;
  email: string | null;
}> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Could not identify the authorized Google account.");
  const userInfo = (await response.json()) as { sub?: unknown; email?: unknown };
  if (typeof userInfo.sub !== "string" || !userInfo.sub || userInfo.sub.length > 255) {
    throw new Error("Invalid Google account identifier.");
  }
  return {
    accountId: userInfo.sub,
    email: typeof userInfo.email === "string" ? userInfo.email.slice(0, 320) : null,
  };
}
