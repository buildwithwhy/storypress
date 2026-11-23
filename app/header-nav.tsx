import {Plus} from 'lucide-react';
import {saveCopy} from '../lib/save-copy';
import {sharingCopy} from '../lib/sharing-copy';
import {type Story} from '../lib/story';
import {HeaderAccount} from './header-account';

// The header's story-and-account nav (founder UX round): "New story" and "My
// stories" are ALWAYS top-level, in both sign-in states — stories are the
// product, so they never hide inside a menu. Weighting (overnight fix): New
// story is the clear primary (filled); My stories stays a quieter secondary
// outline. Signed out, a quiet Sign in link
// sits beside them (only when Supabase is configured); signed in, the avatar
// menu replaces it. Extracted from the app shell as a pure component so the
// purchase-flow check can SSR the exact header structure the app renders.
export function HeaderNav({language,signedIn,supabase,sampleOnly=false,disabled=false,email,onNewStory,onMyStories,onSignIn,onPlanAndBilling,onSignOut}:{language:Story['language'];signedIn:boolean;supabase:boolean;sampleOnly?:boolean;disabled?:boolean;email?:string;onNewStory:()=>void;onMyStories:()=>void;onSignIn?:()=>void;onPlanAndBilling:()=>void;onSignOut:()=>void;}){
 const sc=saveCopy[language];
 return <div className="header-right">
  <button className="text-button nav-primary" disabled={disabled||sampleOnly} onClick={onNewStory}><Plus size={16}/>{sc.newStory}</button>
  <button className="text-button nav-secondary account-nav" disabled={disabled||sampleOnly} onClick={onMyStories}>{sharingCopy[language].account}</button>
  {signedIn
   ?<HeaderAccount language={language} signedIn email={email} onPlanAndBilling={onPlanAndBilling} onSignOut={onSignOut}/>
   :supabase&&<HeaderAccount language={language} signedIn={false} onSignIn={onSignIn} onPlanAndBilling={()=>{}} onSignOut={()=>{}}/>}
 </div>;
}
