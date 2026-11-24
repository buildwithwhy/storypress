import {type Story} from './story';

// NOT-FOUND PAGE — unknown routes.
//
// The worker route map serves the app shell for any path it doesn't know,
// with a real 404 status, and the app renders this branded page so an unknown
// link still gets the Once & Ours header, the language picker, and a way
// home — instead of the platform's unbranded English-only error. Copy follows
// the shared en/zh/es copy-object pattern (see lib/invite-copy.ts).

export type NotFoundCopy = {
  title: string;
  message: string;
  newStory: string;
  backHome: string;
};

export const notFoundCopy: Record<Story['language'], NotFoundCopy> = {
  en: {
    title: "This page isn't in the paper",
    message: "We couldn't find that page. The link may be old or incomplete. Your stories are safe — start a new one or return to the front page.",
    newStory: 'Start a new story',
    backHome: 'Back to the front page',
  },
  zh: {
    title: '这一页不在报纸里',
    message: '我们找不到这个页面。链接可能已过期或不完整。你的故事都安然无恙——可以开始新的故事，或回到首页。',
    newStory: '开始新的故事',
    backHome: '回到首页',
  },
  es: {
    title: 'Esta página no está en el periódico',
    message: 'No encontramos esa página. El enlace puede ser antiguo o estar incompleto. Tus historias están a salvo: empieza una nueva o vuelve a la portada.',
    newStory: 'Empezar una historia nueva',
    backHome: 'Volver a la portada',
  },
};

// Paths the app shell renders itself. Anything else that reaches the shell is
// an unknown route: the worker serves it with a 404 status and the app shows
// the not-found page instead of silently falling back to the home stage.
const KNOWN_APP_PATHS = new Set(['/', '/pricing', '/terms', '/privacy', '/refunds']);
export function isKnownAppPath(pathname: string): boolean {
  return KNOWN_APP_PATHS.has(pathname) || /^\/i\/[a-f0-9]{64}$/.test(pathname);
}
