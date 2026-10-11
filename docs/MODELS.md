# Models and media

Checked against official Google documentation on **October 11, 2026**.

## Current implementation

The configured deployment uses **Vertex AI / Google Cloud**, with `gemini-3.8-flash` for interviewing, research planning and source editing, newspaper writing, photo interpretation, and recorded-answer transcription. Questions are read aloud by the browser's speech synthesis; no Gemini or ElevenLabs speech-generation call is made. Nimble retrieves web results; Gemini decides what to ask or write from the supplied material.

Per-task routing is available, but **no task default has changed**. Resolution is the task-specific setting, then `GEMINI_MODEL`, then `gemini-3.8-flash`:

| Task | Optional server environment setting |
| --- | --- |
| Interview | `GEMINI_INTERVIEW_MODEL` |
| Newspaper writing | `GEMINI_WRITING_MODEL` |
| Photo interpretation | `GEMINI_PHOTO_MODEL` |
| Recorded-answer transcription | `GEMINI_TRANSCRIPTION_MODEL` |
| Research planning and source editing | `GEMINI_RESEARCH_MODEL` |

Set `GEMINI_BACKEND=vertex` for the Google Cloud billing route. AI Studio is a separate supported text backend with separate billing; Google Cloud welcome credits do not cover its Developer API. Keys belong only in server environment settings. The frontend never selects arbitrary models.

## Economical next experiments

First improve the interview instructions and research flow. A larger model alone will not discover a restaurant unless the workflow asks for enough detail and runs a search.

- Try stable `gemini-3.5-flash-lite` for research planning and extraction: **$0.30 input / $2.50 output per million tokens** at standard global Cloud rates. Compare relevance and source fidelity before changing the default.
- Keep `gemini-3.8-flash` for the interview and writing initially. Current introductory rates are **$0.75 / $3.75 per million input/output tokens through December 31, 2026**, rising to **$1.50 / $7.50 on January 1, 2027**. Output billing includes thinking tokens.
- Gemma 4 is a separate open-weight family. Managed `gemma-4-26b-a4b-it-maas` accepts text/images and produces text; it is **not an image generator**. It needs an open-model API adapter and evaluation, not just a Gemini model-name substitution.

## Illustration policy

The newspaper includes **three premade editorial illustrations**, reused across stories at **no image-generation API fee per story**. They are decorative illustrations, not depictions of the narrator's actual life.

The narrator can also explicitly request **one bespoke illustration or a three-panel wordless comic**, grounded in their own words. This uses **Nano Banana 2 Lite**, default `gemini-3.1-flash-lite-image`, through a separate Vertex image-output call. Optional server setting `GEMINI_IMAGE_MODEL` overrides this image model; image generation is Vertex-only. It cannot use the text adapter's JSON response mode.

A 1K output image costs approximately **$0.0336**, plus input processing and any text-output costs. A three-panel comic is composed within one image. Each attempt reserves **three existing daily AI units**, using the existing heavier-action allowance; app units are not a dollar price. Retries and explicit regeneration are new attempts. Generation is never automatic when writing, reopening, printing, or sharing a story.

The generated image is compressed into a JPEG data URI capped at **300 KB**, kept with the device draft and account story, and reused. This uses the existing story document storage, with no new Supabase migration or storage bucket. The existing total document-size limit still applies, including any uploaded photo and interview text.

The narrator can review, select, or remove generated art. Selected art travels with the approved newspaper in print, download, and sharing; an uploaded photograph remains available. Mark generated art as AI illustration. Never present invented faces, buildings, dates, or scenes as documentary evidence, and never add those inventions to the biography. An image failure leaves the newspaper usable. Accurate timelines and route diagrams should use confirmed data and ordinary rendering, not image-model guesses.

## Official references

- [Google Cloud model pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
- [Gemini models and stable/preview status](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3.5 Flash-Lite on Cloud](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash-lite)
- [Nano Banana 2 Lite on Cloud](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-lite-image)
- [Generate images with Gemini](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/image-generation)
- [Managed Gemma models on Cloud](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/maas/google)
- [Developer API billing and welcome-credit exclusion](https://ai.google.dev/gemini-api/docs/billing)

Availability, regional prices, and credit eligibility can change; verify the intended account before switching a production model.
