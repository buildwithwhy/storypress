# Email-code sign-in

Updated October 15, 2026.

The preview offers Google and email-code sign-in together. Email accepts ordinary addresses, including Hotmail/Outlook; it does not require a Google account. The client uses Supabase `signInWithOtp` and `verifyOtp` with `type: email`. Codes stay in component memory, are sent only to Supabase, and are never logged or added to story data.

The form supports requesting a code, pasting it, retrying an incorrect/expired code, changing the address, and a 60-second resend cooldown. Supabase remains authoritative for rate limits and expiry. Request and verification both preserve the current guest draft; successful sign-in resumes unsent words and photographs through the existing email-bound handoff. Google sign-in remains available.

## Provider configuration

Verified in the Storypress Supabase dashboard: Email is enabled and email confirmation is required. Custom SMTP is now configured via Resend: host `smtp.resend.com`, port 465, SMTP user `resend`. The sender is `signin@buildwithwhy.com` with display name "Once & Ours"; the sending domain is verified. The API key is stored only in Supabase (Dashboard → Auth → SMTP settings) — never in source control, docs, chat, or Vercel. With the custom sender, the email rate limit is 30 per hour (previously locked at 2 per hour on the built-in sender). The Supabase per-address resend interval remains 60 seconds, and the app's 60-second resend cooldown is unchanged.

Both **Magic link or OTP** and **Confirm sign up** were updated to the checked-in `supabase/templates/sign-in.html`, subject **Your Storypress sign-in code**. The template includes `{{ .Token }}` plus `{{ .ConfirmationURL }}` for compatibility with the existing production/ChatGPT email-link interfaces. These templates belong to the shared Supabase project; the application code is deployed only to the preview branch.

Complete setup at:
https://supabase.com/dashboard/project/ciciuohgtvsdkeakfiht/auth/smtp

SMTP credentials live in Supabase (Dashboard → Auth → SMTP settings), not source control or chat. Keep the per-user interval at 60 seconds unless a measured need requires changing it. Test delivery and code verification with both a new and returning account, including Hotmail/Outlook — this guidance now applies to the custom Resend sender. Existing rate limits continue to apply.

No additional Vercel variable is required for email sign-in.

## Validation

- TypeScript and Vercel bundle passed.
- `scripts/check-email-auth.mjs` uses a mocked Supabase transport to check normalized Hotmail addresses, incomplete-code rejection, incorrect-code errors, successful verification and normal authenticated API headers.
- Existing draft-handoff checks cover unfinished text, photographs, email/account binding, expiry and recovery.
- Mobile browser QA at 390px used a local fictional auth server: code request, disabled resend countdown, wrong-code feedback, successful verification and unchanged unfinished story text. No real email was sent during this QA.

Official references:
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-smtp
