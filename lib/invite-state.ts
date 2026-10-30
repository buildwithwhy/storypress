// Pure invite-flow rules shared by the server API and the check script:
// token shape, open/expired/revoked state, and the attributed approval merge.
import {type Story,type Turn} from './story';

// The capability is a 64-hex token — exactly what the server mints.
export const isInviteToken=(value:string)=>/^[a-f0-9]{64}$/.test(value);

export type InviteStatus='open'|'expired'|'revoked';

export function inviteStatus(row:{status:string;expires_at:string},now:number):InviteStatus{
 if(row.status!=='open')return row.status==='revoked'?'revoked':'expired';
 return new Date(row.expires_at).getTime()<=now?'expired':'open';
}

// Owner approval is the only path that appends to the story blob. Guest user
// turns carry the contributor attribution; interviewer questions ride along
// so the conversation reads whole. The keepsake needs review again afterwards.
export function applyApproval(story:Story,turns:Turn[],authorLabel:string,userId?:string){
 if(!turns.length)throw new Error('contribution-empty');
 if(story.turns.length+turns.length>60)throw new Error('transcript-full');
 const attribution={label:authorLabel,...(userId?{userId}:{})};
 return {...story,turns:[...story.turns,...turns.map(t=>t.role==='user'?{...t,author:attribution}:t)],approved:false};
}
