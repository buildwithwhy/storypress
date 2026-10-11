import {serveVercel} from '../server/vercel.mjs';
export default {fetch(request){
  const url=new URL(request.url);
  const token=url.pathname.startsWith('/s/')?url.pathname.slice(3):url.searchParams.get('token');
  if(!/^[a-f0-9]{64}$/.test(token||''))return new Response('Not found',{status:404});
  return serveVercel(request,'/s/'+token);
}};
