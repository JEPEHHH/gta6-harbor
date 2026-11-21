// The 2.5D architectural renderer: buildings extrude away from the camera centre with
// directional sun shadows, 8 facade material textures (brick, sandstone, glass, concrete,
// corrugated metal, timber, stucco, terracotta), setbacks, spires, illuminated roof signs,
// balconies, graffiti walls, corner shop awnings, stair bulkheads, water tanks, satellite
// dishes, construction scaffolding and dockside neon signs.

import { TAU, hash01, lerp, shade } from './util.js';
import { drawCastRectShadow } from './lighting.js';

const LEAN = 0.0012; // roof offset per unit of height per unit of distance from the camera

function quad(ctx, x1, y1, x2, y2, ox, oy) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 + ox, y2 + oy);
  ctx.lineTo(x1 + ox, y1 + oy);
  ctx.closePath();
}

/** Draw material-specific wall detailing (brick courses, glass reflections, corrugated ribs, etc.). */
function drawWallMaterial(ctx, b, x1, y1, x2, y2, ox, oy, floors, cols, wall) {
  const mat = b.material || 'concrete';
  ctx.save();
  if (mat === 'brick' || mat === 'terracotta') {
    // Subtle horizontal masonry courses + limestone cornice band at top
    ctx.strokeStyle = 'rgba(42, 22, 16, 0.22)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    const lines = Math.min(14, Math.max(3, floors * 2));
    for (let k = 1; k < lines; k += 1) {
      const t = k / lines;
      ctx.moveTo(x1 + ox * t, y1 + oy * t);
      ctx.lineTo(x2 + ox * t, y2 + oy * t);
    }
    ctx.stroke();
    // Crisp top cornice trim
    ctx.strokeStyle = 'rgba(244, 234, 214, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1 + ox * 0.96, y1 + oy * 0.96);
    ctx.lineTo(x2 + ox * 0.96, y2 + oy * 0.96);
    ctx.stroke();
  } else if (mat === 'sandstone') {
    // Vertical fluted Art Deco pilasters
    ctx.strokeStyle = 'rgba(255, 248, 228, 0.28)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const ribs = Math.max(3, cols + 1);
    for (let c = 1; c < ribs; c += 1) {
      const s = c / ribs;
      const px = lerp(x1, x2, s);
      const py = lerp(y1, y2, s);
      ctx.moveTo(px, py);
      ctx.lineTo(px + ox, py + oy);
    }
    ctx.stroke();
  } else if (mat === 'glass') {
    // Diagonal sky-reflection sheen across curtain wall
    ctx.fillStyle = 'rgba(190, 236, 250, 0.14)';
    ctx.beginPath();
    ctx.moveTo(lerp(x1, x2, 0.15), lerp(y1, y2, 0.15));
    ctx.lineTo(lerp(x1, x2, 0.48), lerp(y1, y2, 0.48));
    ctx.lineTo(lerp(x1, x2, 0.72) + ox, lerp(y1, y2, 0.72) + oy);
    ctx.lineTo(lerp(x1, x2, 0.36) + ox, lerp(y1, y2, 0.36) + oy);
    ctx.closePath();
    ctx.fill();
  } else if (mat === 'corrugated') {
    // Industrial vertical steel corrugation ribs
    ctx.strokeStyle = 'rgba(22, 28, 34, 0.28)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    const ribs = Math.max(6, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 14));
    for (let k = 1; k < ribs; k += 1) {
      const s = k / ribs;
      const px = lerp(x1, x2, s);
      const py = lerp(y1, y2, s);
      ctx.moveTo(px, py);
      ctx.lineTo(px + ox, py + oy);
    }
    ctx.stroke();
    // Warehouse roller loading bays on south wall
    if (b.loadingBays > 0 && wall === 3) {
      for (let k = 0; k < b.loadingBays; k += 1) {
        const s0 = 0.12 + k * (0.76 / b.loadingBays);
        const s1 = s0 + (0.56 / b.loadingBays);
        const ax = lerp(x1, x2, s0);
        const ay = lerp(y1, y2, s0);
        const bx = lerp(x1, x2, s1);
        const by = lerp(y1, y2, s1);
        ctx.fillStyle = '#2d3640';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + ox * 0.52, by + oy * 0.52);
        ctx.lineTo(ax + ox * 0.52, ay + oy * 0.52);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e8b632';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
  } else if (mat === 'timber') {
    // Warm horizontal timber clapboard siding & ground-floor shopfront fascia
    ctx.strokeStyle = 'rgba(66, 42, 22, 0.26)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const planks = Math.min(10, Math.max(3, floors * 2));
    for (let k = 1; k < planks; k += 1) {
      const t = k / planks;
      ctx.moveTo(x1 + ox * t, y1 + oy * t);
      ctx.lineTo(x2 + ox * t, y2 + oy * t);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawWallWindows(ctx, b, x1, y1, x2, y2, ox, oy, floors, cols, wall, night, dusk) {
  const glowAmt = Math.max(night, dusk * 0.72);
  const lit = glowAmt > 0.16;
  const isGlass = b.material === 'glass';

  // Floor slab spandrel bands
  ctx.strokeStyle = isGlass ? 'rgba(18, 28, 38, 0.42)' : 'rgba(20, 26, 36, 0.22)';
  ctx.lineWidth = isGlass ? 1.4 : 1;
  ctx.beginPath();
  for (let f = 1; f < floors; f += 1) {
    const tf = f / floors;
    ctx.moveTo(x1 + ox * tf, y1 + oy * tf);
    ctx.lineTo(x2 + ox * tf, y2 + oy * tf);
  }
  ctx.stroke();

  const margin = isGlass ? 0.06 : 0.18;
  for (let f = 0; f < floors; f += 1) {
    const t0 = (f + (isGlass ? 0.12 : 0.2)) / floors;
    const t1 = (f + (isGlass ? 0.86 : 0.76)) / floors;
    for (let c = 0; c < cols; c += 1) {
      const s0 = (c + margin) / cols;
      const s1 = (c + 1 - margin) / cols;
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
        if (tone < 0.65) ctx.fillStyle = `rgba(255, 214, 126, ${alpha.toFixed(3)})`;
        else if (tone < 0.86) ctx.fillStyle = `rgba(255, 238, 194, ${alpha.toFixed(3)})`;
        else ctx.fillStyle = `rgba(130, 224, 232, ${(alpha * 0.85).toFixed(3)})`;
      } else {
        ctx.fillStyle = night > 0.45
          ? 'rgba(18, 26, 40, 0.58)'
          : isGlass
            ? (h < 0.45 ? 'rgba(92, 148, 172, 0.52)' : 'rgba(46, 86, 110, 0.54)')
            : (h < 0.35 ? 'rgba(66, 102, 126, 0.44)' : 'rgba(34, 52, 70, 0.48)');
      }
      ctx.fill();
    }
  }
}

/** Draw extruded balconies with railing bars along visible building walls. */
function drawWallBalconies(ctx, b, x1, y1, x2, y2, ox, oy, floors, cols, wall) {
  if (!b.balconies || floors < 2) return;
  const sideName = wall === 0 ? 'west' : wall === 1 ? 'east' : wall === 2 ? 'north' : 'south';
  if (b.balconySides && !b.balconySides.includes(sideName)) return;

  const nx = wall === 0 ? -5.5 : wall === 1 ? 5.5 : 0;
  const ny = wall === 2 ? -5.5 : wall === 3 ? 5.5 : 0;
  ctx.save();
  for (let f = 1; f < Math.min(floors, 5); f += 1) {
    const tf = f / floors;
    const bx1 = x1 + ox * tf;
    const by1 = y1 + oy * tf;
    const bx2 = x2 + ox * tf;
    const by2 = y2 + oy * tf;
    const spans = Math.max(1, Math.min(3, Math.floor(cols / 2)));
    for (let k = 0; k < spans; k += 1) {
      const s0 = (k + 0.14) / spans;
      const s1 = (k + 0.86) / spans;
      const ax = lerp(bx1, bx2, s0);
      const ay = lerp(by1, by2, s0);
      const ex = lerp(bx1, bx2, s1);
      const ey = lerp(by1, by2, s1);
      // Balcony slab
      ctx.fillStyle = 'rgba(232, 226, 214, 0.92)';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex + nx, ey + ny);
      ctx.lineTo(ax + nx, ay + ny);
      ctx.closePath();
      ctx.fill();
      // Iron balustrade rim
      ctx.strokeStyle = 'rgba(32, 38, 46, 0.78)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Draw colourful spray-paint graffiti murals on the lower strip of selected side/alley walls. */
function drawWallGraffiti(ctx, b, x1, y1, x2, y2, ox, oy, wall) {
  if (!b.graffiti) return;
  const sideName = wall === 0 ? 'west' : wall === 1 ? 'east' : wall === 2 ? 'north' : 'south';
  if (b.graffiti.side !== sideName) return;

  const gCols = ['#ff3b9a', '#2be4e4', '#ffd24c', '#6de658', '#ff6e38'];
  ctx.save();
  for (let k = 0; k < 5; k += 1) {
    const s0 = 0.12 + k * 0.15;
    const s1 = s0 + 0.14;
    const t0 = 0.04 + hash01(b.graffiti.seed + k * 7) * 0.06;
    const t1 = Math.min(0.36, t0 + 0.14 + hash01(b.graffiti.seed + k * 19) * 0.12);
    const ax = lerp(x1, x2, s0);
    const ay = lerp(y1, y2, s0);
    const bx = lerp(x1, x2, s1);
    const by = lerp(y1, y2, s1);
    ctx.fillStyle = gCols[(b.graffiti.seed + k) % gCols.length];
    ctx.globalAlpha = 0.82;
    ctx.beginPath();
    ctx.moveTo(ax + ox * t0, ay + oy * t0);
    ctx.lineTo(bx + ox * t0, by + oy * t0);
    ctx.lineTo(bx + ox * t1, by + oy * t1);
    ctx.lineTo(ax + ox * t1, ay + oy * t1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Draw tubular steel construction scaffolding & orange safety netting on half-built cores. */
function drawScaffoldingWall(ctx, x1, y1, x2, y2, ox, oy, floors) {
  ctx.save();
  // Translucent green/orange construction debris mesh on lower tiers
  ctx.fillStyle = 'rgba(232, 134, 44, 0.24)';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 + ox * 0.72, y2 + oy * 0.72);
  ctx.lineTo(x1 + ox * 0.72, y1 + oy * 0.72);
  ctx.closePath();
  ctx.fill();

  // Steel horizontal scaffolding decks + vertical standards + X-bracing
  ctx.strokeStyle = '#d4dde4';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const tiers = Math.max(3, floors);
  for (let f = 1; f <= tiers; f += 1) {
    const tf = f / tiers;
    ctx.moveTo(x1 + ox * tf, y1 + oy * tf);
    ctx.lineTo(x2 + ox * tf, y2 + oy * tf);
  }
  const bays = 4;
  for (let c = 0; c <= bays; c += 1) {
    const s = c / bays;
    const px = lerp(x1, x2, s);
    const py = lerp(y1, y2, s);
    ctx.moveTo(px, py);
    ctx.lineTo(px + ox, py + oy);
  }
  ctx.stroke();

  // Diagonal cross-braces
  ctx.strokeStyle = 'rgba(236, 178, 52, 0.72)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let f = 0; f < tiers; f += 1) {
    const t0 = f / tiers;
    const t1 = (f + 1) / tiers;
    for (let c = 0; c < bays; c += 1) {
      const s0 = c / bays;
      const s1 = (c + 1) / bays;
      ctx.moveTo(lerp(x1, x2, s0) + ox * t0, lerp(y1, y2, s0) + oy * t0);
      ctx.lineTo(lerp(x1, x2, s1) + ox * t1, lerp(y1, y2, s1) + oy * t1);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Draw striped street-level storefront awnings (single-side or wrap-around corner shop). */
function drawAwningStrip(ctx, ax, ay, aw, ah, c1, c2, vertical) {
  ctx.fillStyle = 'rgba(14, 18, 28, 0.25)';
  ctx.fillRect(ax + 2, ay + 3, aw, ah + 2);
  if (!vertical) {
    const stripes = Math.max(4, Math.floor(aw / 8));
    const sw = aw / stripes;
    for (let i = 0; i < stripes; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? c1 : c2;
      ctx.fillRect(ax + i * sw, ay, sw + 0.4, ah);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(ax, ay + ah - 2.5, aw, 2.5);
  } else {
    const stripes = Math.max(4, Math.floor(ah / 8));
    const sh = ah / stripes;
    for (let i = 0; i < stripes; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? c1 : c2;
      ctx.fillRect(ax, ay + i * sh, aw, sh + 0.4);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(ax, ay, 2.5, ah);
  }
}

function drawAwning(ctx, b) {
  if (!b.awning) return;
  const [c1, c2] = b.awning;
  ctx.save();
  if (b.awningSide === 'south' || b.cornerAwning) {
    const aw = Math.min(b.w - 10, 82);
    const ax = b.cornerAwning ? b.x + 2 : b.x + (b.w - aw) * 0.5;
    drawAwningStrip(ctx, ax, b.y + b.h, aw, 11, c1, c2, false);
  }
  if (b.awningSide === 'west' || b.cornerAwning) {
    const ah = Math.min(b.h - 10, 74);
    const ay = b.cornerAwning ? b.y + b.h - ah - 2 : b.y + (b.h - ah) * 0.5;
    drawAwningStrip(ctx, b.x - 11, ay, 11, ah, c1, c2, true);
  }
  ctx.restore();
}

/** Draw rooftop parapet lip + HVAC, stair bulkheads, water tanks, satellite dishes, skylights, helipads, spires & roof signs. */
function drawRooftopDetails(ctx, b, rx, ry, sun, night, dusk, t) {
  if (b.kind === 'container') {
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

  if (b.kind === 'construction_core') {
    // Unfinished poured concrete floor deck with rebar stubs, steel column grid & timber stacks
    ctx.fillStyle = '#9c9b95';
    ctx.fillRect(rx + 4, ry + 4, b.w - 8, b.h - 8);
    ctx.strokeStyle = '#5c5e62';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx + 4, ry + 4, b.w - 8, b.h - 8);
    // Steel column grid stubs
    ctx.fillStyle = '#c85b34';
    for (let cx = rx + 18; cx <= rx + b.w - 18; cx += 34) {
      for (let cy = ry + 18; cy <= ry + b.h - 18; cy += 34) {
        ctx.fillRect(cx - 3, cy - 3, 6, 6);
      }
    }
    // Elevator shaft opening
    ctx.fillStyle = '#383c42';
    ctx.fillRect(rx + b.w * 0.5 - 16, ry + b.h * 0.5 - 14, 32, 28);
    ctx.strokeStyle = '#e8b630';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(rx + b.w * 0.5 - 16, ry + b.h * 0.5 - 14, 32, 28);
    // Orange scaffolding rail perimeter
    ctx.strokeStyle = '#e88230';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx - 2, ry - 2, b.w + 4, b.h + 4);
    return;
  }

  if (b.kind === 'warehouse') {
    // Sawtooth / ribbed metal industrial roof with skylight strips & turbine vents
    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.fillRect(rx + 2, ry + 2, b.w - 4, b.h * 0.5 - 2);
    ctx.strokeStyle = 'rgba(28, 34, 42, 0.38)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 7; k += 1) {
      const ly = ry + (b.h * k) / 7;
      ctx.beginPath();
      ctx.moveTo(rx + 3, ly);
      ctx.lineTo(rx + b.w - 3, ly);
      ctx.stroke();
    }
    // Long industrial north-light skylight strips
    if (b.hasSkylight) {
      ctx.fillStyle = 'rgba(130, 188, 206, 0.42)';
      ctx.fillRect(rx + 20, ry + b.h * 0.56, b.w - 40, 12);
      ctx.strokeStyle = 'rgba(235, 240, 244, 0.35)';
      ctx.strokeRect(rx + 20, ry + b.h * 0.56, b.w - 40, 12);
    }
    for (let v = 0; v < 4; v += 1) {
      const vx = rx + 34 + v * Math.min(58, (b.w - 50) / 3.5);
      if (vx > rx + b.w - 18) break;
      const vy = ry + 24;
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
    const midY = ry + b.h * 0.5;
    if (b.roofStyle === 'gable') {
      // Crisp gabled ridge running end-to-end with sunlit & shaded halves
      ctx.fillStyle = 'rgba(255, 246, 224, 0.18)';
      ctx.fillRect(rx, ry, b.w, b.h * 0.5);
      ctx.fillStyle = 'rgba(18, 22, 32, 0.18)';
      ctx.fillRect(rx, midY, b.w, b.h * 0.5);
      ctx.strokeStyle = 'rgba(255, 248, 232, 0.42)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(rx + 2, midY);
      ctx.lineTo(rx + b.w - 2, midY);
      ctx.stroke();
    } else {
      // Hipped roof ridge
      const inset = Math.min(14, b.w * 0.22);
      ctx.fillStyle = 'rgba(255, 246, 224, 0.16)';
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + b.w, ry);
      ctx.lineTo(rx + b.w - inset, midY);
      ctx.lineTo(rx + inset, midY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(18, 22, 32, 0.18)';
      ctx.beginPath();
      ctx.moveTo(rx + inset, midY);
      ctx.lineTo(rx + b.w - inset, midY);
      ctx.lineTo(rx + b.w, ry + b.h);
      ctx.lineTo(rx, ry + b.h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 248, 232, 0.34)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(rx + inset, midY);
      ctx.lineTo(rx + b.w - inset, midY);
      ctx.stroke();
    }
    // Brick chimney
    ctx.fillStyle = 'rgba(18, 20, 28, 0.28)';
    ctx.fillRect(rx + b.w - 14, ry + 8, 8, 8);
    ctx.fillStyle = '#735144';
    ctx.fillRect(rx + b.w - 16, ry + 6, 8, 8);
    ctx.fillStyle = '#2d2624';
    ctx.fillRect(rx + b.w - 14, ry + 8, 4, 4);
    // Optional rooftop satellite dish on suburban homes
    if (b.hasSatDish) {
      drawSatelliteDish(ctx, rx + 14, ry + 14, sun);
    }
    return;
  }

  // Parapet wall bezel around tower / flat / hotel / shop rooftops
  const pad = 5;
  ctx.fillStyle = shade(b.roof, 0.86);
  ctx.fillRect(rx + pad, ry + pad, b.w - pad * 2, b.h - pad * 2);
  ctx.strokeStyle = 'rgba(255, 250, 238, 0.30)';
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
  if (b.w >= 54 && b.h >= 54) {
    const acX = rx + 10 + h1 * Math.max(6, b.w - 46);
    const acY = ry + 10 + h2 * Math.max(6, b.h - 38);
    ctx.fillStyle = 'rgba(14, 18, 28, 0.32)';
    ctx.fillRect(acX + sdx * 0.55, acY + sdy * 0.55, 20, 14);
    ctx.fillStyle = '#c5c7c9';
    ctx.fillRect(acX, acY, 20, 14);
    ctx.strokeStyle = '#687078';
    ctx.lineWidth = 1;
    ctx.strokeRect(acX + 0.5, acY + 0.5, 19, 13);
    ctx.fillStyle = '#404850';
    ctx.beginPath();
    ctx.arc(acX + 6, acY + 7, 3.8, 0, TAU);
    ctx.arc(acX + 14.5, acY + 7, 3.8, 0, TAU);
    ctx.fill();
  }

  // Stair bulkhead penthouse box (concrete/brick rooftop stair access)
  if (b.hasBulkhead && b.w >= 56 && b.h >= 56) {
    const bkw = 22;
    const bkh = 16;
    const bkx = rx + 11;
    const bky = ry + b.h - bkh - 11;
    ctx.fillStyle = 'rgba(14, 18, 28, 0.34)';
    ctx.fillRect(bkx + sdx * 0.75, bky + sdy * 0.75, bkw, bkh);
    ctx.fillStyle = shade(b.color, 0.92);
    ctx.fillRect(bkx, bky, bkw, bkh);
    ctx.strokeStyle = 'rgba(30, 34, 42, 0.55)';
    ctx.lineWidth = 1.1;
    ctx.strokeRect(bkx + 0.5, bky + 0.5, bkw - 1, bkh - 1);
    ctx.fillStyle = '#464d56';
    ctx.fillRect(bkx + bkw - 4, bky + 4, 3, 8);
  }

  // Elevated wooden rooftop water tank on steel legs
  if (b.hasWaterTank && !b.hasHelipad && b.w >= 56) {
    const tx = rx + b.w - 22;
    const ty = ry + 22;
    ctx.fillStyle = 'rgba(12, 16, 24, 0.34)';
    ctx.beginPath();
    ctx.ellipse(tx + sdx * 0.95, ty + sdy * 0.95, 11, 9.5, 0, 0, TAU);
    ctx.fill();
    // Steel trestle legs
    ctx.strokeStyle = '#4a525c';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(tx - 7, ty - 7); ctx.lineTo(tx + 7, ty + 7);
    ctx.moveTo(tx + 7, ty - 7); ctx.lineTo(tx - 7, ty + 7);
    ctx.stroke();
    // Cedar stave barrel + conical roof cap
    ctx.fillStyle = '#926d48';
    ctx.beginPath();
    ctx.arc(tx, ty, 10, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#4f3a25';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#ba956c';
    ctx.beginPath();
    ctx.arc(tx - 1.5, ty - 1.5, 5.2, 0, TAU);
    ctx.fill();
  }

  // Parabolic satellite dish
  if (b.hasSatDish && b.w >= 48) {
    drawSatelliteDish(ctx, rx + b.w - 18, ry + b.h - 18, sun);
  }

  // Architectural glass skylight
  if (b.hasSkylight && !b.hasHelipad && !b.setbacks) {
    const sw = Math.min(34, b.w * 0.34);
    const sh = Math.min(20, b.h * 0.22);
    const sx = rx + (b.w - sw) * 0.5;
    const sy = ry + (b.h - sh) * 0.5;
    ctx.fillStyle = '#3b6a7c';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = 'rgba(180, 232, 244, 0.34)';
    ctx.fillRect(sx + 2, sy + 2, sw * 0.45, sh - 4);
    ctx.strokeStyle = '#d4d0c4';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(sx, sy, sw, sh);
  }

  // Helipad on designated skyscrapers (no longer plastered on every tall box!)
  if (b.hasHelipad && !b.setbacks) {
    drawHelipad(ctx, rx + b.w * 0.5, ry + b.h * 0.5, Math.min(b.w, b.h) * 0.27);
  }

  void night;
  void dusk;
  void t;
}

function drawSatelliteDish(ctx, x, y, sun) {
  const sdx = sun ? sun.dx * 10 : 3;
  const sdy = sun ? sun.dy * 10 : 3;
  ctx.fillStyle = 'rgba(12, 16, 26, 0.30)';
  ctx.beginPath();
  ctx.arc(x + sdx * 0.5, y + sdy * 0.5, 6.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e4e8ec';
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#8b96a2';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.strokeStyle = '#3d4550';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 4.5, y - 3.5);
  ctx.stroke();
  ctx.fillStyle = '#2c323b';
  ctx.beginPath();
  ctx.arc(x + 4.5, y - 3.5, 1.5, 0, TAU);
  ctx.fill();
}

function drawHelipad(ctx, hcx, hcy, r) {
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

/** Draw an extruded 2.5D box tier (used for both base volumes and stepped tower setbacks). */
function drawExtrudedTier(ctx, b, x, y, w, h, ox0, oy0, ox1, oy1, color, roof, night, dusk, isBase) {
  const bx = x + ox0;
  const by = y + oy0;
  const dox = ox1 - ox0;
  const doy = oy1 - oy0;
  const tierHt = isBase ? b.ht : 48;
  const windows = tierHt >= 38 && b.kind !== 'warehouse' && b.kind !== 'container' && b.kind !== 'construction_core';
  const floors = Math.max(1, Math.floor(tierHt / 26));
  const sunWarm = dusk > 0.2 ? 1.04 : 1.0;

  const paintWall = (x1, y1, x2, y2, shadeFactor, cols, wall) => {
    quad(ctx, x1, y1, x2, y2, dox, doy);
    ctx.fillStyle = shade(color, shadeFactor);
    ctx.fill();
    drawWallMaterial(ctx, b, x1, y1, x2, y2, dox, doy, floors, cols, wall);
    if (windows) drawWallWindows(ctx, b, x1, y1, x2, y2, dox, doy, floors, cols, wall, night, dusk);
    if (isBase && b.scaffolding) drawScaffoldingWall(ctx, x1, y1, x2, y2, dox, doy, floors);
    if (isBase) {
      drawWallBalconies(ctx, b, x1, y1, x2, y2, dox, doy, floors, cols, wall);
      drawWallGraffiti(ctx, b, x1, y1, x2, y2, dox, doy, wall);
    }
  };

  if (dox > 0.5) {
    paintWall(bx, by, bx, by + h, 0.64 * sunWarm, Math.max(1, Math.floor(h / 26)), 0);
  } else if (dox < -0.5) {
    paintWall(bx + w, by, bx + w, by + h, 0.74 * sunWarm, Math.max(1, Math.floor(h / 26)), 1);
  }
  if (doy > 0.5) {
    paintWall(bx, by, bx + w, by, 0.88 * sunWarm, Math.max(1, Math.floor(w / 26)), 2);
  } else if (doy < -0.5) {
    paintWall(bx, by + h, bx + w, by + h, 0.54, Math.max(1, Math.floor(w / 26)), 3);
  }

  // Roof deck
  const rx = x + ox1;
  const ry = y + oy1;
  const roofColor = b.kind === 'container' ? shade(color, 1.12) : roof;
  ctx.fillStyle = roofColor;
  ctx.fillRect(rx, ry, w, h);
  ctx.strokeStyle = 'rgba(24, 28, 36, 0.42)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 0.5, ry + 0.5, w - 1, h - 1);
  return { rx, ry };
}

/** Draw an illuminated rooftop sign mounted on steel truss legs. */
function drawRoofSign(ctx, rs, rx, ry, w, h, night, dusk) {
  const glow = Math.min(1, night * 0.95 + dusk * 0.8);
  const sw = Math.min(w - 14, Math.max(54, rs.text.length * 10 + 18));
  const sh = 17;
  const sx = rx + (w - sw) * 0.5;
  const sy = rs.side === 'north' ? ry + 8 : ry + h - sh - 8;

  ctx.save();
  // Support truss shadow + soft neon halo at dusk/night + dark cabinet
  if (glow > 0.18 && rs.rgb) {
    const r = sw * 0.72;
    const cx = sx + sw * 0.5;
    const cy = sy + sh * 0.5;
    const halo = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    halo.addColorStop(0, `rgba(${rs.rgb}, ${(0.42 * glow).toFixed(3)})`);
    halo.addColorStop(1, `rgba(${rs.rgb}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(10, 14, 22, 0.45)';
  ctx.fillRect(sx + 2, sy + 3, sw, sh);
  ctx.fillStyle = '#181e28';
  ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = rs.hex;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.55 + glow * 0.45;
  ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
  // Illuminated sign lettering
  ctx.fillStyle = glow > 0.2 ? '#ffffff' : rs.hex;
  ctx.font = '900 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rs.text, sx + sw * 0.5, sy + sh * 0.5 + 0.5);
  ctx.restore();
}

/** Draw a tapered architectural rooftop spire + blinking red aviation beacon. */
function drawSpire(ctx, spire, cx, cy, baseOx, baseOy, cam, baseHt, night, t) {
  const topHt = baseHt + spire.height;
  const x0 = cx + baseOx;
  const y0 = cy + baseOy;
  const x1 = cx + (cx - cam.x) * topHt * LEAN;
  const y1 = cy + (cy - cam.y) * topHt * LEAN;

  ctx.save();
  // Stepped metallic spire pedestal
  ctx.fillStyle = '#6c7682';
  ctx.beginPath();
  ctx.arc(x0, y0, 10, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#b4c0cc';
  ctx.beginPath();
  ctx.arc(x0, y0, 6, 0, TAU);
  ctx.fill();

  // Tapered metallic mast
  ctx.strokeStyle = '#dce4ec';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = '#52606e';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x0 + 1.5, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  // Blinking red aviation warning light at spire apex
  if (spire.beacon && (night > 0.12 || Math.sin(t * 3.8) > -0.1)) {
    ctx.fillStyle = 'rgba(255, 56, 56, 0.35)';
    ctx.beginPath();
    ctx.arc(x1, y1, 6.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff3e3e';
    ctx.beginPath();
    ctx.arc(x1, y1, 2.8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawBuilding(ctx, b, cam, night, sun, dusk = 0, t = 0) {
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

  // Base volume
  let { rx, ry } = drawExtrudedTier(ctx, b, b.x, b.y, b.w, b.h, 0, 0, ox, oy, b.color, b.roof, night, dusk, true);
  drawRooftopDetails(ctx, b, rx, ry, sun, night, dusk, t);

  // Multi-tier architectural setbacks on downtown towers
  let topHt = b.ht;
  let topX = rx;
  let topY = ry;
  let topW = b.w;
  let topH = b.h;
  let curOx = ox;
  let curOy = oy;
  if (b.setbacks && b.setbacks.length > 0) {
    for (const sb of b.setbacks) {
      const nextHt = topHt + sb.ht;
      const sx = b.x + sb.insetX;
      const sy = b.y + sb.insetY;
      const sw = Math.max(28, b.w - sb.insetX * 2);
      const sh = Math.max(28, b.h - sb.insetY * 2);
      const nextOx = (cx - cam.x) * nextHt * LEAN;
      const nextOy = (cy - cam.y) * nextHt * LEAN;
      const tierRoof = drawExtrudedTier(ctx, b, sx, sy, sw, sh, curOx, curOy, nextOx, nextOy, sb.color || b.color, sb.roof || b.roof, night, dusk, false);
      // Inner parapet trim on setback deck
      ctx.strokeStyle = 'rgba(255, 250, 238, 0.34)';
      ctx.lineWidth = 1.1;
      ctx.strokeRect(tierRoof.rx + 4, tierRoof.ry + 4, sw - 8, sh - 8);
      topHt = nextHt;
      topX = tierRoof.rx;
      topY = tierRoof.ry;
      topW = sw;
      topH = sh;
      curOx = nextOx;
      curOy = nextOy;
    }
    if (b.hasHelipad) {
      drawHelipad(ctx, topX + topW * 0.5, topY + topH * 0.5, Math.min(topW, topH) * 0.27);
    }
  }

  // Illuminated rooftop billboard sign
  if (b.roofSign) {
    drawRoofSign(ctx, b.roofSign, topX, topY, topW, topH, night, dusk);
  }

  // Tapered skyscraper spire + beacon
  if (b.spire) {
    drawSpire(ctx, b.spire, cx, cy, curOx, curOy, cam, topHt, night, t);
  }
}

/** Draw fenced construction lots with gravel pads, timber beams, hazard posts and safety cones. */
export function drawConstructionLot(ctx, lot) {
  ctx.save();
  ctx.fillStyle = '#9c8f78';
  ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
  ctx.fillStyle = '#857964';
  ctx.fillRect(lot.x + 8, lot.y + 8, lot.w - 16, lot.h - 16);

  ctx.strokeStyle = 'rgba(232, 224, 204, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(lot.x + 14, lot.y + 14, lot.w - 28, lot.h - 28);
  ctx.setLineDash([]);

  ctx.fillStyle = '#b88248';
  ctx.fillRect(lot.x + 18, lot.y + 20, 32, 5);
  ctx.fillRect(lot.x + 20, lot.y + 27, 30, 5);
  ctx.fillStyle = '#6c7680';
  ctx.fillRect(lot.x + lot.w - 42, lot.y + lot.h - 26, 26, 6);

  ctx.strokeStyle = 'rgba(218, 224, 228, 0.72)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(lot.x + 1, lot.y + 1, lot.w - 2, lot.h - 2);

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
  ctx.restore();
}

/** Draw mounted dockside, motel strip and downtown neon sign housings and glowing tubes. */
export function drawNeonSign(ctx, n, night, dusk, t) {
  const flicker = n.flicker && Math.sin(t * 23 + n.ph) > 0.92 ? 0.5 : 1;
  const glowAmt = Math.min(1, night * 0.95 + dusk * 0.72);
  const intensity = Math.min(1, 0.35 + glowAmt * 0.65) * flicker;
  ctx.save();
  ctx.fillStyle = '#181c26';
  ctx.fillRect(n.x - n.w * 0.5, n.y - n.h * 0.5, n.w, n.h);
  ctx.strokeStyle = n.hex;
  ctx.globalAlpha = intensity;
  ctx.lineWidth = 2.6;
  ctx.strokeRect(n.x - n.w * 0.5 + 1.5, n.y - n.h * 0.5 + 1.5, n.w - 3, n.h - 3);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = (0.28 + glowAmt * 0.62) * flicker;
  if (n.orient === 'h') {
    ctx.fillRect(n.x - n.w * 0.36, n.y - 1.3, n.w * 0.72, 2.6);
  } else {
    ctx.fillRect(n.x - 1.3, n.y - n.h * 0.36, 2.6, n.h * 0.72);
  }
  ctx.restore();
}
