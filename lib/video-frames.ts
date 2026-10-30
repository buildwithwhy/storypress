// Canvas frame renderer for the hidden memory video — lib/share-images.ts
// with a time parameter. Same 1080x1350 canvas, cream/green keepsake palette,
// masthead line, CJK-safe wrapLines() and inlined fonts. Every moving part is
// derived from the storyboard's Ken Burns parameters; nothing here re-derives
// pacing. scripts/check-video.mjs drives renderFrame through a recording mock
// context, so this module carries no network surface and no storage: story
// content is drawn locally, full stop.
import { type VideoManifest, type VideoScene, type KenBurns, VIDEO_WIDTH, VIDEO_HEIGHT } from "./video-storyboard";
import { keepsakeCopy, mastheadCopy } from "./keepsake";
import { wrapLines, drawHeaderCredit } from "./share-images";

const CREAM = "#fffaf0";
const GREEN = "#294b3b";
const INK = "#29382d";
const MUTED = "#68725d";
const RULE = "#c8c5b2";
const GOLD = "#b89247";
const MEASURE_WIDTH = 900;
const LEFT = 90;

export type LoadedImages = Map<string, HTMLImageElement>;

const serif = (size: number, italic = false) => `${italic ? "italic " : ""}${size}px Georgia, "Songti SC", serif`;

export interface SceneSlot { scene: VideoScene; startMs: number; endMs: number; }

// The timeline the renderer and encoder share: contiguous cumulative slots —
// every millisecond of the video belongs to exactly one scene.
export function frameTimeline(manifest: VideoManifest): SceneSlot[] {
  const slots: SceneSlot[] = [];
  let startMs = 0;
  for (const scene of manifest.scenes) {
    const endMs = startMs + scene.durationMs;
    slots.push({ scene, startMs, endMs });
    startMs = endMs;
  }
  return slots;
}

export function sceneAt(slots: SceneSlot[], timeMs: number): SceneSlot {
  const last = slots[slots.length - 1];
  const t = Math.max(0, Math.min(timeMs, last.endMs - 1));
  for (const slot of slots) if (t >= slot.startMs && t < slot.endMs) return slot;
  return last; // degenerate single-slot timelines only
}

// Linear Ken Burns interpolation at progress p, clamped to [0,1]. Scale never
// dips below 1 — the window draws cover-fit, so a smaller scale would reveal
// empty canvas.
export function kenBurnsAt(kb: KenBurns, p: number): { scale: number; pan: number } {
  const t = Math.min(1, Math.max(0, p));
  return { scale: kb.from + (kb.to - kb.from) * t, pan: t };
}

export interface KenBurnsRect { x: number; y: number; w: number; h: number; }

// Draws the scene image cover-fit inside the window with the storyboard's
// Ken Burns move applied. The pan drifts by at most a tenth of half the slack
// on each axis, so the window stays covered for every p.
export function drawKenBurns(ctx: CanvasRenderingContext2D, img: HTMLImageElement, rect: KenBurnsRect, kb: KenBurns, p: number): void {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!iw || !ih) return;
  const { scale, pan } = kenBurnsAt(kb, p);
  const s = Math.max(rect.w / iw, rect.h / ih) * scale;
  const dw = iw * s, dh = ih * s;
  const slackX = Math.max(0, dw - rect.w), slackY = Math.max(0, dh - rect.h);
  const dx = rect.x + (rect.w - dw) / 2 + kb.panX * pan * slackX / 2;
  const dy = rect.y + (rect.h - dh) / 2 + kb.panY * pan * slackY / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

interface FittedBlock { lines: string[]; lineHeight: number; }

// Shrinks type until the wrapped block fits its height budget — the
// share-image headline loop generalized. Wrapping always runs through
// wrapLines at the live text measure, so CJK breaks by code point exactly as
// the share images do.
function fitBlock(ctx: CanvasRenderingContext2D, text: string, width: number, startSize: number, minSize: number, maxHeight: number, italic = false): FittedBlock {
  let size = startSize;
  for (;;) {
    ctx.font = serif(size, italic);
    const lines = wrapLines(text, width, s => ctx.measureText(s).width);
    const lineHeight = Math.round(size * 1.325);
    if (lines.length * lineHeight <= maxHeight || size <= minSize) return { lines, lineHeight };
    size -= 2;
  }
}

// Returns the x where the masthead text ends, so a same-row draw (the end
// card's growth credit) can stay clear of it.
function drawMastheadLine(ctx: CanvasRenderingContext2D, language: VideoManifest["language"], counter?: string): number {
  ctx.fillStyle = GREEN;
  ctx.font = "22px system-ui";
  const masthead = mastheadCopy[language].toUpperCase();
  const text = counter ? `${masthead}  /  ${counter}` : masthead;
  ctx.fillText(text, LEFT, 75);
  return LEFT + ctx.measureText(text).width;
}

function footerText(manifest: VideoManifest): string {
  const c = keepsakeCopy[manifest.language];
  return manifest.byline ? `${c.by} ${manifest.byline}` : c.credit;
}

function drawFooter(ctx: CanvasRenderingContext2D, text: string): void {
  ctx.strokeStyle = RULE;
  ctx.beginPath();
  ctx.moveTo(LEFT, 1250);
  ctx.lineTo(990, 1250);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  let size = 23;
  ctx.font = `${size}px system-ui`;
  while (ctx.measureText(text).width > MEASURE_WIDTH && size > 12) { size--; ctx.font = `${size}px system-ui`; }
  ctx.fillText(text, LEFT, 1295);
}

function drawTitle(ctx: CanvasRenderingContext2D, manifest: VideoManifest): void {
  const c = keepsakeCopy[manifest.language];
  drawMastheadLine(ctx, manifest.language);
  const headline = fitBlock(ctx, manifest.scenes[0].text ?? "", MEASURE_WIDTH, 96, 30, 320);
  ctx.fillStyle = GREEN;
  let y = 260;
  for (const line of headline.lines) { ctx.fillText(line, LEFT, y); y += headline.lineHeight; }
  if (manifest.standfirst) {
    const standfirst = fitBlock(ctx, manifest.standfirst, MEASURE_WIDTH, 36, 26, 240);
    y = Math.max(y + 45, 460);
    ctx.fillStyle = MUTED;
    for (const line of standfirst.lines) { ctx.fillText(line, LEFT, y); y += standfirst.lineHeight; }
  }
  if (manifest.byline) { ctx.font = "30px system-ui"; ctx.fillStyle = MUTED; ctx.fillText(`${c.by} ${manifest.byline}`, LEFT, 1160); }
  drawFooter(ctx, footerText(manifest));
}

const IMAGE_WINDOW: KenBurnsRect = { x: 90, y: 110, w: 900, h: 470 };

function drawProse(ctx: CanvasRenderingContext2D, manifest: VideoManifest, slot: SceneSlot, p: number, proseIndex: number, proseCount: number, images: LoadedImages): void {
  const c = keepsakeCopy[manifest.language];
  drawMastheadLine(ctx, manifest.language, `${c.page} ${proseIndex} · ${proseCount}`);
  const img = slot.scene.image ? images.get(slot.scene.image) : undefined;
  if (img) drawKenBurns(ctx, img, IMAGE_WINDOW, slot.scene.kenBurns, p);
  const block = img
    ? fitBlock(ctx, slot.scene.text ?? "", MEASURE_WIDTH, 40, 28, 570)
    : fitBlock(ctx, slot.scene.text ?? "", MEASURE_WIDTH, 48, 30, 900);
  ctx.fillStyle = INK;
  let y = img ? 660 : 330;
  for (const line of block.lines) { ctx.fillText(line, LEFT, y); y += block.lineHeight; }
  drawFooter(ctx, footerText(manifest));
}

function drawQuote(ctx: CanvasRenderingContext2D, manifest: VideoManifest, scene: VideoScene): void {
  drawMastheadLine(ctx, manifest.language);
  ctx.font = serif(110);
  ctx.fillStyle = GOLD;
  ctx.fillText("\u201C", 85, 340);
  const block = fitBlock(ctx, scene.text ?? "", MEASURE_WIDTH, 46, 26, 700, true);
  ctx.fillStyle = INK;
  let y = 440;
  for (const line of block.lines) { ctx.fillText(line, LEFT, y); y += block.lineHeight; }
  drawFooter(ctx, footerText(manifest));
}

function drawEnd(ctx: CanvasRenderingContext2D, manifest: VideoManifest, creditUrl?: string): void {
  const c = keepsakeCopy[manifest.language];
  // The closing frame carries the growth credit in the masthead row's empty
  // half — the share-image header slot and primitives, one line, no other
  // layout change. The URL is render config from the services payload; it
  // never enters the manifest.
  const mastheadEnd = drawMastheadLine(ctx, manifest.language);
  if (creditUrl) drawHeaderCredit(ctx, creditUrl, c.madeWith, mastheadEnd);
  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = serif(52);
  ctx.fillText(c.credit, 540, 660);
  ctx.fillStyle = MUTED;
  ctx.font = "26px system-ui";
  ctx.fillText(mastheadCopy[manifest.language], 540, 740);
  ctx.textAlign = "left";
  drawFooter(ctx, footerText(manifest));
}

function progressOf(slot: SceneSlot, timeMs: number): number {
  return Math.min(1, Math.max(0, (timeMs - slot.startMs) / (slot.endMs - slot.startMs)));
}

// Draws the video's frame at `timeMs` onto an already-sized 2D context. No
// clocks, no fetch, no layout reads: the same manifest and time render
// identically on every call, which is what the mocked-context checks own.
export function renderFrame(ctx: CanvasRenderingContext2D, manifest: VideoManifest, timeMs: number, slots: SceneSlot[] = frameTimeline(manifest), images: LoadedImages = new Map(), creditUrl?: string): void {
  const slot = sceneAt(slots, timeMs);
  const p = progressOf(slot, timeMs);
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, VIDEO_WIDTH, 12);
  const proseSlots = slots.filter(s => s.scene.kind === "prose");
  const proseIndex = proseSlots.indexOf(slot);
  if (slot.scene.kind === "title") drawTitle(ctx, manifest);
  else if (slot.scene.kind === "prose") drawProse(ctx, manifest, slot, p, proseIndex + 1, proseSlots.length, images);
  else if (slot.scene.kind === "quote") drawQuote(ctx, manifest, slot.scene);
  else drawEnd(ctx, manifest, creditUrl);
}

// Decodes the manifest's Ken Burns subjects once per render. Sources are
// inline data URLs — the photograph and illustration never leave the device,
// so this is a local decode, not a fetch.
export async function loadManifestImages(manifest: VideoManifest): Promise<LoadedImages> {
  const images: LoadedImages = new Map();
  await Promise.all(manifest.scenes.map(scene => {
    const src = scene.image;
    if (!src || images.has(src)) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => { images.set(src, img); resolve(); };
      img.onerror = () => reject(new Error("The illustration could not load. Try again."));
      img.src = src;
    });
  }));
  return images;
}

// One canvas per render; the encoder owns sizing, the renderer owns drawing.
export function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not prepare the video frames.");
  return { canvas, ctx };
}
