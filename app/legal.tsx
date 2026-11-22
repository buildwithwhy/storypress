import {legalCopy, type LegalPageId} from '../lib/legal-copy';
import {type Story} from '../lib/story';

// Legal pages (/terms /privacy /refunds). Presentational and copy-driven,
// like the pricing page: the language follows the header language picker
// (story.language) and `question: true` paragraphs render as prominent
// founder-question callouts. Cross-links stay inside the SPA.
export function LegalPage({id, language, onOpen}:{id:LegalPageId; language:Story['language']; onOpen:(id:LegalPageId)=>void}){
  const c=legalCopy[language];
  const page=c.pages[id];
  const others=(Object.keys(c.links) as LegalPageId[]).filter(k=>k!==id);
  return <main className="legal-page" lang={language}>
    <h1>{page.title}</h1>
    <p className="legal-updated">{page.updated}</p>
    <p className="legal-intro">{page.intro}</p>
    {page.sections.map((section,i)=><section className="legal-section" key={i}>
      <h2>{section.heading}</h2>
      {section.paragraphs.map((text,j)=>
        section.question
          ? <p className="legal-question" key={j}><strong>{c.questionLabel}:</strong> {text.replace(/^QUESTION FOR FOUNDER:\s*|^创始人待确认问题：\s*|^PREGUNTA PARA LA FUNDADORA:\s*/,'')}</p>
          : <p key={j}>{text}</p>)}
    </section>)}
    <nav className="legal-related" aria-label={c.readAlso}>
      <span className="legal-related-label">{c.readAlso}:</span>
      {others.map(k=><button type="button" key={k} className="text-button" onClick={()=>onOpen(k)}>{c.links[k]}</button>)}
    </nav>
  </main>;
}
