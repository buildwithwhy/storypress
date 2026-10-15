# Enable the Gemini Live pilot

## Preview connection

Updated October 15: with owner approval, the nine existing Storypress variables now apply to both Production and Preview. Existing values were reused, not revealed or replaced. The preview was redeployed and its account configuration and Gemini/Vertex + Nimble configuration indicators were verified. Its exact branch URL was also added to Supabase's allowed authentication redirects. Production code and its existing redirect settings were unchanged.

Google sign-in subsequently succeeded. A fictional test story completed a real Vertex chat interview, Vertex keepsake writing, Supabase saving and reload, and an approved mobile reading link. Its title begins `[Test]`; its temporary sharing link was turned off afterward and the story remains private. This was a connectivity test, not a paid quality/cost comparison. The preview remains protected by Vercel authentication, so it is for owner testing rather than public sharing. A branch-specific `STORYPRESS_PUBLIC_SHARING=true` override enables approved-link testing on `codex/independent-sharing-flow`; Production and other Preview branches retain the existing setting.

The last verified variable list has no `GEMINI_API_KEY` for the Gemini Developer API. This is the only additional provider secret needed by the live-voice adapter already built. AI Studio can create that key in the existing Google Cloud project; a new Google account or project is not required. Google also documents creating Gemini API keys through Cloud Console. Add the appropriate key directly to Vercel as a Secret in Preview. The three other Live settings below are configuration, not additional provider credentials. ElevenLabs and OpenRouter are not integrated yet.

This is an implementation choice, not a requirement to leave Google Cloud. Vertex supports Live API too; Google's documented web approach uses an authenticated backend WebSocket relay. That route would need a different connection adapter and deployment setup. The existing Vertex credential is not a drop-in replacement in this Developer API adapter. Credit eligibility and billing have not been verified for either live route. October 15 owner decision: establish Google first, then compare providers, including interview behavior (see INTERVIEW-EVALUATION.md).

## Live voice settings

Use Vercel → storypress-app → Settings → Environment Variables. Apply these to the **Preview** environment first, then redeploy the preview branch. Production does not need to change for this test.

| Variable | Kind | Value |
| --- | --- | --- |
| `GEMINI_API_KEY` | Secret | An existing Google AI Studio Gemini API key with Live API access and billing. Reuse it if already present in Preview. A Vertex API key is a different credential and cannot be substituted here. |
| `GEMINI_LIVE_MODEL` | Config | A Live API model available to that key. Google's current ephemeral-token guide uses `gemini-3.8-live`; verify availability in the account. |
| `STORYPRESS_LIVE_VOICE` | Config | `gemini` |
| `STORYPRESS_LIVE_TEST_EMAILS` | Secret / private config | Comma-separated Google sign-in email addresses allowed to test. Add your actual sign-in address here; do not put it in source control. |

The existing Supabase URL, publishable key, server secret, story tables and quota RPC remain required. Do not send any keys through chat. No ElevenLabs account is needed to try this first adapter.

The backend verifies the signed-in email, reserves three existing pilot quota units, then provisions a one-use token valid for a ten-minute session with a sixty-second connection window. The provider setup/model/instructions are locked into the token. The browser never receives the Google API key. Live sessions cannot refresh their own credentials.

`GEMINI_BACKEND=vertex` may remain for existing text calls; Live uses `GEMINI_API_KEY` directly. Text-provider selection does not silently change. The live model has no fallback: a connection failure preserves the story and offers voice messages/typing.

Chat interview streaming also uses the existing Vertex connection and needs no additional credential. It is separate from native Live voice activation. A streamed preview is not saved until the provider completes and the result validates.

## First real test

1. Sign in on the preview with an allowlisted account. Talk live becomes the first conversation mode.
2. Use a fictional memory for the initial connectivity test. Allow the microphone only when intentionally starting a call.
3. Tell a longer answer, use Pause and Resume, interrupt the assistant, correct a fact, and type one sentence during the same call. Pause should mute both microphone transmission and the optional recording; typed replies remain possible.
4. Finish and confirm both the transcript and the keep/discard recording choice. Recordings are device-only in this build; download a backup if wanted.
5. Download session measurements. Compare with provider billing/usage; the app does not yet calculate a dollar total.
6. Repeat with English, Mandarin and Spanish, then compare an ElevenLabs implementation using the same scenarios before choosing a permanent voice provider.

Google references checked October 15, 2026:
- https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
- https://ai.google.dev/api/live
- https://ai.google.dev/gemini-api/docs/api-key
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/get-started-websocket

No model-quality or price winner has been established. No paid benchmark was run during implementation.
