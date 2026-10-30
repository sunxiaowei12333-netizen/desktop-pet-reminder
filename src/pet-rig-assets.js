import wave from './assets/nailao/rig/rig-wave.png';
import rest from './assets/nailao/rig/rig-rest.png';
import look from './assets/nailao/rig/rig-look.png';
import stretch from './assets/nailao/rig/rig-stretch.png';
import companion from './assets/nailao/rig/rig-companion.png';
import blink from './assets/nailao/rig/rig-blink.png';
import { RIG_DURATION_MS } from './pet-rig.js';
const textures={wave,rest,look,stretch,companion,blink};
export function rigAssetFor(src){const id=/nailao-action-(wave|rest|look|stretch|companion|blink)-image2/.exec(src||'')?.[1];return id?{kind:'fixed-rig',id,src:textures[id],durationMs:RIG_DURATION_MS}:undefined;}
