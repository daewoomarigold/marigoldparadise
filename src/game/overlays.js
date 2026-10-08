// The Gotchi Shop's "Overlays" catalog (a second Customization subcategory,
// alongside Frames — see frameColors.js) — small looping particle-effect
// animations layered over the roster tile. Unlike accessories/frame
// colors, there's no sprite art to draw from for these at all ("no real
// assets" — per the request that added this), so each one is drawn
// procedurally: a handful of emoji characters animated via CSS (see
// overlays.css/TileOverlay.jsx), not image files. Fall/Halloween themed
// for the season this was built in — nothing seasonal is enforced in
// code, just the pick of which 5 to start with.
//
// Ownership/equip state lives on the student row (ownedOverlays: string[]
// of owned ids, equippedOverlay: string | null — see
// useClassroomStore.js's buyOverlay/setEquippedOverlay), same pattern
// frameColors.js established. Only one equipped at a time, same
// reasoning as frame colors/accessories: simpler data model/rendering,
// easy to revisit if that ever needs to change. Independent of both —
// a student can have an accessory AND a frame color AND an overlay
// equipped all at once.

export const OVERLAY_PRICE = 30; // flat for now, matches FRAME_COLOR_PRICE — see that file for the same tradeoff

export const OVERLAYS = [
  { id: 'snow', name: 'Snow', emoji: '❄️' },
  { id: 'rain', name: 'Rain', emoji: '💧' },
  { id: 'leaves', name: 'Falling Leaves', emoji: '🍂' },
  { id: 'ghosts', name: 'Ghosts', emoji: '👻' },
  { id: 'spiderwebs', name: 'Spiderwebs', emoji: '🕸️' },
];

export function findOverlay(id) {
  return OVERLAYS.find((o) => o.id === id) ?? null;
}
