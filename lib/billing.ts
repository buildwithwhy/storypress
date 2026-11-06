import {z} from 'zod';

// The billing block the account payload carries (paywall §4): the Stripe
// configuration flag plus the signed-in owner's entitlement state, monotonic
// story counter, and wave-8 owner state — this month's subscription-window
// draws and the remaining pack balance — next to the env-tuned cap and pack
// sizes the UI interpolates. The services payload reuses the configured flag
// alone, next to the other capability flags.
export const billingStatusSchema=z.object({
 configured:z.boolean(),
 // 'lifetime' is a legacy read-only value: no write path produces it since
 // wave 8, but the DB CHECK keeps the value so legacy rows stay readable and
 // entitled until the founder's zero-rows gate clears them.
 plan:z.enum(['free','subscription','lifetime']),
 addons:z.array(z.string()),
 storiesCreated:z.number().int().min(0),
 freeStoryLimit:z.number().int().min(0),
 subscriptionMonthlyCap:z.number().int().min(0),
 pack30Credits:z.number().int().min(1),
 pack100Credits:z.number().int().min(1),
 subscriptionStoriesThisMonth:z.number().int().min(0),
 packCreditsRemaining:z.number().int().min(0)
});
export type BillingStatus=z.infer<typeof billingStatusSchema>;
export const billingFlagSchema=z.object({configured:z.boolean()});
export type BillingFlag=z.infer<typeof billingFlagSchema>;

// Wave 8 §3: the price payload the server vouches for — four Stripe price
// objects (minor units + currency, exactly what the price rows carry) fetched
// server-side, cached in module scope for minutes, and served to the client in
// the account payload. `null` while dormant or when Stripe is unreachable with
// no cache; the UI then hides amounts rather than inventing numbers.
export const pricingSchema=z.object({
 currency:z.string().trim().length(3),
 monthly:z.object({amount:z.number().int().min(0)}),
 annual:z.object({amount:z.number().int().min(0)}),
 pack30:z.object({amount:z.number().int().min(0)}),
 pack100:z.object({amount:z.number().int().min(0)})
});
export type Pricing=z.infer<typeof pricingSchema>;

// Minor units → a display string the dormant fallback copy is written to match
// ('$12', not '$12.00', when whole dollars). USD-only per the locked wave-8
// decisions; any other currency code renders explicitly rather than silently
// borrowing the dollar sign.
export function formatPrice(amount:number,currency:string):string{
 const code=currency.trim().toLowerCase();
 const major=amount/100;
 const text=Number.isInteger(major)?String(major):major.toFixed(2);
 return code==='usd'?`$${text}`:`${currency.trim().toUpperCase()} ${text}`;
}

// Annual saving vs twelve months at the monthly rate, computed from the Stripe
// amounts so no language ever carries (or translates) the number. Returns null
// when the inputs cannot honestly produce a saving.
export function annualSavePercent(monthly:number,annual:number):number|null{
 if(!(monthly>0)||!(annual>=0))return null;
 const percent=Math.round((1-annual/(monthly*12))*100);
 return percent>0?percent:null;
}

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
