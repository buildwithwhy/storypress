// One machine-readable console line per outbound AI/Supabase call (wave 7 PR
// A), in the PR #44 {event:...} convention. PRIVACY INVARIANT: a line carries
// only task/model/backend/language/region/timing/token/status fields — never
// prompt text, story content, emails, or raw user ids — and every emitter
// here accepts only those typed fields, so user content has no path into a
// line. scripts/check-ai-timing.mjs asserts the invariant.
//
// Timings: ttft is fetch start → first byte (whole-result) or first yielded
// chunk (streams); token counts are read off the same response body, and
// unverified usage shapes are logged raw rather than guessed.

export type CallStatus = 'ok' | 'error';

export interface AiCallMeta {
  task: string;
  model: string;
  backend: string;
  language: string;
  thinking?: string | null;
  vertexLocation?: string | null;
  // Optional per-request observer (Server-Timing spans): successful calls
  // report their tokens and region so the wrapping request can surface them.
  report?: AiCallReport;
}

export interface DbCallMeta { task: string; model: string; backend: string; }

// Per-request observer signature: successful AI calls report the tokens the
// API actually returned (mapped or raw) and the region the call resolved to.
export type AiCallReport = (tokens: unknown, vertexLocation: string | null) => void;

function emitAiCall(meta: AiCallMeta, ttftMs: number | null, totalMs: number, status: CallStatus, tokens?: unknown): void {
  console.error(JSON.stringify({
    event: 'ai_call', task: meta.task, model: meta.model, backend: meta.backend, language: meta.language,
    thinking: meta.thinking ?? null, vertexLocation: meta.vertexLocation ?? null,
    ttftMs, totalMs, status, ...(tokens === undefined ? {} : { tokens }),
  }));
  // Only successful calls feed Server-Timing: spans are attached to the JSON
  // response of the request that started them, and a failed call either
  // throws past its span or is retried (fallbacks), which reports on its own.
  if (status === 'ok' && meta.report) meta.report(tokens, meta.vertexLocation ?? null);
}

function emitDbCall(meta: DbCallMeta, ttftMs: number | null, totalMs: number, status: CallStatus): void {
  console.error(JSON.stringify({ event: 'db_call', task: meta.task, model: meta.model, backend: meta.backend, ttftMs, totalMs, status }));
}

// Whole-result wrapper: run() calls firstByte() once the response headers
// arrive and setTokens() with whatever usage the same body carried. Never
// swallows: run()'s error is emitted as status "error" and rethrown.
export async function timedAiCall<T>(meta: AiCallMeta, run: (timer: { firstByte(): void; setTokens(tokens: unknown): void }) => Promise<T>): Promise<T> {
  const start = Date.now();
  let ttftMs: number | null = null, tokens: unknown, emitted = false;
  const emit = (status: CallStatus) => { if (emitted) return; emitted = true; emitAiCall(meta, ttftMs, Date.now() - start, status, tokens); };
  try {
    const result = await run({ firstByte: () => { ttftMs ??= Date.now() - start; }, setTokens: value => { if (value !== undefined) tokens = value; } });
    emit('ok');
    return result;
  } catch (error) { emit('error'); throw error; }
}

// Stream wrapper: the stream factory performs its own fetch lazily, ttft is
// the first yielded chunk, and the factory's return value (usage from the
// final event, if any) becomes the token field. An interrupted or aborted
// stream — the client superseding a send is normal operation — reports
// "error" with the ttft it reached, then rethrows nothing it did not see.
export async function* timedAiStream<T>(meta: AiCallMeta, stream: () => AsyncGenerator<string, T | undefined, unknown>, mapTokens?: (usage: T | undefined) => unknown): AsyncGenerator<string, void, unknown> {
  const start = Date.now();
  let ttftMs: number | null = null, tokens: unknown, emitted = false;
  const emit = (status: CallStatus) => { if (emitted) return; emitted = true; emitAiCall(meta, ttftMs, Date.now() - start, status, tokens); };
  const inner = stream();
  try {
    while (true) {
      const next = await inner.next();
      if (next.done) { tokens = mapTokens ? mapTokens(next.value) : next.value; break; }
      if (ttftMs === null) ttftMs = Date.now() - start;
      yield next.value;
    }
    emit('ok');
  } catch (error) { emit('error'); throw error; }
  finally { if (!emitted) emit('error'); await inner.return(undefined).catch(() => {}); }
}

// Supabase wrapper: run() calls firstByte() once the response headers arrive;
// the total includes the body read (PostgREST timing is body-inclusive).
export async function timedDbCall<T>(meta: DbCallMeta, run: (firstByte: () => void) => Promise<T>): Promise<T> {
  const start = Date.now();
  let ttftMs: number | null = null, emitted = false;
  const emit = (status: CallStatus) => { if (emitted) return; emitted = true; emitDbCall(meta, ttftMs, Date.now() - start, status); };
  try {
    const result = await run(() => { ttftMs ??= Date.now() - start; });
    emit('ok');
    return result;
  } catch (error) { emit('error'); throw error; }
}

const count = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

// GenerateContent usageMetadata (Vertex whole-result bodies and the final SSE
// event): map the three fields the baseline needs, pass anything else raw.
export function tokensFromGenerateContent(usage: unknown): unknown {
  if (!usage || typeof usage !== 'object') return undefined;
  const u = usage as Record<string, unknown>;
  const input = count(u.promptTokenCount), output = count(u.candidatesTokenCount), thinking = count(u.thoughtsTokenCount);
  if (input === undefined && output === undefined && thinking === undefined) return { raw: usage };
  return { ...(input === undefined ? {} : { input }), ...(output === undefined ? {} : { output }), ...(thinking === undefined ? {} : { thinking }) };
}

// Chat-completions usage (OpenRouter whole-result).
export function tokensFromOpenAi(usage: unknown): unknown {
  if (!usage || typeof usage !== 'object') return undefined;
  const u = usage as Record<string, unknown>;
  const details = u.completion_tokens_details;
  const input = count(u.prompt_tokens), output = count(u.completion_tokens);
  const thinking = count(details && typeof details === 'object' ? (details as Record<string, unknown>).reasoning_tokens : undefined);
  if (input === undefined && output === undefined) return { raw: usage };
  return { ...(input === undefined ? {} : { input }), ...(output === undefined ? {} : { output }), ...(thinking === undefined ? {} : { thinking }) };
}

// Usage shapes with unverified field names (AI-Studio /interactions body,
// OpenRouter streamed usage): log the raw object once rather than guessing.
export function rawTokens(usage: unknown): unknown {
  return usage === undefined || usage === null ? undefined : { raw: usage };
}
