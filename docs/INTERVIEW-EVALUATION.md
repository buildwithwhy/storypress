# Storypress interview evaluation

Decision, October 15: build and establish a Google baseline first. Interview quality is a first-class comparison, separate from voice pleasantness and final keepsake quality. No comparative provider trial has been run and no winner has been selected.

## Two complementary comparisons

1. Controlled next-turn cases: give each candidate the same conversation, instructions, selected references and language. Randomize and hide provider names when rating the next response. This isolates the interview model's behavior.
2. Complete 5–10 minute sessions: use the same fictional narrator briefs, with a human responding naturally. Repeat sessions and vary provider order. Record the actual prompts and settings; adaptive conversations will not have identical transcripts. This measures the whole experience, including silence, interruption, speech recognition, mixed typing and voice, and the resulting draft.

Start with three fictional briefs: an everyday cooking memory; moving to a new neighborhood with an uncertain date; and a message to a relative about a shared moment. Test English, Mandarin and Spanish separately with speakers who can judge each language. Do not infer language suitability from a provider's nationality or English scores. Simulated narrators can exercise code paths but do not replace human sessions.

## Interview cases and observable expectations

| Case | Fictional input or behavior | What to assess |
| --- | --- | --- |
| Sparse answer | “We used to cook together.” | One concrete, easy opening; no assumed dish or emotion, no bundle of questions. |
| Rich answer | Describe the flour, failed pancake, shared laughter and who cleaned up. | Follow an unresolved thread; do not ask again what happened or what the room looked like. |
| Meaning | “That was the first time she trusted me with it.” | Explore what trust meant to the narrator without declaring pride or a life-changing event. |
| Correction | “It was my aunt, not my mother.” / “不是妈妈，是阿姨。” / “Era mi tía, no mi madre.” | Use the correction in later questions and in the draft. |
| Uncertainty | “Maybe 1982, or earlier.” | Preserve uncertainty; no invented exact date. |
| Boundary | “I don't want to talk about why we left.” | Move on without asking for an explanation or later returning uninvited. |
| Remembering | Pause mid-answer, then resume. | Allow space; measure premature interruptions and recovery. A pause alone is not consent to finish. |
| Interruption | Interrupt the assistant with a correction; also type a correction during voice. | Stop playback promptly, capture the correction once and continue the same thread. |
| Language | Use Mandarin with an English place name, then request Spanish. | Retain proper names and follow the requested language without restarting. |
| Public context | Select an archive excerpt, then say “That doesn't match my memory.” | Treat the source as context, not proof; respect disagreement and do not rewrite the memory. |
| Topic or intention | Start in “new chapter” but talk about an everyday memory; create a message without expressing affection. | Follow the narrator over the mode; do not manufacture a milestone or affection. |
| Finish | “That's all I want to say. Make the draft.” | Close without another question; retain what was supplied, even if short. |

## Record separately, then decide

- Interview behavior: relevant follow-ups, repetition, leading assumptions, fact/correction retention, respect for boundaries and how much useful material emerged. Record examples, not just an average score. Fabricated memories, ignored corrections and ignored stop requests are major failures even when the voice sounds good.
- Narrator experience: “I remembered or expressed something I hadn't before,” ease, comfort, control, and willingness to continue. A longer transcript is not automatically a better interview.
- Voice delivery: end-of-speech to first audible response, interruptions, pronunciation, transcription errors, connection failures and successful recovery. Report median and slow-tail response times. The current prototype's firstAudioMs starts at connection initiation; it is not per-turn response latency and must not be labeled as such.
- Final keepsake: faithfulness, first-person voice, structure, correction burden and willingness to send it. Judge this separately so polished writing cannot conceal a poor interview.
- Cost: observed provider usage and billing for the whole session plus drafting, research, illustrations, retries and any dedicated hosting. Include thinking/output tokens and caching when applicable. Record date, exact model/version, endpoint, region and configuration. Do not substitute list price per token for completed-session cost.

The first small trial is exploratory, not a statistically definitive ranking. Repeat weak or inconsistent cases, preserve the shared baseline, and tune candidates comparably. Choose different models per task or language only if measured benefits justify added complexity. Hosted open models are eligible; self-hosting costs and operating work must be included when evaluating that route.

## Current implementation limits

Typed/recorded-message interviews and live voice share behavior guidance and the same context builder. Live receives selected research and tentative photo clues at session start; new research is not pushed into an already-open voice connection. The live adapter cannot itself search or generate a keepsake. Text-model selection and native live-model selection remain separate. Real Google billing/access, microphone behavior and interview quality still require a hosted test. No ElevenLabs, OpenRouter or open-model adapter is active yet.
