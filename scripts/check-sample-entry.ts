// Entry for scripts/check-sample.mjs: bundles the lib modules the sample
// assertions exercise so the check runs against real sources, not copies.
export * from '../lib/presentation';
export { sampleArtworkPath } from '../lib/artwork';
export { keepsakeMarkup } from '../lib/keepsake';
export { initialStory } from '../lib/story';
export { startCopy } from '../lib/start-copy';
