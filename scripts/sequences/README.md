# Offline sequence asset build

Production runs pre-rendered lossless animated WebP, not an inference model. The Python build uses immutable key poses under `assets/sequence-keyframes`, regional alignment/compositing, and RIFE 4.25 to produce in-between poses. RGB and alpha share one flow and occlusion mask. Static regions are restored exactly. The renderer uses constant whole-cat scale and normalizes head-size drift locally for stretch/tilt.

Model and architecture: [author's Practical-RIFE repository](https://github.com/hzwer/Practical-RIFE), 4.25 archive linked by its README. The setup verifies SHA-256 before extracting its two required files. MIT attribution is in `RIFE-LICENSE.txt`; the `model/warplayer.py` dependency is vendored from the same project. No inference model, Python dependency, or network call is shipped inside the App.

```bash
python3.11 -m venv .venv-sequences
.venv-sequences/bin/pip install -r scripts/sequences/requirements.txt
.venv-sequences/bin/python scripts/sequences/prepare_model.py
.venv-sequences/bin/python scripts/sequences/render_sequence.py
.venv-sequences/bin/python scripts/sequences/encode_sequences.py
# Inspect candidate/*/full-cycle.jpg and all animations on light/dark backgrounds.
cp release/sequence-work/encoded/* src/assets/nailao/sequences/
.venv-sequences/bin/python scripts/sequences/export_delivery.py
npm test
npm run verify:animation
npm run build
npm run verify:build
```

`SEQUENCE_WORK` overrides the build directory; `SEQUENCE_EXPORT` overrides the GIF delivery directory. Optional positional action IDs restrict the renderer, e.g. `render_sequence.py wave stretch`. Export uses a global palette, no dithering, disposal 2, and checks every decoded alpha frame against its source. App WebP decoding must have zero visible RGBA error. Generated candidate reports remain marked pending until visual review; metrics alone do not establish naturalness.

The loop returns through the same poses in reverse after a brief hold. This is intentional for a reminder loop, not a claim of captured live animal motion. Old mesh-rig and optical-flow runtime commands are archival and must not overwrite these production assets.
