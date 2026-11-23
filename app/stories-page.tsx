import {useState} from 'react';
import {Plus} from 'lucide-react';
import {type Story,storySchema} from '../lib/story';
import {editionRowNote,formatStoryDate,type StoryListRow} from '../lib/editions';
import {type BillingStatus,storiesLeft} from '../lib/billing';
import {saveCopy} from '../lib/save-copy';
import {sharingCopy} from '../lib/sharing-copy';
import {purchaseCopy} from '../lib/purchase-copy';
import {accountPagesCopy} from '../lib/account-pages-copy';
import {ConfirmDialog} from './confirm-dialog';
import {confirmCopy,draftPreviewLabel} from '../lib/confirm-copy';
import {readImportableDraft,type DraftSnapshot} from '../lib/draft-handoff';

// The My stories page (/stories, founder UX round): stories first — finished
// keepsakes as cards, drafts in their own section — with "Start a new story"
// at the top and one quiet line pointing at Plan and billing. The plan panel,
// the AI-units copy and the email deliberately live on /billing only; nothing
// plan-shaped renders here at all.
export function StoriesPage({language,rows,loaded,billing,userId,onStartNew,onOpenRow,onDeleteRow,onLoadDraft,onOpenBilling}:{language:Story['language'];rows:StoryListRow[];loaded:boolean;billing:BillingStatus;userId?:string;onStartNew:()=>void;onOpenRow:(row:StoryListRow)=>void;onDeleteRow:(row:StoryListRow)=>void;onLoadDraft:(story:Story)=>void;onOpenBilling:()=>void;}){
 const c=accountPagesCopy[language];
 const sc=saveCopy[language];
 const sh=sharingCopy[language];
 const pc=purchaseCopy[language];
 const cc=confirmCopy[language];
 // Finished keepsakes first (founder order): a row is finished when the list
 // payload carries its paperLanguage — makePaper stamps it when the keepsake
 // is made. The list API returns metadata only, so there is no artwork
 // thumbnail: omitting it honestly beats fetching every story body.
 const finished=rows.filter(row=>row.paper_language);
 const drafts=rows.filter(row=>!row.paper_language);
 const [pendingDelete,setPendingDelete]=useState<StoryListRow|null>(null);
 const [importDraft,setImportDraft]=useState<DraftSnapshot|null>(null);
 return <section className="stories-page" aria-label={sh.account}>
  <div className="stories-page-head">
   <h1>{sh.account}</h1>
   <button className="primary" onClick={onStartNew}><Plus size={17}/>{sc.startNew}</button>
  </div>
  <p className="quiet left stories-left-line">{c.storiesLeft.replace('{size}',String(storiesLeft(billing)))} · <button type="button" className="text-button" onClick={onOpenBilling}>{pc.planAndBilling}</button></p>
  {!loaded?<p className="quiet left" role="status">{c.loading}</p>:
   <>
   <h2>{c.finishedHeading}</h2>
   {finished.length?<div className="story-cards">{finished.map(row=><StoryCard key={row.id} row={row} rows={rows} language={language} openLabel={sh.open} deleteLabel={sh.delete} onOpen={onOpenRow} onDelete={setPendingDelete}/>)}</div>:<p className="quiet left">{sc.empty}</p>}
   <h2>{c.draftsHeading}</h2>
   {drafts.length?<div className="story-cards">{drafts.map(row=><StoryCard key={row.id} row={row} rows={rows} language={language} openLabel={sh.open} deleteLabel={sh.delete} onOpen={onOpenRow} onDelete={setPendingDelete}/>)}</div>:<p className="quiet left">{c.noDrafts}</p>}
   {/* Device-draft import (art_ZdXAkIsg behavior kept): consent-gated and
       owner-stamped via the shared reader — a stranger's (or absent) draft
       offers nothing, never an error. */}
   <div className="stories-page-foot">
    <button type="button" className="text-button" onClick={()=>{const device=readImportableDraft(localStorage,userId);if(device)setImportDraft(device);}}>{sh.import}</button>
   </div>
   </>}
  {pendingDelete&&<ConfirmDialog title={sh.confirmDelete} confirmLabel={sh.delete} cancelLabel={cc.cancel} onConfirm={()=>{const row=pendingDelete;setPendingDelete(null);onDeleteRow(row);}} onCancel={()=>setPendingDelete(null)}/>}
  {importDraft&&<ConfirmDialog title={sh.importConfirm} body={cc.consentBody} detail={draftPreviewLabel(language,importDraft)} confirmLabel={cc.accept} cancelLabel={cc.decline} onConfirm={()=>{const draft=importDraft;setImportDraft(null);onLoadDraft(storySchema.parse(draft.story));}} onCancel={()=>setImportDraft(null)}/>}
 </section>;
}

function StoryCard({row,rows,language,openLabel,deleteLabel,onOpen,onDelete}:{row:StoryListRow;rows:StoryListRow[];language:Story['language'];openLabel:string;deleteLabel:string;onOpen:(row:StoryListRow)=>void;onDelete:(row:StoryListRow)=>void;}){
 const note=editionRowNote(row,rows,language);
 const date=formatStoryDate(row.updated_at,language);
 return <article className="story-card">
  <div className="story-card-body">
   <strong>{row.title}</strong>
   {note&&<span className="saved-story-edition">{note}</span>}
   {date&&<span className="story-card-date">{date}</span>}
  </div>
  <div className="story-card-actions">
   <button type="button" className="text-button" onClick={()=>onOpen(row)}>{openLabel}</button>
   <button type="button" className="text-button" onClick={()=>onDelete(row)}>{deleteLabel}</button>
  </div>
 </article>;
}
