import {serveVercel} from '../server/vercel.mjs';
export default {fetch:request=>serveVercel(request,'/api/billing')};
