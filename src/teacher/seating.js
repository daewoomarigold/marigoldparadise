// Seating arrangement — the room layout (desks + fixtures) and the pure
// helpers SeatingMap.jsx and TeacherDashboard.jsx share.
//
// Two separate pieces of data, stored separately on purpose:
//
// - The ROOM LAYOUT (where the desks and fixtures physically are) is ONE
//   shared layout across all of Taylor's classes — they use the same room
//   arrangement every class, only who sits where changes. Lives in the
//   `room_layouts` table (see supabase/schema.sql). That table can hold
//   more than one layout so other arrangement styles can be added later,
//   but for now the app only ever uses the first one — and until Taylor
//   first edits the room, DEFAULT_ROOM_LAYOUT below stands in for it
//   without anything being written.
// - The SEATING (which student is at which desk) is per class:
//   `classes.seating`, a plain { [deskId]: studentId } object.
//
// Coordinates are abstract "room units", not pixels — SeatingMap scales
// the whole room to fit whatever screen it's on. A desk is always
// DESK_W x DESK_H units, sized so a full student card (name, pts, +1,
// growth meter) fits at a scale of 1.
//
// Layout shape: { desks: [{ id, x, y, group }], fixtures: [{ id, kind, label, x, y, w, h }] }
// (x/y are the top-left corner). `kind` only picks a color — see
// SeatingMap's .seat-fixture-* classes.
//
// GROUPS: Taylor's pods work as groups, and points can go to a whole group
// at once (the "Group N +1" buttons above each pod). A group belongs to the
// DESK, not the student. Whoever sits at a Group 1 desk is in Group 1, so
// reseating or shuffling a class regroups everyone with no extra writes.
// `group` is a number, or null for a desk that's in no group.

export const DESK_W = 160;
export const DESK_H = 150;
export const SNAP = 10; // drag increment in Edit room mode

// Taylor's real classroom, traced from their own seating chart: three pods
// (2x2 + one centered below on the left, a 2x2 set further back in the
// middle, 2x2 + one centered below on the right by the bookcase), with the
// teacher's desk front-left and the Smart Board front-center. Gaps between
// pods are a little tighter than the original drawing so the cards come
// out bigger on an iPad — Edit room mode can always nudge them back.
export const DEFAULT_ROOM_LAYOUT = {
  desks: [
    // Left pod
    { id: 'L1', x: 40, y: 130, group: 1 },
    { id: 'L2', x: 212, y: 130, group: 1 },
    { id: 'L3', x: 40, y: 292, group: 1 },
    { id: 'L4', x: 212, y: 292, group: 1 },
    { id: 'L5', x: 126, y: 462, group: 1 },
    // Middle pod
    { id: 'M1', x: 530, y: 350, group: 2 },
    { id: 'M2', x: 702, y: 350, group: 2 },
    { id: 'M3', x: 530, y: 512, group: 2 },
    { id: 'M4', x: 702, y: 512, group: 2 },
    // Right pod
    { id: 'R1', x: 1010, y: 144, group: 3 },
    { id: 'R2', x: 1182, y: 144, group: 3 },
    { id: 'R3', x: 1010, y: 306, group: 3 },
    { id: 'R4', x: 1182, y: 306, group: 3 },
    { id: 'R5', x: 1096, y: 476, group: 3 },
  ],
  fixtures: [
    { id: 'teacher-desk', kind: 'teacher', label: "Teacher's Desk", x: 0, y: 0, w: 290, h: 80 },
    { id: 'smart-board', kind: 'board', label: 'Smart Board', x: 450, y: 0, w: 640, h: 40 },
    { id: 'bookcase', kind: 'furniture', label: 'Bookcase', x: 1390, y: 0, w: 50, h: 380 },
  ],
};

// Height of the "Group N +1" button above each pod, and its gap to the desks.
export const GROUP_BTN_H = 40;
const GROUP_BTN_GAP = 8;

// A desk's group. Layouts saved before groups existed have no `group` on
// their desks, so those fall back to the default pods' groups by desk id
// (L* = 1, M* = 2, R* = 3). An explicit null means "no group" and is kept.
export function deskGroup(desk) {
  if (desk.group !== undefined) return desk.group;
  return DEFAULT_ROOM_LAYOUT.desks.find((d) => d.id === desk.id)?.group ?? null;
}

// One entry per group that has at least one desk, in group-number order:
// { group, deskIds, x, y, w, h }, where the rect is that group's button,
// sitting just above its desks and as wide as the pod.
export function groupButtons(layout) {
  const byGroup = new Map();
  for (const desk of layout.desks) {
    const g = deskGroup(desk);
    if (g == null) continue;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(desk);
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a - b)
    .map(([group, desks]) => {
      const minX = Math.min(...desks.map((d) => d.x));
      const maxX = Math.max(...desks.map((d) => d.x + DESK_W));
      const minY = Math.min(...desks.map((d) => d.y));
      return { group, deskIds: desks.map((d) => d.id), x: minX, y: minY - GROUP_BTN_H - GROUP_BTN_GAP, w: maxX - minX, h: GROUP_BTN_H };
    });
}

export function snap(v) {
  return Math.round(v / SNAP) * SNAP;
}

export function newDeskId() {
  return 'd' + Math.random().toString(36).slice(2, 8);
}

// The bounding box of everything in the room (group buttons included), so
// SeatingMap can crop to it and scale just the occupied area to fit.
export function layoutBounds(layout, pad = 0) {
  const rects = [
    ...layout.desks.map((d) => ({ x: d.x, y: d.y, w: DESK_W, h: DESK_H })),
    ...layout.fixtures.map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h })),
    ...groupButtons(layout),
  ];
  if (rects.length === 0) return { minX: 0, minY: 0, maxX: DESK_W, maxY: DESK_H };
  return {
    minX: Math.min(...rects.map((r) => r.x)) - pad,
    minY: Math.min(...rects.map((r) => r.y)) - pad,
    maxX: Math.max(...rects.map((r) => r.x + r.w)) + pad,
    maxY: Math.max(...rects.map((r) => r.y + r.h)) + pad,
  };
}

// Resolves a class's stored seating against the CURRENT layout and roster.
// Stale entries just drop out: a desk deleted in Edit room mode, or a
// student who's since been removed from the class, so the stored object
// never has to be cleaned up eagerly. Anyone not at a valid desk comes back
// in `unseated`, in roster order.
export function resolveSeating(seating, layout, students) {
  const deskIds = new Set(layout.desks.map((d) => d.id));
  const byId = new Map(students.map((s) => [s.id, s]));
  const deskToStudent = new Map();
  const seatedIds = new Set();
  for (const [deskId, studentId] of Object.entries(seating ?? {})) {
    if (!deskIds.has(deskId) || !byId.has(studentId) || seatedIds.has(studentId)) continue;
    deskToStudent.set(deskId, byId.get(studentId));
    seatedIds.add(studentId);
  }
  const unseated = students.filter((s) => !seatedIds.has(s.id));
  return { deskToStudent, unseated };
}

// Deals the whole class out to random desks. More students than desks →
// the extras stay unseated; fewer → which desks end up empty is random too.
export function shuffleSeating(layout, students) {
  const desks = shuffled(layout.desks.map((d) => d.id));
  const kids = shuffled(students.map((s) => s.id));
  const seating = {};
  desks.forEach((deskId, i) => {
    if (i < kids.length) seating[deskId] = kids[i];
  });
  return seating;
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
