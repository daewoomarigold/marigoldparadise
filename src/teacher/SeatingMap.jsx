// The teacher dashboard's room view: student cards placed at their actual
// desks instead of in a grid — see seating.js for the data model (one
// shared room layout, per-class seating) and DEFAULT_ROOM_LAYOUT.
//
// Three modes, driven by TeacherDashboard's `mode`:
//
// - 'view': the normal lesson view. Each seated student's full card (the
//   same one the grid view uses, passed in as renderCard) sits on their
//   desk; anyone without a desk gets a full card in the strip underneath,
//   so they can still be given points.
// - 'arrange': tap a student (on a desk or in the strip), then tap a desk
//   to move them there, swapping with whoever's already sitting there.
//   Tapping the strip with a seated student selected unseats them.
//   Tap-tap rather than drag-and-drop — it's reliable on an iPad and
//   doesn't fight with scrolling. Cards shrink to just names here so a stray
//   tap can't queue points.
// - 'edit': drag desks and fixtures around the room (snapped to SNAP
//   units), add/delete desks, or reset to the default layout. Changes the
//   SHARED layout, so every class sees it.
//
// The whole room is laid out in room units and scaled with one CSS
// transform to fit the space available, so the cards keep the same
// proportions on any screen.

import { useEffect, useRef, useState } from 'react';
import { DESK_W, DESK_H, DEFAULT_ROOM_LAYOUT, layoutBounds, resolveSeating, shuffleSeating, snap, newDeskId } from './seating.js';

const ROOM_PAD = 10; // room units of breathing space around the outermost desk/fixture
const STAGE_PAD = 12; // px between the scaled room and the stage edge
const MAX_SCALE = 1.6;

export default function SeatingMap({ layout, seating, students, search, mode, onModeChange, renderCard, onSeatingChange, onLayoutChange }) {
  const stageRef = useRef(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  // arrange mode: the student id picked up, waiting for a desk tap.
  const [pickedStudentId, setPickedStudentId] = useState(null);
  // edit mode: the selected desk (for Delete), and the live drag.
  const [selectedDeskId, setSelectedDeskId] = useState(null);
  const [dragPos, setDragPos] = useState(null); // { id, x, y } while something's being dragged
  const dragRef = useRef(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStageSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Selections only mean something inside the mode that made them.
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setPickedStudentId(null);
    setSelectedDeskId(null);
  }, [mode]);

  const { deskToStudent, unseated } = resolveSeating(seating, layout, students);
  const bounds = layoutBounds(layout, ROOM_PAD);
  const roomW = bounds.maxX - bounds.minX;
  const roomH = bounds.maxY - bounds.minY;
  const scale = Math.min(
    MAX_SCALE,
    Math.max(0, (stageSize.w - STAGE_PAD * 2) / roomW),
    Math.max(0, (stageSize.h - STAGE_PAD * 2) / roomH),
  );

  const matchesSearch = (s) => !search || s.name.toLowerCase().includes(search.toLowerCase());

  // The current seating with stale entries already pruned (see
  // resolveSeating) — every arrange-mode write starts from this, so a
  // write also quietly cleans up anything left behind by a deleted desk or
  // a removed student.
  function cleanSeating() {
    const out = {};
    for (const [deskId, s] of deskToStudent) out[deskId] = s.id;
    return out;
  }

  function deskOf(studentId) {
    for (const [deskId, s] of deskToStudent) if (s.id === studentId) return deskId;
    return null;
  }

  function tapDesk(deskId) {
    const occupant = deskToStudent.get(deskId) ?? null;
    if (!pickedStudentId) {
      if (occupant) setPickedStudentId(occupant.id);
      return;
    }
    if (occupant?.id === pickedStudentId) {
      setPickedStudentId(null);
      return;
    }
    const next = cleanSeating();
    const fromDesk = deskOf(pickedStudentId);
    if (fromDesk) delete next[fromDesk];
    next[deskId] = pickedStudentId;
    // Swap: whoever was here takes the picked student's old desk — or, if
    // the picked student came from the strip, goes to the strip.
    if (occupant && fromDesk) next[fromDesk] = occupant.id;
    onSeatingChange(next);
    setPickedStudentId(null);
  }

  function tapUnseatedStrip() {
    if (!pickedStudentId) return;
    const fromDesk = deskOf(pickedStudentId);
    if (!fromDesk) return; // already unseated — the chip's own handler toggles that
    const next = cleanSeating();
    delete next[fromDesk];
    onSeatingChange(next);
    setPickedStudentId(null);
  }

  function shuffle() {
    if (deskToStudent.size > 0 && !confirm('Shuffle the whole class into random seats? This replaces the current arrangement.')) return;
    onSeatingChange(shuffleSeating(layout, students));
    setPickedStudentId(null);
  }

  function clearSeats() {
    if (deskToStudent.size === 0) return;
    if (!confirm('Unseat everyone in this class?')) return;
    onSeatingChange({});
    setPickedStudentId(null);
  }

  // ── Edit room: dragging ──────────────────────────────────────────────
  function startDrag(e, item, kind) {
    if (mode !== 'edit') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: item.id, kind, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origX: item.x, origY: item.y, x: item.x, y: item.y, moved: false };
  }

  function moveDrag(e) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId || scale <= 0) return;
    // A few px of slop so a plain tap (to select a desk) doesn't nudge it.
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
    d.moved = true;
    d.x = snap(d.origX + (e.clientX - d.startX) / scale);
    d.y = snap(d.origY + (e.clientY - d.startY) / scale);
    setDragPos({ id: d.id, x: d.x, y: d.y });
  }

  function endDrag(e) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragPos(null);
    if (d.moved) {
      const key = d.kind === 'desk' ? 'desks' : 'fixtures';
      onLayoutChange({ ...layout, [key]: layout[key].map((it) => (it.id === d.id ? { ...it, x: d.x, y: d.y } : it)) });
    } else if (d.kind === 'desk') {
      setSelectedDeskId((cur) => (cur === d.id ? null : d.id));
    }
  }

  function cancelDrag() {
    dragRef.current = null;
    setDragPos(null);
  }

  const dragHandlers = (item, kind) => ({
    onPointerDown: (e) => startDrag(e, item, kind),
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: cancelDrag,
  });

  function addDesk() {
    const lowest = layoutBounds({ desks: layout.desks, fixtures: [] });
    const desk = { id: newDeskId(), x: snap(lowest.minX), y: snap(layout.desks.length ? lowest.maxY + 20 : 0) };
    onLayoutChange({ ...layout, desks: [...layout.desks, desk] });
    setSelectedDeskId(desk.id);
  }

  function deleteDesk() {
    if (!selectedDeskId) return;
    const occupant = deskToStudent.get(selectedDeskId);
    if (occupant && !confirm(`${occupant.name} sits at this desk in this class — delete it anyway? They'll move to the unseated strip.`)) return;
    onLayoutChange({ ...layout, desks: layout.desks.filter((d) => d.id !== selectedDeskId) });
    setSelectedDeskId(null);
  }

  function resetLayout() {
    if (!confirm('Reset the room to the default layout? This affects every class. Students at desks that no longer exist will become unseated.')) return;
    onLayoutChange(DEFAULT_ROOM_LAYOUT);
    setSelectedDeskId(null);
  }

  const posOf = (item) => (dragPos?.id === item.id ? dragPos : item);
  const place = (item, w, h) => {
    const p = posOf(item);
    return { left: p.x - bounds.minX, top: p.y - bounds.minY, width: w, height: h };
  };

  return (
    <div className="seat-area">
      {mode === 'arrange' && (
        <div className="seat-mode-bar">
          <span className="seat-mode-hint">
            {pickedStudentId
              ? `Now tap a desk for ${students.find((s) => s.id === pickedStudentId)?.name ?? 'them'} (or the strip below to unseat).`
              : 'Tap a student, then tap a desk to move them there. Tapping a taken desk swaps them.'}
          </span>
          <div className="teacher-btn-flex" />
          <button className="teacher-btn yellow" onClick={shuffle}>
            🔀 Shuffle
          </button>
          <button className="teacher-btn red" onClick={clearSeats} disabled={deskToStudent.size === 0}>
            Clear all
          </button>
          <button className="teacher-btn green" onClick={() => onModeChange('view')}>
            Done
          </button>
        </div>
      )}
      {mode === 'edit' && (
        <div className="seat-mode-bar">
          <span className="seat-mode-hint">Drag desks and fixtures to match the room. Changes apply to every class.</span>
          <div className="teacher-btn-flex" />
          <button className="teacher-btn green" onClick={addDesk}>
            + Desk
          </button>
          <button className="teacher-btn red" onClick={deleteDesk} disabled={!selectedDeskId} title={selectedDeskId ? '' : 'Tap a desk to select it first'}>
            Delete desk
          </button>
          <button className="teacher-btn" onClick={resetLayout}>
            Reset to default
          </button>
          <button className="teacher-btn green" onClick={() => onModeChange('view')}>
            Done
          </button>
        </div>
      )}

      <div className="seat-stage" ref={stageRef}>
        {scale > 0 && (
          <div className="seat-room-frame" style={{ width: roomW * scale, height: roomH * scale }}>
            <div className={`seat-room mode-${mode}`} style={{ width: roomW, height: roomH, transform: `scale(${scale})` }}>
              {layout.fixtures.map((f) => (
                <div
                  key={f.id}
                  className={`seat-fixture seat-fixture-${f.kind}${dragPos?.id === f.id ? ' dragging' : ''}`}
                  style={place(f, f.w, f.h)}
                  {...(mode === 'edit' ? dragHandlers(f, 'fixture') : {})}
                >
                  <span className={f.h > f.w ? 'seat-fixture-label vertical' : 'seat-fixture-label'}>{f.label}</span>
                </div>
              ))}

              {layout.desks.map((desk) => {
                const student = deskToStudent.get(desk.id) ?? null;
                const style = place(desk, DESK_W, DESK_H);

                if (mode === 'edit') {
                  return (
                    <div
                      key={desk.id}
                      className={`seat-desk edit${selectedDeskId === desk.id ? ' selected' : ''}${dragPos?.id === desk.id ? ' dragging' : ''}`}
                      style={style}
                      {...dragHandlers(desk, 'desk')}
                    >
                      <span className="seat-desk-name">{student ? student.name : 'Desk'}</span>
                    </div>
                  );
                }

                if (mode === 'arrange') {
                  const picked = student && student.id === pickedStudentId;
                  return (
                    <button
                      key={desk.id}
                      className={`seat-desk arrange${student ? '' : ' empty'}${picked ? ' selected' : ''}${pickedStudentId && !picked ? ' target' : ''}`}
                      style={style}
                      onClick={() => tapDesk(desk.id)}
                    >
                      <span className="seat-desk-name">{student ? student.name : 'empty'}</span>
                    </button>
                  );
                }

                return student ? (
                  <div key={desk.id} className={`seat-desk view${matchesSearch(student) ? '' : ' dim'}`} style={style}>
                    {renderCard(student)}
                  </div>
                ) : (
                  <div key={desk.id} className="seat-desk empty" style={style}>
                    <span className="seat-desk-name">empty</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {mode !== 'edit' && (unseated.length > 0 || mode === 'arrange') && (
        <div className={`seat-unseated${mode === 'arrange' ? ' arrange' : ''}`} onClick={mode === 'arrange' ? tapUnseatedStrip : undefined}>
          <div className="seat-unseated-label">
            No seat ({unseated.length})
            {mode === 'view' && deskToStudent.size === 0 && <span className="seat-unseated-tip"> — tap “Arrange seats” to seat the class</span>}
          </div>
          <div className="seat-unseated-list">
            {unseated.map((s) =>
              mode === 'arrange' ? (
                <button
                  key={s.id}
                  className={`seat-chip${s.id === pickedStudentId ? ' selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPickedStudentId((cur) => (cur === s.id ? null : s.id));
                  }}
                >
                  {s.name}
                </button>
              ) : (
                // Same size and scale as a card on a desk, so the strip
                // matches the room instead of towering over it.
                <div key={s.id} className={`seat-unseated-card${matchesSearch(s) ? '' : ' dim'}`} style={{ width: DESK_W * scale, height: DESK_H * scale }}>
                  <div className="seat-desk view" style={{ width: DESK_W, height: DESK_H, transform: `scale(${scale})` }}>
                    {renderCard(s)}
                  </div>
                </div>
              ),
            )}
            {mode === 'arrange' && unseated.length === 0 && <span className="seat-unseated-tip">Everyone has a seat.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
