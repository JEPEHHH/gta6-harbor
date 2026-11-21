// The 2.5D architectural renderer: buildings extrude away from the camera centre with
// directional sun shadows, glowing night window grids, parapets, rooftop equipment
// (AC units, vents, water tanks, skylights, helipads), storefront awnings, construction
// fencing, dockside neon signs, and detailed street props.

import { PALETTE } from './config.js';
import { TAU, hash01, lerp, shade } from './util.js';
import { drawCastRectShadow, drawSoftDropShadow } from './lighting.js';

const LEAN = 0.0012; // roof offset per unit of height per unit of distance from the camera

function quad(ctx, x1, y1, x2, y2, ox, oy) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 + ox, y2 + oy);
  ctx.lineTo(x1 + ox, y1 + oy);
  ctx.closePath();
}

function drawWallWindows(ctx, b, x1, y1, x2, y2, ox, oy, floors, cols, wall, night, dusk) {
  const glowAmt = Math.max(night, dusk * 0.72);
  const lit = glowAmt > 0.16;

  // Floor slab spandrel bands for crisp architectural rhythm
  ctx.strokeStyle = 'rgba(20, 26, 36, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let f = 1; f < floors; f += 1) {
    const tf = f / floors;
    ctx.moveTo(x1 + ox * tf, y1 + oy * tf);
    ctx.lineTo(x2 + ox * tf, y2 + oy * tf);
  }
  ctx.stroke();

  for (let f = 0; f < floors; f += 1) {
    const t0 = (f + 0.2) / floors;
    const t1 = (f + 0.76) / floors;
    for (let c = 0; c < cols; c += 1) {
      const s0 = (c + 0.18) / cols;
      const s1 = (c + 0.82) / cols;
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

      const h = hash01(b.seed + f * 131 + c * 17 + wall * 7);
      const on = lit && h < (0.48 + night * 0.14);
      if (on) {
        const tone = hash01(b.seed + f * 53 + c * 29);
        const alpha = 0.65 + glowAmt * 0.35;
        if (tone < 0.68) ctx.fillStyle = `rgba(255, 214, 126, ${alpha.toFixed(3)})`;
        else if (tone < 0.88) ctx.fillStyle = `rgba(255, 238, 194, ${alpha.toFixed(3)})`;
        else ctx.fillStyle = `rgba(130, 224, 232, ${(alpha * 0.85).toFixed(3)})`;
      } else {
        // Cool sky-tinted glass by day, deep slate by night
        ctx.fillStyle = night > 0.45
          ? 'rgba(18, 26, 40, 0.56)'
          : (h < 0.35 ? 'rgba(66, 102, 126, 0.44)' : 'rgba(34, 52, 70, 0.46)');
      }
      ctx.fill();
    }
  }
}

/** Draw striped street-level storefront awnings attached to the building footprint. */
function drawAwning(ctx, b) {
  if (!b.awning) return;
  const [c1, c2] = b.awning;
  ctx.save();
  if (b.awningSide === 'south') {
    const aw = Math.min(b.w - 14, 72);
    const ax = b.x + (b.w - aw) * 0.5;
    const ay = b.y + b.h;
    const ah = 11;
    // Soft shadow cast on sidewalk
    ctx.fillStyle = 'rgba(14, 18, 28, 0.25)';
    ctx.fillRect(ax + 2, ay + 3, aw, ah + 2);
    const stripes = Math.max(4, Math.floor(aw / 8));
    const sw = aw / stripes;
    for (let i = 0; i < stripes; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? c1 : c2;
      ctx.fillRect(ax + i * sw, ay, sw + 0.4, ah);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(ax, ay + ah - 2.5, aw, 2.5);
  } else {
    const ah = Math.min(b.h - 14, 68);
    const ay = b.y + (b.h - ah) * 0.5;
    const ax = b.x - 11;
    const aw = 11;
    ctx.fillStyle = 'rgba(14, 18, 28, 0.25)';
    ctx.fillRect(ax + 2, ay + 3, aw, ah + 2);
    const stripes = Math.max(4, Math.floor(ah / 8));
    const sh = ah / stripes;
    for (let i = 0; i < stripes; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? c1 : c2;
      ctx.fillRect(ax, ay + i * sh, aw, sh + 0.4);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(ax, ay, 2.5, ah);
  }
  ctx.restore();
}

/** Draw rooftop parapet lip + HVAC AC units, vents, water tanks, skylights and helipads. */
function drawRooftopDetails(ctx, b, rx, ry, sun) {
  if (b.kind === 'container') {
    // Corrugated steel ribs & corner castings
    ctx.strokeStyle = shade(b.color, 0.72);
    ctx.lineWidth = 1.2;
    for (let k = 1; k < 6; k += 1) {
      const lx = rx + (b.w * k) / 6;
      ctx.beginPath();
      ctx.moveTo(lx, ry + 2);
      ctx.lineTo(lx, ry + b.h - 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(rx + 2, ry + 2, b.w - 4, 3);
    ctx.fillStyle = 'rgba(30, 34, 40, 0.45)';
    ctx.fillRect(rx, ry, 4, 4);
    ctx.fillRect(rx + b.w - 4, ry, 4, 4);
    ctx.fillRect(rx, ry + b.h - 4, 4, 4);
    ctx.fillRect(rx + b.w - 4, ry + b.h - 4, 4, 4);
    return;
  }

  if (b.kind === 'warehouse') {
    // Ribbed metal roof with central ridge & industrial turbine vents
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(rx + 2, ry + 2, b.w - 4, b.h * 0.5 - 2);
    ctx.strokeStyle = 'rgba(32, 38, 46, 0.35)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 6; k += 1) {
      const ly = ry + (b.h * k) / 6;
      ctx.beginPath();
      ctx.moveTo(rx + 3, ly);
      ctx.lineTo(rx + b.w - 3, ly);
      ctx.stroke();
    }
    // Roof skylights + round exhaust vents
    for (let v = 0; v < 4; v += 1) {
      const vx = rx + 34 + v * 58;
      const vy = ry + 26;
      ctx.fillStyle = 'rgba(18, 24, 34, 0.28)';
      ctx.beginPath();
      ctx.arc(vx + 2, vy + 2, 7.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#aeb6bd';
      ctx.beginPath();
      ctx.arc(vx, vy, 7, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#535c66';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#5c6670';
      ctx.beginPath();
      ctx.arc(vx, vy, 2.5, 0, TAU);
      ctx.fill();
    }
    return;
  }

  if (b.kind === 'house') {
    // Pitched hipped roof ridge with sunlit slope + shaded slope & brick chimney
    const midY = ry + b.h * 0.5;
    ctx.fillStyle = 'rgba(255, 246, 224, 0.16)';
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + b.w, ry);
    ctx.lineTo(rx + b.w - 14, midY);
    ctx.lineTo(rx + 14, midY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(18, 22, 32, 0.18)';
    ctx.beginPath();
    ctx.moveTo(rx + 14, midY);
    ctx.lineTo(rx + b.w - 14, midY);
    ctx.lineTo(rx + b.w, ry + b.h);
    ctx.lineTo(rx, ry + b.h);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 248, 232, 0.32)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(rx + 14, midY);
    ctx.lineTo(rx + b.w - 14, midY);
    ctx.stroke();

    // Brick chimney with tiny drop shadow
    ctx.fillStyle = 'rgba(18, 20, 28, 0.3)';
    ctx.fillRect(rx + b.w - 14, ry + 8, 9, 9);
    ctx.fillStyle = '#735144';
    ctx.fillRect(rx + b.w - 16, ry + 6, 8, 8);
    ctx.fillStyle = '#2d2624';
    ctx.fillRect(rx + b.w - 14, ry + 8, 4, 4);
    return;
  }

  // Parapet wall bezel around tower / flat / hotel rooftops
  const pad = 5;
  ctx.fillStyle = shade(b.roof, 0.86);
  ctx.fillRect(rx + pad, ry + pad, b.w - pad * 2, b.h - pad * 2);
  ctx.strokeStyle = 'rgba(255, 250, 238, 0.28)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(rx + 1, ry + 1, b.w - 2, b.h - 2);
  ctx.strokeStyle = 'rgba(20, 24, 34, 0.36)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(rx + pad, ry + pad, b.w - pad * 2, b.h - pad * 2);

  // Subtle roof tar seam lines
  ctx.strokeStyle = 'rgba(30, 34, 42, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rx + pad, ry + b.h * 0.5);
  ctx.lineTo(rx + b.w - pad, ry + b.h * 0.5);
  ctx.stroke();

  const h1 = hash01(b.seed);
  const h2 = hash01(b.seed + 9);
  const sdx = sun ? sun.dx * 16 : 3;
  const sdy = sun ? sun.dy * 16 : 3;

  // HVAC / AC units with fan grilles & shadows
  const acX = rx + 10 + h1 * Math.max(8, b.w - 44);
  const acY = ry + 10 + h2 * Math.max(8, b.h - 36);
  ctx.fillStyle = 'rgba(14, 18, 28, 0.32)';
  ctx.fillRect(acX + sdx * 0.6, acY + sdy * 0.6, 20, 14);
  ctx.fillStyle = '#c5c7c9';
  ctx.fillRect(acX, acY, 20, 14);
  ctx.strokeStyle = '#687078';
  ctx.lineWidth = 1;
  ctx.strokeRect(acX + 0.5, acY + 0.5, 19, 13);
  ctx.fillStyle = '#404850';
  ctx.beginPath();
  ctx.arc(acX + 6, acY + 7, 4, 0, TAU);
  ctx.arc(acX + 14.5, acY + 7, 4, 0, TAU);
  ctx.fill();

  // Secondary rooftop vent / duct box
  const vx = rx + 10 + h2 * Math.max(8, b.w - 30);
  const vy = ry + b.h - 24 - h1 * Math.max(6, b.h * 0.25);
  ctx.fillStyle = 'rgba(14, 18, 28, 0.26)';
  ctx.fillRect(vx + 2, vy + 2, 12, 10);
  ctx.fillStyle = '#9aa0a6';
  ctx.fillRect(vx, vy, 12, 10);
  ctx.fillStyle = '#5a626a';
  ctx.fillRect(vx + 2, vy + 2, 8, 2);
  ctx.fillRect(vx + 2, vy + 6, 8, 2);

  // Elevated rooftop water tank on selected towers & flats
  if (b.hasWaterTank && b.ht <= 210) {
    const tx = rx + b.w - 24;
    const ty = ry + 22;
    ctx.fillStyle = 'rgba(12, 16, 24, 0.34)';
    ctx.beginPath();
    ctx.ellipse(tx + sdx * 0.9, ty + sdy * 0.9, 11, 9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#926f4c';
    ctx.beginPath();
    ctx.arc(tx, ty, 10, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#5a422b';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Conical cap highlight
    ctx.fillStyle = '#b99770';
    ctx.beginPath();
    ctx.arc(tx - 1.5, ty - 1.5, 5, 0, TAU);
    ctx.fill();
  } else if (b.hasSkylight) {
    const sw = Math.min(34, b.w * 0.34);
    const sh = Math.min(20, b.h * 0.22);
    const sx = rx + (b.w - sw) * 0.5;
    const sy = ry + (b.h - sh) * 0.5;
    ctx.fillStyle = '#3b6a7c';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = 'rgba(180, 232, 244, 0.32)';
    ctx.fillRect(sx + 2, sy + 2, sw * 0.45, sh - 4);
    ctx.strokeStyle = '#d4d0c4';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(sx, sy, sw, sh);
  }

  // Helipad on tall skyscrapers
  if (b.ht > 210) {
    const hcx = rx + b.w * 0.5;
    const hcy = ry + b.h * 0.5;
    const r = Math.min(b.w, b.h) * 0.28;
    ctx.fillStyle = 'rgba(46, 52, 60, 0.42)';
    ctx.beginPath();
    ctx.arc(hcx, hcy, r + 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#f2c84b';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(hcx, hcy, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(246, 244, 236, 0.72)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(hcx, hcy, r - 4, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f4f2e8';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', hcx, hcy + 1);
  }
}

export function drawBuilding(ctx, b, cam, night, sun, dusk = 0) {
  const cx = b.x + b.w * 0.5;
  const cy = b.y + b.h * 0.5;
  const ox = (cx - cam.x) * b.ht * LEAN;
  const oy = (cy - cam.y) * b.ht * LEAN;

  // Directional sun shadow cast across the street & sidewalks
  if (sun) {
    drawCastRectShadow(ctx, b.x, b.y, b.w, b.h, b.ht, sun);
  } else {
    ctx.fillStyle = `rgba(18, 22, 34, ${0.22 * (1 - night * 0.6)})`;
    ctx.fillRect(b.x + 5 + b.ht * 0.12, b.y + 7 + b.ht * 0.14, b.w, b.h);
  }

  // Street-level storefront awnings before walls extrude above them
  drawAwning(ctx, b);

  const windows = b.ht >= 46 && b.kind !== 'warehouse' && b.kind !== 'container';
  const floors = Math.max(1, Math.floor(b.ht / 26));
  const sunWarm = dusk > 0.2 ? 1.04 : 1.0;

  if (ox > 0.5) {
    quad(ctx, b.x, b.y, b.x, b.y + b.h, ox, oy);
    ctx.fillStyle = shade(b.color, 0.64 * sunWarm);
    ctx.fill();
    if (windows) drawWallWindows(ctx, b, b.x, b.y, b.x, b.y + b.h, ox, oy, floors, Math.max(1, Math.floor(b.h / 26)), 0, night, dusk);
  } else if (ox < -0.5) {
    quad(ctx, b.x + b.w, b.y, b.x + b.w, b.y + b.h, ox, oy);
    ctx.fillStyle = shade(b.color, 0.74 * sunWarm);
    ctx.fill();
    if (windows) drawWallWindows(ctx, b, b.x + b.w, b.y, b.x + b.w, b.y + b.h, ox, oy, floors, Math.max(1, Math.floor(b.h / 26)), 1, night, dusk);
  }
  if (oy > 0.5) {
    quad(ctx, b.x, b.y, b.x + b.w, b.y, ox, oy);
    ctx.fillStyle = shade(b.color, 0.88 * sunWarm);
    ctx.fill();
    if (windows) drawWallWindows(ctx, b, b.x, b.y, b.x + b.w, b.y, ox, oy, floors, Math.max(1, Math.floor(b.w / 26)), 2, night, dusk);
  } else if (oy < -0.5) {
    quad(ctx, b.x, b.y + b.h, b.x + b.w, b.y + b.h, ox, oy);
    ctx.fillStyle = shade(b.color, 0.54);
    ctx.fill();
    if (windows) drawWallWindows(ctx, b, b.x, b.y + b.h, b.x + b.w, b.y + b.h, ox, oy, floors, Math.max(1, Math.floor(b.w / 26)), 3, night, dusk);
  }

  // Roof deck
  const rx = b.x + ox;
  const ry = b.y + oy;
  const roofColor = b.kind === 'container' ? shade(b.color, 1.12) : b.roof;
  ctx.fillStyle = roofColor;
  ctx.fillRect(rx, ry, b.w, b.h);
  ctx.strokeStyle = 'rgba(24, 28, 36, 0.42)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 0.5, ry + 0.5, b.w - 1, b.h - 1);

  drawRooftopDetails(ctx, b, rx, ry, sun);
}

/** Draw fenced construction lots with gravel pads, timber beams, hazard posts and safety cones. */
export function drawConstructionLot(ctx, lot) {
  ctx.save();
  // Graded dirt & gravel pad
  ctx.fillStyle = '#9c8f78';
  ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
  ctx.fillStyle = '#857964';
  ctx.fillRect(lot.x + 8, lot.y + 8, lot.w - 16, lot.h - 16);

  // Foundation slab outline & stacked steel/timber beams
  ctx.strokeStyle = 'rgba(232, 224, 204, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(lot.x + 14, lot.y + 14, lot.w - 28, lot.h - 28);
  ctx.setLineDash([]);

  // Stacked wooden planks & steel rebar
  ctx.fillStyle = '#b88248';
  ctx.fillRect(lot.x + 18, lot.y + 20, 32, 5);
  ctx.fillRect(lot.x + 20, lot.y + 27, 30, 5);
  ctx.fillStyle = '#6c7680';
  ctx.fillRect(lot.x + lot.w - 42, lot.y + lot.h - 26, 26, 6);

  // Chain-link perimeter fencing with hazard yellow/orange posts
  ctx.strokeStyle = 'rgba(218, 224, 228, 0.72)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(lot.x + 1, lot.y + 1, lot.w - 2, lot.h - 2);

  // Diagonal hazard stripe corner barriers
  const corners = [
    [lot.x, lot.y],
    [lot.x + lot.w, lot.y],
    [lot.x, lot.y + lot.h],
    [lot.x + lot.w, lot.y + lot.h],
  ];
  for (const [px, py] of corners) {
    ctx.fillStyle = '#e89028';
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff5d8';
    ctx.beginPath();
    ctx.arc(px, py, 1.2, 0, TAU);
    ctx.fill();
  }

  // Fence posts along edges
  ctx.fillStyle = '#5c646c';
  for (let x = lot.x + 18; x < lot.x + lot.w - 8; x += 20) {
    ctx.fillRect(x - 1, lot.y - 1.5, 2.5, 3);
    ctx.fillRect(x - 1, lot.y + lot.h - 1.5, 2.5, 3);
  }
  for (let y = lot.y + 18; y < lot.y + lot.h - 8; y += 20) {
    ctx.fillRect(lot.x - 1.5, y - 1, 3, 2.5);
    ctx.fillRect(lot.x + lot.w - 1.5, y - 1, 3, 2.5);
  }
  ctx.restore();
}

/** Draw mounted dockside and downtown neon sign housings and glowing tubes. */
export function drawNeonSign(ctx, n, night, dusk, t) {
  const flicker = n.flicker && Math.sin(t * 23 + n.ph) > 0.92 ? 0.5 : 1;
  const intensity = Math.min(1, 0.45 + night * 0.55 + dusk * 0.45) * flicker;
  ctx.save();
  // Dark metal backing cabinet
  ctx.fillStyle = '#181c26';
  ctx.fillRect(n.x - n.w * 0.5, n.y - n.h * 0.5, n.w, n.h);
  // Outer neon glow tube
  ctx.strokeStyle = n.hex;
  ctx.globalAlpha = intensity;
  ctx.lineWidth = 2.6;
  ctx.strokeRect(n.x - n.w * 0.5 + 1.5, n.y - n.h * 0.5 + 1.5, n.w - 3, n.h - 3);
  // Hot white-tinted inner tube core
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = intensity * 0.85;
  if (n.orient === 'h') {
    ctx.fillRect(n.x - n.w * 0.36, n.y - 1.3, n.w * 0.72, 2.6);
  } else {
    ctx.fillRect(n.x - 1.3, n.y - n.h * 0.36, 2.6, n.h * 0.72);
  }
  ctx.restore();
}

export function drawProp(ctx, p, night, t, sun) {
  const sdx = sun ? sun.dx * 34 : 7;
  const sdy = sun ? sun.dy * 34 : 5;

  if (p.kind === 'palm') {
    const s = p.s ?? 1;
    const sway = Math.sin(t * 1.1 + p.ph) * 2.2 * s;
    // Long directional palm shadow
    ctx.save();
    ctx.fillStyle = `rgba(12, 16, 26, ${(sun ? sun.alpha * 0.85 : 0.2).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(p.x + sdx * s * 0.9, p.y + sdy * s * 0.9, 16 * s, 7 * s, Math.atan2(sdy, sdx), 0, TAU);
    ctx.fill();
    ctx.restore();

    const topX = p.x + sway;
    const topY = p.y - 34 * s;
    // Trunk with warm sunlit rim
    ctx.strokeStyle = PALETTE.trunk;
    ctx.lineWidth = 3.8 * s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + sway * 0.45, p.y - 19 * s, topX, topY);
    ctx.stroke();

    // Layered palm fronds: darker under-fronds + sunlit top fronds
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * TAU + p.ph * 0.3;
      const ex = topX + Math.cos(a) * 19 * s;
      const ey = topY + Math.sin(a) * 12.5 * s - 2;
      ctx.strokeStyle = k % 2 === 0 ? '#2b6f3b' : '#439c52';
      ctx.lineWidth = 3.0 * s;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * 10 * s, topY + Math.sin(a) * 6 * s - 7 * s, ex, ey);
      ctx.stroke();
    }
    ctx.fillStyle = '#5c3f24';
    ctx.beginPath();
    ctx.arc(topX, topY, 2.8 * s, 0, TAU);
    ctx.fill();
  } else if (p.kind === 'tree') {
    const s = p.s ?? 1;
    if (sun) {
      drawSoftDropShadow(ctx, p.x, p.y + 3, 15 * s, 8 * s, sun, 14 * s);
    } else {
      ctx.fillStyle = 'rgba(18, 22, 32, 0.2)';
      ctx.beginPath();
      ctx.ellipse(p.x + 6, p.y + 5, 15 * s, 7 * s, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#336835';
    ctx.beginPath();
    ctx.arc(p.x + 2 * s, p.y - 4 * s, 13.5 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(p.x - 5 * s, p.y - 5 * s, 10.5 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5da052';
    ctx.beginPath();
    ctx.arc(p.x + 6 * s, p.y - 7 * s, 9.5 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7fc26a';
    ctx.beginPath();
    ctx.arc(p.x - 2 * s, p.y - 10 * s, 6.2 * s, 0, TAU);
    ctx.fill();
  } else if (p.kind === 'lamp') {
    // Directional pole shadow
    ctx.strokeStyle = `rgba(12, 16, 26, ${(sun ? sun.alpha * 0.75 : 0.18).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + sdx * 0.55, p.y + sdy * 0.55);
    ctx.stroke();

    ctx.fillStyle = '#333942';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3d4550';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 16);
    ctx.stroke();
    // Overhanging sodium lamp arm
    const armX = p.x + (p.side ? p.side * 5 : 0);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 16);
    ctx.lineTo(armX, p.y - 16);
    ctx.stroke();
    ctx.fillStyle = night > 0.15 ? PALETTE.lamp : '#e4e2d6';
    ctx.beginPath();
    ctx.arc(armX, p.y - 16, 3.2, 0, TAU);
    ctx.fill();
  } else if (p.kind === 'crane') {
    const sway = Math.sin(t * 0.5 + p.ph) * 2.5;
    // Directional crane shadow
    ctx.fillStyle = `rgba(12, 16, 26, ${(sun ? sun.alpha * 0.9 : 0.22).toFixed(3)})`;
    ctx.fillRect(p.x - 16 + sdx * 0.8, p.y + 4 + sdy * 0.8, 52, 16);
    ctx.fillStyle = '#9e4f22';
    ctx.fillRect(p.x - 22, p.y - 9, 44, 18);
    ctx.strokeStyle = '#f2be42';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x - 21, p.y - 8, 42, 16);
    // Lattice tower mast
    ctx.strokeStyle = '#d96e26';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 6);
    ctx.lineTo(p.x + sway * 0.4, p.y - 98);
    ctx.stroke();
    ctx.strokeStyle = '#f09446';
    ctx.lineWidth = 1.5;
    for (let k = 16; k < 92; k += 14) {
      ctx.beginPath();
      ctx.moveTo(p.x - 3, p.y - k);
      ctx.lineTo(p.x + 3, p.y - k - 10);
      ctx.stroke();
    }
    // Boom arm
    ctx.strokeStyle = '#e07a2c';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(p.x - 38 + sway, p.y - 98);
    ctx.lineTo(p.x + 118 + sway, p.y - 98);
    ctx.stroke();
    // Counterweight & operator cab
    ctx.fillStyle = '#7e3c18';
    ctx.fillRect(p.x - 44 + sway, p.y - 104, 16, 13);
    ctx.fillStyle = '#384654';
    ctx.fillRect(p.x + 8 + sway, p.y - 95, 11, 10);
    // Hoist cable & spreader
    ctx.strokeStyle = '#3a4048';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(p.x + 84 + sway, p.y - 95);
    ctx.lineTo(p.x + 84 + sway, p.y - 44);
    ctx.stroke();
    ctx.fillStyle = '#e8a832';
    ctx.fillRect(p.x + 77 + sway, p.y - 46, 14, 6);
    // Blinking red aviation warning light on top
    if (Math.sin(t * 4 + p.ph) > -0.2) {
      ctx.fillStyle = '#ff3838';
      ctx.beginPath();
      ctx.arc(p.x + sway * 0.4, p.y - 104, 3, 0, TAU);
      ctx.fill();
    }
  } else if (p.kind === 'bench') {
    ctx.fillStyle = 'rgba(14, 18, 28, 0.22)';
    ctx.fillRect(p.x - 7, p.y + 2, 17, 6);
    ctx.fillStyle = '#8b6542';
    ctx.fillRect(p.x - 8, p.y - 3, 16, 6);
    ctx.fillStyle = '#a87d56';
    ctx.fillRect(p.x - 8, p.y - 3, 16, 2);
    ctx.fillStyle = '#403830';
    ctx.fillRect(p.x - 7, p.y + 3, 2, 2.5);
    ctx.fillRect(p.x + 5, p.y + 3, 2, 2.5);
  } else if (p.kind === 'hydrant') {
    ctx.fillStyle = 'rgba(14, 18, 28, 0.24)';
    ctx.beginPath();
    ctx.ellipse(p.x + 1.5, p.y + 1.5, 3.6, 2.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d14334';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2e0a4';
    ctx.beginPath();
    ctx.arc(p.x - 0.5, p.y - 0.8, 1.3, 0, TAU);
    ctx.fill();
  }
}
