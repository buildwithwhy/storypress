import {serveVercel} from '../server/vercel.mjs';
export default {fetch:(request,env)=>serveVercel(request,'/api/billing',env)};
