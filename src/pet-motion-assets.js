import wave from './assets/nailao/motion-wave.png';
import rest from './assets/nailao/motion-rest.png';
import look from './assets/nailao/motion-look.png';
import stretch from './assets/nailao/motion-stretch.png';
import companion from './assets/nailao/motion-companion.png';
import blink from './assets/nailao/motion-blink.png';
import metadata from './assets/nailao/motion-manifest.json';
const atlases = { wave, rest, look, stretch, companion, blink };
export function motionAssetFor(src) {
  const id = /nailao-action-(wave|rest|look|stretch|companion|blink)-image2/.exec(src || '')?.[1];
  return id ? { src: atlases[id], ...metadata[id] } : undefined;
}
