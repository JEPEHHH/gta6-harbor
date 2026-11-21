// Draw order and the frame: textured ground, animated teal water & foam, roads with worn
// patches, curbs, manholes and crisp lane markings, construction lots, height-sorted buildings,
// props, vehicles and peds with directional sun shadows, effects, lighting, neon, rain, vignette
// and the HUD in fixed 1280x720 logical space.

import { CITY, PALETTE } from './config.js';
import { TAU, rectsOverlap } from './util.js';
import { drawBuilding, drawConstructionLot, drawNeonSign, drawProp } from './buildings.js';
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

/** 0 by day, 1 deep at night, with ramps through dusk and dawn. */
export function nightFactor(h) {
  if (h >= 8 && h <= 16.5) return 0;
  if (h > 16.5 && h < 20.5) return (h - 16.5) / 4;
  if (h >= 20.5 || h <= 5) return 1;
  return 1 - (h - 5) / 3;
}

export function duskFactor(h) {
  return Math.exp(-(((h - 18.3) / 1.55) ** 2));
}

function drawGround(ctx, world, view, t, tex, dusk, night) {
  // 1. Animated teal ocean, harbor basin, wave glints and shoreline foam
  drawWater(ctx, world, view, t, dusk, night);

  // 2. Textured sandy beach and wet tidal strip
  if (view.y + view.h > CITY.beachY - 20 && view.y < CITY.seaY + 20) {
    ctx.fillStyle = tex.sand || PALETTE.sand;
    ctx.fillRect(0, CITY.beachY, CITY.eastX, CITY.seaY - CITY.beachY);
    const wetGrad = ctx.createLinearGradient(0, CITY.seaY - 26, 0, CITY.seaY);
    wetGrad.addColorStop(0, 'rgba(202, 169, 107, 0)');
    wetGrad.addColorStop(1, 'rgba(176, 140, 82, 0.72)');
    ctx.fillStyle = wetGrad;
    ctx.fillRect(0, CITY.seaY - 26, CITY.eastX, 26);
  }

  // 3. City blocks: raised sidewalk paving + crisp curb bevels + textured block grounds
  const stdBlockW = CITY.pitch - (CITY.roadHalf + CITY.walk) * 2;
  for (const g of world.grounds) {
    if (!rectsOverlap({ x: g.x - 24, y: g.y - 24, w: g.w + 48, h: g.h + 48 }, view)) continue;
    if (g.w === stdBlockW) {
      const sx = g.x - CITY.walk;
      const sy = g.y - CITY.walk;
      const sw = g.w + CITY.walk * 2;
      const sh = g.h + CITY.walk * 2;

      // Curb drop shadow onto adjacent asphalt
      ctx.fillStyle = 'rgba(14, 16, 24, 0.34)';
      ctx.fillRect(sx - 2, sy - 2, sw + 5, sh + 5);

      // Sidewalk paving pattern
      ctx.fillStyle = tex.sidewalk || PALETTE.sidewalk;
      ctx.fillRect(sx, sy, sw, sh);

      // Crisp sunlit top/left curb highlight + shaded bottom/right curb lip
      ctx.strokeStyle = PALETTE.curb;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + sw, sy + 1);
      ctx.lineTo(sx + 1, sy + 1);
      ctx.lineTo(sx + 1, sy + sh);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.curbShadow;
      ctx.beginPath();
      ctx.moveTo(sx + sw - 1, sy + 1);
      ctx.lineTo(sx + sw - 1, sy + sh - 1);
      ctx.lineTo(sx + 1, sy + sh - 1);
      ctx.stroke();
    }

    if (g.district === 'park') ctx.fillStyle = tex.park || g.color;
    else if (g.district === 'downtown') ctx.fillStyle = tex.concrete || g.color;
    else if (g.district === 'docks') ctx.fillStyle = tex.dock || g.color;
    else if (g.district === 'beachfront') ctx.fillStyle = tex.promenade || g.color;
    else ctx.fillStyle = tex.lawn || g.color;
    ctx.fillRect(g.x, g.y, g.w, g.h);

    // Subtle inset border separating block yard from sidewalk
    ctx.strokeStyle = 'rgba(42, 46, 40, 0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(g.x + 0.5, g.y + 0.5, g.w - 1, g.h - 1);
  }

  // 4. Construction lots with gravel pads & perimeter fencing
  for (const lot of (world.constructionLots || [])) {
    if (!rectsOverlap(lot, view)) continue;
    drawConstructionLot(ctx, lot);
  }

  // 5. Park paths, shaded pond and animated fountain
  for (const d of world.decor) {
    if (d.kind === 'path') {
      ctx.fillStyle = '#ddd2b2';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = 'rgba(130, 118, 92, 0.32)';
      ctx.lineWidth = 1;
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
      // Gentle ripple ring
      const rr = ((t * 14) % 24) + 8;
      ctx.strokeStyle = `rgba(220, 250, 246, ${(0.35 * (1 - rr / 32)).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(pcx - 8, pcy + 4, rr, rr * 0.6, 0, 0, TAU);
      ctx.stroke();
    } else if (d.kind === 'fountain') {
      ctx.fillStyle = 'rgba(14, 18, 28, 0.24)';
      ctx.beginPath();
      ctx.arc(d.x + 3, d.y + 4, d.r + 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e2dac8';
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

  // 7. Textured asphalt roads with gutters, worn repair patches & manhole covers
  const roadEndY = world.roadsH[CITY.rows - 1] + CITY.roadHalf;
  for (let i = 0; i < world.roadsV.length; i += 1) {
    const v = world.roadsV[i];
    if (v + CITY.roadHalf < view.x || v - CITY.roadHalf > view.x + view.w) continue;
    ctx.fillStyle = tex.asphalt || PALETTE.asphalt;
    ctx.fillRect(v - CITY.roadHalf, 0, CITY.roadHalf * 2, roadEndY);
    // Crisp dark gutter shadow along each curb edge
    ctx.fillStyle = 'rgba(12, 14, 20, 0.24)';
    ctx.fillRect(v - CITY.roadHalf, 0, 3, roadEndY);
    ctx.fillRect(v + CITY.roadHalf - 3, 0, 3, roadEndY);
  }
  for (let j = 0; j < world.roadsH.length; j += 1) {
    const h = world.roadsH[j];
    if (h + CITY.roadHalf < view.y || h - CITY.roadHalf > view.y + view.h) continue;
    ctx.fillStyle = j === CITY.rows - 1 ? (tex.highway || PALETTE.highway) : (tex.asphalt || PALETTE.asphalt);
    ctx.fillRect(0, h - CITY.roadHalf, CITY.eastX, CITY.roadHalf * 2);
    ctx.fillStyle = 'rgba(12, 14, 20, 0.24)';
    ctx.fillRect(0, h - CITY.roadHalf, CITY.eastX, 3);
    ctx.fillRect(0, h + CITY.roadHalf - 3, CITY.eastX, 3);
  }

  // Worn asphalt patches
  for (const wp of (world.wornPatches || [])) {
    if (!rectsOverlap(wp, view)) continue;
    ctx.fillStyle = wp.shade ? 'rgba(84, 86, 98, 0.34)' : 'rgba(26, 28, 34, 0.28)';
    ctx.beginPath();
    ctx.roundRect(wp.x, wp.y, wp.w, wp.h, 3);
    ctx.fill();
  }

  // Cast-iron manhole covers on roads
  for (const mh of (world.manholes || [])) {
    if (mh.x < view.x - 12 || mh.x > view.x + view.w + 12 || mh.y < view.y - 12 || mh.y > view.y + view.h + 12) continue;
    ctx.fillStyle = '#292c34';
    ctx.beginPath();
    ctx.arc(mh.x, mh.y, 5.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#5a606c';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160, 168, 180, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(mh.x - 3, mh.y); ctx.lineTo(mh.x + 3, mh.y);
    ctx.moveTo(mh.x, mh.y - 3); ctx.lineTo(mh.x, mh.y + 3);
    ctx.stroke();
  }

  // Bridge railings over the harbor basin
  ctx.strokeStyle = '#e0dbd0';
  ctx.lineWidth = 3.2;
  for (const b of world.bridges) {
    if (!rectsOverlap(b, view)) continue;
    ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
  }

  // Crisp ochre double/dashed centre lane markings + white stop lines + zebra crosswalks
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
  ctx.fillStyle = PALETTE.zebra;
  for (const v of world.roadsV) {
    if (v < view.x - 65 || v > view.x + view.w + 65) continue;
    for (const h of world.roadsH) {
      if (h < view.y - 65 || h > view.y + view.h + 65) continue;
      // Stop bars just outside crosswalks
      ctx.fillStyle = 'rgba(240, 236, 224, 0.78)';
      ctx.fillRect(v + 2, h - CITY.roadHalf - 19, CITY.roadHalf - 5, 2.5);
      ctx.fillRect(v - CITY.roadHalf + 3, h + CITY.roadHalf + 16.5, CITY.roadHalf - 5, 2.5);
      ctx.fillRect(v - CITY.roadHalf - 19, h - CITY.roadHalf + 3, 2.5, CITY.roadHalf - 5);
      ctx.fillRect(v + CITY.roadHalf + 16.5, h + 2, 2.5, CITY.roadHalf - 5);

      // Zebra stripes
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

    // 1. Ground, water, roads, curbs, manholes, crosswalks, construction lots
    drawGround(ctx, world, view, t, textures, dusk, night);

    // 2. Smooth rubber skid marks on asphalt
    drawSkidmarks(ctx, g.skidmarks, view);

    // 3. Overhead traffic signal housings
    if (g.roadGraph) {
      drawLights(ctx, g.roadGraph, view, night);
    }

    // 4. Everything with a height sorted back-to-front by its base line
    const drawables = [];
    for (const b of world.buildings) {
      if (rectsOverlap({ x: b.x - 220, y: b.y - 220, w: b.w + 440, h: b.h + 440 }, view)) {
        drawables.push({ y: b.y + b.h, kind: 0, o: b });
      }
    }
    for (const p of world.props) {
      if (p.x > view.x - 80 && p.x < view.x + view.w + 80 && p.y > view.y - 140 && p.y < view.y + view.h + 80) {
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
      if (ped.alive && ped.x > view.x - 40 && ped.x < view.x + view.w + 40 && ped.y > view.y - 40 && ped.y < view.y + view.h + 40) {
        drawables.push({ y: ped.y + 6, kind: 4, o: ped });
      }
    }

    drawables.sort((a, b) => a.y - b.y);
    const weapon = g.combat ? g.combat.weapon : 'fist';
    for (const d of drawables) {
      if (d.kind === 0) drawBuilding(ctx, d.o, cam, night, sun, dusk);
      else if (d.kind === 1) drawProp(ctx, d.o, night, t, sun);
      else if (d.kind === 2) drawPlayer(ctx, d.o, sun, weapon);
      else if (d.kind === 3) drawVehicle(ctx, d.o, night, sun, dusk);
      else if (d.kind === 4) drawPed(ctx, d.o, sun);
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

    // 7. World lighting pass: twilight multiply + warm sodium lamps + neon light spill
    drawWorldLighting(ctx, world, view, night, dusk, t);

    ctx.restore();

    // 8. Screen-space atmosphere: warm dusk gradient sky wash, optional rain, subtle vignette
    drawScreenAtmosphere(ctx, cssW, cssH, dusk, night, t, Boolean(g.rain));

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
