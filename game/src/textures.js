// Procedural Canvas2D texture tiles and animated water/foam rendering.
// Generated once on offscreen canvases using seeded randomness — zero external assets.

import { CITY, PALETTE } from './config.js';
import { TAU, makeRng, rectsOverlap } from './util.js';

function makeTile(size, drawFn) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  drawFn(g, size);
  return c;
}

/** Build cached CanvasPatterns for every ground material in Blackwater Harbor. */
export function createSurfaceTextures(ctx) {
  const rng = makeRng(90421);

  // Fine-grain asphalt with subtle mineral aggregate and faint wear streaks
  const asphaltTile = makeTile(96, (g, s) => {
    g.fillStyle = PALETTE.asphalt;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 240; i += 1) {
      const x = Math.floor(rng() * s);
      const y = Math.floor(rng() * s);
      const bright = rng() > 0.5;
      g.fillStyle = bright ? 'rgba(255,250,240,0.055)' : 'rgba(12,14,20,0.09)';
      g.fillRect(x, y, rng() < 0.7 ? 1 : 2, 1);
    }
    // Subtle tar repair hairline
    g.strokeStyle = 'rgba(20,22,28,0.16)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(12, 0);
    g.lineTo(18, 44);
    g.lineTo(14, s);
    g.stroke();
  });

  // Slightly darker coastal highway asphalt
  const highwayTile = makeTile(96, (g, s) => {
    g.fillStyle = PALETTE.highway;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 220; i += 1) {
      const x = Math.floor(rng() * s);
      const y = Math.floor(rng() * s);
      g.fillStyle = rng() > 0.48 ? 'rgba(255,248,236,0.05)' : 'rgba(8,10,16,0.10)';
      g.fillRect(x, y, 1, 1);
    }
  });

  // Sidewalk paving slabs with beveled expansion joints
  const sidewalkTile = makeTile(32, (g, s) => {
    g.fillStyle = PALETTE.sidewalk;
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,252,244,0.12)';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = 'rgba(90,82,70,0.05)';
    g.fillRect(16, 16, 16, 16);
    g.strokeStyle = 'rgba(110,102,90,0.24)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, 0.5); g.lineTo(s, 0.5);
    g.moveTo(0, 16.5); g.lineTo(s, 16.5);
    g.moveTo(0.5, 0); g.lineTo(0.5, s);
    g.moveTo(16.5, 0); g.lineTo(16.5, s);
    g.stroke();
    for (let i = 0; i < 24; i += 1) {
      g.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(80,74,64,0.07)';
      g.fillRect(Math.floor(rng() * s), Math.floor(rng() * s), 1, 1);
    }
  });

  // Sun-warmed downtown concrete plaza slabs
  const concreteTile = makeTile(64, (g, s) => {
    g.fillStyle = PALETTE.concrete;
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,246,232,0.07)';
    g.fillRect(0, 0, 32, 32);
    g.fillRect(32, 32, 32, 32);
    g.strokeStyle = 'rgba(92,86,78,0.20)';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, 31, 31);
    g.strokeRect(32.5, 32.5, 31, 31);
    for (let i = 0; i < 65; i += 1) {
      g.fillStyle = rng() > 0.5 ? 'rgba(255,250,242,0.06)' : 'rgba(60,56,50,0.07)';
      g.fillRect(Math.floor(rng() * s), Math.floor(rng() * s), 2, 1);
    }
  });

  // Industrial concrete dock slabs with weathered joints
  const dockTile = makeTile(64, (g, s) => {
    g.fillStyle = PALETTE.dock;
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,248,238,0.05)';
    g.fillRect(0, 0, s, 32);
    g.strokeStyle = 'rgba(42,46,52,0.26)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, 32.5); g.lineTo(s, 32.5);
    g.moveTo(32.5, 0); g.lineTo(32.5, s);
    g.stroke();
    for (let i = 0; i < 80; i += 1) {
      g.fillStyle = rng() > 0.55 ? 'rgba(240,238,232,0.05)' : 'rgba(30,34,40,0.09)';
      g.fillRect(Math.floor(rng() * s), Math.floor(rng() * s), 2, 1);
    }
  });

  // Park grass with layered organic tonal mottling and fine blades
  const parkTile = makeTile(64, (g, s) => {
    g.fillStyle = PALETTE.park;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 14; i += 1) {
      g.fillStyle = rng() > 0.5 ? 'rgba(130,185,95,0.16)' : 'rgba(42,84,36,0.14)';
      g.beginPath();
      g.arc(rng() * s, rng() * s, 5 + rng() * 9, 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 90; i += 1) {
      const bx = rng() * s;
      const by = rng() * s;
      g.strokeStyle = rng() > 0.5 ? 'rgba(155,205,112,0.28)' : 'rgba(38,76,34,0.24)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + (rng() - 0.5) * 2.5, by - 3 - rng() * 2);
      g.stroke();
    }
  });

  // Suburban lawn grass (slightly warmer sunlit tone)
  const lawnTile = makeTile(64, (g, s) => {
    g.fillStyle = '#8eaa6b';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 12; i += 1) {
      g.fillStyle = rng() > 0.5 ? 'rgba(182,208,128,0.14)' : 'rgba(90,118,62,0.12)';
      g.beginPath();
      g.arc(rng() * s, rng() * s, 5 + rng() * 8, 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 60; i += 1) {
      const bx = rng() * s;
      const by = rng() * s;
      g.fillStyle = rng() > 0.5 ? 'rgba(205,222,150,0.18)' : 'rgba(72,96,52,0.16)';
      g.fillRect(bx, by, 1.5, 2.5);
    }
  });

  // Warm beach sand with subtle wind ripples and shell flecks
  const sandTile = makeTile(64, (g, s) => {
    g.fillStyle = PALETTE.sand;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,248,224,0.22)';
    g.lineWidth = 2;
    for (let y = 8; y < s; y += 16) {
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(s * 0.33, y - 2.5, s * 0.66, y + 2.5, s, y);
      g.stroke();
    }
    for (let i = 0; i < 70; i += 1) {
      g.fillStyle = rng() > 0.5 ? 'rgba(255,252,238,0.24)' : 'rgba(165,134,82,0.16)';
      g.fillRect(Math.floor(rng() * s), Math.floor(rng() * s), 1.5, 1.5);
    }
  });

  // Beachfront promenade warm stone
  const promoTile = makeTile(48, (g, s) => {
    g.fillStyle = '#cfc3a4';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(130,116,88,0.20)';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, s - 1, s - 1);
    g.beginPath();
    g.moveTo(0, s / 2 + 0.5); g.lineTo(s, s / 2 + 0.5);
    g.moveTo(s / 2 + 0.5, 0); g.lineTo(s / 2 + 0.5, s);
    g.stroke();
  });

  return {
    asphalt: ctx.createPattern(asphaltTile, 'repeat'),
    highway: ctx.createPattern(highwayTile, 'repeat'),
    sidewalk: ctx.createPattern(sidewalkTile, 'repeat'),
    concrete: ctx.createPattern(concreteTile, 'repeat'),
    dock: ctx.createPattern(dockTile, 'repeat'),
    park: ctx.createPattern(parkTile, 'repeat'),
    lawn: ctx.createPattern(lawnTile, 'repeat'),
    sand: ctx.createPattern(sandTile, 'repeat'),
    promenade: ctx.createPattern(promoTile, 'repeat'),
  };
}

/** Draw rich animated teal ocean, harbor basin, depth shading, wave highlights and shoreline foam. */
export function drawWater(ctx, world, view, t, dusk, night) {
  const pad = 900;
  // Southern sea with shallow-to-deep teal gradient (extends past world bounds so no void shows)
  if (view.y + view.h > CITY.seaY - 20) {
    const seaGrad = ctx.createLinearGradient(0, CITY.seaY, 0, world.h + 260);
    seaGrad.addColorStop(0, '#22a0b0');
    seaGrad.addColorStop(0.26, '#147b8c');
    seaGrad.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = seaGrad;
    ctx.fillRect(-pad, CITY.seaY, world.w + pad * 2, world.h - CITY.seaY + pad);
  }

  // Eastern harbor sea with horizontal depth gradient
  if (view.x + view.w > CITY.eastX - 20) {
    const eastGrad = ctx.createLinearGradient(CITY.eastX, 0, world.w + 260, 0);
    eastGrad.addColorStop(0, '#229dad');
    eastGrad.addColorStop(0.42, '#147a8c');
    eastGrad.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = eastGrad;
    ctx.fillRect(CITY.eastX, -pad, world.w - CITY.eastX + pad, CITY.seaY + pad);
  }

  // Harbor basin cut into the docks
  if (rectsOverlap(CITY.basin, view)) {
    const bGrad = ctx.createLinearGradient(CITY.basin.x, CITY.basin.y, CITY.basin.x + CITY.basin.w, CITY.basin.y + CITY.basin.h);
    bGrad.addColorStop(0, '#167b8d');
    bGrad.addColorStop(0.5, '#1e8e9e');
    bGrad.addColorStop(1, '#0e5b6e');
    ctx.fillStyle = bGrad;
    ctx.fillRect(CITY.basin.x, CITY.basin.y, CITY.basin.w, CITY.basin.h);
  }

  // Subtle submerged teal caustics / swell bands
  ctx.save();
  ctx.lineWidth = 3;
  const swellAlpha = 0.13 + 0.05 * (1 - night);
  ctx.strokeStyle = `rgba(128,238,232,${swellAlpha.toFixed(3)})`;
  if (view.x + view.w > CITY.eastX - 10) {
    const startY = Math.max(-200, Math.floor(view.y / 42) * 42);
    const endY = Math.min(world.h + 200, view.y + view.h + 42);
    for (let y = startY; y < endY; y += 42) {
      const drift = Math.sin(t * 0.7 + y * 0.015) * 10;
      ctx.beginPath();
      ctx.moveTo(CITY.eastX + 18 + drift, y);
      ctx.quadraticCurveTo(CITY.eastX + 120 + drift, y - 6, world.w + 400, y + 3);
      ctx.stroke();
    }
  }

  // Animated wave highlights (specular gold-peach at dusk, crisp turquoise-white by day)
  const glintRgb = dusk > 0.25 ? '255,214,168' : '212,246,242';
  for (const w of world.waves) {
    if (w.x < view.x - 40 || w.x > view.x + view.w + 40 || w.y < view.y - 20 || w.y > view.y + view.h + 20) continue;
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + w.ph);
    const a = (0.14 + 0.26 * pulse) * (1 - night * 0.45);
    const dy = Math.sin(t * 0.9 + w.ph) * 2.5;
    const dx = Math.cos(t * 0.6 + w.ph) * 3;
    ctx.strokeStyle = `rgba(${glintRgb},${a.toFixed(3)})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(w.x + dx - w.len * 0.5, w.y + dy);
    ctx.quadraticCurveTo(w.x + dx, w.y + dy - 3.2, w.x + dx + w.len * 0.5, w.y + dy);
    ctx.stroke();
  }

  // Animated foam line along the eastern quay seawall & harbor basin edges
  const foamWave = (pos, phase) => Math.sin(t * 1.9 + pos * 0.025 + phase) * 2.2;
  if (view.x + view.w > CITY.eastX - 40) {
    const y0 = Math.max(0, view.y - 20);
    const y1 = Math.min(CITY.seaY, view.y + view.h + 20);
    // Seawall drop shadow on water
    ctx.fillStyle = 'rgba(4,20,30,0.34)';
    ctx.fillRect(CITY.eastX, y0, 10, y1 - y0);
    // Double foam ribbon
    for (let layer = 0; layer < 2; layer += 1) {
      ctx.strokeStyle = layer === 0 ? 'rgba(226,250,246,0.72)' : 'rgba(176,238,232,0.34)';
      ctx.lineWidth = layer === 0 ? 2.6 : 4.5;
      ctx.beginPath();
      for (let y = y0; y <= y1; y += 16) {
        const fx = CITY.eastX + 4 + layer * 6 + foamWave(y, layer * 1.8);
        if (y === y0) ctx.moveTo(fx, y);
        else ctx.lineTo(fx, y);
      }
      ctx.stroke();
    }
    // Concrete quay cap edge
    ctx.fillStyle = '#b4b2a8';
    ctx.fillRect(CITY.eastX - 5, y0, 5, y1 - y0);
  }

  // Basin interior seawall shadow + foam
  if (rectsOverlap(CITY.basin, view)) {
    const b = CITY.basin;
    ctx.fillStyle = 'rgba(4,20,30,0.32)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillRect(b.x, b.y, 8, b.h);
    ctx.strokeStyle = 'rgba(218,248,242,0.62)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let x = b.x + 2; x <= b.x + b.w; x += 16) {
      const fy = b.y + 5 + foamWave(x, 0.5);
      if (x === b.x + 2) ctx.moveTo(x, fy);
      else ctx.lineTo(x, fy);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let y = b.y + 2; y <= b.y + b.h; y += 16) {
      const fx = b.x + 5 + foamWave(y, 2.1);
      if (y === b.y + 2) ctx.moveTo(fx, y);
      else ctx.lineTo(fx, y);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let x = b.x + 2; x <= b.x + b.w; x += 16) {
      const fy = b.y + b.h - 5 + foamWave(x, 3.7);
      if (x === b.x + 2) ctx.moveTo(x, fy);
      else ctx.lineTo(x, fy);
    }
    ctx.stroke();
  }

  // Beach surf foam waves along southern coastline
  if (view.y + view.h > CITY.seaY - 30 && view.y < CITY.seaY + 60) {
    const x0 = Math.max(0, view.x - 20);
    const x1 = Math.min(CITY.eastX + 20, view.x + view.w + 20);
    for (let layer = 0; layer < 2; layer += 1) {
      const shift = Math.sin(t * 1.4 + layer * 1.9) * 3.5;
      ctx.strokeStyle = layer === 0 ? 'rgba(232,252,248,0.78)' : 'rgba(182,238,232,0.38)';
      ctx.lineWidth = layer === 0 ? 3 : 4.5;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 24) {
        const fy = CITY.seaY + layer * 10 + shift + Math.sin(x * 0.02 + t * 1.6 + layer) * 2.5;
        if (x === x0) ctx.moveTo(x, fy);
        else ctx.lineTo(x, fy);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
