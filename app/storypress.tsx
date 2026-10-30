import {TranslationStudio} from './translation-studio';
import {translationInput,translatedStory,translationCopy,transcriptInput,applyTranscriptTranslation,type TranslationResult} from '../lib/translation';
import {LanguagePicker} from "./language-picker";
import {LiveInterview} from "./live-interview";
import {Recordings} from "./recordings";
import type {SavedRecording} from "../lib/recording-vault";
"use client";
import {KeepsakeView,FormatPicker,IntentionPicker,ShareImages,ShareVideo} from "./keepsake-studio";
import {keepsakeCopy,type KeepsakeFormat} from "../lib/keepsake";
import {mergeResearch} from "../lib/research-state";
import {readInterviewResponse,interviewProblemText,networkFailure} from '../lib/interview-client';
import {spokenSentencesLength} from '../lib/interview-result';
import {StoryArt} from "./story-art";
import {StoryStart,SamplePreview} from "./story-start";
import {sharedEntryLanguage,startCopy} from "../lib/start-copy";
import {compactImage} from "../lib/compact-image";
import { ResearchThread } from "./research-thread";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Asterisk, ArrowRight, ArrowLeft, Mic, Square, Volume2, ImagePlus, Check, X, Search, Newspaper, BookOpen, Sparkles, Download, Settings, ExternalLink, Pencil, RotateCcw, LoaderCircle, Heart, Plus, FileText, Share2, Users } from "lucide-react";
import { openingQuestion, modeDescriptions } from "../lib/story-modes";
import { initialStory, languages, originalWords, safeSourceUrl, type Story, type Source, type Paper, type PhotoAnalysis } from "../lib/story";

import { createSampleStory, presentation, sampleEditions } from "../lib/presentation";
import { createVoiceSession, type VoicePhase } from "../lib/voice-session";
import { interviewCopy } from "../lib/interview-copy";

import {setupAccount,accountHeaders,accountRequest,type AccountConfig} from "../lib/account-client";
import {Sharing} from "./sharing";
import {Invites} from "./invites";
import {InviteGuest} from "./invite-guest";
import {parseInviteToken} from "../lib/invite-client";
import {createStorySaver,hasStoryContent,type SavedStory,type SaveStatus} from '../lib/story-saver';
import {saveCopy} from '../lib/save-copy';
import {freeStoryLimitReached,type BillingStatus} from '../lib/billing';
import {checkoutReturnId,confirmCheckout} from '../lib/billing-client';
import {paywallCopy} from '../lib/paywall-copy';
import {sharingCopy} from "../lib/sharing-copy";
import {shareGroupsCopy} from "../lib/share-groups-copy";
import {PhotoStory} from './photo-story';
import {photoCopy} from '../lib/photo-copy';
import {flowCopy} from '../lib/flow-copy';
import {ArtworkPicker} from './artwork-picker';
import {artworkPath,artworkCopy,chosenArtwork,artworkCaption,artworkAlt} from '../lib/artwork';
import {DRAFT_PREFIX,GUEST_DRAFT_KEY,accountDraftKey,readDraft,writeChangedDraft,prepareGuestHandoff,prepareGoogleHandoff,resumeGuestHandoff,restoreAccountDraft,type DraftSnapshot} from '../lib/draft-handoff';
import {tellStageActions,mobileActionCopy} from '../lib/mobile-actions';
import {MobileActionBar} from './mobile-action-bar';

type InterviewMode = "type" | "dictate" | "voice";
type Stage = "home" | "tell" | "discover" | "paper";
const copy = {
 en: { tell: "Your story", discover: "A little discovery", paper: "Your newspaper", start: "Start my story", sample: "Explore a sample", name: "What should we call you?", optional: "Your first name (optional)", question: "Take your time. The little details matter.", placeholder: "Start anywhere. A place, a person, a moment…", send: "Save & continue", record: "Tell it out loud", stop: "Finish recording", listen: "Hear the question", skip: "Ask something else", discovery: "Find a connection", create: "Make my newspaper", saved: "Saved on this device", own: "In your own words", back: "Back to my story", photo: "Add a photograph", continue: "Continue my story", fresh: "Start a new story", edit: "Edit my newspaper", print: "Print / save PDF", done: "Done editing", include: "Include in my newspaper", familiar: "Looks familiar", unsure: "Not sure", unfamiliar: "Not my memory", prompt: "Tell me more about this", no: "Continue without history", review: "I’ve read this and it feels true to my story.", your: "A story by", context: "The world around your story" },
 zh: { tell: "你的故事", discover: "一点新发现", paper: "你的报纸", start: "开始讲故事", sample: "看看示例", name: "我们怎么称呼你？", optional: "你的名字（选填）", question: "慢慢来，小细节也很珍贵。", placeholder: "从哪里开始都可以。一个地方，一个人，一个瞬间……", send: "保存并继续", record: "说出你的故事", stop: "结束录音", listen: "听这个问题", skip: "换个问题", discovery: "寻找历史线索", create: "制作我的报纸", saved: "已保存在此设备", own: "你的原话", back: "回到我的故事", photo: "添加照片", continue: "继续我的故事", fresh: "开始新故事", edit: "编辑报纸", print: "打印 / 保存 PDF", done: "完成编辑", include: "加入我的报纸", familiar: "看着很熟悉", unsure: "不确定", unfamiliar: "与我无关", prompt: "聊聊这个发现", no: "不添加历史背景", review: "我已读过，这符合我的故事。", your: "讲述者", context: "故事发生时的世界" },
 es: { tell: "Tu historia", discover: "Un descubrimiento", paper: "Tu periódico", start: "Empezar mi historia", sample: "Ver un ejemplo", name: "¿Cómo te llamas?", optional: "Tu nombre (opcional)", question: "Tómate tu tiempo. Los pequeños detalles importan.", placeholder: "Empieza por un lugar, una persona, un momento…", send: "Guardar y continuar", record: "Cuéntalo en voz alta", stop: "Terminar grabación", listen: "Escuchar la pregunta", skip: "Otra pregunta", discovery: "Buscar una conexión", create: "Crear mi periódico", saved: "Guardado en este dispositivo", own: "Con tus palabras", back: "Volver a mi historia", photo: "Añadir una fotografía", continue: "Continuar mi historia", fresh: "Empezar otra historia", edit: "Editar mi periódico", print: "Imprimir / guardar PDF", done: "Terminar edición", include: "Incluir en mi periódico", familiar: "Me resulta familiar", unsure: "No sé", unfamiliar: "No es mi recuerdo", prompt: "Contar más sobre esto", no: "Continuar sin contexto", review: "Lo he leído y refleja mi historia.", your: "Una historia de", context: "El mundo de tu historia" }
};

const STORAGE = DRAFT_PREFIX;
function download(name: string, data: string, type = "text/plain") { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 500); }
async function callApi(action: string, story?: Story, audio?: { data: string; mime: string }, signal?: AbortSignal, photoSearch?: {query:string;approved:true}, researchSearch?: {query:string;approved:true},imageStyle?:'illustration'|'comic',extra?:Record<string,unknown>) { const res = await fetch("/api/story", { method: "POST", headers: { "Content-Type": "application/json", ...await accountHeaders() }, body: JSON.stringify({ action, story: story ? { ...story, generatedArt:undefined,photo: action==='photo'?story.photo:undefined } : undefined, audio, ...(action==='photo'?{photoConsent:true}:{}), photoSearch, researchSearch, imageStyle, ...extra }), signal }); const data = await res.json(); if (!res.ok) throw Object.assign(new Error(data.error || "That didn’t finish. Please try again."),{code:data.code}); return data; }

function StoryApp() {
 const [account,setAccount]=useState<AccountConfig|null>(null);
 const [problem,setProblem]=useState('');
 const flushDraft=useRef<()=>void>(()=>{});
 useEffect(()=>{let active=true,dispose=()=>{};void setupAccount(user=>{if(active){flushDraft.current();setAccount(c=>c?{...c,user}:c);}}).then(result=>{dispose=result.dispose;if(active)setAccount(result.config);else dispose();}).catch(e=>setProblem(e.message));return()=>{active=false;dispose();};},[]);
 if(!account)return <main className="account-loading"><h1>Once &amp; Ours</h1><p role="status">{problem||'Opening your story studio…'}</p>{problem&&<button className="secondary" onClick={()=>location.reload()}>Try again</button>}</main>;
 return <Storypress key={account.user?.id||'guest'} account={account} flushDraft={flushDraft} patchBilling={billing=>setAccount(c=>c?{...c,billing}:c)}/>;
}
function Storypress({account,flushDraft,patchBilling}:{account:AccountConfig;flushDraft:MutableRefObject<()=>void>;patchBilling:(billing:BillingStatus)=>void}) {
 const [storageKey,setStorageKey]=useState(account.user?accountDraftKey(account.user.id):GUEST_DRAFT_KEY);
 const [resumedDraft,setResumedDraft]=useState(false);
 const [earlierDraft,setEarlierDraft]=useState(false);
 const [saved,setSaved]=useState<SavedStory|null>(null);
 const [cloudStatus,setCloudStatus]=useState<SaveStatus>('idle');
 const [cloudError,setCloudError]=useState('');
 const [cloudErrorCode,setCloudErrorCode]=useState<string|undefined>();
 const [checkoutNotice,setCheckoutNotice]=useState<'pending'|'confirmed'|''>('');
 const [switching,setSwitching]=useState(false);
 const [showAccount,setShowAccount]=useState(false);
 const [story, setStory] = useState<Story>(()=>({...initialStory,language:sharedEntryLanguage(location.search)||initialStory.language}));
 const [showSample,setShowSample]=useState(false);
 const [sampleFormat,setSampleFormat]=useState<KeepsakeFormat>("newspaper");
 const [setupIntention,setSetupIntention]=useState<Story["intention"]>();
 const [setupPresentation,setSetupPresentation]=useState<Story["presentation"]>();
 const [setupName,setSetupName]=useState(initialStory.name);
 const [setupOccasion,setSetupOccasion]=useState<Story["occasion"]>(initialStory.occasion);
 const [stage, setStage] = useState<Stage>("home");
 const [ready, setReady] = useState(false);
 const [input, setInput] = useState("");
 const pendingTranslation=useRef<{key:string;result:TranslationResult}|null>(null);
 const pendingTranscript=useRef<{key:string;texts:string[]}|null>(null);
 const [translating,setTranslating]=useState(false);
 const [busy, setBusy] = useState("");
 const [streamingQuestion,setStreamingQuestion]=useState('');
 const interviewRequest=useRef<AbortController|null>(null);
 // Quick conversational turns observed in live voice; the server tightens its
 // end-of-speech window after two consecutive brisk turns and only the server
 // sets the bounds.
 const pacing=useRef(0);
 const [error, setError] = useState("");
 const [editing, setEditing] = useState(false);
 const [searched, setSearched] = useState(false);
 const [researching,setResearching]=useState(false);
 const researchRequest=useRef<AbortController|null>(null);
 const storyGeneration=useRef(0);
 function cancelResearch(){storyGeneration.current++;researchRequest.current?.abort();researchRequest.current=null;setResearching(false);}
 const [readyToWrite,setReadyToWrite]=useState(false);
 const [services, setServices] = useState<{gemini:boolean;nimble:boolean;geminiBackend:string;liveVoice:boolean;video?:{enabled:boolean};socialCredit:{url:string}}>({ gemini: false, nimble: false, geminiBackend: "ai-studio", liveVoice:false, video:{enabled:false}, socialCredit:{url:""} });
 const [mode, setMode] = useState<InterviewMode>("type");
 const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
 const [elapsed, setElapsed] = useState(0);
 const [voicePaused, setVoicePaused] = useState(false);
 const [reviewVoice, setReviewVoice] = useState(false);
 const [reviewing, setReviewing] = useState(false);
 const [showText, setShowText] = useState(false);
 const [correcting, setCorrecting] = useState(false);
 const [correction, setCorrection] = useState("");
 const [liveActive,setLiveActive]=useState(false);
 const recording = voicePhase === "recording";
 const voiceBusy = ["starting", "recording", "transcribing"].includes(voicePhase);
 const interactionBusy = !!busy || voiceBusy || switching || liveActive;
 const [showSetup, setShowSetup] = useState(false);
 const [pendingRecordings,setPendingRecordings]=useState<SavedRecording[]>([]);
 function captureRecording(blob:Blob,collectionId?:string){const collection=collectionId||latest.current.story.recordingCollectionId;if(!collection)return;setPendingRecordings(rows=>[...rows,{id:crypto.randomUUID(),owner:account.user?.id||"guest",collection,createdAt:Date.now(),blob}]);}
 const [showOriginal, setShowOriginal] = useState(false);
 const [saveError, setSaveError] = useState(false);
 const voice = useRef<ReturnType<typeof createVoiceSession> | null>(null);
 const latest = useRef({ mode, voicePaused, reviewVoice, story, input, stage });
 latest.current = { mode, voicePaused, reviewVoice, story, input, stage };
 // Network-level failures (offline, refused connection) have no server copy:
 // speak the story's language and reassure the narrator their words are kept.
 function problemText(problem: unknown): string { return interviewProblemText(problem, latest.current.story.language); }
 const requestId = useRef(0);
 const submitting = useRef(false);
 const sendRef = useRef<(text: string) => Promise<void>>(async () => {});
 const file = useRef<HTMLInputElement>(null);
 const textArea = useRef<HTMLTextAreaElement>(null);
 const question = streamingQuestion || [...story.turns].reverse().find(t => t.role === "assistant")?.text || openingQuestion(story);
 const k=keepsakeCopy[story.language];
 const c = {...copy[story.language],create:k.create,edit:k.edit,paper:({en:"Your keepsake",zh:"你的纪念作品",es:"Tu recuerdo"}[story.language])};
 const v = interviewCopy[story.language];
 const d = presentation[story.language];
 const g = shareGroupsCopy[story.language];
 const p = photoCopy[story.language];
 const f = flowCopy[story.language];
 const sc=saveCopy[story.language];
 const sample = sampleEditions[story.language];
 const words = originalWords(story);
 const wordCount = words.join(" ").split(/\s+/).filter(Boolean).length;
 const patch = (value: Partial<Story>) => setStory(s => ({ ...s, ...value }));
 const draftState=useRef({story,input,saved,stage,mode,ready,storageKey});
 const lastWrittenDraft=useRef<string|null>(null);
 draftState.current={story,input,saved,stage,mode,ready,storageKey};
 function currentDraft():DraftSnapshot{const current=draftState.current;return {story:{...current.story,draft:current.input},saved:current.saved,stage:current.stage,mode:current.mode};}
 const saver=useRef<ReturnType<typeof createStorySaver>|null>(null);
 if(account.user&&!saver.current)saver.current=createStorySaver({save:(next,identity,derivative)=>accountRequest({action:'save',id:identity?.id,revision:identity?.revision,story:next,derivative}),changeSharing:(action,identity)=>accountRequest({action,id:identity.id,revision:identity.revision}),remove:async id=>{await accountRequest({action:'delete',id});},onSaved:identity=>{draftState.current.saved=identity;setSaved(identity);},onStatus:(status,problem,code)=>{setCloudStatus(status);setCloudErrorCode(code);setCloudError(problem||'');}});
 async function saveCurrent(){persistDraft();if(!saver.current)return null;saver.current.update(currentDraft().story);return saver.current.flush();}
 async function saveSeparate(){persistDraft();if(!saver.current)return;setSwitching(true);try{saver.current.update(currentDraft().story);await saver.current.saveAsNew();setError('');}finally{setSwitching(false);}}
 async function changeSharing(action:'share'|'private'){await saveCurrent();return saver.current!.changeSharing(action);}
 async function openAccount(){voice.current?.cancel();try{if(account.user){setSwitching(true);await saveCurrent();}else persistDraft();setShowAccount(true);}catch(problem){setError((problem as Error).message);setShowAccount(true);}finally{setSwitching(false);}}
 async function loadStory(next:Story,identity:SavedStory|null=null){cancelResearch();setSwitching(true);try{if(saver.current)await saver.current.switchTo(next,identity,!!identity);setStory(next);setInput(next.draft||'');setSaved(identity);setReadyToWrite(false);setSearched(false);setResumedDraft(false);navigate(next.paper?'paper':'tell');}finally{setSwitching(false);}}
 async function deleteStory(id:string){const wasCurrent=await saver.current?.remove(id);if(wasCurrent){const next={...initialStory,name:story.name,language:story.language,occasion:story.occasion};saver.current?.replace(next,null);setStory(next);setInput('');setSaved(null);setStage('home');}}
 async function flushThenNavigate(next:Stage){try{if(account.user)await saveCurrent();navigate(next);}catch(problem){setError((problem as Error).message);}}
 function persistDraft(){if(!draftState.current.ready)return;try{lastWrittenDraft.current=writeChangedDraft(localStorage,draftState.current.storageKey,currentDraft(),lastWrittenDraft.current,account.user?.id);setSaveError(false);}catch{setSaveError(true);}}
 useEffect(()=>{const flush=()=>persistDraft();flushDraft.current=flush;window.addEventListener('pagehide',flush);return()=>{window.removeEventListener('pagehide',flush);if(flushDraft.current===flush)flushDraft.current=()=>{};};},[flushDraft]);
 useEffect(() => {
  try{
   const loaded=account.user?resumeGuestHandoff(localStorage,account.user,Date.now(),sessionStorage):{key:GUEST_DRAFT_KEY,snapshot:readDraft(localStorage,GUEST_DRAFT_KEY)||(!account.supabase?readDraft(localStorage,STORAGE):null),resumed:false,failed:false};
   setStorageKey(loaded.key);setSaveError(loaded.failed);
   if(account.user)saver.current?.replace(loaded.snapshot?.story||initialStory,loaded.snapshot?.saved||null);
   if(loaded.snapshot){setStory(loaded.snapshot.story);setInput(loaded.snapshot.story.draft||'');setSaved(loaded.snapshot.saved);}
   if(loaded.resumed&&loaded.snapshot){const resumeStage=loaded.snapshot.stage||'tell';setStage(resumeStage==='paper'&&!loaded.snapshot.story.paper?'tell':resumeStage==='home'?'tell':resumeStage);setMode(loaded.snapshot.mode||'type');setVoicePaused(true);setResumedDraft(true);}
   if(!loaded.failed){const snapshot=loaded.snapshot;const resumeStage=snapshot?.stage||'tell';lastWrittenDraft.current=JSON.stringify({story:{...(snapshot?.story||initialStory),draft:snapshot?.story.draft||''},saved:snapshot?.saved||null,stage:loaded.resumed?(resumeStage==='paper'&&!snapshot?.story.paper?'tell':resumeStage==='home'?'tell':resumeStage):'home',mode:loaded.resumed?snapshot?.mode||'type':'type'});}
   if(account.user)setEarlierDraft(loaded.key!==accountDraftKey(account.user.id)&&!!readDraft(localStorage,accountDraftKey(account.user.id)));
  }catch{setSaveError(true);}
  setReady(true);void accountHeaders().then(headers=>fetch('/api/story',{headers})).then(r=>r.json()).then(data=>{setServices(data);if(data.liveVoice)setMode('voice');}).catch(()=>{});
 }, []);
 useEffect(() => {persistDraft();}, [story,input,saved,stage,mode,ready,storageKey]);
 // Post-checkout return (paywall §5): the return URL mirrors the email
 // sign-in return, carrying Stripe's session id. The boot fetch already
 // refreshed /api/account; when the entitlement is still pending there, the
 // session is verified server-side (action:'status') before anything is
 // shown — webhook lag must never read as a payment failure. A stale read
 // or an unknown visitor shows the calm pending notice; nothing says failed.
 useEffect(()=>{
  const sessionId=checkoutReturnId(location.search);
  if(!sessionId)return;
  const params=new URLSearchParams(location.search);params.delete('billing_checkout');
  const rest=params.toString();
  history.replaceState(null,'',`${location.pathname}${rest?`?${rest}`:''}${location.hash}`);
  if(!account.user){setCheckoutNotice('pending');return;}
  confirmCheckout(sessionId).then(billing=>{
   if(billing.plan==='free'){setCheckoutNotice('pending');return;}
   patchBilling(billing);setCheckoutNotice('confirmed');
  }).catch(()=>setCheckoutNotice('pending'));
 },[]);
 useEffect(()=>{if(!ready||!saver.current)return;saver.current.update({...story,draft:input});const timer=setTimeout(()=>{void saver.current?.flush().catch(()=>{});},700);return()=>clearTimeout(timer);},[story,input,ready]);
 useEffect(()=>()=>saver.current?.dispose(),[]);
 function prepareSignIn(email?:string){try{return email===undefined?prepareGoogleHandoff(localStorage,sessionStorage,currentDraft()):prepareGuestHandoff(localStorage,email,currentDraft());}catch{setSaveError(true);throw new Error(sharingCopy[story.language].handoffFailure);}}
 async function restoreEarlierDraft(){if(!account.user)return;cancelResearch();setSwitching(true);try{await saveCurrent();const previous=restoreAccountDraft(localStorage,account.user.id);if(!previous)return;saver.current?.replace(previous.story,previous.saved);setStorageKey(accountDraftKey(account.user.id));setStory(previous.story);setInput(previous.story.draft||'');setSaved(previous.saved);setStage(previous.story.paper?'paper':'tell');setEarlierDraft(false);setResumedDraft(false);setShowAccount(false);}catch(problem){setError((problem as Error).message);}finally{setSwitching(false);}}
 useEffect(()=>{setSetupName(story.name);setSetupOccasion(story.occasion);setSetupIntention(story.intention);setSetupPresentation(story.presentation);},[story.name,story.occasion,story.intention,story.presentation]);
 useEffect(()=>{if(ready&&stage!=='home'&&!story.recordingCollectionId)patch({recordingCollectionId:crypto.randomUUID()});},[ready,stage,story.recordingCollectionId]);
 useEffect(() => { document.documentElement.lang = story.language; }, [story.language]);
 useEffect(() => {
  voice.current = createVoiceSession({
   phase: setVoicePhase, elapsed: setElapsed,
   problem: problem => {
    const labels = interviewCopy[latest.current.story.language];
    const key = { unsupported: "unsupported", microphone: "microphone", speech: "speech", empty: "emptyAudio", tooLarge: "tooLarge", recording: "recordError" } as const;
    setError(problem instanceof Error ? problem.message : labels[key[problem]]);
   },
   clip: captureRecording,
   transcribe: async (blob, signal) => {
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    try { return (await callApi("transcribe", undefined, { data, mime: blob.type.split(";")[0] }, signal)).transcript; }
    catch (error) { if (networkFailure(error)) throw new Error(flowCopy[latest.current.story.language].offlineRecord); throw error; }
   },
   transcript: text => {
    const current = latest.current;
    const draft = [current.input, text].filter(Boolean).join("\n");
    setInput(draft); setStory(s => ({ ...s, draft }));
    if (current.mode === "voice" && !current.reviewVoice && !current.voicePaused) void sendRef.current(draft);
    else { setReviewing(true); setShowText(true); }
   },
  });
  const leave = () => { voice.current?.cancel(); setVoicePaused(true); };
  const hidden = () => { if (document.hidden) leave(); };
  document.addEventListener("visibilitychange", hidden); window.addEventListener("pagehide", leave);
  return () => { interviewRequest.current?.abort(); researchRequest.current?.abort(); voice.current?.cancel(); requestId.current++; document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", leave); };
 }, []);
 function navigate(next: Stage) { voice.current?.cancel(); if (next !== "tell") setVoicePaused(true); setStage(next); setError(""); setEditing(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
 function changeMode(next: InterviewMode) { voice.current?.cancel(); setMode(next); setError(""); setVoicePaused(false); setShowText(false); if (!services.liveVoice && next === "voice" && stage === "tell") voice.current?.speak(question, story.language); }
 async function begin(preview = false) {
  let next=story;
  if(preview){setShowSample(true);return;}
  if(story.sample){
   // Preserve anything the narrator typed into an older demo, excluding its fictional seed.
   const ownTurns=story.turns.filter(t=>t.role==='user').slice(1);
   next={...initialStory,language:story.language,name:story.name===sample.name?'':story.name,turns:ownTurns,draft:input,photo:story.photo,photoCaption:story.photoCaption,artwork:story.photo?'memories':'none'};saver.current?.replace(next,null);setSaved(null);
  }
  if(!next.turns.length)next={...next,turns:[{role:'assistant',text:openingQuestion(next)}]};
  setStory(next);setReadyToWrite(false);setSearched(false);navigate('tell');setVoicePaused(false);
  if(mode==='voice'&&!services.liveVoice)voice.current?.speak([...next.turns].reverse().find(t=>t.role==='assistant')?.text||openingQuestion(next),next.language);
 }
 function canUseAi(){if(account.sampleOnly){setShowSample(true);return false;}if(story.sample){setError(f.sample);return false;}if(account.supabase&&!account.user){setShowAccount(true);setError(f.signin);return false;}return true;}
 async function nextQuestion(next:Story){
  if(next.sample)throw new Error(flowCopy[next.language].sample);
  interviewRequest.current?.abort();const controller=new AbortController();interviewRequest.current=controller;setStreamingQuestion('');
  let spoken='';
  try{
   const response=await fetch('/api/story',{method:'POST',headers:{'Content-Type':'application/json',...await accountHeaders()},body:JSON.stringify({action:'interview',stream:true,story:{...next,photo:undefined,generatedArt:undefined}}),signal:controller.signal});
   const result=await readInterviewResponse(response,text=>{
    if(controller.signal.aborted)return;
    setStreamingQuestion(text);
    // Streamed speech: completed question sentences are spoken as they
    // arrive; the remaining tail and acknowledgement speak once the full
    // reply is validated. Only the validated result is returned and stored.
    if(!(latest.current.mode==='voice'&&!services.liveVoice&&!latest.current.voicePaused&&latest.current.stage==='tell'))return;
    const fresh=text.slice(spoken.length),take=spokenSentencesLength(fresh);
    if(take>0){const sentence=fresh.slice(0,take);spoken+=sentence;voice.current?.queueSpeak(sentence,next.language);}
   });
   if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
   setReadyToWrite(result.readyToWrite===true);
   const suggestion=result.readyToWrite?null:result.researchSuggestion||null;
   const text=[result.acknowledgement,result.question].filter(Boolean).join(' ');
   if(latest.current.mode==='voice'&&!services.liveVoice&&!latest.current.voicePaused&&latest.current.stage==='tell'){
    if(!spoken)voice.current?.speak(text,next.language);
    else if(result.question.startsWith(spoken))voice.current?.queueSpeak([result.question.slice(spoken.length),result.acknowledgement].filter(Boolean).join(' ').trim(),next.language);
    else{voice.current?.cancel();voice.current?.speak(text,next.language);}
   }
   return {text,researchSuggestion:suggestion,researchQueries:[...new Set([...(next.researchQueries||[]),...(suggestion?[suggestion.query]:[])])].slice(-60)};
  }finally{if(interviewRequest.current===controller){interviewRequest.current=null;setStreamingQuestion('');}}
 }
 async function send(value = input.trim()) {
  if (!value.trim() || submitting.current || !canUseAi()) return;
  const current = latest.current.story;
  if (current.turns.length > 57) { setError(v.maxTurns); return; }
  submitting.current = true; voice.current?.cancel();
  const id = ++requestId.current;
  const next: Story = { ...current, draft: "", approved: false, paper: undefined, turns: [...current.turns, { role: "user", text: value.trim() }] };
  setStory(next); setInput(""); setReviewing(false); setShowText(false); setBusy(v.thinking); setError("");
  try { const q = await nextQuestion(next); if (id !== requestId.current) return; setStory(s=>({ ...s, researchSuggestion:q.researchSuggestion,researchQueries:[...new Set([...(s.researchQueries||[]),...q.researchQueries])].slice(-60), turns: [...next.turns, { role: "assistant", text: q.text }] })); }
  catch(e) { if (id === requestId.current) setError(problemText(e)); }
  finally { if (id === requestId.current) { setBusy(""); submitting.current = false; } }
 }
 sendRef.current = send;
 async function retryInterview(){
  if(interactionBusy||correcting||!canUseAi())return;
  const current=latest.current.story;if(current.turns.length>58){setError(v.maxTurns);return;}
  setBusy(v.thinking);setError('');
  try{const q=await nextQuestion(current);setStory(s=>({...s,researchSuggestion:q.researchSuggestion,researchQueries:q.researchQueries,turns:[...current.turns,{role:'assistant',text:q.text}]}));}
  catch(e){setError(problemText(e));}finally{setBusy('');}
 }
 async function skip() {
  if (interactionBusy || correcting || !canUseAi()) return;
  if (story.turns.length > 57) { setError(v.maxTurns); return; }
  voice.current?.cancel(); setBusy(v.alternate); setError("");
  try { const q=await nextQuestion({...story,turns:[...story.turns,{role:'user',text:'Please ask about a different, unanswered aspect of my story. I want to keep talking.'}]});patch({researchSuggestion:q.researchSuggestion,researchQueries:q.researchQueries,turns:[...story.turns,{role:'assistant',text:q.text}]}); }
  catch(e) { setError(problemText(e)); } finally { setBusy(""); }
 }
 function listen() { setError(""); if (voicePhase === "speaking") voice.current?.cancel(); else voice.current?.speak(question, story.language); }
 function pauseVoice() { voice.current?.cancel(); setVoicePaused(true); }
 function resumeVoice() { setVoicePaused(false); setError(""); voice.current?.speak(question, story.language); }
 function record() {
  setError(""); if (recording) { voice.current?.finish(); return; }
  if (!canUseAi()) return;
  if (!services.gemini) { setError(v.notConnected); setShowText(true); return; }
  if (input.trim() && mode === "voice") { setError(v.draftFirst); setShowText(true); return; }
  setVoicePaused(false); void voice.current?.record();
 }
 function editLastWords() { voice.current?.cancel(); setCorrecting(true); setCorrection(words.at(-1) || ""); }
 async function saveCorrection() {
  cancelResearch();
  if (!correction.trim() || interactionBusy) return;
  voice.current?.cancel();
  let index = story.turns.length - 1; while (index >= 0 && story.turns[index].role !== "user") index--;
  if (index < 0) return;
  const next: Story = { ...story, paper: undefined, approved: false, turns: story.turns.slice(0, index + 1).map((t, i) => i === index ? { ...t, text: correction.trim() } : t) };
  setStory(next); setCorrecting(false); setBusy(v.thinking); setError("");
  try { const q = await nextQuestion(next); setStory(s=>({ ...s, researchSuggestion:q.researchSuggestion,researchQueries:[...new Set([...(s.researchQueries||[]),...q.researchQueries])].slice(-60), turns: [...next.turns, { role: "assistant", text: q.text }] })); }
  catch(e) { setError(problemText(e)); } finally { setBusy(""); }
 }
 function modePicker() { return <div className="interview-modes" role="group" aria-label={v.chooseMode}>{(services.liveVoice?(["voice", "type", "dictate"] as const):(["type", "dictate", "voice"] as const)).map(m => <button key={m} type="button" aria-pressed={mode === m} disabled={interactionBusy || correcting} onClick={() => changeMode(m)}>{m === "type" ? <Pencil size={18}/> : m === "dictate" ? <Mic size={18}/> : <Volume2 size={18}/>}<span>{m==='voice'&&services.liveVoice?({en:"Talk live",zh:"实时对话",es:"Hablar en directo"}[story.language]):v[m]}</span></button>)}</div>; }
 function choosePhoto(){if(interactionBusy||correcting)return;voice.current?.cancel();file.current?.click();}
 async function addPhoto(photo: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(photo.type)) { setError(p.format); return; }
  if (photo.size > 12000000) { setError(p.size); return; }
  voice.current?.cancel();const id=++requestId.current;setBusy(p.preparing);setError('');
  const url=URL.createObjectURL(photo);
  try{
   const image=new window.Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error(p.invalid));image.src=url;});
   if(id!==requestId.current)return;
   if(!image.width||!image.height||image.width*image.height>50000000)throw new Error(p.large);
   const canvas=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(image.width,image.height));
   canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const ctx=canvas.getContext('2d');if(!ctx)throw new Error(p.invalid);
   ctx.drawImage(image,0,0,canvas.width,canvas.height);
   // Re-encoding keeps pixels only, discarding EXIF location and original file metadata.
   const data=canvas.toDataURL('image/jpeg',.82);if(data.length>1800000)throw new Error(p.large);
   patch({photo:data,photoCaption:undefined,photoAnalysis:undefined,artwork:'memories',approved:false});
  }catch(e){if(id===requestId.current)setError((e as Error).message);}finally{URL.revokeObjectURL(url);if(id===requestId.current)setBusy('');}
 }
 async function photoQuestion(corrections?:PhotoAnalysis){
  if(interactionBusy||correcting||story.sample)return;
  if(!account.user){setShowAccount(true);return;}
  if(story.turns.length>57){setError(v.maxTurns);return;}
  voice.current?.cancel();const id=++requestId.current;const current=story;setBusy(p.analysing);setError('');
  try{
   let analysis=corrections,question:string,research:Partial<Story>={};
   if(analysis){patch({photoAnalysis:analysis});const result=await nextQuestion({...current,photoAnalysis:analysis});question=result.text;research={researchSuggestion:result.researchSuggestion,researchQueries:result.researchQueries};}
   else{analysis=(await callApi('photo',current)).analysis;question=analysis!.question;}
   if(id!==requestId.current)return;
   setStory({...current,...research,photoAnalysis:analysis,turns:[...current.turns,{role:'assistant',text:question}]});
  }catch(e){if(id===requestId.current)setError(problemText(e));}finally{if(id===requestId.current)setBusy('');}
 }
 async function discover(photoQuery?:string,inlineQuery?:string) {
  if(researching||correcting||(!story.sample&&!canUseAi()))return;
  const base=latest.current.story,generation=storyGeneration.current;
  const controller=new AbortController();researchRequest.current=controller;
  setResearching(true);setError('');
  try {
   if(base.sample)setStory(s=>({...s,sources:s.sources.length?s.sources:[{...sample.source}]}));
   else{
    const result=await callApi('discover',base,undefined,controller.signal,photoQuery?{query:photoQuery,approved:true}:undefined,inlineQuery?{query:inlineQuery,approved:true}:undefined);
    if(controller.signal.aborted||generation!==storyGeneration.current)return;
    setStory(current=>mergeResearch(current,base,result.sources,result.query));
   }
   if(generation===storyGeneration.current)setSearched(true);
  }catch(e){if(!controller.signal.aborted&&generation===storyGeneration.current)setError(problemText(e));}
  finally{if(researchRequest.current===controller){researchRequest.current=null;setResearching(false);}}
 }

 function updateSource(id: string, value: Partial<Source>) { patch({ sources: story.sources.map(s => s.id === id ? { ...s, ...value } : s), approved: false }); }
 function exploreSource(source: Source) { if(story.turns.length>57){setError(v.maxTurns);return;}patch({ turns: [...story.turns, { role: "assistant", text: source.question }] }); navigate("tell"); }
 async function makePaper() {
  if(interactionBusy||(!words.length&&!input.trim())||(!story.sample&&!canUseAi()))return;
  const next:Story=input.trim()?{...story,turns:[...story.turns,{role:'user',text:input.trim()}],draft:'',approved:false}:story;
  if(next.turns.length>60){setError(v.maxTurns);return;}
  voice.current?.cancel();setStory(next);setInput('');setBusy(d.making);setError('');
  try{const paper=next.sample?{...sample.paper,paragraphs:[...sample.paper.paragraphs,...originalWords(next).slice(1)]}:(await callApi('write',next)).paper;patch({paper,paperLanguage:next.language,translation:undefined,approved:false});navigate('paper');}
  catch(e){setError(problemText(e));}finally{setBusy('');}
 }

 async function translateKeepsake(target:Story['language']){
  if(interactionBusy||editing||!story.paper||story.sample||!saver.current)return;
  const current={...story,draft:input},labels=translationCopy[story.language];
  const payload=translationInput(current,target),key=JSON.stringify(payload);
  setTranslating(true);setBusy(labels.working);setError('');cancelResearch();
  try{
   const original=await saveCurrent();
   if(pendingTranslation.current?.key!==key){
    const response=await fetch('/api/story',{method:'POST',headers:{'Content-Type':'application/json',...await accountHeaders()},body:JSON.stringify({action:'translate',translation:payload})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||labels.failed);
    pendingTranslation.current={key,result:data.translation};
   }
   const next=translatedStory(current,target,pendingTranslation.current.result,original?.id);
   let identity:SavedStory;try{identity=await saver.current.saveCopy(next);}catch{throw new Error(labels.retry);}
   setStory(next);setInput('');setSaved(identity);setEditing(false);setResumedDraft(false);setReadyToWrite(false);setSearched(false);pendingTranslation.current=null;navigate('paper');
  }finally{setBusy('');setTranslating(false);}
 }
 // The transcript target attaches translated turns to THIS story; translated keepsakes stay separate stories.
 async function translateTranscript(target:Story['language']){
  if(interactionBusy||editing||story.sample||!saver.current)return;
  const labels=translationCopy[story.language];
  setTranslating(true);setBusy(labels.working);setError('');
  try{
   await saveCurrent();
   const payload=transcriptInput(story,target),key=JSON.stringify(payload);
   if(pendingTranscript.current?.key!==key){
    const response=await fetch('/api/story',{method:'POST',headers:{'Content-Type':'application/json',...await accountHeaders()},body:JSON.stringify({action:'translate-transcript',transcript:payload})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||labels.failed);
    pendingTranscript.current={key,texts:data.turns};
   }
   patch(applyTranscriptTranslation(story,target,pendingTranscript.current!.texts));
  }catch(e){if((e as Error).message)setError((e as Error).message);}finally{setBusy('');setTranslating(false);}
 }
 async function generateArtwork(style:'illustration'|'comic'){
  if(interactionBusy||editing||!canUseAi())return;
  voice.current?.cancel();const id=++requestId.current,current=story;
  const available=Math.min(300000,2180000-new TextEncoder().encode(JSON.stringify({...current,generatedArt:undefined})).length);
  if(available<50000){setError('This story has too much photo or text data to add artwork. Your existing story is kept.');return;}
  setBusy({en:'Drawing your story…',zh:'正在绘制你的故事……',es:'Ilustrando tu historia…'}[story.language]);setError('');
  try{
   const {image}=await callApi('illustrate',current,undefined,undefined,undefined,undefined,style);
   const data=await compactImage(image.data,available);
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({words:originalWords(current),instructions:current.artInstructions||'',style})));
   const sourceKey=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   if(id!==requestId.current)return;
   patch({generatedArt:{data,style,model:image.model,sourceKey},artwork:'generated',approved:false});
  }catch(e){if(id===requestId.current)setError(problemText(e));}finally{if(id===requestId.current)setBusy('');}
 }
 function exportOriginal() { download("storypress-original-words.txt", story.turns.map(t => `${t.role === "user" ? story.name || "Storyteller" : "Interviewer"}: ${t.text}`).join("\n\n")); }
 function editPaper(value: Partial<Paper>) { if (story.paper) patch({ paper: { ...story.paper, ...value }, approved: false }); }
 // The limit state (paywall §5): the client's copy of what the reserve RPC
 // would decide — always false while billing is dormant.
 const limitReached=freeStoryLimitReached(account.billing);
 // A metered-save refusal is localized (paywall §2, the autosave trap): the
 // code from the API picks the copy, so the autosave error is legible instead
 // of the server's English text. Other failures keep the server message.
 const saveErrorText=cloudErrorCode==='story_limit'?{
  en:`You have used all ${account.billing.freeStoryLimit} free stories. Your draft is kept on this device — upgrade in My stories to keep telling new stories.`,
  zh:`你已经用完 ${account.billing.freeStoryLimit} 个免费故事。草稿保留在此设备上——在“我的故事”中升级后可以继续创作新故事。`,
  es:`Has usado tus ${account.billing.freeStoryLimit} historias gratis. El borrador se guarda en este dispositivo: mejora tu plan en Mis historias para seguir creando historias nuevas.`
 }[story.language]:cloudError;
 async function startFresh(withPhoto=false,prompt?:string){if(account.sampleOnly){setShowSample(true);return;}if(freeStoryLimitReached(account.billing)){setShowAccount(true);return;}if(pendingRecordings.length){setError({en:'Choose whether to keep or discard your recordings before starting another story.',zh:'开始新故事前，请先选择保留或删除录音。',es:'Elige si conservar o descartar las grabaciones antes de empezar otra historia.'}[story.language]);return;}cancelResearch();if(interactionBusy||correcting)return;if(!account.user&&hasStoryContent(currentDraft().story)){persistDraft();setError(sc.guestNew);setShowAccount(true);return;}setSwitching(true);try{if(account.user)await saveCurrent();const next:Story={...initialStory,name:story.sample&&setupName===story.name?'':setupName,language:story.language,occasion:setupOccasion,intention:setupIntention,presentation:setupPresentation,turns:[{role:'assistant',text:prompt||openingQuestion({language:story.language,occasion:setupOccasion,intention:setupIntention})}]};saver.current?.replace(next,null);setSaved(null);setStory(next);setInput('');setReviewing(false);setCorrecting(false);setReadyToWrite(false);setSearched(false);setResumedDraft(false);setShowAccount(false);navigate('tell');if(withPhoto)choosePhoto();}catch(problem){setError((problem as Error).message);}finally{setSwitching(false);}}
 // Second mobile control surface (≤800 px): the tell stage's primary action and skip,
 // pinned to the bottom edge. Composition logic lives in lib/mobile-actions.ts.
 const mobileActions = tellStageActions({
  canFinish: (words.length > 0 || !!input.trim()) && !story.sample,
  canSend: !!input.trim(),
  isSample: story.sample,
  busy: interactionBusy || correcting,
  liveVoice: mode === "voice" && services.liveVoice,
 }, mobileActionCopy[story.language]).map(a => ({ ...a,
  label: a.id === "finish" ? c.create : a.id === "send" ? (reviewing ? v.continue : c.send) : (readyToWrite ? f.continue : c.skip),
  onPress: a.id === "finish" ? () => void makePaper() : a.id === "send" ? () => void send() : () => void skip(),
 }));
 return <div className="app-shell">
  <header className="site-header no-print"><button className="brand" disabled={interactionBusy || correcting} onClick={() => void flushThenNavigate("home")} aria-label="Once &amp; Ours home"><span className="brand-mark"><Asterisk size={30}/></span><span className="brand-name">Once &amp; Ours</span></button><LanguagePicker language={story.language} disabled={interactionBusy||correcting} onChange={language=>{voice.current?.cancel(); setVoicePaused(true); cancelResearch();const starterIndex=startCopy[story.language].prompts.findIndex(p=>p.question===story.turns[0]?.text);const untouchedOpening=story.turns.length===1&&story.turns[0].role==='assistant'&&(starterIndex>=0||story.turns[0].text===openingQuestion(story)||story.turns[0].text===openingQuestion({language:story.language,occasion:'life'}));patch({language,...(untouchedOpening?{turns:[{role:'assistant',text:starterIndex>=0?startCopy[language].prompts[starterIndex].question:openingQuestion({language,occasion:story.occasion})}]}:{})});}}/><div className="header-right"><button className="text-button" disabled={interactionBusy||correcting||account.sampleOnly} onClick={()=>void startFresh()}><Plus size={16}/>{sc.newStory}</button><button className="text-button account-nav" disabled={interactionBusy || correcting || account.sampleOnly} onClick={()=>void openAccount()}>{sharingCopy[story.language].account}</button><button className="icon-button" aria-label="Maker setup" onClick={() => setShowSetup(true)}><Settings size={19}/></button></div></header>
  {account.sampleOnly&&<div className="message no-print" role="status">{{en:"This preview is in sample mode. Explore the formats below; creating and saving stories isn’t connected yet.",zh:"此预览目前为示例模式。你可以浏览作品格式；创建和保存故事功能尚未连接。",es:"Esta vista previa está en modo de ejemplo. Explora los formatos; crear y guardar historias aún no está conectado."}[story.language]}<button onClick={()=>setShowSample(true)}>{c.sample}</button></div>}
  {stage !== "home" && <nav className="steps no-print" aria-label="Story progress">{(["tell", "discover", "paper"] as const).map((s,i) => <button key={s} className={stage === s ? "step active" : "step"} disabled={interactionBusy || correcting || (s !== "tell" && !words.length) || (s === "paper" && !story.paper)} onClick={() => void flushThenNavigate(s)}><span>{i+1}</span>{c[s]}</button>)}</nav>}
  {story.sample && stage !== "home" && <div className="sample-banner no-print"><Sparkles size={14}/> {f.sampleBanner} <button disabled={interactionBusy || correcting} onClick={()=>begin()}>{d.tryOwn}</button></div>}
  {error && <div className="message error no-print" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss message"><X size={18}/></button></div>}
  {saveError && <div className="message error no-print" role="alert">{v.saveError}</div>}
  {account.user&&hasStoryContent(story)&&<div className={cloudStatus==='error'?'message error no-print':'message no-print'} role={cloudStatus==='error'?'alert':'status'}>{cloudStatus==='error'?sc.error:cloudStatus==='saved'?sc.saved:cloudStatus==='saving'?sc.saving:sc.waiting}{cloudStatus==='error'&&<><span>{saveErrorText}</span><button onClick={()=>void saveCurrent().catch(()=>{})}>{sc.retry}</button></>}</div>}
  {resumedDraft&&<div className="message no-print" role="status">{sharingCopy[story.language].resumed}<button onClick={()=>setResumedDraft(false)} aria-label={sharingCopy[story.language].close}><X size={18}/></button></div>}
  {checkoutNotice&&<div className="message no-print" role="status">{checkoutNotice==='confirmed'?paywallCopy[story.language].checkoutConfirmed:paywallCopy[story.language].checkoutPending}<button onClick={()=>setCheckoutNotice('')} aria-label="Dismiss message"><X size={18}/></button></div>}
  {stage === "home" && <main className="home">
   <section className="intro"><p className="eyebrow"><span/> {d.eyebrow}</p><h1>{story.language === "zh" ? <>每个人生，<br/>都值得<span>上头版。</span></> : story.language === "es" ? <>Toda vida merece<br/><span>su portada.</span></> : <>Every life has<br/>a <span>front page.</span></>}</h1><p className="intro-text">{story.language === "zh" ? "聊聊你的回忆，找回那个世界。我们一起把它变成一份值得珍藏、分享的作品。" : story.language === "es" ? "Cuenta un recuerdo. Redescubre su mundo. Juntos crearemos un recuerdo para conservar y compartir." : "Tell a memory. Rediscover its world. Together, we’ll turn it into a keepsake worth sharing."}</p>
    <StoryStart language={story.language} disabled={interactionBusy||correcting||!!account.sampleOnly} hasDraft={hasStoryContent(story)} needsSignIn={!!account.supabase&&!account.user} fromShared={!!sharedEntryLanguage(location.search)} limitReached={limitReached} freeLimit={account.billing.freeStoryLimit} onUpgrade={()=>setShowAccount(true)} onStart={(photo,prompt)=>void startFresh(photo,prompt)} onContinue={()=>story.paper?void flushThenNavigate("paper"):void begin()}>
     <IntentionPicker story={{...story,intention:setupIntention}} disabled={interactionBusy} onChange={setSetupIntention}/><FormatPicker story={{...story,presentation:setupPresentation}} disabled={interactionBusy} onChange={format=>setSetupPresentation({version:1,format})}/><label htmlFor="name">{c.name}</label><input id="name" disabled={interactionBusy} value={setupName} maxLength={80} placeholder={c.optional} onChange={e=>setSetupName(e.target.value)}/><div className="occasion-options" aria-label="Kind of story">{([{ id:"life", label: story.language === "zh" ? "人生回忆" : story.language === "es" ? "Un recuerdo" : "A life memory", icon: <BookOpen size={15}/> }, { id:"wedding", label: story.language === "zh" ? "爱情故事" : story.language === "es" ? "Una historia de amor" : "A love story", icon:<Heart size={15}/> }, { id:"graduation", label:story.language === "zh" ? "新的篇章" : story.language === "es" ? "Un nuevo capítulo" : "A new chapter",icon:<Sparkles size={15}/> }] as const).map(o => <button key={o.id} disabled={interactionBusy} aria-pressed={setupOccasion===o.id} className={setupOccasion===o.id?"occasion selected":"occasion"} onClick={()=>setSetupOccasion(o.id)}>{o.icon}{o.label}</button>)}</div><p className="occasion-description" aria-live="polite">{modeDescriptions[story.language][setupOccasion]}</p>
    </StoryStart><button className="text-button sample-link" onClick={()=>void begin(true)}><BookOpen size={17}/>{c.sample}<ArrowRight size={16}/></button>
   </section>
   <section className="hero-preview" aria-label={d.previewAria}><div className="preview-label">{d.previewLabel} <span>↘</span></div><div className="paper-stack"><NewspaperView story={{...initialStory,language:story.language,name:sample.name,sample:true,paper:sample.paper,sources:[{...sample.source,selected:true}]}} miniature/><div className="paper-sticker"><Heart size={19}/>{d.stickerTop}<br/><strong>{d.stickerBottom}</strong></div></div><div className="preview-caption"><span className="tiny-line"/> {d.caption}</div></section>
   <section className="how-strip">{d.steps.map((step,i)=><div key={i}><span>{String(i+1).padStart(2,"0")}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></div>)}</section>
  </main>}
  {showSample&&<SamplePreview language={story.language} onClose={()=>setShowSample(false)}><FormatPicker story={{...createSampleStory(story.language),presentation:{version:1,format:sampleFormat}}} onChange={setSampleFormat}/><KeepsakeView story={{...createSampleStory(story.language),paper:sample.paper,sources:[{...sample.source,selected:true}],presentation:{version:1,format:sampleFormat}}}/></SamplePreview>}
  {stage === "tell" && <main className={`workspace interview-${mode}`}><section className="conversation">
   {modePicker()}
   {mode==='voice'&&services.liveVoice&&<LiveInterview story={story} grant={()=>callApi('live',latest.current.story,undefined,undefined,undefined,undefined,undefined,{pacing:{quickTurns:pacing.current}})} onPacing={value=>{pacing.current=value;}} onActive={setLiveActive} onRecording={blob=>captureRecording(blob,story.recordingCollectionId)} onTurn={turn=>setStory(s=>s.turns.length>=60?s:{...s,approved:false,paper:undefined,turns:[...s.turns,turn]})}/>}

   <p className="interview-introduction">{mode === "voice" ? (services.liveVoice?"":v.help) : mode === "dictate" ? v.dictateHelp : v.typeHelp}</p>
   <PhotoStory story={story} disabled={interactionBusy||correcting} canAnalyse={!!account.user} canSearch={services.nimble} onChoose={choosePhoto} onRemove={()=>patch({photo:undefined,photoCaption:undefined,photoAnalysis:undefined,artwork:story.artwork==='generated'?'generated':'none',approved:false})} onCaption={text=>patch({photoCaption:text,approved:false})} onAnalyse={()=>void photoQuestion()} onAsk={analysis=>void photoQuestion(analysis)} onSearch={query=>void discover(query)} onSignIn={()=>setShowAccount(true)}/>
   <div className="question-block"><span className="interviewer-mark"><Asterisk size={25}/></span><p className="eyebrow">{v.story}</p><h1 key={question}>{question}</h1><button className="text-button hear-question" onClick={listen} disabled={interactionBusy || correcting}><Volume2 size={18}/>{voicePhase === "speaking" ? v.stopSpeech : v.replay}</button></div>
   {mode !== "type" && !(mode==='voice'&&services.liveVoice) && <section className="voice-panel" aria-label={v.voice}>
    <p className={`voice-status ${recording ? "is-recording" : ""}`} role="status" aria-live="polite"><span/>{busy || (voicePaused && mode === "voice" ? v.paused : voicePhase === "idle" ? v.ready : v[voicePhase])}{recording && <time>{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,"0")}</time>}</p>
    {voicePaused && mode === "voice" ? <button className="primary wide" onClick={resumeVoice} disabled={interactionBusy || correcting}><Volume2 size={21}/>{v.resume}</button> : <button className={recording ? "talk-button is-recording" : "talk-button"} onClick={record} disabled={!!busy || ["starting", "transcribing"].includes(voicePhase) || correcting || reviewing}><span className="talk-icon">{recording ? <Square size={28} fill="currentColor"/> : ["starting", "transcribing"].includes(voicePhase) || busy ? <LoaderCircle size={30} className="spin"/> : <Mic size={30}/>}</span><strong>{recording ? (mode === "voice" ? v.finish : c.stop) : mode === "dictate" ? v.dictateStart : v.answer}</strong></button>}
    <p className="voice-limit">{v.limit}</p>
    <div className="voice-controls">{voiceBusy ? <button className="text-button" onClick={() => voice.current?.cancel()}>{recording ? v.cancel : v.cancelRequest}</button> : mode === "voice" && !voicePaused && <button className="text-button" onClick={pauseVoice}>{v.pause}</button>}{mode === "voice" && <button className="text-button" onClick={() => { voice.current?.cancel(); setShowText(!showText); }} disabled={interactionBusy || correcting}>{v.showText}</button>}</div>
    {mode === "voice" && <label className="checkbox review-voice"><input type="checkbox" checked={reviewVoice} disabled={interactionBusy} onChange={e => setReviewVoice(e.target.checked)}/>{v.review}</label>}
    <p className="mic-note">{v.micNote}</p>
   </section>}
   {(mode !== "voice" || showText || reviewing || !!input) && !correcting && <div className="answer-editor">{reviewing && <div className="transcript-heading"><h2>{v.reviewTitle}</h2><p>{v.reviewHelp}</p></div>}<label className="sr-only" htmlFor="story-answer">{v.memory}</label><textarea id="story-answer" ref={textArea} className="story-input" placeholder={c.placeholder} value={input} maxLength={12000} onChange={e => { setInput(e.target.value); patch({draft:e.target.value}); }} disabled={interactionBusy}/><div className="answer-actions"><button className="primary" onClick={() => void send()} disabled={!input.trim() || interactionBusy}>{busy ? <LoaderCircle className="spin" size={18}/> : <ArrowRight size={18}/>} {reviewing ? v.continue : c.send}</button></div></div>}
   {mode === "type" && busy && <p className="working" role="status">{busy}</p>}
   <ResearchThread story={story} disabled={interactionBusy||correcting} canSearch={services.nimble} searching={researching} searched={searched} onSearch={query=>void discover(undefined,query)} onDismiss={()=>patch({researchSuggestion:null})} onExplore={exploreSource} onUpdateSource={updateSource}/>
   {(words.length>0||!!input.trim())&&!story.sample&&<section className="finish-interview" aria-label={f.ready}><div><h2>{f.ready}</h2><p>{readyToWrite?f.readyNote:f.finish}</p></div><button className="primary" onClick={()=>void makePaper()} disabled={interactionBusy||correcting}><Newspaper size={18}/>{c.create}</button></section>}
   {error&&words.length>0&&!story.sample&&<button className="text-button" disabled={interactionBusy||correcting} onClick={()=>void retryInterview()}>{f.retry}</button>}
   {words.length > 0 && <section className="latest-transcript"><div><h2>{v.transcript}</h2>{!correcting && <button className="text-button" onClick={editLastWords} disabled={interactionBusy || !!input}><Pencil size={15}/>{v.edit}</button>}</div>{correcting ? <><textarea aria-label={v.edit} value={correction} maxLength={12000} onChange={e => setCorrection(e.target.value)}/><div className="correction-actions"><button className="primary" onClick={saveCorrection} disabled={!correction.trim() || interactionBusy}>{v.save}</button><button className="text-button" onClick={() => setCorrecting(false)}>{v.discard}</button></div></> : <p>{words.at(-1)}</p>}</section>}
   <button className="text-button skip-question" onClick={skip} disabled={interactionBusy || correcting || story.sample}>{readyToWrite?f.continue:c.skip}<ArrowRight size={15}/></button>
   {!services.gemini && !story.sample && <p className="offline-note">{f.offline}</p>}
  </section><aside className="notebook"><div className="notebook-heading"><BookOpen size={19}/><h2>{v.collection}</h2><span>{words.length}</span></div>{words.length ? <details className="memory-collection"><summary>{v.savedMemories} ({words.length})</summary><div className="memory-excerpts">{words.map((w,i) => <div key={i}><span className="memory-number">{v.memoryLabel} {String(i+1).padStart(2,"0")}</span><p>{w}</p></div>)}</div></details> : <div className="empty-notebook"><span>✳</span><p>{v.empty}</p></div>}<div className="notebook-actions"><button className="secondary wide" onClick={()=>void discover()} disabled={!words.length || researching || correcting}><Search size={17}/>{c.discovery}</button><button className="primary wide" onClick={makePaper} disabled={(!words.length&&!input.trim()) || interactionBusy || correcting}><Newspaper size={17}/>{c.create}</button>{!saveError && <p className="save-status"><Check size={13}/>{c.saved} · {wordCount} {v.wordLabel}</p>}</div></aside></main>}
  {stage === "discover" && <main className="discovery-page"><button className="text-button" onClick={() => void flushThenNavigate("tell")}><ArrowLeft size={16}/>{c.back}</button><div className="section-intro"><p className="eyebrow">A THREAD TO THE PAST</p><h1>{story.language === "zh" ? "看着熟悉吗？" : story.language === "es" ? "¿Te trae algún recuerdo?" : "Does this bring anything back?"}</h1><p>A place, an event, a little piece of the world you remember.<br/>You decide what belongs in your story.</p></div>{researching ? <div className="searching"><Search size={40}/><h3>{p.searching}</h3><p>Your memories will be here when we’re done.</p><LoaderCircle className="spin"/></div> : story.sources.length ? <div className="source-grid">{story.sources.map(s => <article className="source-card" key={s.id}><div className="source-top"><span><FileText size={15}/>{s.publisher}</span><span>{s.date}</span></div>{story.sample && <div className="moon-art" aria-hidden="true"><div className="moon-disc"/><span>APOLLO 11 / 1969</span><small>{d.decoration}</small></div>}<div className="source-body"><h2>{s.title}</h2><p>{s.description}</p><div className="connection"><Asterisk size={16}/><p>{s.connection}</p></div><a className="text-button" href={safeSourceUrl(s.url) || "#"} target="_blank" rel="noreferrer">Read the source<ExternalLink size={14}/></a><div className="recognition" aria-label="Does this relate to your memory?">{(["familiar","unsure","unfamiliar"] as const).map(r => <button key={r} className={s.reaction===r?"chosen":""} aria-pressed={s.reaction===r} onClick={() => updateSource(s.id,{reaction:r,...(r==="unfamiliar"?{selected:false}:{})})}>{c[r]}</button>)}</div><label className="checkbox"><input type="checkbox" checked={s.selected} onChange={e => updateSource(s.id,{selected:e.target.checked})}/>{c.include}</label><button className="secondary wide" onClick={() => exploreSource(s)}>{c.prompt}<ArrowRight size={17}/></button></div></article>)}</div> : <div className="empty-discovery"><Search size={36}/><h2>{searched?"No useful connection this time.":"Your memory is the starting point."}</h2><p>{searched?"Your story doesn’t need historical material to be worth keeping.":"We’ll look for public places, events or objects you mentioned."}</p><button className="secondary" onClick={()=>void discover()}>{searched?"Try again":c.discovery}</button></div>}<div className="discovery-footer"><p>Historical context stays separate from your own recollections.</p><button className="primary" onClick={makePaper} disabled={!!busy||!words.length}>{story.sources.some(s=>s.selected)?c.create:c.no}<ArrowRight size={18}/></button></div></main>}
  {stage === "paper" && story.paper && <main className="paper-page"><div className="paper-toolbar no-print"><button className="text-button" disabled={interactionBusy} onClick={() => void flushThenNavigate("tell")}><ArrowLeft size={16}/>{c.back}</button><div><button className="secondary" disabled={interactionBusy} onClick={() => setEditing(!editing)}>{editing ? <Check size={16}/> : <Pencil size={16}/>} {editing?c.done:c.edit}</button><button className="primary" disabled={!story.approved || editing || interactionBusy} onClick={() => window.print()}><Download size={17}/>{c.print}</button></div></div><div className="paper-intro no-print"><p className="eyebrow">{d.paperEyebrow}</p><h1>{k.draft}</h1><p>{k.draftHelp}</p></div><FormatPicker story={story} disabled={interactionBusy||editing} onChange={format=>patch({presentation:{version:1,format},approved:false})}/><ArtworkPicker story={story} disabled={interactionBusy} onChange={artwork=>patch({artwork,approved:false})}/>{!editing&&<StoryArt story={story} busy={interactionBusy} onGenerate={style=>void generateArtwork(style)} onInstructions={artInstructions=>patch({artInstructions})} onSelect={()=>patch({artwork:'generated',approved:false})} onRemove={()=>patch({generatedArt:undefined,artwork:story.photo?'memories':'none',approved:false})}/>}{editing ? <section className="editor-form no-print"><label>{d.headline}<input value={story.paper.headline} maxLength={160} onChange={e=>editPaper({headline:e.target.value})}/></label><label>{d.introduction}<textarea value={story.paper.standfirst} maxLength={600} onChange={e=>editPaper({standfirst:e.target.value})}/></label><label>{d.quote}<textarea value={story.paper.quote} maxLength={400} onChange={e=>editPaper({quote:e.target.value})}/></label><button className="primary" onClick={()=>setEditing(false)}><Check size={17}/>{c.done}</button></section> : <KeepsakeView story={story}/> }<div className="review-bar no-print"><label className="checkbox"><input type="checkbox" disabled={interactionBusy} checked={story.approved} onChange={e=>patch({approved:e.target.checked})}/>{c.review}</label><button className="text-button" onClick={()=>setShowOriginal(true)}>{d.compare}<ArrowRight size={15}/></button></div>{!editing&&!story.sample&&<TranslationStudio story={story} disabled={interactionBusy} working={translating} signedIn={!!account.user} onTranslate={translateKeepsake} onTranscriptTranslate={translateTranscript} onSignIn={()=>void openAccount()}/>}<div className="keepsake-share-actions no-print">{!editing&&<fieldset className="share-group" disabled={interactionBusy} aria-describedby="share-group-help"><legend className="sr-only">{g.shareTitle}</legend><div className="share-group-header"><span className="share-group-icon"><Share2 size={15}/></span><p className="share-group-title">{g.shareTitle}</p></div><p className="share-group-help" id="share-group-help">{g.shareHelp}</p><ShareVideo story={story} enabled={services.video?.enabled??false} creditUrl={services.socialCredit?.url}/><ShareImages story={story} creditUrl={services.socialCredit?.url}/><Sharing story={story} config={account} saved={saved} onSave={saveCurrent} onSaveSeparate={saveSeparate} onChangeSharing={changeSharing} onNew={startFresh} onDelete={deleteStory} onLoad={loadStory} storageKey={storageKey} onPrepareSignIn={prepareSignIn} accountError={cloudStatus==='error'?saveErrorText:undefined} onRestoreEarlier={earlierDraft?restoreEarlierDraft:undefined}/></fieldset>}{!editing&&account.user&&saved&&!story.sample&&<fieldset className="invite-group" disabled={interactionBusy} aria-describedby="invite-group-help"><legend className="sr-only">{g.inviteTitle}</legend><div className="share-group-header"><span className="share-group-icon"><Users size={15}/></span><p className="share-group-title">{g.inviteTitle}</p></div><p className="share-group-help" id="invite-group-help">{g.inviteHelp}</p><Invites language={story.language} occasion={story.occasion} storyName={story.name} saved={saved} onSave={saveCurrent} onLoad={loadStory}/></fieldset>}</div><div className="paper-bottom no-print"><button className="text-button" onClick={exportOriginal}><Download size={15}/>{d.downloadWords}</button><button className="text-button" onClick={()=>download("storypress-story.json",JSON.stringify(story,null,2),"application/json")}><Download size={15}/>{d.downloadStory}</button><button className="text-button" onClick={()=>void startFresh()}><Plus size={16}/>{c.fresh}</button></div></main>}
  {showAccount&&<div className="modal-backdrop no-print" onClick={()=>setShowAccount(false)}><div className="modal account-modal" role="dialog" aria-modal="true" aria-label={sharingCopy[story.language].account} onClick={e=>e.stopPropagation()}><Sharing accountOnly story={story} config={account} saved={saved} onSave={saveCurrent} onSaveSeparate={saveSeparate} onChangeSharing={changeSharing} onNew={startFresh} onDelete={deleteStory} onLoad={loadStory} storageKey={storageKey} onPrepareSignIn={prepareSignIn} accountError={cloudStatus==='error'?saveErrorText:undefined} onRestoreEarlier={earlierDraft?restoreEarlierDraft:undefined} onClose={()=>setShowAccount(false)}/></div></div>}
  {stage!=='home'&&<Recordings owner={account.user?.id||'guest'} story={story} pending={pendingRecordings.filter(r=>r.collection===story.recordingCollectionId)} onResolved={id=>setPendingRecordings(rows=>rows.filter(r=>r.id!==id))}/>}
  <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{const f=e.target.files?.[0]; if(f) void addPhoto(f);e.target.value="";}}/>
  <MobileActionBar actions={mobileActions} visible={stage === "tell" && !showSample && !showAccount && !correcting}/>
  <footer className="site-footer no-print"><span>{d.footer}</span><span>ONCE &amp; OURS <Asterisk size={12}/> EST. 2026</span></footer>
  {(showSetup || showOriginal) && <div className="modal-backdrop no-print" onClick={()=>{setShowSetup(false);setShowOriginal(false);}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e=>e.stopPropagation()}><button className="icon-button close" aria-label="Close" onClick={()=>{setShowSetup(false);setShowOriginal(false);}}><X size={21}/></button>{showOriginal ? <><p className="eyebrow">{d.asTold}</p><h2 id="dialog-title">{d.original}</h2>{words.map((w,i)=><p key={i} className="original-turn">{w}</p>)}<button className="secondary" onClick={exportOriginal}><Download size={16}/>{d.downloadWords}</button></> : <><p className="eyebrow">MAKER SETUP</p><h2 id="dialog-title">Connect the story studio</h2><p>The sample is fully usable. Real AI interviewing, transcription and editing need Gemini; historical discovery also needs Nimble.</p><div className="service-row"><strong>Gemini · {services.geminiBackend === "vertex" ? "Google Cloud" : "AI Studio"}</strong><span className={services.gemini?"connected":""}>{services.gemini?"Key configured":"Not configured"}</span></div><div className="service-row"><strong>Nimble</strong><span className={services.nimble?"connected":""}>{services.nimble?"Key configured":"Not configured"}</span></div><p>{services.geminiBackend === "vertex" ? <>Configure <code>VERTEX_API_KEY</code> and <code>GOOGLE_CLOUD_PROJECT</code> for Google Cloud.</> : <>Configure <code>GEMINI_API_KEY</code> for AI Studio.</>} Historical search uses <code>NIMBLE_API_KEY</code>. Keys stay on the server. “Key configured” does not verify billing or permissions.</p><p className="quiet left">Drafts and photographs are saved in this browser. AI requests send your words to Gemini. Photo assistance sends a resized copy of your photo only when you choose it. Photo search sends only the query you review to Nimble; visual guesses are kept out of newspaper writing. Recordings are transcribed by Gemini and remain downloadable until you close the page.</p><a className="text-button" href={services.geminiBackend === "vertex" ? "https://console.cloud.google.com/agent-platform/studio/settings/api-keys" : "https://aistudio.google.com/api-keys"} target="_blank" rel="noreferrer">{services.geminiBackend === "vertex" ? "Google Cloud console" : "Google AI Studio"}<ExternalLink size={14}/></a><a className="text-button" href="https://online.nimbleway.com/" target="_blank" rel="noreferrer">Nimble dashboard<ExternalLink size={14}/></a></>}</section></div>}
 </div>;
}
export function NewspaperView({ story, miniature = false }: { story: Story; miniature?: boolean }) {
 const p = story.paper || sampleEditions[story.language].paper;
 const c = copy[story.language];
 const d = presentation[story.language];
 const art=artworkPath(story),artKey=chosenArtwork(story),artLabels=artworkCopy[story.language];
 return <article className={miniature ? "newspaper miniature" : "newspaper"} lang={story.language}>
  <div className="paper-topline"><span>{d.topline}</span><Asterisk size={16}/><span>{d.edition}</span></div>
  <div className="masthead">{d.masthead}</div>
  <div className="edition-line"><span>{story.name ? `${c.your} ${story.name}` : d.unnamed}</span><span>{story.sample ? d.sample : story.approved ? d.reviewed : d.draft}</span></div>
  <div className="paper-main">
   <p className="paper-kicker">{d.kickers[story.occasion]}</p><h2>{p.headline}</h2>
   {p.standfirst && <p className="standfirst">{p.standfirst}</p>}
   {story.photo&&artKey!=='generated'&&artKey!=='none' ? <figure className="personal-photo"><img src={story.photo} alt={story.photoCaption || d.photo}/>{story.photoCaption && <figcaption>{story.photoCaption}</figcaption>}</figure> : story.sample&&miniature ? <div className="paper-illustration" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="large-moon"/><span>{d.illustration}</span><small>{d.decoration}</small></div> : art&&artKey!=='none' ? <figure className={artKey==='generated'?"editorial-art story-generated-art":"editorial-art"}><img src={art} alt={artworkAlt(story)} width={1536} height={1024}/><figcaption>{artworkCaption(story)}</figcaption></figure> : null}
   <div className="paper-columns"><div className="story-prose">{p.paragraphs.map((text,i)=><p key={i}>{text}</p>)}</div>
    <aside className="paper-aside">{p.quote && <blockquote>“{p.quote}”</blockquote>}
     {story.sources.filter(s=>s.selected).map(s=><section className="historical-context" key={s.id}><p className="paper-kicker">{c.context}</p><h3>{s.title}</h3><p>{s.description}</p><a href={safeSourceUrl(s.url)||"#"} target="_blank" rel="noreferrer">{s.publisher} · {s.date} ↗</a><span className="print-source">{s.url}</span></section>)}
     {!p.quote && !story.sources.some(s=>s.selected) && <div className="kept-note"><Asterisk size={30}/><p>{d.kept}</p></div>}
    </aside>
   </div>
  </div>
  <div className="paper-colophon"><span>{d.colophon}</span><span>{d.madeWith} <Asterisk size={10}/></span></div>
 </article>;
}

// A valid /i/<token> path renders the guest contribution surface instead of
// the owner app; the token must match the server's 64-hex capability shape.
export default function App(){
 const token=parseInviteToken(location.pathname);
 return token?<InviteGuest token={token}/>:<StoryApp/>;
}

