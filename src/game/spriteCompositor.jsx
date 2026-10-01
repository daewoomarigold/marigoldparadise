// Sprite-compositing React components — used by both the dev assembler
// tool (src/dev/TamaAssembler.jsx) and real app views (e.g. the island).
// Kept in one place so the two never drift apart. See spriteData.js for
// the geometry/lookup data and pure helper functions these build on.

import { spriteUrl, VARIANT_INFO, getTamaEntity, getSpriteFiles, getBibleOffsets } from './spriteData.js';
import { accessorySpriteFile } from './accessories.js';

// Every accessories.js sprite is a native 64x64 (base-resolution) static
// image, regardless of what variant/scale the tama itself renders at.
const ACCESSORY_NATIVE_SIZE = 64;

// Renders one horizontal slice of a sprite sheet, scaled up and pixelated.
// offsetX/offsetY nudge a smaller eyes/mouth strip to sit at the right spot
// within the taller/wider body canvas.
export function Cropped({ file, frameWidth, sheetHeight, frameIndex, offsetX = 0, offsetY = 0, scale }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: frameWidth * scale,
        height: sheetHeight * scale,
        overflow: 'hidden',
        transform: `translate(${offsetX * scale}px, ${offsetY * scale}px)`,
      }}
    >
      <img
        src={spriteUrl(file)}
        style={{
          position: 'absolute',
          left: -frameIndex * frameWidth * scale,
          top: 0,
          imageRendering: 'pixelated',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      />
    </div>
  );
}

// High-level composite: body+eyes+mouth layered for one tama, one variant,
// one frame-per-layer, at real bible offsets (falling back to VARIANT_INFO
// defaults if this tama has none, e.g. the egg). Wrap in a container sized
// frameWidth*scale x canvasHeight*scale; this renders absolutely within it.
// mirrored flips the whole composite horizontally (CSS scaleX(-1)) for
// e.g. walk_right, which is walk_left's data reused, not separate frames.
// faceOffset ({x, y}, optional) adds an extra per-frame pixel nudge to
// eyes+mouth on top of the bible offset — e.g. an animation state's
// faceOffsetX/Y (see resolveAnimState in spriteData.js) for the walk
// cycle's lean-compensation and step up-shift. Not applied to body.
//
// accessory ({id, x, y, onPointerDown?, onPointerMove?, onPointerUp?},
// optional — see accessories.js/useClassroomStore.js's equippedAccessory)
// draws one more image on top of everything else, anchored to the SAME
// per-frame face position eyes/mouth already track (bible offset +
// faceOffset — see offsetFor below) rather than the body canvas's fixed
// origin: x/y are a base-resolution pixel offset from THAT anchor, not
// from (0,0). This is what makes an accessory actually follow the head's
// walk-cycle bob instead of gliding in a straight line above it while the
// tama bobs underneath — earlier versions anchored to the body layer
// (which never moves within its own canvas) and looked disconnected
// during animation. It still inherits `mirrored` (it's inside the same
// flipped container) and scales down proportionally for the 'mini'
// variant (accessory art is always native 64x64/base-resolution,
// regardless of what variant the tama itself is).
//
// Units: faceAnchor comes from THIS variant's own bible offsets, so it's
// already in this variant's pixels (mini: a 32px canvas) and must NOT be
// scaled by variantFactor again. Only the saved accessory.x/y (always
// base-resolution — the My Bag editor uses the base variant) and the 64px
// art get scaled down. An earlier version multiplied the anchor by
// variantFactor too, which halved it on the mini field sprites and left
// every accessory floating up and to the left of where it was placed.
// Mini anchors are within half a pixel of base/2 for every tama in the
// atlas, so the scaled offset lands where the editor showed it.
//
// The optional pointer handlers exist so TamadexToast.jsx's My Bag
// positioning editor can render its draggable accessory through this
// EXACT same component/formula (passing handlers, no faceOffset — a
// static preview frame) instead of duplicating the positioning math in a
// second place that could drift out of sync with this one.
export function TamaComposite({ tamaId, variant, frames, scale, mirrored = false, faceOffset, accessory }) {
  const entity = getTamaEntity(tamaId);
  if (!entity) return null;
  const info = VARIANT_INFO[variant];
  const files = getSpriteFiles(entity, variant);
  const bible = getBibleOffsets(entity, variant);
  const frameWidth = info.layers.body.defaultFrameWidth;
  const variantFactor = info.canvasHeight / 64; // 1 for base, 0.5 for mini

  function offsetFor(layer) {
    const fallback = { x: info.layers[layer].defaultOffsetX, y: info.layers[layer].defaultOffsetY };
    const base = bible ? (bible[layer] ?? fallback) : fallback;
    if (!faceOffset) return base;
    return { x: base.x + faceOffset.x, y: base.y + faceOffset.y };
  }

  const faceAnchor = offsetFor('eyes'); // this frame's actual head position — same data the eyes layer itself renders at

  return (
    <div
      style={{
        position: 'relative',
        width: frameWidth * scale,
        height: info.canvasHeight * scale,
        transform: mirrored ? 'scaleX(-1)' : undefined,
      }}
    >
      {['body', 'eyes', 'mouth'].map((layer) => {
        const off = layer === 'body' ? { x: 0, y: 0 } : offsetFor(layer);
        return (
          <Cropped
            key={layer}
            file={files[layer]}
            frameWidth={frameWidth}
            sheetHeight={info.layers[layer].sheetHeight}
            frameIndex={frames[layer] ?? 0}
            offsetX={off.x}
            offsetY={off.y}
            scale={scale}
          />
        );
      })}
      {accessory && (
        <img
          src={spriteUrl(accessorySpriteFile(accessory.id))}
          alt=""
          onPointerDown={accessory.onPointerDown}
          onPointerMove={accessory.onPointerMove}
          onPointerUp={accessory.onPointerUp}
          style={{
            position: 'absolute',
            left: (faceAnchor.x + accessory.x * variantFactor) * scale,
            top: (faceAnchor.y + accessory.y * variantFactor) * scale,
            width: ACCESSORY_NATIVE_SIZE * variantFactor * scale,
            height: ACCESSORY_NATIVE_SIZE * variantFactor * scale,
            imageRendering: 'pixelated',
            pointerEvents: accessory.onPointerDown ? 'auto' : 'none',
            cursor: accessory.onPointerDown ? 'grab' : undefined,
            touchAction: accessory.onPointerDown ? 'none' : undefined,
          }}
        />
      )}
    </div>
  );
}
