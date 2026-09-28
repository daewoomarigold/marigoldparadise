// 4x4 roster grid shown alongside the island — one tile per student
// (Taylor's real classes max out at 16), showing their GROWING tama (not
// their chosen display tama — see the asymmetric-design note below),
// growth meter, name, and current gotchiPts balance (the spendable
// currency — see TeacherDashboard.jsx's file header for the
// gotchiPts/lifetimePts split; the meter above it tracks lifetimePts
// instead, so spending never moves it). Tamadex progress isn't shown here
// — that lives inside the toast (TamadexToast.jsx) a tile opens on click,
// so it's not duplicated in two places. Empty slots render as plain
// placeholders, matching the mockup. Tamas play the "walking_forward"
// animation state (a face-the-camera walk-in-place, body frames [4,5],
// static eyes/mouth) in place — no roaming/movement, this is a dashboard
// panel, not part of the island canvas itself.
//
// Asymmetric by design: the island field shows whatever tama a student
// has chosen to display (resolveDisplayTama in growth.js — 'current'
// growing tama by default, or a specific completed adult they picked in
// the tamadex toast), but this tile always shows growth.currentTama
// directly regardless of that choice — it's a progress/status readout
// (paired with the meter right below it), not the showcase. A student
// mid-toddler can proudly display a finished adult on the island while
// this tile still tracks the toddler actually growing.
//
// Tapping a tile opens the tamadex toast (see TamadexToast.jsx), where a
// student can change their display tama; a future item shop could pop
// out from here too.
//
// Evolution overlay: whenever a tile's growth.currentTama identity changes
// (egg->baby, baby->toddler, ..., adult->a fresh egg next cycle), it plays
// a short transformation sequence — cycle idle/happy (or, for an egg, the
// real egg_hatch crack/burst frames), shake, white flash-hold-reveal —
// before settling back into the normal walking_forward loop. Ported from
// the old gotchigarden.html's triggerEvolve() (see that repo's EVOLVE
// SEQUENCE section): same cycle -> shake -> flash -> reveal shape, same
// sine-wave shake, just the ANIMATION choreography — none of the old
// cost/feeding/wait-days gating carried over, since growth here already
// advances the moment points land (see growth.js). Unlike the old code
// (which only animated baby->adult; egg hatching was a wholly separate
// flow there), this plays for every stage change here including
// egg->baby, using egg_hatch's actual crack/burst frames in place of the
// idle/happy cycle (an egg has no face to cycle/shake).
//
// The flash itself is a silhouette of the sprite being shown, not a plain
// white box — a second copy of the same TamaComposite, CSS-filtered to
// brightness(0) invert(1) (turns every opaque pixel white, same alpha
// shape the sprite already has — see TamadexToast's brightness(0) for the
// black-silhouette half of this trick), faded in/out via opacity. That
// keeps the flash shaped to whatever's actually on screen — including
// transparent pixels around it — instead of flashing a hard-edged square.
//
// adult->new-egg is its own separate sequence (runNewCycleSequence, not
// runEvolution) — no flash at all. A finished adult wrapping around to a
// fresh egg isn't really "transforming into" the egg the way baby/
// toddler/teen/adult stages are, so instead: the adult waves goodbye,
// walks off (slides out using walk_left's frames, mirrored to face the
// direction of travel — the same frame data the island's roamers walk
// with), a brief empty beat once it's off-tile (clipped by the tile's own
// overflow:hidden, no extra work needed), then the new egg appears.
//
// Tile-only, by request — the island field's roamers are untouched.
//
// Coin rain ("Tama Time" — see TeacherDashboard.jsx/useClassroomStore.js's
// pendingPts/distributeClass): whenever a tile's gotchiPts increases, a
// shower of falling coin icons plays — one drop per point, capped at
// RAIN_MAX_DROPS, staggered so several are visibly falling at once (that's
// the "raining," not one-at-a-time), each firing playAddPoint() as it
// spawns.
//
// Meter montage: a multi-stage distribute (useClassroomStore.js's
// distributeOneStudent) writes the FULL earned amount + the meter's fully
// caught-up growthConsumedPts in one shot, without moving currentTama yet
// — so this tile can play the meter climbing/resetting through however
// many stage-thresholds that crossed (runMeterMontage, driven by
// meterOverride — see below), entirely locally, at its own pace, before
// currentTama starts actually changing. It runs alongside the coin rain
// (both fire off the same write), then — once useClassroomStore.js's own
// wait has given this room to finish — the evolution sequence below plays
// once per stage crossed, back to back, only ~250ms apart (see
// EVOLUTION_STEP_GAP_MS over there): a fast flash-through chain rather
// than each stage getting its own fully-played-out reveal, landing
// properly only on the last one.

import { memo, useEffect, useRef, useState } from 'react';
import { meterFraction, POINTS_PER_GROWTH } from '../game/growth.js';
import { resolveAnimState, spriteUrl } from '../game/spriteData.js';
import { TamaComposite } from '../game/spriteCompositor.jsx';
import { playAddPoint } from '../sound.js';

const GRID_SIZE = 16; // 4x4 — matches the real max class size, not just the current roster
const TILE_SCALE = 2; // mini sprites are 32x32 native; on-screen size within the tile
const TILE_ANIM_FPS = 2; // was 4 — read as too fast for a small in-place idle bob

const WALKING_FORWARD = resolveAnimState('walking_forward');
const EGG_ROCK = resolveAnimState('egg_rock');
const EGG_HATCH = resolveAnimState('egg_hatch');
const IDLE = resolveAnimState('idle');
const HAPPY = resolveAnimState('happy');
const WALK = resolveAnimState('walk_left'); // reused for the adult->new-egg "walks off" beat, mirrored to face right

// Evolution sequence timings (ms), adapted from triggerEvolve()'s
// stand/cycle/shake/flash/wave beats — shortened a bit since this is a
// small dashboard tile, not a full-screen moment. A single stage's reveal
// (~2.6-2.8s) mostly only plays out IN FULL for the last stage of a
// multi-stage distribute's evolution chain — useClassroomStore.js spaces
// those writes only ~250ms apart on purpose (see its EVOLUTION_STEP_GAP_MS),
// so earlier stages flash by quickly (cut short by the next one landing —
// see the cancellation logic in the detection effect below) rather than
// each playing to completion; that's the intended "rapid flash-through"
// montage feel, not a bug.
const EVO_CYCLE_STEP_MS = 150;
const EVO_CYCLE_STEPS = 4; // 4 * 150ms = 0.6s
const EVO_HATCH_WOBBLE_MS = 400; // suspense beat on the resting egg (raw frame 0, not part of egg_hatch's own body array) before cracking starts, sliding side to side
const EVO_HATCH_FRAME_MS = 300; // egg_hatch has 3 frames — 3 * 300ms = 0.9s
const EVO_SHAKE_MS = 500;
const EVO_FLASH_IN_MS = 300;
const EVO_FLASH_HOLD_MS = 200; // a beat held at full white before the reveal starts
const EVO_FLASH_OUT_MS = 400;
const EVO_CELEBRATE_MS = 600; // a brief happy pose, not a full wave animation

// adult->new-egg sequence timings (ms) — see runNewCycleSequence. Not
// ported from the original (it had no equivalent; a wrap-to-a-new-egg
// cycle doesn't exist in the old game), so these are new.
const EVO_WAVE_MS = 900; // static happy pose before setting off
const EVO_WALKOFF_MS = 900; // duration of the slide-out
const EVO_WALK_STEP_MS = 130; // walk-cycle frame swap rate while sliding — quicker than the island's roam pace, reads better over a short distance
const EVO_WALKOFF_DISTANCE_PX = 100; // comfortably past a tile's sprite-area width, so it's fully clipped by the tile's overflow:hidden before the beat ends
const EVO_GONE_MS = 250; // empty beat once it's off-tile, before the egg appears
const EVO_EGG_APPEAR_MS = 450; // holds on the new egg before handing back to normal play

// Coin-rain timings — one drop per point gotchiPts went up by, capped so
// a big distribute still reads as "a lot of coins" without going on
// forever. Coins spawn faster than they fall (SPAWN < FALL), so several
// are always mid-fall together — that overlap is what makes it read as
// rain instead of a metronome of single coins. Worst case (8-1)*70+450 =
// 940ms — useClassroomStore.js's distributeOneStudent waits at least this
// long (meterMontageWaitMs) before starting the evolution chain, so keep
// that in sync if these change.
const RAIN_MAX_DROPS = 8;
const RAIN_SPAWN_INTERVAL_MS = 70; // stagger between coins starting to fall
const RAIN_FALL_MS = 450; // how long one coin takes to fall through the tile
const RAIN_SPREAD_PX = 70; // horizontal jitter range each coin's fall path is randomized within

// Meter montage timings (ms) — see runMeterMontage below. One fill+reset
// cycle per growth-meter threshold crossed in a single distribute write
// (useClassroomStore.js's distributeOneStudent phase 1): fills to full,
// then (if there's another cycle after it) snaps back down and fills
// again. useClassroomStore.js's meterMontageWaitMs mirrors these — keep
// both in sync if either changes.
const METER_FILL_MS = 450;
const METER_RESET_MS = 150;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Grass-and-tree background for occupied tiles (empty slots stay plain —
// see EmptyTile). A dark scrim is layered under it so the name/meter/dex
// text (styled for the old flat dark background) stays legible over the
// lighter art; imageRendering:pixelated keeps it crisp since the tile is
// smaller on-screen than the sprite's native 128x128.
const TILE_BG_URL = spriteUrl('image-1402.png');

// The in-universe "gotchi coin" icon (16x16), used instead of a generic ★
// so the currency reads as an actual game item rather than an abstract
// rating symbol.
const COIN_URL = spriteUrl('image-95.png');

// Wrapped in memo: IslandView re-renders this component's parent 60x/sec
// (its physics loop bumps a tick to move the field's roamers), but this
// grid's own content only actually needs to update when the roster data
// itself changes — its tiles drive their own animation independently
// (see StudentTile below). Without this, all 16 tiles (each running its
// own meter/sprite-composite/evolution logic) were being torn down and
// re-diffed on every physics frame for no reason — a real perf drag with
// a full class on screen. Relies on the caller passing a stable
// `onSelectStudent` (useCallback) — IslandView.jsx does — since a new
// function reference every render would defeat this the same way.
//
// Note this only protects against IslandView's OWN re-renders (the 60fps
// tick) — it does NOT stop StudentGrid re-rendering when `students` itself
// changes, which it genuinely does on every realtime update. That's fine
// as long as each individual StudentTile still bails out on its own (see
// its own memo below) for every OTHER student whose row didn't change —
// without that, a single point landing for one student would still
// re-render and re-composite all 16 tiles' sprites.
const StudentGrid = memo(function StudentGrid({ students, onSelectStudent }) {
  const tiles = Array.from({ length: GRID_SIZE }, (_, i) => students[i] ?? null);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridAutoRows: '1fr',
        gap: 8,
        width: 512,
        maxWidth: '100%',
      }}
    >
      {tiles.map((s, i) =>
        // onSelectStudent passed straight through (stable — see above)
        // rather than wrapped in a fresh `() => onSelectStudent(s)` here:
        // that per-tile arrow was recreated on every StudentGrid render
        // (any realtime update, for ANY student), which — since
        // StudentTile wasn't memoized against it — meant literally every
        // point given to literally anyone re-rendered all 16 tiles. A
        // multi-stage distribute firing several writes per student in
        // quick succession (see useClassroomStore.js's distributeOneStudent)
        // turned that into a visible stutter/lock-up once several
        // students' reveals were landing within the same second or two.
        s ? <StudentTile key={s.id} student={s} onSelectStudent={onSelectStudent} /> : <EmptyTile key={`empty-${i}`} />,
      )}
    </div>
  );
});

export default StudentGrid;

// Memoized: StudentGrid re-renders on every roster update (any student's
// row changing), but with a stable `onSelectStudent` and `applyRowChange`
// (useClassroomStore.js) preserving reference equality for rows that
// DIDN'T change, memo lets every OTHER tile bail out immediately instead
// of re-running its own meter/sprite-composite/evolution logic for no
// reason — see the note on StudentGrid above for why this matters more
// now than it used to (multi-write reveals land several updates in quick
// succession). The click handler is built HERE, not passed in as a prop,
// specifically so it doesn't have to be part of this comparison at all.
const StudentTile = memo(function StudentTile({ student, onSelectStudent }) {
  const growth = student.growth;
  const fraction = meterFraction(growth, student.lifetimePts ?? student.gotchiPts);
  const { stage, tamaId } = growth.currentTama; // deliberately the growing tama, not the display tama — see file header
  const isEgg = stage === 'egg';

  // --- Evolution overlay / coin rain / meter montage ------------------------
  // See the file header for the full picture. prevSnapshotRef remembers
  // what was showing last render (stage/tamaId/gotchiPts/growthConsumedPts);
  // when any of those change we still have the OLD identity in hand (needed
  // for the cycle/shake beats, which show the pet that's ABOUT to
  // transform, not the new one) before kicking off the sequence. `evo` is
  // null during normal play; `meterOverride` (the meter montage's own
  // state, separate from `evo` since it renders in a completely different
  // part of the tile) is null whenever the meter should just show its real,
  // prop-driven fraction.
  const prevSnapshotRef = useRef(null);
  const [evo, setEvo] = useState(null);
  const [meterOverride, setMeterOverride] = useState(null); // {fraction, ms} | null

  // Cycles walking_forward's 2 body frames in place — no position movement
  // (this is a static tile, not the roaming island), just a "still alive"
  // animation. Eggs get the same treatment via egg_rock instead (no face
  // to animate, so faceOffset stays unused for them).
  //
  // Paused for the whole time evo is active (bug fix: this used to tick
  // unconditionally, completely decoupled from the reveal sequence below
  // — `showing`'s evo-vs-normal branch meant it never actually rendered
  // during a reveal, but it kept firing/re-rendering underneath the whole
  // time regardless, which is exactly the "walking/evolving/coin
  // animations competing" Taylor reported. Depending on `evo` here makes
  // "pause the idle loop for a reveal, resume once it's back to null" an
  // explicit guarantee instead of something render logic just happened to
  // paper over).
  const [animFrame, setAnimFrame] = useState(0);
  useEffect(() => {
    if (evo) return;
    const id = setInterval(() => setAnimFrame((f) => f + 1), 1000 / TILE_ANIM_FPS);
    return () => clearInterval(id);
  }, [evo]);

  useEffect(() => {
    const prev = prevSnapshotRef.current;
    const isInitialMount = prev == null;
    const tamaChanged = !isInitialMount && (prev.tamaId !== tamaId || prev.stage !== stage);
    // Only an INCREASE plays the coin rain — a deduction (or the
    // initial mount) doesn't get one. Not clamped to student.gotchiPts
    // moving at all here — see RAIN_MAX_DROPS below for how a big jump is
    // capped, not this.
    const ptsDelta = !isInitialMount && student.gotchiPts > prev.gotchiPts ? student.gotchiPts - prev.gotchiPts : 0;
    // How many growth-meter thresholds this write just caught up on, if
    // any — see useClassroomStore.js's distributeOneStudent phase 1, which
    // writes growthConsumedPts all the way to its final value without
    // moving currentTama yet (tamaChanged stays false for this same write,
    // by design). Rounded since it should always land on an exact multiple
    // of POINTS_PER_GROWTH; Math.round just guards against float drift.
    const gcDelta = !isInitialMount && growth.growthConsumedPts > prev.growthConsumedPts
      ? Math.round((growth.growthConsumedPts - prev.growthConsumedPts) / POINTS_PER_GROWTH)
      : 0;
    prevSnapshotRef.current = { stage, tamaId, gotchiPts: student.gotchiPts, growthConsumedPts: growth.growthConsumedPts };
    if (!tamaChanged && ptsDelta === 0 && gcDelta === 0) return;

    let cancelled = false;
    const isCancelled = () => cancelled;
    // Clears any montage state left dangling by an interrupted PRIOR
    // reveal (this effect's own cleanup below only cancels that reveal's
    // async work, it can't reach into its now-stale meterOverride) — this
    // invocation is about to set its own if it needs one, but if it
    // doesn't (e.g. this is purely a tamaChanged evolution step), a stale
    // override would otherwise keep showing the wrong width underneath it.
    setMeterOverride(null);
    async function run() {
      // ptsDelta (coin rain) and gcDelta (meter montage) always arrive on
      // the SAME write in practice (distributeOneStudent's phase 1 sets
      // both together), never alongside tamaChanged (phase 2's writes only
      // touch currentTama) — but nothing here actually depends on that,
      // they just run concurrently and evolution waits for both.
      const jobs = [];
      if (ptsDelta > 0) jobs.push(runCoinRain(prev, ptsDelta, isCancelled, setEvo));
      if (gcDelta > 0) jobs.push(runMeterMontage(gcDelta, isCancelled, setMeterOverride));
      if (jobs.length > 0) await Promise.all(jobs);
      if (isCancelled()) return;
      if (tamaChanged) {
        // adult -> a fresh egg (the one path that ever lands back on
        // 'egg' from something other than an egg) gets its own wave/
        // walk-off sequence instead of the generic cycle/shake/flash one
        // — see the file header.
        const sequence = stage === 'egg' && prev.stage !== 'egg' ? runNewCycleSequence(prev, isCancelled, setEvo) : runEvolution(prev, isCancelled, setEvo);
        await sequence;
      }
    }
    run().then(() => {
      if (!cancelled) setEvo(null);
    });
    return () => {
      cancelled = true;
    };
    // Only re-run when the growing tama's identity, gotchiPts, or
    // growthConsumedPts actually changes — intentionally not depending on
    // setEvo/setMeterOverride (both stable) or the functions above
    // (module-level, pure).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, tamaId, student.gotchiPts, growth.growthConsumedPts]);

  const eggFrameIdx = animFrame % EGG_ROCK.body.length;
  const normalFrames = isEgg
    ? { body: EGG_ROCK.body[eggFrameIdx], eyes: 0, mouth: 0 }
    : {
        body: WALKING_FORWARD.body[animFrame % WALKING_FORWARD.body.length],
        eyes: WALKING_FORWARD.eyes[animFrame % WALKING_FORWARD.eyes.length],
        mouth: WALKING_FORWARD.mouth[animFrame % WALKING_FORWARD.mouth.length],
      };
  const normalFaceOffset = isEgg
    ? undefined
    : {
        x: WALKING_FORWARD.faceOffsetX[animFrame % WALKING_FORWARD.faceOffsetX.length],
        y: WALKING_FORWARD.faceOffsetY[animFrame % WALKING_FORWARD.faceOffsetY.length],
      };
  const normalMirrored = isEgg && EGG_ROCK.bodyMirror[eggFrameIdx % EGG_ROCK.bodyMirror.length];

  // While evolving, override what's shown — see evoSpriteFor below for the
  // per-phase logic (which pet, which pose, whether it's shaking/walking,
  // or (the 'gone' phase, adult->new-egg only) hidden entirely).
  const showing = evo
    ? evoSpriteFor(evo, isEgg, tamaId)
    : { tamaId: isEgg ? 'egg' : tamaId, frames: normalFrames, mirrored: normalMirrored, faceOffset: normalFaceOffset, shakeX: 0, walkX: 0 };

  // Full opacity through both flashIn and the flashHold beat (the "swap
  // happens while fully white" moment — see evoSpriteFor); only flashOut
  // actually animates back down to reveal what's underneath.
  const flashOpacity = evo?.phase === 'flashIn' || evo?.phase === 'flashHold' ? 1 : 0;
  const flashMs = evo?.phase === 'flashIn' ? EVO_FLASH_IN_MS : evo?.phase === 'flashOut' ? EVO_FLASH_OUT_MS : 0;

  return (
    <div
      role="button"
      style={{ ...tileStyle, ...tileBgStyle, cursor: 'pointer' }}
      onClick={() => onSelectStudent(student)}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 * TILE_SCALE }}>
        {!showing.hidden && (
          <div style={{ position: 'relative', transform: `translateX(${(showing.shakeX || 0) + (showing.walkX || 0)}px)` }}>
            {/* shakeX and walkX are both driven per-frame via rAF (see runEvolution/runNewCycleSequence), so no CSS transition here — it would just add lag on top of already-smooth manual animation. */}
            <TamaComposite
              tamaId={showing.tamaId}
              variant="mini"
              frames={showing.frames}
              scale={TILE_SCALE}
              mirrored={showing.mirrored}
              faceOffset={showing.faceOffset}
            />
            <div style={{ ...flashMaskStyle, opacity: flashOpacity, transition: `opacity ${flashMs}ms linear` }}>
              <TamaComposite
                tamaId={showing.tamaId}
                variant="mini"
                frames={showing.frames}
                scale={TILE_SCALE}
                mirrored={showing.mirrored}
                faceOffset={showing.faceOffset}
              />
            </div>
            {showing.rainDrops?.map((d) => (
              <img
                key={d.id}
                src={COIN_URL}
                alt=""
                style={{
                  ...coinDropStyle,
                  left: `calc(50% + ${d.x}px)`,
                  opacity: d.opacity,
                  transform: `translate(-50%, ${d.y}px)`,
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div style={nameStyle}>{student.name}</div>
      <div style={meterTrackStyle} title={`${Math.round(fraction * POINTS_PER_GROWTH)}/${POINTS_PER_GROWTH} pts to next stage`}>
        <div
          style={{
            ...meterFillStyle,
            width: `${(meterOverride?.fraction ?? fraction) * 100}%`,
            // While the montage is running, its own faster fill/reset
            // speed overrides the passive default (see meterFillStyle) so
            // each cycle reads as a quick, deliberate beat instead of the
            // slow "gradual" feel normal point-by-point play uses.
            ...(meterOverride ? { transition: `width ${meterOverride.ms}ms ease-out` } : null),
          }}
        />
      </div>
      <div style={ptsStyle}>
        <img src={COIN_URL} alt="" style={coinIconStyle} />
        {student.gotchiPts}
      </div>
    </div>
  );
});

// One drop per point gotchiPts went up by (capped at RAIN_MAX_DROPS),
// each falling independently — playAddPoint() firing the moment a drop
// starts, so a big award reads as a rapid-fire shower of successive coin
// sounds rather than one lump-sum beep. A single rAF loop drives every
// drop's fall at once (each drop's own progress computed from how long
// ago IT spawned, not a shared clock) rather than awaiting one drop
// before starting the next — that overlap is the whole "rain" effect.
// Same manual-per-frame-value approach as the shake/wobble beats above
// (see their own comments for why: already smooth frame by frame, a CSS
// transition would just add lag on top).
async function runCoinRain(oldTama, delta, isCancelled, setEvo) {
  const dropCount = Math.min(delta, RAIN_MAX_DROPS);
  // Each drop's horizontal jitter and spawn offset are fixed up front so
  // they don't change frame to frame — only x is randomized (not y/timing),
  // giving a scattered-but-still-orderly rain instead of a single column.
  const dropPlan = Array.from({ length: dropCount }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * RAIN_SPREAD_PX,
    spawnAt: i * RAIN_SPAWN_INTERVAL_MS,
  }));
  const soundPlayed = new Set();
  const totalMs = (dropCount - 1) * RAIN_SPAWN_INTERVAL_MS + RAIN_FALL_MS;

  await new Promise((resolve) => {
    const start = performance.now();
    function frame(ts) {
      if (isCancelled()) return resolve();
      const elapsed = ts - start;

      const drops = [];
      for (const d of dropPlan) {
        if (elapsed < d.spawnAt) continue; // not falling yet
        if (!soundPlayed.has(d.id)) {
          playAddPoint();
          soundPlayed.add(d.id);
        }
        const t = (elapsed - d.spawnAt) / RAIN_FALL_MS;
        if (t >= 1) continue; // finished falling
        const y = -10 + t * 55; // starts just above the sprite, falls past its bottom
        const opacity = t < 0.12 ? t / 0.12 : t > 0.8 ? Math.max(0, (1 - t) / 0.2) : 1; // quick fade in, hold, fade out near the ground
        drops.push({ id: d.id, x: d.x, y, opacity });
      }
      setEvo({ phase: 'coinRain', oldTama, drops });

      if (elapsed >= totalMs) {
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

// Plays the meter climbing to full and resetting, once per growth-meter
// threshold a single distribute write just crossed (stepsCrossed — see
// useClassroomStore.js's distributeOneStudent phase 1, which writes the
// FULL earned total + the fully-caught-up growthConsumedPts in one shot
// without moving currentTama yet). Doesn't need to know the actual
// fraction values at all: each cycle just targets 1 (full), then 0 (reset)
// for the next one — the CSS transition on meterFillStyle (or the
// meterOverride-driven one, when set, see StudentTile) tweens from
// whatever's currently showing, so the very first fill correctly climbs
// from wherever the meter really was before this distribute, no separate
// "starting fraction" needed. The LAST cycle stops at full and leaves
// meterOverride there — StudentTile clears it right after, at which point
// the real prop-driven fraction (already the correct final leftover, since
// growthConsumedPts is already fully caught up) takes over, so the meter
// settles into its actual post-distribute position via the same passive
// transition normal play uses, rather than snapping.
async function runMeterMontage(stepsCrossed, isCancelled, setMeterOverride) {
  for (let i = 0; i < stepsCrossed && !isCancelled(); i++) {
    setMeterOverride({ fraction: 1, ms: METER_FILL_MS });
    await sleep(METER_FILL_MS);
    if (isCancelled()) return;
    if (i < stepsCrossed - 1) {
      setMeterOverride({ fraction: 0, ms: METER_RESET_MS });
      await sleep(METER_RESET_MS);
      if (isCancelled()) return;
    }
  }
  setMeterOverride(null);
}

// Runs the ported triggerEvolve() choreography, pushing each beat into
// setEvo as it happens (the caller renders off that state). oldTama is
// {stage, tamaId} captured right before the change — that's what the
// cycle/shake/hatch beats show, since they're meant to be the pet
// transforming, not the result.
async function runEvolution(oldTama, isCancelled, setEvo) {
  if (oldTama.stage === 'egg') {
    // Suspense beat before cracking starts: the resting egg (raw frame 0,
    // not part of egg_hatch's own [2,3,4] body array) wobbles side to
    // side — same shape as IslandView's own lead-in wobble.
    await new Promise((resolve) => {
      const start = performance.now();
      function frame(ts) {
        if (isCancelled()) return resolve();
        const elapsed = ts - start;
        if (elapsed >= EVO_HATCH_WOBBLE_MS) {
          resolve();
          return;
        }
        const shakeX = Math.sin((elapsed / 90) * Math.PI * 2) * 3;
        setEvo({ phase: 'hatchWobble', oldTama, shakeX });
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    if (isCancelled()) return;

    // Play the real hatch crack/burst frames (egg_hatch — see
    // animationStates.json) instead of the idle/happy cycle an egg has no
    // face for. Same per-frame timing IslandView uses for its own
    // one-shot hatch playback.
    for (let i = 0; i < EGG_HATCH.body.length && !isCancelled(); i++) {
      setEvo({ phase: 'hatch', oldTama, hatchFrameIdx: i });
      await sleep(EVO_HATCH_FRAME_MS);
    }
    if (isCancelled()) return;
  } else {
    for (let i = 0; i < EVO_CYCLE_STEPS && !isCancelled(); i++) {
      setEvo({ phase: 'cycle', oldTama, cycleIdx: i });
      await sleep(EVO_CYCLE_STEP_MS);
    }
    if (isCancelled()) return;

    await new Promise((resolve) => {
      const start = performance.now();
      function frame(ts) {
        if (isCancelled()) return resolve();
        const elapsed = ts - start;
        if (elapsed >= EVO_SHAKE_MS) {
          resolve();
          return;
        }
        // Same sine shape as the original's shake, scaled down (*3 vs *4)
        // for this tile's smaller size.
        const shakeX = Math.sin((elapsed / 60) * Math.PI * 2) * 3;
        setEvo({ phase: 'shake', oldTama, shakeX });
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    if (isCancelled()) return;
  }

  setEvo({ phase: 'flashIn', oldTama });
  await sleep(EVO_FLASH_IN_MS);
  if (isCancelled()) return;

  // Hold at full white for a beat — the suspenseful pause right before the
  // reveal. The new pet is already what's rendered underneath from here on
  // (see evoSpriteFor), just fully hidden until flashOut fades the white
  // back down.
  setEvo({ phase: 'flashHold', oldTama });
  await sleep(EVO_FLASH_HOLD_MS);
  if (isCancelled()) return;

  setEvo({ phase: 'flashOut', oldTama });
  await sleep(EVO_FLASH_OUT_MS);
  if (isCancelled()) return;

  setEvo({ phase: 'celebrate', oldTama });
  await sleep(EVO_CELEBRATE_MS);
}

// adult -> new egg: no flash, no transformation-in-place — the finished
// adult waves, walks off the tile, and once it's gone the new egg just
// appears. See the file header for why this is separate from
// runEvolution. oldTama is the completed adult (still has a real tamaId,
// unlike egg->baby's oldTama).
async function runNewCycleSequence(oldTama, isCancelled, setEvo) {
  setEvo({ phase: 'wave', oldTama });
  await sleep(EVO_WAVE_MS);
  if (isCancelled()) return;

  await new Promise((resolve) => {
    const start = performance.now();
    function frame(ts) {
      if (isCancelled()) return resolve();
      const elapsed = ts - start;
      if (elapsed >= EVO_WALKOFF_MS) {
        resolve();
        return;
      }
      const walkX = (elapsed / EVO_WALKOFF_MS) * EVO_WALKOFF_DISTANCE_PX;
      const walkStep = Math.floor(elapsed / EVO_WALK_STEP_MS);
      setEvo({ phase: 'walkoff', oldTama, walkX, walkStep });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  if (isCancelled()) return;

  // Fully off-tile now (clipped by the tile's own overflow:hidden) — a
  // beat of nothing before the new egg shows up.
  setEvo({ phase: 'gone', oldTama });
  await sleep(EVO_GONE_MS);
  if (isCancelled()) return;

  setEvo({ phase: 'eggAppear', oldTama });
  await sleep(EVO_EGG_APPEAR_MS);
}

// Resolves an in-progress evolution's phase into what TamaComposite should
// render. cycle/shake/hatchWobble/hatch/flashIn/wave/walkoff still show
// the OLD pet (idle/happy alternating for cycle, a static idle pose while
// shaking, the resting egg sliding side to side during hatchWobble, the
// live egg_hatch frame while hatching, a happy pose while waving, walking
// frames while sliding off); flashHold/flashOut/celebrate/eggAppear show
// the NEW one (current isEgg/tamaId — the actual props the tile was
// passed, already updated by the time the sequence gets here); 'gone' is
// hidden entirely.
function evoSpriteFor(evo, isEgg, tamaId) {
  const { phase, oldTama, cycleIdx = 0, shakeX = 0, hatchFrameIdx = 0, walkX = 0, walkStep = 0 } = evo;
  const showingOld = phase === 'cycle' || phase === 'shake' || phase === 'hatch' || phase === 'flashIn';

  if (phase === 'coinRain') {
    // Shows oldTama, NOT the isEgg/tamaId params — bug fix: those params
    // are the tile's CURRENT props, which by this point already reflect
    // the post-distribute result (growth/tamaId update in the same write
    // pendingPts/gotchiPts do), not what the student had a moment ago.
    // Using them here meant the coin rain flashed the NEW tama in first,
    // then the evolution sequence's own (correctly oldTama-based) phases
    // snapped back to the OLD one right after — exactly the "new tama,
    // then the old one reappears" glitch this fixes. `rainDrops` tells
    // the tile which falling coins to render on top (see coinDropStyle)
    // — already-positioned {id,x,y,opacity} objects, nothing left to
    // compute in the render itself.
    const base = oldTama.stage === 'egg'
      ? { tamaId: 'egg', frames: { body: 0, eyes: 0, mouth: 0 }, mirrored: false, faceOffset: undefined }
      : { tamaId: oldTama.tamaId, frames: { body: IDLE.body[0], eyes: IDLE.eyes[0], mouth: IDLE.mouth[0] }, mirrored: false, faceOffset: { x: 0, y: 0 } };
    return { ...base, shakeX: 0, walkX: 0, rainDrops: evo.drops ?? [] };
  }
  if (phase === 'hatchWobble') {
    return { tamaId: 'egg', frames: { body: 0, eyes: 0, mouth: 0 }, mirrored: false, faceOffset: undefined, shakeX, walkX: 0 };
  }
  if (phase === 'hatch') {
    return { tamaId: 'egg', frames: { body: EGG_HATCH.body[hatchFrameIdx], eyes: 0, mouth: 0 }, mirrored: false, faceOffset: undefined, shakeX: 0, walkX: 0 };
  }
  if (phase === 'wave') {
    return {
      tamaId: oldTama.tamaId,
      frames: { body: HAPPY.body[0], eyes: HAPPY.eyes[0], mouth: HAPPY.mouth[0] },
      mirrored: false,
      faceOffset: { x: 0, y: 0 },
      shakeX: 0,
      walkX: 0,
    };
  }
  if (phase === 'walkoff') {
    const idx = walkStep % WALK.body.length;
    return {
      tamaId: oldTama.tamaId,
      frames: { body: WALK.body[idx], eyes: WALK.eyes[idx % WALK.eyes.length], mouth: WALK.mouth[idx % WALK.mouth.length] },
      mirrored: true, // faces right, the direction it's sliding — TamaComposite/resolveAnimState already account for mirroring flipping faceOffsetX's visual direction, no manual sign flip needed (same pattern IslandView's roamers use)
      faceOffset: { x: WALK.faceOffsetX[idx % WALK.faceOffsetX.length], y: WALK.faceOffsetY[idx % WALK.faceOffsetY.length] },
      shakeX: 0,
      walkX,
    };
  }
  if (phase === 'gone') {
    return { hidden: true, shakeX: 0, walkX: 0 };
  }
  if (phase === 'eggAppear') {
    return { tamaId: 'egg', frames: { body: 0, eyes: 0, mouth: 0 }, mirrored: false, faceOffset: undefined, shakeX: 0, walkX: 0 };
  }
  if (showingOld && oldTama.stage === 'egg') {
    // flashIn right after an egg->baby hatch — hold on egg_hatch's final
    // (burst) frame instead of snapping back to a plain egg.
    return { tamaId: 'egg', frames: { body: EGG_HATCH.body.at(-1), eyes: 0, mouth: 0 }, mirrored: false, faceOffset: undefined, shakeX: 0 };
  }
  if (showingOld) {
    const pose = phase === 'cycle' ? (cycleIdx % 2 === 0 ? IDLE : HAPPY) : IDLE;
    return {
      tamaId: oldTama.tamaId,
      frames: { body: pose.body[0], eyes: pose.eyes[0], mouth: pose.mouth[0] },
      mirrored: false,
      faceOffset: { x: 0, y: 0 },
      shakeX: phase === 'shake' ? shakeX : 0,
    };
  }

  // flashHold / flashOut / celebrate — the new pet.
  if (isEgg) {
    return { tamaId: 'egg', frames: { body: 0, eyes: 0, mouth: 0 }, mirrored: false, faceOffset: undefined, shakeX: 0 };
  }
  const pose = phase === 'celebrate' ? HAPPY : IDLE;
  return {
    tamaId,
    frames: { body: pose.body[0], eyes: pose.eyes[0], mouth: pose.mouth[0] },
    mirrored: false,
    faceOffset: { x: 0, y: 0 },
    shakeX: 0,
  };
}

function EmptyTile() {
  return <div style={{ ...tileStyle, border: '1px dashed #2e2e4e', background: 'transparent' }} />;
}

const tileStyle = {
  aspectRatio: '1 / 1',
  backgroundColor: '#22223a', // fallback beneath the image/scrim (StudentTile) or plain background (EmptyTile)
  border: '1px solid #2e2e4e',
  borderRadius: 6,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: 6,
  boxSizing: 'border-box',
  overflow: 'hidden',
  fontFamily: 'ui-monospace, monospace',
};

// Layered on top of tileStyle for occupied tiles only — a dark scrim under
// the grass art so the light-on-dark text styles below stay readable.
const tileBgStyle = {
  backgroundImage: `linear-gradient(rgba(10, 10, 20, 0.5), rgba(10, 10, 20, 0.5)), url(${TILE_BG_URL})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  imageRendering: 'pixelated',
};

const nameStyle = {
  fontSize: 10,
  color: '#e0e0f0',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
  textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
};

const meterTrackStyle = {
  width: '85%',
  height: 5,
  background: '#1a1a2e',
  border: '1px solid #2e2e4e',
  borderRadius: 3,
  overflow: 'hidden',
};

const meterFillStyle = {
  height: '100%',
  background: '#4ef0d8',
  // Was 0.2s — imperceptible at that speed, just snapped to the new width.
  // Slowed way down so the meter visibly GROWS toward the next stage
  // instead of instantly appearing there, including across a multi-stage
  // distribute's per-step writes (each write's width jump gets its own
  // gradual fill, one after another).
  transition: 'width 1.2s ease-out',
};

const ptsStyle = {
  fontSize: 8,
  color: '#ffe066', // matches the teacher dashboard's ★-prefixed currency styling (Award button, tamadex star)
  textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
  display: 'flex',
  alignItems: 'center',
  gap: 3,
};

const coinIconStyle = {
  width: 10,
  height: 10,
  imageRendering: 'pixelated',
};

// The evolution sequence's white flash — a second copy of whatever
// TamaComposite is showing, filtered to a white silhouette (brightness(0)
// turns every opaque pixel black while leaving alpha untouched — same
// trick TamadexToast uses for its uncollected entries — then invert(1)
// flips that black to white) and cross-faded via opacity. Shaped exactly
// to the sprite's own transparency, not a hard-edged box. inset:0 against
// the sprite's own wrapper (position:relative) keeps it pixel-aligned
// regardless of tile scale or the shake offset it inherits from its
// parent.
const flashMaskStyle = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  filter: 'brightness(0) invert(1)',
};

// One coin-rain drop — see runCoinRain. `left` is overridden per-drop
// (horizontal jitter); top/transform give it a starting point just above
// the sprite that the per-frame translateY then falls away from.
// opacity/transform driven directly per-rAF-frame by that function (not a
// CSS transition — same reasoning as shakeX/walkX above: it's already
// being driven smoothly frame by frame, a transition would just add lag
// on top).
const coinDropStyle = {
  position: 'absolute',
  top: '15%',
  width: 12,
  height: 12,
  imageRendering: 'pixelated',
  pointerEvents: 'none',
};
