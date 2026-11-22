import {z} from 'zod';

// The billing block the account payload carries (paywall §4): the Stripe
// configuration flag plus the signed-in owner's entitlement state, monotonic
// story counter, and wave-8 owner state — this month's subscription-window
// draws and the remaining pack balance — next to the env-tuned cap and pack
// sizes the UI interpolates. The services payload reuses the configured flag
// alone, next to the other capability flags.
export const billingStatusSchema=z.object({
 configured:z.boolean(),
 // No 'lifetime' in the schema: the zero-rows gate confirmed no legacy rows
 // exist, and the account read boundary fails any unexpected legacy plan value
 // back to the free tier instead of emitting it (the DB CHECK still permits
 // the value, so an unexpected row must render fail-safe, never crash).
 plan:z.enum(['free','subscription']),
 addons:z.array(z.string()),
 storiesCreated:z.number().int().min(0),
 freeStoryLimit:z.number().int().min(0),
 subscriptionMonthlyCap:z.number().int().min(0),
 pack30Credits:z.number().int().min(1),
 pack100Credits:z.number().int().min(1),
 subscriptionStoriesThisMonth:z.number().int().min(0),
 packCreditsRemaining:z.number().int().min(0),
 // Background discovery §5: today's user-scope AI usage against
 // DAILY_AI_UNIT_CAP, read from the same storypress_ai_usage row the reserve
 // RPC increments. Optional: absent when Supabase is unset or the read
 // degraded — the client then fails closed on auto-fire, never on manual use.
 dailyAiUnitsUsed:z.number().int().min(0).optional(),
 // Purchase history rows (purchase sheet revision A): rendered in the
 // account panel's Plan and billing view when the payload carries them — the
 // field itself ships server-side in the separate refund PR, so today it is
 // always absent and the panel shows the localized empty state. Optional and
 // additive: a payload without it parses unchanged.
 history:z.array(z.object({
  description:z.string(),
  amount:z.string(),
  date:z.string()
 })).optional()
});
export type BillingStatus=z.infer<typeof billingStatusSchema>;
export const billingFlagSchema=z.object({configured:z.boolean()});
export type BillingFlag=z.infer<typeof billingFlagSchema>;

// Daily AI capacity (background discovery spec §5): the reserve RPC caps
// every authenticated account at 40 units/day (migration 202610110001 —
// discover costs 3, interview/transcribe/write 1). The server reports today's
// usage beside this cap; the client's auto-discovery guard subtracts. The
// field is absent while Supabase is unset (the owner-private pilot has no
// quota) — unknown capacity never auto-fires, manual research is unaffected.
export const DAILY_AI_UNIT_CAP=40;

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
