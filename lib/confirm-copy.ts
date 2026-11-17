import {type Story} from './story';

// Strings for the in-app confirm dialog that replaced native confirm() on
// draft import, sign-out and invite revoke, plus the consent-gated device
// draft offer shown at sign-in (device-draft privacy).
export const confirmCopy={
 en:{confirm:'Confirm',cancel:'Cancel',consentTitle:'Bring in your draft?',consentBody:'A story was started on this device before you signed in. Would you like to bring it into your account?',accept:'Bring in my draft',decline:'Start fresh',untitled:'Untitled draft',justNow:'just now',minutesAgo:'{n} minutes ago',hoursAgo:'{n} hours ago',daysAgo:'{n} days ago'},
 zh:{confirm:'确认',cancel:'取消',consentTitle:'导入你的草稿？',consentBody:'登录前你在这台设备上写了一个故事。要把它带入你的账户吗？',accept:'带入我的草稿',decline:'重新开始',untitled:'未命名草稿',justNow:'刚刚',minutesAgo:'{n} 分钟前',hoursAgo:'{n} 小时前',daysAgo:'{n} 天前'},
 es:{confirm:'Confirmar',cancel:'Cancelar',consentTitle:'¿Traer tu borrador?',consentBody:'Escribiste una historia en este dispositivo antes de iniciar sesión. ¿Quieres traerla a tu cuenta?',accept:'Traer mi borrador',decline:'Empezar de nuevo',untitled:'Borrador sin título',justNow:'hace un momento',minutesAgo:'hace {n} minutos',hoursAgo:'hace {n} horas',daysAgo:'hace {n} días'}
};
export function formatDraftAge(language:Story['language'],savedAt:number,now:number=Date.now()):string{
 const c=confirmCopy[language];const minutes=Math.floor((now-savedAt)/60000);
 if(minutes<1)return c.justNow;
 if(minutes<60)return c.minutesAgo.replace('{n}',String(minutes));
 const hours=Math.floor(minutes/60);
 if(hours<24)return c.hoursAgo.replace('{n}',String(hours));
 return c.daysAgo.replace('{n}',String(Math.floor(hours/24)));
}
// The consent dialog's one-line preview: the draft's title — the narrator's
// name, the keepsake headline, or the opening words — and, when the draft
// carries a stamp, its age. Legacy drafts without stamps show the title only.
export function draftPreviewLabel(language:Story['language'],snapshot:{story:Story;savedAt?:number},now:number=Date.now()):string{
 const story=snapshot.story;
 const draft=story.draft?.trim();
 const title=story.name?.trim()||story.paper?.headline?.trim()||(draft?draft.slice(0,60)+(draft.length>60?'…':''):confirmCopy[language].untitled);
 return snapshot.savedAt?`${title} · ${formatDraftAge(language,snapshot.savedAt,now)}`:title;
}
