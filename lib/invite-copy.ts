import {type Story} from './story';

// Every string an invited guest or an invitation owner sees. Guests arrive
// with no context at all, so copy stays plain and warm in all three languages.
export const inviteCopy={
 en:{
  title:'Invite family',help:'Share a link so someone can tell their side of the story. You review every word before it joins yours.',
  questionLabel:'Your personal question',contributorLabel:'Their name (optional)',contributorPlaceholder:'e.g. Mei (aunt)',
  create:'Create invitation',creating:'Creating…',
  ready:'Invitation ready — share this link:',readyEnds:'It stays open until',
  share:'Share',copy:'Copy',copied:'Link copied.',
  openTitle:'Open invitations',none:'No open invitations yet.',
  revoke:'Revoke',revoked:'Invitation revoked.',revokeConfirm:'Revoke this invitation? Its link will stop working.',
  statusOpen:'Open',statusExpired:'Expired',statusRevoked:'Revoked',ends:'Ends',
  reviewTitle:'Waiting for your review',reviewEmpty:'No contributions are waiting.',reviewHelp:'Read their words in their own voice, then decide. Nothing joins your story until you approve it.',
  from:'From',q:'Question',a:'Answer',
  approve:'Add to my story',decline:'Decline',approveHelp:'Their memories join your transcript in their words, credited to them. Your keepsake will need your review again.',
  approvedLabel:'Added',declinedLabel:'Declined',merged:'Their memories joined your story. Your keepsake needs your review again.',
  welcome:'You’re invited',guestHelp:'Answer in your own words, at your own pace. A few minutes is plenty — your words are saved as you go.',
  yourName:'Who are you, for the record?',namePlaceholder:'e.g. Mei (aunt)',
  submit:'Send my memories',sending:'Sending…',
  sentTitle:'Sent — thank you.',sentHelp:'They will review your words before adding them to the story. Your draft stays on this device.',
  signHelp:'Sign in to keep a link to your words',claimed:'Linked to your account.',
  draftSaved:'Saved on this device',
  unknown:'This invitation is not available.',revokedGuest:'The storyteller ended this invitation.',expiredGuest:'This invitation has expired. Ask for a fresh link.',
  guestError:'That didn’t send. Your words are saved here — please try again.',
  needName:'Add your name so they know who is remembering.',needWords:'Tell a little of your memory first.',
  tooLong:'This recollection is too long to send in one go. Please send a shorter memory first.',
 },
 zh:{
  title:'邀请家人',help:'分享一个链接，让对方讲述他们那部分的故事。每个字都要经过你的确认才会加入。',
  questionLabel:'你的私人问题',contributorLabel:'对方的称呼（选填）',contributorPlaceholder:'例如： Mei（阿姨）',
  create:'生成邀请',creating:'正在生成……',
  ready:'邀请已生成——分享这个链接：',readyEnds:'有效期至',
  share:'分享',copy:'复制',copied:'链接已复制。',
  openTitle:'进行中的邀请',none:'还没有进行中的邀请。',
  revoke:'撤销',revoked:'邀请已撤销。',revokeConfirm:'撤销这个邀请？对应的链接将停止使用。',
  statusOpen:'进行中',statusExpired:'已过期',statusRevoked:'已撤销',ends:'截止',
  reviewTitle:'等待你的确认',reviewEmpty:'目前没有待确认的回忆。',reviewHelp:'用他们自己的话读过，再决定是否加入。未经你确认，任何内容都不会进入你的故事。',
  from:'讲述者',q:'提问',a:'回答',
  approve:'加入我的故事',decline:'婉拒',approveHelp:'他们的回忆会以原话加入你的记录，并署上他们的名字。之后你的纪念作品需要重新确认。',
  approvedLabel:'已加入',declinedLabel:'已婉拒',merged:'他们的回忆已加入你的故事。请重新确认你的纪念作品。',
  welcome:'诚邀你来讲述',guestHelp:'用自己的话慢慢说，节奏由你定。几分钟就足够——你说的话会随时保存。',
  yourName:'你想留下什么名字？',namePlaceholder:'例如： Mei（阿姨）',
  submit:'寄出我的回忆',sending:'正在寄出……',
  sentTitle:'已经寄出，谢谢你。',sentHelp:'对方确认后才会加入故事。草稿仍保存在这台设备上。',
  signHelp:'登录后可以保留这些文字的关联',claimed:'已关联到你的账户。',
  draftSaved:'已保存在此设备',
  unknown:'这个邀请不可用。',revokedGuest:'讲述者已结束这个邀请。',expiredGuest:'这个邀请已过期。请让对方重新发送链接。',
  guestError:'没有寄出成功。你的话还保存在这里——请再试一次。',
  needName:'留下你的名字，让对方知道是谁在回忆。',needWords:'先讲一点点你的回忆。',
  tooLong:'这段回忆太长，一次寄不出来。请先寄一段短一点的。',
 },
 es:{
  title:'Invitar a la familia',help:'Comparte un enlace para que alguien cuente su parte de la historia. Cada palabra pasa por tu revisión antes de unirse.',
  questionLabel:'Tu pregunta personal',contributorLabel:'Su nombre (opcional)',contributorPlaceholder:'p. ej. Mei (tía)',
  create:'Crear invitación',creating:'Creando…',
  ready:'Invitación lista — comparte este enlace:',readyEnds:'Permanece abierta hasta',
  share:'Compartir',copy:'Copiar',copied:'Enlace copiado.',
  openTitle:'Invitaciones abiertas',none:'Todavía no hay invitaciones abiertas.',
  revoke:'Revocar',revoked:'Invitación revocada.',revokeConfirm:'¿Revocar esta invitación? Su enlace dejará de funcionar.',
  statusOpen:'Abierta',statusExpired:'Expirada',statusRevoked:'Revocada',ends:'Termina',
  reviewTitle:'Esperando tu revisión',reviewEmpty:'No hay aportes esperando.',reviewHelp:'Lee sus palabras tal como las contaron y decide. Nada se une a tu historia sin tu aprobación.',
  from:'De',q:'Pregunta',a:'Respuesta',
  approve:'Añadir a mi historia',decline:'Declinar',approveHelp:'Sus recuerdos se unen a tu transcripción con sus palabras, acreditados a su nombre. Tu recuerdo necesitará tu revisión otra vez.',
  approvedLabel:'Añadido',declinedLabel:'Declinado',merged:'Sus recuerdos se unieron a tu historia. Tu recuerdo necesita tu revisión otra vez.',
  welcome:'Estás invitado',guestHelp:'Responde con tus propias palabras, a tu ritmo. Unos minutos bastan — tus palabras se guardan mientras hablas.',
  yourName:'¿Qué nombre dejas para el recuento?',namePlaceholder:'p. ej. Mei (tía)',
  submit:'Enviar mis recuerdos',sending:'Enviando…',
  sentTitle:'Enviado — gracias.',sentHelp:'Revisarán tus palabras antes de unirlas a la historia. Tu borrador queda en este dispositivo.',
  signHelp:'Inicia sesión para mantener el vínculo con tus palabras',claimed:'Vinculado a tu cuenta.',
  draftSaved:'Guardado en este dispositivo',
  unknown:'Esta invitación no está disponible.',revokedGuest:'Quien cuenta la historia cerró esta invitación.',expiredGuest:'Esta invitación ha expirado. Pide un enlace nuevo.',
  guestError:'No se pudo enviar. Tus palabras quedan aquí — inténtalo otra vez.',
  needName:'Deja tu nombre para que sepan quién recuerda.',needWords:'Cuenta primero un poco de tu recuerdo.',
  tooLong:'Este recuerdo es demasiado largo para enviarlo de una vez. Envía antes uno más corto.',
 }
};

const suggested={
 en:{life:(n:string)=>`${n} is keeping a newspaper of family memories. What is a moment you shared that you have never forgotten?`,wedding:(n:string)=>`${n} is gathering their love story. How did you meet, and when did you know it was real?`,graduation:(n:string)=>`${n} is marking a new chapter. What did that milestone look like from where you stood?`},
 zh:{life:(n:string)=>`${n}正在记录家里的回忆。有没有一个你们在一起的瞬间，你一直没忘记？`,wedding:(n:string)=>`${n}正在整理他们的爱情故事。你们是怎么认识的？什么时候你确定就是这个人？`,graduation:(n:string)=>`${n}正翻开新的篇章。在那个人生时刻，你最记得的是什么？`},
 es:{life:(n:string)=>`${n} está reuniendo recuerdos de la familia. ¿Hay un momento que compartieron y que nunca has olvidado?`,wedding:(n:string)=>`${n} está reuniendo su historia de amor. ¿Cómo se conocieron y cuándo supiste que era real?`,graduation:(n:string)=>`${n} está empezando un nuevo capítulo. ¿Cómo se vio ese logro desde tu lugar?`}
};
const fallbackName={en:'Your family',zh:'家人',es:'Tu familia'};
export function suggestedQuestion(language:Story['language'],occasion:Story['occasion'],name?:string){const n=name&&name.trim()?name.trim():fallbackName[language];return suggested[language][occasion](n);}

const listJoin={en:', ',zh:'、',es:', '},withLead={en:' with ',zh:'，与 ',es:' con '};
// Byline continuation: "A story by Wei, with Mei (aunt), Bob" / "讲述者 Wei，与 Mei（阿姨）、Bob".
export function withContributors(language:Story['language'],names:string[]){return names.length?withLead[language]+names.join(listJoin[language]):'';}

export function formatEndDate(language:Story['language'],iso:string){try{return new Date(iso).toLocaleDateString(language==='zh'?'zh-CN':language==='es'?'es':'en',{year:'numeric',month:'long',day:'numeric'});}catch{return '';}}
