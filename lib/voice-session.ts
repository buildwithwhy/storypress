// Browser voice I/O only. Interview decisions remain in the existing workflow.
export type VoicePhase = "idle" | "speaking" | "starting" | "recording" | "transcribing";
export type VoiceProblem = "unsupported" | "microphone" | "speech" | "empty" | "tooLarge" | "recording";
type Events = {
  phase: (phase: VoicePhase) => void;
  elapsed: (seconds: number) => void;
  problem: (problem: VoiceProblem | Error) => void;
  clip: (blob: Blob) => void;
  transcript: (text: string) => void;
  transcribe: (blob: Blob, signal: AbortSignal) => Promise<string>;
};
export function createVoiceSession(events: Events) {
  let generation = 0;
  let rec: MediaRecorder | undefined;
  let stream: MediaStream | undefined;
  let request: AbortController | undefined;
  let recordingTimer: ReturnType<typeof setInterval> | undefined;
  let speechTimer: ReturnType<typeof setTimeout> | undefined;
  let utterance: SpeechSynthesisUtterance | undefined;
  let phase: VoicePhase = "idle";
  const state = (next: VoicePhase) => { phase = next; events.phase(next); };
  function cleanup() {
    clearInterval(recordingTimer); clearTimeout(speechTimer);
    stream?.getTracks().forEach(track => track.stop()); stream = undefined;
  }
  function cancel() {
    generation++;
    request?.abort(); request = undefined;
    if (rec && rec.state !== "inactive") rec.stop();
    rec = undefined;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    utterance = undefined;
    cleanup(); state("idle");
  }
  function speak(text: string, language: "en" | "zh" | "es") {
    cancel();
    if (!text.trim()) return;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") { events.problem("speech"); return; }
    const id = generation;
    const synth = window.speechSynthesis;
    const lang = { en: "en-US", zh: "zh-CN", es: "es-ES" }[language];
    const voices = synth.getVoices();
    const matching = voices.filter(v => v.lang.replace("_", "-").toLowerCase().startsWith(language));
    if (voices.length && !matching.length) { events.problem("speech"); return; }
    const u = new SpeechSynthesisUtterance(text);
    utterance = u; // Keep a strong reference until playback finishes.
    u.lang = lang; u.rate = 0.9;
    const voice = matching.find(v => v.lang === lang && v.localService) || matching.find(v => v.lang === lang) || matching[0];
    if (voice) u.voice = voice;
    let started = false;
    u.onstart = () => { if (id === generation) { started = true; clearTimeout(speechTimer); } };
    u.onend = () => { if (id === generation) { clearTimeout(speechTimer); utterance = undefined; state("idle"); } };
    u.onerror = () => { if (id === generation) { cancel(); events.problem("speech"); } };
    state("speaking");
    // Mobile browsers may block an asynchronous utterance until another tap.
    speechTimer = setTimeout(() => { if (id === generation && !started) { cancel(); events.problem("speech"); } }, 5000);
    try { synth.resume(); synth.speak(u); } catch { cancel(); events.problem("speech"); }
  }
  async function record() {
    if (phase === "starting" || phase === "transcribing") return;
    if (phase === "recording") { finish(); return; }
    cancel();
    const id = generation;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { events.problem("unsupported"); return; }
    state("starting");
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (id !== generation) { acquired.getTracks().forEach(t => t.stop()); return; }
      stream = acquired;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg"].find(m => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(acquired, { audioBitsPerSecond: 48000, ...(mime ? { mimeType: mime } : {}) });
      rec = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { if (id === generation) { cancel(); events.problem("recording"); } };
      recorder.onstop = async () => {
        if (id !== generation) return;
        cleanup(); rec = undefined;
        const blob = new Blob(chunks, { type: recorder.mimeType || mime || "audio/webm" });
        if (!blob.size) { state("idle"); events.problem("empty"); return; }
        events.clip(blob);
        if (blob.size > 3000000) { state("idle"); events.problem("tooLarge"); return; }
        state("transcribing"); request = new AbortController();
        try {
          const text = (await events.transcribe(blob, request.signal)).trim();
          if (id !== generation) return;
          request = undefined; state("idle");
          if (text) events.transcript(text); else events.problem("empty");
        } catch (error) {
          if (id === generation) { request = undefined; state("idle"); events.problem(error instanceof Error ? error : new Error(String(error))); }
        }
      };
      recorder.start(1000); state("recording"); events.elapsed(0);
      const start = Date.now();
      recordingTimer = setInterval(() => {
        const seconds = Math.floor((Date.now() - start) / 1000);
        events.elapsed(Math.min(seconds, 120));
        if (seconds >= 120) finish();
      }, 250);
    } catch (error) {
      if (id === generation) { cancel(); events.problem(error instanceof DOMException && error.name === "NotAllowedError" ? "microphone" : "recording"); }
    }
  }
  function finish() { if (rec?.state === "recording") { clearInterval(recordingTimer); rec.stop(); state("transcribing"); } }
  return { speak, record, finish, cancel };
}
