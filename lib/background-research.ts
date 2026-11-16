import {DAILY_AI_UNIT_CAP,type BillingStatus} from './billing';

// Background discovery (spec art_GaoPsELF): historical research fires by
// itself during the interview, never blocking one. The auto-fire decision is
// this pure predicate so the truth table in
// scripts/check-background-research.mjs can pin every boundary — the caller
// owns the effects and the request.
export const DISCOVER_COST_UNITS = 3; // storypress_reserve_ai: discover
export const WRITE_RESERVE_UNITS = 1; // storypress_reserve_ai: write
// Illustration is metered too: the illustrate path reserves through the same
// RPC via reserveAi(userId, env, 'discover') (server/api.ts), so one
// illustration costs 3 units from the shared daily pool. The 7-unit reserve
// covers one discover, one write, and one illustration exactly — not
// headroom: research must never consume capacity writing and illustrating
// still need.
export const ILLUSTRATE_RESERVE_UNITS = 3;
export const TOTAL_RESERVE_UNITS = DISCOVER_COST_UNITS + WRITE_RESERVE_UNITS + ILLUSTRATE_RESERVE_UNITS; // 7
export const MAX_AUTO_ATTEMPTS = 3;
export const MIN_NARRATOR_TURNS = 2;

export type BackgroundResearchInput = {
  isSample: boolean;
  canUseAi: boolean;
  researching: boolean;
  searched: boolean;
  // Narrator entries that carry words (not the word count): two turns are the
  // minimum signal a search could connect to.
  narratorWords: number;
  attemptsSoFar: number; // auto attempts dispatched for this draft
  newWordsSinceLastAttempt: boolean;
  // null = the account boundary cannot say (pilot mode without Supabase, or a
  // degraded usage read): unknown capacity fails closed.
  remainingAiUnits: number | null;
};

// Fires only when every condition holds.
export function shouldAutoDiscover(input: BackgroundResearchInput): boolean {
  if (input.isSample || !input.canUseAi) return false;
  if (input.researching || input.searched) return false;
  if (input.attemptsSoFar >= MAX_AUTO_ATTEMPTS) return false;
  if (input.remainingAiUnits === null) return false; // fail-closed
  if (input.remainingAiUnits < TOTAL_RESERVE_UNITS) return false;
  return input.narratorWords >= MIN_NARRATOR_TURNS && input.newWordsSinceLastAttempt;
}

// Remaining daily AI units for the signed-in owner, from the additive
// account-boundary field against the RPC's 40/day cap.
export function remainingDailyAiUnits(billing: BillingStatus | undefined): number | null {
  if (!billing || billing.dailyAiUnitsUsed === undefined) return null;
  return DAILY_AI_UNIT_CAP - billing.dailyAiUnitsUsed;
}
