// All paywall copy (paywall §5) in one typed module with en/zh/es keys: the
// StoryStart limitReached state, the account-modal UpgradePanel, and the
// post-checkout return banner. The shared i18n bundles are deliberately not
// touched — this module exists to keep the paywall's strings disjoint from
// concurrent work there. Placeholders ({limit}, {used}) are interpolated by
// the caller and asserted by scripts/check-paywall.mjs.
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
 subscriptionActive:string;
 lifetimeActive:string;
 monthly:string;
 annual:string;
 lifetime:string;
 checkout:string;
 checkoutBusy:string;
 dormant:string;
 // Post-checkout return banner (webhook-lag rescue).
 checkoutConfirmed:string;
 checkoutPending:string;
 // Dedicated /pricing page (wave 6 §3). Displayed amounts are COPY, never
 // fetched: the authoritative charge comes from the Stripe price IDs, so these
 // strings can drift from Stripe products when prices change — update both.
 pricingTitle:string;
 pricingIntro:string;
 viewPlans:string;
 freeName:string;
 freePrice:string;
 freeAllowance:string; // {limit} → allowance (STORYPRESS_FREE_STORIES, default 3)
 priceMonthly:string;
 priceAnnual:string;
 priceLifetime:string;
 lifetimeName:string;
 lifetimeNote:string;
}
export const paywallCopy:Record<PaywallLanguage,PaywallCopy>={
 en:{
  limitTitle:'You have used all {limit} free stories',
  limitBody:'Everything you have made stays yours — read, print and share it any time. Upgrade to keep telling new stories.',
  limitCta:'Upgrade',
  planHeading:'Your plan',
  freeUsage:'{used} of {limit} free stories used',
  subscriptionActive:'Unlimited stories — subscription active',
  lifetimeActive:'Unlimited stories — lifetime',
  monthly:'Monthly',
  annual:'Annual',
  lifetime:'Lifetime — one payment',
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
  priceMonthly:'$6 / month',
  priceAnnual:'$60 / year',
  priceLifetime:'$120 once',
  lifetimeName:'Lifetime',
  lifetimeNote:'One payment. Unlimited stories — no subscription, ever.'
 },
 zh:{
  limitTitle:'你已经用完 {limit} 个免费故事',
  limitBody:'你创作的一切都仍然属于你——随时可以阅读、打印和分享。升级后可以继续创作新故事。',
  limitCta:'升级',
  planHeading:'你的方案',
  freeUsage:'已使用 {used}/{limit} 个免费故事',
  subscriptionActive:'无限故事——订阅已生效',
  lifetimeActive:'无限故事——终身有效',
  monthly:'按月',
  annual:'按年',
  lifetime:'终身——一次付清',
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
  priceMonthly:'$6 / 月',
  priceAnnual:'$60 / 年',
  priceLifetime:'$120 一次付清',
  lifetimeName:'终身',
  lifetimeNote:'一次付清。无限创作故事——无需订阅。'
 },
 es:{
  limitTitle:'Has usado tus {limit} historias gratis',
  limitBody:'Todo lo que creaste sigue siendo tuyo: puedes leerlo, imprimirlo y compartirlo cuando quieras. Mejora tu plan para seguir creando historias nuevas.',
  limitCta:'Mejorar',
  planHeading:'Tu plan',
  freeUsage:'{used} de {limit} historias gratis usadas',
  subscriptionActive:'Historias ilimitadas — suscripción activa',
  lifetimeActive:'Historias ilimitadas — de por vida',
  monthly:'Mensual',
  annual:'Anual',
  lifetime:'De por vida — un solo pago',
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
  priceMonthly:'$6 / mes',
  priceAnnual:'$60 / año',
  priceLifetime:'$120 un solo pago',
  lifetimeName:'De por vida',
  lifetimeNote:'Un solo pago. Historias ilimitadas, sin suscripción.'
 }
};
