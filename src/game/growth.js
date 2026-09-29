// Growth/rolling logic — pure functions, no DOM/React/storage here. See
// GAME_DESIGN.md "The new pet mechanic" for the rules this implements:
//   Egg -> Baby --(random 1 of 3)--> Toddler --(random 1 of 4)--> Teen
//        --(random 1 of 4, no dupes)--> Adult -> (new cycle) Egg -> ...
// plus the no-dupes/closing rules (teen lines close once fully collected,
// biomes close + award a secret once all 4 of their teen lines are closed).
//
// Egg isn't in GAME_DESIGN.md's growth-chart notation (which starts at
// Baby) but sprite data for it exists (tamaAtlas.json's separate `egg`
// entry, not indexed like the other 68), and it's a natural pre-baby
// stage each new cycle passes through, one meter-fill each way like every
// other stage. bbmarutchi (growthChart.json's specialBaby) is explicitly
// "can't be bred with others" per the design doc, so it's deliberately
// NOT part of this roll chain — a regular cycle can never produce it;
// how a student would ever get one isn't designed yet.
//
// Family tree data lives in src/data/growthChart.json (reconstructed from
// real sprite indices + shape-matched species names, cross-checked against
// the reference chart image — see git log for how index 16/53 errors were
// found and fixed).

import chart from '../data/growthChart.json';

// How many points fill the meter and trigger one growth step. Placeholder —
// GAME_DESIGN.md doesn't specify a number; adjust once playtested.
export const POINTS_PER_GROWTH = 10;

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function findToddler(toddlerId) {
  return chart.toddlers.find((t) => t.tamaId === toddlerId);
}

function findTeen(toddlerId, teenId) {
  return findToddler(toddlerId)?.teens.find((t) => t.tamaId === teenId);
}

// Looks up a species name by tamaId anywhere in the chart (baby, toddlers,
// teens, adults, secrets, bbmarutchi) — used to resolve a tamadex entry
// (which only stores the id) back into a display name, e.g. for a "display
// tama" picker. Returns null if not found (e.g. egg, which has no tamaId).
export function findTamaName(tamaId) {
  if (tamaId == null) return null;
  if (chart.baby.tamaId === tamaId) return chart.baby.name;
  if (chart.specialBaby.tamaId === tamaId) return chart.specialBaby.name;
  for (const toddler of chart.toddlers) {
    if (toddler.tamaId === tamaId) return toddler.name;
    if (toddler.secret.tamaId === tamaId) return toddler.secret.name;
    for (const teen of toddler.teens) {
      if (teen.tamaId === tamaId) return teen.name;
      const adult = teen.adults.find((a) => a.tamaId === tamaId);
      if (adult) return adult.name;
    }
  }
  return null;
}

// tamaId -> 'baby'/'toddler' for every species a student can pick as their
// display tama WITHOUT having to have completed it first (see
// allBabiesAndToddlers below) — used by resolveDisplayTama to tell those
// apart from a picked adult/secret (which are always 'adult' stage).
const BABY_OR_TODDLER_STAGE_BY_ID = new Map([
  [chart.baby.tamaId, 'baby'],
  ...chart.toddlers.map((t) => [t.tamaId, 'toddler']),
]);

// Resolves a student's displayTamaId into what should actually render:
// { tamaId, stage }. 'current' (or unset) follows whatever's growing right
// now (including egg — the field roaming code uses `stage` to decide
// whether this should roam or sit still). A specific PICKED tamaId is
// either one of the always-available baby/toddler forms (see
// allBabiesAndToddlers) or a tamadex entry (a completed adult/secret),
// which is always 'adult' stage. This is the single source of truth for
// "what tama does the FIELD show" — see StudentGrid.jsx for the tile,
// which deliberately shows growth.currentTama directly instead (the
// asymmetric design: field shows the chosen display tama, tile always
// shows what's actively growing).
export function resolveDisplayTama(student) {
  const { displayTamaId, growth } = student;
  if (!displayTamaId || displayTamaId === 'current') {
    return { tamaId: growth.currentTama.tamaId, stage: growth.currentTama.stage };
  }
  return { tamaId: displayTamaId, stage: BABY_OR_TODDLER_STAGE_BY_ID.get(displayTamaId) ?? 'adult' };
}

// Total possible tamadex entries: every adult across all teen lines (48)
// plus the 3 biome secrets — matches GAME_DESIGN.md's "only completed
// adults count as tamadex entries" (secrets are adult-tier awards, not a
// separate category). Doesn't include bbmarutchi, which isn't part of the
// normal roll chain. Computed from growthChart.json rather than
// hardcoded so it can't drift if the chart data ever changes.
export function totalCollectible() {
  let total = 0;
  for (const toddler of chart.toddlers) {
    for (const teen of toddler.teens) total += teen.adults.length;
    total += 1; // secret
  }
  return total;
}

// Every regular adult (48, no secrets) in a fixed order — the natural
// order they appear in growthChart.json (toddler, then that toddler's
// teens in order, then each teen's adults in order). Used for a numbered
// tamadex grid; the order is stable across calls since it just reads the
// static chart data.
export function allAdults() {
  const adults = [];
  for (const toddler of chart.toddlers) {
    for (const teen of toddler.teens) {
      adults.push(...teen.adults);
    }
  }
  return adults;
}

// The one baby species + all 3 toddlers (one per biome) — every early-stage
// form a student can pick as their field display tama. Unlike adults,
// these don't need to be "collected" first: every student passes through
// the SAME baby and the SAME 3 toddlers on every single growth cycle, so
// there's nothing to gate on — they're just always-available choices, per
// the request that added this ("let students pick a baby/toddler form for
// their field tama too, not just completed adults").
export function allBabiesAndToddlers() {
  return [
    { tamaId: chart.baby.tamaId, name: chart.baby.name, stage: 'baby' },
    ...chart.toddlers.map((t) => ({ tamaId: t.tamaId, name: t.name, stage: 'toddler' })),
  ];
}

// Creates a fresh student progression record. tamadex/closedTeens/
// closedBiomes/secrets persist across growth cycles (a completed adult
// starts a new baby, but collection history is permanent) — only
// currentTama resets.
export function newStudentProgress() {
  return {
    currentTama: startEgg(),
    tamadex: [], // adult + secret tamaIds this student has completed
    closedTeens: [], // teen tamaIds fully collected (can't roll again)
    closedBiomes: [], // toddler tamaIds fully collected (can't roll again)
    unlockedSecrets: [], // secret tamaIds unlocked
    growthConsumedPts: 0, // how much of lifetimePts has already been spent on growth steps
  };
}

function startEgg() {
  // tamaId stays null — egg isn't indexed into tamaAtlas.json's 68 tamas
  // like everything else; it's the separate `egg` entry, special-cased by
  // whichever sprite-rendering code eventually consumes this.
  return { stage: 'egg', tamaId: null, name: 'egg', toddlerId: null, teenId: null };
}

function startBaby() {
  return { stage: 'baby', tamaId: chart.baby.tamaId, name: chart.baby.name, toddlerId: null, teenId: null };
}

// Rolls the next stage for a student's currentTama, respecting no-dupe and
// closing rules. Returns a NEW progress object (doesn't mutate). Reaching
// adult also updates tamadex/closedTeens/closedBiomes/unlockedSecrets in
// the same call — the design doc's rules are all resolved together, not as
// a separate "check" step, so there's no window where the state is
// inconsistent (e.g. a 4th adult logged but the teen not yet marked closed).
export function advanceGrowth(progress) {
  const { stage } = progress.currentTama;

  if (stage === 'adult') {
    // Completed — this life is done and stays in tamadex; a new cycle
    // starts from an egg, not straight back to baby.
    return { ...progress, currentTama: startEgg() };
  }

  if (stage === 'egg') {
    return { ...progress, currentTama: startBaby() };
  }

  if (stage === 'baby') {
    const available = chart.toddlers.filter((t) => !progress.closedBiomes.includes(t.tamaId));
    if (available.length === 0) return progress; // every biome closed (endgame) — nothing left to roll
    const toddler = pick(available);
    return {
      ...progress,
      currentTama: { stage: 'toddler', tamaId: toddler.tamaId, name: toddler.name, toddlerId: toddler.tamaId, teenId: null },
    };
  }

  if (stage === 'toddler') {
    const toddler = findToddler(progress.currentTama.toddlerId);
    const available = toddler.teens.filter((t) => !progress.closedTeens.includes(t.tamaId));
    // available should never be empty here — a toddler only offers itself
    // for rolling (in the baby step above) while it still has open teens —
    // but fall back to a fresh cycle rather than crash if data is ever
    // inconsistent (e.g. manually edited save data).
    if (available.length === 0) return { ...progress, currentTama: startEgg() };
    const teen = pick(available);
    return {
      ...progress,
      currentTama: {
        stage: 'teen',
        tamaId: teen.tamaId,
        name: teen.name,
        toddlerId: progress.currentTama.toddlerId,
        teenId: teen.tamaId,
      },
    };
  }

  if (stage === 'teen') {
    const { toddlerId, teenId } = progress.currentTama;
    const teen = findTeen(toddlerId, teenId);
    const available = teen.adults.filter((a) => !progress.tamadex.includes(a.tamaId));
    if (available.length === 0) return progress; // shouldn't happen — teen would already be closed
    const adult = pick(available);

    let next = {
      ...progress,
      currentTama: { stage: 'adult', tamaId: adult.tamaId, name: adult.name, toddlerId, teenId },
      tamadex: [...progress.tamadex, adult.tamaId],
    };

    // Teen line closes once all 4 of its adults are logged.
    const teenNowComplete = teen.adults.every((a) => next.tamadex.includes(a.tamaId));
    if (teenNowComplete && !next.closedTeens.includes(teenId)) {
      next = { ...next, closedTeens: [...next.closedTeens, teenId] };

      // Biome closes once all 4 of its teen lines are closed — awards the secret.
      const toddler = findToddler(toddlerId);
      const biomeNowComplete = toddler.teens.every((t) => next.closedTeens.includes(t.tamaId));
      if (biomeNowComplete && !next.closedBiomes.includes(toddlerId)) {
        next = {
          ...next,
          closedBiomes: [...next.closedBiomes, toddlerId],
          unlockedSecrets: [...next.unlockedSecrets, toddler.secret.tamaId],
          tamadex: [...next.tamadex, toddler.secret.tamaId],
        };
      }
    }

    return next;
  }

  return progress;
}

// Applies a change in a student's LIFETIME points (total ever earned —
// never decreases; see TeacherDashboard.jsx's applyPtsChange for how that's
// kept separate from the spendable gotchiPts currency balance) to their
// growth progress, advancing the meter and triggering as many growth steps
// as the points cover (e.g. earning 25 lifetime points at once with a
// 10-point threshold triggers 2 steps, leaving 5 toward the next).
// growthConsumedPts naturally makes this a one-way ratchet already (the
// while loop below only ever runs forward), but since the caller is now
// expected to pass a monotonically-increasing value in the first place
// (spending currency never lowers it), there's no longer a "deduction"
// case to guard here at all — growth can only ever move forward.
//
// Returns { progress, reachedAdultTamaIds } rather than just the progress
// object — reachedAdultTamaIds lists every adult newly completed during
// THIS call, in order, which can be more than one if a single point award
// covers multiple full cycles. Empty if none were reached. Callers that
// only care about the growth state itself can just destructure
// `.progress`; this exists so a caller can react to "an adult was just
// reached" (e.g. TeacherDashboard.jsx pins the field's display tama to a
// freshly-completed adult, then leaves it alone — see its applyPtsChange)
// — a concern growth.js itself deliberately doesn't know about (no
// student/display/currency concept here, just pure growth math).
export function applyPointsToGrowth(progress, lifetimePts) {
  let next = progress;
  const reachedAdultTamaIds = [];
  while (lifetimePts - next.growthConsumedPts >= POINTS_PER_GROWTH) {
    next = { ...advanceGrowth(next), growthConsumedPts: next.growthConsumedPts + POINTS_PER_GROWTH };
    if (next.currentTama.stage === 'adult') reachedAdultTamaIds.push(next.currentTama.tamaId);
  }
  return { progress: next, reachedAdultTamaIds };
}

// 0-1 fraction of the way to the next growth step. Takes lifetimePts (see
// applyPointsToGrowth above), not the spendable currency balance, so
// spending never moves this bar. Still clamped defensively — old saved
// data or a manually-edited lifetimePts could in principle sit below
// growthConsumedPts.
export function meterFraction(progress, lifetimePts) {
  const remainder = lifetimePts - progress.growthConsumedPts;
  return Math.max(0, Math.min(1, remainder / POINTS_PER_GROWTH));
}
