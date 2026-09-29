// Popup shown when a student's tile is clicked — a small sidebar of tabs
// (Tamadex / Gotchi Shop / My Bag) next to whichever one's content is
// active.
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
//
// Gotchi Shop tab: its own secondary tab row — Accessories (built out, see
// ShopTab/ACCESSORIES in accessories.js) and Customization (a placeholder
// for now; what actually goes in it hasn't been decided yet). Buying an
// accessory spends gotchiPts and adds it to the student's bag (see
// useClassroomStore.js's buyAccessory) — it isn't equipped automatically,
// that happens in My Bag.
//
// My Bag tab: a grid of owned accessories: pick one to open the
// positioning editor below it, a drag-anywhere frame showing the
// student's own field tama with that accessory overlaid (see
// spriteCompositor.jsx's TamaComposite `accessory` prop) — drag it where
// you want, then "Equip here" saves that exact position and equips it
// (useClassroomStore.js's setEquippedAccessory), which is what actually
// makes it show up on the island field. Only one accessory equipped at a
// time, by design — simpler data model/rendering, easy to revisit later
// if multiple-at-once turns out to be wanted.

import { useRef, useState } from 'react';
import { allAdults, allBabiesAndToddlers, findTamaName, resolveDisplayTama, visitedEarlyStageIds } from '../game/growth.js';
import { ACCESSORIES, ACCESSORY_PRICE, accessorySpriteFile, findAccessory } from '../game/accessories.js';
import { TamaComposite } from '../game/spriteCompositor.jsx';
import { spriteUrl } from '../game/spriteData.js';

const CELL_SCALE = 1.5; // mini sprites are 32x32 native
const EDITOR_SCALE = 4; // My Bag's positioning frame — base sprites are 64x64 native, so this renders at 256x256

const TABS = [
  { id: 'tamadex', label: 'Tamadex' },
  { id: 'shop', label: 'Gotchi Shop' },
  { id: 'bag', label: 'My Bag' },
];

export default function TamadexToast({ student, onSelectDisplay, onBuyAccessory, onSetEquippedAccessory, onClose }) {
  const [activeTab, setActiveTab] = useState('tamadex');

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={titleStyle}>{student.name}&rsquo;s Options</div>
          <div style={coinBalanceStyle}>★ {student.gotchiPts}</div>
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
            {activeTab === 'shop' && <ShopTab student={student} onBuyAccessory={onBuyAccessory} />}
            {activeTab === 'bag' && <MyBagTab student={student} onSetEquippedAccessory={onSetEquippedAccessory} />}
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

const SHOP_CATEGORIES = [
  { id: 'accessories', label: 'Accessories' },
  { id: 'customization', label: 'Customization' },
];

function ShopTab({ student, onBuyAccessory }) {
  const [category, setCategory] = useState('accessories');
  // The accessory id awaiting a Yes/No confirmation, or null — a click on
  // a buyable cell opens this instead of purchasing immediately.
  const [confirmId, setConfirmId] = useState(null);
  const owned = new Set(student.bag);
  const confirmItem = confirmId != null ? findAccessory(confirmId) : null;

  return (
    <div style={{ position: 'relative' }}>
      <div style={subTabRowStyle}>
        {SHOP_CATEGORIES.map((c) => (
          <button
            key={c.id}
            style={{ ...subTabBtnStyle, ...(category === c.id ? subTabBtnActiveStyle : null) }}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      {category === 'accessories' ? (
        <div style={gridStyle}>
          {ACCESSORIES.map((item) => {
            const got = owned.has(item.id);
            const canAfford = student.gotchiPts >= ACCESSORY_PRICE;
            return (
              <div
                key={item.id}
                role={!got ? 'button' : undefined}
                style={{
                  ...cellStyle,
                  cursor: got || !canAfford ? 'default' : 'pointer',
                  opacity: !got && !canAfford ? 0.5 : 1,
                }}
                title={got ? `${item.name} (owned)` : `${item.name} — ★${ACCESSORY_PRICE}`}
                onClick={!got && canAfford ? () => setConfirmId(item.id) : undefined}
              >
                <img src={spriteUrl(accessorySpriteFile(item.id))} alt="" style={itemIconStyle} />
                <div style={priceStyle}>{got ? 'Owned' : `★${ACCESSORY_PRICE}`}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <ComingSoon label="Customization" />
      )}
      {confirmItem && (
        <BuyConfirmDialog
          item={confirmItem}
          price={ACCESSORY_PRICE}
          onConfirm={() => {
            onBuyAccessory(confirmItem.id, ACCESSORY_PRICE);
            setConfirmId(null);
          }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}

// A small Yes/No confirmation overlaid on top of the shop grid — position:
// absolute against ShopTab's own position:relative wrapper, so it covers
// just the shop's content area rather than the whole toast.
function BuyConfirmDialog({ item, price, onConfirm, onCancel }) {
  return (
    <div style={confirmBackdropStyle} onClick={onCancel}>
      <div style={confirmCardStyle} onClick={(e) => e.stopPropagation()}>
        <img src={spriteUrl(accessorySpriteFile(item.id))} alt="" style={{ ...itemIconStyle, width: 48, height: 48 }} />
        <div style={confirmTextStyle}>
          Buy {item.name} for ★{price}?
        </div>
        <div style={editorActionsStyle}>
          <button style={primaryBtnStyle} onClick={onConfirm}>
            Yes
          </button>
          <button style={secondaryBtnStyle} onClick={onCancel}>
            No
          </button>
        </div>
      </div>
    </div>
  );
}

function MyBagTab({ student, onSetEquippedAccessory }) {
  const equipped = student.equippedAccessory;
  const [selectedId, setSelectedId] = useState(equipped?.id ?? student.bag[0] ?? null);
  const [pos, setPos] = useState(equipped ? { x: equipped.x, y: equipped.y } : { x: 0, y: 0 });

  function selectItem(id) {
    setSelectedId(id);
    setPos(equipped?.id === id ? { x: equipped.x, y: equipped.y } : { x: 0, y: 0 });
  }

  if (student.bag.length === 0) {
    return <ComingSoon label="Nothing in the bag yet — visit the Gotchi Shop" />;
  }

  const { stage, tamaId } = resolveDisplayTama(student);
  const selected = selectedId != null ? findAccessory(selectedId) : null;

  return (
    <div>
      <div style={sectionLabelStyle}>Your items</div>
      <div style={{ ...gridStyle, marginBottom: 14 }}>
        {student.bag.map((id) => {
          const item = findAccessory(id);
          if (!item) return null;
          const isEquipped = equipped?.id === id;
          const isSelected = selectedId === id;
          return (
            <div
              key={id}
              role="button"
              style={{ ...cellStyle, ...(isSelected ? cellSelectedStyle : null), cursor: 'pointer' }}
              title={item.name}
              onClick={() => selectItem(id)}
            >
              <div style={numStyle}>{isEquipped && <span style={starStyle}>★</span>}</div>
              <img src={spriteUrl(accessorySpriteFile(id))} alt="" style={itemIconStyle} />
            </div>
          );
        })}
      </div>
      {selected && (
        <>
          <div style={sectionLabelStyle}>Drag {selected.name} onto {student.name}&rsquo;s tama</div>
          <DragFrame stage={stage} tamaId={tamaId} accessoryId={selectedId} pos={pos} onPosChange={setPos} />
          <div style={editorActionsStyle}>
            <button style={primaryBtnStyle} onClick={() => onSetEquippedAccessory({ id: selectedId, x: pos.x, y: pos.y })}>
              Equip here
            </button>
            {equipped && (
              <button style={secondaryBtnStyle} onClick={() => onSetEquippedAccessory(null)}>
                Unequip
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// The positioning editor — a fixed-size frame showing the student's field
// tama at EDITOR_SCALE (base variant, static idle frame) with the selected
// accessory drawn on top, dragged via TamaComposite's own `accessory` prop
// (passing pointer handlers through it) rather than a second, separately-
// positioned image — that's what guarantees the position saved here means
// exactly the same thing when it's rendered later on the animated field
// roamer (see spriteCompositor.jsx's TamaComposite for the shared
// face-anchored positioning formula both places actually use). Pointer
// events (not separate mouse/touch handlers) so dragging works the same
// with a mouse or on a touchscreen — setPointerCapture keeps the drag
// going even if the pointer moves off the image mid-drag. Reports pos in
// the same base-resolution pixel units TamaComposite's `accessory` prop
// expects (dividing the on-screen drag delta by EDITOR_SCALE).
function DragFrame({ stage, tamaId, accessoryId, pos, onPosChange }) {
  const dragRef = useRef(null); // {startClientX, startClientY, startPosX, startPosY} | null
  const isEgg = stage === 'egg';

  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startPosX: pos.x, startPosY: pos.y };
  }
  function handlePointerMove(e) {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startClientX) / EDITOR_SCALE;
    const dy = (e.clientY - dragRef.current.startClientY) / EDITOR_SCALE;
    onPosChange({ x: Math.round(dragRef.current.startPosX + dx), y: Math.round(dragRef.current.startPosY + dy) });
  }
  function handlePointerUp() {
    dragRef.current = null;
  }

  return (
    <div style={dragFrameStyle}>
      <TamaComposite
        tamaId={isEgg ? 'egg' : tamaId}
        variant="base"
        frames={{ body: 0, eyes: 0, mouth: 0 }}
        scale={EDITOR_SCALE}
        accessory={{
          id: accessoryId,
          x: pos.x,
          y: pos.y,
          onPointerDown: handlePointerDown,
          onPointerMove: handlePointerMove,
          onPointerUp: handlePointerUp,
        }}
      />
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

const coinBalanceStyle = {
  fontSize: 12,
  color: '#ffe066',
};

const subTabRowStyle = {
  display: 'flex',
  gap: 6,
  marginBottom: 14,
};

const subTabBtnStyle = {
  background: 'none',
  border: '1px solid #2e2e4e',
  color: '#a0a0c0',
  borderRadius: 5,
  padding: '5px 10px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 10,
};

const subTabBtnActiveStyle = {
  border: '1px solid #ffe066',
  background: 'rgba(255, 224, 102, 0.1)',
  color: '#e0e0f0',
};

const itemIconStyle = {
  width: 32,
  height: 32,
  imageRendering: 'pixelated',
};

const priceStyle = {
  fontSize: 8,
  color: '#ffe066',
};

const editorActionsStyle = {
  display: 'flex',
  gap: 8,
  marginTop: 10,
};

const primaryBtnStyle = {
  background: '#4ef0d8',
  border: 'none',
  color: '#0a0a14',
  borderRadius: 6,
  padding: '8px 14px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 'bold',
};

const secondaryBtnStyle = {
  background: 'none',
  border: '1px solid #2e2e4e',
  color: '#a0a0c0',
  borderRadius: 6,
  padding: '8px 14px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
};

// Checkerboard-ish background so a mostly-transparent accessory image is
// still easy to see/grab while dragging.
const dragFrameStyle = {
  position: 'relative',
  width: 64 * EDITOR_SCALE,
  height: 64 * EDITOR_SCALE,
  background: '#22223a',
  backgroundImage:
    'linear-gradient(45deg, #2a2a44 25%, transparent 25%), linear-gradient(-45deg, #2a2a44 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a44 75%), linear-gradient(-45deg, transparent 75%, #2a2a44 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  border: '1px solid #2e2e4e',
  borderRadius: 6,
  overflow: 'hidden',
};

// Covers ShopTab's own content area (its position:relative wrapper), not
// the whole toast — a click outside the dialog card cancels, same pattern
// TamadexToast's own outer backdrop uses for its close button.
const confirmBackdropStyle = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(10, 4, 20, 0.85)',
  backdropFilter: 'blur(2px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
};

const confirmCardStyle = {
  background: '#22223a',
  border: '1px solid #4a4a7a',
  borderRadius: 8,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  maxWidth: 220,
  textAlign: 'center',
};

const confirmTextStyle = {
  fontSize: 12,
  color: '#e0e0f0',
};
