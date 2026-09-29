// Popup shown when a student's tile is clicked — a small sidebar of tabs
// (Tamadex / Gotchi Shop / My Bag) next to whichever one's content is
// active. Tamadex is the only one built out so far (see TamadexTab below);
// Shop and Bag are placeholders for now, per the request that added them
// — real content (prices/an item shop, an inventory) is a separate,
// unscoped follow-up.
//
// Tamadex tab: a numbered grid of all 48 regular adults (no secrets, per
// the request that added this: "a numerical list of all adult tamas"),
// plus a small row of the early-stage forms (the 1 baby + 3 toddlers —
// see growth.js's allBabiesAndToddlers) above it. Both sections gate the
// same way: collected adults (growth.tamadex) / reached early stages
// (growth.js's visitedEarlyStageIds) show in normal color; anything not
// yet reached shows the same sprite silhouetted black via a CSS filter,
// so the shape/name is visible as a "not yet found" placeholder rather
// than a blank slot — a toddler a student hasn't actually grown into yet
// can't be picked just because every student could technically reach it
// eventually.
//
// Clicking a reached early stage OR a collected adult sets it as the
// student's display tama (the one shown roaming on the island field — see
// growth.js's resolveDisplayTama). The current display tama is highlighted
// yellow with a star, in whichever section it's actually in. Anything not
// yet reached/collected isn't clickable — nothing to display.

import { useState } from 'react';
import { allAdults, allBabiesAndToddlers, findTamaName, resolveDisplayTama, visitedEarlyStageIds } from '../game/growth.js';
import { TamaComposite } from '../game/spriteCompositor.jsx';

const CELL_SCALE = 1.5; // mini sprites are 32x32 native

const TABS = [
  { id: 'tamadex', label: 'Tamadex' },
  { id: 'shop', label: 'Gotchi Shop' },
  { id: 'bag', label: 'My Bag' },
];

export default function TamadexToast({ student, onSelectDisplay, onClose }) {
  const [activeTab, setActiveTab] = useState('tamadex');

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={titleStyle}>{student.name}&rsquo;s Options</div>
          <button style={closeBtnStyle} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={bodyStyle}>
          <div style={sidebarStyle}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                style={{ ...tabBtnStyle, ...(activeTab === tab.id ? tabBtnActiveStyle : null) }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={contentStyle}>
            {activeTab === 'tamadex' && <TamadexTab student={student} onSelectDisplay={onSelectDisplay} />}
            {activeTab === 'shop' && <ComingSoon label="Gotchi Shop" />}
            {activeTab === 'bag' && <ComingSoon label="My Bag" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComingSoon({ label }) {
  return <div style={comingSoonStyle}>🚧 {label} — coming soon.</div>;
}

function TamadexTab({ student, onSelectDisplay }) {
  const earlyStages = allBabiesAndToddlers();
  const adults = allAdults();
  const collected = new Set(student.growth.tamadex);
  const visitedEarly = visitedEarlyStageIds(student);
  const collectedCount = adults.filter((a) => collected.has(a.tamaId)).length;
  const currentDisplayTamaId = resolveDisplayTama(student).tamaId;

  return (
    <div>
      <div style={countStyle}>
        {collectedCount}/{adults.length} adults collected
      </div>
      <div style={sectionLabelStyle}>Baby &amp; toddler forms</div>
      <div style={{ ...gridStyle, marginBottom: 14 }}>
        {earlyStages.map((t) => {
          const got = visitedEarly.has(t.tamaId);
          const isDisplayed = got && t.tamaId === currentDisplayTamaId;
          return (
            <div
              key={t.tamaId}
              role={got ? 'button' : undefined}
              style={{
                ...cellStyle,
                ...(isDisplayed ? cellSelectedStyle : null),
                cursor: got ? 'pointer' : 'default',
              }}
              title={got ? t.name : '???'}
              onClick={got ? () => onSelectDisplay(t.tamaId) : undefined}
            >
              <div style={numStyle}>{isDisplayed && <span style={starStyle}>★</span>}</div>
              <div style={{ filter: got ? 'none' : 'brightness(0)', opacity: got ? 1 : 0.6 }}>
                <TamaComposite tamaId={t.tamaId} variant="mini" frames={{ body: 0, eyes: 0, mouth: 0 }} scale={CELL_SCALE} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={sectionLabelStyle}>Adults</div>
      <div style={gridStyle}>
        {adults.map((a, i) => {
          const got = collected.has(a.tamaId);
          const isDisplayed = got && a.tamaId === currentDisplayTamaId;
          return (
            <div
              key={a.tamaId}
              role={got ? 'button' : undefined}
              style={{
                ...cellStyle,
                ...(isDisplayed ? cellSelectedStyle : null),
                cursor: got ? 'pointer' : 'default',
              }}
              title={got ? findTamaName(a.tamaId) : '???'}
              onClick={got ? () => onSelectDisplay(a.tamaId) : undefined}
            >
              <div style={numStyle}>
                {isDisplayed && <span style={starStyle}>★</span>}
                {i + 1}
              </div>
              <div style={{ filter: got ? 'none' : 'brightness(0)', opacity: got ? 1 : 0.6 }}>
                <TamaComposite tamaId={a.tamaId} variant="mini" frames={{ body: 0, eyes: 0, mouth: 0 }} scale={CELL_SCALE} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const backdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(10, 4, 20, 0.85)',
  backdropFilter: 'blur(3px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 200,
  padding: 16,
};

const cardStyle = {
  background: '#1a1a2e',
  border: '1px solid #4a4a7a',
  borderRadius: 10,
  padding: 20,
  // Min-width AND min-height (not fixed ones) so the card stays a stable
  // size across tab switches instead of shrinking down for the
  // near-empty Shop/Bag placeholders — sized to comfortably fit the
  // Tamadex tab's 8-column adult grid alongside the sidebar, its tallest
  // and widest content. Width alone wasn't enough — Tamadex's several
  // grid rows vs. Shop/Bag's one line of text is a HEIGHT difference
  // mostly, not a width one.
  minWidth: 700,
  minHeight: 620,
  maxWidth: '90vw',
  maxHeight: '85vh',
  fontFamily: 'ui-monospace, monospace',
  color: '#e0e0f0',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 14,
};

const titleStyle = {
  fontSize: 13,
  letterSpacing: 0.5,
  flex: 1,
};

// Fills whatever's left of cardStyle's height below the header (cardStyle
// is a column flex container so this flex:1 has somewhere to grow into),
// so the sidebar and content pane both stretch to the card's full height
// (flex's default align-items:stretch) regardless of which tab is active
// — otherwise a short "coming soon" tab would only reserve blank space
// below it rather than actually filling the space.
const bodyStyle = {
  display: 'flex',
  gap: 16,
  flex: 1,
  minHeight: 0, // lets contentStyle's own overflow:auto work inside a flex column
};

// Fixed width, doesn't scroll with the content panel — see contentStyle.
const sidebarStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  width: 120,
  flexShrink: 0,
};

const tabBtnStyle = {
  background: 'none',
  border: '1px solid #2e2e4e',
  color: '#a0a0c0',
  borderRadius: 6,
  padding: '8px 10px',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
};

const tabBtnActiveStyle = {
  border: '1px solid #4ef0d8',
  background: 'rgba(78, 240, 216, 0.1)',
  color: '#e0e0f0',
};

// The only part that scrolls — the sidebar stays put alongside it. Fills
// the full height bodyStyle gives it (stretch, see that style's comment),
// so ComingSoon's own centering below has real space to center within
// instead of just sitting at the top.
const contentStyle = {
  flex: 1,
  minWidth: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

const comingSoonStyle = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#7070a0',
  fontSize: 12,
  textAlign: 'center',
};

const countStyle = {
  fontSize: 12,
  color: '#ffe066',
  marginBottom: 10,
};

const sectionLabelStyle = {
  fontSize: 10,
  color: '#7070a0',
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  marginBottom: 6,
};

const closeBtnStyle = {
  background: 'none',
  border: '1px solid #2e2e4e',
  color: '#7070a0',
  borderRadius: 4,
  padding: '4px 8px',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(8, 1fr)',
  gap: 8,
};

const cellStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  background: '#22223a',
  border: '1px solid #2e2e4e',
  borderRadius: 5,
  padding: 4,
};

const cellSelectedStyle = {
  border: '1px solid #ffe066',
  background: 'rgba(255, 224, 102, 0.1)',
  boxShadow: '0 0 0 1px #ffe066',
};

const numStyle = {
  fontSize: 8,
  color: '#7070a0',
  display: 'flex',
  alignItems: 'center',
  gap: 2,
};

const starStyle = {
  color: '#ffe066',
  fontSize: 9,
};
