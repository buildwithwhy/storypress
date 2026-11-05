// Wave 5 change 3 (honest storage errors): the server attaches machine codes
// to storage failures; this module picks the owner-facing copy. SCHEMA_MISSING
// almost always means a live Supabase migration has not been applied
// (art_VetIBa76) — surfacing the code alongside the message makes one founder
// report settle the cause.
type StorageLanguage='en'|'zh'|'es';
export function storageSetupCopy(language:StorageLanguage){return{
 en:'Your account storage isn’t set up for this yet. Your draft is safe on this device.',
 zh:'你的账户存储尚未设置。草稿已安全保存在此设备上。',
 es:'Tu almacenamiento de cuenta aún no está configurado. El borrador está a salvo en este dispositivo.'
}[language];}
// The banner and invite panel pick: a known code selects localized copy;
// anything else keeps the server message. The machine code is appended either
// way so a screenshot carries the diagnosis. story_limit is excluded — the
// paywall copy (paywall §2) owns that path, no code suffix needed.
export function storageErrorText(language:StorageLanguage,code:string|undefined,fallback:string){
 if(!code||code==='story_limit')return fallback;
 return code==='SCHEMA_MISSING'?`${storageSetupCopy(language)} (code: ${code})`:`${fallback} (code: ${code})`;
}
