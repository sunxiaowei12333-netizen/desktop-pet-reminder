import wave from './assets/nailao/sequences/sequence-wave.webp';
import rest from './assets/nailao/sequences/sequence-rest.webp';
import look from './assets/nailao/sequences/sequence-look.webp';
import stretch from './assets/nailao/sequences/sequence-stretch.webp';
import companion from './assets/nailao/sequences/sequence-companion.webp';
import blink from './assets/nailao/sequences/sequence-blink.webp';
import manifest from './assets/nailao/sequences/manifest.json';

const sources = { wave, rest, look, stretch, companion, blink };
export function sequenceAssetFor(src) {
  // Also migrate persisted built-in GIF URLs from earlier app versions.
  const id = /(?:sequence-|nailao-action-)(wave|rest|look|stretch|companion|blink)(?:-image2)?(?:-|\.)/.exec(src || '')?.[1];
  if (!id) return null;
  const spec = manifest.actions[id];
  const [left, top, right, bottom] = spec.bounds;
  return { id, src: sources[id], width: manifest.width, height: manifest.height,
    durationMs: spec.durationMs, bounds: { left, top, right: right + 1, bottom: bottom + 1 } };
}
