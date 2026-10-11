import type { Story } from './story';

// Keep stored occasion IDs compatible with existing stories. These are lenses,
// not facts about the narrator or templates they have to complete.
export const storyFocus = {
 life: {
  label: 'A life memory',
  interview: 'Develop one concrete memory through the people, actions, and meaning the narrator supplies. A whole-life chronology is unnecessary.',
  writing: 'Preserve the particular memory and its distinctive details in the narrator’s voice; do not expand it into a biography.',
 },
 wedding: {
  label: 'A love story',
  interview: 'Follow a remembered relationship moment, what brought people close, or how things changed. Do not assume a wedding, marriage, genders, orientation, current relationship, or happiness.',
  writing: 'Center supported relationship moments and their meaning to the narrator. Do not turn the story into a wedding speech or presume a happy ending.',
 },
 graduation: {
  label: 'A new chapter',
  interview: 'Explore a transition: a move, work, retirement, graduation, or another change. Follow what came before, a decision, support, uncertainty, or what changed afterward; do not presume graduation or progress.',
  writing: 'Shape the transition around supplied moments and reflections, leaving uncertainty intact. Do not invent an achievement, improvement, or a lesson.',
 },
} satisfies Record<Story['occasion'], {label:string;interview:string;writing:string}>;

const openings = {
 en: {
  life: 'What is a memory you would love to keep?',
  wedding: 'What moment from a love story in your life would you like to remember?',
  graduation: 'What change or new beginning in your life would you like to tell us about?',
 },
 zh: {
  life: '有什么回忆，是你特别想留下来的？',
  wedding: '在你的爱情故事里，有哪个瞬间是你想留下来的？',
  graduation: '生活中的哪次改变或新的开始，是你想聊聊的？',
 },
 es: {
  life: '¿Qué recuerdo te gustaría conservar?',
  wedding: '¿Qué momento de una historia de amor de tu vida te gustaría recordar?',
  graduation: '¿Qué cambio o nuevo comienzo en tu vida te gustaría contar?',
 },
} satisfies Record<Story['language'], Record<Story['occasion'], string>>;

export function openingQuestion(story: Pick<Story, 'language' | 'occasion'>) {
 return openings[story.language][story.occasion];
}

export const modeDescriptions = {
 en: { life: 'An everyday moment, a family tradition, or a memory that stays with you.', wedding: 'A relationship, a shared moment, or how love changed your life.', graduation: 'A move, a milestone, a career change, or another new beginning.' },
 zh: { life: '一个日常片段、一项家庭传统，或一段难忘的回忆。', wedding: '一段感情、共度的时刻，或爱情带来的改变。', graduation: '搬家、毕业、工作转变，或人生中的另一个新开始。' },
 es: { life: 'Un momento cotidiano, una tradición familiar o un recuerdo que sigue contigo.', wedding: 'Una relación, un momento compartido o cómo el amor cambió tu vida.', graduation: 'Una mudanza, un hito, un cambio de trabajo u otro nuevo comienzo.' },
} satisfies Record<Story['language'], Record<Story['occasion'], string>>;
