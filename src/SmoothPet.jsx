import { useEffect, useRef, useState } from "react";
import { createPetAnimation } from "./pet-animation.js";
import restSheet from "./assets/nailao/rest-repaired-sheet.png";

export default function SmoothPet({ src, alt, className = "" }) {
  const canvas = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    const resting = /nailao-action-rest-image2/.test(src || "");
    const player = createPetAnimation(canvas.current, {
      src: resting ? restSheet : src,
      sheet: resting ? { columns: 4, rows: 3, frameDuration: 180 } : undefined,
      alignment: /\bdesktop-cat\b/.test(className) ? "left" : "center",
    });
    player.ready.then(() => { if (active) setReady(true); }).catch(error => {
      console.warn("Pet animation could not start", error);
    });
    return () => { active = false; player.destroy(); };
  }, [src, className]);
  return <span className={`smooth-pet ${className}`}>
    <img src={src} alt={alt} draggable={false} hidden={ready} className="smooth-pet-fallback" />
    <canvas ref={canvas} role="img" aria-label={alt} style={{ display: ready ? "block" : "none" }} />
  </span>;
}
