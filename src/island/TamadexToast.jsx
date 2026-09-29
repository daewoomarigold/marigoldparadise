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
// see growth.js's allBabiesAndToddlers) above it. Collected adults (in the
// student's growth.tamadex) show in normal color; uncollected ones show
// the same sprite silhouetted black via a CSS filter, so the shape/number
// is visible as a "not yet found" placeholder rather than a blank slot.
// The early-stage row has no such gating — every student passes through
// the same baby/toddlers on every cycle, so all 4 are always shown in
// color and clickable.
//
// Clicking a collected adult OR any early-stage form sets it as the
// student's display tama (the one shown roaming on the island field — see
// growth.js's resolveDisplayTama). The current display tama is highlighted
// yellow with a star, in whichever section it's actually in. Uncollected
// adults aren't clickable — nothing to display.

import { useState } from 'react';
import { allAdults, allBabiesAndToddlers, findTamaName, resolveDisplayTama } from '../game/growth.js';
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
          const isDisplayed = t.tamaId === currentDisplayTamaId;
          return (
            <div
              key={t.tamaId}
              role="button"
              style={{ ...cellStyle, ...(isDisplayed ? cellSelectedStyle : null), cursor: 'pointer' }}
              title={t.name}
              onClick={() => onSelectDisplay(t.tamaId)}
            >
              <div style={numStyle}>{isDisplayed && <span style={starStyle}>★</span>}</div>
              <TamaComposite tamaId={t.tamaId} variant="mini" frames={{ body: 0, eyes: 0, mouth: 0 }} scale={CELL_SCALE} />
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
  // A min-width (not a fixed one) so the card stays a stable size across
  // tab switches instead of shrinking down for the near-empty Shop/Bag
  // placeholders — sized to comfortably fit the Tamadex tab's 8-column
  // adult grid alongside the sidebar, its widest content.
  minWidth: 700,
  maxWidth: '90vw',
  maxHeight: '85vh',
  fontFamily: 'ui-monospace, monospace',
  color: '#e0e0f0',
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

const bodyStyle = {
  display: 'flex',
  gap: 16,
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

// The only part that scrolls — the sidebar stays put alongside it.
const contentStyle = {
  flex: 1,
  minWidth: 0,
  maxHeight: '70vh',
  overflowY: 'auto',
};

const comingSoonStyle = {
  color: '#7070a0',
  fontSize: 12,
  padding: '24px 0',
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
