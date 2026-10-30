/** Continuous fixed-texture rigs; decoded source frames for custom GIFs. */
import { createRigRenderer } from './pet-rig-renderer.js';
const assets = new Map();
const MAX_IDLE_ASSETS = 2;

function measureContentBounds(frames, width, height) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let left = width, top = height, right = -1, bottom = -1;
  try {
    for (const frame of frames) {
      context.clearRect(0, 0, width, height); context.drawImage(frame, 0, 0);
      const pixels = context.getImageData(0, 0, width, height).data;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] > 16) {
          left = Math.min(left, x); top = Math.min(top, y);
          right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
      }
    }
  } catch { return { left: 0, top: 0, right: width, bottom: height }; }
  return right < 0 ? { left: 0, top: 0, right: width, bottom: height }
    : { left, top, right: right + 1, bottom: bottom + 1 };
}

export function framePlacement(asset, canvasWidth, canvasHeight, padding = .05, alignment = 'center') {
  // Translate transparent margins without enlarging or shrinking the cat.
  const scale = Math.min(canvasWidth / asset.width, canvasHeight / asset.height) * (1 - padding * 2);
  let x = (canvasWidth - asset.width * scale) / 2;
  let y = (canvasHeight - asset.height * scale) / 2;
  if (alignment === 'left') {
    const bounds = asset.bounds || { left: 0, top: 0, right: asset.width, bottom: asset.height };
    x = canvasWidth * padding - bounds.left * scale;
    y = canvasHeight / 2 - (bounds.top + bounds.bottom) / 2 * scale;
  }
  return { x, y, width: asset.width * scale, height: asset.height * scale, scale };
}

export function paintSourceFrame(context, asset, index, canvasWidth, canvasHeight, padding, alignment) {
  const rect = framePlacement(asset, canvasWidth, canvasHeight, padding, alignment);
  // Every paint starts clear and draws exactly one opaque source frame. This
  // prevents a previous paw/face from remaining underneath a different pose.
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.drawImage(asset.frames[index], rect.x, rect.y, rect.width, rect.height);
}

export function sampleTimeline(durations, elapsed) {
  const total = durations.reduce((sum, value) => sum + value, 0);
  let time = ((elapsed % total) + total) % total;
  for (let index = 0; index < durations.length; index++) {
    if (time < durations[index] || index === durations.length - 1) {
      return { index, next: (index + 1) % durations.length, mix: time / durations[index], duration: total };
    }
    time -= durations[index];
  }
}

async function decodeAsset(src, sheet, motion) {
  const response = await fetch(motion?.kind === 'fixed-rig' ? motion.src : src);
  if (!response.ok && response.status !== 0) throw new Error(`Pet image could not be read: ${response.status}`);
  const data = await response.arrayBuffer();
  const frames = [], durations = [];
  try {
    if (motion?.kind === 'fixed-rig') {
      frames.push(await createImageBitmap(new Blob([data], { type: 'image/png' })));
      durations.push(motion.durationMs);
    } else if (sheet) {
      const columns = Math.max(1, Math.floor(sheet.columns || 1));
      const rows = Math.max(1, Math.floor(sheet.rows || 1));
      const count = Math.min(columns * rows, Math.max(1, Math.floor(sheet.frameCount || columns * rows)));
      const image = await createImageBitmap(new Blob([data], { type: 'image/png' }));
      const width = Math.ceil(image.width / columns), height = Math.ceil(image.height / rows);
      const cell = document.createElement('canvas'); cell.width = width; cell.height = height;
      const ctx = cell.getContext('2d', { willReadFrequently: true });
      const aligned = document.createElement('canvas'); aligned.width = width; aligned.height = height;
      const alignedCtx = aligned.getContext('2d');
      try {
        for (let i = 0; i < count; i++) {
          const column = i % columns, row = Math.floor(i / columns);
          const x0 = Math.floor(column * image.width / columns), x1 = Math.floor((column + 1) * image.width / columns);
          const y0 = Math.floor(row * image.height / rows), y1 = Math.floor((row + 1) * image.height / rows);
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(image, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
          const pixels = ctx.getImageData(0, 0, width, height);
          let left = width, right = -1, bottom = -1;
          for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const p = (y * width + x) * 4;
            if (pixels.data[p + 3] <= 3) pixels.data.fill(0, p, p + 4);
            else if (pixels.data[p + 3] > 16) { left = Math.min(left, x); right = Math.max(right, x); bottom = Math.max(bottom, y); }
          }
          ctx.putImageData(pixels, 0, 0);
          alignedCtx.clearRect(0, 0, width, height);
          // Sprite generators may shift the grid a few pixels. Align the content
          // to one baseline without changing its size, including fractional rows.
          const dx = right >= 0 ? Math.round((width - 1 - left - right) / 2) : 0;
          const dy = bottom >= 0 ? Math.round(height * .88) - bottom : 0;
          alignedCtx.drawImage(cell, dx, dy);
          frames.push(await createImageBitmap(aligned));
          durations.push(Math.max(20, Number(Array.isArray(sheet.frameDuration) ? sheet.frameDuration[i] : sheet.frameDuration) || 140));
        }
      } finally { image.close(); }
    } else {
      if (typeof ImageDecoder === 'undefined') throw new Error('This browser does not support animated image decoding');
      const decoder = new ImageDecoder({ data, type: 'image/gif', preferAnimation: true });
      try {
        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        if (!track?.frameCount) throw new Error('Animated image has no frames');
        for (let i = 0; i < track.frameCount; i++) {
          const { image } = await decoder.decode({ frameIndex: i, completeFramesOnly: true });
          try {
            frames.push(await createImageBitmap(image));
            durations.push(Math.max(20, Number(image.duration) / 1000 || 100));
          } finally { image.close(); }
        }
      } finally { decoder.close(); }
    }
    const asset = { frames, durations, width: frames[0].width, height: frames[0].height };
    asset.bounds = measureContentBounds(frames, asset.width, asset.height);
    if (motion?.kind === 'fixed-rig') asset.rig = motion;
    return asset;
  } catch (error) { frames.forEach(frame => frame.close()); throw error; }
}

function acquireAsset(src, sheet, motion) {
  const key = `${src}|${JSON.stringify(sheet || null)}|${JSON.stringify(motion || null)}`;
  let entry = assets.get(key);
  if (!entry) {
    entry = { refs: 0, used: performance.now(), asset: null };
    entry.promise = decodeAsset(src, sheet, motion).then(asset => { entry.asset = asset; return asset; }).catch(error => { assets.delete(key); throw error; });
    assets.set(key, entry);
  }
  entry.refs++;
  return { promise: entry.promise, release() {
    entry.refs = Math.max(0, entry.refs - 1);
    entry.used = performance.now();
    const idle = [...assets.entries()].filter(([, item]) => item.refs === 0).sort((a, b) => b[1].used - a[1].used);
    idle.slice(MAX_IDLE_ASSETS).forEach(([idleKey, item]) => {
      assets.delete(idleKey);
      item.promise.then(asset => { asset.frames.forEach(frame => frame.close()); asset.motion?.atlas.close(); }).catch(() => {});
    });
  } };
}

export function createPetAnimation(canvas, { src, sheet, motion, padding = .05, alignment = "center" } = {}) {
  if (!canvas || !src) throw new Error('A canvas and image source are required');
  const handle = acquireAsset(src, sheet, motion);
  let destroyed = false, asset, renderer, raf = 0, elapsed = 0, lastTime = null, intersecting = true, renderedFrames = 0, lastStats = -Infinity, currentDpr, fallbackHandle;
  const inset = Math.max(0, Math.min(.2, padding));
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    currentDpr = dpr;
    const width = Math.max(1, Math.round((rect.width || 220) * dpr));
    const height = Math.max(1, Math.round((rect.height || 240) * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }
  function draw(now) {
    raf = 0;
    if (destroyed || !asset || document.hidden || !intersecting) { lastTime = null; return; }
    if (lastTime !== null) elapsed += now - lastTime;
    lastTime = now;
    if (currentDpr !== Math.min(2, window.devicePixelRatio || 1)) resize();
    const state = sampleTimeline(asset.durations, elapsed);
    renderer.draw(asset, state, inset);
    renderedFrames++;
    if (now - lastStats >= 250) {
      canvas.dataset.petSourceFrame = String(state.index);
      canvas.dataset.petRenderedFrames = String(renderedFrames);
      lastStats = now;
    }
    raf = requestAnimationFrame(draw);
  }
  function updateVisibility() {
    if (document.hidden || !intersecting || destroyed) { cancelAnimationFrame(raf); raf = 0; lastTime = null; }
    else if (asset && !raf) raf = requestAnimationFrame(draw);
  }
  document.addEventListener('visibilitychange', updateVisibility);
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    intersecting = entries[0]?.isIntersecting !== false; updateVisibility();
  }) : null;
  observer?.observe(canvas);
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(canvas);
  const ready = handle.promise.then(async decoded => {
    if (destroyed) return null;
    asset = decoded;
    resize();
    renderer = asset.rig ? createRigRenderer(canvas, (asset, width, height, padding) => framePlacement(asset, width, height, padding, alignment)) : null;
    if (!renderer) {
      // The canonical GIF is exported from this same rig. Use its full animation
      // when WebGL is unavailable, never a frozen base or old 16-pose animation.
      if (asset.rig) {
        fallbackHandle = acquireAsset(src);
        asset = await fallbackHandle.promise;
        if (destroyed) return null;
      }
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) throw new Error('Canvas rendering is unavailable');
      renderer = {
        kind: 'canvas-source-frames',
        draw(asset, state, padding) {
          paintSourceFrame(context, asset, state.index, canvas.width, canvas.height, padding, alignment);
        },
        destroy() { context.clearRect(0, 0, canvas.width, canvas.height); }
      };
    }
    canvas.dataset.petMotion = asset.rig ? 'fixed-texture-rig' : 'source-frames';
    canvas.dataset.petRenderer = renderer.kind;
    canvas.dataset.petFrames = String(asset.frames.length);
    canvas.dataset.petDuration = String(asset.durations.reduce((a, b) => a + b, 0));
    renderer.draw(asset, sampleTimeline(asset.durations, 0), inset);
    updateVisibility();
    return { frameCount: asset.frames.length, duration: asset.durations.reduce((a, b) => a + b, 0), renderer: renderer.kind };
  });
  return { ready, getStats() { return { renderedFrames, elapsed, renderer: renderer?.kind, ...renderer?.getStats?.() }; }, destroy() {
    if (destroyed) return;
    destroyed = true; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', updateVisibility);
    observer?.disconnect(); resizeObserver?.disconnect(); renderer?.destroy(); handle.release(); fallbackHandle?.release();
  } };
}
