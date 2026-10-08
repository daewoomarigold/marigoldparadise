// The Gotchi Shop's "Customization" catalog — the first (and so far only)
// item type in it: solid-color frames for a student's roster tile (the
// one showing their GROWING tama, on the right side of the island — see
// StudentGrid.jsx's tileStyle). Deliberately simple as a first pass per
// Taylor's own framing ("the most basic thing we can try now") — flat
// colors, no art assets, no positioning step (unlike accessories.js —
// there's nowhere to drag a border).
//
// Ownership/equip state lives on the student row (ownedFrameColors:
// string[] of owned ids, equippedFrameColor: string | null — see
// useClassroomStore.js's buyFrameColor/setEquippedFrameColor), same
// pattern accessories.js's bag/equippedAccessory already established.
// Only one equipped at a time, same reasoning as accessories: simpler
// data model/rendering, easy to revisit if that ever needs to change.

export const FRAME_COLOR_PRICE = 30; // flat for now — see accessories.js's ACCESSORY_PRICE for the same tradeoff

export const FRAME_COLORS = [
  { id: 'gold', name: 'Gold', color: '#ffd700' },
  { id: 'silver', name: 'Silver', color: '#c0c0c0' },
  { id: 'ruby', name: 'Ruby Red', color: '#e0115f' },
  { id: 'sapphire', name: 'Sapphire Blue', color: '#0f52ba' },
  { id: 'emerald', name: 'Emerald Green', color: '#50c878' },
  { id: 'amethyst', name: 'Amethyst Purple', color: '#9966cc' },
  { id: 'sunset', name: 'Sunset Orange', color: '#ff7518' },
  { id: 'bubblegum', name: 'Bubblegum Pink', color: '#ff69b4' },
];

export function findFrameColor(id) {
  return FRAME_COLORS.find((c) => c.id === id) ?? null;
}
