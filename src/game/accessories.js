// The Gotchi Shop's "Accessories" catalog — sprites image-879.png through
// image-954.png (76 items, confirmed as a clean, consistent set: all
// native 64x64 RGBA icons, no gaps in the range), reviewed by eye and
// named accordingly. Names/prices are a first pass and easy to retune —
// this file is the only place either lives, no code changes needed to
// adjust them.
//
// Each accessory is a single static image (no animation frames, unlike
// tama sprites), applied as a free-positioned overlay on a student's field
// tama — see spriteCompositor.jsx's TamaComposite `accessory` prop for how
// the stored {id, x, y} actually renders, and MyBagTab.jsx (TamadexToast.jsx)
// for the drag-to-position editor that produces x/y in the first place.
//
// Ownership/equip state lives on the student row (bag: number[] of owned
// ids, equippedAccessory: {id, x, y} | null — see useClassroomStore.js's
// buyAccessory/setEquippedAccessory) rather than here; this file is just
// the static catalog, same role growthChart.json plays for tamas.

export const ACCESSORY_PRICE = 15; // flat for now — a price-per-item field can be added later if wanted

export const ACCESSORIES = [
  { id: 879, name: 'Cake Crown' },
  { id: 880, name: 'Apple' },
  { id: 881, name: 'Cloud' },
  { id: 882, name: 'Gift Box' },
  { id: 883, name: 'Flower Bouquet' },
  { id: 884, name: 'Lollipop' },
  { id: 885, name: 'Drumstick' },
  { id: 886, name: 'Golden Cookie' },
  { id: 887, name: 'Glow Stick' },
  { id: 888, name: 'Ninja Star' },
  { id: 889, name: 'Balloon Buddy' },
  { id: 890, name: 'Watering Can' },
  { id: 891, name: 'Piano Bow' },
  { id: 892, name: 'Ribbon Pin' },
  { id: 893, name: 'Soft-Serve Peak' },
  { id: 894, name: 'Red Bow' },
  { id: 895, name: 'Party Hat' },
  { id: 896, name: 'Witch Hat' },
  { id: 897, name: 'Unicorn Horn' },
  { id: 898, name: 'Candy Cane' },
  { id: 899, name: 'Santa Hat' },
  { id: 900, name: 'Swirl Lollipop' },
  { id: 901, name: 'Pink Bow' },
  { id: 902, name: 'Baseball Cap' },
  { id: 903, name: 'Blue Top Hat' },
  { id: 904, name: 'Clover' },
  { id: 905, name: 'Pearl String' },
  { id: 906, name: 'Red Beanie' },
  { id: 907, name: 'Candy Cane Pin' },
  { id: 908, name: 'Blue Gem Cluster' },
  { id: 909, name: 'Ghost Bead' },
  { id: 910, name: 'Paper Airplane' },
  { id: 911, name: 'Heart Glasses' },
  { id: 912, name: 'Red Sun Hat' },
  { id: 913, name: 'Purple Sun Hat' },
  { id: 914, name: 'Blue Envelope' },
  { id: 915, name: 'Blue Star Cap' },
  { id: 916, name: 'Royal Crown' },
  { id: 917, name: 'Water Drops' },
  { id: 918, name: 'Skull Charm' },
  { id: 919, name: 'Straw Hat' },
  { id: 920, name: 'Pink Pom Hairpiece' },
  { id: 921, name: 'Snowy Puff' },
  { id: 922, name: 'Guitar' },
  { id: 923, name: 'Graduation Cap' },
  { id: 924, name: 'Pink Bunny Toy' },
  { id: 925, name: 'Blue Whale Toy' },
  { id: 926, name: 'Gray Owl Toy' },
  { id: 927, name: 'Yellow Chick Toy' },
  { id: 928, name: 'Green Blob Toy' },
  { id: 929, name: 'Smiley Charm' },
  { id: 930, name: 'Round Sunglasses' },
  { id: 931, name: 'Glow Wand' },
  { id: 932, name: 'Tama Locket' },
  { id: 933, name: 'Star Wand' },
  { id: 934, name: 'Pinwheel Toy' },
  { id: 935, name: 'Perfume Bottle' },
  { id: 936, name: 'Lavender Bow' },
  { id: 937, name: 'Blue Swoosh' },
  { id: 938, name: 'Pink Ears' },
  { id: 939, name: 'Blue Dolphin' },
  { id: 940, name: 'Angel Wing' },
  { id: 941, name: 'Rainbow Trail' },
  { id: 942, name: 'Cat Ears' },
  { id: 943, name: 'Flower Sprig' },
  { id: 944, name: 'Cotton Candy Stick' },
  { id: 945, name: 'Mountain Wreath' },
  { id: 946, name: 'Sombrero' },
  { id: 947, name: 'Fire Spark' },
  { id: 948, name: 'Chef Hat' },
  { id: 949, name: 'Sleepy Plush' },
  { id: 950, name: 'Balloon Trio' },
  { id: 951, name: 'Peppermint Stick' },
  { id: 952, name: 'Leaf Sprig' },
  { id: 953, name: 'Bunny Ear Hat' },
  { id: 954, name: 'Red Balloon Bird' },
];

export function findAccessory(id) {
  return ACCESSORIES.find((a) => a.id === id) ?? null;
}

export function accessorySpriteFile(id) {
  return `image-${id}.png`;
}
