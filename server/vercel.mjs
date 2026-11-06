import worker from '../worker/index.js';

// Vercel uses Supabase identity. Never trust the private Sites proxy's header here.
export async function serveVercel(request, pathname, env = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SECRET_KEY) {
    if (pathname === '/api/account' && request.method === 'GET') {
      // Mirror of freeStoryLimit()/subscriptionMonthlyCap()/pack30Credits()/
      // pack100Credits() in server/storage.ts (kept in sync by hand —
      // this file runs unbundled on Vercel and cannot import built TS).
      // Owner state (this month's draws, remaining pack credits) is zero
      // here: dormant deployments have no database to read it from.
      const raw = String(env.STORYPRESS_FREE_STORIES ?? '').trim(), limit = Number(raw);
      const freeStoryLimit = raw && Number.isInteger(limit) && limit >= 0 ? limit : 3;
      const capRaw = String(env.STORYPRESS_SUBSCRIPTION_MONTHLY_CAP ?? '').trim(), cap = Number(capRaw);
      const subscriptionMonthlyCap = capRaw && Number.isInteger(cap) && cap >= 0 ? cap : 50;
      const p30Raw = String(env.STORYPRESS_PACK_30_CREDITS ?? '').trim(), pack30 = Number(p30Raw);
      const pack30Credits = p30Raw && Number.isInteger(pack30) && pack30 > 0 ? pack30 : 30;
      const p100Raw = String(env.STORYPRESS_PACK_100_CREDITS ?? '').trim(), pack100 = Number(p100Raw);
      const pack100Credits = p100Raw && Number.isInteger(pack100) && pack100 > 0 ? pack100 : 100;
      return Response.json({user:null,supabase:null,storage:false,linkSharing:false,dailyUnits:null,sampleOnly:true,
        billing:{configured:!!env.STRIPE_SECRET_KEY,plan:'free',addons:[],storiesCreated:0,freeStoryLimit,subscriptionMonthlyCap,pack30Credits,pack100Credits,subscriptionStoriesThisMonth:0,packCreditsRemaining:0}},
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
  return worker.fetch(new Request(url, {method:request.method, headers, signal:request.signal,
    ...(!['GET','HEAD'].includes(request.method) ? {body:request.body, duplex:'half'} : {})}), env);
}
