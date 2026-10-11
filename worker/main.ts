import { handleApi } from '../server/api';
import {accountApi,storiesApi,sharedEdition,type Bindings} from '../server/storage';
import { html, css, javascript, icon } from 'virtual:storypress-assets';
export default {
 async fetch(request: Request, env: Bindings) {
  const url = new URL(request.url);
  if(url.pathname === '/api/story') return handleApi(request,env);
  if(url.pathname === '/api/account') return accountApi(request,env);
  if(url.pathname === '/api/stories') return storiesApi(request,env);
  if(url.pathname.startsWith('/s/')) return sharedEdition(request,env,url.pathname.slice(3));
  if(!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405});
  const routes: Record<string,[string,string]> = {'/app.js':[javascript,'text/javascript; charset=utf-8'],'/app.css':[css,'text/css; charset=utf-8'],'/favicon.svg':[icon,'image/svg+xml'],'/':[html,'text/html; charset=utf-8']};
  const route=routes[url.pathname];
  if(!route) return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:route[0],{headers:{'Content-Type':route[1],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
 }
};
