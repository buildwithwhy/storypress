// The /i/<token> guest surface: the invited relative sees only the personal
// question, answers by typing or dictated speech, and submits attributed
// memories for the owner's review. No account is required; an optional
// sign-in afterwards upgrades attribution. The owner's story blob never
// loads here — the server sends the question and the story language only.
import {useEffect,useRef,useState} from 'react';
import {Check,LoaderCircle,Mic,Square,Volume2} from 'lucide-react';
import {turnSchema,type Story,type Turn} from '../lib/story';
import {interviewCopy} from '../lib/interview-copy';
import {inviteCopy} from '../lib/invite-copy';
import {inviteApi,inviteDraftKey,inviteSentKey,guestTurnsOctets,GUEST_TURNS_OCTET_LIMIT,type InviteSent} from '../lib/invite-client';
import {setupAccount,signInWithGoogle,type Account} from '../lib/account-client';
import {EmailSignIn} from './email-sign-in';
import {createVoiceSession,type VoicePhase} from '../lib/voice-session';

type InviteInfo={status:'open'|'expired'|'revoked'|'unknown';question?:string;expiresAt?:string;language?:Story['language'];occasion?:Story['occasion']};
type GuestDraft={turns:Turn[];authorLabel:string};

function loadDraft(tokenValue:string):GuestDraft{
 try{
  const raw=localStorage.getItem(inviteDraftKey(tokenValue));
  if(!raw)return {turns:[],authorLabel:''};
  const parsed=JSON.parse(raw) as {turns?:unknown[];authorLabel?:unknown};
  const turns=(parsed.turns||[]).flatMap(t=>{const result=turnSchema.safeParse(t);return result.success?[result.data]:[];});
  return {turns,authorLabel:typeof parsed.authorLabel==='string'?parsed.authorLabel:''};
 }catch{return {turns:[],authorLabel:''};}
}

// The shared invite link may carry a pre-filled name after the # fragment.
function suggestedName(){const name=decodeURIComponent(location.hash.slice(1)).trim();return name.slice(0,80);}

export function InviteGuest({token:tokenValue}:{token:string}){
 const [info,setInfo]=useState<InviteInfo|null>(null);
 const [turns,setTurns]=useState<Turn[]>([]);
 const [authorLabel,setAuthorLabel]=useState('');
 const [input,setInput]=useState('');
 const [busy,setBusy]=useState<'ask'|'send'|null>(null);
 const [error,setError]=useState('');
 const [sent,setSent]=useState<InviteSent|null>(null);
 const [claimed,setClaimed]=useState(false);
 const [user,setUser]=useState<Account|null>(null);
 const [emailPending,setEmailPending]=useState(false);
 const [voicePhase,setVoicePhase]=useState<VoicePhase>('idle');
 const [elapsed,setElapsed]=useState(0);
 const language=info?.language||'en',c=inviteCopy[language],v=interviewCopy[language];
 const voice=useRef<ReturnType<typeof createVoiceSession>|null>(null);
 const turnsRef=useRef(turns);turnsRef.current=turns;
 const inputRef=useRef(input);inputRef.current=input;
 const sentRef=useRef(sent);sentRef.current=sent;
 const claimedRef=useRef(false);

 useEffect(()=>{ // one-time: invite context, local draft or sent marker, auth for the optional claim
  setAuthorLabel(suggestedName());
  let cancelled=false;
  void (async()=>{
   try{
    const data=await inviteApi(undefined,`token=${encodeURIComponent(tokenValue)}`) as InviteInfo;
    if(cancelled)return;
    setInfo(data);
    if(data.language)document.documentElement.lang=data.language==='zh'?'zh-CN':data.language;
    const marker=localStorage.getItem(inviteSentKey(tokenValue));
    if(marker){try{setSent(JSON.parse(marker) as InviteSent);}catch{/* a corrupt marker behaves like no marker */}}
    else{const draft=loadDraft(tokenValue);setTurns(draft.turns);setAuthorLabel(current=>current||draft.authorLabel);}
   }catch{if(!cancelled)setInfo({status:'unknown'});}
  })();
  void setupAccount(signedIn=>{
   setUser(signedIn);
   if(signedIn&&sentRef.current&&!claimedRef.current)void claim();
  });
  return()=>{cancelled=true;};
 },[tokenValue]);

 useEffect(()=>{ // the guest's words live on this device until submitted
  if(!info||info.status!=='open'||sent)return;
  try{localStorage.setItem(inviteDraftKey(tokenValue),JSON.stringify({turns,authorLabel}));}catch{/* private browsing: the session still works, it just does not survive a reload */}
 },[turns,authorLabel,info,sent,tokenValue]);

 useEffect(()=>{ // the same dictation pipeline the owner's interview uses
  voice.current=createVoiceSession({
   phase:setVoicePhase,elapsed:setElapsed,
   problem:problem=>{const labels=interviewCopy[language];const key={unsupported:'unsupported',microphone:'microphone',speech:'speech',empty:'emptyAudio',tooLarge:'tooLarge',recording:'recordError'} as const;setError(problem instanceof Error?problem.message:labels[key[problem]]);},
   clip:()=>{}, // the guest submits words for review, not keepsake recordings
   transcribe:async(blob,signal)=>{
    const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
    if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    return (await inviteApi({action:'transcribe',token:tokenValue,audio:{data,mime:blob.type.split(';')[0]}}) as {transcript:string}).transcript;
   },
   transcript:text=>{ // dictated words land in the box for review before sending
    const combined=[inputRef.current,text].filter(Boolean).join('\n').slice(0,12000);
    setInput(combined);
   },
  });
  return()=>{voice.current?.cancel();};
 },[tokenValue,language]);

 async function ask(text?:string){ // send the guest's answer, receive the next question
  const words=(text??input).trim();
  if(!words||busy)return;
  setError('');
  const next=[...turnsRef.current,{role:'user' as const,text:words}];
  setTurns(next);turnsRef.current=next;
  setInput('');inputRef.current='';
  setBusy('ask');
  try{
   const reply=await inviteApi({action:'interview',token:tokenValue,turns:next}) as {acknowledgement?:string;question:string};
   setTurns([...next,{role:'assistant' as const,text:reply.acknowledgement?`${reply.acknowledgement}\n\n${reply.question}`:reply.question}]);
  }catch{setError(c.guestError);}
  finally{setBusy(null);}
 }

 async function submit(){
  const label=authorLabel.trim();
  if(busy||!label){setError(c.needName);return;}
  const words=turnsRef.current.filter(t=>t.role==='user');
  if(!words.length){setError(c.needWords);return;}
  if(guestTurnsOctets(turnsRef.current)>GUEST_TURNS_OCTET_LIMIT){setError(c.tooLong);return;}
  setBusy('send');setError('');
  try{
   const data=await inviteApi({action:'contribute',token:tokenValue,turns:turnsRef.current,authorLabel:label}) as {id:string};
   const marker:InviteSent={contributionId:data.id,authorLabel:label,at:new Date().toISOString()};
   localStorage.removeItem(inviteDraftKey(tokenValue));
   localStorage.setItem(inviteSentKey(tokenValue),JSON.stringify(marker));
   setSent(marker);
   if(user&&!claimedRef.current)void claim();
  }catch{setError(c.guestError);}
  finally{setBusy(null);}
 }

 // Attribution by label already stands; linking the account is an upgrade,
 // so a failed claim keeps the submission credited either way.
 async function claim(){
  if(!sentRef.current)return;
  try{await inviteApi({action:'claim',contributionId:sentRef.current.contributionId});claimedRef.current=true;setClaimed(true);}
  catch{/* retried on the next sign-in event; the label attribution remains */}
 }

 function toggleRecord(){
  setError('');
  if(voicePhase==='recording'){voice.current?.finish();return;}
  if(voicePhase!=='idle')return;
  void voice.current?.record();
 }

 if(!info)return <main className="guest-page" aria-live="polite"><p className="quiet"><LoaderCircle className="spin" aria-hidden="true"/></p></main>;

 if(info.status!=='open'||sent){
  if(sent)return <main className="guest-page">
   <p className="eyebrow">ONCE &amp; OURS</p>
   <h1>{c.sentTitle}</h1>
   <p className="guest-lede">{c.sentHelp}</p>
   <p className="guest-note"><Check size={14} aria-hidden="true"/>{sent.authorLabel} · {new Date(sent.at).toLocaleDateString(language==='zh'?'zh-CN':language==='es'?'es':'en')}</p>
   {!user&&<section className="guest-sign-in"><p>{c.signHelp}</p>
    <button type="button" className="secondary wide google-sign-in" disabled={emailPending} onClick={()=>void signInWithGoogle(`${location.origin}/i/${tokenValue}`)}>
     <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
     Google</button>
    <EmailSignIn language={language} disabled={emailPending} onPrepareSignIn={()=>()=>{}} onPending={setEmailPending}/>
   </section>}
   {claimed&&<p className="guest-note"><Check size={14} aria-hidden="true"/>{c.claimed}</p>}
  </main>;
  return <main className="guest-page"><p className="eyebrow">ONCE &amp; OURS</p><h1>{c.welcome}</h1><p className="guest-lede">{info.status==='revoked'?c.revokedGuest:info.status==='expired'?c.expiredGuest:c.unknown}</p></main>;
 }

 return <main className="guest-page">
  <p className="eyebrow">ONCE &amp; OURS</p>
  <div className="question-block"><h1>{info.question}</h1>{info.question&&<button type="button" className="icon-button" aria-label={v.replay} onClick={()=>voice.current?.speak(info.question!,language)}><Volume2 size={17} aria-hidden="true"/></button>}</div>
  <p className="guest-lede">{c.guestHelp}</p>
  {turns.length>0&&<div className="guest-turns">{turns.map((t,i)=><div className="turn" key={i}><small>{t.role==='user'?(authorLabel.trim()||c.a):c.q}</small><p>{t.text}</p></div>)}</div>}
  <label className="guest-field">{c.yourName}<input value={authorLabel} maxLength={80} placeholder={c.namePlaceholder} onChange={e=>setAuthorLabel(e.target.value)}/></label>
  <label className="guest-field">{c.a}<textarea value={input} maxLength={12000} rows={4} onChange={e=>setInput(e.target.value)}/></label>
  <div className="guest-actions">
   <button type="button" className="secondary" disabled={busy!==null||(voicePhase!=='idle'&&voicePhase!=='recording')} onClick={toggleRecord}>{voicePhase==='recording'?<Square size={16} aria-hidden="true"/>:<Mic size={16} aria-hidden="true"/>}{voicePhase==='recording'?v.cancel:v.dictate}</button>
   <button type="button" className="primary" disabled={busy!==null||!input.trim()} onClick={()=>void ask()}>{busy==='ask'&&<LoaderCircle className="spin" size={15} aria-hidden="true"/>}{v.answer}</button>
  </div>
  {(voicePhase==='recording'||voicePhase==='transcribing')&&<p className="quiet">{voicePhase==='recording'?`${v.recording}${elapsed?` · ${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}`:''}`:v.transcribing}</p>}
  <button type="button" className="primary wide" disabled={busy!==null||!turns.some(t=>t.role==='user')||!authorLabel.trim()} onClick={()=>void submit()}>{busy==='send'?c.sending:c.submit}</button>
  {turns.length>0&&<p className="guest-note"><Check size={13} aria-hidden="true"/>{c.draftSaved}</p>}
  {error&&<p className="form-problem" role="alert">{error}</p>}
  <p className="quiet">{v.micNote}</p>
 </main>;
}
