// Maths, seeded randomness, easing and geometry helpers shared by every system.

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Frame-rate independent approach: the same feel at 30 or 144 fps. */
export function damp(a, b, rate, dt) {
  return lerp(a, b, 1 - Math.exp(-rate * dt));
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

export function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** sfc32 seeded generator: one seed, one city, every time. */
export function makeRng(seed) {
  let a = seed >>> 0;
  let b = (Math.imul(seed, 0x9e3779b9) ^ 0x1234567) >>> 0;
  let c = (seed ^ 0xdeadbeef) >>> 0;
  let d = (seed + 0x165667b1) >>> 0;
  function next() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  for (let i = 0; i < 15; i += 1) next();
  return next;
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function int(rng, lo, hi) {
  return Math.floor(range(rng, lo, hi + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Deterministic 0..1 hash of an integer — window lights, roof clutter, waves. */
export function hash01(n) {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleHitsRect(x, y, radius, r) {
  const cx = clamp(x, r.x, r.x + r.w);
  const cy = clamp(y, r.y, r.y + r.h);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < radius * radius;
}

export function mixColor(hexA, hexB, t) {
  const pa = Number.parseInt(hexA.slice(1), 16);
  const pb = Number.parseInt(hexB.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const b = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${b})`;
}

export function shade(hex, factor) {
  const p = Number.parseInt(hex.slice(1), 16);
  const r = Math.round(clamp(((p >> 16) & 255) * factor, 0, 255));
  const g = Math.round(clamp(((p >> 8) & 255) * factor, 0, 255));
  const b = Math.round(clamp((p & 255) * factor, 0, 255));
  return `rgb(${r},${g},${b})`;
}

export function formatMoney(n) {
  return '$' + Math.max(0, Math.floor(n)).toLocaleString('en-US');
}

export function formatClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
