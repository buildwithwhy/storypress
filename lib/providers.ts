import { z } from "zod";
import {eventData} from './event-stream';
import {timedAiCall, timedAiStream, tokensFromGenerateContent, tokensFromOpenAi, rawTokens, type AiCallMeta, type AiCallReport} from './call-log';
import type { Language } from './story';
export type ModelInput = string | Array<{ type: "text"; text: string } | { type: "audio" | "image"; data: string; mime_type: string }>;
export type ModelTask = "interview" | "write" | "photo" | "transcribe" | "research";
export interface ResearchResult { title: string; url: string; content: string; description?: string | null; }

// The text seam: every AI text, research, and JSON-parse call resolves through
// this interface. Gemini (AI Studio or Vertex backend) is the only
// implementation today; a future provider implements the same members and no
// call site changes. Kept intentionally synchronous-shaped: the server awaits
// one result per call, streaming arrives via interviewStream.
export interface TextProvider {
  setting(key: string): string;
  backend(): string;
  modelConfigured(): boolean;
  modelFor(task: ModelTask): string;
  gemini(system: string, input: ModelInput, json?: boolean, model?: string, task?: string): Promise<string>;
  nimble(query: string, locale: string): Promise<ResearchResult[]>;
  parseJson<T>(text: string, schema: z.ZodType<T>): T;
  interviewStream(system: string, input: string, model: string, signal: AbortSignal, task?: string): AsyncGenerator<string, void, unknown>;
}
const DEFAULT_MODEL = "gemini-3.8-flash";
// Thinking levels, resolved per task like taskModelSettings below. Without a
// task setting, today's floor holds: the default model ships thinkingLevel LOW
// on every path that carries thinking — GenerateContent whole-result, both
// streams, and now the AI-Studio interactions body, which previously sent
// none — while non-default models send none. An explicit setting reaches
// EVERY body builder and survives model overrides, which previously dropped
// thinking config entirely. Request bodies and timing lines both derive from
// this function, so a line can never report a setting the request does not
// carry.
const THINKING_LEVELS = ["MINIMAL", "LOW", "MEDIUM", "HIGH"] as const;
type ThinkingLevel = (typeof THINKING_LEVELS)[number];
function thinkingFor(env: Record<string, string | undefined>, task: string | undefined, model: string): ThinkingLevel | null {
  const key = task && task in taskThinkingSettings ? taskThinkingSettings[task as ModelTask] : "";
  const override = ((key ? env[key] : "") || "").trim().toUpperCase();
  if (override) {
    if (!(THINKING_LEVELS as readonly string[]).includes(override)) throw new ServiceError("The story editor configuration needs attention. Your words are still saved.", 503);
    return override as ThinkingLevel;
  }
  return model === DEFAULT_MODEL ? "LOW" : null;
}
const taskModelSettings: Record<ModelTask, string> = {
  interview: "GEMINI_INTERVIEW_MODEL",
  write: "GEMINI_WRITING_MODEL",
  photo: "GEMINI_PHOTO_MODEL",
  transcribe: "GEMINI_TRANSCRIPTION_MODEL",
  research: "GEMINI_RESEARCH_MODEL",
};
const taskThinkingSettings: Record<ModelTask, string> = {
  interview: "GEMINI_INTERVIEW_THINKING",
  write: "GEMINI_WRITING_THINKING",
  photo: "GEMINI_PHOTO_THINKING",
  transcribe: "GEMINI_TRANSCRIPTION_THINKING",
  research: "GEMINI_RESEARCH_THINKING",
};
// Language routing: story text follows the narrator's chosen language. The
// route table is env-driven like taskModelSettings, and an unconfigured route
// degrades to Gemini — today's behavior is the floor, never a regression.
export interface OpenAICompatibleTextRoute { provider: "openai-compatible"; baseUrl: string; apiKeyEnv: string; model: string; }
export type TextRoute = { provider: "gemini" } | OpenAICompatibleTextRoute;
const ZH_TEXT_BASE_URL = "https://openrouter.ai/api/v1";
const ZH_TEXT_DEFAULT_MODEL = "qwen/qwen3.8-flash";
export function textRoute(env: Record<string, string | undefined>, language: Language): TextRoute {
  if (language !== "zh" || !env.OPENROUTER_API_KEY) return { provider: "gemini" };
  return { provider: "openai-compatible", baseUrl: ZH_TEXT_BASE_URL, apiKeyEnv: "OPENROUTER_API_KEY", model: env.STORYPRESS_ZH_TEXT_MODEL || ZH_TEXT_DEFAULT_MODEL };
}
// Language-route visibility: the services payload reports the provider and
// model each language resolves to and whether that provider is ready, so the
// setup surface and checks can see routing without touching secrets. Gemini
// languages report the task-independent base model; per-task overrides remain
// in the payload's models field. "Configured" asks the provider the request
// path would construct, so the two can never disagree.
export const languageRouteInfoSchema = z.object({
  provider: z.enum(["gemini", "openai-compatible"]),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1),
  configured: z.boolean(),
});
export type LanguageRouteInfo = z.infer<typeof languageRouteInfoSchema>;
export const languageRoutesSchema = z.object({ en: languageRouteInfoSchema, zh: languageRouteInfoSchema, es: languageRouteInfoSchema });
export function languageRoutes(env: Record<string, string | undefined>): Record<Language, LanguageRouteInfo> {
  const info = (language: Language): LanguageRouteInfo => {
    const route = textRoute(env, language);
    return {
      provider: route.provider,
      ...(route.provider === "openai-compatible" ? { baseUrl: route.baseUrl } : {}),
      model: route.provider === "openai-compatible" ? route.model : env.GEMINI_MODEL || DEFAULT_MODEL,
      configured: createProviders(env, language).modelConfigured(),
    };
  };
  // Literal keys so a Language added to lib/story.ts fails compilation here
  // until this payload — and the schema above — learn about it.
  return { en: info("en"), zh: info("zh"), es: info("es") };
}

// Hidden video capability: the services payload reports the env-gated flag so
// deployments show nothing until STORYPRESS_VIDEO is turned on — enabling is
// an env change, never a code change. Render compatibility itself is a browser
// property probed at render time, the same split as liveVoice: the server
// answers availability, the browser answers capability.
export const videoFlagSchema = z.object({ enabled: z.boolean() });
export type VideoFlag = z.infer<typeof videoFlagSchema>;
export function videoFlag(env: Record<string, string | undefined>): VideoFlag {
  return { enabled: env.STORYPRESS_VIDEO === "true" };
}
function providerError(status: number): ServiceError {
  if (status === 429) return new ServiceError("The story editor is busy. Please try again in a moment.", 429);
  if (status === 402) return new ServiceError("The story editor is waiting for its billing setup. Your words are kept; please contact the app owner.", 503);
  if (status === 401 || status === 403) return new ServiceError("The story editor's connection needs attention from the app owner. Your words are kept.", 503);
  return new ServiceError("The story editor could not complete that request. Your words are kept; please try again.", 502);
}

// The OpenAI-compatible adapter speaks the /chat/completions contract shared
// by OpenRouter and DashScope, so moving zh between them later is an env
// change, not code. The route owns the model for every task; per-task model
// settings keep shaping the Gemini route. Unlike a Gemini model id, a routed
// id may carry a publisher prefix ("qwen/qwen3.8-flash") and travels in the
// request body rather than a URL, so validation allows slashes.
function validateRoutedModel(model: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(model)) throw new ServiceError("The story editor configuration needs attention. Your words are still saved.", 503);
  return model;
}
type OpenAIPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
function openAiContent(input: ModelInput): string | OpenAIPart[] {
  if (typeof input === "string") return input;
  return input.map(part => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (part.type === "image") return { type: "image_url", image_url: { url: `data:${part.mime_type};base64,${part.data}` } };
    // Audio never routes here (transcription stays on Gemini by spec); the
    // fallback wrapper turns this into the Gemini call that serves it.
    throw new Error("The routed text provider cannot serve audio input");
  });
}
function openAiBody(route: OpenAICompatibleTextRoute, system: string, input: ModelInput, json: boolean, stream: boolean): string {
  return JSON.stringify({
    model: validateRoutedModel(route.model),
    messages: [
      { role: "system", content: system + (json ? " Output valid JSON without markdown fences." : "") },
      { role: "user", content: openAiContent(input) },
    ],
    // response_format plus the prompt instruction: providers that ignore
    // response_format still get prompt-only JSON, and parseJson re-validates.
    ...(json ? { response_format: { type: "json_object" } } : {}),
    ...(stream ? { stream: true } : {}),
  });
}
async function openAiCompletion(route: OpenAICompatibleTextRoute, key: string, body: string, meta: AiCallMeta): Promise<string> {
  if (!key) throw new ServiceError("The story editor is not connected yet. Your words are still saved on this device. You can try the sample story meanwhile.", 503);
  return timedAiCall(meta, async timer => {
    const res = await fetch(`${route.baseUrl}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body, signal: AbortSignal.timeout(55000) });
    timer.firstByte();
    if (!res.ok) throw providerError(res.status);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: unknown };
    timer.setTokens(tokensFromOpenAi(data.usage));
    const output = data.choices?.[0]?.message?.content;
    if (!output) throw new ServiceError("The editor returned no text. Please try again.");
    return output;
  });
}
async function* openAiStream(route: OpenAICompatibleTextRoute, key: string, body: string, signal: AbortSignal): AsyncGenerator<string, unknown, unknown> {
  if (!key) throw new ServiceError("The story editor is not connected yet. Your words are still saved on this device. You can try the sample story meanwhile.", 503);
  const res = await fetch(`${route.baseUrl}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body, signal: AbortSignal.any([signal, AbortSignal.timeout(55000)]) });
  if (!res.ok) throw providerError(res.status);
  if (!res.body) throw new ServiceError("The interview returned no reply. Your words are kept.", 502);
  let finished = false, usage: unknown;
  for await (const raw of eventData(res.body)) {
    if (raw === "[DONE]") { finished = true; continue; }
    const data = JSON.parse(raw) as { error?: unknown; usage?: unknown; choices?: Array<{ delta?: { content?: string } }> };
    if (data.error) throw new ServiceError("The interview could not finish. Your words are kept.", 502);
    // Streamed usage rides the final event on providers that send it; the
    // shape is unverified, so the timing wrapper logs it raw.
    if (data.usage) usage = data.usage;
    const delta = data.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta) yield delta;
  }
  if (!finished) throw new ServiceError("The reply was interrupted. Your words are kept; try again.", 502);
  return usage;
}
// A routed stream that fails before its first chunk retries on Gemini; once a
// chunk has reached the client, failing over would replay and duplicate text.
async function* streamWithFallback(routed: AsyncGenerator<string, void, unknown>, fallback: () => AsyncGenerator<string, void, unknown>): AsyncGenerator<string, void, unknown> {
  const iterator = routed[Symbol.asyncIterator]();
  try {
    let first: IteratorResult<string, void>;
    try {
      first = await iterator.next();
    } catch (error) {
      console.error("[language-routing] routed stream failed before the first chunk; falling back to Gemini", error instanceof Error ? error.message : error);
      yield* fallback();
      return;
    }
    if (first.done) return;
    yield first.value;
    while (true) {
      const next = await iterator.next();
      if (next.done) return;
      yield next.value;
    }
  } finally {
    await iterator.return();
  }
}
function openAiCompatibleProvider(route: OpenAICompatibleTextRoute, gemini: TextProvider, language: Language, onAiCall?: AiCallReport): TextProvider {
  const key = () => gemini.setting(route.apiKeyEnv);
  const retryOnGemini = async <T>(routed: () => Promise<T>, fallback: () => Promise<T>): Promise<T> => {
    try {
      return await routed();
    } catch (error) {
      console.error(`[language-routing] ${route.model} via ${route.baseUrl} failed; falling back to Gemini`, error instanceof Error ? error.message : error);
      return fallback();
    }
  };
  // The routed call is timed here; Gemini fallback calls time themselves, so
  // one fallback shows as an error line plus the retry line that served it.
  const routeMeta = (task?: string): AiCallMeta => ({ task: task ?? route.model, model: route.model, backend: route.provider, language, ...(onAiCall ? { report: onAiCall } : {}) });
  return {
    setting: gemini.setting,
    backend: () => route.provider,
    modelConfigured: () => !!key(),
    // The route owns the model for every task; call sites pass modelFor()
    // output back in, and the Gemini fallback keeps the original task model.
    modelFor: () => validateRoutedModel(route.model),
    gemini: (system, input, json, model, task) => retryOnGemini(() => openAiCompletion(route, key(), openAiBody(route, system, input, json ?? true, false), routeMeta(task)), () => gemini.gemini(system, input, json, model, task)),
    nimble: gemini.nimble,
    parseJson: gemini.parseJson,
    interviewStream: (system, input, _model, signal, task) => streamWithFallback(timedAiStream(routeMeta(task), () => openAiStream(route, key(), openAiBody(route, system, input, true, true), signal), rawTokens),
     // Reliability outranks latency on an already-failed route: backends that
     // do not stream fall back to the proven whole-result call, while Vertex
     // keeps its streaming fallback.
     gemini.backend() === 'vertex'
      ? () => gemini.interviewStream(system, input, gemini.modelFor('interview'), signal, task)
      : async function*(){ yield await gemini.gemini(system, input, true, gemini.modelFor('interview'), task); }),
  };
}
export function createProviders(env: Record<string, string | undefined>, language: Language = "en", onAiCall?: AiCallReport): TextProvider {
function setting(key: string): string { return env[key] || ""; }
// Every timing line's fixed context: the language this provider was built
// for, the Google Cloud region Vertex requests resolve to, and nothing else.
function aiMeta(task: string, model: string, backend: string, thinking: string | null, location: string | null): AiCallMeta {
  return { task, model, backend, language, thinking, vertexLocation: location, ...(onAiCall ? { report: onAiCall } : {}) };
}
function vertexLocation(): string { return setting("GOOGLE_CLOUD_LOCATION") || "global"; }
function backend(): string { return setting("GEMINI_BACKEND") || "ai-studio"; }
function validateModel(model: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) throw new ServiceError("The story editor configuration needs attention. Your words are still saved.", 503);
  return model;
}
function modelFor(task: ModelTask): string {
  return validateModel(setting(taskModelSettings[task]) || setting("GEMINI_MODEL") || DEFAULT_MODEL);
}
function modelConfigured(): boolean {
  if (backend() === "vertex") return !!setting("VERTEX_API_KEY") && !!setting("GOOGLE_CLOUD_PROJECT");
  return backend() === "ai-studio" && !!setting("GEMINI_API_KEY");
}

// The AI-Studio /interactions whole-result shape: either a flat output_text
// or per-output text parts. Shared by the non-streaming call and the
// streaming fallback below.
function interactionText(data: { output_text?: string; outputs?: { text?: string; content?: { text?: string }[] }[] }): string | undefined {
  return data.output_text || data.outputs?.map(o => o.text || o.content?.map(p => p.text || "").join("") || "").join("");
}
async function gemini(system: string, input: ModelInput, json = true, model?: string, task?: string): Promise<string> {
  const selectedModel = validateModel(model ?? (setting("GEMINI_MODEL") || DEFAULT_MODEL));
  if (backend() === "vertex") return vertex(system, input, json, selectedModel, task);
  if (backend() !== "ai-studio") throw new ServiceError("The story editor configuration needs attention. Your words are still saved.", 503);
  const key = setting("GEMINI_API_KEY");
  if (!key) throw new ServiceError("The story editor is not connected yet. Your words are still saved on this device. You can try the sample story meanwhile.", 503);
  // The interactions body carries the resolved level — default LOW for the
  // default model, or the per-task override — closing the asymmetry where it
  // silently sent none.
  const thinking = thinkingFor(env, task, selectedModel);
  return timedAiCall(aiMeta(task ?? selectedModel, selectedModel, "ai-studio", thinking, null), async timer => {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ model: selectedModel, system_instruction: system + (json ? " Output valid JSON without markdown fences." : ""), input, store: false, ...(thinking ? { generation_config: { thinking_level: thinking.toLowerCase() } } : {}) }), signal: AbortSignal.timeout(55000) });
    timer.firstByte();
    if (!res.ok) throw providerError(res.status);
    const data = await res.json() as { output_text?: string; outputs?: { text?: string; content?: { text?: string }[] }[]; usage?: unknown };
    // Usage field names on this body are unverified; logged raw, never guessed.
    timer.setTokens(rawTokens(data.usage));
    const output = interactionText(data);
    if (!output) throw new ServiceError("The editor returned no text. Please try again.");
    return output;
  });
}
function generateContentsBody(system: string, input: ModelInput, json: boolean, model: string, task?: string) {
  const parts = typeof input === "string" ? [{ text: input }] : input.map(part => part.type === "text" ? { text: part.text } : { inlineData: { mimeType: part.mime_type, data: part.data } });
  const thinking = thinkingFor(env, task, model);
  return {
    systemInstruction: { parts: [{ text: system + (json ? " Output valid JSON without markdown fences." : "") }] },
    contents: [{ role: "user", parts }],
    generationConfig: { maxOutputTokens: 8192, ...(json ? { responseMimeType: "application/json" } : {}), ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}) },
    labels: { app: "storypress" },
  };
}
async function vertexRequest(system: string, input: ModelInput, json: boolean, model: string, task?: string, stream=false,signal?:AbortSignal): Promise<Response> {
  const key = setting("VERTEX_API_KEY");
  const project = setting("GOOGLE_CLOUD_PROJECT");
  const location = vertexLocation();
  if (!key || !project) throw new ServiceError("The story editor's Google Cloud connection is not ready yet. Your words are still saved on this device.", 503);
  if (!/^[a-z0-9-]+$/.test(project) || !/^[a-z0-9-]+$/.test(location)) throw new ServiceError("The story editor configuration needs attention. Your words are still saved.", 503);
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  const res = await fetch(`https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:${stream?'streamGenerateContent?alt=sse':'generateContent'}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(generateContentsBody(system, input, json, model, task)),
    signal: signal?AbortSignal.any([signal,AbortSignal.timeout(55000)]):AbortSignal.timeout(55000),
  });
  if (!res.ok) throw providerError(res.status);
  return res;
}
async function vertex(system: string, input: ModelInput, json: boolean, model: string, task?: string): Promise<string> {
  return timedAiCall(aiMeta(task ?? model, model, "vertex", thinkingFor(env, task, model), vertexLocation()), async timer => {
    const res=await vertexRequest(system,input,json,model,task);
    timer.firstByte();
    const data = await res.json() as { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>; usageMetadata?: unknown };
    timer.setTokens(tokensFromGenerateContent(data.usageMetadata));
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== "STOP") throw new ServiceError("The story editor did not return a complete draft. Your original words are kept; please try a shorter section.");
    const output = candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text || "").join("");
    if (!output) throw new ServiceError("The editor returned no text. Please try again.");
    return output;
  });
}
// Both Google backends stream the same GenerateContent SSE shape; other
// configured backends keep their normal whole-result contract.
// Returns the stream's usageMetadata (carried by the final event) so the
// timing wrapper can report tokens; consumers that ignore it are unaffected.
async function* streamResult(res: Response): AsyncGenerator<string, unknown, void> {
  if (!res.body) throw new ServiceError('The interview returned no reply. Your words are kept.', 502);
  let finished = false, usage: unknown;
  for await (const raw of eventData(res.body)) {
    if (raw === '[DONE]') continue;
    const data = JSON.parse(raw); if (data.error) throw new ServiceError('The interview could not finish. Your words are kept.', 502);
    if (data.usageMetadata) usage = data.usageMetadata;
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason) { if (candidate.finishReason !== 'STOP') throw new ServiceError('The reply did not finish. Your words are kept; try again.', 502); finished = true; }
    for (const part of candidate?.content?.parts || []) if (typeof part.text === 'string' && !part.thought) yield part.text;
  }
  if (!finished) throw new ServiceError('The reply was interrupted. Your words are kept; try again.', 502);
  return usage;
}
async function* interviewStream(system:string,input:string,model:string,signal:AbortSignal,task?:string){
 validateModel(model);
 if(backend()==='ai-studio'){
  const key=setting('GEMINI_API_KEY');
  if(!key)throw new ServiceError("The story editor is not connected yet. Your words are still saved on this device. You can try the sample story meanwhile.",503);
  yield* timedAiStream(aiMeta(task ?? model, model, 'ai-studio', thinkingFor(env, task, model), null), async function*(){
   const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(generateContentsBody(system,input,true,model,task)),signal:AbortSignal.any([signal,AbortSignal.timeout(55000)])});
   if(!res.ok)throw providerError(res.status);
   return yield* streamResult(res);
  },tokensFromGenerateContent);
  return;
 }
 // The existing Google Cloud route streams; other configured backends retain
 // their normal request contract without switching credentials or providers.
 if(backend()!=='vertex'){yield await gemini(system,input,true,model,task);return;}
 yield* timedAiStream(aiMeta(task ?? model, model, 'vertex', thinkingFor(env, task, model), vertexLocation()), async function*(){
  const res=await vertexRequest(system,input,true,model,task,true,signal);
  return yield* streamResult(res);
 },tokensFromGenerateContent);
}
function parseJson<T>(text: string, schema: z.ZodType<T>): T { const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""); try { return schema.parse(JSON.parse(cleaned)); } catch { throw new ServiceError("The editor’s response could not be read. Please try again; your words have been kept."); } }
// Interim guard: a hung Nimble call must not dominate a discover action
// (production baseline ~19s total, nimble span ~11.5s). 15s bounds the full
// action well under ~25s worst case while staying above the healthy baseline.
const NIMBLE_TIMEOUT_MS = 15000;
// Mirrors the plan schema's max(260) so the provider seam stays safe even if a
// caller bypasses the schema.
const NIMBLE_MAX_QUERY_CHARS = 260;
async function nimble(query: string, locale: string): Promise<ResearchResult[]> {
  const key = setting("NIMBLE_API_KEY");
  if (!key) throw new ServiceError("Historical search is not connected yet. You can continue with your own memories.", 503);
  const boundedQuery = query.slice(0, NIMBLE_MAX_QUERY_CHARS);
  return timedAiCall(aiMeta("nimble", "web-search", "nimble", null, null), async timer => {
    const res = await fetch("https://sdk.nimbleway.com/v2/search", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: boundedQuery, locale, max_results: 6, search_depth: "standard", full_content: true, output_format: "plain_text" }), signal: AbortSignal.timeout(NIMBLE_TIMEOUT_MS) });
    timer.firstByte();
    if (!res.ok) throw new ServiceError("Historical search could not finish. Please try again, or continue with your own memories.");
    const parsed = z.object({ results: z.array(z.object({ title: z.string(), url: z.string().url(), content: z.string().nullish(), description: z.string().nullish() })) }).safeParse(await res.json());
    if (!parsed.success) throw new ServiceError("Historical search returned an unexpected response. You can still continue your story.");
    return parsed.data.results.map(r => ({ ...r, content: (r.content || r.description || "").slice(0, 9000) }));
  });
}

const geminiProvider: TextProvider = { setting, backend, modelConfigured, modelFor, gemini, nimble, parseJson, interviewStream };
const route = textRoute(env, language);
return route.provider === "gemini" ? geminiProvider : openAiCompatibleProvider(route, geminiProvider, language, onAiCall);
}
export class ServiceError extends Error { constructor(message: string, public status = 502, public code?:string) { super(message); } }
