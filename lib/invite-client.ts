import {type Turn} from './story';
import {accountHeaders} from './account-client';

// Client helpers for contributor invitations: the owner panel and the
// token-scoped /i/<token> guest surface share these.
export function parseInviteToken(pathname:string){const match=/^\/i\/([a-f0-9]{64})$/.exec(pathname);return match?match[1]:null;}

const INVITE_DRAFT_PREFIX='storypress-invite-draft-v1';
export const inviteDraftKey=(tokenValue:string)=>`${INVITE_DRAFT_PREFIX}:${tokenValue}`;
const INVITE_SENT_PREFIX='storypress-invite-sent-v1';
export const inviteSentKey=(tokenValue:string)=>`${INVITE_SENT_PREFIX}:${tokenValue}`;
export type InviteSent={contributionId:string;authorLabel:string;at:string};

// Mirrors the server margin under the database's 50000-octet column guard,
// so the guest sees a kind message instead of an opaque rejection.
export const GUEST_TURNS_OCTET_LIMIT=40000;
export function guestTurnsOctets(turns:Turn[]){return new TextEncoder().encode(JSON.stringify(turns)).length;}

export async function inviteApi(body?:unknown,query?:string){
 const response=await fetch(`/api/invites${query?`?${query}`:''}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...await accountHeaders()},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json() as {error?:string};
 if(!response.ok)throw new Error(data.error||'That step did not finish. Please try again.');
 return data;
}
