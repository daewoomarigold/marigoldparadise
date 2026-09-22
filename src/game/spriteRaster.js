// Renders one tama composite (body+eyes+mouth layers) onto an offscreen
// <canvas> and returns a PNG data URL — for contexts that need a flat
// raster image rather than a live DOM tree, e.g. notify.js's desktop
// notification icons (the Notification API's `icon` option takes an image
// URL, not a React component). Same frame-cropping/bible-offset geometry
// spriteCompositor.jsx's TamaComposite uses, just drawn via canvas
// drawImage instead of CSS crop+transform — see that file if this ever
// needs to grow the same features (mirroring, faceOffset, etc.); it
// doesn't need any of those for a single static notification icon.

import { spriteUrl, VARIANT_INFO, getTamaEntity, getSpriteFiles, getBibleOffsets } from './spriteData.js';

const imageCache = new Map(); // sprite file URL -> Promise<HTMLImageElement>, so repeated renders don't re-fetch/re-decode the same sheet
function loadImage(src) {
  if (!imageCache.has(src)) {
    imageCache.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load ${src}`));
        img.src = src;
      }),
    );
  }
  return imageCache.get(src);
}

const rasterCache = new Map(); // "tamaId|variant|body-eyes-mouth|scale" -> Promise<string | null> (data URL)

// tamaId: a real tamaId, or 'egg'. variant: 'base' | 'mini'. frames:
// {body, eyes, mouth} frame indices (see resolveAnimState — pass one
// resolved frame per layer, not a whole animation). scale: output pixel
// multiplier — sprites are native 32x32 (mini)/64x64 (base) and drawn with
// smoothing off, so this is what actually determines final sharpness, not
// CSS scaling after the fact. Returns null (not a rejected promise) for an
// unrecognized tamaId, so callers can fall back to a default icon without
// a try/catch.
export async function renderTamaToDataUrl(tamaId, variant, frames, scale = 4) {
  const cacheKey = `${tamaId}|${variant}|${frames.body}-${frames.eyes}-${frames.mouth}|${scale}`;
  if (!rasterCache.has(cacheKey)) rasterCache.set(cacheKey, renderTamaToDataUrlUncached(tamaId, variant, frames, scale));
  return rasterCache.get(cacheKey);
}

async function renderTamaToDataUrlUncached(tamaId, variant, frames, scale) {
  const entity = getTamaEntity(tamaId);
  if (!entity) return null;
  const info = VARIANT_INFO[variant];
  const files = getSpriteFiles(entity, variant);
  const bible = getBibleOffsets(entity, variant);
  const frameWidth = info.layers.body.defaultFrameWidth;

  const canvas = document.createElement('canvas');
  canvas.width = frameWidth * scale;
  canvas.height = info.canvasHeight * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false; // pixel art — same as imageRendering: pixelated everywhere this renders via CSS instead

  for (const layer of ['body', 'eyes', 'mouth']) {
    const file = files[layer];
    if (!file) continue;
    const img = await loadImage(spriteUrl(file));
    const layerInfo = info.layers[layer];
    const fallback = { x: layerInfo.defaultOffsetX, y: layerInfo.defaultOffsetY };
    const off = layer === 'body' ? { x: 0, y: 0 } : (bible ? bible[layer] : null) ?? fallback;
    const frameIdx = frames[layer] ?? 0;
    ctx.drawImage(
      img,
      frameIdx * frameWidth,
      0,
      frameWidth,
      layerInfo.sheetHeight, // source crop — one frame's slice of the sheet
      off.x * scale,
      off.y * scale,
      frameWidth * scale,
      layerInfo.sheetHeight * scale, // destination — bible-offset position, scaled up
    );
  }

  return canvas.toDataURL('image/png');
}
