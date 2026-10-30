import {z} from 'zod';
export const interviewResult=z.object({question:z.string().min(1).max(600),acknowledgement:z.string().max(200).optional(),readyToWrite:z.boolean().default(false),researchSuggestion:z.object({query:z.string().trim().min(1).max(220),reason:z.string().trim().min(1).max(200)}).nullable().optional()});
export type InterviewResult=z.infer<typeof interviewResult>;

// Preview only the first question field, never reasoning, JSON or source fields.
// A preview is transient; only the complete schema-validated result is saved.
export function questionPreview(raw:string){
 const start=/^\s*(?:```(?:json)?\s*)?\{\s*"question"\s*:\s*"/.exec(raw);if(!start)return '';
 let text='';for(let i=start[0].length;i<raw.length&&text.length<600;i++){
  const char=raw[i];if(char==='"')break;
  if(char==='\\'){
   const next=raw[++i];if(next===undefined)break;
   if(next==='u'){const hex=raw.slice(i+1,i+5);if(!/^[\da-f]{4}$/i.test(hex))break;text+=String.fromCharCode(parseInt(hex,16));i+=4;}
   else {const escaped:Record<string,string>={'"':'"','\\':'\\','/':'/','n':'\n','r':'\r','t':'\t','b':'\b','f':'\f'};if(!(next in escaped))break;text+=escaped[next];}
  }else text+=char;
 }
 // Don't display half of a surrogate pair while a chunk is still arriving.
 return text.replace(/[\uD800-\uDBFF]$/,'');
}


// Length of the leading run of complete sentences in a streamed question —
// the text through the last sentence-final mark (closing quotes included).
// CJK marks, question and exclamation marks are unambiguous; a Latin period
// only ends a sentence when followed by whitespace or the end of the text,
// so decimals and abbreviations stay attached. A rare false split (for
// example "Mr.") costs a little spoken cadence, never content: only the
// fully validated reply is ever persisted.
export function spokenSentencesLength(text:string){
 const closers='」』”’”）)';
 const scan=(i:number)=>{let j=i+1;while(j<text.length&&closers.includes(text[j]))j++;return j;};
 let end=0;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if('。！？!?…'.includes(char)){end=scan(i);continue;}
  if(char==='.'){const j=scan(i);if(text[j]===undefined||/\s/.test(text[j]))end=j;}
 }
 return end;
}