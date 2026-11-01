import {flowCopy} from './flow-copy';
import {networkFailure} from './interview-client';

// Lost-reply reliability (interview): a stalled connection may never wedge
// “Thinking…”, a superseding interaction may never leak the submit latch, and
// a failure must surface beside the turn it happened on — never off-screen.

// The interview fetch is bounded well past the server's 55s provider cap —
// the same 90s bound the image provider uses — so a stalled connection can
// never hold the conversation open forever.
export const INTERVIEW_TIMEOUT_MS = 90_000;

// The per-request controller owns narrator cancellation; the timeout owns the
// wall clock. AbortSignal.any combines them so either one aborts the fetch
// (and its SSE body read).
export function interviewFetchSignal(controller: AbortController, timeoutMs: number = INTERVIEW_TIMEOUT_MS): AbortSignal {
 return AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
}

// AbortSignal.timeout rejects with TimeoutError — not the TypeError a network
// failure raises — so the reply UI can say “the reply didn't arrive” instead
// of surfacing a raw signal message.
export function isReplyTimeout(problem: unknown): boolean {
 return problem instanceof Error && problem.name === 'TimeoutError';
}

// Failure copy for the interview reply path: timeouts and network drops name
// the failure and offer the retry; server messages pass through untouched.
export function replyProblemText(problem: unknown, language: keyof typeof flowCopy): string {
 if(isReplyTimeout(problem))return flowCopy[language].replyTimeout;
 if(networkFailure(problem))return flowCopy[language].replyLost;
 return (problem as Error).message;
}

// A photo arriving while a reply is in flight is an explicit cancel, chosen
// over queueing: the pending reply was generated without the photo, so
// appending it after the photo patch would read as a non-sequitur — and the
// photo flow immediately re-engages the interviewer about the photo. Cancel
// the fetch and always release the send latch; a superseded request may
// never keep it.
export function photoArrivalDuringReply(submitting: boolean, inFlight: boolean): { abortReply: boolean; releaseLatch: boolean } {
 return { abortReply: inFlight || submitting, releaseLatch: true };
}
