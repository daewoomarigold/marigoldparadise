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

const ICON_URL = `${import.meta.env.BASE_URL}sprites/image-95.png`; // the gotchi coin — same icon used everywhere else for points

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

// changes: [{name, delta}] — one entry per student whose pending went up
// in this batch (see IslandView.jsx's pending-points effect, which already
// batches simultaneous increases — e.g. Award All — into one call here,
// same as it already does for the coin sound). `everyone` (set by that
// same caller, which is the one that knows the full roster) collapses the
// message to "Everyone +N" instead of listing every name — used when an
// Award All gave the whole class the same amount at once.
export function notifyPendingIncrease(changes, { everyone = false } = {}) {
  if (notificationPermission() !== 'granted' || changes.length === 0) return;
  const body = everyone ? `Everyone +${changes[0].delta}` : changes.map((c) => `${c.name} +${c.delta}`).join(', ');
  // No `tag` — each point-award gets its own popup instead of replacing
  // the last one, same as a chat app showing one toast per message.
  // silent: true — playAddPoint() already covers the sound; without this
  // Windows' own notification chime plays on top of it too.
  const n = new Notification('🪙 Points added', { body, icon: ICON_URL, silent: true });
  n.onclick = () => {
    window.focus(); // best-effort — browsers vary in how much they honor this
    n.close();
  };
}
