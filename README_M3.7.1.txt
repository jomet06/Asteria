ASTERIA M3.7.1 — CONNECT GOOGLE CALENDAR (READ-ONLY OAUTH)

REPO BASELINE: github.com/jomet06/Asteria, main (checked Oct 22, 2026)

All included .ts/.tsx/.prisma/.sql/.mjs files are COMPLETE files, not diffs.
Extract into the root of your local Asteria project preserving paths.

Set Google OAuth web-app Authorized redirect URI exactly:
http://localhost:3000/api/integrations/google/callback

Set the following in .env.local (do not commit):
GOOGLE_CLIENT_ID=<your_web_client_id>
GOOGLE_CLIENT_SECRET=<your_web_client_secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=<64_hex_characters_generated_locally>

Generate the encryption key locally using:
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
Keep the encryption key; rotating it invalidates stored encrypted refresh tokens.

INSTRUCTIONS:
1. Review file inventory and migration and copy full files into project.
2. Confirm DIRECT_URL points to your intended development Supabase database and back up.
3. npx prisma validate
4. npx prisma migrate status
5. npx prisma migrate deploy
6. npx prisma generate
7. node scripts/check-google-connection-schema.mjs
8. node --test scripts/check-google-oauth.mjs
9. npx tsc --noEmit
10. npm run lint
11. npm run build
12. Stop/restart Next dev server: npm run dev
13. /settings > Connect Google Calendar > consent > back to settings, connected email.
14. Test cancel/reconnect/disconnect and separate-user isolation.

NOTE:
- Google Login via Supabase is unchanged.
- This step only connects a Google account with read-only Calendar access.
- No events are copied, synced, deleted or modified.
- OAuth Client Type: Web application; configure Google Calendar API and consent screen.
- External Testing consent refresh tokens may expire in ~7 days.
- Do not commit .env.local, token encryption key, OAuth codes or tokens.
- Disconnect removes the local credential; user may revoke grant at Google Account settings.
- Direct HTTP endpoints use native fetch; no new npm dependency required.
