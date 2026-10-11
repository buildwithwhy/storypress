import {useEffect,useState} from 'react';
import {ImagePlus,Search,Sparkles} from 'lucide-react';
import {type Story,type PhotoAnalysis} from '../lib/story';
import {photoCopy} from '../lib/photo-copy';

export function PhotoStory({story,disabled,canAnalyse,canSearch,onChoose,onRemove,onCaption,onAnalyse,onAsk,onSearch,onSignIn}:{
 story:Story;disabled:boolean;canAnalyse:boolean;canSearch:boolean;onChoose:()=>void;onRemove:()=>void;onCaption:(text:string)=>void;onAnalyse:()=>void;onAsk:(analysis:PhotoAnalysis)=>void;onSearch:(query:string)=>void;onSignIn:()=>void;
}){
 const c=photoCopy[story.language],a=story.photoAnalysis;
 const [query,setQuery]=useState(a?.searchQueries[0]||'');
 const [visible,setVisible]=useState(a?.visibleDetails.join('\n')||'');
 const [possible,setPossible]=useState(a?.possibleContext.join('\n')||'');
 useEffect(()=>setQuery(a?.searchQueries[0]||''),[story.photo,a?.searchQueries]);
 useEffect(()=>{setVisible(a?.visibleDetails.join('\n')||'');setPossible(a?.possibleContext.join('\n')||'');},[story.photo,a]);
 if(!story.photo)return <button className="photo-invite secondary" disabled={disabled} onClick={onChoose}><ImagePlus size={20}/>{c.add}</button>;
 const lines=(text:string,max:number)=>text.split('\n').map(s=>s.trim().slice(0,300)).filter(Boolean).slice(0,max);
 return <section className="photo-story" aria-label={c.title}>
  <div className="photo-story-top"><img src={story.photo} alt={story.photoCaption||c.title}/><div><p className="eyebrow">{c.title}</p><label className="photo-caption">{c.caption}<input value={story.photoCaption||''} maxLength={400} disabled={disabled} onChange={e=>onCaption(e.target.value)}/></label><div className="photo-tools"><button className="text-button" onClick={onChoose} disabled={disabled}>{c.change}</button><button className="text-button" onClick={onRemove} disabled={disabled}>{c.remove}</button></div></div></div>
  {!a&&<><p>{c.invite}</p><p className="photo-note">{c.consent}</p><button className="secondary" disabled={disabled||story.sample} onClick={canAnalyse?onAnalyse:onSignIn}><Sparkles size={17}/>{!canAnalyse?c.login:c.analyse}</button>{story.sample&&<p className="photo-note">{c.sample}</p>}</>}
  {a&&<><details className="photo-details"><summary>{c.review}</summary><p className="photo-note">{c.uncertain}</p><h2>{c.noticed}</h2><ul className="photo-observations">{a.visibleDetails.map((text,i)=><li key={i}>{text}</li>)}</ul>{a.possibleContext.length>0&&<div className="photo-possibilities"><strong>{c.possible}</strong><ul>{a.possibleContext.map((text,i)=><li key={i}>{text}</li>)}</ul></div>}<h3>{c.edit}</h3><p>{c.editHint}</p><label>{c.visible}<textarea value={visible} disabled={disabled} rows={3} maxLength={1203} onChange={e=>setVisible(e.target.value)}/></label><label>{c.possible}<textarea value={possible} disabled={disabled} rows={2} maxLength={601} onChange={e=>setPossible(e.target.value)}/></label><button className="secondary" disabled={disabled} onClick={()=>onAsk({...a,visibleDetails:lines(visible,4),possibleContext:lines(possible,2)})}>{c.ask}</button><p className="photo-note">{c.consent}</p><button className="secondary" disabled={disabled||story.sample} onClick={canAnalyse?onAnalyse:onSignIn}><Sparkles size={17}/>{!canAnalyse?c.login:c.again}</button></details>
  <details className="photo-details"><summary>{c.history}</summary><p>{c.historyHint}</p>{a.searchQueries.length>1&&<div className="photo-query-ideas">{a.searchQueries.map((idea,i)=><button key={i} className="text-button" disabled={disabled} onClick={()=>setQuery(idea)}>{idea}</button>)}</div>}<form onSubmit={e=>{e.preventDefault();if(query.trim())onSearch(query.trim());}}><label>{c.query}<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={220} disabled={disabled}/></label><button className="secondary" disabled={disabled||!query.trim()||!canSearch}><Search size={17}/>{c.search}</button>{!canSearch&&<p className="photo-note">{c.noSearch}</p>}</form></details></>}
 </section>;
}
