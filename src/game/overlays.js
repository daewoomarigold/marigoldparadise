// The Gotchi Shop's "Overlays" catalog (a second Customization subcategory,
// alongside Frames — see frameColors.js) — small looping effects layered
// over the roster tile. Two render kinds, both driven by this catalog and
// dispatched on in TileOverlay.jsx/TamadexToast.jsx's OverlaySwatch:
//
// - 'sprite': real pixel-art animation — sheets from The Cooked Works'
//   free "Cooked FX Environment & Emotes" pack (itch.io, Pixel theme —
//   free for unlimited personal/commercial use, no credit required, the
//   only restriction is not reselling/redistributing the sheets
//   themselves, which doesn't apply to using them in this app). Each
//   source sheet is a single self-contained looping "cell" (frames laid
//   out left-to-right) that already shows its own motion baked into the
//   frames — e.g. the rain sheet's streaks fall WITHIN the loop, not by
//   the particle itself translating — so TileOverlay.jsx scatters a few
//   static-position copies rather than animating their position the way
//   the emoji ones below do. `render.cell` is the sheet's native
//   per-frame size in px (not used for layout — see TileOverlay.jsx's own
//   per-particle `size` — just documents the source asset).
// - 'emoji': the original approach from before any real art existed for
//   this category — a plain character animated via CSS position/opacity
//   (see overlays.css/TileOverlay.jsx). Still used for ghosts/spiderwebs,
//   which the FX pack has no equivalent for.
//
// Ownership/equip state lives on the student row (ownedOverlays: string[]
// of owned ids, equippedOverlay: string | null — see
// useClassroomStore.js's buyOverlay/setEquippedOverlay), same pattern
// frameColors.js established. Only one equipped at a time, same
// reasoning as frame colors/accessories: simpler data model/rendering,
// easy to revisit if that ever needs to change. Independent of both —
// a student can have an accessory AND a frame color AND an overlay
// equipped all at once.

const FX_BASE = `${import.meta.env.BASE_URL}overlays/`;

function fxUrl(file) {
  return `${FX_BASE}${file}`;
}

export const OVERLAY_PRICE = 30; // flat for now, matches FRAME_COLOR_PRICE — see that file for the same tradeoff

export const OVERLAYS = [
  { id: 'snow', name: 'Snow', render: { kind: 'sprite', url: fxUrl('snow.png'), frames: 32, fps: 12, cell: 48 } },
  { id: 'rain', name: 'Rain', render: { kind: 'sprite', url: fxUrl('rain.png'), frames: 16, fps: 12, cell: 48 } },
  { id: 'leaves', name: 'Falling Leaves', render: { kind: 'sprite', url: fxUrl('leaves.png'), frames: 32, fps: 12, cell: 32 } },
  { id: 'fireflies', name: 'Fireflies', render: { kind: 'sprite', url: fxUrl('fireflies.png'), frames: 32, fps: 12, cell: 32 } },
  { id: 'embers', name: 'Embers', render: { kind: 'sprite', url: fxUrl('embers.png'), frames: 24, fps: 12, cell: 32 } },
  { id: 'butterflies', name: 'Butterflies', render: { kind: 'sprite', url: fxUrl('butterflies.png'), frames: 21, fps: 12, cell: 32 } },
  { id: 'petals', name: 'Cherry Petals', render: { kind: 'sprite', url: fxUrl('petals.png'), frames: 24, fps: 12, cell: 48 } },
  { id: 'ghosts', name: 'Ghosts', render: { kind: 'emoji', symbol: '👻' } },
  { id: 'spiderwebs', name: 'Spiderwebs', render: { kind: 'emoji', symbol: '🕸️' } },
];

export function findOverlay(id) {
  return OVERLAYS.find((o) => o.id === id) ?? null;
}
