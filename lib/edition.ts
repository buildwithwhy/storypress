import {type Story, safeSourceUrl, artifactLanguage} from './story';
import {keepsakeMarkup,keepsakeStyles,keepsakeCopy} from './keepsake';
import {shareFlowCopy} from './share-flow-copy';
import {artworkPath,artworkCopy,chosenArtwork,artworkCaption,artworkAlt} from './artwork';
import {readerTools,readerScript,readerStyles} from './reader';
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function editionSnapshot(story: Story): Story {
 if (!story.paper || !story.approved) throw new Error('Please review and approve your newspaper first.');
 return {name:story.name,presentation:story.presentation,intention:story.presentation?.format==='letter'?story.intention:undefined,language:artifactLanguage(story),occasion:story.occasion,turns:[],sources:story.sources.filter(s=>s.selected).map(s=>({...s,connection:"",question:"",reaction:undefined})),paper:story.paper,photo:chosenArtwork(story)==='generated'||chosenArtwork(story)==='none'?undefined:story.photo,photoCaption:chosenArtwork(story)==='generated'||chosenArtwork(story)==='none'?undefined:story.photoCaption,generatedArt:chosenArtwork(story)==='generated'?story.generatedArt:undefined,artwork:chosenArtwork(story),approved:true,sample:story.sample};
}
export type EditionLanguage=Story['language'];
// A shared bundle reads as one edition per language: the base keepsake plus its approved
// translations. Legacy snapshots (no editions map) read as a single default-language view.
export function editionViews(story:Story):{language:EditionLanguage;story:Story}[]{
 const views:{language:EditionLanguage;story:Story}[]=[{language:artifactLanguage(story),story:{...story,editions:undefined,defaultLanguage:undefined}}];
 for(const language of ['en','zh','es'] as const){
  const edition=story.editions?.[language];
  // The map key is the switching source of truth, so it pins the edition's render language.
  if(edition&&language!==views[0].language)views.push({language,story:{...edition,language,paperLanguage:language}});
 }
 return views;
}
// Bundles the approved keepsake with its approved translated keepsakes. Interview turns join
// the bundle only when the storyteller translated the transcript — an explicit opt-in.
export function multilingualSnapshot(story:Story,translations:Story[]):Story{
 const snapshot=editionSnapshot(story),primary=artifactLanguage(story);
 const sharingTranscript=!!story.transcriptTranslations&&Object.keys(story.transcriptTranslations).length>0;
 const editions:NonNullable<Story['editions']>={};
 for(const translation of translations){
  const language=artifactLanguage(translation);
  if(language===primary||!translation.paper||!translation.approved)continue;
  const edition=editionSnapshot(translation);
  edition.turns=sharingTranscript?story.transcriptTranslations?.[language]??[]:[];
  editions[language]=edition;
 }
 if(sharingTranscript)snapshot.turns=story.turns;
 if(!Object.keys(editions).length)return snapshot;
 return {...snapshot,editions,defaultLanguage:primary};
}
export function editionHtml(story: Story, illustrationSrc?:string, options:{webReader?:boolean}={}) {
 story={...story,language:artifactLanguage(story)};
 const shared=shareFlowCopy[story.language],c=keepsakeCopy[story.language];
 if(!story.paper)throw new Error('No keepsake yet.');
 const reader=options.webReader?`<section class="reader-next"><p>ONCE &amp; OURS</p><h2>${shared.readerTitle}</h2><p>${shared.readerDescription}</p><a href="/?from=shared&amp;lang=${story.language}" rel="noreferrer">${shared.readerAction} →</a></section>`:'';
 // The downloaded document contains only the approved snapshot and embedded illustration.
 const markup=keepsakeMarkup(story,illustrationSrc).replace(/<h2 class="keepsake-title">(.*?)<\/h2>/s,'<h1 class="keepsake-title">$1</h1>');
 return `<!doctype html><html lang="${story.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><meta name="description" content="${escape(shared.previewDescription)}"><meta property="og:type" content="article"><meta property="og:title" content="${escape(shared.sharedTitle)}"><meta property="og:description" content="${escape(shared.previewDescription)}"><title>${escape(options.webReader?shared.sharedTitle:story.paper.headline)} · Once &amp; Ours</title><style>${readerStyles}${keepsakeStyles}@media print{@page{size:A4;margin:15mm}body{background:white;padding:0}.print,.download,.reader-actions,.reader-next{display:none}}</style></head><body>${readerTools(story,!!options.webReader,c.print)}<main>${markup}</main>${reader}${readerScript(story.language,!!options.webReader)}</body></html>`;
}
