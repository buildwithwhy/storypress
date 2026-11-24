import {formatPrice,type BillingStatus,type Pricing} from './billing';
import {paywallCopy} from './paywall-copy';
import type {CheckoutPlan} from './billing-client';
import {type Language} from './story';

// Label and amount resolution for the four purchasable options, shared by the
// /pricing page and the /billing page (founder UX round) so the two surfaces
// can never drift. planAmount resolves from the Stripe payload only — the
// dormant fallback copy is a page-display concern (see app/pricing.tsx).
export function planLabel(language:Language,billing:BillingStatus,plan:CheckoutPlan):string{
 const c=paywallCopy[language];
 return plan==='monthly'?c.monthly:plan==='annual'?c.annual:c.packTitle.replace('{size}',String(plan==='pack30'?billing.pack30Credits:billing.pack100Credits));
}
export function planAmount(pricing:Pricing,plan:CheckoutPlan):string{
 return formatPrice(pricing[plan].amount,pricing.currency);
}
