/** Google Calendar is connected separately from Supabase authentication. */
export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const;

export const GOOGLE_OAUTH_COOKIE = "asteria_google_calendar_oauth";
export const GOOGLE_OAUTH_MAX_AGE_SECONDS = 600;

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google Calendar OAuth is not configured.");
  }

  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new Error("Invalid Google Calendar redirect URI.");
  }

  const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (
    parsed.pathname !== "/api/integrations/google/callback" ||
    parsed.search || parsed.hash || parsed.username || parsed.password ||
    !(parsed.protocol === "https:" || (isLocal && parsed.protocol === "http:"))
  ) {
    throw new Error("Google Calendar callback URI must match the Asteria OAuth callback.");
  }

  return { clientId, clientSecret, redirectUri };
}

export function googleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI &&
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  );
}
