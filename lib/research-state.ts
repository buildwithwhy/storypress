import {originalWords,type Story,type Source} from './story';
// Appended answers are safe; corrections or a different story invalidate the request.
export function mergeResearch(current:Story,base:Story,sources:Source[],query:string):Story{
 const before=originalWords(base),now=originalWords(current);
 if(current.language!==base.language||before.some((text,i)=>now[i]!==text))return current;
 const byUrl=new Map(current.sources.map(s=>[s.url,s]));
 for(const source of sources)if(!byUrl.has(source.url))byUrl.set(source.url,{...source,selected:false});
 return {...current,sources:[...byUrl.values()].sort((a,b)=>Number(b.selected)-Number(a.selected)).slice(0,8),researchSuggestion:current.researchSuggestion?.query===base.researchSuggestion?.query&&sources.length?null:current.researchSuggestion,researchQueries:[...new Set([...(current.researchQueries||[]),query])].slice(-60)};
}
