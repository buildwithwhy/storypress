import type {Story} from './story';
import {escapeHtml} from './keepsake';

export const readerCopy={
 en:{tools:'Keep or share this story',share:'Share story',copy:'Copy link',link:'Story link',copied:'Link copied. You can paste it into a message.',manual:'Touch and hold the selected link to copy it, then paste it into your message.',save:'Save offline copy',help:'Saving or sharing from an app?',helpText:'In WeChat or another app, use its menu to share this page. If saving or printing does not work here, open the page in your browser and try again.',offline:'The saved copy includes the story and its pictures. You can read it without an internet connection.',pdf:'To make a PDF, choose “Print / save PDF”, then the PDF option in your browser or phone’s print menu.',noLogin:'A story shared with you. No sign-in needed.',offlineLabel:'Your saved keepsake'},
 zh:{tools:'珍藏或分享这个故事',share:'分享故事',copy:'复制链接',link:'故事链接',copied:'链接已复制，可以粘贴到聊天中。',manual:'请长按已选中的链接并复制，再粘贴到聊天中。',save:'保存离线副本',help:'在微信等应用里，怎么保存或分享？',helpText:'在微信等应用中，可以用右上角菜单分享此页面。如果无法保存或打印，请选择「在浏览器中打开」后重试。',offline:'保存的副本包含故事和图片，无需联网也能阅读。',pdf:'如需 PDF，请选择「打印 / 保存 PDF」，再在浏览器或手机的打印菜单中选择 PDF 选项。',noLogin:'与你分享的故事，无需登录即可阅读。',offlineLabel:'你珍藏的故事'},
 es:{tools:'Conservar o compartir esta historia',share:'Compartir historia',copy:'Copiar enlace',link:'Enlace de la historia',copied:'Enlace copiado. Puedes pegarlo en un mensaje.',manual:'Mantén pulsado el enlace seleccionado para copiarlo y pégalo en tu mensaje.',save:'Guardar copia sin conexión',help:'¿Guardas o compartes desde una app?',helpText:'En WeChat u otra app, usa su menú para compartir esta página. Si no puedes guardar o imprimir, abre la página en tu navegador e inténtalo de nuevo.',offline:'La copia guardada incluye la historia y sus imágenes. Puedes leerla sin conexión a internet.',pdf:'Para crear un PDF, elige «Imprimir / guardar PDF» y después la opción PDF en el menú de impresión del navegador o del teléfono.',noLogin:'Una historia compartida contigo. No necesitas iniciar sesión.',offlineLabel:'Tu recuerdo guardado'},
};

export function readerTools(story:Story,webReader:boolean,printLabel:string){
 const c=readerCopy[story.language],e=escapeHtml;
 return `<header class="reader-header"><span class="reader-brand">STORYPRESS</span><p>${webReader?c.noLogin:c.offlineLabel}</p></header>
 <nav class="reader-actions" aria-label="${c.tools}">${webReader?`<button type="button" class="reader-primary reader-enhanced" id="reader-share" hidden>${c.share}</button><button type="button" class="reader-enhanced" id="reader-copy" hidden>${c.copy}</button><a class="download" href="?download=1" download="storypress-keepsake.html">${c.save}</a>`:''}<button type="button" class="print reader-enhanced" id="reader-print" hidden>${e(printLabel)}</button></nav>
 ${webReader?`<div class="reader-link" id="reader-link" hidden><label for="reader-address">${c.link}</label><input id="reader-address" type="url" readonly spellcheck="false" dir="ltr"><p id="reader-manual">${c.manual}</p></div><p class="reader-status" id="reader-status" role="status" aria-live="polite"></p>`:''}
 <details class="reader-help"><summary>${c.help}</summary><p>${c.helpText}</p><p>${c.pdf}</p>${webReader?`<p>${c.offline}</p>`:''}</details>`;
}

export function readerScript(language:Story['language'],webReader:boolean){
 const copy=JSON.stringify(readerCopy[language]).replace(/</g,'\\u003c');
 // The token comes from this page only, after a deliberate share/copy action. No analytics or external requests.
 return `<script>(()=>{const c=${copy};document.querySelectorAll('.reader-enhanced').forEach(el=>el.hidden=false);document.getElementById('reader-print').addEventListener('click',()=>window.print());${webReader?`
 const url=location.origin+location.pathname,status=document.getElementById('reader-status'),field=document.getElementById('reader-address');
 function manual(){document.getElementById('reader-link').hidden=false;field.value=url;field.focus();field.select();status.textContent=c.manual;}
 async function copy(){try{if(!navigator.clipboard)throw new Error();await navigator.clipboard.writeText(url);status.textContent=c.copied;}catch{manual();}}
 field.addEventListener('focus',()=>field.select());
 document.getElementById('reader-copy').addEventListener('click',copy);
 document.getElementById('reader-share').addEventListener('click',async()=>{try{if(!navigator.share){await copy();return;}await navigator.share({url,title:document.title});}catch(error){if(error.name!=='AbortError')manual();}});`:''}})();</script>`;
}

export const readerStyles=`
body{margin:0;padding:24px 12px;background:#f4f1e8;color:#29382d;-webkit-text-size-adjust:100%}
.reader-header{max-width:850px;margin:0 auto 20px;text-align:center;font:14px/1.6 system-ui}.reader-brand{font-size:12px;letter-spacing:.18em;font-weight:650}.reader-header p{margin:8px 0;color:#66725e}
.reader-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;margin:0 auto 12px;max-width:850px}
.reader-actions button,.reader-actions a,.reader-next a{box-sizing:border-box;border:1px solid #c4cbbd;border-radius:9px;background:#fffdf5;color:#224d3e;padding:12px 16px;min-height:46px;font:15px/1.4 system-ui;text-decoration:none;cursor:pointer;text-align:center}
.reader-actions .reader-primary,.reader-next a{background:#224d3e;color:white;border-color:#224d3e}
.reader-actions [hidden],.reader-link[hidden]{display:none}
.reader-link{max-width:550px;margin:16px auto;padding:16px;background:#fffdf5;border:1px solid #c4cbbd;border-radius:9px;font:14px/1.6 system-ui}.reader-link label{display:block;margin-bottom:8px}.reader-link input{box-sizing:border-box;width:100%;min-width:0;padding:12px;font:16px system-ui;color:#224d3e;border:1px solid #c4cbbd;border-radius:6px;background:white}.reader-link p{margin-bottom:0}
.reader-status{font:14px/1.6 system-ui;text-align:center;max-width:650px;margin:10px auto}.reader-status:empty{display:none}
.reader-help{max-width:650px;margin:0 auto 24px;font:14px/1.7 system-ui;color:#61705c}.reader-help summary{cursor:pointer;min-height:36px;padding:6px;text-align:center}.reader-help p{padding:0 12px}
.reader-next{text-align:center;max-width:600px;margin:35px auto;padding:25px;font:16px/1.7 system-ui}.reader-next h2{font:32px Georgia,'Songti SC',serif}.reader-next a{display:inline-block;margin-top:10px}
button:focus-visible,a:focus-visible,summary:focus-visible,input:focus-visible{outline:3px solid #bd953b;outline-offset:3px}
@media(max-width:600px){body{padding:20px 10px}.reader-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.reader-actions button,.reader-actions a{font-size:14px;padding:12px 8px}.reader-header{margin-bottom:16px}.reader-help{font-size:13px}.reader-next{padding:20px 10px}}
@media print{.reader-header,.reader-link,.reader-status,.reader-help{display:none}}
`;
