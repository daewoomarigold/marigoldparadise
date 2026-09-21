// The shared "island" — every student's display tama roaming together on
// one background, meant to be projected in class (see GAME_DESIGN.md "The
// shared island"). Reads the same Supabase data the teacher dashboard
// writes to (see src/data/useClassroomStore.js and supabase/schema.sql),
// shows the currently-active class's students, and roams each one using
// physics ported from the old gotchigarden.html (see src/game/movement.js).
//
// Requires sign-in, same as the teacher dashboard — see src/auth/useAuth.js
// and CLAUDE.md's Database section for why (no public/unauthenticated
// read path; whatever device projects this needs its own sign-in, same
// account, same row-level-security rules as everywhere else).
//
// Its own page — island/index.html + src/islandMain.jsx — served at
// /island/, separate from the teacher dashboard's /teacher/ (see
// vite.config.js's multi-page build comment for why: mirrors the old
// gotchigarden repo's two separate static pages instead of one SPA
// faking routes via a query param).

import { useEffect, useMemo, useRef, useState } from 'react';
import { spriteUrl, resolveAnimState } from '../game/spriteData.js';
import { TamaComposite } from '../game/spriteCompositor.jsx';
import { createRoamer, stepRoamer, stepAnim, EMOTE_FPS } from '../game/movement.js';
import { getYBoundsForImage683 } from './terrain.js';
import { resolveDisplayTama } from '../game/growth.js';
import { playTap, playAddPoint } from '../sound.js';
import { useAuth } from '../auth/useAuth.js';
import { useClassroomStore } from '../data/useClassroomStore.js';
import LoginScreen from '../auth/LoginScreen.jsx';
import StudentGrid from './StudentGrid.jsx';
import TamadexToast from './TamadexToast.jsx';

const BACKGROUND_FILE = 'image-683.png';
const CANVAS_W = 512;
const CANVAS_H = 512;
const SCALE = 1; // mini sprites are 32x32 native; this is their on-screen size multiplier
const SPRITE_PX = 32 * SCALE;

// Page zoom (see the `zoom` state in IslandView) — 25% steps, remembered
// per browser.
const ZOOM_KEY = 'marigold-island-zoom';
const ZOOM_MIN = 0.75;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.25;
function loadZoom() {
  try {
    const saved = Number(localStorage.getItem(ZOOM_KEY));
    return saved >= ZOOM_MIN && saved <= ZOOM_MAX ? saved : 1;
  } catch {
    return 1; // storage blocked — default scale
  }
}

// Class switcher — lets the island itself change which class is active
// (currentClassId, via useClassroomStore's selectClass) instead of
// requiring the teacher dashboard's sidebar for that.
const classSwitcherStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const classBtnStyle = {
  background: '#1a1a2e',
  border: '1px solid #2e2e4e',
  color: '#a0a0c0',
  borderRadius: 6,
  padding: '6px 12px',
  fontFamily: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
};

// Small top-right buttons (zoom −/+, sign out).
const cornerBtnStyle = {
  background: 'none',
  border: '1px solid #2e2e4e',
  color: '#7070a0',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 10,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const classBtnActiveStyle = {
  border: '1px solid #ffe066',
  background: 'rgba(255, 224, 102, 0.12)',
  color: '#ffe066',
};

export default function IslandView() {
  const auth = useAuth();
  // Called unconditionally regardless of auth state (rules of hooks) —
  // the hook itself no-ops until there's a real session, see its header
  // comment.
  const store = useClassroomStore(auth.session);

  const roamersRef = useRef(new Map()); // studentId -> mutable roamer state (see movement.js)
  const lastTsRef = useRef(null);
  const [, setTick] = useState(0); // bumped every animation frame to force a re-render from the refs above
  const [selectedStudentId, setSelectedStudentId] = useState(null); // which student's tamadex toast is open, if any
  // Browsers block audio.play() triggered by something OTHER than a
  // direct user gesture (e.g. the realtime-triggered playAddPoint below)
  // until a real gesture has happened somewhere on this page — normally
  // any click anywhere satisfies that, but this page is meant to sit
  // backgrounded (behind slides, say) while points get awarded from a
  // SEPARATE tab/device, so it may never receive one on its own. Tracks
  // whether that's happened yet so a one-time prompt can ask for it — see
  // the "Click to enable sound" button below. Resets on reload (that's
  // the browser's real requirement, not just this app's UI) — see that
  // button for the persistent alternative (a Chrome site-setting).
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Whole-page scale — this page gets projected on displays (a smartboard)
  // much bigger than the laptop it's developed on, and everything here is
  // sized in fixed px, so it reads small there. Applied as CSS `zoom` on the
  // root (below), which — unlike transform: scale() — actually changes
  // layout size, so centering/wrapping/scrolling all stay correct. Saved per
  // browser (localStorage), so it's set once on the smartboard and stays
  // there without affecting the laptop.
  const [zoom, setZoom] = useState(loadZoom);
  function changeZoom(delta) {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((zoom + delta) * 100) / 100));
    setZoom(next);
    try {
      localStorage.setItem(ZOOM_KEY, String(next));
    } catch {
      // storage blocked — the change still applies for this session
    }
  }

  const activeClass = useMemo(
    () => store.classes.find((c) => c.id === store.currentClassId) ?? null,
    [store.classes, store.currentClassId],
  );
  // Stabilized so the roster-sync effect below doesn't see a "new" array
  // (and re-run its add/remove diff pointlessly) on every animation-frame
  // re-render when the underlying data hasn't actually changed.
  const students = useMemo(
    () => store.students.filter((s) => s.classId === store.currentClassId),
    [store.students, store.currentClassId],
  );

  // Global button-tap sound — scoped to this view only, not the teacher
  // dashboard, since this (the projected/class-facing page) is the one
  // that should actually be heard. Ported from the old gotchigarden.html's
  // document-wide click listener (see that repo's AUDIO section): fires
  // for any button/link click anywhere in this view (class switcher,
  // student tiles, tamadex toast) without needing per-button wiring.
  //
  // [role="button"] (not just an actual <button>/<a>) matters here — the
  // student tile (StudentGrid.jsx) and the tamadex's tama-select cells
  // (TamadexToast.jsx) are styled divs with an onClick, not real <button>
  // elements (their pixel-art tile look doesn't want default button
  // chrome), so they're marked role="button" specifically so this catches
  // them too. Bug fix: this used to only match `button, a[role="button"]`
  // — an actual <a> tag with the role, not any element — so those tile
  // clicks never played anything.
  useEffect(() => {
    function onClick(e) {
      const btn = e.target.closest('button, [role="button"]');
      if (btn) playTap();
    }
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  // Coin sound whenever points get ADDED to any student's pending bucket
  // (from the dashboard, another tab, another device — it arrives here via
  // the realtime subscription in useClassroomStore, same as everything
  // else). Track each student's pendingPts as of the last change and
  // compare: an increase plays the sound, a decrease doesn't (Distribute
  // zeroes pending out, and its own reveal — StudentGrid.jsx's coin rain —
  // plays its own sounds). Plays once per batch of changes, not once per
  // student, so "Award All" is one coin sound rather than a stacked wall
  // of them. Skips the very first run (nothing to compare against, would
  // otherwise fire for whatever's already queued on load) and any student
  // not seen before (a roster change, not points being added).
  // Browsers only allow this once the page has had a click — see the
  // "Click to enable sound" button.
  const prevPendingRef = useRef(null); // Map<studentId, pendingPts> as of the last run, or null before the first
  useEffect(() => {
    const prevPending = prevPendingRef.current;
    if (prevPending) {
      const anyIncrease = students.some((s) => {
        const prior = prevPending.get(s.id);
        return prior != null && (s.pendingPts ?? 0) > prior;
      });
      if (anyIncrease) playAddPoint();
    }
    prevPendingRef.current = new Map(students.map((s) => [s.id, s.pendingPts ?? 0]));
  }, [students]);

  // Keep roamer entries in sync with the current roster — add newly-added
  // students, drop removed ones — without resetting anyone already roaming
  // (their position/velocity/animation phase should survive a roster edit
  // elsewhere, not jump/reset).
  useEffect(() => {
    const roamers = roamersRef.current;
    const currentIds = new Set(students.map((s) => s.id));
    for (const id of [...roamers.keys()]) {
      if (!currentIds.has(id)) roamers.delete(id);
    }
    for (const s of students) {
      if (!roamers.has(s.id)) {
        roamers.set(
          s.id,
          createRoamer({ id: s.id, canvasWidth: CANVAS_W, spriteWidth: SPRITE_PX, spriteHeight: SPRITE_PX, getYBounds: getYBoundsForImage683 }),
        );
      }
    }
  }, [students]);

  // Static lookup (same object every call, pure function over the JSON
  // import) — fine to capture once in the rAF effect's closure below even
  // though that effect only runs on mount ([] deps).
  const walk = resolveAnimState('walk_left');
  const emoteStates = { happy: resolveAnimState('happy'), jump_happy: resolveAnimState('jump_happy') };

  useEffect(() => {
    let raf;
    function frame(ts) {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      // Clamp dt so a backgrounded/throttled tab doesn't produce one huge
      // jump in position when it regains focus.
      const dt = Math.min(0.1, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      for (const roamer of roamersRef.current.values()) {
        stepRoamer(roamer, dt, CANVAS_W);
        stepAnim(roamer, dt);
      }

      setTick((t) => t + 1);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (auth.loading) return <LoadingScreen text="Signing in…" />;
  if (!auth.session) return <LoginScreen onSignIn={auth.signInWithGoogle} error={auth.error} />;
  if (store.loading) return <LoadingScreen text="Loading…" />;

  // Looked up fresh from `students` (not stored as its own object) so the
  // toast reflects live growth/points changes from another device while open.
  const selectedStudent = students.find((s) => s.id === selectedStudentId) ?? null;

  const pendingStudentCount = students.filter((s) => (s.pendingPts ?? 0) !== 0).length;
  // "Tama Time" — same action/confirm as the dashboard's own Distribute
  // button (useClassroomStore.js's distributeClass); this one's the
  // primary copy since the reveal itself plays right here, on this page
  // (StudentGrid.jsx's tiles react to the write this triggers).
  function distributeAll() {
    if (pendingStudentCount === 0) return;
    if (!confirm(`Distribute queued points for ${pendingStudentCount} student${pendingStudentCount === 1 ? '' : 's'}?`)) return;
    store.distributeClass(students);
  }

  return (
    <div
      style={{
        zoom,
        position: 'relative',
        // zoom scales lengths too, including svh — divide it back out so
        // the page still fills exactly one screen instead of zoom-many.
        minHeight: `${100 / zoom}svh`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: '#0e0e1a',
        fontFamily: 'ui-monospace, monospace',
        padding: 16,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          onClick={() => changeZoom(-ZOOM_STEP)}
          disabled={zoom <= ZOOM_MIN}
          title="Zoom out"
          style={cornerBtnStyle}
        >
          −
        </button>
        <span style={{ color: '#7070a0', fontSize: 10, minWidth: 30, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => changeZoom(ZOOM_STEP)}
          disabled={zoom >= ZOOM_MAX}
          title="Zoom in"
          style={cornerBtnStyle}
        >
          +
        </button>
        <button onClick={auth.signOut} title={auth.session.user.email} style={cornerBtnStyle}>
          Sign out
        </button>
      </div>

      {!audioUnlocked && (
        // One click anywhere satisfies the browser's requirement — this
        // button doesn't call playTap() itself; the existing document-wide
        // click listener above already does, for every click on this
        // page, and that's what actually counts as the gesture. This is
        // just a deliberate, visible target for it before the tab gets
        // backgrounded, plus the audible tap IS the "yes, it worked"
        // confirmation. See audioUnlocked's own comment for the fuller
        // picture (and a persistent alternative to clicking this every
        // reload — a Chrome site-setting).
        <button
          onClick={() => setAudioUnlocked(true)}
          title="Browsers block sound triggered by something other than a click (like points arriving from another device) until you've clicked something on this page at least once — do that here before backgrounding this tab."
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(255, 224, 102, 0.12)',
            border: '1px solid #ffe066',
            color: '#ffe066',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 10,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          🔊 Click to enable sound
        </button>
      )}

      {store.classes.length > 0 && (
        <div style={classSwitcherStyle}>
          {store.classes.map((c) => (
            <button
              key={c.id}
              onClick={() => store.selectClass(c.id)}
              style={{ ...classBtnStyle, ...(c.id === activeClass?.id ? classBtnActiveStyle : null) }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {activeClass && (
        <button
          onClick={distributeAll}
          disabled={pendingStudentCount === 0}
          style={{
            ...classBtnStyle,
            ...(pendingStudentCount > 0 ? classBtnActiveStyle : { opacity: 0.5, cursor: 'default' }),
          }}
        >
          🎉 Distribute{pendingStudentCount > 0 ? ` (${pendingStudentCount})` : ''}
        </button>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
      <div
        style={{
          position: 'relative',
          width: CANVAS_W,
          height: CANVAS_H,
          maxWidth: '100%',
          aspectRatio: '1 / 1',
          overflow: 'hidden',
          borderRadius: 8,
          boxShadow: '0 0 0 1px #2e2e4e',
        }}
      >
        <img
          src={spriteUrl(BACKGROUND_FILE)}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {!activeClass && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              textShadow: '0 1px 3px #000',
              fontSize: 13,
              textAlign: 'center',
              padding: 24,
            }}
          >
            No classes yet — create one in the teacher dashboard.
          </div>
        )}

        {/* eslint-disable-next-line react/refs -- roamersRef is deliberately read during render here; see the comment on `roamer` below for why. */}
        {students.map((s) => {
          const growth = s.growth;
          // Deliberately reading the ref during render: roamersRef is the
          // physics loop's mutable source of truth (updated imperatively
          // in the rAF effect above, 60x/sec), and this render only runs
          // because that loop just bumped `tick` — not the "derived state
          // stuffed in a ref" anti-pattern the lint rule usually flags.
          const roamer = roamersRef.current.get(s.id);
          if (!growth || !roamer) return null;
          // The field shows the CHOSEN display tama, not necessarily what's
          // growing — see growth.js's resolveDisplayTama and StudentGrid's
          // header comment for the asymmetric-design rationale.
          const { stage, tamaId } = resolveDisplayTama(s);

          // Eggs never appear on the field, full stop — even a brand new
          // student who's never grown anything past their very first egg.
          // The egg/hatch animations (idle rock + crack/burst on
          // transition) live on the roster tile only now (StudentGrid.jsx)
          // — the field used to show a stationary rocking egg here too,
          // but that read as a bug ("eggs appearing on the field") more
          // than a feature, so it's gone: a student just doesn't show up
          // on the island until they've hatched.
          if (stage === 'egg') return null;

          // Mid-emote (see movement.js): the happy/jump_happy state instead of
          // the walk cycle. happy is one static pose; jump_happy alternates
          // its frames at EMOTE_FPS from how long the emote's been running.
          const anim = roamer.emote ? emoteStates[roamer.emote.kind] : walk;
          const frameIdx = roamer.emote
            ? roamer.emote.kind === 'jump_happy'
              ? Math.floor(roamer.emote.elapsed * EMOTE_FPS)
              : 0
            : roamer.animFrame;
          const bodyFrame = anim.body[frameIdx % anim.body.length];
          const eyesFrame = anim.eyes[frameIdx % anim.eyes.length];
          const mouthFrame = anim.mouth[frameIdx % anim.mouth.length];
          const faceOffset = {
            x: anim.faceOffsetX[frameIdx % anim.faceOffsetX.length],
            y: anim.faceOffsetY[frameIdx % anim.faceOffsetY.length],
          };

          return (
            <div key={s.id} style={{ position: 'absolute', left: roamer.x, top: roamer.y }}>
              <TamaComposite
                tamaId={tamaId}
                variant="mini"
                frames={{ body: bodyFrame, eyes: eyesFrame, mouth: mouthFrame }}
                scale={SCALE}
                mirrored={roamer.facingRight}
                faceOffset={faceOffset}
              />
              <NameTag name={s.name} />
            </div>
          );
        })}
      </div>

      <StudentGrid students={students} onSelectStudent={(s) => setSelectedStudentId(s.id)} />
      </div>

      <div style={{ color: '#7070a0', fontSize: 11 }}>{activeClass ? activeClass.name : 'Marigold Island'}</div>

      {selectedStudent && (
        <TamadexToast
          student={selectedStudent}
          onSelectDisplay={(tamaId) => store.setDisplayTama(selectedStudent.id, tamaId)}
          onClose={() => setSelectedStudentId(null)}
        />
      )}
    </div>
  );
}

function LoadingScreen({ text }) {
  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0e0e1a',
        color: '#7070a0',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 12,
      }}
    >
      {text}
    </div>
  );
}

function NameTag({ name }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: -14,
        left: 0,
        width: '100%',
        textAlign: 'center',
        fontSize: 9,
        color: '#fff',
        textShadow: '0 1px 2px #000',
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </div>
  );
}
