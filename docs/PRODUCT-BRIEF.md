# Storypress: first experience design brief

Discovery draft, October 15, 2026. Product choices recorded from Yuyu's answers. Proposed design and engineering decisions are identified separately. Implementation status is tracked separately in BUILD-DECISIONS.md.

## Product promise

A conversation that helps someone remember or express something new, followed by a beautiful personal story they can send to someone they care about.

The primary journey begins with someone discovering Storypress and creating their own story. Collaboration is an optional branch. The intended discovery loop is: discover the app, use it, optionally collaborate, share a keepsake, and let a reader discover the app and start their own story. People arriving through a collaboration invitation enter directly into using the product with the appropriate story context and permissions. This describes a desired loop to test, not measured growth.

Yuyu clarified this priority on October 15 after the initial discovery questions overemphasized invitations. Design and validate the complete independent-creator experience first. The invitation decisions below apply to that optional branch.

## Confirmed priorities

| Area | Decision |
| --- | --- |
| First users | People preserving their own life memories; people collecting a parent's or relative's stories |
| Primary journey | Discover Storypress, make a story independently, optionally invite collaborators, then share |
| Sharing loop | Someone sees a shared keepsake and can start their own story |
| Collaboration entry | Invited people enter the use/contribution stage directly; an invitation is not required to create a story |
| Initial value | Discover or express a memory, and leave with something beautiful to send |
| Invited storyteller | Opens a link and talks to Storypress independently |
| Invitation | Starts with a personal question from the inviter |
| First visit | Designed around a 5–10 minute commitment; longer conversations remain possible |
| Writing | Polished first-person narrative, with stronger structure and flow |
| Finishing | Independent creators finish their own keepsake; invited relatives may finish it themselves or hand it to the inviter |
| Handoff authority | Storyteller chooses permissions, including whether edits need approval before sharing |
| Outputs | Newspaper, mini booklet, and letter/card; message intention may address a recipient directly or preserve a memory |
| First reveal | A beautiful editable keepsake draft |
| Voice | Live conversation primary, with voice messages and typing sharing the same story |
| Interview pace | Begin gently and adapt to how much the narrator says |
| Distribution | Mobile reading page, readable share images, save-copy and print controls |
| Recording retention | Narrator chooses at the end whether to keep the full recording |
| Cost target | Measure quality and total cost before choosing the target |
| Visual directions | Warm illustrated memoir; playful vintage newspaper; scrapbook with photographs and handwritten touches |
| Original audio | Selected voice clips are an optional part of the keepsake |
| Historical research | Useful context appears during the conversation when it can prompt another memory |
| Invited access | Start through the invitation; sign in later to manage stories |
| Initial funding | Yuyu funds a small pilot, while testing payment at finishing/export |
| Free allowance candidate | Yuyu suggested the first five free; the counted unit, account scope, limits, and paid price are not yet confirmed |

Visual directions are candidates within the preferred formats, not three separately committed products. Existing English, Mandarin, and Spanish support remains the working baseline. The desired expansion to collections, larger books, collaborators, and social sharing remains part of the wider roadmap.

## Proposed primary journey: independent creator

1. **Discover the possibility.** Show an example of a finished booklet or newspaper and a clear primary action to start a story. Organic and shared-keepsake discovery use the same creation and sign-in path. Explain the first-visit commitment and included offer clearly.
2. **Find a starting point.** Offer talking/typing about a memory, starting from a photo, or getting help choosing a topic. Do not require a project, invitation, collaborator, book outline, or visual-template choice before the first answer. Exact onboarding choices remain a design proposal.
3. **Tell one memory.** Use what the person supplies to ask specific follow-ups. Permit pauses, corrections, topic changes, and returning later. Save accepted content incrementally. Aim for a useful small story from a 5–10 minute first visit.
4. **Use context when it helps.** Research public clues in the background. Offer a concise sourced observation at a natural break if it could lead to another recollection. Acknowledge uncertainty and let the storyteller reject the connection.
5. **Review and finish.** Once there is enough material, offer a polished first-person draft in a designed preview. The creator can correct details, add more, change style, add photos, and optionally select original voice clips. Length follows the available content.
6. **Keep or share.** Save a private story or deliberately share an approved edition as a readable link and printable file. Subsequent private edits remain separate until republished. Sharing is optional; completing a private keepsake is also a successful outcome.
7. **Create again.** A reader can choose to make their own story, and the original creator can return to another memory or later assemble a collection. Measure these as separate return and discovery behaviors.

## Optional collaboration and invitation entry

Collaboration can branch from a story in progress; it is not a setup requirement or a gate to completion. A creator can later invite another person's perspective or ask for help editing. Reading a shared edition grants no contributor access by itself.

For the already-discussed family use case, the inviter writes a personal question and shares a link. The relative enters the contribution experience directly, sees who asked and why, and can start without sign-in. After telling their account, they can finish it themselves or hand it over with chosen editing/publication permissions. Later sign-in connects the contribution to their account for story management.

Preserve these requirements for the collaboration phase. The first design and implementation milestone must demonstrate the entire independent-creator journey without relying on any invitation or membership workflow.

## Proposed access and pilot offer

The confirmed commercial direction is a founder-funded pilot and a test of payment at finishing/export. Invitation-first access and later sign-in for management are confirmed for invited relatives. The desired account boundary is after a first keepsake or after a short conversation trial, identically for organic and shared-link discovery; a proposed default is to let them begin and see value before asking them to sign in for durable management. The following mechanics are recommendations to evaluate, not a finalized price or allowance:

- An invitation grants limited access to its own contribution. Save accepted turns before sign-in. Later sign-in links the existing contribution to the verified account and preserves text, audio choices, edits, and permissions. Define recovery, expiry, and account-conflict behavior before implementation.
- Treat "first five free" as a candidate allowance of five completed story keepsakes per creator account. Later, a story can have a designated paying account when collaboration is added. Independent creation requires no organizer or sponsoring-relative concept. Confirm the counted unit and scope before displaying a promise to users.
- A completed free keepsake should include a usable sharing link and standard printable export, so the free experience delivers the intended value. Previewing, correcting, downloading again, or handing over the same story should not consume another story allowance. Define the included generation/revision budget separately.
- For invited contributions, propose that the organizer covers paid finishing/export; a handoff does not silently move payment responsibility to the relative. This payer default still needs confirmation.
- Show what is included and any later price before a person invests in the interview. Keep the accepted original account accessible if they decline a paid offer. Payment should not be presented as a condition for recovering their words.
- Fund a small defined pilot and measure actual spend per completed keepsake before committing to a permanent five-free offer. Enforce an explicit pilot budget and internal limits on audio duration, image regeneration, research, and retries. No budget or paid provider usage has been authorized by this brief.
- Keep the free allowance and finishing/export offer configurable so the funded pilot and later commercial test can use the same journey. A re-download must not regenerate the edition or trigger another charge.

Measure discovery-to-start, time to first answer, arrival at a useful draft, finished keepsakes, shares, readers starting their own stories, creators returning, reactions to a clearly described paid offer, completed purchases when checkout exists, and total cost per completed story. When collaboration is introduced, add invitation acceptance and handoff completion. An expressed interest in buying is a different measure from a purchase; a share is not evidence of a new-user conversion by itself.

## Experience recommendations

- Start with a warm memoir treatment for the booklet and a vintage treatment for the newspaper. Explore scrapbook elements within these layouts. Offer style choice after there is a story to preview.
- Keep the independent creator's main path complete and prominent. Discovering through an invitation is an alternative entry into the same product, with contribution-specific permissions.
- On an accessible shared edition, offer a restrained "Make your own story" action that starts a new private story. A new creator can reuse a visual treatment without inheriting another person's private source material. Reading must not require an account or automatically enroll someone as a collaborator. Do not expose a private edition's contents in public previews.
- Keep the storyteller's first session focused on telling. Images, layout changes, and audio selection can happen afterward or through the handoff.
- Design a satisfying small output from a short conversation. Use short passages, illustrations, and available photos; avoid filling pages with unsupported detail.
- Preserve the person's expressions, uncertainty, and perspective through editorial restructuring. Gather missing facts through questions.
- Preserve a smooth conversation while research is running. Slow or failed research must not block speaking, typing, saving, or finishing.
- Keep personal recollection and external historical context identifiable. Finding a source about a place or event does not prove that the narrator experienced it.
- Use readable text and simple controls on phones. Handwritten touches belong in accents, not essential body copy or controls.
- Let original voice clips be selected through transcript excerpts and playback. A full audio editor is outside the first useful scope.

## Proposed technical boundaries

| Component | Responsibility |
| --- | --- |
| Story and creator | Independent creation, ownership, topic and lifecycle; no invitation or collection required |
| Conversation | Accepted transcript turns, corrections, language, resumable progress, source-audio references when recording is retained |
| Interview engine | Follow-ups, appropriate pacing, context use and draft readiness; provider remains replaceable |
| Research job | Approved public query, source URLs, place/date match, candidate context and suggested question |
| Story draft | Versioned first-person prose derived from the account; separate from transcript and layout |
| Collaboration and handoff, later | Optional membership, contributions, editing, source-material access and publication permissions, enforced on the server |
| Media | Private originals, display assets, time-aligned transcript/audio, selected clips |
| Edition | Approved story version, visual treatment, selected images/audio, sharing access and printable output |
| Invitation, later | Personal question, inviter, intended story/collection, access scope and lifecycle |
| Access claim | Account association, resume and recovery without lost content; optional guest entry and later invitation sessions have distinct access policies |
| Usage and offer | Creator/paying account, measured usage, configurable free allowance, paid entitlements and spend bounds |

These are conceptual boundaries rather than a finalized database schema. Keep Vercel, Supabase, and the existing application as the working foundation. Existing owner-only storage does not yet implement invitation or contributor access.

Voice evaluation must include retaining and finding the storyteller's original audio, as well as natural interaction. Text evaluation must include useful questions and faithful first-person editing. Model and provider choices remain provisional until evaluated against the actual workflow.

## First useful scope and later extensions

The first complete scope is independent discovery, starting a story, a short interview, a useful draft, a designed keepsake with optional selected voice clips, and deliberate sharing. The reading experience should offer a path to starting a new story. No collaborator, organizer, or invitation is required to complete or validate this scope.

Later extensions include optional collaborators, the family invitation/handoff flow, combining several stories into a larger booklet, multi-person event contributions, richer book editing, and direct social publishing. Keep ownership and editions compatible with these extensions. Their relative order can follow evidence from the first independent-creator tests.

## Decisions still open

- The sign-in point and any limited guest allowance for independent arrivals; content must survive authentication. Invitation recovery, expiry and account linking are decisions for the later collaboration branch.
- Exact free-allowance unit and account scope, the payer for invited stories, the paid offer and price, and the pilot spend limit.
- The default handoff permissions and whether full transcripts or source recordings are shared with an editor.
- Retention is chosen at session end; storage lifetime, abandoned-session cleanup and cloud recording deletion mechanics still need implementation choices.
- Exact visual templates, illustration controls, and layout behavior when photos are absent.
- Public versus link-only sharing defaults and what appears in social previews.

## Proposed acceptance checks

- A person discovering the product independently can understand the result, find a topic, and reach a useful draft from a 5–10 minute first visit without creating an invitation or adding a collaborator.
- A disconnect or navigation does not lose accepted conversation content.
- Any later sign-in preserves accepted work. For the collaboration phase, an invited person can start without sign-in and later associate their contribution with an account without transferring unintended access.
- Research never blocks the interview; introduced context is traceable and remains distinct from recollection.
- The first-person draft preserves names, relationships, uncertainty, and factual details supplied by the narrator.
- Reading a shared edition does not grant editing access. Choosing to make a new story starts separate private work. For the collaboration phase, handoff access and publication authority match the storyteller's choices, including unauthorized-user checks.
- A selected voice clip plays beside the right passage without granting access to an unshared source recording.
- The digital edition reads well on a phone, and print export is paginated cleanly without clipped text or images.
- Record total cost, latency and recovery behavior per completed story in each supported language; do not choose a provider solely from headline token rates.
- The displayed allowance and price match server-enforced entitlements; retries, handoffs and re-downloads do not accidentally double-count a completed keepsake or purchase.

See [PRODUCT-ROADMAP.md](PRODUCT-ROADMAP.md) for code observations, provider research, and the longer build sequence.
