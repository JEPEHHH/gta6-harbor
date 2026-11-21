// Procedural Canvas2D renderer for street furniture, foliage, signage, fences, dock cargo
// and beach clutter. Every prop casts grounded contact and directional sun shadows.

import { PALETTE } from './config.js';
import { TAU, hash01 } from './util.js';
import { drawSoftDropShadow } from './lighting.js';

/** Draw yard fences, park iron railings, dock chain-link fences and hedges. */
export function drawFence(ctx, f, sun) {
  const sdx = sun ? sun.dx * 7 : 2;
  const sdy = sun ? sun.dy * 7 : 2;
  ctx.save();
  // Ground shadow cast by fence
  ctx.strokeStyle = `rgba(12, 16, 26, ${(sun ? sun.alpha * 0.75 : 0.18).toFixed(3)})`;
  ctx.lineWidth = f.kind === 'hedge' ? 6 : 2.5;
  ctx.beginPath();
  ctx.moveTo(f.x1 + sdx, f.y1 + sdy);
  ctx.lineTo(f.x2 + sdx, f.y2 + sdy);
  ctx.stroke();

  if (f.kind === 'hedge') {
    ctx.strokeStyle = '#336434';
    ctx.lineCap = 'round';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(f.x1, f.y1);
    ctx.lineTo(f.x2, f.y2);
    ctx.stroke();
    ctx.strokeStyle = '#569448';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(f.x1 - 0.5, f.y1 - 0.8);
    ctx.lineTo(f.x2 - 0.5, f.y2 - 0.8);
    ctx.stroke();
  } else if (f.kind === 'wood') {
    ctx.strokeStyle = '#8b6845';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(f.x1, f.y1);
    ctx.lineTo(f.x2, f.y2);
    ctx.stroke();
    ctx.strokeStyle = '#b48d62';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(f.x1, f.y1 - 0.8);
    ctx.lineTo(f.x2, f.y2 - 0.8);
    ctx.stroke();
    // Wooden fence posts
    const len = Math.hypot(f.x2 - f.x1, f.y2 - f.y1);
    const steps = Math.max(2, Math.floor(len / 26));
    ctx.fillStyle = '#5e4328';
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const px = f.x1 + (f.x2 - f.x1) * t;
      const py = f.y1 + (f.y2 - f.y1) * t;
      ctx.fillRect(px - 1.6, py - 1.6, 3.2, 3.2);
    }
  } else if (f.kind === 'chain') {
    ctx.strokeStyle = 'rgba(182, 192, 200, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(f.x1, f.y1);
    ctx.lineTo(f.x2, f.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    const len = Math.hypot(f.x2 - f.x1, f.y2 - f.y1);
    const steps = Math.max(2, Math.floor(len / 34));
    ctx.fillStyle = '#5c6670';
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      ctx.fillRect(f.x1 + (f.x2 - f.x1) * t - 1.4, f.y1 + (f.y2 - f.y1) * t - 1.4, 2.8, 2.8);
    }
  } else {
    // Decorative black iron park / promenade railing
    ctx.strokeStyle = '#252c36';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(f.x1, f.y1);
    ctx.lineTo(f.x2, f.y2);
    ctx.stroke();
    const len = Math.hypot(f.x2 - f.x1, f.y2 - f.y1);
    const steps = Math.max(2, Math.floor(len / 22));
    ctx.fillStyle = '#3c4552';
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      ctx.beginPath();
      ctx.arc(f.x1 + (f.x2 - f.x1) * t, f.y1 + (f.y2 - f.y1) * t, 1.8, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Draw one prop: palms with trunk rings & canopy shadows, streetlamps, bus stops, etc. */
export function drawProp(ctx, p, night, t, sun) {
  const sdx = sun ? sun.dx * 36 : 8;
  const sdy = sun ? sun.dy * 36 : 6;
  const shA = sun ? sun.alpha : 0.24;

  if (p.kind === 'palm') {
    const s = p.s ?? 1;
    const sway = Math.sin(t * 1.1 + p.ph) * 2.0 * s;
    const topX = p.x + sway;
    const topY = p.y - 34 * s;
    const shX = p.x + sdx * s * 1.15;
    const shY = p.y + sdy * s * 1.15;

    // 1. Grounded palm trunk + distinct star-frond canopy shadow
    ctx.save();
    ctx.strokeStyle = `rgba(14, 20, 36, ${(shA * 0.85).toFixed(3)})`;
    ctx.lineWidth = 3.2 * s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(shX, shY);
    ctx.stroke();
    // Radiating palm frond canopy shadow
    ctx.fillStyle = `rgba(14, 20, 36, ${(shA * 0.82).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(shX, shY, 10 * s, 7 * s, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2.6 * s;
    for (let k = 0; k < 7; k += 1) {
      const a = (k / 7) * TAU + p.ph * 0.3;
      ctx.beginPath();
      ctx.moveTo(shX, shY);
      ctx.lineTo(shX + Math.cos(a) * 18 * s, shY + Math.sin(a) * 11 * s);
      ctx.stroke();
    }
    // Base soil/trunk AO ring
    ctx.fillStyle = 'rgba(10, 14, 22, 0.30)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 1, 5.5 * s, 3.2 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 2. Curved trunk with sunlit edge & segmented bark rings
    ctx.save();
    ctx.strokeStyle = '#6a4b2d';
    ctx.lineWidth = 4.6 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + sway * 0.45, p.y - 18 * s, topX, topY);
    ctx.stroke();
    ctx.strokeStyle = '#9c744c';
    ctx.lineWidth = 2.0 * s;
    ctx.beginPath();
    ctx.moveTo(p.x - 0.8 * s, p.y);
    ctx.quadraticCurveTo(p.x + sway * 0.45 - 0.8 * s, p.y - 18 * s, topX - 0.6 * s, topY);
    ctx.stroke();
    // Bark ring notches along the trunk
    ctx.strokeStyle = '#4a321c';
    ctx.lineWidth = 1.0 * s;
    for (let r = 1; r <= 6; r += 1) {
      const u = r / 7;
      const mu = 1 - u;
      const rx = mu * mu * p.x + 2 * mu * u * (p.x + sway * 0.45) + u * u * topX;
      const ry = mu * mu * p.y + 2 * mu * u * (p.y - 18 * s) + u * u * topY;
      ctx.beginPath();
      ctx.moveTo(rx - 2.3 * s, ry);
      ctx.lineTo(rx + 2.3 * s, ry + 0.5 * s);
      ctx.stroke();
    }

    // 3. Layered palm fronds (under-canopy dark green + sunlit bright green + centre rib)
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * TAU + p.ph * 0.3;
      const ex = topX + Math.cos(a) * 20 * s;
      const ey = topY + Math.sin(a) * 13 * s - 2;
      const cx = topX + Math.cos(a) * 10.5 * s;
      const cy = topY + Math.sin(a) * 6.5 * s - 7.5 * s;
      ctx.strokeStyle = k % 2 === 0 ? '#276635' : '#3d944c';
      ctx.lineWidth = 3.6 * s;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(cx, cy, ex, ey);
      ctx.stroke();
      ctx.strokeStyle = k % 2 === 0 ? '#4ea356' : '#74c468';
      ctx.lineWidth = 1.1 * s;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(cx, cy - 0.8 * s, ex, ey);
      ctx.stroke();
    }
    // Coconuts cluster at crown
    ctx.fillStyle = '#5c3c20';
    ctx.beginPath();
    ctx.arc(topX - 1.5 * s, topY + 1 * s, 2.2 * s, 0, TAU);
    ctx.arc(topX + 1.8 * s, topY + 1.2 * s, 2.2 * s, 0, TAU);
    ctx.arc(topX, topY - 1 * s, 2.2 * s, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (p.kind === 'tree') {
    const s = p.s ?? 1;
    if (sun) {
      drawSoftDropShadow(ctx, p.x, p.y + 2, 15 * s, 9 * s, sun, 18 * s);
    }
    // Trunk stub
    ctx.fillStyle = '#5c4128';
    ctx.fillRect(p.x - 2 * s, p.y - 3 * s, 4 * s, 6 * s);
    // Layered foliage clusters
    ctx.fillStyle = '#2d5f31';
    ctx.beginPath();
    ctx.arc(p.x + 2.5 * s, p.y - 4 * s, 14 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(p.x - 5 * s, p.y - 5.5 * s, 11 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5da052';
    ctx.beginPath();
    ctx.arc(p.x + 5.5 * s, p.y - 7.5 * s, 9.8 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#84c86e';
    ctx.beginPath();
    ctx.arc(p.x - 2.5 * s, p.y - 10.5 * s, 6.4 * s, 0, TAU);
    ctx.fill();
    return;
  }

  if (p.kind === 'lamp') {
    const armDx = p.side ? p.side * 10 : 0;
    const armDy = p.side === 0 ? 7 : 0;
    const headX = p.x + armDx;
    const headY = p.y - 18 + armDy * 0.3;

    // Directional pole + arm + luminaire shadow
    ctx.save();
    ctx.strokeStyle = `rgba(14, 20, 36, ${(shA * 0.9).toFixed(3)})`;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + sdx * 0.72, p.y + sdy * 0.72);
    ctx.lineTo(p.x + sdx * 0.72 + armDx, p.y + sdy * 0.72 + armDy * 0.5);
    ctx.stroke();

    // Base flange & shadow
    ctx.fillStyle = 'rgba(10, 14, 22, 0.34)';
    ctx.beginPath();
    ctx.arc(p.x + 0.8, p.y + 1, 3.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2d333d';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.2, 0, TAU);
    ctx.fill();

    // Vertical steel pole with metallic rim
    ctx.strokeStyle = '#3a424d';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 18);
    ctx.stroke();
    ctx.strokeStyle = '#7e8896';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(p.x - 0.7, p.y - 1);
    ctx.lineTo(p.x - 0.7, p.y - 18);
    ctx.stroke();

    // Curved overhanging mast arm
    ctx.strokeStyle = '#485260';
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 17);
    ctx.quadraticCurveTo(p.x + armDx * 0.5, p.y - 21, headX, headY);
    ctx.stroke();

    // Cobra-head luminaire housing + lens
    ctx.fillStyle = '#323944';
    ctx.beginPath();
    ctx.ellipse(headX, headY, 4.4, 2.8, p.side === 0 ? Math.PI * 0.5 : 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = night > 0.15 ? PALETTE.lamp : '#e6e3d6';
    ctx.beginPath();
    ctx.ellipse(headX, headY + 0.4, 2.8, 1.8, p.side === 0 ? Math.PI * 0.5 : 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (p.kind === 'bus_stop') {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.orient === 'v') ctx.rotate(Math.PI * 0.5);

    // Directional shelter shadow
    const ox = sun ? sun.dx * 14 : 4;
    const oy = sun ? sun.dy * 14 : 4;
    ctx.save();
    if (p.orient === 'v') ctx.rotate(-Math.PI * 0.5);
    ctx.fillStyle = `rgba(14, 20, 36, ${(shA * 0.95).toFixed(3)})`;
    if (p.orient === 'v') ctx.fillRect(-7 + ox, -18 + oy, 14, 36);
    else ctx.fillRect(-18 + ox, -7 + oy, 36, 14);
    ctx.restore();

    // Shelter concrete pad
    ctx.fillStyle = 'rgba(10, 14, 22, 0.22)';
    ctx.fillRect(-19, -8, 38, 16);
    // Internal bench
    ctx.fillStyle = '#8b6542';
    ctx.fillRect(-12, -2, 24, 5);
    // Metal frame + tinted glass canopy roof
    ctx.fillStyle = 'rgba(42, 134, 152, 0.72)';
    ctx.beginPath();
    ctx.roundRect(-17, -6.5, 34, 12.5, 2.5);
    ctx.fill();
    // Sunlit roof ribs
    ctx.strokeStyle = '#e2e6ec';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-17, -6.5, 34, 12.5);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -6); ctx.lineTo(-6, 5.5);
    ctx.moveTo(6, -6); ctx.lineTo(6, 5.5);
    ctx.stroke();
    // Route sign pole at end of shelter
    ctx.fillStyle = '#2d343e';
    ctx.beginPath();
    ctx.arc(21, 0, 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2c7cc4';
    ctx.fillRect(19, -5.5, 4.5, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(20, -4.5, 2.5, 1.5);
    ctx.restore();
    return;
  }

  if (p.kind === 'bench') {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.orient === 'v') ctx.rotate(Math.PI * 0.5);
    ctx.fillStyle = `rgba(12, 18, 30, ${(shA * 0.9).toFixed(3)})`;
    ctx.fillRect(-8 + (sun ? sun.dx * 6 : 2), -2 + (sun ? sun.dy * 6 : 2), 17, 7);
    ctx.fillStyle = '#383430';
    ctx.fillRect(-8, -3.5, 2, 7);
    ctx.fillRect(6, -3.5, 2, 7);
    ctx.fillStyle = '#8b623c';
    ctx.fillRect(-9, -3, 18, 6);
    ctx.fillStyle = '#b4885a';
    ctx.fillRect(-9, -3, 18, 2);
    ctx.fillStyle = '#68472a';
    ctx.fillRect(-9, 1, 18, 1.2);
    ctx.restore();
    return;
  }

  if (p.kind === 'bin') {
    if (sun) drawSoftDropShadow(ctx, p.x, p.y + 1, 3.8, 3.2, sun, 6);
    ctx.fillStyle = '#2c3944';
    ctx.beginPath();
    ctx.roundRect(p.x - 3.4, p.y - 3.4, 6.8, 6.8, 1.8);
    ctx.fill();
    ctx.fillStyle = '#4e6372';
    ctx.fillRect(p.x - 2.6, p.y - 2.6, 5.2, 2.2);
    ctx.fillStyle = '#182028';
    ctx.fillRect(p.x - 2, p.y - 0.5, 4, 2);
    return;
  }

  if (p.kind === 'hydrant') {
    if (sun) drawSoftDropShadow(ctx, p.x, p.y + 1, 3.6, 2.8, sun, 6);
    ctx.fillStyle = '#c83a2c';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.4, 0, TAU);
    ctx.fill();
    // Side nozzles
    ctx.fillStyle = '#9e2a20';
    ctx.fillRect(p.x - 4.4, p.y - 1.1, 8.8, 2.2);
    ctx.fillStyle = '#e85240';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f4e0a0';
    ctx.beginPath();
    ctx.arc(p.x - 0.6, p.y - 0.8, 1.2, 0, TAU);
    ctx.fill();
    return;
  }

  if (p.kind === 'newsbox') {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.orient === 'v') ctx.rotate(Math.PI * 0.5);
    ctx.fillStyle = `rgba(12, 18, 30, ${(shA * 0.85).toFixed(3)})`;
    ctx.fillRect(-8 + (sun ? sun.dx * 7 : 2), -2 + (sun ? sun.dy * 7 : 2), 18, 7);
    const cols = ['#2c6eb2', '#cf3e36', '#e6b232'];
    for (let i = 0; i < 3; i += 1) {
      const bx = -9 + i * 6.2;
      ctx.fillStyle = cols[i];
      ctx.fillRect(bx, -3.5, 5.4, 6.5);
      ctx.fillStyle = 'rgba(255,255,255,0.68)';
      ctx.fillRect(bx + 0.9, -2.5, 3.6, 2.2);
    }
    ctx.restore();
    return;
  }

  if (p.kind === 'planter') {
    const h = hash01(p.seed || 7);
    const isRect = p.shape === 'rect';
    const w = isRect ? 18 : 11;
    const ht = isRect ? 9 : 11;
    if (sun) drawSoftDropShadow(ctx, p.x, p.y + 1, w * 0.55, ht * 0.55, sun, 8);
    // Stone / terracotta border
    ctx.fillStyle = h < 0.5 ? '#c8bca6' : '#b87654';
    ctx.beginPath();
    if (isRect) ctx.roundRect(p.x - w * 0.5, p.y - ht * 0.5, w, ht, 2);
    else ctx.arc(p.x, p.y, 5.8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 34, 28, 0.38)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // Dark soil bed
    ctx.fillStyle = '#4e3c2c';
    if (isRect) ctx.fillRect(p.x - w * 0.5 + 1.8, p.y - ht * 0.5 + 1.8, w - 3.6, ht - 3.6);
    else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.1, 0, TAU);
      ctx.fill();
    }
    // Lush layered foliage + tiny floral accents
    const spots = isRect ? [[-4.5, 0], [0, -0.8], [4.5, 0.4]] : [[0, 0]];
    for (const [ox, oy] of spots) {
      ctx.fillStyle = '#36753b';
      ctx.beginPath();
      ctx.arc(p.x + ox, p.y + oy, 3.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#62ad56';
      ctx.beginPath();
      ctx.arc(p.x + ox - 0.8, p.y + oy - 0.9, 2.2, 0, TAU);
      ctx.fill();
    }
    if (h > 0.35) {
      ctx.fillStyle = h > 0.7 ? '#f06a7a' : '#f4d04e';
      ctx.beginPath();
      ctx.arc(p.x - 2.2, p.y - 0.8, 1.1, 0, TAU);
      ctx.arc(p.x + 2.6, p.y + 0.6, 1.1, 0, TAU);
      ctx.fill();
    }
    return;
  }

  if (p.kind === 'bike') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle || 0);
    // Cast shadow
    ctx.strokeStyle = `rgba(12, 16, 28, ${(shA * 0.85).toFixed(3)})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-5 + 2, 1.5);
    ctx.lineTo(5 + 2, 1.5);
    ctx.stroke();
    // Wheels
    ctx.fillStyle = '#1b1e24';
    ctx.fillRect(-6.5, -1, 4.2, 1.8);
    ctx.fillRect(2.3, -1, 4.2, 1.8);
    // Frame
    ctx.strokeStyle = p.color || '#d9463e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-4.5, 0);
    ctx.lineTo(4.2, 0);
    ctx.stroke();
    // Handlebars & seat
    ctx.strokeStyle = '#c8d0d8';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(3.4, -3.2);
    ctx.lineTo(3.4, 3.2);
    ctx.stroke();
    ctx.fillStyle = '#242830';
    ctx.fillRect(-2.4, -1.2, 2.4, 2.2);
    ctx.restore();
    return;
  }

  if (p.kind === 'shop_sign') {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.orient === 'v') ctx.rotate(Math.PI * 0.5);
    // Shadow
    ctx.fillStyle = `rgba(12, 18, 30, ${(shA * 0.8).toFixed(3)})`;
    ctx.fillRect(-9 + 2, -2 + 3, 18, 6);
    // Projecting coloured signage plaque / sidewalk café board
    ctx.fillStyle = '#22262e';
    ctx.fillRect(-9.5, -3.2, 19, 6.4);
    ctx.fillStyle = p.color || '#d84a42';
    ctx.fillRect(-8.5, -2.2, 17, 4.4);
    ctx.fillStyle = 'rgba(255, 250, 240, 0.85)';
    ctx.fillRect(-6.5, -0.8, 13, 1.6);
    ctx.restore();
    return;
  }

  if (p.kind === 'billboard') {
    const d = p.design || { bg: '#16344a', accent: '#ff9a44', accent2: '#2fd0d6', title: 'HARBOR FM', sub: '104.7' };
    ctx.save();
    ctx.translate(p.x, p.y);
    // Long directional shadow cast by elevated billboard
    const ox = sun ? sun.dx * 28 : 8;
    const oy = sun ? sun.dy * 28 : 6;
    ctx.fillStyle = `rgba(14, 20, 36, ${(shA * 0.92).toFixed(3)})`;
    ctx.fillRect(-26 + ox, -10 + oy, 52, 14);
    // Twin steel support legs
    ctx.fillStyle = '#38404a';
    ctx.fillRect(-16, -2, 3.5, 11);
    ctx.fillRect(12.5, -2, 3.5, 11);
    // Elevated tilted board face
    ctx.fillStyle = '#202630';
    ctx.fillRect(-28, -22, 56, 21);
    ctx.fillStyle = d.bg;
    ctx.fillRect(-26, -20, 52, 17);
    // Bold geometric art bar
    ctx.fillStyle = d.accent;
    ctx.fillRect(-26, -20, 52, 3.5);
    ctx.fillStyle = d.accent2;
    ctx.fillRect(-24, -6, 16, 2);
    ctx.fillStyle = '#f6f4ec';
    ctx.font = '800 6.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.title, 0, -11.5);
    // Top night floodlights
    if (night > 0.2) {
      ctx.fillStyle = 'rgba(255, 244, 200, 0.85)';
      ctx.fillRect(-16, -23.5, 4, 2);
      ctx.fillRect(12, -23.5, 4, 2);
    }
    ctx.restore();
    return;
  }

  if (p.kind === 'crates') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle || 0);
    const ox = sun ? sun.dx * 10 : 3;
    const oy = sun ? sun.dy * 10 : 3;
    ctx.fillStyle = `rgba(12, 18, 30, ${(shA * 0.9).toFixed(3)})`;
    ctx.fillRect(-13 + ox, -9 + oy, 26, 18);

    // Wooden pallet & stacked crates + oil drums
    ctx.fillStyle = '#9c7344';
    ctx.fillRect(-13, -9, 14, 13);
    ctx.strokeStyle = '#5e4224';
    ctx.lineWidth = 1;
    ctx.strokeRect(-12.5, -8.5, 13, 12);
    ctx.beginPath();
    ctx.moveTo(-12.5, -8.5); ctx.lineTo(0.5, 3.5);
    ctx.moveTo(0.5, -8.5); ctx.lineTo(-12.5, 3.5);
    ctx.stroke();

    if (p.variant === 0) {
      // Second smaller crate
      ctx.fillStyle = '#b48a56';
      ctx.fillRect(2, -7, 10, 10);
      ctx.strokeRect(2.5, -6.5, 9, 9);
    } else if (p.variant === 1) {
      // Pair of colourful steel oil drums
      const drumCols = ['#c44234', '#2c7298', '#d9a432'];
      ctx.fillStyle = drumCols[0];
      ctx.beginPath();
      ctx.arc(6.5, -4, 4.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = drumCols[1];
      ctx.beginPath();
      ctx.arc(7.5, 4.5, 4.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(6.5, -4, 2.8, 0, TAU);
      ctx.arc(7.5, 4.5, 2.8, 0, TAU);
      ctx.stroke();
    } else {
      // Blue tarpaulin bundle
      ctx.fillStyle = '#366894';
      ctx.beginPath();
      ctx.roundRect(1, -8, 12, 14, 2);
      ctx.fill();
      ctx.strokeStyle = '#204260';
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (p.kind === 'umbrella') {
    const r = p.r || 14;
    const [c1, c2] = p.colors || ['#e04b3e', '#f7f1e3'];
    // Beach towel beside umbrella
    ctx.save();
    ctx.translate(p.x + r * 0.75, p.y + 4);
    ctx.rotate(p.angle || 0);
    ctx.fillStyle = c1;
    ctx.fillRect(-5, -10, 10, 20);
    ctx.fillStyle = c2;
    ctx.fillRect(-5, -7, 10, 3);
    ctx.fillRect(-5, 4, 10, 3);
    ctx.restore();

    // Umbrella cast shadow on sand
    ctx.fillStyle = `rgba(60, 44, 22, ${(shA * 0.9).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x + (sun ? sun.dx * 16 : 5), p.y + (sun ? sun.dy * 16 : 5), r * 0.96, 0, TAU);
    ctx.fill();

    // 8-panel striped beach umbrella canopy
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle || 0);
    for (let k = 0; k < 8; k += 1) {
      ctx.fillStyle = k % 2 === 0 ? c1 : c2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, (k / 8) * TAU, ((k + 1) / 8) * TAU);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(40, 34, 28, 0.28)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#e8dcc4';
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (p.kind === 'lifeguard') {
    const ox = sun ? sun.dx * 28 : 8;
    const oy = sun ? sun.dy * 28 : 7;
    ctx.save();
    // Elevated tower shadow on beach sand
    ctx.fillStyle = `rgba(54, 40, 22, ${(shA * 0.95).toFixed(3)})`;
    ctx.fillRect(p.x - 14 + ox, p.y - 12 + oy, 28, 24);
    // Wooden deck & ramp stairs
    ctx.fillStyle = '#b48a5c';
    ctx.fillRect(p.x - 18, p.y - 11, 36, 22);
    ctx.strokeStyle = '#6c4d2c';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(p.x - 18, p.y - 11, 36, 22);
    // Stairs on right side
    ctx.fillStyle = '#9c7448';
    for (let s = 0; s < 4; s += 1) {
      ctx.fillRect(p.x + 18 + s * 3.5, p.y - 6, 3, 12);
    }
    // White-and-turquoise lifeguard hut roof
    ctx.fillStyle = '#f2ede2';
    ctx.fillRect(p.x - 13, p.y - 15, 26, 20);
    ctx.fillStyle = '#289ca8';
    ctx.fillRect(p.x - 13, p.y - 15, 26, 5);
    ctx.strokeStyle = '#4c5c66';
    ctx.strokeRect(p.x - 13, p.y - 15, 26, 20);
    // Red rescue buoy hanging on railing
    ctx.fillStyle = '#e03c32';
    ctx.beginPath();
    ctx.roundRect(p.x - 16, p.y + 5, 6, 3, 1.5);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (p.kind === 'crane') {
    const sway = Math.sin(t * 0.5 + p.ph) * 2.5;
    ctx.fillStyle = `rgba(12, 16, 26, ${(shA * 0.95).toFixed(3)})`;
    ctx.fillRect(p.x - 16 + sdx * 1.1, p.y + 4 + sdy * 1.1, 56, 18);
    ctx.fillStyle = '#9e4f22';
    ctx.fillRect(p.x - 22, p.y - 9, 44, 18);
    ctx.strokeStyle = '#f2be42';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x - 21, p.y - 8, 42, 16);
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
    ctx.strokeStyle = '#e07a2c';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(p.x - 38 + sway, p.y - 98);
    ctx.lineTo(p.x + 118 + sway, p.y - 98);
    ctx.stroke();
    ctx.fillStyle = '#7e3c18';
    ctx.fillRect(p.x - 44 + sway, p.y - 104, 16, 13);
    ctx.fillStyle = '#384654';
    ctx.fillRect(p.x + 8 + sway, p.y - 95, 11, 10);
    ctx.strokeStyle = '#3a4048';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(p.x + 84 + sway, p.y - 95);
    ctx.lineTo(p.x + 84 + sway, p.y - 44);
    ctx.stroke();
    ctx.fillStyle = '#e8a832';
    ctx.fillRect(p.x + 77 + sway, p.y - 46, 14, 6);
    if (Math.sin(t * 4 + p.ph) > -0.2) {
      ctx.fillStyle = '#ff3838';
      ctx.beginPath();
      ctx.arc(p.x + sway * 0.4, p.y - 104, 3, 0, TAU);
      ctx.fill();
    }
  }
}
