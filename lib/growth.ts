// Growth engine, browser side (docs/GROWTH-ENGINE.md). Loads the engine's
// first-party SDK (growth.hopperlace.ai/sdk.js) and reports four funnel steps:
// landing_view (the SDK's own automatic view on an entry page), signup,
// story_completed and checkout_opened. Money events never come from here —
// purchase and renewal are sent server-side from verified Stripe webhooks
// (server/growth.ts).
//
// Off by default: the SDK URL reaches the client only through the services
// payload (GROWTH_SDK_URL, a server env var — the same seam as the social
// credit URL, so no engine host is written into client code). Unset means no
// script is loaded and nothing is sent.
//
// Privacy: no cookies, no third-party pixels, and no personal data — events
// carry only a step name. Never an email, name, user id, story content or
// IP. UTM parameters are kept in this tab's sessionStorage so a later
// checkout can carry them into Stripe metadata; values containing '@' are
// dropped in case a link ever smuggles an address in.

export const GROWTH_CLIENT_ID='once-and-ours';
export const ATTRIBUTION_KEYS=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','platform','placement'] as const;
export type AttributionKey=typeof ATTRIBUTION_KEYS[number];
export type Attribution=Partial<Record<AttributionKey,string>>;
export type GrowthStep='signup'|'story_completed'|'checkout_opened';

declare global { interface Window { growth?:{track:(stage:string,step?:string|null,extra?:Record<string,unknown>)=>void} } }

const ATTRIBUTION_STORAGE_KEY='growth.attribution';
const MAX_ATTRIBUTION_LENGTH=200;
const ENTRY_PATHS=new Set(['/','/pricing']);
// A first sign-in stamps the account's confirmation and its sign-in in the
// same request; a returning sign-in has a confirmation from an earlier day.
const SIGNUP_STAMP_WINDOW_MS=60_000;
const SIGNUP_RECENT_MS=10*60_000;

// ---- Pure helpers (exercised by scripts/check-growth.mjs) ----

// Keeps only the known attribution keys, as short single-line strings.
export function cleanAttribution(input:unknown):Attribution{
 const out:Attribution={};
 if(!input||typeof input!=='object')return out;
 for(const key of ATTRIBUTION_KEYS){
  const value=(input as Record<string,unknown>)[key];
  if(typeof value!=='string')continue;
  const trimmed=value.trim();
  if(!trimmed||trimmed.length>MAX_ATTRIBUTION_LENGTH||/[\u0000-\u001f\u007f@]/.test(trimmed))continue;
  out[key]=trimmed;
 }
 return out;
}
export function attributionFromSearch(search:string):Attribution{
 const params=new URLSearchParams(search);
 return cleanAttribution(Object.fromEntries(ATTRIBUTION_KEYS.map(key=>[key,params.get(key)??undefined])));
}

// The script URL, or null when unset or not https. The engine serves one SDK
// per client, selected by ?client=.
export function sdkScriptUrl(raw:unknown):string|null{
 if(typeof raw!=='string'||!raw.trim())return null;
 try{
  const url=new URL(raw.trim());
  if(url.protocol!=='https:')return null;
  if(!url.searchParams.get('client'))url.searchParams.set('client',GROWTH_CLIENT_ID);
  return url.toString();
 }catch{return null;}
}

// An entry page is a fresh landing on the home or pricing page — not a return
// from Stripe Checkout, Google sign-in or an email sign-in link, which reload
// the same paths.
export function isEntryLocation(loc:{pathname:string;search:string;hash:string}):boolean{
 if(!ENTRY_PATHS.has(loc.pathname))return false;
 const params=new URLSearchParams(loc.search);
 if(params.has('billing_checkout')||params.has('code')||params.has('error')||params.has('error_description'))return false;
 return !/(?:^#|&)(?:access_token|error)=/.test(loc.hash);
}

// True only for an account's first sign-in, observed within minutes of it.
export function isFreshSignup(user:{created_at?:string;last_sign_in_at?:string|null;email_confirmed_at?:string|null;confirmed_at?:string|null}|null|undefined,now:number):boolean{
 if(!user?.last_sign_in_at)return false;
 const signedIn=Date.parse(user.last_sign_in_at);
 const confirmed=Date.parse(user.email_confirmed_at||user.confirmed_at||user.created_at||'');
 if(!Number.isFinite(signedIn)||!Number.isFinite(confirmed))return false;
 return Math.abs(signedIn-confirmed)<=SIGNUP_STAMP_WINDOW_MS&&now-signedIn>=-SIGNUP_STAMP_WINDOW_MS&&now-signedIn<=SIGNUP_RECENT_MS;
}

// ---- Browser state ----

let entry=false;
let landingAttribution:Attribution={};
let sdkUrl:string|null=null;
let state:'unknown'|'off'|'on'='unknown';
let queued:GrowthStep[]=[];
let loader:Promise<boolean>|null=null;

function session():Storage|null{try{return typeof sessionStorage==='undefined'?null:sessionStorage;}catch{return null;}}

// Called once before the app renders: remembers whether this load is an entry
// page and its UTMs, before sign-in or checkout handling rewrites the URL.
export function captureGrowthEntry(){
 if(typeof location==='undefined')return;
 entry=isEntryLocation(location);
 landingAttribution=entry?attributionFromSearch(location.search):{};
}

function loadSdk():Promise<boolean>{
 if(loader)return loader;
 if(!sdkUrl||typeof document==='undefined')return Promise.resolve(false);
 if(window.growth)return loader=Promise.resolve(true);
 const src=sdkUrl;
 loader=new Promise<boolean>(resolve=>{
  const script=document.createElement('script');
  script.src=src;script.async=true;
  script.onload=()=>resolve(!!window.growth);
  script.onerror=()=>resolve(false);
  document.head.appendChild(script);
 });
 return loader;
}

// Once per step per tab per day: the engine counts events, so a re-render or
// a second story the same day must not inflate the funnel.
function firstToday(step:GrowthStep):boolean{
 const storage=session();
 if(!storage)return true;
 const key=`growth.once.${step}.${new Date().toISOString().slice(0,10)}`;
 try{if(storage.getItem(key))return false;storage.setItem(key,'1');}catch{/* storage refused: send anyway */}
 return true;
}

function send(step:GrowthStep){
 if(!firstToday(step))return;
 // The engine maps the client's step name through its stage_map; the step
 // is passed explicitly because the SDK sends a missing step as null.
 void loadSdk().then(ok=>{if(ok)try{window.growth?.track(step,step);}catch{/* never break the app */}});
}

// Applies the services payload's SDK URL. Without one, queued steps are
// dropped and nothing ever loads.
export function configureGrowth(raw:unknown){
 sdkUrl=sdkScriptUrl(raw);
 state=sdkUrl?'on':'off';
 const pending=queued;queued=[];
 if(!sdkUrl)return;
 if(Object.keys(landingAttribution).length){
  try{session()?.setItem(ATTRIBUTION_STORAGE_KEY,JSON.stringify(landingAttribution));}catch{/* attribution is best effort */}
 }
 // The SDK sends its own view on load, which is the landing_view: it is
 // loaded eagerly only on entry pages, and lazily elsewhere when a step needs it.
 if(entry)void loadSdk();
 for(const step of pending)send(step);
}

export function trackGrowth(step:GrowthStep){
 if(state==='off')return;
 if(state==='unknown'){if(queued.length<10)queued.push(step);return;}
 send(step);
}

// UTMs from this tab's landing, for Checkout Session metadata. Undefined
// unless the growth engine is configured, so a dormant deployment's checkout
// request is unchanged.
export function checkoutAttribution():Attribution|undefined{
 if(state!=='on')return undefined;
 try{
  const raw=session()?.getItem(ATTRIBUTION_STORAGE_KEY);
  const value=raw?cleanAttribution(JSON.parse(raw)):{};
  return Object.keys(value).length?value:undefined;
 }catch{return undefined;}
}
