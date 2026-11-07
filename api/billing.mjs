import {serveVercel} from '../server/vercel.mjs';
// serveVercel already defaults env to process.env. Vercel's fetch handler binds
// a second argument that is NOT the deployment environment — forwarding it
// starves the Supabase guard and 503s every request to this route.
export default {fetch:request=>serveVercel(request,'/api/billing')};
