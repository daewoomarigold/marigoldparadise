// Desktop notifications for points landing in a student's pending bucket —
// the Notification API's version of what sound.js's audio-unlock dance
// exists for: the island is meant to sit backgrounded behind other apps
// (slides, say), and this is how Taylor finds out a point registered
// without having that window in focus. Unlike audio, the browser's grant
// here is permanent per-origin — no per-page-load unlock, just ask once
// (see requestNotificationPermission, wired to a button same as the sound
// one). Not supported in Safari on iOS at all; fine for this app's actual
// use (a real browser running the island), but worth knowing if that ever
// changes.

import { resolveDisplayTama } from './game/growth.js';
import { resolveAnimState } from './game/spriteData.js';
import { renderTamaToDataUrl } from './game/spriteRaster.js';

const COIN_ICON_URL = `${import.meta.env.BASE_URL}sprites/image-95.png`; // the gotchi coin — the default/fallback icon
const HAPPY = resolveAnimState('happy');
const ICON_RENDER_SCALE = 6; // mini sprites are 32x32 — this is what actually determines sharpness (see spriteRaster.js), not the small size the OS displays it at

export function notificationsSupported() {
  return typeof Notification !== 'undefined';
}

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export function requestNotificationPermission() {
  if (!notificationsSupported()) return Promise.resolve('unsupported');
  return Notification.requestPermission();
}

// changes: [{student, delta}] — one entry per student whose pending went
// up in this batch (see IslandView.jsx's pending-points effect, which
// already batches simultaneous increases — e.g. Award All — into one call
// here, same as it already does for the coin sound); student is the full
// object, not just a name, so its field/display tama can become the icon
// below. `everyone` (set by that same caller, which is the one that knows
// the full roster) collapses the message to "Everyone +N" instead of
// listing every name — used when an Award All gave the whole class the
// same amount at once.
export async function notifyPendingIncrease(changes, { everyone = false } = {}) {
  if (notificationPermission() !== 'granted' || changes.length === 0) return;
  const body = everyone ? `Everyone +${changes[0].delta}` : changes.map((c) => `${c.student.name} +${c.delta}`).join(', ');

  // A single (non-"everyone") award gets that student's own field/display
  // tama (growth.js's resolveDisplayTama — the SAME one shown roaming, not
  // necessarily what's growing, see StudentGrid.jsx's asymmetric-design
  // note) as the icon, in its happy pose, instead of the generic coin.
  // Falls back to the coin whenever there isn't a real one to show: a
  // batch of more than one student (no single "the" student to pick), or
  // an egg-stage student (eggs never appear on the field at all, so there
  // genuinely isn't a field tama yet), or the render just failing for any
  // reason — not worth surfacing an error over a notification icon.
  let icon = COIN_ICON_URL;
  if (!everyone && changes.length === 1) {
    const { tamaId, stage } = resolveDisplayTama(changes[0].student);
    if (stage !== 'egg') {
      try {
        const dataUrl = await renderTamaToDataUrl(
          tamaId,
          'mini',
          { body: HAPPY.body[0], eyes: HAPPY.eyes[0], mouth: HAPPY.mouth[0] },
          ICON_RENDER_SCALE,
        );
        if (dataUrl) icon = dataUrl;
      } catch {
        // sprite sheet failed to load/decode — coin icon already set above
      }
    }
  }

  // No `tag` — each point-award gets its own popup instead of replacing
  // the last one, same as a chat app showing one toast per message.
  // silent: true — playAddPoint() already covers the sound; without this
  // Windows' own notification chime plays on top of it too.
  const n = new Notification('🪙 Points added', { body, icon, silent: true });
  n.onclick = () => {
    window.focus(); // best-effort — browsers vary in how much they honor this
    n.close();
  };
}
