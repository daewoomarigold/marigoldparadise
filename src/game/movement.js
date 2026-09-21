// Roaming movement physics — ported from the old gotchigarden.html's Pet
// class (see the gotchigarden repo, same project's previous rewrite).
// Original used a canvas + imperative Pet class; this is the same math as
// plain mutable-object functions instead, since the island renders via DOM
// (reusing TamaComposite) rather than canvas.
//
// Shape: mostly-horizontal wandering confined to a "ground band" at the
// bottom of the screen (the old code's minY/maxY), with vy scaled to 25%
// of vx's magnitude for a flattened side-view walk rather than free 2D
// movement, smooth steering (velocity eases toward a target instead of
// snapping), periodic re-aiming with a chance to stop and stand still, and
// boundary bouncing at the edges of both the ground band and the screen.
//
// Not from the old code: random "emotes." Every so often a roamer stops
// walking, plays the happy or jump_happy animation state (see
// animationStates.json) for a moment, then goes back to wandering — just
// life on the island, no trigger. Timings below are seconds (unlike the
// steering timers above, which count 60fps frames).

function randomAngle() {
  // Mostly facing left or right (0 or PI) with a bit of random spread,
  // not fully omnidirectional — matches the old code and suits a sprite
  // that only has one horizontal facing (mirrored for the other side).
  return (Math.random() > 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.6;
}

// How long each emote holds, and how fast jump_happy alternates its frames
// (happy is one static pose). The gap between one roamer's emotes is
// randomized per roamer so they don't all go off together — with a full
// class of 16 on screen, 15-40s each averages out to about one emote
// somewhere every couple of seconds, lively without being frantic; widen
// the range if it's too busy.
const EMOTE_DURATION = { happy: 1.6, jump_happy: 1.8 };
export const EMOTE_FPS = 5;
function randomEmoteCooldown() {
  return 15 + Math.random() * 25;
}

function randomSpeed() {
  // Was 0.9-1.575 (ported straight from the old gotchigarden.html, tuned
  // for its larger on-screen sprites) — read as "racing" now that sprites
  // render at native 32x32 instead of 3x upscaled. Slowed to a more
  // casual pace; adjust further if it still feels too fast/slow.
  return 0.35 + Math.random() * 0.3;
}

// getYBounds(x, spriteWidth, spriteHeight) => {minY, maxY}: the allowed
// vertical range for this roamer's TOP-LEFT corner at horizontal position
// x. Called fresh each step (not just once at creation) so the walkable
// range can narrow/shift as a roamer moves — e.g. terrain.js's forest
// carve-out — rather than being one fixed rectangle for the roamer's
// whole lifetime. See src/island/terrain.js for the background-specific
// implementation actually used.
export function createRoamer({ id, canvasWidth, spriteWidth, spriteHeight, getYBounds }) {
  const angle = randomAngle();
  const speed = randomSpeed();
  const x = 10 + Math.random() * Math.max(0, canvasWidth - spriteWidth - 20);
  const { minY, maxY } = getYBounds(x, spriteWidth, spriteHeight);
  return {
    id,
    x,
    y: minY + Math.random() * Math.max(0, maxY - minY),
    vx: Math.cos(angle) * speed,
    vy: 0,
    angle,
    speed,
    facingRight: Math.cos(angle) > 0,
    state: 'walk', // 'walk' | 'stand' | 'emote'
    emote: null, // while state === 'emote': { kind: 'happy' | 'jump_happy', elapsed, duration } (seconds)
    emoteCooldown: 3 + Math.random() * 22, // seconds until the next one starts — short first wait, staggered per roamer
    stateTimer: 30 + Math.floor(Math.random() * 60),
    steerTimer: 30 + Math.floor(Math.random() * 60),
    spriteWidth,
    spriteHeight,
    getYBounds,
    animFrame: 0, // which walk_left frame (0/1) is currently showing
    animTimer: 0,
  };
}

// Mutates `r` in place (matches the old code's style — called once per
// roamer per animation frame; not worth the allocation churn of returning
// new objects 60x/sec for a handful of on-screen tamas). dt is seconds
// since last frame; canvasWidth lets roamers bounce off the current
// container size (e.g. after a window resize).
export function stepRoamer(r, dt, canvasWidth) {
  if (r.emote) {
    r.emote.elapsed += dt;
    if (r.emote.elapsed >= r.emote.duration) {
      r.emote = null;
      r.state = 'walk';
      r.steerTimer = 30 + Math.random() * 60;
      r.emoteCooldown = randomEmoteCooldown();
    }
    return r; // holds still for the whole emote (vx/vy were zeroed when it started)
  }
  r.emoteCooldown -= dt;
  if (r.emoteCooldown <= 0) {
    const kind = Math.random() < 0.5 ? 'happy' : 'jump_happy';
    r.emote = { kind, elapsed: 0, duration: EMOTE_DURATION[kind] };
    r.state = 'emote';
    r.vx = 0;
    r.vy = 0;
    return r;
  }

  if (r.state === 'stand') {
    r.stateTimer -= dt * 60;
    if (r.stateTimer <= 0) {
      r.state = 'walk';
      r.steerTimer = 30 + Math.random() * 60;
    }
    return r;
  }

  r.steerTimer -= dt * 60;
  if (r.steerTimer <= 0) {
    if (Math.random() < 0.15) {
      r.state = 'stand';
      r.stateTimer = 20 + Math.random() * 30;
      r.vx = 0;
      r.vy = 0;
      return r;
    }
    const turn = (Math.random() - 0.5) * Math.PI * 0.78;
    r.angle += turn;
    r.speed = randomSpeed();
    r.steerTimer = 30 + Math.random() * 60;
  }

  const steer = 0.08;
  const targetVx = Math.cos(r.angle) * r.speed;
  const targetVy = Math.sin(r.angle) * r.speed * 0.25;
  r.vx += (targetVx - r.vx) * steer;
  r.vy += (targetVy - r.vy) * steer;
  r.x += r.vx * dt * 60;
  r.y += r.vy * dt * 60;

  // Re-derive bounds at the (possibly just-moved) x — the walkable Y range
  // can differ by column (see terrain.js), so this isn't one fixed
  // rectangle for the roamer's whole lifetime.
  const { minY, maxY } = r.getYBounds(r.x, r.spriteWidth, r.spriteHeight);

  if (r.x <= 0) {
    r.x = 0;
    r.vx = Math.abs(r.vx);
    r.angle = Math.atan2(r.vy, Math.abs(r.vx));
  }
  if (r.x >= canvasWidth - r.spriteWidth) {
    r.x = canvasWidth - r.spriteWidth;
    r.vx = -Math.abs(r.vx);
    r.angle = Math.atan2(r.vy, -Math.abs(r.vx));
  }
  if (r.y <= minY) {
    r.y = minY;
    r.vy = Math.abs(r.vy);
    r.angle = Math.atan2(Math.abs(r.vy), r.vx);
  }
  if (r.y >= maxY) {
    r.y = maxY;
    r.vy = -Math.abs(r.vy);
    r.angle = Math.atan2(-Math.abs(r.vy), r.vx);
  }
  if (Math.abs(r.vx) > 0.05) r.facingRight = r.vx > 0;

  return r;
}

// Advances the 2-frame walk cycle at a fixed rate (independent of the
// steering timers above) while walking; holds frame 0 while standing.
// fps matches roughly what looked right for the base seed states earlier
// in this project — adjust freely.
const WALK_FPS = 4;

export function stepAnim(r, dt) {
  if (r.state !== 'walk') {
    r.animFrame = 0;
    r.animTimer = 0;
    return r;
  }
  r.animTimer += dt;
  if (r.animTimer >= 1 / WALK_FPS) {
    r.animTimer = 0;
    r.animFrame = r.animFrame === 0 ? 1 : 0;
  }
  return r;
}
