import type {Story} from './story';

export const startCopy = {
 en: {
  title:'Where would you like to begin?', time:'One memory. About 5–10 minutes to begin.',
  memory:'I have a memory', photo:'Start with a photo', help:'Help me choose',
  details:'A few optional details', privacy:'Your draft is private. You decide what to share.',
  signIn:'You can start writing now. Google sign-in is needed for AI conversation and account saving.',
  resume:'Your story is still here', resumeHelp:'Pick up where you left off, or start another memory.',
  welcome:'A story brought you here. What is yours?',
  promptTitle:'Choose a question that brings something to mind.',
  prompts:[{label:'A place I remember',question:'What is a place from your past you can still picture? Take me there.'},{label:'Someone who shaped me',question:'Who taught you something you still carry with you? Tell me about a moment with them.'},{label:'An ordinary, special day',question:'What ordinary day would you like to step back into? What made it stay with you?'}],
  sample:'A little inspiration', sampleNote:'This is an example. Your own story is kept just as you left it.', close:'Back to my story',
 },
 zh: {
  title:'想从哪里讲起？', time:'一个回忆，先花 5–10 分钟聊聊。',
  memory:'我有一个回忆', photo:'从一张照片开始', help:'帮我找个话题',
  details:'补充一点信息（选填）', privacy:'草稿保持私密，由你决定分享什么。',
  signIn:'现在就可以开始写。使用 AI 对话和保存到账户时，需要通过 Google 登录。',
  resume:'你的故事还在这里', resumeHelp:'接着上次讲，或者开始另一个回忆。',
  welcome:'一个故事把你带到这里。你有什么故事呢？',
  promptTitle:'选一个让你想起往事的问题。',
  prompts:[{label:'记忆中的地方',question:'有没有一个过去的地方，你现在还能清楚地想起？带我去看看吧。'},{label:'影响过我的人',question:'谁曾教会你一件至今记得的事？说说你们相处的一个片刻吧。'},{label:'平凡却珍贵的一天',question:'如果能回到平凡的一天，你会选哪一天？是什么让你一直记得它？'}],
  sample:'一点灵感', sampleNote:'这是一个示例。你自己的故事仍然保持原样。', close:'回到我的故事',
 },
 es: {
  title:'¿Por dónde te gustaría empezar?', time:'Un recuerdo. Unos 5–10 minutos para empezar.',
  memory:'Tengo un recuerdo', photo:'Empezar con una foto', help:'Ayúdame a elegir',
  details:'Unos detalles opcionales', privacy:'Tu borrador es privado. Tú decides qué compartir.',
  signIn:'Puedes empezar a escribir ahora. La conversación con IA y el guardado en tu cuenta requieren iniciar sesión con Google.',
  resume:'Tu historia sigue aquí', resumeHelp:'Continúa donde lo dejaste o empieza otro recuerdo.',
  welcome:'Una historia te trajo hasta aquí. ¿Cuál es la tuya?',
  promptTitle:'Elige una pregunta que te traiga un recuerdo.',
  prompts:[{label:'Un lugar que recuerdo',question:'¿Qué lugar de tu pasado todavía puedes imaginar con claridad? Llévame allí.'},{label:'Alguien que dejó huella',question:'¿Quién te enseñó algo que todavía llevas contigo? Cuéntame un momento que compartieron.'},{label:'Un día sencillo y especial',question:'¿A qué día cotidiano te gustaría volver? ¿Qué hizo que se quedara contigo?'}],
  sample:'Un poco de inspiración', sampleNote:'Este es un ejemplo. Tu propia historia se conserva tal como la dejaste.', close:'Volver a mi historia',
 },
};

export function sharedEntryLanguage(search:string):Story['language']|undefined {
 const params=new URLSearchParams(search),language=params.get('lang');
 return params.get('from')==='shared'&&(language==='en'||language==='zh'||language==='es')?language:undefined;
}
