import { handleApi } from '../server/api';
import {accountApi,storiesApi,sharedEdition,type Bindings} from '../server/storage';
import {billingApi} from '../server/billing';
import {invitesApi} from '../server/invites';
import { html, css, javascript, icon } from 'virtual:storypress-assets';
export default {
 async fetch(request: Request, env: Bindings) {
  const url = new URL(request.url);
  if(url.pathname === '/api/story') return handleApi(request,env);
  if(url.pathname === '/api/account') return accountApi(request,env);
  if(url.pathname === '/api/billing') return billingApi(request,env);
  if(url.pathname === '/api/stories') return storiesApi(request,env);
 if(url.pathname === '/api/invites') return invitesApi(request,env);
  if(url.pathname.startsWith('/s/')) return sharedEdition(request,env,url.pathname.slice(3));
  if(!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405});
  // Guest invite pages serve the app shell under stricter headers: the token
  // in the path must not be indexed, framed, or leaked via Referrer.
  if(/^\/i\/[a-f0-9]{64}$/.test(url.pathname)) return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"}});
  const routes: Record<string,[string,string]> = {'/app.js':[javascript,'text/javascript; charset=utf-8'],'/app.css':[css,'text/css; charset=utf-8'],'/favicon.svg':[icon,'image/svg+xml'],'/':[html,'text/html; charset=utf-8']};
  const route=routes[url.pathname];
  if(!route) return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:route[0],{headers:{'Content-Type':route[1],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
 }
};
