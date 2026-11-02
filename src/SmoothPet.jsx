import { useEffect, useRef, useState } from "react";
import { createPetAnimation, framePlacement } from "./pet-animation.js";
import { sequenceAssetFor } from "./pet-sequence-assets.js";

export default function SmoothPet({ src, alt, className = "" }) {
  const sequence = sequenceAssetFor(src);
  return sequence
    ? <SequencePet asset={sequence} alt={alt} className={className} />
    : <DecodedPet src={src} alt={alt} className={className} />;
}

function SequencePet({ asset, alt, className }) {
  const container = useRef(null);
  const [size, setSize] = useState(null);
  useEffect(() => {
    const measure = () => {
      const { width, height } = container.current.getBoundingClientRect();
      setSize({ width, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container.current); measure();
    return () => observer.disconnect();
  }, []);
  const rect = size && framePlacement(asset, size.width, size.height, .05,
    /\bdesktop-cat\b/.test(className) ? 'left' : 'center');
  // Chromium decodes the complete lossless RGBA frames. No runtime flow, mesh
  // deformation, crossfade, per-pose resizing, or GIF palette conversion.
  return <span ref={container} className={`smooth-pet ${className}`}
    data-pet-renderer="native-lossless-sequence" data-pet-action={asset.id}>
    <img key={asset.src} src={asset.src} alt={alt} draggable={false} decoding="async"
      className="smooth-pet-fallback" style={rect ? { position: 'absolute',
        left: rect.x, top: rect.y, width: rect.width, height: rect.height } : { visibility: 'hidden' }} />
  </span>;
}

function DecodedPet({ src, alt, className }) {
  const canvas = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    const player = createPetAnimation(canvas.current, {
      src,
      alignment: /\bdesktop-cat\b/.test(className) ? "left" : "center",
    });
    player.ready.then(() => { if (active) setReady(true); }).catch(error => {
      console.warn("Pet animation could not start", error);
    });
    return () => { active = false; player.destroy(); };
  }, [src, className]);
  return <span className={`smooth-pet ${className}`}>
    <img src={src} alt={alt} draggable={false} hidden={ready} className="smooth-pet-fallback" />
    <canvas key={`${src}|${className}`} ref={canvas} role="img" aria-label={alt} style={{ display: ready ? "block" : "none" }} />
  </span>;
}
