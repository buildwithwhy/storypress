// Pure storyboard derivation for the hidden memory video. No DOM, no fetch —
// every value here is computable from the approved edition snapshot alone, so
// scripts/check-video.mjs owns the behavior deterministically. The frame
// renderer and encoder consume the manifest; they never re-derive pacing.
import { z } from "zod";
import { type Story, type Language, languageSchema } from "./story";
import { keepsakeCopy } from "./keepsake";

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1350;

// Pacing band. Silent cards hold 45–75 seconds per the spec; natural durations
// are normalized into 48–72s so the sum always sits inside the target with
// margin. A narration audioTrack, when present, replaces the band entirely —
// narration length gates scene pacing through this same function.
const MIN_TOTAL_MS = 48000;
const MAX_TOTAL_MS = 72000;
const TITLE_DURATION_MS = 6000;
const END_DURATION_MS = 5000;
const QUOTE_BASE_MS = 5500;
const PROSE_BASE_MS = 5000;
const PER_UNIT_MS = 8;
const UNIT_CAP_MS = 2500;
// Excerpts cap near what a card can hold at the keepsake type scale (both a
// 380-unit CJK excerpt and a 380-unit Latin one wrap to roughly nine lines).
const MAX_EXCERPT_UNITS = 380;
const TARGET_UNITS_PER_CARD = 320;
const MIN_PROSE_CARDS = 4;
const MAX_PROSE_CARDS = 8;

export type VideoSceneKind = "title" | "prose" | "quote" | "end";
export interface KenBurns { from: number; to: number; panX: number; panY: number; }
export interface VideoScene {
  kind: VideoSceneKind;
  text?: string; // headline / prose excerpt / quote / credit line
  image?: string; // photo or AI illustration data URL (Ken Burns subject)
  durationMs: number;
  kenBurns: KenBurns;
}

export const kenBurnsSchema = z.object({ from: z.number(), to: z.number(), panX: z.number(), panY: z.number() });
export const videoSceneSchema = z.object({
  kind: z.enum(["title", "prose", "quote", "end"]),
  text: z.string().max(700).optional(),
  image: z.string().max(1800000).optional(),
  durationMs: z.number().int().positive(),
  kenBurns: kenBurnsSchema,
});
// Narration seam (v1 never fills it): 'none' marks an explicitly silent track,
// 'canvas' a take recorded in the current session, 'clip' a referenced clip by
// id. A duration greater than zero gates scene pacing; nothing else in the
// manifest changes shape when narration arrives.
export const audioTrackSchema = z.object({
  kind: z.enum(["none", "canvas", "clip"]),
  durationMs: z.number().int().min(0),
  source: z.string().max(128).optional(),
});
export type AudioTrack = z.infer<typeof audioTrackSchema>;

export const videoManifestSchema = z.object({
  language: languageSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  byline: z.string().max(80).optional(),
  standfirst: z.string().max(600).optional(),
  scenes: z.array(videoSceneSchema).min(1).max(16),
  audioTrack: audioTrackSchema.optional(),
});
export type VideoManifest = z.infer<typeof videoManifestSchema>;

// Display width in relative units: CJK-family code points count double, so an
// excerpt budget holds the same visual measure in every artifact language.
function widthUnit(code: number): 1 | 2 {
  return (code >= 0x1100 && code <= 0x115f) || (code >= 0x2e80 && code <= 0xa4cf) || (code >= 0xac00 && code <= 0xd7a3)
    || (code >= 0xf900 && code <= 0xfaff) || (code >= 0xfe30 && code <= 0xfe4f) || (code >= 0xff00 && code <= 0xff60)
    || (code >= 0xffe0 && code <= 0xffe6) ? 2 : 1;
}
export function widthUnits(text: string): number {
  return Array.from(text).reduce((n, ch) => n + widthUnit(ch.codePointAt(0)!), 0);
}

// Latin sentence ends split only at following whitespace (so "3.5" survives);
// CJK end punctuation splits unconditionally, since zh text rarely spaces
// after a full stop.
const SENTENCE_SPLIT = /(?<=[.!?])\s+|(?<=[。！？…])\s*/;
function splitSentences(paragraph: string): string[] {
  return paragraph.split(SENTENCE_SPLIT).map(s => s.trim()).filter(Boolean);
}

function splitSentenceMidpoint(text: string): [string, string] {
  const cps = Array.from(text);
  const middle = Math.ceil(cps.length / 2);
  // Break at the nearest space left of center; CJK and other space-less text
  // break at the code-point midpoint instead of dropping a word.
  let at = text.lastIndexOf(" ", middle);
  if (at <= 0) at = -1;
  return at > 0
    ? [cps.slice(0, at).join("").trimEnd(), cps.slice(at).join("").trimStart()]
    : [cps.slice(0, middle).join(""), cps.slice(middle).join("")];
}

// Position-splits sentences into unit-weighted chunks so card lengths stay
// even. Fewer than four chunks widen by splitting the heaviest one; a paper
// whose paragraphs are all empty yields no prose cards at all.
function proseChunks(sentences: string[]): string[][] {
  const units = sentences.map(widthUnits);
  const total = units.reduce((a, b) => a + b, 0);
  const desired = Math.min(MAX_PROSE_CARDS, Math.max(MIN_PROSE_CARDS, Math.ceil(total / TARGET_UNITS_PER_CARD)));
  const slot = total / desired;
  const groups: string[][] = Array.from({ length: desired }, () => []);
  let before = 0;
  for (const [i, sentence] of sentences.entries()) {
    const k = Math.min(desired - 1, Math.floor(before / slot));
    groups[k].push(sentence);
    before += units[i];
  }
  const present = groups.filter(g => g.length);
  const groupUnits = (group: string[]) => group.reduce((n, s) => n + widthUnits(s), 0);
  while (present.length < MIN_PROSE_CARDS) {
    const heaviest = present.reduce((max, g, i) => (groupUnits(g) > groupUnits(present[max]) ? i : max), 0);
    const group = present[heaviest];
    if (group.length >= 2) {
      const half = groupUnits(group) / 2;
      let acc = 0, at = 0;
      while (at < group.length - 1 && acc < half) { acc += widthUnits(group[at]); at++; }
      present.splice(heaviest, 1, group.slice(0, at), group.slice(at));
    } else {
      const [a, b] = splitSentenceMidpoint(group[0]);
      if (!a || !b) break; // a single code point cannot split further
      present.splice(heaviest, 1, [a], [b]);
    }
  }
  return present;
}

// Cards excerpt the approved prose, never reprint it whole. Cuts prefer a
// completed sentence, then a word boundary; only a space-less run cuts at a
// code point. Word and code-point cuts carry an ellipsis; sentence cuts end
// on their own punctuation.
function excerptOf(sentences: string[]): string | undefined {
  const text = sentences.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  if (widthUnits(text) <= MAX_EXCERPT_UNITS) return text;
  const cps = Array.from(text);
  let units = 0, fit = cps.length - 1, lastSentence = -1, lastSpace = -1;
  for (let i = 0; i < cps.length; i++) {
    const u = widthUnit(cps[i].codePointAt(0)!);
    if (units + u > MAX_EXCERPT_UNITS) { fit = i - 1; break; }
    units += u;
    fit = i;
    if (/[.!?…。！？]/.test(cps[i])) lastSentence = i;
    if (cps[i] === " ") lastSpace = i;
  }
  if (lastSentence >= 0 && lastSentence <= fit) return cps.slice(0, lastSentence + 1).join("");
  if (lastSpace >= 0 && lastSpace <= fit) return cps.slice(0, lastSpace).join("").trimEnd() + "…";
  return cps.slice(0, fit + 1).join("") + "…";
}

// Deterministic camera variety: zoom direction alternates per scene, pans
// cycle through four patterns. Scale never dips below 1 — the frame renderer
// draws images edge-to-edge, so a smaller scale would reveal empty canvas.
const PAN_PATTERNS: Array<{ panX: number; panY: number }> = [
  { panX: 0.02, panY: 0 },
  { panX: -0.02, panY: 0.01 },
  { panX: 0, panY: 0.02 },
  { panX: 0.015, panY: -0.015 },
];
function kenBurnsFor(index: number): KenBurns {
  const zoomIn = index % 2 === 0;
  const pan = PAN_PATTERNS[index % PAN_PATTERNS.length];
  return zoomIn
    ? { from: 1.04, to: 1.12, panX: pan.panX, panY: pan.panY }
    : { from: 1.12, to: 1.04, panX: -pan.panX, panY: -pan.panY };
}

// Scales natural durations to the pacing target exactly, absorbing rounding
// drift on the longest scene so the sum the encoder sees is the target.
function fitDurations(natural: number[], targetMs: number): number[] {
  const total = natural.reduce((a, b) => a + b, 0);
  if (total === targetMs) return natural;
  const scaled = natural.map(ms => Math.round(ms * targetMs / total));
  scaled[scaled.indexOf(Math.max(...natural))] += targetMs - scaled.reduce((a, b) => a + b, 0);
  return scaled;
}

function heldFor(text: string | undefined, baseMs: number): number {
  return baseMs + (text ? Math.min(UNIT_CAP_MS, widthUnits(text) * PER_UNIT_MS) : 0);
}

export function buildStoryboard(snapshot: Story, lang: Language, audioTrack?: AudioTrack): VideoScene[] {
  const paper = snapshot.paper;
  if (!paper) throw new Error("No keepsake yet.");
  const images = [snapshot.photo, snapshot.generatedArt?.data].filter((v): v is string => !!v);
  const chunks = proseChunks(paper.paragraphs.flatMap(splitSentences));
  const prose = chunks.map((chunk, i) => {
    const text = excerptOf(chunk);
    return { kind: "prose" as const, text, ...(images.length ? { image: images[i % images.length] } : {}), durationMs: heldFor(text, PROSE_BASE_MS), kenBurns: kenBurnsFor(i) };
  });
  const scenes: VideoScene[] = [
    { kind: "title", text: paper.headline, durationMs: TITLE_DURATION_MS, kenBurns: kenBurnsFor(0) },
    ...prose,
    ...(paper.quote ? [{ kind: "quote" as const, text: paper.quote, durationMs: heldFor(paper.quote, QUOTE_BASE_MS), kenBurns: kenBurnsFor(prose.length + 1) }] : []),
    { kind: "end", text: keepsakeCopy[lang].credit, durationMs: END_DURATION_MS, kenBurns: kenBurnsFor(prose.length + 2) },
  ];
  // Narration, when present and non-trivial, replaces the pacing band.
  const natural = scenes.map(s => s.durationMs);
  const total = natural.reduce((a, b) => a + b, 0);
  const target = audioTrack && audioTrack.durationMs >= 1000
    ? audioTrack.durationMs
    : Math.min(MAX_TOTAL_MS, Math.max(MIN_TOTAL_MS, total));
  const durations = fitDurations(natural, target);
  return scenes.map((scene, i) => ({ ...scene, durationMs: durations[i], kenBurns: kenBurnsFor(i) }));
}

export function buildVideoManifest(snapshot: Story, lang: Language, audioTrack?: AudioTrack): VideoManifest {
  const paper = snapshot.paper;
  if (!paper) throw new Error("No keepsake yet.");
  return videoManifestSchema.parse({
    language: lang,
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    ...(snapshot.name ? { byline: snapshot.name } : {}),
    ...(paper.standfirst ? { standfirst: paper.standfirst } : {}),
    scenes: buildStoryboard(snapshot, lang, audioTrack),
    ...(audioTrack ? { audioTrack } : {}),
  });
}
