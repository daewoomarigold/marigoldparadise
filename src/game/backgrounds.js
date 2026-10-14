// The Gotchi Shop's "Customization" category, third subcategory — see
// frameColors.js and overlays.js for the established pattern. Unlike
// overlays (procedural emoji + CSS — "no real assets"), these ARE real
// art: full scene backgrounds cropped from a Tamagotchi Pix background
// sprite sheet (official Bandai product data, sourced the same way this
// project's own tama sprites are — see tamaAtlas.json). A background
// REPLACES the roster tile's default grass image outright (see
// tileAppearance.js's tileBgStyleFor) rather than layering like frame
// colors/overlays do, since these are full scenes, not accents.
//
// Ownership/equip state lives on the student row (ownedBackgrounds:
// string[] of owned ids, equippedBackground: string | null — see
// useClassroomStore.js's buyBackground/setEquippedBackground), same
// pattern as frameColors.js/overlays.js. Only one equipped at a time,
// same reasoning as those two.
//
// `category` groups the shop/My Bag grids into subheadings (the sheet has
// ~180 tiles total; most are either genuine scenes or a repeating
// decorative "transition effect" swirl/radial pattern that isn't usable
// as a background — only the former are in this catalog, picked by
// Taylor from a labeled contact sheet of the whole source image).

export const BACKGROUND_PRICE = 50; // pricier than FRAME_COLOR_PRICE/OVERLAY_PRICE (30) — real scene art, not a flat color or an emoji effect

const BACKGROUND_BASE = `${import.meta.env.BASE_URL}backgrounds/`;

export function backgroundImageUrl(id) {
  return `${BACKGROUND_BASE}${id}.png`;
}

export const BACKGROUND_CATEGORIES = [
  { id: 'spooky', label: 'Spooky & Holiday' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'outdoor', label: 'Outdoor & Garden' },
];

export const BACKGROUNDS = [
  // Spooky & Holiday
  { id: 'halloween-room', name: 'Haunted Room', category: 'spooky' },
  { id: 'christmas-tree-room', name: 'Christmas Room', category: 'spooky' },
  { id: 'candy-sweets-room', name: 'Candy Room', category: 'spooky' },
  { id: 'throne-room-red-gold', name: 'Royal Throne Room', category: 'spooky' },

  // Rooms
  { id: 'candy-stripe-room', name: 'Candy Stripe Room', category: 'rooms' },
  { id: 'blue-plaid-room', name: 'Blue Plaid Room', category: 'rooms' },
  { id: 'rainbow-arch-playroom', name: 'Rainbow Playroom', category: 'rooms' },
  { id: 'arcade-room', name: 'Arcade Room', category: 'rooms' },
  { id: 'disco-room', name: 'Disco Room', category: 'rooms' },
  { id: 'mint-kitchen', name: 'Mint Kitchen', category: 'rooms' },
  { id: 'bakery-pastel-room', name: 'Bakery Room', category: 'rooms' },
  { id: 'valentine-heart-room', name: 'Heart Room', category: 'rooms' },
  { id: 'piano-room', name: 'Piano Room', category: 'rooms' },
  { id: 'sparkly-ribbon-room', name: 'Sparkly Ribbon Room', category: 'rooms' },
  { id: 'yellow-gym-room', name: 'Home Gym', category: 'rooms' },
  { id: 'closet-room', name: 'Closet Room', category: 'rooms' },
  { id: 'classroom', name: 'Classroom', category: 'rooms' },
  { id: 'messy-paint-room', name: 'Art Studio', category: 'rooms' },
  { id: 'carnival-ride-interior', name: 'Carnival Ride', category: 'rooms' },
  { id: 'teal-bathroom', name: 'Teal Bathroom', category: 'rooms' },
  { id: 'blue-shower-bathroom', name: 'Blue Bathroom', category: 'rooms' },
  { id: 'art-gallery-red', name: 'Art Gallery', category: 'rooms' },
  { id: 'purple-curtain-window-room', name: 'Starlight Bedroom', category: 'rooms' },
  { id: 'ornate-teal-red-room', name: 'Royal Parlor', category: 'rooms' },
  { id: 'floral-wallpaper-room', name: 'Floral Room', category: 'rooms' },
  { id: 'cute-night-bedroom', name: 'Cozy Bedroom', category: 'rooms' },
  { id: 'bath-clouds-pastel', name: 'Cloud Bath', category: 'rooms' },
  { id: 'blue-deck-porthole-room', name: 'Ship Deck', category: 'rooms' },
  { id: 'art-paint-splatter-room', name: 'Messy Studio', category: 'rooms' },
  { id: 'dreamy-clouds-stairs-room', name: 'Dreamy Clouds Room', category: 'rooms' },
  { id: 'trophy-room', name: 'Trophy Room', category: 'rooms' },

  // Outdoor & Garden
  { id: 'park-big-tree', name: 'Big Tree Park', category: 'outdoor' },
  { id: 'park-two-trees', name: 'Shady Park', category: 'outdoor' },
  { id: 'soccer-field', name: 'Soccer Field', category: 'outdoor' },
  { id: 'garden-hedge-path', name: 'Hedge Garden', category: 'outdoor' },
  { id: 'garden-topiary-path', name: 'Topiary Garden', category: 'outdoor' },
  { id: 'green-hills-sand-path', name: 'Green Hills', category: 'outdoor' },
  { id: 'green-hill-tree-park', name: 'Hilltop Park', category: 'outdoor' },
  { id: 'gallery-hall-orange', name: 'Sunlit Hallway', category: 'outdoor' },
  { id: 'garden-fountain', name: 'Fountain Garden', category: 'outdoor' },
  { id: 'pink-fence-balcony', name: 'Pink Balcony', category: 'outdoor' },
];

export function findBackground(id) {
  return BACKGROUNDS.find((b) => b.id === id) ?? null;
}
