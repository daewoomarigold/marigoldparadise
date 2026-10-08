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
// Gotchi Shop tab: its own secondary tab row — Accessories (see
// ShopTab/ACCESSORIES in accessories.js) and Customization. Customization
// has a THIRD tab level of its own (CustomizationTab/CUSTOMIZATION_
// CATEGORIES): "Frames" (FRAME_COLORS in frameColors.js — solid-color
// borders for the roster tile showing a student's growing tama,
// StudentGrid.jsx's tileStyle) and "Overlays" (OVERLAYS in overlays.js —
// small looping particle effects, e.g. falling snow, animated over that
// same tile via TileOverlay.jsx; there's no sprite art for these at all,
// so they're drawn procedurally from emoji + CSS, not image files), with
// room for more subcategories later without restructuring. Buying spends
// gotchiPts either way. Accessories go into the student's bag unequipped
// (see useClassroomStore.js's buyAccessory) — equipping happens in My
// Bag, since there's a position to choose. Frame colors/overlays have no
// position to choose, so an owned one equips/unequips right in
// Customization instead (see useClassroomStore.js's buyFrameColor/
// setEquippedFrameColor and buyOverlay/setEquippedOverlay).
//
// My Bag tab: a grid of owned accessories, then owned frame colors and
// overlays ("Customizations" — see frameColors.js/overlays.js) below it,
// all next to a single drag-anywhere frame (DragFrame) showing the
// student's own field tama. On open the frame already shows whatever's
// currently equipped (an accessory AND a frame color AND an overlay,
// independently — none of the three are mutually exclusive), so the
// student's current look is visible straight away without tapping
// anything. Pick an accessory to preview it in the frame instead, with it
// overlaid (see spriteCompositor.jsx's TamaComposite `accessory` prop) —
// drag it where you want, then "Equip here" saves that exact position and
// equips it (useClassroomStore.js's setEquippedAccessory), which is what
// actually makes it show up on the island field. Frame colors/overlays
// have no position to choose, so tapping an owned one just equips/
// unequips it immediately: a frame color draws as a border AROUND the
// frame's red bounding box (see DragFrame's `frameColor` prop) — the same
// treatment StudentGrid.jsx's real tile gets — and an overlay plays right
// over the preview tama (DragFrame's `overlayId` prop, same TileOverlay.jsx
// component the real tile uses). Only one of each (accessory, frame
// color, overlay) equipped at a time, by design — simpler data model/
// rendering, easy to revisit later if multiple-at-once turns out to be
// wanted.

import { useRef, useState } from 'react';
import { allAdults, allBabiesAndToddlers, findTamaName, resolveDisplayTama, visitedEarlyStageIds } from '../game/growth.js';
import { ACCESSORIES, ACCESSORY_PRICE, accessorySpriteFile, findAccessory } from '../game/accessories.js';
import { FRAME_COLORS, FRAME_COLOR_PRICE, findFrameColor } from '../game/frameColors.js';
import { OVERLAYS, OVERLAY_PRICE, findOverlay } from '../game/overlays.js';
import { TamaComposite } from '../game/spriteCompositor.jsx';
import { spriteUrl } from '../game/spriteData.js';
import TileOverlay from './TileOverlay.jsx';
import { tileBgStyle } from './tileAppearance.js';

const CELL_SCALE = 1.5; // mini sprites are 32x32 native
// My Bag's positioning frame — base sprites are 64x64 native. Was 4 (a
// 256px tama); brought down a notch so the whole frame (see
// EDITOR_FRAME_SIZE below) comfortably fits alongside the items column
// without the card needing to be wide enough to clip on a smaller/narrower
// browser window — see the request that added this shrink.
const EDITOR_SCALE = 3.5;
const EDITOR_CHAR_SIZE = 64 * EDITOR_SCALE; // 224 — the tama's own rendered bounding box
// The drag frame itself is bigger than the tama's bounding box — extra
// room (split evenly on all sides) to drag an accessory past the tama's
// own edges, e.g. a hat sitting above the head, per the request that
// added this. The red rectangle drawn at EDITOR_CHAR_SIZE (see DragFrame)
// marks where that original bounding box actually is within the bigger
// frame.
const EDITOR_FRAME_SIZE = Math.round(EDITOR_CHAR_SIZE * 1.3);
const EDITOR_FRAME_PADDING = (EDITOR_FRAME_SIZE - EDITOR_CHAR_SIZE) / 2;

const TABS = [
  { id: 'tamadex', label: 'Tamadex' },
  { id: 'shop', label: 'Gotchi Shop' },
  { id: 'bag', label: 'My Bag' },
];

export default function TamadexToast({
  student,
  onSelectDisplay,
  onBuyAccessory,
  onSetEquippedAccessory,
  onSetNickname,
  onBuyFrameColor,
  onSetEquippedFrameColor,
  onBuyOverlay,
  onSetEquippedOverlay,
  onClose,
}) {
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
            {activeTab === 'shop' && (
              <ShopTab
                student={student}
                onBuyAccessory={onBuyAccessory}
                onBuyFrameColor={onBuyFrameColor}
                onSetEquippedFrameColor={onSetEquippedFrameColor}
                onBuyOverlay={onBuyOverlay}
                onSetEquippedOverlay={onSetEquippedOverlay}
              />
            )}
            {activeTab === 'bag' && (
              <MyBagTab
                student={student}
                onSetEquippedAccessory={onSetEquippedAccessory}
                onSetNickname={onSetNickname}
                onSetEquippedFrameColor={onSetEquippedFrameColor}
                onSetEquippedOverlay={onSetEquippedOverlay}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComingSoon({ label }) {
  return <div style={comingSoonStyle}>🚧 {label} — coming soon.</div>;
}

// A frame color's preview — a hollow ring rather than a solid square, so
// it reads as "this becomes a BORDER around the tile" rather than a flat
// fill (see StudentGrid.jsx's tileStyle, what this actually colors).
// Thickness scales with size so it still reads clearly at the confirm
// dialog's bigger preview, not just the shop grid's small cells.
function FrameSwatch({ color, size = 32 }) {
  const thickness = Math.round(size * 0.22);
  return (
    <div
      style={{
        width: size,
        height: size,
        boxSizing: 'border-box',
        borderRadius: 6,
        border: `${thickness}px solid ${color}`,
        background: '#22223a', // matches the real tile's own background (StudentGrid.jsx's tileStyle)
      }}
    />
  );
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

function ShopTab({ student, onBuyAccessory, onBuyFrameColor, onSetEquippedFrameColor, onBuyOverlay, onSetEquippedOverlay }) {
  const [category, setCategory] = useState('accessories');
  // The accessory id awaiting a Yes/No confirmation, or null — a click on
  // a buyable cell opens this instead of purchasing immediately.
  // CustomizationTab owns the equivalent state for its own items (frame
  // colors, etc.) separately, since it's a self-contained sub-panel.
  const [confirmAccessoryId, setConfirmAccessoryId] = useState(null);
  const owned = new Set(student.bag);
  const confirmAccessory = confirmAccessoryId != null ? findAccessory(confirmAccessoryId) : null;

  return (
    <div>
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
                onClick={!got && canAfford ? () => setConfirmAccessoryId(item.id) : undefined}
              >
                <img src={spriteUrl(accessorySpriteFile(item.id))} alt="" style={itemIconStyle} />
                <div style={priceStyle}>{got ? 'Owned' : `★${ACCESSORY_PRICE}`}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <CustomizationTab
          student={student}
          onBuyFrameColor={onBuyFrameColor}
          onSetEquippedFrameColor={onSetEquippedFrameColor}
          onBuyOverlay={onBuyOverlay}
          onSetEquippedOverlay={onSetEquippedOverlay}
        />
      )}
      {confirmAccessory && (
        <BuyConfirmDialog
          name={confirmAccessory.name}
          price={ACCESSORY_PRICE}
          balance={student.gotchiPts}
          preview={<img src={spriteUrl(accessorySpriteFile(confirmAccessory.id))} alt="" style={{ ...itemIconStyle, width: 48, height: 48 }} />}
          onConfirm={() => {
            onBuyAccessory(confirmAccessory.id, ACCESSORY_PRICE);
            setConfirmAccessoryId(null);
          }}
          onCancel={() => setConfirmAccessoryId(null)}
        />
      )}
    </div>
  );
}

// Customization's own sub-tab row, one level below Accessories/
// Customization — just "Frames" for now (colored tile borders, see
// frameColors.js), per the request that added this structure: "we can add
// more subcategories later" (a background category, say). Self-contained:
// owns its own confirm-dialog state rather than sharing ShopTab's, since
// each subcategory here is its own little catalog/flow.
const CUSTOMIZATION_CATEGORIES = [
  { id: 'frames', label: 'Frames' },
  { id: 'overlays', label: 'Overlays' },
];

function CustomizationTab({ student, onBuyFrameColor, onSetEquippedFrameColor, onBuyOverlay, onSetEquippedOverlay }) {
  const [subCategory, setSubCategory] = useState('frames');
  const [confirmColorId, setConfirmColorId] = useState(null);
  const [confirmOverlayId, setConfirmOverlayId] = useState(null);
  const ownedColors = new Set(student.ownedFrameColors);
  const ownedOverlays = new Set(student.ownedOverlays);
  const confirmColor = confirmColorId != null ? findFrameColor(confirmColorId) : null;
  const confirmOverlay = confirmOverlayId != null ? findOverlay(confirmOverlayId) : null;

  return (
    <div>
      <div style={subTabRowStyle}>
        {CUSTOMIZATION_CATEGORIES.map((sc) => (
          <button
            key={sc.id}
            style={{ ...subTabBtnStyle, ...(subCategory === sc.id ? subTabBtnActiveStyle : null) }}
            onClick={() => setSubCategory(sc.id)}
          >
            {sc.label}
          </button>
        ))}
      </div>
      {subCategory === 'frames' && (
        // No My Bag step like accessories get — there's nothing to
        // position for a solid border color, so an owned swatch
        // equips/unequips (toggle) right here instead.
        <div style={gridStyle}>
          {FRAME_COLORS.map((c) => {
            const got = ownedColors.has(c.id);
            const isEquipped = student.equippedFrameColor === c.id;
            const canAfford = student.gotchiPts >= FRAME_COLOR_PRICE;
            return (
              <div
                key={c.id}
                role={got || canAfford ? 'button' : undefined}
                style={{
                  ...cellStyle,
                  ...(isEquipped ? cellSelectedStyle : null),
                  cursor: got || canAfford ? 'pointer' : 'default',
                  opacity: !got && !canAfford ? 0.5 : 1,
                }}
                title={got ? (isEquipped ? `${c.name} (equipped)` : `${c.name} (owned — tap to equip)`) : `${c.name} — ★${FRAME_COLOR_PRICE}`}
                onClick={got ? () => onSetEquippedFrameColor(isEquipped ? null : c.id) : canAfford ? () => setConfirmColorId(c.id) : undefined}
              >
                <div style={numStyle}>{isEquipped && <span style={starStyle}>★</span>}</div>
                <FrameSwatch color={c.color} />
                <div style={priceStyle}>{got ? (isEquipped ? 'Equipped' : 'Owned') : `★${FRAME_COLOR_PRICE}`}</div>
              </div>
            );
          })}
        </div>
      )}
      {subCategory === 'overlays' && (
        // Same no-My-Bag-step reasoning as frames — nothing to position
        // for a looping particle effect, so an owned one equips/unequips
        // right here too.
        <div style={gridStyle}>
          {OVERLAYS.map((o) => {
            const got = ownedOverlays.has(o.id);
            const isEquipped = student.equippedOverlay === o.id;
            const canAfford = student.gotchiPts >= OVERLAY_PRICE;
            return (
              <div
                key={o.id}
                role={got || canAfford ? 'button' : undefined}
                style={{
                  ...cellStyle,
                  ...(isEquipped ? cellSelectedStyle : null),
                  cursor: got || canAfford ? 'pointer' : 'default',
                  opacity: !got && !canAfford ? 0.5 : 1,
                }}
                title={got ? (isEquipped ? `${o.name} (equipped)` : `${o.name} (owned — tap to equip)`) : `${o.name} — ★${OVERLAY_PRICE}`}
                onClick={got ? () => onSetEquippedOverlay(isEquipped ? null : o.id) : canAfford ? () => setConfirmOverlayId(o.id) : undefined}
              >
                <div style={numStyle}>{isEquipped && <span style={starStyle}>★</span>}</div>
                <span style={overlayEmojiStyle}>{o.emoji}</span>
                <div style={priceStyle}>{got ? (isEquipped ? 'Equipped' : 'Owned') : `★${OVERLAY_PRICE}`}</div>
              </div>
            );
          })}
        </div>
      )}
      {confirmColor && (
        <BuyConfirmDialog
          name={confirmColor.name}
          price={FRAME_COLOR_PRICE}
          balance={student.gotchiPts}
          preview={<FrameSwatch color={confirmColor.color} size={48} />}
          onConfirm={() => {
            onBuyFrameColor(confirmColor.id, FRAME_COLOR_PRICE);
            setConfirmColorId(null);
          }}
          onCancel={() => setConfirmColorId(null)}
        />
      )}
      {confirmOverlay && (
        <BuyConfirmDialog
          name={confirmOverlay.name}
          price={OVERLAY_PRICE}
          balance={student.gotchiPts}
          preview={<span style={{ ...overlayEmojiStyle, fontSize: 48 }}>{confirmOverlay.emoji}</span>}
          onConfirm={() => {
            onBuyOverlay(confirmOverlay.id, OVERLAY_PRICE);
            setConfirmOverlayId(null);
          }}
          onCancel={() => setConfirmOverlayId(null)}
        />
      )}
    </div>
  );
}

// A small Yes/No confirmation — fixed to the viewport, centered over
// everything (see confirmBackdropStyle), shared by both ShopTab and
// CustomizationTab (each owns its own confirm-id state and renders this
// with its own catalog's item). `preview` is whatever image/swatch
// represents the item — different catalogs render their own (an
// accessory sprite vs. a FrameSwatch), this dialog doesn't need to know
// which.
function BuyConfirmDialog({ name, price, balance, preview, onConfirm, onCancel }) {
  return (
    <div style={confirmBackdropStyle} onClick={onCancel}>
      <div style={confirmCardStyle} onClick={(e) => e.stopPropagation()}>
        {preview}
        <div style={confirmTextStyle}>
          Buy {name} for ★{price}?
        </div>
        <div style={balanceTableStyle}>
          <span>Current Balance:</span>
          <span style={balanceValueStyle}>★{balance}</span>
          <span>Balance After Purchase:</span>
          <span style={balanceValueStyle}>★{balance - price}</span>
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

function MyBagTab({ student, onSetEquippedAccessory, onSetNickname, onSetEquippedFrameColor, onSetEquippedOverlay }) {
  const equipped = student.equippedAccessory;
  // Nothing pre-selected on open (no item highlighted in the grid, no
  // Equip button), but the frame still shows what's equipped right now,
  // at its saved spot, so the current look is visible without a tap.
  // Dragging that equipped item in the frame selects it, same as tapping
  // it in the grid would.
  const [selectedId, setSelectedId] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const previewId = selectedId ?? equipped?.id ?? null;
  const previewPos = selectedId != null ? pos : equipped ? { x: equipped.x, y: equipped.y } : pos;

  function moveInFrame(nextPos) {
    if (selectedId == null && equipped) setSelectedId(equipped.id);
    setPos(nextPos);
  }

  function selectItem(id) {
    setSelectedId(id);
    setPos(equipped?.id === id ? { x: equipped.x, y: equipped.y } : { x: 0, y: 0 });
  }

  // Frame colors/overlays have no position to fine-tune, so there's no
  // equivalent "pick then drag then Equip here" flow — tapping an owned
  // one just toggles it equipped immediately (same as Customization's own
  // shop panel), and the frame preview below updates to match right away.
  function toggleColor(id) {
    onSetEquippedFrameColor(student.equippedFrameColor === id ? null : id);
  }

  function toggleOverlay(id) {
    onSetEquippedOverlay(student.equippedOverlay === id ? null : id);
  }

  const { stage, tamaId } = resolveDisplayTama(student);
  const selected = selectedId != null ? findAccessory(selectedId) : null;
  const equippedColor = student.equippedFrameColor ? findFrameColor(student.equippedFrameColor) : null;

  return (
    <div style={bagLayoutStyle}>
      <div style={bagItemsColumnStyle}>
        <div style={sectionLabelStyle}>Your items</div>
        {student.bag.length === 0 ? (
          <ComingSoon label="Nothing in the bag yet — visit the Gotchi Shop" />
        ) : (
          <div style={{ ...bagGridStyle, marginBottom: 16 }}>
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
        )}
        <div style={sectionLabelStyle}>Customizations — Frames</div>
        {student.ownedFrameColors.length === 0 ? (
          <ComingSoon label="No frame colors yet — visit the Gotchi Shop" />
        ) : (
          <div style={{ ...bagGridStyle, marginBottom: 16 }}>
            {student.ownedFrameColors.map((id) => {
              const color = findFrameColor(id);
              if (!color) return null;
              const isEquipped = student.equippedFrameColor === id;
              return (
                <div
                  key={id}
                  role="button"
                  style={{ ...cellStyle, ...(isEquipped ? cellSelectedStyle : null), cursor: 'pointer' }}
                  title={isEquipped ? `${color.name} (equipped — tap to unequip)` : color.name}
                  onClick={() => toggleColor(id)}
                >
                  <div style={numStyle}>{isEquipped && <span style={starStyle}>★</span>}</div>
                  <FrameSwatch color={color.color} />
                </div>
              );
            })}
          </div>
        )}
        <div style={sectionLabelStyle}>Customizations — Overlays</div>
        {student.ownedOverlays.length === 0 ? (
          <ComingSoon label="No overlays yet — visit the Gotchi Shop" />
        ) : (
          <div style={bagGridStyle}>
            {student.ownedOverlays.map((id) => {
              const overlay = findOverlay(id);
              if (!overlay) return null;
              const isEquipped = student.equippedOverlay === id;
              return (
                <div
                  key={id}
                  role="button"
                  style={{ ...cellStyle, ...(isEquipped ? cellSelectedStyle : null), cursor: 'pointer' }}
                  title={isEquipped ? `${overlay.name} (equipped — tap to unequip)` : overlay.name}
                  onClick={() => toggleOverlay(id)}
                >
                  <div style={numStyle}>{isEquipped && <span style={starStyle}>★</span>}</div>
                  <span style={overlayEmojiStyle}>{overlay.emoji}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={bagEditorColumnStyle}>
        {/* Above the drag frame, per request — a separate feature from
            accessories, so it stays available even with an empty bag. */}
        <NicknameEditor student={student} onSetNickname={onSetNickname} />
        <div style={sectionLabelStyle}>
          {selected ? (
            <>
              Drag {selected.name} onto {student.name}&rsquo;s tama
            </>
          ) : equipped && findAccessory(equipped.id) ? (
            <>Wearing {findAccessory(equipped.id).name} — drag it, or pick another item</>
          ) : (
            'Pick an item to position it'
          )}
        </div>
        <DragFrame
          stage={stage}
          tamaId={tamaId}
          accessoryId={previewId}
          pos={previewPos}
          onPosChange={moveInFrame}
          frameColor={equippedColor?.color}
          overlayId={student.equippedOverlay}
        />
        <div style={editorActionsStyle}>
          {selected && (
            <button style={primaryBtnStyle} onClick={() => onSetEquippedAccessory({ id: selectedId, x: pos.x, y: pos.y })}>
              Equip here
            </button>
          )}
          {equipped && (
            <button style={secondaryBtnStyle} onClick={() => onSetEquippedAccessory(null)}>
              Unequip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Lets a student rename what shows above their roaming tama on the island
// field (IslandView.jsx's NameTag) — separate from their real name (the
// `name` column, used everywhere else: the dashboard, the roster tile,
// this very toast's own title). Local draft state, saved explicitly
// (matching the app's other editors here — "Equip here" is the same
// pattern) rather than on every keystroke or on blur, so a student typing
// something silly doesn't briefly show up live on a projected field
// before they've actually committed to it.
function NicknameEditor({ student, onSetNickname }) {
  const [draft, setDraft] = useState(student.nickname ?? '');

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={sectionLabelStyle}>Field nickname</div>
      <div style={nicknameRowStyle}>
        <input
          style={nicknameInputStyle}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={student.name}
          maxLength={20}
        />
        <button style={secondaryBtnStyle} onClick={() => onSetNickname(draft)}>
          Save
        </button>
      </div>
    </div>
  );
}

// The positioning editor — a frame showing the student's field tama at
// EDITOR_SCALE (base variant, static idle frame) with the selected
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
//
// The frame itself (EDITOR_FRAME_SIZE) is bigger than the tama's own
// bounding box (EDITOR_CHAR_SIZE) — extra room on every side so an
// accessory can be dragged past the tama's own edges (e.g. a hat sitting
// above the head) instead of getting clipped right at its border. The
// tama composite is offset by EDITOR_FRAME_PADDING to sit centered in
// that bigger frame; a red rectangle drawn at the same offset marks
// exactly where the tama's own bounding box is, so it's clear how far
// "past the edge" any given drag actually is.
function DragFrame({ stage, tamaId, accessoryId, pos, onPosChange, frameColor, overlayId }) {
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

  // Previewing a frame color (see frameColors.js) puts it around the
  // OUTSIDE of the red bounding box — dragFrameStyle's own border, the
  // same treatment StudentGrid.jsx's real tile gets — rather than
  // replacing the red rectangle itself, which stays put marking the
  // tama's actual bounds regardless of what frame color is selected.
  const frameColorStyle = frameColor ? { border: `3px solid ${frameColor}`, boxShadow: `0 0 6px ${frameColor}` } : null;

  return (
    <div style={{ ...dragFrameStyle, ...frameColorStyle }}>
      <div style={dragFrameBoundsStyle} />
      <div style={dragFrameCharStyle}>
        <TamaComposite
          tamaId={isEgg ? 'egg' : tamaId}
          variant="base"
          frames={{ body: 0, eyes: 0, mouth: 0 }}
          scale={EDITOR_SCALE}
          // The tama itself always renders — nothing to drag until an
          // item's actually picked, so the accessory overlay (and its
          // handlers) is only attached once accessoryId is set.
          accessory={
            accessoryId != null
              ? {
                  id: accessoryId,
                  x: pos.x,
                  y: pos.y,
                  onPointerDown: handlePointerDown,
                  onPointerMove: handlePointerMove,
                  onPointerUp: handlePointerUp,
                }
              : undefined
          }
        />
      </div>
      {/* Sibling of dragFrameCharStyle, not nested inside it — covers the
          WHOLE frame (dragFrameStyle's own bounds, bigger than the red
          box) to match the real tile's treatment. */}
      <TileOverlay overlayId={overlayId} />
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
  // near-empty Shop/Bag placeholders. Width needs to fit whichever tab is
  // widest — that's now My Bag's items-list + drag-frame row
  // (EDITOR_FRAME_SIZE, bigger than the tama's own bounding box on
  // purpose — see DragFrame), not Tamadex's 8-column grid anymore.
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

// My Bag: items list on the left, the drag-positioning editor fixed to
// the right of it (per request) — a row instead of the stacked layout
// the other tabs use.
const bagLayoutStyle = {
  display: 'flex',
  gap: 20,
  alignItems: 'flex-start',
};

// Narrower than gridStyle's 8 columns — this list only ever shows OWNED
// items (typically a handful, not the full 76-item catalog), and it needs
// to leave room for the editor column beside it rather than stretching
// the whole toast wider.
const bagItemsColumnStyle = {
  flex: 1,
  minWidth: 0,
};

const bagGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
};

// Fixed width matching DragFrame's own (EDITOR_FRAME_SIZE) so this column
// doesn't grow/shrink with the item list beside it.
const bagEditorColumnStyle = {
  flexShrink: 0,
  width: EDITOR_FRAME_SIZE,
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

const overlayEmojiStyle = {
  fontSize: 28,
  lineHeight: 1,
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

const nicknameRowStyle = {
  display: 'flex',
  gap: 8,
  marginBottom: 16,
};

const nicknameInputStyle = {
  flex: 1,
  minWidth: 0,
  background: '#22223a',
  border: '1px solid #2e2e4e',
  borderRadius: 6,
  padding: '8px 10px',
  color: '#e0e0f0',
  fontFamily: 'inherit',
  fontSize: 11,
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

// The real tile's own grass-and-scrim background (tileBgStyle, shared
// with StudentGrid.jsx via tileAppearance.js) instead of a generic
// transparency checkerboard — reads as an actual preview of the roster
// tile rather than an abstract
// editor canvas. A real background customization feature (multiple
// choices, like frame colors) is a future follow-up; for now this is
// just the one real background every tile already uses. Sized to
// EDITOR_FRAME_SIZE (bigger than the tama's own EDITOR_CHAR_SIZE bounding
// box) — see DragFrame's own comment for why. box-sizing: border-box so
// toggling a frame color's thicker border (see DragFrame's frameColor
// prop) doesn't change this element's overall footprint.
const dragFrameStyle = {
  position: 'relative',
  width: EDITOR_FRAME_SIZE,
  height: EDITOR_FRAME_SIZE,
  boxSizing: 'border-box',
  ...tileBgStyle,
  border: '1px solid #2e2e4e',
  borderRadius: 6,
  overflow: 'hidden',
};

// Offsets the tama composite (+ its accessory, drawn as part of the same
// component — see TamaComposite) to sit centered within the bigger frame.
// width/height match EDITOR_CHAR_SIZE so this exactly matches the same
// bounding box the red rectangle marks (TamaComposite already sizes
// itself the same, so this is mostly just documentation at this point —
// TileOverlay lives one level up now, sized to the whole dragFrameStyle
// container instead of just this one).
const dragFrameCharStyle = {
  position: 'absolute',
  left: EDITOR_FRAME_PADDING,
  top: EDITOR_FRAME_PADDING,
  width: EDITOR_CHAR_SIZE,
  height: EDITOR_CHAR_SIZE,
};

// The red boundary rectangle marking the tama's own bounding box within
// the bigger frame — purely a visual reference, not interactive.
const dragFrameBoundsStyle = {
  position: 'absolute',
  left: EDITOR_FRAME_PADDING,
  top: EDITOR_FRAME_PADDING,
  width: EDITOR_CHAR_SIZE,
  height: EDITOR_CHAR_SIZE,
  border: '2px solid #ff3b3b',
  pointerEvents: 'none',
  boxSizing: 'border-box',
};

// Fixed to the viewport (not absolute against ShopTab's own
// position:relative wrapper, which this used to be) — ShopTab's wrapper is
// only as tall as its OWN content, which can be shorter than the toast's
// full visible/scrollable area, so centering within just that box could
// clip the dialog against contentStyle's overflow:auto (the bug Taylor
// screenshotted: the dialog's top, including the preview image, cut off
// by the scroll container). Same fixed/centered pattern TamadexToast's own
// outer backdrop uses, just a higher zIndex so it sits above the toast
// itself — a click outside the dialog card cancels, same as that one too.
const confirmBackdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(10, 4, 20, 0.85)',
  backdropFilter: 'blur(2px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 300,
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
  maxWidth: 280,
  textAlign: 'center',
};

// Two label/value rows, values right-aligned so the numbers line up.
const balanceTableStyle = {
  display: 'grid',
  gridTemplateColumns: 'auto auto',
  columnGap: 10,
  rowGap: 4,
  fontSize: 11,
  color: '#7070a0',
  textAlign: 'left',
};

const balanceValueStyle = {
  color: '#ffe066',
  textAlign: 'right',
};

const confirmTextStyle = {
  fontSize: 12,
  color: '#e0e0f0',
};
