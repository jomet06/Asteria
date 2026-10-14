# Supabase Auth setup

The application uses Supabase Auth for email/password and Google sign-in. SMTP configuration belongs in the Supabase Dashboard, not in frontend environment variables.

## Confirmation email delivery

1. Inspect Authentication > Users for the test account's confirmation state. In Auth logs inspect the error code on the failed password login; HTTP 400 alone does not identify the cause.
2. Configure a custom SMTP provider for public registrations. Supabase's default sender only supports organization team addresses and is limited to two messages per hour. Verify the provider's sending domain and sender address, and disable link tracking if it rewrites confirmation URLs. Keep SMTP credentials in the Supabase Dashboard.
3. Set `NEXT_PUBLIC_SITE_URL` to the application origin. Configure Supabase's Site URL and allow the exact `<origin>/auth/callback` URL in Authentication > URL Configuration, including the development origin when testing locally.
4. Keep email confirmation enabled. Request one confirmation email and check both Supabase Auth logs and the SMTP provider's delivery events. A successful signup or resend response does not prove inbox delivery, and repeat signup responses can obscure existing accounts.
5. Open the latest confirmation link in the same browser used to request it; the callback exchanges the PKCE code using that browser's verifier cookie. Check that a confirmed account can sign in with its password.

Application server logs include only the operation, Auth error code and HTTP status. They deliberately omit emails, passwords, tokens and raw provider messages. The login page distinguishes unconfirmed email, incorrect credentials and request limits. Confirmation email resend is not exposed by the application.

## Security advisor findings

- `_prisma_migrations`: inspect existing grants and the migration database role before applying a migration to revoke Data API access from `anon` and `authenticated` and enable RLS. The Prisma migration role still needs access; do not drop the table.
- `profiles`: RLS is already enabled by the initial migration. The app currently has no client profile operations, so keep access blocked until a feature needs it. Before adding policies, verify that `profiles.id` is the corresponding `auth.users.id`, then scope each permitted operation to `auth.uid() = id`.
- Leaked password protection is a Supabase Auth setting. Enable it if supported by the project's plan.

No database grants, policies or hosted Auth settings are changed by the application patch.

References: [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes), [resend API](https://supabase.com/docs/reference/javascript/auth-resend).
