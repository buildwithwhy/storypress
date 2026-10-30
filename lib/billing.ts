import {z} from 'zod';

// The billing block the account payload carries (paywall §4): the Stripe
// configuration flag plus the signed-in owner's entitlement state and
// monotonic story counter. The services payload reuses the configured flag
// alone, next to the other capability flags.
export const billingStatusSchema=z.object({
 configured:z.boolean(),
 plan:z.enum(['free','subscription','lifetime']),
 addons:z.array(z.string()),
 storiesCreated:z.number().int().min(0),
 freeStoryLimit:z.number().int().min(0)
});
export type BillingStatus=z.infer<typeof billingStatusSchema>;
export const billingFlagSchema=z.object({configured:z.boolean()});
export type BillingFlag=z.infer<typeof billingFlagSchema>;
// The addons column is a JSON text array (e.g. '["video"]'); a malformed or
// unexpected value reads as no addons rather than failing the payload.
export function parseAddons(text:string|undefined):string[]{
 try{const value=JSON.parse(text??'[]');return Array.isArray(value)&&value.every(item=>typeof item==='string')?value as string[]:[];}
 catch{return[];}
}

// Client gate (paywall §5): true only when billing is configured, the owner is
// on the free plan, and the monotonic counter has reached the allowance. While
// Stripe is unconfigured this is always false — a founder setup step must
// never block a writer. Pure so the UI renders the same answer the server's
// reserve RPC would.
export function freeStoryLimitReached(billing:BillingStatus):boolean{
 return billing.configured&&billing.plan==='free'&&billing.storiesCreated>=billing.freeStoryLimit;
}
