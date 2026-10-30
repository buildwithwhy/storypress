import {type Story, safeSourceUrl, artifactLanguage} from './story';
import {keepsakeMarkup,keepsakeStyles,keepsakeCopy,transcriptMarkup,mastheadOf,selectedSources,sourceSection,formatOf} from './keepsake';
import {shareFlowCopy} from './share-flow-copy';
import {artworkPath,artworkCopy,chosenArtwork,artworkCaption,artworkAlt} from './artwork';
import {readerTools,readerScript,readerStyles} from './reader';
import {languageNames} from './translation';
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
 const views=editionViews(story),primary=artifactLanguage(story);
 const shared=shareFlowCopy[primary],c=keepsakeCopy[primary],base=views[0].story;
 if(!base.paper)throw new Error('No keepsake yet.');
 const reader=options.webReader?`<section class="reader-next"><p>ONCE &amp; OURS</p><h2>${shared.readerTitle}</h2><p>${shared.readerDescription}</p><a href="/?from=shared&amp;lang=${primary}" rel="noreferrer">${shared.readerAction} →</a></section>`:'';
 const multilingual=views.length>1;
 // Every edition is server-rendered; the switcher only toggles visibility, so no-JS readers see the default language.
 const pages=views.map(view=>`<div data-reader-lang="${view.language}"${view.language===primary?'':' hidden'}>${keepsakeMarkup(view.story,illustrationSrc).replace(/<h2 class="keepsake-title">(.*?)<\/h2>/s,'<h1 class="keepsake-title">$1</h1>')}${transcriptMarkup(view.story)}</div>`).join('')
  +languagePairs(views).map(({key,left,right})=>`<div data-reader-pair="${key}" hidden>${parallelMarkup(left,right)}</div>`).join('');
 // The downloaded document contains only the approved snapshot and embedded illustration.
 return `<!doctype html><html lang="${primary}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><meta name="description" content="${escape(shared.previewDescription)}"><meta property="og:type" content="article"><meta property="og:title" content="${escape(shared.sharedTitle)}"><meta property="og:description" content="${escape(shared.previewDescription)}"><title>${escape(options.webReader?shared.sharedTitle:base.paper.headline)} · Once &amp; Ours</title><style>${readerStyles}${keepsakeStyles}@media print{@page{size:A4;margin:15mm}body{background:white;padding:0}.print,.download,.reader-actions,.reader-next,.keepsake-transcript{display:none}}</style></head><body>${readerTools(base,!!options.webReader,c.print,multilingual?{languages:views.map(v=>({value:v.language,label:languageNames[primary][v.language]})),current:primary}:undefined)}<main>${pages}</main>${reader}${readerScript(primary,!!options.webReader)}</body></html>`;
}
// Side-by-side reading: text-parallel rows, one cell per language. Figures stay on the
// single-language editions (photos are identical across them), which keeps paired pages light.
export function parallelMarkup(a:Story,b:Story){
 const first=artifactLanguage(a),second=artifactLanguage(b),c=keepsakeCopy[first],pa=a.paper,pb=b.paper;
 if(!pa||!pb)throw new Error('No keepsake yet.');
 const gap='<span aria-hidden="true"></span>';
 const row=(left:string,right:string)=>`<div class="keepsake-pair">${left}${right}</div>`;
 const by=a.name?`<p class="keepsake-by">${c.by} ${escape(a.name)}</p>`:'';
 const sourcesA=selectedSources(a),sourcesB=selectedSources(b);
 const context=(sourcesA.length||sourcesB.length)?`<aside class="keepsake-context"><h2>${c.context}</h2>${zipLongest(sourcesA,sourcesB).map(([x,y])=>row(x?sourceSection(x,first):gap,y?sourceSection(y,second):gap)).join('')}</aside>`:'';
 const quote=(pa.quote||pb.quote)?row(pa.quote?`<blockquote lang="${first}">“${escape(pa.quote)}”</blockquote>`:gap,pb.quote?`<blockquote lang="${second}">“${escape(pb.quote)}”</blockquote>`:gap):'';
 return `<article class="keepsake keepsake-${formatOf(a)} keepsake-parallel" lang="${first}"><section class="keepsake-leaf"><header class="keepsake-masthead">${mastheadOf(a)}</header>${by}${row(`<h2 class="keepsake-title" lang="${first}">${escape(pa.headline)}</h2>`,`<h2 class="keepsake-title" lang="${second}">${escape(pb.headline)}</h2>`)}${(pa.standfirst||pb.standfirst)?row(pa.standfirst?`<p class="keepsake-intro" lang="${first}">${escape(pa.standfirst)}</p>`:gap,pb.standfirst?`<p class="keepsake-intro" lang="${second}">${escape(pb.standfirst)}</p>`:gap):''}<div class="keepsake-prose">${zipLongest(pa.paragraphs,pb.paragraphs).map(([x,y])=>row(x?`<p lang="${first}">${escape(x)}</p>`:gap,y?`<p lang="${second}">${escape(y)}</p>`:gap)).join('')}</div>${quote}${context}</section><footer class="keepsake-colophon">${c.credit} · ONCE &amp; OURS</footer></article>`;
}
function zipLongest<T>(xs:T[],ys:T[]):[T|undefined,T|undefined][]{return Array.from({length:Math.max(xs.length,ys.length)},(_,i)=>[xs[i],ys[i]]);}
function languagePairs(views:{language:Story['language'];story:Story}[]){const out:{key:string;left:Story;right:Story}[]=[];for(let i=0;i<views.length;i++)for(let j=i+1;j<views.length;j++){const [left,right]=[views[i],views[j]].sort((x,y)=>x.language<y.language?-1:1);out.push({key:left.language+'+'+right.language,left:left.story,right:right.story});}return out;}
