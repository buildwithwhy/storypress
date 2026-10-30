import { z } from "zod";
import {eventData} from './event-stream';
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
  gemini(system: string, input: ModelInput, json?: boolean, model?: string): Promise<string>;
  nimble(query: string, locale: string): Promise<ResearchResult[]>;
  parseJson<T>(text: string, schema: z.ZodType<T>): T;
  interviewStream(system: string, input: string, model: string, signal: AbortSignal): AsyncGenerator<string, void, unknown>;
}
const DEFAULT_MODEL = "gemini-3.8-flash";
const taskModelSettings: Record<ModelTask, string> = {
  interview: "GEMINI_INTERVIEW_MODEL",
  write: "GEMINI_WRITING_MODEL",
  photo: "GEMINI_PHOTO_MODEL",
  transcribe: "GEMINI_TRANSCRIPTION_MODEL",
  research: "GEMINI_RESEARCH_MODEL",
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
async function openAiCompletion(route: OpenAICompatibleTextRoute, key: string, body: string): Promise<string> {
  if (!key) throw new ServiceError("The story editor is not connected yet. Your words are still saved on this device. You can try the sample story meanwhile.", 503);
  const res = await fetch(`${route.baseUrl}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body, signal: AbortSignal.timeout(55000) });
  if (!res.ok) throw providerError(res.status);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const output = data.choices?.[0]?.message?.content;
  if (!output) throw new ServiceError("The editor returned no text. Please try again.");
  return output;
}
async function* openAiStream(route: OpenAICompatibleTextRoute, key: string, body: string, signal: AbortSignal): AsyncGenerator<string, void, unknown> {
  if (!key) throw new ServiceError("The story editor is not connected yet. Your words are still saved on this device. You can try the sample story meanwhile.", 503);
  const res = await fetch(`${route.baseUrl}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body, signal: AbortSignal.any([signal, AbortSignal.timeout(55000)]) });
  if (!res.ok) throw providerError(res.status);
  if (!res.body) throw new ServiceError("The interview returned no reply. Your words are kept.", 502);
  let finished = false;
  for await (const raw of eventData(res.body)) {
    if (raw === "[DONE]") { finished = true; continue; }
    const data = JSON.parse(raw) as { error?: unknown; choices?: Array<{ delta?: { content?: string } }> };
    if (data.error) throw new ServiceError("The interview could not finish. Your words are kept.", 502);
    const delta = data.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta) yield delta;
  }
  if (!finished) throw new ServiceError("The reply was interrupted. Your words are kept; try again.", 502);
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
function openAiCompatibleProvider(route: OpenAICompatibleTextRoute, gemini: TextProvider): TextProvider {
  const key = () => gemini.setting(route.apiKeyEnv);
  const retryOnGemini = async <T>(routed: () => Promise<T>, fallback: () => Promise<T>): Promise<T> => {
    try {
      return await routed();
    } catch (error) {
      console.error(`[language-routing] ${route.model} via ${route.baseUrl} failed; falling back to Gemini`, error instanceof Error ? error.message : error);
      return fallback();
    }
  };
  return {
    setting: gemini.setting,
    backend: () => route.provider,
    modelConfigured: () => !!key(),
    // The route owns the model for every task; call sites pass modelFor()
    // output back in, and the Gemini fallback keeps the original task model.
    modelFor: () => validateRoutedModel(route.model),
    gemini: (system, input, json, model) => retryOnGemini(() => openAiCompletion(route, key(), openAiBody(route, system, input, json ?? true, false)), () => gemini.gemini(system, input, json, model)),
    nimble: gemini.nimble,
    parseJson: gemini.parseJson,
    interviewStream: (system, input, _model, signal) => streamWithFallback(openAiStream(route, key(), openAiBody(route, system, input, true, true), signal), () => gemini.interviewStream(system, input, gemini.modelFor('interview'), signal)),
  };
}
export function createProviders(env: Record<string, string | undefined>, language: Language = "en"): TextProvider {
function setting(key: string): string { return env[key] || ""; }
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

async function gemini(system: string, input: ModelInput, json = true, model?: string): Promise<string> {
  const selectedModel = validateModel(model ?? (setting("GEMINI_MODEL") || DEFAULT_MODEL));
  if (backend() === "vertex") return vertex(system, input, json, selectedModel);
  if (backend() !== "ai-studio") throw new ServiceError("The story editor configuration needs attention. Your words are still saved.", 503);
  const key = setting("GEMINI_API_KEY");
  if (!key) throw new ServiceError("The story editor is not connected yet. Your words are still saved on this device. You can try the sample story meanwhile.", 503);
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ model: selectedModel, system_instruction: system + (json ? " Output valid JSON without markdown fences." : ""), input, store: false }), signal: AbortSignal.timeout(55000) });
  if (!res.ok) throw providerError(res.status);
  const data = await res.json() as { output_text?: string; outputs?: { text?: string; content?: { text?: string }[] }[] };
  const output = data.output_text || data.outputs?.map(o => o.text || o.content?.map(p => p.text || "").join("") || "").join("");
  if (!output) throw new ServiceError("The editor returned no text. Please try again.");
  return output;
}
function generateContentsBody(system: string, input: ModelInput, json: boolean, model: string) {
  const parts = typeof input === "string" ? [{ text: input }] : input.map(part => part.type === "text" ? { text: part.text } : { inlineData: { mimeType: part.mime_type, data: part.data } });
  return {
    systemInstruction: { parts: [{ text: system + (json ? " Output valid JSON without markdown fences." : "") }] },
    contents: [{ role: "user", parts }],
    generationConfig: { maxOutputTokens: 8192, ...(json ? { responseMimeType: "application/json" } : {}), ...(model === DEFAULT_MODEL ? { thinkingConfig: { thinkingLevel: "LOW" } } : {}) },
    labels: { app: "storypress" },
  };
}
async function vertexRequest(system: string, input: ModelInput, json: boolean, model: string,stream=false,signal?:AbortSignal): Promise<Response> {
  const key = setting("VERTEX_API_KEY");
  const project = setting("GOOGLE_CLOUD_PROJECT");
  const location = setting("GOOGLE_CLOUD_LOCATION") || "global";
  if (!key || !project) throw new ServiceError("The story editor's Google Cloud connection is not ready yet. Your words are still saved on this device.", 503);
  if (!/^[a-z0-9-]+$/.test(project) || !/^[a-z0-9-]+$/.test(location)) throw new ServiceError("The story editor configuration needs attention. Your words are still saved.", 503);
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  const res = await fetch(`https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:${stream?'streamGenerateContent?alt=sse':'generateContent'}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(generateContentsBody(system, input, json, model)),
    signal: signal?AbortSignal.any([signal,AbortSignal.timeout(55000)]):AbortSignal.timeout(55000),
  });
  if (!res.ok) throw providerError(res.status);
  return res;
}
async function vertex(system: string, input: ModelInput, json: boolean, model: string): Promise<string> {
  const res=await vertexRequest(system,input,json,model);
  const data = await res.json() as { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason && candidate.finishReason !== "STOP") throw new ServiceError("The story editor did not return a complete draft. Your original words are kept; please try a shorter section.");
  const output = candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text || "").join("");
  if (!output) throw new ServiceError("The editor returned no text. Please try again.");
  return output;
}
// Both Google backends stream the same GenerateContent SSE shape; other
// configured backends keep their normal whole-result contract.
async function* streamResult(res: Response) {
  if (!res.body) throw new ServiceError('The interview returned no reply. Your words are kept.', 502);
  let finished = false;
  for await (const raw of eventData(res.body)) {
    if (raw === '[DONE]') continue;
    const data = JSON.parse(raw); if (data.error) throw new ServiceError('The interview could not finish. Your words are kept.', 502);
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason) { if (candidate.finishReason !== 'STOP') throw new ServiceError('The reply did not finish. Your words are kept; try again.', 502); finished = true; }
    for (const part of candidate?.content?.parts || []) if (typeof part.text === 'string' && !part.thought) yield part.text;
  }
  if (!finished) throw new ServiceError('The reply was interrupted. Your words are kept; try again.', 502);
}
async function* interviewStream(system:string,input:string,model:string,signal:AbortSignal){
 validateModel(model);
 if(backend()==='ai-studio'){
  const key=setting('GEMINI_API_KEY');
  if(!key)throw new ServiceError("The story editor is not connected yet. Your words are still saved on this device. You can try the sample story meanwhile.",503);
  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(generateContentsBody(system,input,true,model)),signal:AbortSignal.any([signal,AbortSignal.timeout(55000)])});
  if(!res.ok)throw providerError(res.status);
  yield* streamResult(res);return;
 }
 // The existing Google Cloud route streams; other configured backends retain
 // their normal request contract without switching credentials or providers.
 if(backend()!=='vertex'){yield await gemini(system,input,true,model);return;}
 const res=await vertexRequest(system,input,true,model,true,signal);
 yield* streamResult(res);
}
function parseJson<T>(text: string, schema: z.ZodType<T>): T { const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""); try { return schema.parse(JSON.parse(cleaned)); } catch { throw new ServiceError("The editor’s response could not be read. Please try again; your words have been kept."); } }
async function nimble(query: string, locale: string): Promise<ResearchResult[]> {
  const key = setting("NIMBLE_API_KEY");
  if (!key) throw new ServiceError("Historical search is not connected yet. You can continue with your own memories.", 503);
  const res = await fetch("https://sdk.nimbleway.com/v2/search", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ query, locale, max_results: 6, search_depth: "standard", full_content: true, output_format: "plain_text" }), signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new ServiceError("Historical search could not finish. Please try again, or continue with your own memories.");
  const parsed = z.object({ results: z.array(z.object({ title: z.string(), url: z.string().url(), content: z.string().nullish(), description: z.string().nullish() })) }).safeParse(await res.json());
  if (!parsed.success) throw new ServiceError("Historical search returned an unexpected response. You can still continue your story.");
  return parsed.data.results.map(r => ({ ...r, content: (r.content || r.description || "").slice(0, 9000) }));
}

const geminiProvider: TextProvider = { setting, backend, modelConfigured, modelFor, gemini, nimble, parseJson, interviewStream };
const route = textRoute(env, language);
return route.provider === "gemini" ? geminiProvider : openAiCompatibleProvider(route, geminiProvider);
}
export class ServiceError extends Error { constructor(message: string, public status = 502, public code?:string) { super(message); } }
