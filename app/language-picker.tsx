import {Globe2} from 'lucide-react';
import {languages,type Story} from '../lib/story';
export function LanguagePicker({language,disabled,onChange}:{language:Story['language'];disabled:boolean;onChange:(language:Story['language'])=>void}){
 return <nav className="language-picker no-print" aria-label="Language / 语言 / Idioma">
  <span className="language-picker-label"><Globe2 size={16} aria-hidden="true"/><span>Language · 语言 · Idioma</span></span>
  <div className="language-picker-options">{(Object.keys(languages) as Story['language'][]).map(code=><button type="button" key={code} lang={code} disabled={disabled} aria-pressed={language===code} onClick={()=>{if(code!==language)onChange(code);}}>{languages[code]}</button>)}</div>
 </nav>;
}
