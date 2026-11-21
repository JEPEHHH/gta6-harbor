// Draw order and the frame: textured ground, animated teal water & foam, 3D curbs,
// tyre-darkened asphalt lanes, patches, painted parking bays, storm drains, manholes,
// fences, height-sorted buildings, rich street props, vehicles and peds with directional
// sun shadows, effects, lighting, neon, rain, colour grading and the HUD in 1280x720 space.

import { CITY, PALETTE } from './config.js';
import { TAU, rectsOverlap } from './util.js';
import { drawBuilding, drawConstructionLot, drawNeonSign } from './buildings.js';
import { drawProp, drawFence } from './props.js';
import { drawPlayer } from './player.js';
import { drawHUD, drawPause, drawTitle } from './hud.js';
import { drawVehicle } from './vehicles.js';
import { drawPed } from './peds.js';
import { drawLights } from './roads.js';
import { drawPoliceLights } from './police.js';
import { drawCrosshair } from './combat.js';
import { createSurfaceTextures, drawWater } from './textures.js';
import { sunShadowVector, drawWorldLighting, drawScreenAtmosphere } from './lighting.js';
import { drawSkidmarks, drawBulletTracers, drawMuzzleFlash, drawParticles, drawMissionWaypoint } from './effects.js';

/** 0 by day (including 08:10 morning & 17:20 golden hour), 0.56 at 19:40 dusk, 1 at 21:00 night. */
export function nightFactor(h) {
  if (h >= 7.5 && h <= 18.0) return 0;
  if (h > 18.0 && h < 20.8) return (h - 18.0) / 2.8;
  if (h >= 20.8 || h <= 5.0) return 1;
  return 1 - (h - 5.0) / 2.5;
}

/** Peaks during sunset & coastal twilight (~19:15-19:50). */
export function duskFactor(h) {
  return Math.exp(-(((h - 19.3) / 1.15) ** 2));
}

function drawGround(ctx, world, view, t, tex, dusk, night, sun) {
  // 1. Animated teal ocean, harbor basin, wave glints and shoreline foam
  drawWater(ctx, world, view, t, dusk, night);

  // 2. Textured sandy beach and wet tidal strip
  if (view.y + view.h > CITY.beachY - 20 && view.y < CITY.seaY + 20) {
    ctx.fillStyle = tex.sand || PALETTE.sand;
    ctx.fillRect(0, CITY.beachY, CITY.eastX, CITY.seaY - CITY.beachY);
    const wetGrad = ctx.createLinearGradient(0, CITY.seaY - 28, 0, CITY.seaY);
    wetGrad.addColorStop(0, 'rgba(202, 169, 107, 0)');
    wetGrad.addColorStop(1, 'rgba(168, 134, 76, 0.76)');
    ctx.fillStyle = wetGrad;
    ctx.fillRect(0, CITY.seaY - 28, CITY.eastX, 28);
  }

  // 3. City blocks: raised sidewalk paving + 3D curb faces with sunlit highlight edge + block grounds
  const stdBlockW = CITY.pitch - (CITY.roadHalf + CITY.walk) * 2;
  for (const g of world.grounds) {
    if (!rectsOverlap({ x: g.x - 28, y: g.y - 28, w: g.w + 56, h: g.h + 56 }, view)) continue;
    if (g.w === stdBlockW) {
      const sx = g.x - CITY.walk;
      const sy = g.y - CITY.walk;
      const sw = g.w + CITY.walk * 2;
      const sh = g.h + CITY.walk * 2;

      // Curb drop shadow cast onto adjacent asphalt
      ctx.fillStyle = 'rgba(12, 16, 26, 0.42)';
      ctx.fillRect(sx - 2, sy - 2, sw + 6, sh + 6);

      // Raised shaded 3D curb vertical face (bottom & right rim visible)
      ctx.fillStyle = PALETTE.curbFace || '#9d9688';
      ctx.fillRect(sx - 1, sy - 1, sw + 3, sh + 3);

      // Sidewalk paving slab surface
      ctx.fillStyle = tex.sidewalk || PALETTE.sidewalk;
      ctx.fillRect(sx, sy, sw, sh);

      // Sunlit curb highlight bevel along top & left faces + crisp curb joints
      ctx.strokeStyle = PALETTE.curb;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(sx + sw, sy + 1.2);
      ctx.lineTo(sx + 1.2, sy + 1.2);
      ctx.lineTo(sx + 1.2, sy + sh);
      ctx.stroke();

      // Shaded vertical curb lip along bottom & right faces
      ctx.strokeStyle = PALETTE.curbShadow;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(sx + sw - 1.1, sy + 1);
      ctx.lineTo(sx + sw - 1.1, sy + sh - 1.1);
      ctx.lineTo(sx + 1, sy + sh - 1.1);
      ctx.stroke();

      // Inner curb highlight thread on bottom/right top edge for crisp 3D curb face read
      ctx.strokeStyle = 'rgba(255, 250, 238, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + sw - 3, sy + 3);
      ctx.lineTo(sx + sw - 3, sy + sh - 3);
      ctx.lineTo(sx + 3, sy + sh - 3);
      ctx.stroke();
    }

    if (g.district === 'park') ctx.fillStyle = tex.park || g.color;
    else if (g.district === 'downtown') ctx.fillStyle = tex.concrete || g.color;
    else if (g.district === 'docks') ctx.fillStyle = tex.dock || g.color;
    else if (g.district === 'beachfront') ctx.fillStyle = tex.promenade || g.color;
    else ctx.fillStyle = tex.lawn || g.color;
    ctx.fillRect(g.x, g.y, g.w, g.h);

    // Architectural plaza inset framing on downtown/beachfront blocks
    if (g.district === 'downtown' || g.district === 'beachfront') {
      ctx.strokeStyle = 'rgba(255, 248, 234, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(g.x + 6, g.y + 6, g.w - 12, g.h - 12);
    }

    // Subtle inset border separating block yard from sidewalk
    ctx.strokeStyle = 'rgba(38, 42, 36, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(g.x + 0.5, g.y + 0.5, g.w - 1, g.h - 1);
  }

  // 3b. Suburban concrete driveways
  ctx.fillStyle = '#c8c0b0';
  for (const dw of (world.driveways || [])) {
    if (!rectsOverlap(dw, view)) continue;
    ctx.fillRect(dw.x, dw.y, dw.w, dw.h);
    ctx.strokeStyle = 'rgba(84, 78, 70, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(dw.x + 0.5, dw.y + 0.5, dw.w - 1, dw.h - 1);
  }

  // 4. Construction lots with gravel pads & perimeter fencing
  for (const lot of (world.constructionLots || [])) {
    if (!rectsOverlap(lot, view)) continue;
    drawConstructionLot(ctx, lot);
  }

  // 5. Park paths, shaded pond and animated fountain
  for (const d of world.decor) {
    if (d.kind === 'path') {
      ctx.fillStyle = '#e0d5b8';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = 'rgba(116, 104, 80, 0.36)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1);
    } else if (d.kind === 'pond') {
      const pcx = d.x + d.w * 0.5;
      const pcy = d.y + d.h * 0.5;
      const pGrad = ctx.createRadialGradient(pcx - 10, pcy - 8, 6, pcx, pcy, d.w * 0.55);
      pGrad.addColorStop(0, '#36aab8');
      pGrad.addColorStop(0.7, '#1b7a8c');
      pGrad.addColorStop(1, '#11586a');
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.ellipse(pcx, pcy, d.w * 0.5, d.h * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(218, 246, 240, 0.62)';
      ctx.lineWidth = 2;
      ctx.stroke();
      const rr = ((t * 14) % 24) + 8;
      ctx.strokeStyle = `rgba(220, 250, 246, ${(0.35 * (1 - rr / 32)).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(pcx - 8, pcy + 4, rr, rr * 0.6, 0, 0, TAU);
      ctx.stroke();
    } else if (d.kind === 'fountain') {
      ctx.fillStyle = 'rgba(14, 18, 28, 0.28)';
      ctx.beginPath();
      ctx.arc(d.x + (sun ? sun.dx * 10 : 3), d.y + (sun ? sun.dy * 10 : 4), d.r + 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e5ddc9';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#9c9484';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#2597a8';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r - 5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220, 250, 248, 0.72)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 7 + Math.sin(t * 3.2) * 2, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(240, 254, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(d.x, d.y, 3.2 + Math.sin(t * 4) * 1.1, 0, TAU);
      ctx.fill();
    }
  }

  // 6. Timber piers with shadows on the teal water, planks & mooring bollards
  for (const p of world.piers) {
    if (!rectsOverlap({ x: p.x - 10, y: p.y - 10, w: p.w + 20, h: p.h + 24 }, view)) continue;
    ctx.fillStyle = 'rgba(4, 18, 28, 0.36)';
    ctx.fillRect(p.x + 5, p.y + 8, p.w, p.h);
    ctx.fillStyle = PALETTE.pier;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = 'rgba(72, 48, 28, 0.52)';
    ctx.lineWidth = 1;
    for (let x = p.x + 10; x < p.x + p.w; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, p.y + 2);
      ctx.lineTo(x, p.y + p.h - 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#5c3f24';
    for (let px = p.x + 12; px < p.x + p.w; px += 48) {
      ctx.beginPath();
      ctx.arc(px, p.y + 4, 3.2, 0, TAU);
      ctx.arc(px, p.y + p.h - 4, 3.2, 0, TAU);
      ctx.fill();
    }
  }

  // 7. Textured asphalt roads with deep curb gutters, tyre-darkened wheel tracks & worn patches
  const roadEndY = world.roadsH[CITY.rows - 1] + CITY.roadHalf;
  for (let i = 0; i < world.roadsV.length; i += 1) {
    const v = world.roadsV[i];
    if (v + CITY.roadHalf < view.x || v - CITY.roadHalf > view.x + view.w) continue;
    ctx.fillStyle = tex.asphalt || PALETTE.asphalt;
    ctx.fillRect(v - CITY.roadHalf, 0, CITY.roadHalf * 2, roadEndY);
    // Tyre-darkened wheel tracks along both lanes
    ctx.fillStyle = 'rgba(16, 18, 24, 0.14)';
    ctx.fillRect(v - 18, 0, 5, roadEndY);
    ctx.fillRect(v - 9, 0, 5, roadEndY);
    ctx.fillRect(v + 4, 0, 5, roadEndY);
    ctx.fillRect(v + 13, 0, 5, roadEndY);
    // Crisp dark gutter shadow along each curb edge
    ctx.fillStyle = 'rgba(10, 12, 18, 0.34)';
    ctx.fillRect(v - CITY.roadHalf, 0, 3.5, roadEndY);
    ctx.fillRect(v + CITY.roadHalf - 3.5, 0, 3.5, roadEndY);
  }
  for (let j = 0; j < world.roadsH.length; j += 1) {
    const h = world.roadsH[j];
    if (h + CITY.roadHalf < view.y || h - CITY.roadHalf > view.y + view.h) continue;
    ctx.fillStyle = j === CITY.rows - 1 ? (tex.highway || PALETTE.highway) : (tex.asphalt || PALETTE.asphalt);
    ctx.fillRect(0, h - CITY.roadHalf, CITY.eastX, CITY.roadHalf * 2);
    // Tyre-darkened wheel tracks along both lanes
    ctx.fillStyle = 'rgba(16, 18, 24, 0.14)';
    ctx.fillRect(0, h - 18, CITY.eastX, 5);
    ctx.fillRect(0, h - 9, CITY.eastX, 5);
    ctx.fillRect(0, h + 4, CITY.eastX, 5);
    ctx.fillRect(0, h + 13, CITY.eastX, 5);
    // Curb gutters
    ctx.fillStyle = 'rgba(10, 12, 18, 0.34)';
    ctx.fillRect(0, h - CITY.roadHalf, CITY.eastX, 3.5);
    ctx.fillRect(0, h + CITY.roadHalf - 3.5, CITY.eastX, 3.5);
  }

  // Tyre-darkened braking & turning wear zones at every junction
  for (const v of world.roadsV) {
    if (v < view.x - 80 || v > view.x + view.w + 80) continue;
    for (const h of world.roadsH) {
      if (h < view.y - 80 || h > view.y + view.h + 80) continue;
      const wearGrad = ctx.createRadialGradient(v, h, 8, v, h, 52);
      wearGrad.addColorStop(0, 'rgba(16, 18, 24, 0.24)');
      wearGrad.addColorStop(0.6, 'rgba(18, 20, 26, 0.13)');
      wearGrad.addColorStop(1, 'rgba(18, 20, 26, 0)');
      ctx.fillStyle = wearGrad;
      ctx.beginPath();
      ctx.arc(v, h, 52, 0, TAU);
      ctx.fill();
    }
  }

  // Worn asphalt patches & tar seams
  for (const wp of (world.wornPatches || [])) {
    if (!rectsOverlap(wp, view)) continue;
    ctx.fillStyle = wp.shade ? 'rgba(92, 95, 108, 0.32)' : 'rgba(22, 24, 30, 0.30)';
    ctx.beginPath();
    ctx.roundRect(wp.x, wp.y, wp.w, wp.h, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(14, 16, 20, 0.24)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  // Painted parallel parking bays along curbs
  ctx.strokeStyle = 'rgba(238, 234, 222, 0.44)';
  ctx.lineWidth = 1.2;
  for (const bay of (world.parkingBays || [])) {
    if (bay.x < view.x - 50 || bay.x > view.x + view.w + 50 || bay.y < view.y - 50 || bay.y > view.y + view.h + 50) continue;
    ctx.beginPath();
    if (bay.orient === 'v') {
      const innerX = bay.x - bay.side * (bay.w * 0.5);
      const outerX = bay.x + bay.side * (bay.w * 0.48);
      const y0 = bay.y - bay.h * 0.5;
      const y1 = bay.y + bay.h * 0.5;
      ctx.moveTo(outerX, y0); ctx.lineTo(innerX, y0);
      ctx.lineTo(innerX, y1); ctx.lineTo(outerX, y1);
    } else {
      const innerY = bay.y - bay.side * (bay.h * 0.5);
      const outerY = bay.y + bay.side * (bay.h * 0.48);
      const x0 = bay.x - bay.w * 0.5;
      const x1 = bay.x + bay.w * 0.5;
      ctx.moveTo(x0, outerY); ctx.lineTo(x0, innerY);
      ctx.lineTo(x1, innerY); ctx.lineTo(x1, outerY);
    }
    ctx.stroke();
  }

  // Painted amber-yellow bus stop curb zones
  for (const bb of (world.busBays || [])) {
    if (bb.x < view.x - 70 || bb.x > view.x + view.w + 70 || bb.y < view.y - 70 || bb.y > view.y + view.h + 70) continue;
    ctx.strokeStyle = 'rgba(238, 188, 62, 0.62)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(bb.x - bb.w * 0.5, bb.y - bb.h * 0.5, bb.w, bb.h);
    ctx.setLineDash([]);
  }

  // Slotted iron storm drains tucked against curbs
  for (const dr of (world.drains || [])) {
    if (dr.x < view.x - 16 || dr.x > view.x + view.w + 16 || dr.y < view.y - 16 || dr.y > view.y + view.h + 16) continue;
    ctx.fillStyle = '#20242c';
    if (dr.orient === 'v') {
      ctx.fillRect(dr.x - 2.5, dr.y - 5.5, 5, 11);
      ctx.strokeStyle = '#626a76';
      ctx.lineWidth = 0.8;
      for (let sy = dr.y - 4; sy <= dr.y + 4; sy += 2) {
        ctx.beginPath();
        ctx.moveTo(dr.x - 1.8, sy); ctx.lineTo(dr.x + 1.8, sy);
        ctx.stroke();
      }
    } else {
      ctx.fillRect(dr.x - 5.5, dr.y - 2.5, 11, 5);
      ctx.strokeStyle = '#626a76';
      ctx.lineWidth = 0.8;
      for (let sx = dr.x - 4; sx <= dr.x + 4; sx += 2) {
        ctx.beginPath();
        ctx.moveTo(sx, dr.y - 1.8); ctx.lineTo(sx, dr.y + 1.8);
        ctx.stroke();
      }
    }
  }

  // Cast-iron manhole covers on roads
  for (const mh of (world.manholes || [])) {
    if (mh.x < view.x - 12 || mh.x > view.x + view.w + 12 || mh.y < view.y - 12 || mh.y > view.y + view.h + 12) continue;
    ctx.fillStyle = '#272a32';
    ctx.beginPath();
    ctx.arc(mh.x, mh.y, 5.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#646b78';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(170, 178, 190, 0.38)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(mh.x - 3.2, mh.y); ctx.lineTo(mh.x + 3.2, mh.y);
    ctx.moveTo(mh.x, mh.y - 3.2); ctx.lineTo(mh.x, mh.y + 3.2);
    ctx.stroke();
  }

  // Bridge railings over the harbor basin
  ctx.strokeStyle = '#e0dbd0';
  ctx.lineWidth = 3.2;
  for (const b of world.bridges) {
    if (!rectsOverlap(b, view)) continue;
    ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
  }

  // Crisp ochre dashed centre lane markings
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 2.2;
  ctx.setLineDash([16, 18]);
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

  // Crisp crosswalk bars & stop lines at every intersection
  for (const v of world.roadsV) {
    if (v < view.x - 65 || v > view.x + view.w + 65) continue;
    for (const h of world.roadsH) {
      if (h < view.y - 65 || h > view.y + view.h + 65) continue;
      ctx.fillStyle = 'rgba(242, 238, 226, 0.80)';
      ctx.fillRect(v + 2, h - CITY.roadHalf - 19, CITY.roadHalf - 5, 2.6);
      ctx.fillRect(v - CITY.roadHalf + 3, h + CITY.roadHalf + 16.5, CITY.roadHalf - 5, 2.6);
      ctx.fillRect(v - CITY.roadHalf - 19, h - CITY.roadHalf + 3, 2.6, CITY.roadHalf - 5);
      ctx.fillRect(v + CITY.roadHalf + 16.5, h + 2, 2.6, CITY.roadHalf - 5);

      ctx.fillStyle = PALETTE.zebra;
      for (let k = 0; k < 6; k += 1) {
        const bx = v - 25 + k * 9;
        ctx.fillRect(bx, h - CITY.roadHalf - 13, 5, 10);
        ctx.fillRect(bx, h + CITY.roadHalf + 3, 5, 10);
        const by = h - 25 + k * 9;
        ctx.fillRect(v - CITY.roadHalf - 13, by, 10, 5);
        ctx.fillRect(v + CITY.roadHalf + 3, by, 10, 5);
      }
    }
  }

  // 8. Suburban fences, hedges, park iron railings & dock chain-link fences
  for (const f of (world.fences || [])) {
    const minX = Math.min(f.x1, f.x2) - 16;
    const minY = Math.min(f.y1, f.y2) - 16;
    const w = Math.abs(f.x2 - f.x1) + 32;
    const h = Math.abs(f.y2 - f.y1) + 32;
    if (!rectsOverlap({ x: minX, y: minY, w, h }, view)) continue;
    drawFence(ctx, f, sun);
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const textures = createSurfaceTextures(ctx);
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
    const sun = sunShadowVector(g.time);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PALETTE.land;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.save();
    ctx.translate(cssW * 0.5, cssH * 0.5);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x - cam.sx, -cam.y - cam.sy);
    const view = cam.view(cssW, cssH, 160);

    // 1. Ground, water, 3D curbs, worn roads, parking bays, drains, manholes, crosswalks, fences
    drawGround(ctx, world, view, t, textures, dusk, night, sun);

    // 2. Smooth rubber skid marks on asphalt
    drawSkidmarks(ctx, g.skidmarks, view);

    // 3. Everything with a height sorted back-to-front by its base line
    const drawables = [];
    for (const b of world.buildings) {
      if (rectsOverlap({ x: b.x - 240, y: b.y - 240, w: b.w + 480, h: b.h + 480 }, view)) {
        drawables.push({ y: b.y + b.h, kind: 0, o: b });
      }
    }
    for (const p of world.props) {
      if (p.x > view.x - 90 && p.x < view.x + view.w + 90 && p.y > view.y - 150 && p.y < view.y + view.h + 90) {
        drawables.push({ y: p.y, kind: 1, o: p });
      }
    }
    if (!g.player.inCar) drawables.push({ y: g.player.y + 8, kind: 2, o: g.player });

    const allVehicles = [
      ...(g.parkedCars || []),
      ...(g.traffic || []),
      ...(g.policeState ? g.policeState.units.map((u) => u.car) : []),
    ];
    if (g.player.inCar) allVehicles.push(g.player.inCar);
    for (const v of allVehicles) {
      if (v.x > view.x - 120 && v.x < view.x + view.w + 120 && v.y > view.y - 120 && v.y < view.y + view.h + 120) {
        drawables.push({ y: v.y + 8, kind: 3, o: v });
      }
    }

    for (const ped of (g.peds || [])) {
      if (ped.alive && ped.x > view.x - 45 && ped.x < view.x + view.w + 45 && ped.y > view.y - 45 && ped.y < view.y + view.h + 45) {
        drawables.push({ y: ped.y + 6, kind: 4, o: ped });
      }
    }

    drawables.sort((a, b) => a.y - b.y);
    const weapon = g.combat ? g.combat.weapon : 'fist';
    for (const d of drawables) {
      if (d.kind === 0) drawBuilding(ctx, d.o, cam, night, sun, dusk);
      else if (d.kind === 1) drawProp(ctx, d.o, night, t, sun);
      else if (d.kind === 2) drawPlayer(ctx, d.o, sun, weapon);
      else if (d.kind === 3) drawVehicle(ctx, d.o, night, sun, dusk, t);
      else if (d.kind === 4) drawPed(ctx, d.o, sun, t);
    }

    // 4. Overhead traffic signals on corner poles (drawn above vehicles passing underneath)
    if (g.roadGraph) {
      drawLights(ctx, g.roadGraph, view, night, sun);
    }

    // 5. Mounted dockside & Midtown neon signs
    for (const n of (world.neonSigns || [])) {
      if (n.x < view.x - 80 || n.x > view.x + view.w + 80 || n.y < view.y - 80 || n.y > view.y + view.h + 80) continue;
      drawNeonSign(ctx, n, night, dusk, t);
    }

    // 6. Police siren strobes, mission waypoint beacon, particles, tracers & muzzle flash
    if (g.policeState) {
      drawPoliceLights(ctx, g.policeState, t);
    }
    if (g.mission && g.mission.waypoint) {
      drawMissionWaypoint(ctx, g.mission.waypoint, t);
    }
    drawParticles(ctx, g.particles, view);
    drawBulletTracers(ctx, g.bullets, view);
    drawMuzzleFlash(ctx, g.player, g.combat);

    // 7. World lighting pass: twilight multiply + warm sodium lamps + neon light spill & night bloom
    drawWorldLighting(ctx, world, view, night, dusk, t);

    ctx.restore();

    // 8. Screen-space colour grading: warm afternoon/golden hour, morning, dusk, rain, vignette
    drawScreenAtmosphere(ctx, cssW, cssH, dusk, night, t, Boolean(g.rain), g.time);

    // 9. Crosshair (screen space)
    if (g.screen === 'play' && !g.player.inCar && g.combat && g.combat.weapon !== 'fist' && g.input) {
      drawCrosshair(ctx, g.input.mouse.x, g.input.mouse.y);
    }

    // 10. HUD in fixed 1280x720 logical space
    const s = Math.min(cssW / 1280, cssH / 720);
    const ox = (cssW - 1280 * s) / 2;
    const oy = (cssH - 720 * s) / 2;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    if (g.screen === 'title') drawTitle(ctx, g, t);
    else {
      drawHUD(ctx, g);
      if (g.screen === 'pause') drawPause(ctx, g);
      if (g.deathScreen) {
        ctx.fillStyle = 'rgba(120, 16, 20, 0.42)';
        ctx.fillRect(0, 0, 1280, 720);
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.75)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#ff4242';
        ctx.font = '900 66px system-ui, sans-serif';
        ctx.fillText(g.deathScreen === 'busted' ? 'BUSTED' : 'WASTED', 640, 340);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#f4f7fa';
        ctx.font = '600 18px system-ui, sans-serif';
        ctx.fillText('Press Enter to continue', 640, 400);
      }
    }
  }

  return { draw, resize, cssW: () => cssW, cssH: () => cssH, dpr: () => dpr };
}
