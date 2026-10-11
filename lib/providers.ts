import { z } from "zod";
type ModelInput = string | Array<{ type: "text"; text: string } | { type: "audio"; data: string; mime_type: string }>;
export function createProviders(env: Record<string, string | undefined>) {
function setting(key: string): string { return env[key] || ""; }
function backend(): string { return setting("GEMINI_BACKEND") || "ai-studio"; }
function modelConfigured(): boolean {
  if (backend() === "vertex") return !!setting("VERTEX_API_KEY") && !!setting("GOOGLE_CLOUD_PROJECT");
  return backend() === "ai-studio" && !!setting("GEMINI_API_KEY");
}

async function gemini(system: string, input: ModelInput, json = true): Promise<string> {
  if (backend() === "vertex") return vertex(system, input, json);
  if (backend() !== "ai-studio") throw new ServiceError("The story editor configuration needs attention. Your words are still saved.", 503);
  const key = setting("GEMINI_API_KEY");
  if (!key) throw new ServiceError("The story editor is not connected yet. Your words are still saved on this device. You can try the sample story meanwhile.", 503);
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ model: setting("GEMINI_MODEL") || "gemini-3.8-flash", system_instruction: system + (json ? " Output valid JSON without markdown fences." : ""), input, store: false }), signal: AbortSignal.timeout(55000) });
  if (!res.ok) throw providerError(res.status);
  const data = await res.json() as { output_text?: string; outputs?: { text?: string; content?: { text?: string }[] }[] };
  const output = data.output_text || data.outputs?.map(o => o.text || o.content?.map(p => p.text || "").join("") || "").join("");
  if (!output) throw new ServiceError("The editor returned no text. Please try again.");
  return output;
}
async function vertex(system: string, input: ModelInput, json: boolean): Promise<string> {
  const key = setting("VERTEX_API_KEY");
  const project = setting("GOOGLE_CLOUD_PROJECT");
  const location = setting("GOOGLE_CLOUD_LOCATION") || "global";
  const model = setting("GEMINI_MODEL") || "gemini-3.8-flash";
  if (!key || !project) throw new ServiceError("The story editor's Google Cloud connection is not ready yet. Your words are still saved on this device.", 503);
  if (!/^[a-z0-9-]+$/.test(project) || !/^[a-z0-9-]+$/.test(location) || !/^[a-zA-Z0-9._-]+$/.test(model)) throw new ServiceError("The story editor configuration needs attention. Your words are still saved.", 503);
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  const parts = typeof input === "string" ? [{ text: input }] : input.map(part => part.type === "text" ? { text: part.text } : { inlineData: { mimeType: part.mime_type, data: part.data } });
  const res = await fetch(`https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system + (json ? " Output valid JSON without markdown fences." : "") }] },
      contents: [{ role: "user", parts }],
      generationConfig: { maxOutputTokens: 8192, ...(json ? { responseMimeType: "application/json" } : {}), ...(model === "gemini-3.8-flash" ? { thinkingConfig: { thinkingLevel: "LOW" } } : {}) },
      labels: { app: "storypress" },
    }),
    signal: AbortSignal.timeout(55000),
  });
  if (!res.ok) throw providerError(res.status);
  const data = await res.json() as { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason && candidate.finishReason !== "STOP") throw new ServiceError("The story editor did not return a complete draft. Your original words are kept; please try a shorter section.");
  const output = candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text || "").join("");
  if (!output) throw new ServiceError("The editor returned no text. Please try again.");
  return output;
}
function providerError(status: number): ServiceError {
  if (status === 429) return new ServiceError("The story editor is busy. Please try again in a moment.", 429);
  if (status === 402) return new ServiceError("The story editor is waiting for its billing setup. Your words are kept; please contact the app owner.", 503);
  if (status === 401 || status === 403) return new ServiceError("The story editor's connection needs attention from the app owner. Your words are kept.", 503);
  return new ServiceError("The story editor could not complete that request. Your words are kept; please try again.", 502);
}
function parseJson<T>(text: string, schema: z.ZodType<T>): T { const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""); try { return schema.parse(JSON.parse(cleaned)); } catch { throw new ServiceError("The editor’s response could not be read. Please try again; your words have been kept."); } }
async function nimble(query: string, locale: string) {
  const key = setting("NIMBLE_API_KEY");
  if (!key) throw new ServiceError("Historical search is not connected yet. You can continue with your own memories.", 503);
  const res = await fetch("https://sdk.nimbleway.com/v2/search", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ query, locale, max_results: 6, search_depth: "standard", full_content: true, output_format: "plain_text" }), signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new ServiceError("Historical search could not finish. Please try again, or continue with your own memories.");
  const parsed = z.object({ results: z.array(z.object({ title: z.string(), url: z.string().url(), content: z.string().nullish(), description: z.string().nullish() })) }).safeParse(await res.json());
  if (!parsed.success) throw new ServiceError("Historical search returned an unexpected response. You can still continue your story.");
  return parsed.data.results.map(r => ({ ...r, content: (r.content || r.description || "").slice(0, 9000) }));
}

return { setting, backend, modelConfigured, gemini, nimble, parseJson };
}
export class ServiceError extends Error { constructor(message: string, public status = 502) { super(message); } }
