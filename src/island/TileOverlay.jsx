// Renders one equipped overlay's particle effect (see overlays.js for the
// catalog) as a handful of emoji characters animated via CSS (overlays.css)
// over whatever it's placed inside — the WHOLE roster tile (StudentGrid.jsx)
// or the WHOLE drag frame (My Bag's preview, TamadexToast.jsx), both of
// which just wrap this in a position:relative container with nothing else
// absolutely positioned inside it fighting for the same space.
//
// Self-measures its own container via ResizeObserver (containerRef/height
// below) rather than taking a height prop — the roster tile's real size is
// CSS-grid-determined, not a fixed pixel constant any caller actually
// knows, so a passed-in height can't generalize across callers (one
// earlier version of this hardcoded the SPRITE AREA's height specifically,
// which is why the effect used to only cover that smaller region instead
// of the whole card). The actual measured height feeds 'fall' particles'
// travel distance — a CSS translateY(115%) resolves against the
// PARTICLE's own tiny box (a ~10-16px emoji span), not the container it's
// supposed to fall through, so the real pixel height has to come from
// somewhere; see overlays.css's --overlay-fall-distance for where it's
// actually used.
//
// Per-particle randomization (left position, size, animation duration/
// delay, horizontal drift) is computed ONCE per overlayId, in an effect —
// not during render (a useMemo computing Math.random() would technically
// still run during render; this app's existing convention, e.g.
// StudentGrid.jsx's runCoinRain, keeps Math.random() entirely out of
// render by generating it from an effect/handler instead) — then stored
// in state, so particles don't jitter or restart mid-animation on
// unrelated re-renders (e.g. the tile's own point/growth updates).
// pointerEvents:'none' throughout so the overlay never blocks clicks on
// whatever it's sitting over.

import { useEffect, useRef, useState } from 'react';
import './overlays.css';

// type: 'fall' (drifts top to bottom, loops — snow/rain/leaves), 'float'
// (gently bobs in place — ghosts), or 'static' (fixed corner decoration,
// no animation — spiderwebs). durationRange/driftRange only apply to
// fall/float; corners only applies to static.
const OVERLAY_CONFIG = {
  snow: { type: 'fall', symbol: '❄️', count: 10, sizeRange: [8, 14], durationRange: [3.5, 6], driftRange: 20, opacity: 0.85 },
  rain: { type: 'fall', symbol: '💧', count: 14, sizeRange: [6, 10], durationRange: [0.6, 1.1], driftRange: 4, opacity: 0.75 },
  leaves: { type: 'fall', symbol: '🍂', count: 7, sizeRange: [10, 16], durationRange: [4, 7], driftRange: 30, opacity: 0.9 },
  ghosts: { type: 'float', symbol: '👻', count: 2, sizeRange: [16, 20], durationRange: [2.5, 4], driftRange: 10, opacity: 0.8 },
  spiderwebs: { type: 'static', symbol: '🕸️', sizeRange: [18, 24], opacity: 0.6, corners: ['top-left', 'bottom-right'] },
};

const CORNER_STYLE = {
  'top-left': { top: '2%', left: '2%' },
  'top-right': { top: '2%', right: '2%' },
  'bottom-left': { bottom: '2%', left: '2%' },
  'bottom-right': { bottom: '2%', right: '2%' },
};

let nextKey = 0; // just for unique React keys, not randomness

function makeParticles(config) {
  const sizeAt = () => config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0]);

  if (config.type === 'static') {
    return config.corners.map((corner) => ({ key: nextKey++, corner, size: sizeAt() }));
  }

  const [minDuration, maxDuration] = config.durationRange;
  return Array.from({ length: config.count }, () => ({
    key: nextKey++,
    left: Math.random() * 85, // percent — leaves a little room so particles don't spawn half off-edge
    size: sizeAt(),
    duration: minDuration + Math.random() * (maxDuration - minDuration),
    delay: -Math.random() * maxDuration, // negative delay starts the particle already mid-flight, so they're staggered from the very first paint instead of all starting together
    drift: (Math.random() - 0.5) * 2 * config.driftRange,
  }));
}

export default function TileOverlay({ overlayId }) {
  const config = overlayId ? OVERLAY_CONFIG[overlayId] : null;
  const [particles, setParticles] = useState([]);
  const containerRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    setParticles(config ? makeParticles(config) : []);
    // Only overlayId matters for re-rolling particles — config is derived
    // from it (a stable lookup into the module-level OVERLAY_CONFIG), not
    // its own independent input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayId]);

  // Re-attaches on every overlayId change, not just mount — the container
  // div below only renders at all once `config` is truthy, so if this ran
  // once on mount with nothing equipped yet, containerRef.current would be
  // null forever and a LATER equip would never get measured.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setHeight(entries[0].contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [overlayId]);

  if (!config) return null;

  return (
    <div ref={containerRef} style={overlayContainerStyle}>
      {config.type === 'static'
        ? particles.map((p) => (
            <span key={p.key} className="overlay-particle-static" style={{ ...CORNER_STYLE[p.corner], fontSize: p.size, opacity: config.opacity }}>
              {config.symbol}
            </span>
          ))
        : particles.map((p) => (
            <span
              key={p.key}
              className={config.type === 'fall' ? 'overlay-particle-fall' : 'overlay-particle-float'}
              style={{
                left: `${p.left}%`,
                top: config.type === 'float' ? '38%' : undefined,
                fontSize: p.size,
                opacity: config.opacity,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
                '--overlay-drift': `${p.drift}px`,
                '--overlay-fall-distance': `${height}px`,
              }}
            >
              {config.symbol}
            </span>
          ))}
    </div>
  );
}

const overlayContainerStyle = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
  lineHeight: 1,
};
