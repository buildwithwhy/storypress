import {type Language} from './story';

// Copy for the two account pages (/stories, /billing) in one typed module,
// following the per-surface copy convention (lib/*-copy.ts). Shared labels
// keep their homes: "My stories" lives in sharingCopy, plan/usage lines in
// paywallCopy, "Plan and billing" in purchaseCopy. New keys here are asserted
// for en/zh/es parity by scripts/check-purchase-flow.mjs; the {size} and
// {email} placeholders are interpolated by the callers.
export interface AccountPagesCopy{
 loading:string;
 finishedHeading:string;
 draftsHeading:string;
 noDrafts:string;
 storiesLeft:string; // {size} → stories left
 storiesLeftHeading:string;
 getMore:string;
 allowanceHeading:string;
 accountHeading:string;
 helpHeading:string;
 helpBlurb:string;
 deleteAccount:string; // {email} → support address
}
export const accountPagesCopy:Record<Language,AccountPagesCopy>={
 en:{
  loading:'Opening your stories…',
  finishedHeading:'Finished keepsakes',
  draftsHeading:'Drafts',
  noDrafts:'No drafts — every saved story here is a finished keepsake.',
  storiesLeft:'{size} stories left',
  storiesLeftHeading:'Stories left',
  getMore:'Get more stories',
  allowanceHeading:'Daily AI allowance',
  accountHeading:'Account',
  helpHeading:'Help',
  helpBlurb:'Questions, trouble, or anything about your account? Email us.',
  deleteAccount:'To delete your account and its data, email {email} — we complete deletions within 30 days of your request.'
 },
 zh:{
  loading:'正在打开你的故事……',
  finishedHeading:'完成的纪念作品',
  draftsHeading:'草稿',
  noDrafts:'暂无草稿——这里保存的故事都是完成的纪念作品。',
  storiesLeft:'还可创作 {size} 个故事',
  storiesLeftHeading:'剩余故事',
  getMore:'获取更多故事',
  allowanceHeading:'每日 AI 额度',
  accountHeading:'账户',
  helpHeading:'帮助',
  helpBlurb:'有问题，或需要账户方面的帮助？请给我们发邮件。',
  deleteAccount:'如需删除你的账户和数据，请发邮件至 {email}——我们会在收到请求后 30 天内完成删除。'
 },
 es:{
  loading:'Abriendo tus historias…',
  finishedHeading:'Recuerdos terminados',
  draftsHeading:'Borradores',
  noDrafts:'No hay borradores: cada historia guardada aquí es un recuerdo terminado.',
  storiesLeft:'Te quedan {size} historias',
  storiesLeftHeading:'Historias disponibles',
  getMore:'Conseguir más historias',
  allowanceHeading:'Cuota diaria de IA',
  accountHeading:'Cuenta',
  helpHeading:'Ayuda',
  helpBlurb:'¿Preguntas, problemas o algo sobre tu cuenta? Escríbenos.',
  deleteAccount:'Para eliminar tu cuenta y sus datos, escribe a {email}; completamos la eliminación en un plazo de 30 días desde tu solicitud.'
 }
};
