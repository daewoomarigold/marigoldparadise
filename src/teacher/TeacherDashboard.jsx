// Teacher dashboard — ported from the old teacher.html (gotchigarden repo),
// core roster + points loop only for this first pass. Left out on purpose,
// to be ported later: prices panel, seating plan designer, photo/card
// export. CSV roster import and Google auth were originally on this list
// too — see parseClassCsv below and src/auth/useAuth.js — both since done.
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
// -10/-1/+1/+10 controls and the number input below all edit that, not
// the confirmed total) since the island often isn't visible while class
// is happening, so nothing about a pet should change until Taylor wants
// it to. distributeAll below applies everything queued at once — see
// useClassroomStore.js's distributeClass and StudentGrid.jsx's reveal
// animation (the coin rain + evolution playback that reacts to it).

import { useRef, useState } from 'react';
import './teacher.css';
import { newStudentProgress, meterFraction, findTamaName, POINTS_PER_GROWTH } from '../game/growth.js';
import { spriteUrl } from '../game/spriteData.js';
import { playAddPoint } from '../sound.js';
import { useAuth } from '../auth/useAuth.js';
import { useClassroomStore } from '../data/useClassroomStore.js';
import LoginScreen from '../auth/LoginScreen.jsx';

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

  function selectClass(id) {
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
    toast('Student removed');
  }

  // Thin wrapper so the rest of this file can keep calling setPendingPts
  // by id (matches the input/button handlers below) — the store itself
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

  async function awardAll(sign) {
    const amt = Math.max(1, Number(awardAmount) || 1) * sign;
    if (sign > 0) playAddPoint();
    await store.awardAllPendingPts(students, sign, awardAmount);
    toast(sign > 0 ? `Queued ${amt} pts for everyone` : `Queued a ${Math.abs(amt)}-pt deduction for everyone`);
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
                <div className="teacher-btn-flex" />
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
              </div>

              {filteredStudents.length === 0 ? (
                <div className="teacher-empty-state">
                  <div className="teacher-empty-text">
                    {search ? 'No students match your search' : 'No students yet — add one to get started'}
                  </div>
                </div>
              ) : (
                <div className="teacher-student-grid">
                  {filteredStudents.map((s) => (
                    <div className="teacher-student-card" key={s.id}>
                      <div className="teacher-student-name">{s.name}</div>
                      <div className="teacher-confirmed-pts" title="Confirmed total — won't move until Distribute">
                        <img src={COIN_URL} alt="" className="teacher-coin-icon" />
                        {s.gotchiPts}
                        {(s.pendingPts ?? 0) !== 0 && (
                          <span className="teacher-pending-badge">
                            {s.pendingPts > 0 ? `+${s.pendingPts}` : s.pendingPts} pending
                          </span>
                        )}
                      </div>
                      <div className="teacher-pts-controls">
                        <button className="teacher-pts-btn minus" onClick={() => nudgePendingPts(s, -10)} title="-10">
                          −10
                        </button>
                        <button className="teacher-pts-btn minus" onClick={() => nudgePendingPts(s, -1)} title="-1">
                          −1
                        </button>
                        <input
                          className="teacher-pts-input"
                          type="number"
                          value={s.pendingPts ?? 0}
                          onChange={(e) => setPendingPts(s.id, e.target.value)}
                          title="Pending — queued until Distribute"
                        />
                        <button className="teacher-pts-btn plus" onClick={() => nudgePendingPts(s, 1)} title="+1">
                          +1
                        </button>
                        <button className="teacher-pts-btn plus" onClick={() => nudgePendingPts(s, 10)} title="+10">
                          +10
                        </button>
                      </div>
                      <GrowthStatus student={s} onSetDisplayTama={(tamaId) => store.setDisplayTama(s.id, tamaId)} />
                      <button className="teacher-student-remove" onClick={() => removeStudent(s)}>
                        ✕ Remove
                      </button>
                    </div>
                  ))}
                </div>
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
                  <button className="teacher-btn yellow" onClick={() => awardAll(1)}>
                    ★ Award
                  </button>
                  <button className="teacher-btn red" onClick={() => awardAll(-1)}>
                    − Deduct
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

// Falls back to a fresh (0-progress) growth record for students saved
// before growth tracking existed, so old data doesn't crash the
// dashboard — doesn't persist the fallback, just renders safely.
function GrowthStatus({ student, onSetDisplayTama }) {
  const growth = student.growth ?? newStudentProgress();
  const fraction = meterFraction(growth, student.lifetimePts ?? student.gotchiPts);
  const { stage, name } = growth.currentTama;

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
      {growth.tamadex.length > 0 && (
        <select
          className="teacher-display-tama-select"
          value={displayTamaId}
          onChange={(e) => onSetDisplayTama(e.target.value === 'current' ? 'current' : Number(e.target.value))}
        >
          <option value="current">Currently growing ({stage} · {name})</option>
          {growth.tamadex.map((tamaId) => (
            <option key={tamaId} value={tamaId}>
              {findTamaName(tamaId) ?? `#${tamaId}`}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
