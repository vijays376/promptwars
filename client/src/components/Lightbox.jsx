import { useEffect, useState, useCallback } from "react";

// Full-screen image carousel. One photo at a time with prev/next, a counter,
// keyboard support (← → Esc), a caption, and a spinner while each photo loads.
export default function Lightbox({ images = [], index = 0, name, onClose, onIndex }) {
  const n = images.length;
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(false); }, [index]); // show spinner until the new photo loads
  const prev = useCallback(() => onIndex((index - 1 + n) % n), [index, n, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % n), [index, n, onIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  if (n === 0) return null;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Photos of ${name}`} onClick={onClose}>
      <button className="close" onClick={onClose} aria-label="Close gallery">✕</button>
      <div className="stage" onClick={(e) => e.stopPropagation()}>
        {n > 1 && <button className="nav prev" onClick={prev} aria-label="Previous photo">‹</button>}
        {!loaded && <div className="lb-spinner" aria-hidden="true" />}
        <img src={images[index]} alt={`${name} — photo ${index + 1} of ${n}`}
          style={{ opacity: loaded ? 1 : 0, transition: "opacity .2s" }}
          onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} />
        {n > 1 && <button className="nav next" onClick={next} aria-label="Next photo">›</button>}
      </div>
      <div className="cap">{name}</div>
      <div className="counter">{index + 1} / {n} · photos via Wikimedia Commons</div>
    </div>
  );
}
