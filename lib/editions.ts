import {languageNames} from './translation';
import {type Language,type Story} from './story';

// Owner-facing edition clarity (translation fix §4): translations are separate
// saved rows linked by originStoryId; this module derives what the owner sees —
// switcher targets on the paper stage and provenance labels in My stories.
// The list query (server/storage.ts) aliases the two already-persisted signals
// out of the data JSON; nothing new is stored.
export type StoryListRow={id:string;title:string;origin_story_id?:string|null;paper_language?:Language|null};
type RawListRow=Record<string,unknown>;
const editionLanguages:Language[]=['en','zh','es'];

export function parseStoryRows(value:unknown):StoryListRow[]{
 if(!Array.isArray(value))return [];
 return value.filter((row):row is RawListRow=>!!row&&typeof row==='object'&&typeof (row as RawListRow).id==='string'&&typeof (row as RawListRow).title==='string')
  .map(row=>({id:row.id as string,title:row.title as string,
   origin_story_id:typeof row.origin_story_id==='string'?row.origin_story_id:null,
   paper_language:editionLanguages.includes(row.paper_language as Language)?row.paper_language as Language:null}));
}

// A copy of a copy links to the original, never the intermediate: an existing
// originStoryId always wins over the current row's own identity.
export function translationOriginId(current:Story,savedIdentityId?:string|null){return current.originStoryId??(savedIdentityId||undefined);}

// Switcher targets for the paper stage: the original row when viewing a copy,
// and every translation pointing at the current story. Pure row lookups —
// switching loads the other saved row directly, never a re-translation.
export function editionTargets(current:{id?:string|null;originStoryId?:string},rows:StoryListRow[]):{original?:StoryListRow;translations:StoryListRow[]}{
 if(current.originStoryId){
  const original=rows.find(row=>row.id===current.originStoryId);
  const translations=rows.filter(row=>row.origin_story_id===current.originStoryId&&row.id!==current.id);
  return {original,translations};
 }
 return {translations:current.id?rows.filter(row=>row.origin_story_id===current.id):[]};
}

export const editionCopy={
 en:{editions:'Editions',original:'Original',translation:'Translation',translationOf:'translation of'},
 zh:{editions:'版本',original:'原作',translation:'翻译版',translationOf:'译自'},
 es:{editions:'Ediciones',original:'Original',translation:'Traducción',translationOf:'traducción de'}
};

function editionLanguageName(row:{paper_language?:string|null},language:Language){return row.paper_language?languageNames[language][row.paper_language as Language]:undefined;}

// Switcher button: the edition kind plus its reading language, e.g. "Translation · 中文".
export function editionButtonLabel(row:{paper_language?:string|null},kind:'original'|'translation',language:Language){
 const c=editionCopy[language],name=editionLanguageName(row,language);
 return name?`${c[kind]} · ${name}`:c[kind];
}

// My stories provenance note for a translated copy, e.g.
// "Chinese · translation of Grandma’s kitchen". Original rows have no note.
export function editionRowNote(row:StoryListRow,rows:StoryListRow[],language:Language){
 if(!row.origin_story_id)return '';
 const c=editionCopy[language],name=editionLanguageName(row,language);
 const original=rows.find(candidate=>candidate.id===row.origin_story_id);
 if(!original)return name?`${name} · ${c.translation}`:c.translation;
 const origin=language==='zh'?`${c.translationOf}《${original.title}》`:`${c.translationOf} ${original.title}`;
 return name?`${name} · ${origin}`:origin;
}
