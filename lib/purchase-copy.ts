// Purchase-sheet copy (purchase sheet §D1-D6) in one typed module with
// en/zh/es keys, following the per-surface copy convention (lib/*-copy.ts).
// Placeholders ({size}) are interpolated by the caller and asserted by
// scripts/check-purchase-flow.mjs. The sign-in wording is context-dependent
// (§D4): the purchase sheet promises the round-trip brings the buyer back;
// the header entry keeps the same account wording without that promise. The
// shared accountMadeForYou sentence renders in every sign-in context.
export type PurchaseLanguage='en'|'zh'|'es';
export interface PurchaseCopy{
 signIn:string;
 sheetTitle:string;
 purchaseSignInHelp:string;
 accountSignInHelp:string;
 accountMadeForYou:string;
 continueToSecureCheckout:string;
 startFreeStory:string;
 startNewStoryCta:string;
 planAndBilling:string;
 packConfirmed:string; // {size} → pack size
}
export const purchaseCopy:Record<PurchaseLanguage,PurchaseCopy>={
 en:{
  signIn:'Sign in',
  sheetTitle:'Complete your purchase',
  purchaseSignInHelp:'Sign in or create your account to continue to checkout. It’s free and takes a minute. We’ll bring you right back.',
  accountSignInHelp:'Sign in or create your account to keep your stories safe. It’s free and takes a minute.',
  accountMadeForYou:'New here? Your account is created automatically when you sign in — no password to remember.',
  continueToSecureCheckout:'Continue to secure checkout',
  startFreeStory:'Start a free story',
  startNewStoryCta:'Start a new story',
  planAndBilling:'Plan and billing',
  packConfirmed:'{size} stories added to your account'
 },
 zh:{
  signIn:'登录',
  sheetTitle:'完成购买',
  purchaseSignInHelp:'登录或创建账户即可继续结账。免费，只需一分钟。我们会带你回到这里。',
  accountSignInHelp:'登录或创建账户，妥善保存你的故事。免费，只需一分钟。',
  accountMadeForYou:'第一次来？登录时会自动为你创建账户——无需记住密码。',
  continueToSecureCheckout:'前往安全结账',
  startFreeStory:'免费开始一个故事',
  startNewStoryCta:'开始新故事',
  planAndBilling:'方案与账单',
  packConfirmed:'已为你的账户添加 {size} 个故事'
 },
 es:{
  signIn:'Iniciar sesión',
  sheetTitle:'Completa tu compra',
  purchaseSignInHelp:'Inicia sesión o crea tu cuenta para continuar con el pago. Es gratis y toma un minuto. Te traeremos de vuelta.',
  accountSignInHelp:'Inicia sesión o crea tu cuenta para guardar tus historias. Es gratis y toma un minuto.',
  accountMadeForYou:'¿Primera vez? Tu cuenta se crea automáticamente cuando inicias sesión: no hay contraseña que recordar.',
  continueToSecureCheckout:'Ir al pago seguro',
  startFreeStory:'Empezar una historia gratis',
  startNewStoryCta:'Empezar una historia nueva',
  planAndBilling:'Plan y facturación',
  packConfirmed:'Se añadieron {size} historias a tu cuenta'
 }
};
