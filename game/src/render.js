// Draw order and the frame: ground, water, roads, traffic lights, then everything with a
// height sorted by its base, then particles, night lighting, vehicles, peds, police lights
// and the vignette. The HUD draws last in a fixed 1280x720 logical space scaled to the window.

import { CITY, PALETTE } from './config.js';
import { TAU, clamp, mixColor, rectsOverlap } from './util.js';
import { drawBuilding, drawProp } from './buildings.js';
import { drawPlayer } from './player.js';
import { drawHUD, drawPause, drawTitle } from './hud.js';
import { drawVehicle } from './vehicles.js';
import { drawPed } from './peds.js';
import { drawLights } from './roads.js';
import { drawPoliceLights } from './police.js';
import { drawCrosshair } from './combat.js';

/** 0 by day, 1 deep at night, with ramps through dusk and dawn. */
export function nightFactor(h) {
  if (h >= 8 && h <= 16.5) return 0;
  if (h > 16.5 && h < 20.5) return (h - 16.5) / 4;
  if (h >= 20.5 || h <= 5) return 1;
  return 1 - (h - 5) / 3;
}

export function duskFactor(h) {
  return Math.exp(-(((h - 18.3) / 1.5) ** 2));
}

function drawGround(ctx, world, view, t) {
  // Sea, east and south, plus the harbour basin.
  const seaGrad = ctx.createLinearGradient(0, CITY.seaY, 0, world.h);
  seaGrad.addColorStop(0, '#1b8494');
  seaGrad.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, CITY.seaY, world.w, world.h - CITY.seaY);
  ctx.fillStyle = '#157082';
  ctx.fillRect(CITY.eastX, 0, world.w - CITY.eastX, CITY.seaY);
  ctx.fillStyle = '#187a8c';
  ctx.fillRect(CITY.basin.x, CITY.basin.y, CITY.basin.w, CITY.basin.h);

  // Beach and the wet band at the waterline.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, CITY.beachY, CITY.eastX, CITY.seaY - CITY.beachY);
  ctx.fillStyle = PALETTE.wetSand;
  ctx.fillRect(0, CITY.seaY - 14, CITY.eastX, 14);
  ctx.strokeStyle = 'rgba(191,232,226,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, CITY.seaY + Math.sin(t * 0.9) * 2);
  ctx.lineTo(CITY.eastX, CITY.seaY + Math.sin(t * 0.9 + 2) * 2);
  ctx.stroke();

  // Block grounds with sidewalks, then the park's paths, pond and fountain.
  for (const g of world.grounds) {
    if (!rectsOverlap(g, view)) continue;
    if (g.w === CITY.pitch - (CITY.roadHalf + CITY.walk) * 2) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(g.x - CITY.walk, g.y - CITY.walk, g.w + CITY.walk * 2, g.h + CITY.walk * 2);
    }
    ctx.fillStyle = g.color;
    ctx.fillRect(g.x, g.y, g.w, g.h);
  }
  for (const d of world.decor) {
    if (d.kind === 'path') {
      ctx.fillStyle = '#d8cfae';
      ctx.fillRect(d.x, d.y, d.w, d.h);
    } else if (d.kind === 'pond') {
      ctx.fillStyle = '#2b95a5';
      ctx.beginPath();
      ctx.ellipse(d.x + d.w / 2, d.y + d.h / 2, d.w / 2, d.h / 2, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(191,232,226,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (d.kind === 'fountain') {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2b95a5';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r - 5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(220,245,245,0.8)';
      ctx.beginPath();
      ctx.arc(d.x, d.y, 3 + Math.sin(t * 3) * 1.2, 0, TAU);
      ctx.fill();
    }
  }

  // Piers: planked decks on posts.
  for (const p of world.piers) {
    ctx.fillStyle = PALETTE.pier;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = 'rgba(90,64,40,0.5)';
    ctx.lineWidth = 1;
    for (let x = p.x + 12; x < p.x + p.w; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, p.y + 2);
      ctx.lineTo(x, p.y + p.h - 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#6a4a2a';
    for (const px of [p.x + 6, p.x + p.w - 6]) {
      ctx.beginPath();
      ctx.arc(px, p.y + 4, 3, 0, TAU);
      ctx.arc(px, p.y + p.h - 4, 3, 0, TAU);
      ctx.fill();
    }
  }

  // Roads: the grid, stopping at the shore; the coastal highway runs a shade darker.
  const roadEndY = world.roadsH[CITY.rows - 1] + CITY.roadHalf;
  for (let i = 0; i < world.roadsV.length; i += 1) {
    const v = world.roadsV[i];
    if (v + CITY.roadHalf < view.x || v - CITY.roadHalf > view.x + view.w) continue;
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(v - CITY.roadHalf, 0, CITY.roadHalf * 2, roadEndY);
  }
  for (let j = 0; j < world.roadsH.length; j += 1) {
    const h = world.roadsH[j];
    if (h + CITY.roadHalf < view.y || h - CITY.roadHalf > view.y + view.h) continue;
    ctx.fillStyle = j === CITY.rows - 1 ? PALETTE.highway : PALETTE.asphalt;
    ctx.fillRect(0, h - CITY.roadHalf, CITY.eastX, CITY.roadHalf * 2);
  }

  // Bridge railings where the roads cross the basin.
  ctx.strokeStyle = '#d8d4c8';
  ctx.lineWidth = 3;
  for (const b of world.bridges) {
    if (!rectsOverlap(b, view)) continue;
    ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
  }

  // Centre dashes between intersections, then zebra crossings at the intersections themselves.
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 20]);
  ctx.beginPath();
  for (const v of world.roadsV) {
    if (v < view.x - 40 || v > view.x + view.w + 40) continue;
    for (let j = 0; j < world.roadsH.length - 1; j += 1) {
      ctx.moveTo(v, world.roadsH[j] + 54);
      ctx.lineTo(v, world.roadsH[j + 1] - 54);
    }
  }
  for (const h of world.roadsH) {
    if (h < view.y - 40 || h > view.y + view.h + 40) continue;
    for (let i = 0; i < world.roadsV.length - 1; i += 1) {
      ctx.moveTo(world.roadsV[i] + 54, h);
      ctx.lineTo(world.roadsV[i + 1] - 54, h);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = PALETTE.zebra;
  for (const v of world.roadsV) {
    if (v < view.x - 60 || v > view.x + view.w + 60) continue;
    for (const h of world.roadsH) {
      if (h < view.y - 60 || h > view.y + view.h + 60) continue;
      for (let k = 0; k < 6; k += 1) {
        const bx = v - 25 + k * 9;
        ctx.fillRect(bx, h - CITY.roadHalf - 13, 5, 9);
        ctx.fillRect(bx, h + CITY.roadHalf + 4, 5, 9);
        const by = h - 25 + k * 9;
        ctx.fillRect(v - CITY.roadHalf - 13, by, 9, 5);
        ctx.fillRect(v + CITY.roadHalf + 4, by, 9, 5);
      }
    }
  }

  // Wave glints.
  ctx.lineWidth = 2;
  for (const w of world.waves) {
    if (w.x < view.x || w.x > view.x + view.w || w.y < view.y || w.y > view.y + view.h) continue;
    const a = 0.16 + 0.14 * Math.sin(t * 1.3 + w.ph);
    ctx.strokeStyle = `rgba(191,232,226,${a.toFixed(3)})`;
    const dy = Math.sin(t * 0.8 + w.ph) * 2;
    ctx.beginPath();
    ctx.moveTo(w.x - w.len / 2, w.y + dy);
    ctx.quadraticCurveTo(w.x, w.y + dy - 3, w.x + w.len / 2, w.y + dy);
    ctx.stroke();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  function draw(g) {
    const cam = g.camera;
    const world = g.world;
    const t = g.elapsed;
    const night = nightFactor(g.time);
    const dusk = duskFactor(g.time);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PALETTE.land;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.save();
    ctx.translate(cssW / 2, cssH / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x - cam.sx, -cam.y - cam.sy);
    const view = cam.view(cssW, cssH, 140);

    drawGround(ctx, world, view, t);

    // Traffic lights
    if (g.roadGraph) {
      drawLights(ctx, g.roadGraph, view);
    }

    // Everything with a height paints back to front by its base line.
    const drawables = [];
    for (const b of world.buildings) {
      if (rectsOverlap({ x: b.x - 200, y: b.y - 200, w: b.w + 400, h: b.h + 400 }, view)) {
        drawables.push({ y: b.y + b.h, kind: 0, o: b });
      }
    }
    for (const p of world.props) {
      if (p.x > view.x - 60 && p.x < view.x + view.w + 60 && p.y > view.y - 120 && p.y < view.y + view.h + 60) {
        drawables.push({ y: p.y, kind: 1, o: p });
      }
    }
    if (!g.player.inCar) drawables.push({ y: g.player.y + 8, kind: 2, o: g.player });

    // Add vehicles to the drawable list
    const allVehicles = [
      ...(g.parkedCars || []),
      ...(g.traffic || []),
      ...(g.policeState ? g.policeState.units.map((u) => u.car) : []),
    ];
    if (g.player.inCar) allVehicles.push(g.player.inCar);
    for (const v of allVehicles) {
      if (v.x > view.x - 60 && v.x < view.x + view.w + 60 && v.y > view.y - 60 && v.y < view.y + view.h + 60) {
        drawables.push({ y: v.y + 8, kind: 3, o: v });
      }
    }

    // Add pedestrians to the drawable list
    for (const ped of (g.peds || [])) {
      if (ped.alive && ped.x > view.x - 30 && ped.x < view.x + view.w + 30 && ped.y > view.y - 30 && ped.y < view.y + view.h + 30) {
        drawables.push({ y: ped.y + 6, kind: 4, o: ped });
      }
    }

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      if (d.kind === 0) drawBuilding(ctx, d.o, cam, night);
      else if (d.kind === 1) drawProp(ctx, d.o, night, t);
      else if (d.kind === 2) drawPlayer(ctx, d.o);
      else if (d.kind === 3) drawVehicle(ctx, d.o, night);
      else if (d.kind === 4) drawPed(ctx, d.o);
    }

    // Police siren lights
    if (g.policeState) {
      drawPoliceLights(ctx, g.policeState, t);
    }

    for (const pt of g.particles) {
      const a = Math.max(0, 1 - pt.age / pt.life) * 0.5;
      ctx.fillStyle = `rgba(${pt.color},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (0.6 + pt.age / pt.life), 0, TAU);
      ctx.fill();
    }

    // Bullets — small bright dots in world space.
    for (const bl of (g.bullets ?? [])) {
      const a = Math.max(0, 1 - bl.age / bl.life);
      ctx.fillStyle = `rgba(255,230,160,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(bl.x, bl.y, 2.2, 0, TAU);
      ctx.fill();
    }

    // Street light pools, then the night itself, then a warm dusk grade.
    if (night > 0.15) {
      ctx.globalCompositeOperation = 'lighter';
      for (const l of world.lamps) {
        if (l.x < view.x || l.x > view.x + view.w || l.y < view.y || l.y > view.y + view.h) continue;
        const grad = ctx.createRadialGradient(l.x, l.y - 14, 4, l.x, l.y - 14, 82);
        grad.addColorStop(0, `rgba(255,214,130,${(0.3 * night).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255,214,130,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(l.x - 82, l.y - 96, 164, 164);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = mixColor('#ffffff', PALETTE.night, night * 0.82);
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalCompositeOperation = 'source-over';
    if (dusk > 0.05) {
      ctx.fillStyle = `rgba(255,128,48,${(0.1 * dusk).toFixed(3)})`;
      ctx.fillRect(view.x, view.y, view.w, view.h);
    }
    ctx.restore();

    // Vignette in screen space.
    const vig = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.42, cssW / 2, cssH / 2, Math.hypot(cssW, cssH) * 0.55);
    vig.addColorStop(0, 'rgba(4,6,12,0)');
    vig.addColorStop(1, 'rgba(4,6,12,0.36)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, cssW, cssH);

    // Crosshair (screen space)
    if (g.screen === 'play' && !g.player.inCar && g.combat && g.combat.weapon !== 'fist' && g.input) {
      drawCrosshair(ctx, g.input.mouse.x * dpr, g.input.mouse.y * dpr);
    }

    // HUD in the fixed logical area, letterboxed and centred.
    const s = Math.min(cssW / 1280, cssH / 720);
    const ox = (cssW - 1280 * s) / 2;
    const oy = (cssH - 720 * s) / 2;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    if (g.screen === 'title') drawTitle(ctx, g, t);
    else {
      drawHUD(ctx, g);
      if (g.screen === 'pause') drawPause(ctx, g);
      if (g.deathScreen) {
        ctx.fillStyle = 'rgba(140,20,20,0.35)';
        ctx.fillRect(0, 0, 1280, 720);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4040';
        ctx.font = `900 64px system-ui, sans-serif`;
        ctx.fillText(g.deathScreen === 'busted' ? 'BUSTED' : 'WASTED', 640, 340);
        ctx.fillStyle = '#f2f5f7';
        ctx.font = `600 18px system-ui, sans-serif`;
        ctx.fillText('Press Enter to continue', 640, 400);
      }
    }
  }

  return { draw, resize, cssW: () => cssW, cssH: () => cssH, dpr: () => dpr };
}
