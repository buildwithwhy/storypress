import { z } from "zod";
export const languageSchema = z.enum(["en", "zh", "es"]);
export type Language = z.infer<typeof languageSchema>;
export const turnAuthorSchema = z.object({ label: z.string().min(1).max(80), userId: z.string().uuid().optional() });
export const turnSchema = z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(12000), author: turnAuthorSchema.optional() });
export const sourceSchema = z.object({ id: z.string(), title: z.string().max(400), url: z.string().url(), publisher: z.string().max(200), description: z.string().max(1600), connection: z.string().max(600), question: z.string().max(400), date: z.string().max(120), selected: z.boolean().default(false), reaction: z.enum(["familiar", "unsure", "unfamiliar"]).optional() });
export const paperSchema = z.object({ headline: z.string().min(1).max(160), standfirst: z.string().max(600), paragraphs: z.array(z.string().max(2400)).min(1).max(12), quote: z.string().max(400).default("") });
export const photoAnalysisSchema = z.object({ visibleDetails: z.array(z.string().min(1).max(300)).max(4), possibleContext: z.array(z.string().min(1).max(300)).max(2), question: z.string().min(1).max(600), searchQueries: z.array(z.string().min(1).max(220)).max(3) });
export type PhotoAnalysis = z.infer<typeof photoAnalysisSchema>;
export const researchSuggestionSchema = z.object({query:z.string().trim().min(1).max(220),reason:z.string().trim().min(1).max(200)});
export const generatedArtSchema=z.object({data:z.string().max(300000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/),style:z.enum(['illustration','comic']),model:z.string().max(128),sourceKey:z.string().max(64)});
const baseStorySchema = z.object({ name: z.string().max(80), recordingCollectionId:z.string().uuid().optional(), presentation: z.object({version:z.literal(1),format:z.enum(["newspaper","booklet","letter"])}).optional(), intention: z.object({kind:z.enum(["memory","message"]),recipient:z.string().max(80).optional()}).optional(), draft: z.string().max(12000).optional(), language: languageSchema, paperLanguage: languageSchema.optional(), translation: z.object({sourceLanguage:languageSchema}).optional(), occasion: z.enum(["life", "wedding", "graduation"]), turns: z.array(turnSchema).max(60), sources: z.array(sourceSchema).max(8), photo: z.string().max(1800000).optional(), photoCaption: z.string().max(400).optional(), photoAnalysis: photoAnalysisSchema.optional(), researchSuggestion: researchSuggestionSchema.nullable().optional(), researchQueries: z.array(z.string().max(220)).max(60).optional(), artInstructions:z.string().max(600).optional(), generatedArt: generatedArtSchema.optional(), artwork: z.enum(["memories","together","journey","none","generated"]).optional(), paper: paperSchema.optional(), sample: z.boolean().default(false), approved: z.boolean().default(false) });
// Additive share/contribution fields: legacy stories without them still parse unchanged.
// transcriptTranslations mirrors the approved-keepsake translation pipeline for interview turns;
// editions bundles approved keepsake snapshots (validated against the base schema, so bundles
// never nest) with defaultLanguage for the shared reading view.
export const storySchema = baseStorySchema.extend({ transcriptTranslations: z.record(languageSchema, z.array(turnSchema).max(60)).optional(), editions: z.object({ en: baseStorySchema.optional(), zh: baseStorySchema.optional(), es: baseStorySchema.optional() }).optional(), defaultLanguage: languageSchema.optional() });
export type Story = z.infer<typeof storySchema>;
export type Turn = z.infer<typeof turnSchema>;
export type TurnAuthor = z.infer<typeof turnAuthorSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Paper = z.infer<typeof paperSchema>;
export const initialStory: Story = { name: "", language: "en", occasion: "life", artwork: "none", turns: [], sources: [], sample: false, approved: false };
export const languages = { en: "English", zh: "中文", es: "Español" };
export const sampleMemory = "In July 1969, I was nine and we all squeezed into my grandmother’s living room in Queens to watch the Moon landing. She had the only television in the family. I remember sitting on the carpet with my cousins. Grandma kept bringing in plates of food, as if the astronauts were coming for dinner.";
export const sampleSource: Source = { id: "nasa-apollo-11", title: "The night the world watched the Moon", url: "https://www.nasa.gov/history/july-20-1969-one-giant-leap-for-mankind/", publisher: "NASA", date: "20 July 1969", description: "NASA’s account describes Apollo 11’s lunar landing on July 20, 1969, and the first moonwalk that followed. It offers historical context for the televised event.", connection: "You remember watching the Moon landing with your family in Queens.", question: "Thinking back to that television, what do you remember everyone doing when the picture appeared?", selected: false };
export const samplePaper: Paper = { headline: "One small room. A whole new world.", standfirst: "A grandmother’s television brought a family together in Queens, on a night that reached far beyond their living room.", paragraphs: ["I was nine in July 1969. We all squeezed into my grandmother’s living room in Queens to watch the Moon landing. She had the only television in the family.", "I remember sitting on the carpet with my cousins. Grandma kept bringing in plates of food, as if the astronauts were coming for dinner."], quote: "Grandma kept bringing in plates of food, as if the astronauts were coming for dinner." };
export function safeSourceUrl(value: string) { try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:" ? u.href : null; } catch { return null; } }
export function originalWords(story: Story) { return story.turns.filter(t => t.role === "user").map(t => t.text); }

export function artifactLanguage(story:Story){return story.paperLanguage||story.language;}

// Guests contribute on a synthetic story: no name, no sources — only their own
// turns. Shared by the server prompt builder and the client surface.
export function guestStory(language:Story['language'],occasion:Story['occasion'],turns:Turn[]):Story{return {name:'',language,occasion,turns,sources:[],sample:false,approved:false};}
