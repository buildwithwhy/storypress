# Gemini Live voice

## Production access

As of October 16, 2026, live voice is enabled on the main Vercel site for any signed-in Storypress account. Google sign-in and email sign-in use the same access check. The former `STORYPRESS_LIVE_TEST_EMAILS` setting is ignored; it is no longer an access restriction.

The owner completed a real microphone conversation on production. Playback continuity, buffering and cleanup were subsequently improved after reports of beeping and delay. Regression checks cover audio handling, but a further real multi-turn conversation is needed to assess those symptoms.

## Required configuration

Vercel → storypress-app → Settings → Environment Variables. These are already configured for Production and Preview. Redeploy after changing a value.

| Variable | Kind | Value |
| --- | --- | --- |
| `GEMINI_API_KEY` | Secret | Existing Gemini Developer API credential. Keep it on the server. |
| `GEMINI_LIVE_MODEL` | Config | `gemini-3.8-live`, currently configured for this app. |
| `STORYPRESS_LIVE_VOICE` | Config | `gemini`; clear this value to disable live voice. |

Supabase URL, publishable key, server secret, story tables and the durable quota RPC remain required. Missing account configuration disables live voice. No additional provider key is needed for this rollout.

The backend verifies a Supabase session and reserves three existing AI allowance units before provisioning a one-use token. Each token allows up to ten minutes with a sixty-second connection window; the model and instructions are locked into it. Existing account and site daily limits remain in force. The browser never receives the Google API key and cannot renew its own token.

Text and image requests continue to use the existing Google Cloud/Vertex connection. This Live adapter uses `GEMINI_API_KEY` directly and does not silently fall back to another provider. Failed connections preserve the transcript; voice messages and typing remain available.

## Testing with another person

1. Open https://storypress-app.vercel.app/ and choose English, 中文 or Español from the visible language buttons.
2. Start a story and sign in. Talk live is the default conversation mode for signed-in users with live voice available.
3. Intentionally start the call and allow the microphone. Give a longer answer, pause/resume, interrupt a reply, correct a fact and type during the same conversation.
4. Finish and check the transcript and the keep/discard recording choice. Recordings are device-only in this build; download a backup before refreshing if wanted.
5. If audio degrades, download session measurements. They include queue/underrun/interruption measurements, timing and usage, without transcript or audio. No dollar estimate is calculated yet.
6. Try the same scenarios in English, Mandarin and Spanish. Provider quality and cost comparisons, including ElevenLabs, remain separate work.

Implementation references:
- https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
- https://ai.google.dev/api/live
- https://ai.google.dev/gemini-api/docs/api-key
