// All paywall copy (paywall §5) in one typed module with en/zh/es keys: the
// StoryStart limitReached state, the account-modal UpgradePanel, the
// post-checkout return banner, and the /pricing page. The shared i18n bundles
// are deliberately not touched — this module exists to keep the paywall's
// strings disjoint from concurrent work there. Placeholders ({limit}, {used},
// {cap}, {size}, {percent}) are interpolated by the caller and asserted by
// scripts/check-paywall.mjs.
//
// Wave 8 amount contract: while billing is configured the page renders amounts
// from the server's Stripe-backed pricing payload (minor units + currency);
// nothing here invents numbers. priceMonthly/priceAnnual/pricePack30/
// pricePack100 are DORMANT-MODE FALLBACK COPY ONLY — shown when there is no
// Stripe key to vouch for anything, next to the honest dormant line. They can
// drift from Stripe products; that drift is confined to dormant mode.
//
// Video add-on honesty (paywall §6): a future video add-on grants
// addons:["video"] on the entitlement row — no schema change — but pure
// client-side video rendering is UI-gated only: a bypassed gate costs
// nothing but the user's own render time. Enforceable video gating arrives
// with narration/generated motion (server AI steps and any storage), and the
// entitlement check belongs exactly there when a video delivery PR lands.
// See docs/video.md for the hidden rollout and docs/STRIPE-SETUP.md for the
// operator runbook.
export type PaywallLanguage='en'|'zh'|'es';
export interface PaywallCopy{
 // StoryStart limitReached state — the gate before content exists.
 limitTitle:string; // {limit} → free allowance
 limitBody:string;
 limitCta:string;
 // UpgradePanel in the account modal.
 planHeading:string;
 freeUsage:string; // {used} → stories created, {limit} → allowance
 monthlyUsage:string; // {used} → this month's draws, {cap} → monthly cap
 packCredits:string; // {size} → remaining pack credits
 entitledActive:string; // entitled line for any paid plan (incl. legacy lifetime rows)
 monthly:string;
 annual:string;
 checkout:string;
 checkoutBusy:string;
 dormant:string;
 // Post-checkout return banner (webhook-lag rescue).
 checkoutConfirmed:string;
 checkoutPending:string;
 // Dedicated /pricing page (wave 6 §3, reworked wave 8 §3). While billing is
 // configured, amounts come from the server's Stripe-cached pricing payload —
 // never from these strings. The price* strings here are the dormant-mode
 // fallback copy only; they can drift from Stripe products, and that drift is
 // confined to dormant mode (see the module header).
 pricingTitle:string;
 pricingIntro:string;
 viewPlans:string;
 freeName:string;
 freePrice:string;
 freeAllowance:string; // {limit} → allowance (STORYPRESS_FREE_STORIES, default 3)
 subscriptionName:string;
 capAllowance:string; // {cap} → monthly cap (STORYPRESS_SUBSCRIPTION_MONTHLY_CAP)
 saveBadge:string; // {percent} → computed from Stripe amounts, never a literal
 priceMonthly:string; // dormant fallback copy
 priceAnnual:string; // dormant fallback copy
 packTitle:string; // {size} → pack size (STORYPRESS_PACK_30_CREDITS / _PACK_100)
 packNote:string;
 packBuy:string; // {size} → pack size
 pricePack30:string; // dormant fallback copy
 pricePack100:string; // dormant fallback copy
 pricesUnavailable:string; // configured but the Stripe price payload is unavailable
}
export const paywallCopy:Record<PaywallLanguage,PaywallCopy>={
 en:{
  limitTitle:'You have used all {limit} free stories',
  limitBody:'Everything you have made stays yours — read, print and share it any time. Upgrade to keep telling new stories.',
  limitCta:'Upgrade',
  planHeading:'Your plan',
  freeUsage:'{used} of {limit} free stories used',
  monthlyUsage:'{used} of {cap} stories this month',
  packCredits:'{size} pack credits remaining',
  entitledActive:'Unlimited stories — your plan is active',
  monthly:'Monthly',
  annual:'Annual',
  checkout:'Continue to checkout',
  checkoutBusy:'Opening checkout…',
  dormant:'Online payment is not connected yet. Your stories remain fully available.',
  checkoutConfirmed:'Your plan is active. Thank you for supporting the studio.',
  checkoutPending:'Thank you! Your payment is still being confirmed — this page will show your plan shortly. Your stories remain fully available meanwhile.',
  pricingTitle:'Plans for every storyteller',
  pricingIntro:'Start free. Upgrade when you are ready — every story you have made stays yours either way.',
  viewPlans:'View plans',
  freeName:'Free',
  freePrice:'$0',
  freeAllowance:'{limit} free stories — what you make is yours to keep forever',
  subscriptionName:'Subscription',
  capAllowance:'Up to {cap} stories a month',
  saveBadge:'Save {percent}%',
  priceMonthly:'$9.99 / month',
  priceAnnual:'$59 / year',
  packTitle:'{size} stories',
  packNote:'One-time payment. Pack credits never expire.',
  packBuy:'Buy the {size}-story pack',
  pricePack30:'$12',
  pricePack100:'$29',
  pricesUnavailable:'Plan amounts are unavailable right now — please check back soon.'
 },
 zh:{
  limitTitle:'你已经用完 {limit} 个免费故事',
  limitBody:'你创作的一切都仍然属于你——随时可以阅读、打印和分享。升级后可以继续创作新故事。',
  limitCta:'升级',
  planHeading:'你的方案',
  freeUsage:'已使用 {used}/{limit} 个免费故事',
  monthlyUsage:'本月已创作 {used}/{cap} 个故事',
  packCredits:'剩余 {size} 个故事包点数',
  entitledActive:'无限故事——你的方案已生效',
  monthly:'按月',
  annual:'按年',
  checkout:'前往结账',
  checkoutBusy:'正在打开结账……',
  dormant:'在线支付尚未开通。你的故事仍然完全可用。',
  checkoutConfirmed:'你的方案已生效。感谢你对工作室的支持。',
  checkoutPending:'感谢你！你的付款还在确认中——页面稍后会显示你的方案。期间你的故事仍然完全可用。',
  pricingTitle:'适合每位讲述者的方案',
  pricingIntro:'免费开始，准备好后再升级。无论哪种方案，你创作的一切都永远属于你。',
  viewPlans:'查看方案',
  freeName:'免费',
  freePrice:'$0',
  freeAllowance:'{limit} 个免费故事——你创作的内容永远属于你',
  subscriptionName:'订阅',
  capAllowance:'每月最多 {cap} 个故事',
  saveBadge:'省 {percent}%',
  priceMonthly:'$9.99 / 月',
  priceAnnual:'$59 / 年',
  packTitle:'{size} 个故事',
  packNote:'一次付清。故事包点数永不过期。',
  packBuy:'购买 {size} 个故事包',
  pricePack30:'$12',
  pricePack100:'$29',
  pricesUnavailable:'方案价格暂时无法显示，请稍后再来。'
 },
 es:{
  limitTitle:'Has usado tus {limit} historias gratis',
  limitBody:'Todo lo que creaste sigue siendo tuyo: puedes leerlo, imprimirlo y compartirlo cuando quieras. Mejora tu plan para seguir creando historias nuevas.',
  limitCta:'Mejorar',
  planHeading:'Tu plan',
  freeUsage:'{used} de {limit} historias gratis usadas',
  monthlyUsage:'{used} de {cap} historias este mes',
  packCredits:'Quedan {size} créditos de paquete',
  entitledActive:'Historias ilimitadas — tu plan está activo',
  monthly:'Mensual',
  annual:'Anual',
  checkout:'Ir al pago',
  checkoutBusy:'Abriendo el pago…',
  dormant:'El pago en línea aún no está conectado. Tus historias siguen totalmente disponibles.',
  checkoutConfirmed:'Tu plan está activo. Gracias por apoyar el estudio.',
  checkoutPending:'¡Gracias! Tu pago aún se está confirmando: esta página mostrará tu plan en breve. Mientras tanto, tus historias siguen totalmente disponibles.',
  pricingTitle:'Planes para cada narrador',
  pricingIntro:'Empieza gratis. Mejora cuando quieras: todo lo que hayas creado sigue siendo tuyo de todos modos.',
  viewPlans:'Ver planes',
  freeName:'Gratis',
  freePrice:'$0',
  freeAllowance:'{limit} historias gratis: lo que crees es tuyo para siempre',
  subscriptionName:'Suscripción',
  capAllowance:'Hasta {cap} historias al mes',
  saveBadge:'Ahorra {percent}%',
  priceMonthly:'$9.99 / mes',
  priceAnnual:'$59 / año',
  packTitle:'{size} historias',
  packNote:'Pago único. Los créditos del paquete nunca caducan.',
  packBuy:'Compra el paquete de {size} historias',
  pricePack30:'$12',
  pricePack100:'$29',
  pricesUnavailable:'Los precios no están disponibles en este momento; vuelve pronto.'
 }
};
