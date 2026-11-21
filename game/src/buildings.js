// The 2.5D look: buildings extrude away from the camera centre, walls catch the sun, windows
// light up at night. Props (palms, trees, lamps, cranes, street furniture) draw the same way.

import { PALETTE } from './config.js';
import { TAU, hash01, lerp, shade } from './util.js';

const LEAN = 0.0012; // roof offset per unit of height per unit of distance from the camera

function quad(ctx, x1, y1, x2, y2, ox, oy) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 + ox, y2 + oy);
  ctx.lineTo(x1 + ox, y1 + oy);
  ctx.closePath();
}

function wallWindows(ctx, b, x1, y1, x2, y2, ox, oy, floors, cols, wall, night) {
  const lit = night > 0.25;
  for (let f = 0; f < floors; f += 1) {
    const t0 = (f + 0.22) / floors;
    const t1 = (f + 0.74) / floors;
    for (let c = 0; c < cols; c += 1) {
      const s0 = (c + 0.22) / cols;
      const s1 = (c + 0.78) / cols;
      const ax = lerp(x1, x2, s0);
      const ay = lerp(y1, y2, s0);
      const bx = lerp(x1, x2, s1);
      const by = lerp(y1, y2, s1);
      ctx.beginPath();
      ctx.moveTo(ax + ox * t0, ay + oy * t0);
      ctx.lineTo(bx + ox * t0, by + oy * t0);
      ctx.lineTo(bx + ox * t1, by + oy * t1);
      ctx.lineTo(ax + ox * t1, ay + oy * t1);
      ctx.closePath();
      const on = lit && hash01(b.seed + f * 131 + c * 17 + wall * 7) < 0.5;
      ctx.fillStyle = on ? `rgba(255,217,138,${0.85 * night})` : 'rgba(28,40,54,0.34)';
      ctx.fill();
    }
  }
}

export function drawBuilding(ctx, b, cam, night) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const ox = (cx - cam.x) * b.ht * LEAN;
  const oy = (cy - cam.y) * b.ht * LEAN;

  // Cast shadow, sun from the north-west.
  ctx.fillStyle = `rgba(24,28,38,${0.2 * (1 - night * 0.65)})`;
  ctx.fillRect(b.x + 5 + b.ht * 0.1, b.y + 7 + b.ht * 0.13, b.w, b.h);

  const windows = b.ht >= 60 && b.kind !== 'warehouse';
  const floors = Math.max(1, Math.floor(b.ht / 26));
  if (ox > 0.5) {
    quad(ctx, b.x, b.y, b.x, b.y + b.h, ox, oy);
    ctx.fillStyle = shade(b.color, 0.62);
    ctx.fill();
    if (windows) wallWindows(ctx, b, b.x, b.y, b.x, b.y + b.h, ox, oy, floors, Math.max(1, Math.floor(b.h / 26)), 0, night);
  } else if (ox < -0.5) {
    quad(ctx, b.x + b.w, b.y, b.x + b.w, b.y + b.h, ox, oy);
    ctx.fillStyle = shade(b.color, 0.72);
    ctx.fill();
    if (windows) wallWindows(ctx, b, b.x + b.w, b.y, b.x + b.w, b.y + b.h, ox, oy, floors, Math.max(1, Math.floor(b.h / 26)), 1, night);
  }
  if (oy > 0.5) {
    quad(ctx, b.x, b.y, b.x + b.w, b.y, ox, oy);
    ctx.fillStyle = shade(b.color, 0.84);
    ctx.fill();
    if (windows) wallWindows(ctx, b, b.x, b.y, b.x + b.w, b.y, ox, oy, floors, Math.max(1, Math.floor(b.w / 26)), 2, night);
  } else if (oy < -0.5) {
    quad(ctx, b.x, b.y + b.h, b.x + b.w, b.y + b.h, ox, oy);
    ctx.fillStyle = shade(b.color, 0.55);
    ctx.fill();
    if (windows) wallWindows(ctx, b, b.x, b.y + b.h, b.x + b.w, b.y + b.h, ox, oy, floors, Math.max(1, Math.floor(b.w / 26)), 3, night);
  }

  // Roof.
  const rx = b.x + ox;
  const ry = b.y + oy;
  const roofColor = b.kind === 'container' ? shade(b.color, 1.12) : b.roof;
  ctx.fillStyle = roofColor;
  ctx.fillRect(rx, ry, b.w, b.h);
  ctx.strokeStyle = 'rgba(30,34,40,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 0.5, ry + 0.5, b.w - 1, b.h - 1);

  if (b.kind === 'container') {
    ctx.strokeStyle = shade(b.color, 0.78);
    for (let k = 1; k < 5; k += 1) {
      const lx = rx + (b.w * k) / 5;
      ctx.beginPath();
      ctx.moveTo(lx, ry + 2);
      ctx.lineTo(lx, ry + b.h - 2);
      ctx.stroke();
    }
  } else if (b.kind === 'warehouse') {
    ctx.strokeStyle = 'rgba(40,46,52,0.4)';
    for (let k = 1; k < 4; k += 1) {
      const ly = ry + (b.h * k) / 4;
      ctx.beginPath();
      ctx.moveTo(rx + 3, ly);
      ctx.lineTo(rx + b.w - 3, ly);
      ctx.stroke();
    }
  } else if (b.kind === 'house') {
    ctx.fillStyle = 'rgba(60,50,44,0.7)';
    ctx.fillRect(rx + b.w - 12, ry + 4, 7, 7);
  } else if (b.kind === 'tower' || b.kind === 'flat' || b.kind === 'hotel') {
    ctx.fillStyle = 'rgba(90,94,100,0.85)';
    const h1 = hash01(b.seed);
    const h2 = hash01(b.seed + 9);
    ctx.fillRect(rx + 6 + h1 * (b.w - 26), ry + 6 + h2 * (b.h - 22), 16, 12);
    ctx.fillRect(rx + 6 + h2 * (b.w - 22), ry + 6 + h1 * (b.h - 20), 10, 10);
    if (b.ht > 210) {
      const r = Math.min(b.w, b.h) * 0.26;
      ctx.strokeStyle = 'rgba(240,238,228,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rx + b.w / 2, ry + b.h / 2, r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(240,238,228,0.9)';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', rx + b.w / 2, ry + b.h / 2 + 1);
    }
  }
}

export function drawProp(ctx, p, night, t) {
  if (p.kind === 'palm') {
    const s = p.s ?? 1;
    const sway = Math.sin(t * 1.1 + p.ph) * 2.2 * s;
    ctx.fillStyle = 'rgba(24,28,38,0.18)';
    ctx.beginPath();
    ctx.ellipse(p.x + 7, p.y + 4, 14 * s, 6 * s, 0, 0, TAU);
    ctx.fill();
    const topX = p.x + sway;
    const topY = p.y - 32 * s;
    ctx.strokeStyle = PALETTE.trunk;
    ctx.lineWidth = 3.5 * s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + sway * 0.4, p.y - 18 * s, topX, topY);
    ctx.stroke();
    ctx.lineWidth = 2.6 * s;
    for (let k = 0; k < 7; k += 1) {
      const a = (k / 7) * TAU + p.ph * 0.3;
      const ex = topX + Math.cos(a) * 17 * s;
      const ey = topY + Math.sin(a) * 11 * s - 3;
      ctx.strokeStyle = k % 2 ? PALETTE.palm : '#357a43';
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * 9 * s, topY + Math.sin(a) * 6 * s - 6 * s, ex, ey);
      ctx.stroke();
    }
    ctx.fillStyle = '#6a4a2a';
    ctx.beginPath();
    ctx.arc(topX, topY, 2.4 * s, 0, TAU);
    ctx.fill();
  } else if (p.kind === 'tree') {
    const s = p.s ?? 1;
    ctx.fillStyle = 'rgba(24,28,38,0.18)';
    ctx.beginPath();
    ctx.ellipse(p.x + 6, p.y + 5, 15 * s, 7 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 6 * s, 13 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5fa254';
    ctx.beginPath();
    ctx.arc(p.x - 7 * s, p.y - 2 * s, 9 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6fb35f';
    ctx.beginPath();
    ctx.arc(p.x + 7 * s, p.y - 3 * s, 9 * s, 0, TAU);
    ctx.fill();
  } else if (p.kind === 'lamp') {
    ctx.fillStyle = '#3a3f45';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3a3f45';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 13);
    ctx.stroke();
    ctx.fillStyle = night > 0.2 ? PALETTE.lamp : '#d8d8d0';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 14, 3, 0, TAU);
    ctx.fill();
  } else if (p.kind === 'crane') {
    const sway = Math.sin(t * 0.5 + p.ph) * 3;
    ctx.fillStyle = 'rgba(24,28,38,0.2)';
    ctx.fillRect(p.x - 16, p.y + 4, 44, 12);
    ctx.fillStyle = '#b5622a';
    ctx.fillRect(p.x - 20, p.y - 8, 40, 16);
    ctx.strokeStyle = '#d97b29';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 6);
    ctx.lineTo(p.x + sway * 0.4, p.y - 96);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(p.x - 34 + sway, p.y - 96);
    ctx.lineTo(p.x + 112 + sway, p.y - 96);
    ctx.stroke();
    ctx.fillStyle = '#8f4a1e';
    ctx.fillRect(p.x - 40 + sway, p.y - 102, 14, 12);
    ctx.strokeStyle = '#4a4f55';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x + 82 + sway, p.y - 94);
    ctx.lineTo(p.x + 82 + sway, p.y - 46);
    ctx.stroke();
    ctx.fillStyle = '#4a4f55';
    ctx.fillRect(p.x + 78 + sway, p.y - 46, 8, 6);
  } else if (p.kind === 'bench') {
    ctx.fillStyle = 'rgba(24,28,38,0.16)';
    ctx.fillRect(p.x - 7, p.y + 2, 16, 5);
    ctx.fillStyle = '#8a6a48';
    ctx.fillRect(p.x - 8, p.y - 3, 16, 6);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(p.x - 7, p.y + 3, 2, 2);
    ctx.fillRect(p.x + 5, p.y + 3, 2, 2);
  } else if (p.kind === 'hydrant') {
    ctx.fillStyle = '#c94a3a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8d8a0';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 1, 1.2, 0, TAU);
    ctx.fill();
  }
}
