// Pure composition for the mobile action bar: which actions belong on the bar,
// which one is primary, and when the primary CTA must explain itself instead of
// sitting dead. No React, no DOM, no fetches — checked by scripts/check-mobile-actions.mjs.
export type MobileActionId = "finish" | "send" | "skip";

export interface MobileActionCopy {
 finishFirst: string; // nothing can be turned into a keepsake yet
 answerFirst: string; // the answer editor holds nothing to send
 talkFirst: string;   // live conversation: nothing said or typed yet
}

export const mobileActionCopy: Record<"en" | "zh" | "es", MobileActionCopy> = {
 en: { finishFirst: "Write or record a memory first — then make your newspaper.", answerFirst: "Type an answer, or record one out loud.", talkFirst: "Speak a little, or type below — your words become the story." },
 zh: { finishFirst: "先写下或录出一段回忆，再制作报纸。", answerFirst: "请先输入或录下你的回答。", talkFirst: "先聊几句，或在下方输入——你的话会变成故事。" },
 es: { finishFirst: "Escribe o graba un recuerdo antes de crear tu periódico.", answerFirst: "Escribe una respuesta o grábala en voz alta.", talkFirst: "Habla un momento o escribe abajo — tus palabras se convierten en la historia." }
};

export interface TellStageState {
 canFinish: boolean; // the story holds words (or an unsent draft) to make a keepsake from
 canSend: boolean;   // the answer editor holds text to send
 isSample: boolean;
 busy: boolean;      // an interview request, recording, review or switch is in flight
 liveVoice: boolean; // live conversation mode: answers arrive by speaking, not typing
}

export interface MobileAction {
 id: MobileActionId;
 kind: "primary" | "secondary";
 enabled: boolean;
 hint?: string; // one line, shown only while the primary CTA is disabled
}

// Invariants held here (asserted by check-mobile-actions.mjs):
// - at most one primary action, and it is either enabled or carries a hint — never a dead CTA;
// - "finish" only appears when the story can actually be finished;
// - a sample story gets no bar at all (its page already explains preview mode).
export function tellStageActions(state: TellStageState, copy: MobileActionCopy): MobileAction[] {
 if (state.isSample) return [];
 const actions: MobileAction[] = [];
 if (state.canFinish) {
  actions.push({ id: "finish", kind: "primary", enabled: !state.busy });
 } else {
  actions.push({
   id: "send", kind: "primary", enabled: state.canSend && !state.busy,
   hint: state.canSend ? undefined : state.liveVoice ? copy.talkFirst : copy.answerFirst,
  });
 }
 actions.push({ id: "skip", kind: "secondary", enabled: !state.busy });
 return actions;
}
