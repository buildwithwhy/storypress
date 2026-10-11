import {useEffect,useId,useState} from 'react';
import {ArrowRight,ExternalLink,LoaderCircle,Search} from 'lucide-react';
import {safeSourceUrl,type Story,type Source} from '../lib/story';

const copy={
 en:{
  title:'A little context, if you like',query:'Search wording',search:'Look this up',dismiss:'Not now',
  privacy:'Only this wording goes to web search. Leave out private names and addresses.',
  unavailable:'Search is unavailable right now. You can keep telling your story.',searching:'Looking for a useful connection…',
  discoveries:'Discoveries from your story',background:'Choose what connects with your memory. Included sources appear as separate background in your newspaper.',
  read:'Read source',talk:'Talk about this',include:'Include as background in my newspaper',
  empty:'No useful connection this time. You can change the wording or carry on with your story.'
 },
 zh:{
  title:'想多了解一点背景吗？',query:'搜索用语',search:'查一查',dismiss:'暂时不用',
  privacy:'只有这段文字会用于网络搜索。请不要填写私人姓名或地址。',
  unavailable:'搜索暂时无法使用，你可以继续讲述故事。',searching:'正在寻找相关资料……',
  discoveries:'从你的故事中发现的线索',background:'哪些资料与你的回忆有关，由你判断。选中的资料会作为独立的背景内容放进报纸。',
  read:'阅读来源',talk:'聊聊这个',include:'作为背景资料放进我的报纸',
  empty:'这次没有找到有用的资料。你可以修改搜索用语，或继续讲述故事。'
 },
 es:{
  title:'Un poco de contexto, si te apetece',query:'Texto de búsqueda',search:'Buscar esto',dismiss:'Ahora no',
  privacy:'Solo este texto se enviará a la búsqueda web. Evita nombres privados y direcciones.',
  unavailable:'La búsqueda no está disponible ahora. Puedes seguir contando tu historia.',searching:'Buscando una conexión útil…',
  discoveries:'Descubrimientos de tu historia',background:'Elige qué se relaciona con tu recuerdo. Las fuentes que incluyas aparecerán como contexto en una sección aparte.',
  read:'Leer la fuente',talk:'Hablar de esto',include:'Incluir como contexto en mi periódico',
  empty:'Esta vez no encontramos una conexión útil. Puedes cambiar el texto de búsqueda o seguir con tu historia.'
 }
};

type ResearchThreadProps={
 story:Story;
 disabled:boolean;
 canSearch:boolean;
 searching:boolean;
 searched:boolean;
 onSearch:(query:string)=>void;
 onDismiss:()=>void;
 onExplore:(source:Source)=>void;
 onUpdateSource:(id:string,value:Partial<Source>)=>void;
};

export function ResearchThread({story,disabled,canSearch,searching,searched,onSearch,onDismiss,onExplore,onUpdateSource}:ResearchThreadProps){
 const c=copy[story.language],suggestion=story.researchSuggestion;
 const [query,setQuery]=useState(suggestion?.query||'');
 const queryId=useId(),privacyId=useId();
 const locked=disabled||searching;
 useEffect(()=>setQuery(suggestion?.query||''),[suggestion?.query]);
 if(!suggestion&&!story.sources.length&&!searching&&!searched)return null;

 return <section className="research-thread" lang={story.language} aria-label={c.title} aria-busy={searching}>
  {suggestion&&<div className="research-thread-invite">
   <div className="research-thread-heading"><Search size={17} aria-hidden="true"/><h2>{c.title}</h2></div>
   {suggestion.reason&&<p className="research-thread-reason">{suggestion.reason}</p>}
   <form onSubmit={e=>{e.preventDefault();if(!locked&&canSearch&&query.trim())onSearch(query.trim());}}>
    <label htmlFor={queryId}>{c.query}</label>
    <textarea id={queryId} value={query} onChange={e=>setQuery(e.target.value)} maxLength={220} rows={2} disabled={locked} aria-describedby={privacyId}/>
    <p id={privacyId} className="research-thread-note">{c.privacy}</p>
    <div className="research-thread-actions">
     <button className="secondary" type="submit" disabled={locked||!canSearch||!query.trim()}><Search size={16} aria-hidden="true"/>{c.search}</button>
     <button className="text-button" type="button" onClick={onDismiss} disabled={locked}>{c.dismiss}</button>
    </div>
    {!canSearch&&<p className="research-thread-note">{c.unavailable}</p>}
   </form>
  </div>}
  {searching&&<p className="research-thread-status" role="status"><LoaderCircle size={18} aria-hidden="true"/>{c.searching}</p>}
  {searched&&!searching&&!story.sources.length&&<p className="research-thread-empty" role="status">{c.empty}</p>}
  {story.sources.length>0&&<details className="research-thread-discoveries" open={searched}>
   <summary>{c.discoveries} <span>({story.sources.length})</span></summary>
   <p className="research-thread-note">{c.background}</p>
   <div className="research-thread-sources">{story.sources.map(source=>{
    const url=safeSourceUrl(source.url);
    return <article className="research-thread-source" key={source.id}>
     <div className="research-thread-source-meta"><span>{source.publisher}</span>{source.date&&<span>{source.date}</span>}</div>
     <h3>{source.title}</h3>
     <p>{source.description}</p>
     {url&&<a className="research-thread-source-link" href={url} target="_blank" rel="noopener noreferrer">{c.read}<ExternalLink size={14} aria-hidden="true"/></a>}
     <label className="research-thread-include"><input type="checkbox" checked={source.selected} disabled={locked} onChange={e=>onUpdateSource(source.id,{selected:e.target.checked})}/><span>{c.include}</span></label>
     <button className="secondary" type="button" onClick={()=>onExplore(source)} disabled={locked}>{c.talk}<ArrowRight size={16} aria-hidden="true"/></button>
    </article>;
   })}</div>
  </details>}
 </section>;
}
