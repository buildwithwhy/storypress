// Encode ladder for the hidden memory video. Primary rung: WebCodecs
// VideoEncoder + Mediabunny's pure-TS MP4 muxer (chosen over the deprecated
// mp4-muxer; AAC-capable for the narration seam, ~33 kB gzip for the mux-only
// surface). Fallback rungs: MediaRecorder, Safari-first MP4 then probed
// Chromium MP4 profiles then WebM — every probe a real short recording
// verified in a media element, never isTypeSupported(). The trial encode
// renders ~2s of the real timeline at the target size, so a refusal here is
// a refusal of the actual rung, and the one downgrade to 720x900 is explicit.
// The ladder always ends in an artifact: the final refusal throws a typed
// error naming the share-images rung that already shipped. Output is a client
// blob for download or a files-only share — nothing is stored, and no
// story content leaves the device at any rung.
import { Output, BufferTarget, Mp4OutputFormat, EncodedVideoPacketSource, EncodedAudioPacketSource, EncodedPacket } from "mediabunny";
import { type VideoManifest } from "./video-storyboard";
import { createCanvas, loadManifestImages, renderFrame, frameTimeline } from "./video-frames";
import { artifactSharePayload, shareSheetAvailable } from "./share-payload";

export const VIDEO_FPS = 24;
export const FULL_VIDEO_SIZE = { width: 1080, height: 1350 };
export const DOWNGRADED_VIDEO_SIZE = { width: 720, height: 900 };
const TRIAL_MS = 2000;
const BITRATE_AT_FULL = 3_500_000;

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
// Yield between frame batches so progress UI can paint; irrelevant to
// correctness, central to the patient-render rule for elderly narrators.
const yieldToUi = () => delay(0);

export function videoBitrate(width: number, height: number): number {
  return Math.round(BITRATE_AT_FULL * (width * height) / (FULL_VIDEO_SIZE.width * FULL_VIDEO_SIZE.height));
}

// Narration seam (v1 leaves it empty; the narration PR fills it). `chunks`
// carries pre-encoded AAC packets for the WebCodecs rung's muxed audio track;
// `stream` carries the mixed input track the MediaRecorder rung records.
export interface AudioTrackInput {
  chunks?: AsyncIterable<EncodedAudioChunk>;
  stream?: MediaStreamTrack;
  numberOfChannels: number;
  sampleRate: number;
}

export interface EncodeRungInput {
  manifest: VideoManifest;
  totalMs: number;
  fps: number;
  renderAt: (ctx: CanvasRenderingContext2D, timeMs: number) => void;
  makeCanvas: (width: number, height: number) => HTMLCanvasElement;
  record: (step: string) => void;
  audio?: AudioTrackInput;
}

export interface EncodeTrial { width: number; height: number; }

// A rung proves itself with a trial and, if accepted, produces the file.
// `encode` is only ever called after this rung's own trial returned a size.
export interface EncodeRung {
  name: string;
  trial(input: EncodeRungInput): Promise<EncodeTrial | null>;
  encode(input: EncodeRungInput & EncodeTrial, onProgress?: (done: number, total: number) => void): Promise<{ blob: Blob; mimeType: string }>;
}

// The visible end of the ladder: a typed failure that names the trail it
// walked, so a silent degradation can never hide behind a generic error.
export class VideoEncodeUnavailableError extends Error {
  readonly path: string[];
  constructor(path: string[]) {
    super(`No video encoder could be prepared on this device (${path.join(" -> ")}); share images remain available.`);
    this.name = "VideoEncodeUnavailableError";
    this.path = path;
  }
}

export interface EncodedMemoryVideo { blob: Blob; mimeType: string; width: number; height: number; path: string[]; }

export interface EncodeMemoryVideoOptions {
  rungs?: EncodeRung[];
  render?: (ctx: CanvasRenderingContext2D, timeMs: number) => void;
  audio?: AudioTrackInput;
  onProgress?: (done: number, total: number) => void;
  // Services-payload growth credit for the end card. Render config, not story
  // content — it never enters the manifest.
  creditUrl?: string;
}

// Drives the ladder over the real manifest. Every degradation is recorded
// into `path` as "rung:event" steps; the returned path is the render's audit
// trail and the check's ladder-degradation evidence.
export async function encodeMemoryVideo(manifest: VideoManifest, options: EncodeMemoryVideoOptions = {}): Promise<EncodedMemoryVideo> {
  await document.fonts?.ready;
  const slots = frameTimeline(manifest);
  const totalMs = slots[slots.length - 1].endMs;
  const images = await loadManifestImages(manifest);
  const renderAt = options.render ?? ((ctx, timeMs) => renderFrame(ctx, manifest, timeMs, slots, images, options.creditUrl));
  if (manifest.audioTrack && manifest.audioTrack.kind !== "none" && !options.audio) {
    throw new Error("This video declares narration, so the encoder needs its audio track; nothing was encoded.");
  }
  const path: string[] = [];
  const input: EncodeRungInput = {
    manifest,
    totalMs,
    fps: VIDEO_FPS,
    renderAt,
    makeCanvas: (width, height) => createCanvas(width, height).canvas,
    record: step => path.push(step),
    ...(options.audio ? { audio: options.audio } : {}),
  };
  for (const rung of options.rungs ?? defaultRungs()) {
    const trial = await rung.trial(input);
    if (!trial) continue;
    input.record(`${rung.name}:accepted-${trial.width}x${trial.height}`);
    const { blob, mimeType } = await rung.encode({ ...input, width: trial.width, height: trial.height }, options.onProgress);
    return { blob, mimeType, width: trial.width, height: trial.height, path };
  }
  path.push("share-images");
  throw new VideoEncodeUnavailableError(path);
}

// H.264 candidates for the WebCodecs rung, tried by real trial encode. High
// profile level 4.0 carries 1080x1350@24; baseline 3.0 covers 720x900.
const AVC_CANDIDATES = ["avc1.640028", "avc1.42E01E"];

// The WebCodecs rung. The trial probes the real pipeline — encoder config,
// mux, container — first at full size, then once at the downgraded size, so
// an old encoder that refuses 1080x1350 degrades explicitly instead of
// failing the render. Video-only trials: audio rides the full encode.
export function webCodecsMp4Rung(): EncodeRung {
  const probe = async (input: EncodeRungInput, width: number, height: number): Promise<boolean> => {
    for (const codec of AVC_CANDIDATES) {
      try {
        const bytes = await encodeWithWebCodecs({ ...input, width, height }, codec, TRIAL_MS);
        if (bytes.byteLength > 0) return true;
      } catch { /* refusal at this rung — try the next profile */ }
    }
    return false;
  };
  return {
    name: "webcodecs-mp4",
    async trial(input) {
      if (await probe(input, FULL_VIDEO_SIZE.width, FULL_VIDEO_SIZE.height)) return { ...FULL_VIDEO_SIZE };
      input.record("webcodecs-mp4:refused-1080x1350");
      if (await probe(input, DOWNGRADED_VIDEO_SIZE.width, DOWNGRADED_VIDEO_SIZE.height)) return { ...DOWNGRADED_VIDEO_SIZE };
      input.record("webcodecs-mp4:refused-720x900");
      return null;
    },
    async encode(input, onProgress) {
      let bytes: ArrayBuffer | null = null;
      for (const codec of AVC_CANDIDATES) {
        try { bytes = await encodeWithWebCodecs(input, codec, undefined, onProgress); break; }
        catch { /* try the next profile before giving this rung up */ }
      }
      if (!bytes || bytes.byteLength === 0) throw new Error("The video encoder stopped partway through; try again.");
      return { blob: new Blob([bytes], { type: "video/mp4" }), mimeType: "video/mp4" };
    },
  };
}

async function encodeWithWebCodecs(input: EncodeRungInput & EncodeTrial, codec: string, limitMs?: number, onProgress?: (done: number, total: number) => void): Promise<ArrayBuffer> {
  const { canvas, ctx } = createCanvas(input.width, input.height);
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
  const videoSource = new EncodedVideoPacketSource("avc");
  output.addVideoTrack(videoSource);
  // Narration seam: when AAC chunks ride along, the muxer gets a second
  // track. MediaRecorder mixes by adding the stream track instead (below).
  let audioSource: EncodedAudioPacketSource | undefined;
  if (input.audio?.chunks) { audioSource = new EncodedAudioPacketSource("aac"); output.addAudioTrack(audioSource); }

  let encodeError: Error | undefined;
  const fail = (e: unknown) => { encodeError ??= e instanceof Error ? e : new Error(String(e)); };
  let encoder: VideoEncoder;
  try {
    encoder = new VideoEncoder({
      output: (chunk, meta) => { videoSource.add(EncodedPacket.fromEncodedChunk(chunk), meta).catch(fail); },
      error: fail,
    });
  } catch (e) { fail(e); throw encodeError; }
  encoder.configure({
    codec,
    width: input.width,
    height: input.height,
    bitrate: videoBitrate(input.width, input.height),
    framerate: input.fps,
    // Mediabunny's MP4 muxer consumes AVCC-formatted chunks; annexb would
    // break the container.
    avc: { format: "avc" },
  });

  await output.start();
  const frameMs = 1000 / input.fps;
  const frameCount = limitMs
    ? Math.min(Math.max(1, Math.round(input.totalMs * input.fps / 1000)), Math.round(limitMs * input.fps / 1000))
    : Math.max(1, Math.round(input.totalMs * input.fps / 1000));
  const frameDurationUs = Math.round(1e6 / input.fps);
  const audioDone = (async () => {
    if (!audioSource || !input.audio?.chunks) return;
    for await (const chunk of input.audio.chunks) await audioSource.add(EncodedPacket.fromEncodedChunk(chunk)).catch(fail);
  })();
  try {
    for (let i = 0; i < frameCount; i++) {
      if (encodeError) throw encodeError;
      input.renderAt(ctx, Math.min(i * frameMs, input.totalMs - 1));
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameDurationUs), duration: frameDurationUs });
      encoder.encode(frame, { keyFrame: i % input.fps === 0 });
      frame.close();
      onProgress?.(i + 1, frameCount);
      if (i % 8 === 7) await yieldToUi();
    }
    await encoder.flush();
  } finally {
    encoder.close();
  }
  await audioDone;
  if (encodeError) throw encodeError;
  await output.finalize();
  const buffer = target.buffer;
  if (!buffer || buffer.byteLength === 0) throw new Error("The muxer produced no video bytes.");
  return buffer;
}

// MediaRecorder probes: a short real recording verified by loading the result
// into a media element. isTypeSupported() is a claim; this is a proof.
const MP4_RECORDER_CANDIDATES = [
  'video/mp4; codecs="avc1.42E01E"', // Safari records MP4/H.264 natively — first
  'video/mp4; codecs="avc1.4d002a"', // probed Chromium MP4 profiles follow
  'video/mp4; codecs="avc1.640028"',
  "video/mp4",
];
const WEBM_RECORDER_CANDIDATES = ['video/webm; codecs="vp9"', 'video/webm; codecs="vp8"', "video/webm"];

function playsInVideoElement(blob: Blob): Promise<boolean> {
  return new Promise(resolve => {
    const video = document.createElement("video");
    let url: string | undefined;
    const finish = (ok: boolean) => { clearTimeout(timeout); if (url) URL.revokeObjectURL(url); resolve(ok); };
    const timeout = setTimeout(() => finish(false), 3000);
    video.onloadeddata = () => finish(video.videoWidth > 0);
    video.onerror = () => finish(false);
    url = URL.createObjectURL(blob);
    video.src = url;
  });
}

// The probe proves record + decode, not layout, so it renders the real
// timeline into a small canvas — cheaper than seven full-size probes.
async function probeMediaRecorder(input: EncodeRungInput, mimeType: string): Promise<boolean> {
  try {
    const { canvas, ctx } = createCanvas(160, 200);
    const blob = await recordWithMediaRecorder(input, canvas, ctx, mimeType, 3);
    return await playsInVideoElement(blob);
  } catch { return false; }
}

async function recordWithMediaRecorder(
  input: EncodeRungInput,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  mimeType: string,
  frameLimit?: number,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  if (input.audio?.stream) stream.addTrack(input.audio.stream); // mixed signal: narration rides the recorded stream
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: videoBitrate(canvas.width, canvas.height) });
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((resolve, reject) => { recorder.onstop = () => resolve(); recorder.onerror = () => reject(new Error("The recorder failed mid-video.")); });
  const frameCount = frameLimit ?? Math.max(1, Math.round(input.totalMs * input.fps / 1000));
  const frameMs = 1000 / input.fps;
  recorder.start();
  try {
    for (let i = 0; i < frameCount; i++) {
      input.renderAt(ctx, Math.min(i * frameMs, input.totalMs - 1));
      track.requestFrame(); // capture timestamps are wall-clock — advance and pace to real time
      onProgress?.(i + 1, frameCount);
      await delay(frameMs);
    }
  } finally {
    recorder.stop();
  }
  await stopped;
  const blob = new Blob(chunks, { type: mimeType.split(";")[0].trim() });
  if (!blob.size) throw new Error("The recorder produced no video bytes.");
  return blob;
}

export function mediaRecorderRung(candidates: string[], name: string): EncodeRung {
  let verified: string | undefined;
  return {
    name,
    async trial(input) {
      for (const mimeType of candidates) {
        if (await probeMediaRecorder(input, mimeType)) { verified = mimeType; return { ...FULL_VIDEO_SIZE }; }
        input.record(`${name}:refused-${mimeType}`);
      }
      return null;
    },
    async encode(input, onProgress) {
      if (!verified) throw new Error("The recorder was never proven; the trial must run before the encode.");
      const { canvas, ctx } = createCanvas(input.width, input.height);
      const blob = await recordWithMediaRecorder(input, canvas, ctx, verified, undefined, onProgress);
      return { blob, mimeType: verified.split(";")[0].trim() };
    },
  };
}

// The ladder: WebCodecs+Mediabunny MP4 primary, MediaRecorder MP4
// (Safari-first), MediaRecorder WebM. Its final refusal names share-images —
// the artifact that already exists on every device.
export function defaultRungs(): EncodeRung[] {
  return [webCodecsMp4Rung(), mediaRecorderRung(MP4_RECORDER_CANDIDATES, "mediarecorder-mp4"), mediaRecorderRung(WEBM_RECORDER_CANDIDATES, "mediarecorder-webm")];
}

// Client-blob delivery, exactly like share images: share sheet when the
// browser can carry the file, otherwise a plain download. Nothing is stored.
export async function deliverMemoryVideo(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: blob.type });
  // The audited files-only builder — the video payload can never grow a url
  // or text key, and the capability probe stays the single gate.
  const payload = artifactSharePayload([file]);
  if (shareSheetAvailable([file])) { await navigator.share(payload); return "shared"; }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
}
