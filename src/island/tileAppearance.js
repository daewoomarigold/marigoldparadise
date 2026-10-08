// The roster tile's real background (grass-and-tree art + a dark scrim —
// see StudentGrid.jsx's tileStyle for where this is actually used) pulled
// out into its own file so it can also be reused by TamadexToast.jsx's My
// Bag preview frame without triggering the "only export components" Fast
// Refresh warning that comes from exporting plain constants alongside a
// component (StudentGrid.jsx's default export).

import { spriteUrl } from '../game/spriteData.js';

// imageRendering:pixelated keeps it crisp since a tile is smaller
// on-screen than the sprite's native 128x128.
export const TILE_BG_URL = spriteUrl('image-1402.png');

// A dark scrim under the grass art so light-on-dark text/UI drawn over it
// stays readable.
export const tileBgStyle = {
  backgroundImage: `linear-gradient(rgba(10, 10, 20, 0.5), rgba(10, 10, 20, 0.5)), url(${TILE_BG_URL})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  imageRendering: 'pixelated',
};
