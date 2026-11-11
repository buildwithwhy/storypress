// Lost-reply reliability (fix 2): the AI reply can never be silently lost.
// Three guarantees, each verified both behaviorally (pure logic, bundled via
// esbuild like the other checks) and by wiring assertions on the component:
//   1. The interview fetch is bounded — a stalled connection aborts with
//      TimeoutError instead of wedging "Thinking…" forever, and the submit
//      latch releases on every send() exit path.
//   2. A photo arriving during an in-flight reply is an explicit cancel that
//      releases the latch — the reply is superseded, never leaked.
//   3. A failed reply renders inline beside the failed turn with a Retry
//      button (the old top-of-page banner scrolled off-screen on mobile).
// Run: node scripts/check-reply-reliability.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';

const bundled=await build({stdin:{contents:"export * from './lib/reply-recovery.ts'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {INTERVIEW_TIMEOUT_MS,interviewFetchSignal,isReplyTimeout,replyProblemText,photoArrivalDuringReply}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {flowCopy}=await import('data:text/javascript;base64,'+Buffer.from((await build({stdin:{contents:"export * from './lib/flow-copy.ts'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'})).outputFiles[0].text).toString('base64'));

// --- 1. The timeout envelope ---

// Bounded well past the server's 55s provider cap, but finite.
assert.equal(INTERVIEW_TIMEOUT_MS,90_000,'the interview fetch timeout is 90s');
assert.ok(INTERVIEW_TIMEOUT_MS>55_000,'the client bound sits above the 55s provider cap');

// The narrator's per-request controller still cancels immediately…
{
 const controller=new AbortController();
 const signal=interviewFetchSignal(controller);
 assert.equal(signal.aborted,false,'a fresh interview fetch signal is not aborted');
 controller.abort();
 assert.equal(signal.aborted,true,'aborting the request controller aborts the interview fetch');
}

// …and the wall clock aborts on its own, with a TimeoutError reason.
{
 const controller=new AbortController();
 const signal=interviewFetchSignal(controller,5);
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(signal.aborted,true,'a stalled connection aborts the interview fetch at the timeout');
 assert.equal((signal.reason??{}).name,'TimeoutError','the timeout abort carries a TimeoutError reason');
 assert.equal(controller.signal.aborted,false,'the timeout does not abort the narrator controller');
}

// TimeoutError is recognized as a reply timeout; network TypeErrors and
// server messages are not.
assert.equal(isReplyTimeout(new DOMException('signal timed out','TimeoutError')),true,'TimeoutError is a reply timeout');
assert.equal(isReplyTimeout(new DOMException('aborted','AbortError')),false,'AbortError is narrator cancellation, not a timeout');
assert.equal(isReplyTimeout(new TypeError('fetch failed')),false,'a network TypeError is not a timeout');

// --- Failure copy: timeouts and network drops name the failure and offer retry ---

for(const language of ['en','zh','es']){
 const timeout=replyProblemText(new DOMException('signal timed out','TimeoutError'),language);
 const network=replyProblemText(new TypeError('fetch failed'),language);
 const server=replyProblemText(new Error('The interview could not continue.'),language);
 assert.equal(timeout,flowCopy[language].replyTimeout,`${language}: timeouts read as a reply that did not arrive`);
 assert.equal(network,flowCopy[language].replyLost,`${language}: network drops read as a reply that did not arrive`);
 assert.equal(server,'The interview could not continue.',`${language}: server messages pass through untouched`);
 for(const text of [timeout,network]){
  assert.match(text,/didn’t arrive|没有|no llegó/,`${language}: failure copy names the failure`);
  assert.match(text,/kept|保留|conservan/,`${language}: failure copy keeps the words-kept reassurance`);
 }
 assert.equal(flowCopy[language].retry.length>0,true,`${language}: retry action label exists`);
}
// The retry affordance is an action, not a sentence.
assert.equal(flowCopy.en.retry,'Try again','the retry label reads as an action button');

// --- 2. The photo-arrival race ---

// A photo during an in-flight reply must abort the pending reply…
assert.deepEqual(photoArrivalDuringReply(true,true),{abortReply:true,releaseLatch:true},'a photo during an in-flight reply cancels it and releases the latch');
assert.deepEqual(photoArrivalDuringReply(false,true),{abortReply:true,releaseLatch:true},'an in-flight fetch is aborted even without the latch');
assert.deepEqual(photoArrivalDuringReply(true,false),{abortReply:true,releaseLatch:true},'a held latch is released even without an in-flight fetch');
assert.deepEqual(photoArrivalDuringReply(false,false),{abortReply:false,releaseLatch:true},'a quiet photo add touches nothing but the latch');

// Race unit: addPhoto during an in-flight reply must not leak the latch.
{
 let submitting=true; // send() is mid-flight on a wedged connection
 const inFlight=true; // the interview fetch is outstanding
 const pre=photoArrivalDuringReply(submitting,inFlight);
 if(pre.abortReply){/* interviewRequest.current?.abort() — the send's catch runs */}
 if(pre.releaseLatch)submitting=false; // addPhoto releases immediately…
 // …and the aborted send's own unconditional finally releases again — a
 // no-op, not a leak. Either order, the latch ends clear.
 assert.equal(submitting,false,'photo arrival during an in-flight reply leaves the submit latch clear');
}

// --- 3. Wiring: the component uses the guarantees above ---

const tsx=readFileSync('app/storypress.tsx','utf8');

// The interview fetch is bounded by the combined signal, not the bare controller.
assert.ok(tsx.includes('signal:interviewFetchSignal(controller)'),
  'the interview fetch combines the per-request controller with the 90s timeout');

// send() releases the latch unconditionally in finally — every exit path.
assert.ok(/finally\{submitting\.current=false;if\(id===requestId\.current\)setBusy\(""\);\}/.test(tsx.replace(/\s+/g,'').replace(/'/g,'"')),
  'send() releases the submit latch unconditionally in finally');

// Failures map through replyProblemText (timeout/network-aware), not the raw problem text.
assert.ok((tsx.match(/setReplyError\(replyProblemText/g)||[]).length>=3,
  'interview reply failures (send, retry, skip, correction) map through replyProblemText');

// addPhoto explicitly cancels and releases instead of silently superseding.
assert.ok(tsx.includes('photoArrivalDuringReply(submitting.current,!!interviewRequest.current)'),
  'addPhoto consults the explicit-cancel decision');
assert.ok(/if\(preemption\.abortReply\)\{interviewRequest\.current\?\.abort\(\);interviewRequest\.current=null;\}/.test(tsx),
  'addPhoto aborts the in-flight interview fetch');
assert.ok(/if\(preemption\.releaseLatch\)submitting\.current=false;/.test(tsx),
  'addPhoto releases the submit latch');

// The failed reply renders inline beside the failed turn — after the
// "Thinking…" indicator (or the make progress panel that replaces it during a
// make), before the transcript — with a Retry button, and the off-screen
// top-banner retry button is gone.
assert.ok(/mode === "type" && busy && \(makePhase \? <MakeProgress[^]*reply-error/.test(tsx),
  'the inline reply error renders after the working indicator, beside the failed turn');
const inlineBlock=tsx.match(/reply-error[^<]*<[^>]*>[\s\S]{0,400}?retryInterview/);
assert.ok(inlineBlock,'the inline reply error carries the Retry button (re-asks the question)');
assert.ok(!/error&&words\.length>0&&!story\.sample&&<button/.test(tsx),
  'the old top-banner retry button is gone');

console.log('Passed: bounded interview fetch with unconditional latch release, photo-arrival cancel without latch leak, and an inline reply error with Retry beside the failed turn.');
