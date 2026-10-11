# Connect and test Storypress

Continue the project in this folder. Product context: a very simple interface for older and nontechnical people to tell stories in their language. Thoughtful interviewing Skills should help them recall specific scenes. Nimble optionally finds a relevant historical item that may unlock another memory. The result is an editable personal newspaper with testimony separate from sourced context. ValueCompass is out of scope for today.

## Already built
React client with English/Chinese/Spanish selection, guided or AI interview, recording/transcription, photo upload, local drafts, curated sample, historical recognition and inclusion, newspaper editing/review/printing, original transcript and JSON export. Runtime editorial Skills have primary-source research notes. A Cloudflare Worker supplies same-origin APIs and static assets. `worker/index.js` is bundled; source is in `app`, `lib`, `server`, and `worker/main.ts`.

## Do next
1. Run `npm install` where package-network access works, then `npm run dev` (local URL 127.0.0.1:4173). The bundled Worker also runs via `npm start` with no package download if dist is present.
2. Use Google Cloud project `storyteller-511316` with `GEMINI_BACKEND=vertex`, `GOOGLE_CLOUD_LOCATION=global` and a server-side `VERTEX_API_KEY` authorized for the Agent Platform API. Cloud mode uses GenerateContent and does not fall back to AI Studio. Nimble is configured and its live search test passed. The original AI Studio key returned HTTP 402 and cannot call the Cloud API due to its service restrictions. Cloud trial balance was verified as $300 unused. Follow the latest `README.md` configuration notes; never commit keys or place them in browser code.
3. Cloud credentials are configured and a live project-specific Gemini 3.8 Flash request succeeded on October 11, 2026. Test a real typed and spoken memory next. Verify transcript corrections, interview relevance, historical relevance, return schema, faithful draft, and bilingual output with a fluent reader. The complete narrator flow has not yet been tested.
4. Browser-check desktop and phone layout, the sample loop, save/restore, original-word comparison, source exclusion and Print to PDF. Browser QA was blocked in the original sandbox.
5. Run `npm run typecheck`, `npm run build`, and `node scripts/check-worker.mjs` after changes.
6. Reuse Site project_id appgprj_6acbadc7efe48191b514ff40981a0568 if using Sites. Source-host connectivity was verified after the initial network restriction was resolved. Use the Sites skill to inspect current deployment status, sync changes and publish privately. Do not create a second Site. Development can continue in this Codex workspace.

## Product judgments still to make
Does a real archival finding improve the conversation? Does the finished story sound like the narrator? Can someone unfamiliar with AI complete the flow without explanation? Which additional languages deserve careful localization? Do not add books, comics, public contribution links or Sentry until the core loop works with actual users.

## Known limits
No cross-device account storage or public family invitations; private first version. Photos are used in layout, not analyzed. Recordings need downloading before refresh; drafts persist locally. Home previews, sample editions and newspaper presentation support English, Chinese and Spanish; some interview and discovery explanations remain English. Exact-quote/source-URL checks cannot validate all factual content. Narrator review remains essential. No Sentry integration yet.
