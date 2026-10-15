import worker from '../worker/index.js';

// Vercel uses Supabase identity. Never trust the private Sites proxy's header here.
export async function serveVercel(request, pathname, env = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SECRET_KEY) {
    if (pathname === '/api/account' && request.method === 'GET') {
      return Response.json({user:null,supabase:null,storage:false,linkSharing:false,dailyUnits:null,sampleOnly:true},
        {headers:{'Cache-Control':'no-store'}});
    }
    return Response.json({error:'Account services are not connected yet. The sample is still available.'},
      {status:503, headers:{'Cache-Control':'no-store'}});
  }
  const url = new URL(request.url);
  url.pathname = pathname;
  const headers = new Headers(request.headers);
  headers.delete('oai-authenticated-user-id');
  headers.delete('oai-sites-authorization');
  return worker.fetch(new Request(url, {method:request.method, headers,
    ...(!['GET','HEAD'].includes(request.method) ? {body:request.body, duplex:'half'} : {})}), env);
}
