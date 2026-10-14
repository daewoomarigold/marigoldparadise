// The roster tile's real background (grass-and-tree art + a dark scrim —
// see StudentGrid.jsx's tileStyle for where this is actually used) pulled
// out into its own file so it can also be reused by TamadexToast.jsx's My
// Bag preview frame without triggering the "only export components" Fast
// Refresh warning that comes from exporting plain constants alongside a
// component (StudentGrid.jsx's default export).

import { spriteUrl } from '../game/spriteData.js';
import { backgroundImageUrl } from '../game/backgrounds.js';

// imageRendering:pixelated keeps it crisp since a tile is smaller
// on-screen than the sprite's native 128x128.
export const TILE_BG_URL = spriteUrl('image-1402.png');

// Shown through any transparent pixels in whatever's currently backing a
// tile/frame — the default grass art is fully opaque, but several of the
// Customization backgrounds (see backgrounds.js — cropped from a
// Tamagotchi Pix sprite sheet, not drawn for this purpose) have some
// transparency around their edges. A flat sky blue reads as a believable
// sky there instead of a void. "Universal" per the request that added
// this — the same color backs every tile (StudentGrid.jsx's tileStyle)
// AND My Bag's own preview frame (TamadexToast.jsx's dragFrameStyle), not
// just the default background.
export const FRAME_FALLBACK_COLOR = '#87ceeb';

// A dark scrim under the grass art so light-on-dark text/UI drawn over it
// stays readable.
export const tileBgStyle = {
  backgroundImage: `linear-gradient(rgba(10, 10, 20, 0.5), rgba(10, 10, 20, 0.5)), url(${TILE_BG_URL})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  imageRendering: 'pixelated',
};

// Same style shape as tileBgStyle, but swaps in a student's equipped
// Customization background (see backgrounds.js) in place of the default
// grass art when one's equipped — a background REPLACES the tile's image
// outright (full scene, not an accent layered over the default like frame
// colors/overlays are). Falls back to tileBgStyle itself for null/no
// equip, so every caller (StudentGrid.jsx's real tile, TamadexToast.jsx's
// My Bag preview frame) can use this unconditionally instead of branching
// between the two styles themselves.
export function tileBgStyleFor(backgroundId) {
  if (!backgroundId) return tileBgStyle;
  return {
    backgroundImage: `linear-gradient(rgba(10, 10, 20, 0.5), rgba(10, 10, 20, 0.5)), url(${backgroundImageUrl(backgroundId)})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    imageRendering: 'pixelated',
  };
}
