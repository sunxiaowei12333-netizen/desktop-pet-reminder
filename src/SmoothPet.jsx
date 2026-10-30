import { useEffect, useRef, useState } from "react";
import { createPetAnimation } from "./pet-animation.js";
import { motionAssetFor } from "./pet-motion-assets.js";

export default function SmoothPet({ src, alt, className = "" }) {
  const canvas = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    const player = createPetAnimation(canvas.current, {
      src,
      motion: motionAssetFor(src),
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
