// Teacher dashboard — ported from the old teacher.html (gotchigarden repo),
// core roster + points loop only for this first pass. Left out on purpose,
// to be ported later: prices panel, photo/card export. CSV roster import,
// Google auth and seating were originally on this list too — see
// parseClassCsv below, src/auth/useAuth.js and SeatingMap.jsx — all since
// done (seating as a fixed shared room layout + per-class seats rather
// than the old per-class plan designer; see seating.js).
//
// Data layer is Supabase (see src/data/useClassroomStore.js and
// supabase/schema.sql) — this file just calls that hook's mutation
// functions and renders whatever it returns; no storage/sync code lives
// here anymore.
//
// gotchiPts vs lifetimePts: gotchiPts is a spendable currency balance —
// it goes up on award and down on deduction/spend (a future item shop
// spends this same balance). lifetimePts is the total ever earned and
// only ever goes up; it's what actually drives the growth meter
// (growth.js's applyPointsToGrowth/meterFraction), so deducting or
// spending gotchiPts can never shrink or un-advance a pet's growth — see
// useClassroomStore.js's applyPtsChange for exactly how the two stay in
// sync (moved there since it's now the thing actually writing points).
//
// "Tama Time" — points given during class don't touch gotchiPts/
// lifetimePts/growth at all anymore; they queue in pendingPts (the
// +1 buttons below — per student, per group, and Award All — all add to
// that, not the confirmed total) since the island often isn't visible while class
// is happening, so nothing about a pet should change until Taylor wants
// it to. distributeAll below applies everything queued at once — see
// useClassroomStore.js's distributeClass and StudentGrid.jsx's reveal
// animation (the coin rain + evolution playback that reacts to it).

import { useRef, useState } from 'react';
import './teacher.css';
import { newStudentProgress, meterFraction, findTamaName, allBabiesAndToddlers, visitedEarlyStageIds, POINTS_PER_GROWTH } from '../game/growth.js';
import { spriteUrl } from '../game/spriteData.js';
import { playAddPoint } from '../sound.js';
import { useAuth } from '../auth/useAuth.js';
import { useClassroomStore } from '../data/useClassroomStore.js';
import LoginScreen from '../auth/LoginScreen.jsx';
import SeatingMap from './SeatingMap.jsx';
import { DEFAULT_ROOM_LAYOUT } from './seating.js';

// Seats vs grid is a per-device preference (the iPad at the front of the
// room may want seats while a laptop at home wants the grid), so it lives
// in localStorage rather than Supabase. Wrapped since storage can throw
// (private browsing).
const VIEW_KEY = 'marigold.teacherView';
function loadView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'seats';
  } catch {
    return 'seats';
  }
}
function saveView(view) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // not worth surfacing — the toggle still works for this session
  }
}

// Same coin icon StudentGrid.jsx uses for its pts readout — reused here
// for the pending badge so the two pages speak the same visual language.
const COIN_URL = spriteUrl('image-95.png');

// Splits one CSV line into fields, honoring double-quoted fields (so a
// quoted name like "Lee, Grace" doesn't get cut in half) and "" as an
// escaped quote inside one. The old teacher.html's parser just did
// line.split(','), which breaks on real school-exported sheets more often
// than you'd like — this is the one deliberate improvement over a literal
// port.
function splitCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

// Parses a class roster CSV — same column semantics as the old
// teacher.html's parseCSV (see that repo): headers matched case-
// insensitively, a row skipped only when an Active column exists and
// isn't "yes" (no Active column at all -> everyone's imported), the class
// name synthesized from Grade + English Class. One CSV = one class, same
// as before. UUID, if present, becomes the student's id (so re-importing
// the same roster elsewhere would line up, and lines up with
// useClassroomStore's createCsvClass inserting it explicitly) — otherwise
// Supabase generates one. Returns { error } on anything unusable, or
// { className, students } — never both.
function parseClassCsv(text) {
  const lines = text
    .replace(/^﻿/, '') // strip BOM
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return { error: 'That CSV has no data rows.' };

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const colIndex = (name) => headers.indexOf(name);
  const idx = {
    uuid: colIndex('uuid'),
    name: colIndex('name'),
    grade: colIndex('grade'),
    engClass: colIndex('english class'),
    active: colIndex('active'),
  };
  if (idx.name < 0) return { error: 'That CSV needs a "Name" column.' };

  let grade = '';
  let engClass = '';
  const students = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    if (idx.active >= 0 && (cols[idx.active] ?? '').toLowerCase() !== 'yes') continue;
    const name = (cols[idx.name] ?? '').trim();
    if (!name) continue;
    grade = cols[idx.grade] || grade;
    engClass = cols[idx.engClass] || engClass;
    const rawId = idx.uuid >= 0 ? cols[idx.uuid] : '';
    students.push({ id: rawId || undefined, name });
  }
  if (students.length === 0) return { error: 'No active students found in that CSV.' };

  const nameParts = [];
  if (grade) nameParts.push(`Grade ${grade}`);
  if (engClass) nameParts.push(engClass);
  return { className: nameParts.join(' — '), students };
}

export default function TeacherDashboard() {
  const auth = useAuth();
  // Called unconditionally regardless of auth state (rules of hooks) —
  // the hook itself no-ops until there's a real session (see its header
  // comment), so this is safe even before sign-in.
  const store = useClassroomStore(auth.session);

  const [search, setSearch] = useState('');
  // The class list lives in a slide-out drawer (opened from the header's
  // menu button) instead of a permanent left column, so the student cards
  // get the full width on an iPad — see teacher.css's .teacher-sidebar.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Which student's details modal (full growth status, display-tama picker,
  // remove) is open, if any — moved off the cards themselves so a whole
  // class's worth of them fits on screen without scrolling.
  const [detailStudentId, setDetailStudentId] = useState(null);
  const [showNewClassForm, setShowNewClassForm] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [csvPreview, setCsvPreview] = useState(null); // { className, students } once a CSV's been parsed, until confirmed/cancelled
  const [csvImportName, setCsvImportName] = useState(''); // editable in the preview — the parsed className is just a starting suggestion
  const csvInputRef = useRef(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentPts, setNewStudentPts] = useState(0);
  const [showAwardBanner, setShowAwardBanner] = useState(false);
  const [awardAmount, setAwardAmount] = useState(1);
  const [view, setView] = useState(loadView); // 'seats' | 'grid'
  // Seats view only: 'view' (normal), 'arrange' (who sits where), 'edit'
  // (move the desks themselves) — see SeatingMap.jsx.
  const [seatMode, setSeatMode] = useState('view');
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  function toast(msg) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2200);
  }

  if (auth.loading) return <LoadingScreen text="Signing in…" />;
  if (!auth.session) return <LoginScreen onSignIn={auth.signInWithGoogle} error={auth.error} />;
  if (store.loading) return <LoadingScreen text="Loading your classes…" />;

  const { classes, students: allStudents, currentClassId } = store;
  const currentClass = classes.find((c) => c.id === currentClassId) ?? null;
  const students = allStudents.filter((s) => s.classId === currentClassId);
  const detailStudent = students.find((s) => s.id === detailStudentId) ?? null;
  const filteredStudents = students.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase()),
  );

  const studentCount = students.length;
  const topPts = studentCount ? Math.max(...students.map((s) => s.gotchiPts)) : 0;
  const avgPts = studentCount ? Math.round(students.reduce((sum, s) => sum + s.gotchiPts, 0) / studentCount) : 0;
  const pendingStudentCount = students.filter((s) => (s.pendingPts ?? 0) !== 0).length;

  async function createClass() {
    const name = newClassName.trim();
    if (!name) return;
    const cls = await store.createClass(name);
    if (!cls) return;
    await store.selectClass(cls.id);
    setNewClassName('');
    setShowNewClassForm(false);
    setSearch('');
    setSidebarOpen(false);
    toast(`Created ${name}`);
  }

  function changeView(next) {
    setView(next);
    saveView(next);
    setSeatMode('view');
  }

  function selectClass(id) {
    setSeatMode('view');
    store.selectClass(id);
    setSearch('');
    setSidebarOpen(false);
  }

  async function deleteClass(cls) {
    const clsStudentCount = allStudents.filter((s) => s.classId === cls.id).length;
    if (!confirm(`Delete "${cls.name}" and all ${clsStudentCount} of its students? This cannot be undone.`)) return;
    const remaining = classes.filter((c) => c.id !== cls.id);
    await store.deleteClass(cls);
    if (currentClassId === cls.id) {
      await store.selectClass(remaining[0]?.id ?? null);
      setSearch('');
    }
    toast(`Deleted ${cls.name}`);
  }

  // Opens the OS file picker (the actual <input type="file"> stays hidden
  // — see the sidebar's "Import CSV" button, which just clicks this ref).
  function openImportCsv() {
    csvInputRef.current?.click();
  }

  // Reads + parses the picked file and opens the preview modal on success.
  // Doesn't create anything yet — that's confirmImportCsv, so a teacher
  // can fix up the class name or back out first.
  function handleCsvFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // clears the input so picking the same file again still fires onChange
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = parseClassCsv(String(ev.target.result ?? ''));
      if (result.error) {
        toast(`⚠ ${result.error}`);
        return;
      }
      setCsvPreview(result);
      // Suggest the filename (minus .csv) when the sheet didn't have
      // Grade/English Class columns to synthesize a name from.
      setCsvImportName(result.className || file.name.replace(/\.csv$/i, ''));
    };
    reader.onerror = () => toast('⚠ Could not read that file');
    reader.readAsText(file);
  }

  function cancelImportCsv() {
    setCsvPreview(null);
  }

  async function confirmImportCsv() {
    if (!csvPreview) return;
    const name = csvImportName.trim() || 'Imported Class';
    const result = await store.createCsvClass(name, csvPreview.students);
    if (!result) return;
    await store.selectClass(result.classId);
    setCsvPreview(null);
    setSearch('');
    setSidebarOpen(false);
    toast(`Imported ${name} with ${result.count} students`);
  }

  function openAddStudent() {
    setNewStudentName('');
    setNewStudentEmail('');
    setNewStudentPts(0);
    setShowAddStudent(true);
  }

  async function createStudent() {
    const name = newStudentName.trim();
    if (!name) return;
    await store.createStudent(currentClassId, { name, email: newStudentEmail, startingPts: newStudentPts });
    setShowAddStudent(false);
    toast(`Added ${name}`);
  }

  async function removeStudent(student) {
    if (!confirm(`Remove ${student.name}? This cannot be undone.`)) return;
    await store.removeStudent(student.id);
    setDetailStudentId(null);
    toast('Student removed');
  }

  // Thin wrapper so the rest of this file can keep calling setPendingPts
  // by id (matches the +1 button handler below) — the store itself
  // just needs the student object, for its id. Also the single choke
  // point for the dashboard's own audio cue: an immediate playAddPoint()
  // right when Taylor queues points, distinct from (and in addition to)
  // the island's rapid coin-rain cascade that plays later at Distribute —
  // this one's just "did my tap register," so it only fires on an actual
  // increase, not a deduction, and doesn't wait for any realtime
  // round-trip (unlike the old pre-pending design, which reacted to
  // gotchiPts changing over realtime — this reacts to the click itself).
  function setPendingPts(studentId, newPending) {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    if (Math.trunc(Number(newPending) || 0) > (student.pendingPts ?? 0)) playAddPoint();
    store.setPendingPts(student, newPending);
  }

  function nudgePendingPts(student, delta) {
    setPendingPts(student.id, (student.pendingPts ?? 0) + delta);
  }

  // Award-only — Taylor doesn't take points away, so there's no deduct
  // counterpart (the store's awardAllPendingPts still takes a sign, it's
  // just always +1 from here).
  async function awardAll() {
    const amt = Math.max(1, Number(awardAmount) || 1);
    playAddPoint();
    await store.awardAllPendingPts(students, 1, awardAmount);
    toast(`Queued ${amt} pts for everyone`);
  }

  // A pod's "Group N +1" button (SeatingMap.jsx) — +1 pending for everyone
  // seated in that group right now. One sound for the whole group, not one
  // per student.
  async function awardGroup(members, group) {
    if (members.length === 0) return;
    playAddPoint();
    await Promise.all(members.map((s) => store.setPendingPts(s, (s.pendingPts ?? 0) + 1)));
    toast(`Group ${group} +1 (${members.length} student${members.length === 1 ? '' : 's'})`);
  }

    // "Tama Time" — applies every queued pendingPts at once (see
  // useClassroomStore.js's distributeClass) and clears it. The reveal
  // itself (coin rain + any evolution) plays on the island
  // (StudentGrid.jsx), reacting to the same write — nothing to trigger
  // from here beyond the write itself.
  async function distributeAll() {
    const pendingCount = students.filter((s) => (s.pendingPts ?? 0) !== 0).length;
    if (pendingCount === 0) return;
    if (!confirm(`Distribute queued points for ${pendingCount} student${pendingCount === 1 ? '' : 's'}? This plays the reveal on the island.`)) return;
    await store.distributeClass(students);
    toast('Distributed — check the island for the reveal');
  }

  // One student's card — shared by the grid and the seating view (which
  // places the same card on that student's desk).
  function renderCard(s) {
    return (
      <StudentCard
        key={s.id}
        student={s}
        onOpenDetails={() => setDetailStudentId(s.id)}
        onNudge={() => nudgePendingPts(s, 1)}
      />
    );
  }

  return (
    <div className="teacher-root">
      <header className="teacher-header">
        <button className="teacher-menu-btn" onClick={() => setSidebarOpen((o) => !o)} aria-expanded={sidebarOpen}>
          ☰ Classes
        </button>
        <div className="teacher-logo">★ MARIGOLD CORE</div>
        <div className="teacher-hdr-sep" />
        <div className="teacher-hdr-class-label">{currentClass ? currentClass.name : 'No class selected'}</div>
        <div className="teacher-btn-flex" />
        <div className="teacher-hdr-email">{auth.session.user.email}</div>
        <button className="teacher-btn" onClick={auth.signOut}>
          Sign out
        </button>
      </header>

      <div className="teacher-main-layout">
        {sidebarOpen && <div className="teacher-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
        <div className={`teacher-sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="teacher-sidebar-section">
            <div className="teacher-sidebar-head">Classes</div>
            {classes.map((cls) => (
              <div className="teacher-class-row" key={cls.id}>
                <button
                  className={`teacher-class-btn${cls.id === currentClassId ? ' active' : ''}`}
                  onClick={() => selectClass(cls.id)}
                >
                  {cls.name}
                </button>
                <button className="teacher-class-delete-btn" title={`Delete ${cls.name}`} onClick={() => deleteClass(cls)}>
                  ✕
                </button>
              </div>
            ))}

            {showNewClassForm ? (
              <div className="teacher-new-class-form">
                <input
                  type="text"
                  placeholder="Class name"
                  value={newClassName}
                  autoFocus
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createClass();
                    if (e.key === 'Escape') setShowNewClassForm(false);
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="teacher-btn green" style={{ flex: 1 }} onClick={createClass}>
                    Create
                  </button>
                  <button className="teacher-btn" onClick={() => setShowNewClassForm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button className="teacher-btn-new-class" onClick={() => setShowNewClassForm(true)}>
                  + New Class
                </button>
                <button className="teacher-btn-new-class import" onClick={openImportCsv}>
                  ↑ Import CSV
                </button>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={handleCsvFileChange}
                />
              </>
            )}
          </div>

          {currentClass && (
            <div className="teacher-sidebar-stats">
              <div className="teacher-sidebar-head">Class Stats</div>
              <div className="teacher-stat-row">
                <span className="teacher-stat-label">Students</span>
                <span className="teacher-stat-value">{studentCount}</span>
              </div>
              <div className="teacher-stat-row">
                <span className="teacher-stat-label">Top pts</span>
                <span className="teacher-stat-value">{topPts}</span>
              </div>
              <div className="teacher-stat-row">
                <span className="teacher-stat-label">Avg pts</span>
                <span className="teacher-stat-value">{avgPts}</span>
              </div>
            </div>
          )}
        </div>

        <div className="teacher-content">
          {!currentClass ? (
            <div className="teacher-empty-state">
              <div className="teacher-empty-icon">★</div>
              <div className="teacher-empty-text">Select or create a class to begin</div>
            </div>
          ) : (
            <>
              <div className="teacher-toolbar">
                <input
                  type="text"
                  placeholder="Search students..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="teacher-view-toggle" role="group" aria-label="Layout">
                  <button className={view === 'seats' ? 'active' : ''} onClick={() => changeView('seats')}>
                    🪑 Seats
                  </button>
                  <button className={view === 'grid' ? 'active' : ''} onClick={() => changeView('grid')}>
                    ▦ Grid
                  </button>
                </div>
                {view === 'seats' && seatMode === 'view' && (
                  <>
                    <button className="teacher-btn" onClick={() => setSeatMode('arrange')}>
                      Arrange seats
                    </button>
                    <button className="teacher-btn" onClick={() => setSeatMode('edit')}>
                      Edit room
                    </button>
                  </>
                )}
                <div className="teacher-btn-flex" />
                {seatMode === 'view' && (
                  <>
                    <button className="teacher-btn green" onClick={openAddStudent}>
                      + Add Student
                    </button>
                    <button className="teacher-btn yellow" onClick={() => setShowAwardBanner(true)}>
                      ★ Award All
                    </button>
                    <button
                      className="teacher-btn yellow"
                      onClick={distributeAll}
                      disabled={pendingStudentCount === 0}
                      title={pendingStudentCount === 0 ? 'Nothing queued yet' : `${pendingStudentCount} student${pendingStudentCount === 1 ? '' : 's'} queued`}
                    >
                      🎉 Distribute{pendingStudentCount > 0 ? ` (${pendingStudentCount})` : ''}
                    </button>
                  </>
                )}
              </div>

              {view === 'seats' ? (
                <SeatingMap
                  layout={store.roomLayout ?? DEFAULT_ROOM_LAYOUT}
                  seating={currentClass.seating}
                  students={students}
                  search={search}
                  mode={seatMode}
                  onModeChange={setSeatMode}
                  renderCard={renderCard}
                  onSeatingChange={(seating) => store.setClassSeating(currentClass.id, seating)}
                  onLayoutChange={store.saveRoomLayout}
                  onAwardGroup={awardGroup}
                />
              ) : filteredStudents.length === 0 ? (
                <div className="teacher-empty-state">
                  <div className="teacher-empty-text">
                    {search ? 'No students match your search' : 'No students yet — add one to get started'}
                  </div>
                </div>
              ) : (
                <div className="teacher-student-grid">{filteredStudents.map(renderCard)}</div>
              )}

              {showAwardBanner && (
                <div className="teacher-award-banner">
                  <label>Award all students:</label>
                  <input
                    type="number"
                    value={awardAmount}
                    min={1}
                    max={9999}
                    onChange={(e) => setAwardAmount(e.target.value)}
                  />
                  <label>pts</label>
                  <button className="teacher-btn yellow" onClick={awardAll}>
                    ★ Award
                  </button>
                  <div className="teacher-btn-flex" />
                  <button className="teacher-btn" onClick={() => setShowAwardBanner(false)}>
                    ✕
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAddStudent && (
        <div className="teacher-modal-backdrop open" onClick={(e) => e.target === e.currentTarget && setShowAddStudent(false)}>
          <div className="teacher-modal">
            <div className="teacher-modal-title">Add Student</div>
            <div className="teacher-field">
              <label>Name *</label>
              <input
                type="text"
                placeholder="e.g. Alice"
                value={newStudentName}
                autoFocus
                onChange={(e) => setNewStudentName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createStudent()}
              />
            </div>
            <div className="teacher-field">
              <label>Email (optional)</label>
              <input
                type="text"
                placeholder="student@school.com"
                value={newStudentEmail}
                onChange={(e) => setNewStudentEmail(e.target.value)}
              />
            </div>
            <div className="teacher-field">
              <label>Starting GotchiPts</label>
              <input type="number" min={0} value={newStudentPts} onChange={(e) => setNewStudentPts(e.target.value)} />
            </div>
            <div className="teacher-modal-btns">
              <button className="teacher-btn" onClick={() => setShowAddStudent(false)}>
                Cancel
              </button>
              <button className="teacher-btn green" onClick={createStudent}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {csvPreview && (
        <div className="teacher-modal-backdrop open" onClick={(e) => e.target === e.currentTarget && cancelImportCsv()}>
          <div className="teacher-modal">
            <div className="teacher-modal-title">Import CSV</div>
            <div className="teacher-field">
              <label>Class Name</label>
              <input type="text" value={csvImportName} autoFocus onChange={(e) => setCsvImportName(e.target.value)} />
            </div>
            <div className="teacher-csv-summary">
              <strong>{csvPreview.students.length}</strong> active student{csvPreview.students.length === 1 ? '' : 's'} found:
            </div>
            <div className="teacher-csv-list">
              {csvPreview.students.map((s, i) => (
                <div className="teacher-csv-row" key={s.id ?? i}>
                  {s.name}
                </div>
              ))}
            </div>
            <div className="teacher-modal-btns">
              <button className="teacher-btn" onClick={cancelImportCsv}>
                Cancel
              </button>
              <button className="teacher-btn green" onClick={confirmImportCsv}>
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {detailStudent && (
        <div className="teacher-modal-backdrop open" onClick={(e) => e.target === e.currentTarget && setDetailStudentId(null)}>
          <div className="teacher-modal">
            <div className="teacher-modal-title">{detailStudent.name}</div>
            <GrowthStatus student={detailStudent} onSetDisplayTama={(tamaId) => store.setDisplayTama(detailStudent.id, tamaId)} />
            <div className="teacher-modal-btns" style={{ justifyContent: 'space-between' }}>
              <button className="teacher-student-remove" onClick={() => removeStudent(detailStudent)}>
                ✕ Remove student
              </button>
              <button className="teacher-btn" onClick={() => setDetailStudentId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div id="teacher-toast" className={toastMsg || store.error ? 'show' : ''}>
        {store.error ? `⚠ ${store.error}` : toastMsg}
      </div>
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

function StudentCard({ student: s, onOpenDetails, onNudge }) {
  return (
    <div className="teacher-student-card">
      <button className="teacher-student-name" onClick={onOpenDetails} title="Details">
        <span className="teacher-student-name-text">{s.name}</span>
        <span className="teacher-student-more">⋯</span>
      </button>
      <div className="teacher-confirmed-pts" title="Confirmed total — won't move until Distribute">
        <img src={COIN_URL} alt="" className="teacher-coin-icon" />
        {s.gotchiPts}
        {(s.pendingPts ?? 0) !== 0 && (
          <span className="teacher-pending-badge">
            {s.pendingPts > 0 ? `+${s.pendingPts}` : s.pendingPts} pending
          </span>
        )}
      </div>
      {/* Just +1, next to a running tally of what's been queued this lesson. Taylor's deliberately conservative with points and doesn't take them away, so no +10/-1/-10, and no typed amounts either. */}
      <div className="teacher-pts-controls">
        <div className="teacher-pts-pending" title="Queued this lesson — lands at Distribute">
          {s.pendingPts ?? 0}
        </div>
        <button className="teacher-pts-btn plus" onClick={onNudge} title="+1">
          +1
        </button>
      </div>
      <CompactGrowth student={s} />
    </div>
  );
}

// The one-line version of GrowthStatus shown on each card (stage/name +
// meter) — everything else (display tama, picker) lives in the details modal.
function CompactGrowth({ student }) {
  const growth = student.growth ?? newStudentProgress();
  const fraction = meterFraction(growth, student.lifetimePts ?? student.gotchiPts);
  const { stage, name } = growth.currentTama;
  return (
    <div className="teacher-growth-status">
      <div className="teacher-growth-label">
        {stage} · {name}
      </div>
      <div className="teacher-growth-meter" title={`${Math.round(fraction * POINTS_PER_GROWTH)}/${POINTS_PER_GROWTH} pts to next stage`}>
        <div className="teacher-growth-meter-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}

// Falls back to a fresh (0-progress) growth record for students saved
// before growth tracking existed, so old data doesn't crash the
// dashboard — doesn't persist the fallback, just renders safely.
function GrowthStatus({ student, onSetDisplayTama }) {
  const growth = student.growth ?? newStudentProgress();
  const fraction = meterFraction(growth, student.lifetimePts ?? student.gotchiPts);
  const { stage, name } = growth.currentTama;
  const visitedEarly = visitedEarlyStageIds({ growth });

  const displayTamaId = student.displayTamaId ?? 'current';
  const displayName = displayTamaId === 'current' ? name : (findTamaName(displayTamaId) ?? name);

  return (
    <div className="teacher-growth-status">
      <div className="teacher-growth-label">
        {stage} · {name}
      </div>
      <div className="teacher-growth-meter" title={`${Math.round(fraction * POINTS_PER_GROWTH)}/${POINTS_PER_GROWTH} pts to next stage`}>
        <div className="teacher-growth-meter-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
      <div className="teacher-display-tama">Current Display Tama: {displayName}</div>
      <select
        className="teacher-display-tama-select"
        value={displayTamaId}
        onChange={(e) => onSetDisplayTama(e.target.value === 'current' ? 'current' : Number(e.target.value))}
      >
        <option value="current">Currently growing ({stage} · {name})</option>
        {/* Only forms this student has actually reached — see growth.js's
            visitedEarlyStageIds, the same gate TamadexToast.jsx's picker
            uses; a toddler they haven't grown into yet isn't listed just
            because every student could technically reach it eventually. */}
        {allBabiesAndToddlers().some((t) => visitedEarly.has(t.tamaId)) && (
          <optgroup label="Baby & toddler forms">
            {allBabiesAndToddlers()
              .filter((t) => visitedEarly.has(t.tamaId))
              .map((t) => (
                <option key={t.tamaId} value={t.tamaId}>
                  {t.name}
                </option>
              ))}
          </optgroup>
        )}
        {growth.tamadex.length > 0 && (
          <optgroup label="Adults">
            {growth.tamadex.map((tamaId) => (
              <option key={tamaId} value={tamaId}>
                {findTamaName(tamaId) ?? `#${tamaId}`}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
