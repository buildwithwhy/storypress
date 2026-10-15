import {type Story, safeSourceUrl} from './story';
import {keepsakeMarkup,keepsakeStyles,keepsakeCopy} from './keepsake';
import {shareFlowCopy} from './share-flow-copy';
import {artworkPath,artworkCopy,chosenArtwork,artworkCaption,artworkAlt} from './artwork';
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function editionSnapshot(story: Story): Story {
 if (!story.paper || !story.approved) throw new Error('Please review and approve your newspaper first.');
 return {name:story.name,presentation:story.presentation,intention:story.presentation?.format==='letter'?story.intention:undefined,language:story.language,occasion:story.occasion,turns:[],sources:story.sources.filter(s=>s.selected).map(s=>({...s,connection:"",question:"",reaction:undefined})),paper:story.paper,photo:chosenArtwork(story)==='generated'||chosenArtwork(story)==='none'?undefined:story.photo,photoCaption:chosenArtwork(story)==='generated'||chosenArtwork(story)==='none'?undefined:story.photoCaption,generatedArt:chosenArtwork(story)==='generated'?story.generatedArt:undefined,artwork:story.artwork,approved:true,sample:story.sample};
}
export function editionHtml(story: Story, illustrationSrc?:string, options:{webReader?:boolean}={}) {
 const shared=shareFlowCopy[story.language],c=keepsakeCopy[story.language];
 if(!story.paper)throw new Error('No keepsake yet.');
 const reader=options.webReader?`<section class="reader-next"><p>STORYPRESS</p><h2>${shared.readerTitle}</h2><p>${shared.readerDescription}</p><a href="/?from=shared&amp;lang=${story.language}" rel="noreferrer">${shared.readerAction} →</a></section>`:'';
 // The downloaded document contains only the approved snapshot and embedded illustration.
 const download=options.webReader?`<a class="download" href="?download=1">${c.download}</a>`:'';
 return `<!doctype html><html lang="${story.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><meta property="og:type" content="article"><meta property="og:title" content="${escape(shared.sharedTitle)}"><meta property="og:description" content="${escape(shared.previewDescription)}"><title>${escape(options.webReader?shared.sharedTitle:story.paper.headline)} · Storypress</title><style>body{margin:0;padding:24px 12px;background:#f4f1e8;color:#29382d}.reader-actions{display:flex;justify-content:center;gap:12px;margin:0 auto 24px}.print,.download,.reader-next a{border:0;border-radius:7px;background:#224d3e;color:white;padding:14px 20px;font:15px system-ui;text-decoration:none;cursor:pointer}.reader-next{text-align:center;max-width:600px;margin:35px auto;padding:25px;font:16px/1.7 system-ui}.reader-next h2{font:32px Georgia}.reader-next a{display:inline-block;margin-top:10px}.print:focus-visible,a:focus-visible{outline:3px solid #bd953b;outline-offset:4px}${keepsakeStyles}@media print{@page{size:A4;margin:15mm}body{background:white;padding:0}.print,.download,.reader-actions,.reader-next{display:none}}</style></head><body><nav class="reader-actions"><button class="print" onclick="window.print()">${c.print}</button>${download}</nav>${keepsakeMarkup(story,illustrationSrc)}${reader}</body></html>`;
}
