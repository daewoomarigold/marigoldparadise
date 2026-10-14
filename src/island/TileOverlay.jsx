// Renders one equipped overlay's effect (see overlays.js for the catalog)
// over whatever it's placed inside — the WHOLE roster tile
// (StudentGrid.jsx) or the WHOLE drag frame (My Bag's preview,
// TamadexToast.jsx), both of which just wrap this in a position:relative
// container with nothing else absolutely positioned inside it fighting
// for the same space.
//
// Two render kinds, dispatched on overlays.js's `render.kind` (via
// findOverlay):
// - 'sprite': a handful of static-position copies of a real pixel-art
//   looping sprite sheet (the Cooked FX pack — see overlays.js's header
//   comment), each independently stepping through its own frames via
//   overlays.css's overlay-sprite-frame keyframe. These sheets already
//   bake their own motion into the frames (rain streaks fall WITHIN the
//   loop, snow drifts within it, etc.) — see PLACEMENT_CONFIG below — so
//   the particle itself doesn't move, only its frame does.
// - 'emoji': the original approach — a handful of emoji characters
//   animated via CSS (overlays.css's overlay-fall/overlay-float), still
//   used for ghosts/spiderwebs (no sprite art for those). 'fall' drifts
//   top to bottom and loops (unused now — the only remaining emoji
//   overlays are 'float'/'static'), 'float' gently bobs in place
//   (ghosts), 'static' is a fixed corner decoration with no animation
//   (spiderwebs).
//
// Self-measures its own container via ResizeObserver (containerRef/height
// below) rather than taking a height prop — the roster tile's real size is
// CSS-grid-determined, not a fixed pixel constant any caller actually
// knows, so a passed-in height can't generalize across callers (one
// earlier version of this hardcoded the SPRITE AREA's height specifically,
// which is why the effect used to only cover that smaller region instead
// of the whole card). The measured height only matters for 'fall'-type
// emoji particles now (a CSS translateY(115%) resolves against the
// PARTICLE's own tiny box, not its container, so the real pixel height
// has to come from somewhere — see overlays.css's --overlay-fall-distance)
// — sprite particles are statically positioned (percentage left/top is
// enough) and don't need it.
//
// Per-particle randomization (left/top position, size, animation delay,
// and for emoji fall/float also duration/drift) is computed ONCE per
// overlayId, in an effect — not during render (a useMemo computing
// Math.random() would technically still run during render; this app's
// existing convention, e.g. StudentGrid.jsx's runCoinRain, keeps
// Math.random() entirely out of render by generating it from an
// effect/handler instead) — then stored in state, so particles don't
// jitter or restart mid-animation on unrelated re-renders (e.g. the
// tile's own point/growth updates). pointerEvents:'none' throughout so
// the overlay never blocks clicks on whatever it's sitting over.

import { useEffect, useRef, useState } from 'react';
import { findOverlay } from '../game/overlays.js';
import './overlays.css';

// Placement-only config, keyed by overlay id — what render.kind/sprite
// metadata to use comes from overlays.js itself (findOverlay), kept out
// of this file so it's defined in exactly one place. `kind` mirrors
// overlays.js's render.kind for dispatch; 'sprite' entries additionally
// need `count`/`sizeRange` (how many copies, how big on screen — distinct
// from the sheet's own native `cell` size, which is just source
// resolution). 'emoji' entries are unchanged from before sprite overlays
// existed: `type` ('float'/'static'), durationRange/driftRange only apply
// to 'float', corners only to 'static'.
const PLACEMENT_CONFIG = {
  // Sized/counted per effect by eye from each sheet's own contact sheet
  // (each cell already shows several flakes/streaks/leaves looping within
  // it — see overlays.js — so a BUSY per-cell effect like snow/rain needs
  // fewer, bigger copies than a sparser one like fireflies/embers).
  snow: { kind: 'sprite', count: 4, sizeRange: [70, 110], opacity: 0.9 },
  rain: { kind: 'sprite', count: 4, sizeRange: [70, 100], opacity: 0.85 },
  leaves: { kind: 'sprite', count: 5, sizeRange: [50, 80], opacity: 0.9 },
  fireflies: { kind: 'sprite', count: 5, sizeRange: [40, 64], opacity: 0.95 },
  embers: { kind: 'sprite', count: 4, sizeRange: [40, 64], opacity: 0.95 },
  butterflies: { kind: 'sprite', count: 3, sizeRange: [56, 84], opacity: 1 },
  petals: { kind: 'sprite', count: 4, sizeRange: [64, 96], opacity: 0.9 },
  ghosts: { kind: 'emoji', type: 'float', count: 3, sizeRange: [16, 20], durationRange: [3, 5], driftRange: 14, opacity: 0.8 },
  spiderwebs: { kind: 'emoji', type: 'static', sizeRange: [18, 24], opacity: 0.6, corners: ['top-left', 'bottom-right'] },
};

const CORNER_STYLE = {
  'top-left': { top: '2%', left: '2%' },
  'top-right': { top: '2%', right: '2%' },
  'bottom-left': { bottom: '2%', left: '2%' },
  'bottom-right': { bottom: '2%', right: '2%' },
};

let nextKey = 0; // just for unique React keys, not randomness

function sizeAt(config) {
  return config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0]);
}

function makeParticles(config) {
  if (config.kind === 'sprite') {
    // top AND left both randomized (unlike emoji 'fall', which only
    // randomizes left and animates top via keyframe) — these sit still,
    // scattered across the whole card. Capped at 85%/80% so a particle
    // doesn't spawn hanging half off the right/bottom edge.
    return Array.from({ length: config.count }, () => ({
      key: nextKey++,
      left: Math.random() * 85,
      top: Math.random() * 80,
      size: sizeAt(config),
      // A fraction (negative, so the particle starts already mid-loop)
      // rather than a concrete seconds value — the real per-sheet
      // duration (frames/fps) isn't known here, just in overlays.js's
      // catalog, so the render step multiplies this in. Staggers
      // multiple copies of the same sheet so they don't all step frames
      // in perfect unison.
      delayFraction: -Math.random(),
    }));
  }

  if (config.type === 'static') {
    return config.corners.map((corner) => ({ key: nextKey++, corner, size: sizeAt(config) }));
  }

  const [minDuration, maxDuration] = config.durationRange;
  return Array.from({ length: config.count }, () => ({
    key: nextKey++,
    left: Math.random() * 85,
    size: sizeAt(config),
    duration: minDuration + Math.random() * (maxDuration - minDuration),
    delay: -Math.random() * maxDuration,
    sway: (Math.random() - 0.5) * 2 * config.driftRange,
    drift: (Math.random() - 0.5) * 2 * config.driftRange,
    spin: config.spinRange ? (Math.random() - 0.5) * 2 * config.spinRange : 0,
  }));
}

export default function TileOverlay({ overlayId }) {
  const overlay = overlayId ? findOverlay(overlayId) : null;
  const config = overlayId ? PLACEMENT_CONFIG[overlayId] : null;
  const [particles, setParticles] = useState([]);
  const containerRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    setParticles(config ? makeParticles(config) : []);
    // Only overlayId matters for re-rolling particles — config/overlay are
    // derived from it (stable lookups into module-level data), not their
    // own independent inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayId]);

  // Re-attaches on every overlayId change, not just mount — the container
  // div below only renders at all once `config` is truthy, so if this ran
  // once on mount with nothing equipped yet, containerRef.current would be
  // null forever and a LATER equip would never get measured. Only
  // actually consumed by emoji 'fall' particles (none currently equipped
  // by default, but kept generic/working) — harmless no-op cost for
  // sprite/float/static.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setHeight(entries[0].contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [overlayId]);

  if (!config || !overlay) return null;

  return (
    <div ref={containerRef} style={overlayContainerStyle}>
      {config.kind === 'sprite' &&
        (() => {
          const sprite = overlay.render; // {url, frames, fps, cell}
          const duration = sprite.frames / sprite.fps;
          return particles.map((p) => (
            <div
              key={p.key}
              className="overlay-particle-sprite"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size,
                height: p.size,
                opacity: config.opacity,
                backgroundImage: `url(${sprite.url})`,
                backgroundSize: `${sprite.frames * p.size}px ${p.size}px`,
                animationDuration: `${duration}s`,
                animationTimingFunction: `steps(${sprite.frames})`,
                animationDelay: `${p.delayFraction * duration}s`,
                '--overlay-sprite-shift': `${-(sprite.frames * p.size)}px`,
              }}
            />
          ));
        })()}
      {config.kind === 'emoji' && config.type === 'static' &&
        particles.map((p) => (
          <span key={p.key} className="overlay-particle-static" style={{ ...CORNER_STYLE[p.corner], fontSize: p.size, opacity: config.opacity }}>
            {overlay.render.symbol}
          </span>
        ))}
      {config.kind === 'emoji' && config.type !== 'static' &&
        particles.map((p) => (
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
              animationTimingFunction: config.easing ?? 'ease-in-out',
              '--overlay-sway': `${p.sway}px`,
              '--overlay-drift': `${p.drift}px`,
              '--overlay-spin': `${p.spin}deg`,
              '--overlay-fall-distance': `${height}px`,
            }}
          >
            {overlay.render.symbol}
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
