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

  // Fine-grain asphalt with mineral aggregate, subtle tonal blotches and hairline tar cracks
  const asphaltTile = makeTile(128, (g, s) => {
    g.fillStyle = PALETTE.asphalt;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 10; i += 1) {
      g.fillStyle = rng() > 0.5 ? 'rgba(255,248,236,0.03)' : 'rgba(14,16,22,0.05)';
      g.beginPath();
      g.arc(rng() * s, rng() * s, 8 + rng() * 16, 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 420; i += 1) {
      const x = Math.floor(rng() * s);
      const y = Math.floor(rng() * s);
      const bright = rng() > 0.48;
      g.fillStyle = bright ? 'rgba(255,248,236,0.065)' : 'rgba(10,12,18,0.11)';
      g.fillRect(x, y, rng() < 0.72 ? 1 : 2, 1);
    }
    // Subtle tar repair hairline
    g.strokeStyle = 'rgba(16,18,24,0.22)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(18, 0);
    g.lineTo(25, 48);
    g.lineTo(19, 86);
    g.lineTo(22, s);
    g.stroke();
    g.beginPath();
    g.moveTo(86, 18);
    g.lineTo(104, 34);
    g.lineTo(98, 56);
    g.stroke();
  });

  // Slightly darker coastal highway asphalt
  const highwayTile = makeTile(96, (g, s) => {
    g.fillStyle = PALETTE.highway;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 280; i += 1) {
      const x = Math.floor(rng() * s);
      const y = Math.floor(rng() * s);
      g.fillStyle = rng() > 0.48 ? 'rgba(255,248,236,0.055)' : 'rgba(8,10,16,0.11)';
      g.fillRect(x, y, 1, 1);
    }
  });

  // Warm travertine/concrete sidewalk paving slabs with varied tile tones and beveled joints
  const sidewalkTile = makeTile(64, (g, s) => {
    g.fillStyle = PALETTE.sidewalk;
    g.fillRect(0, 0, s, s);
    const step = 16;
    for (let gy = 0; gy < s; gy += step) {
      for (let gx = 0; gx < s; gx += step) {
        const v = rng();
        if (v < 0.35) {
          g.fillStyle = 'rgba(255,250,238,0.14)';
          g.fillRect(gx + 1, gy + 1, step - 2, step - 2);
        } else if (v > 0.68) {
          g.fillStyle = 'rgba(92,84,70,0.075)';
          g.fillRect(gx + 1, gy + 1, step - 2, step - 2);
        }
        // Subtle sunlit top-left tile bevel
        g.fillStyle = 'rgba(255,252,244,0.18)';
        g.fillRect(gx + 1, gy + 1, step - 2, 1);
      }
    }
    g.strokeStyle = 'rgba(104,96,84,0.28)';
    g.lineWidth = 1;
    g.beginPath();
    for (let p = 0; p < s; p += step) {
      g.moveTo(0, p + 0.5); g.lineTo(s, p + 0.5);
      g.moveTo(p + 0.5, 0); g.lineTo(p + 0.5, s);
    }
    g.stroke();
    for (let i = 0; i < 72; i += 1) {
      g.fillStyle = rng() > 0.5 ? 'rgba(255,252,245,0.09)' : 'rgba(78,70,60,0.08)';
      g.fillRect(Math.floor(rng() * s), Math.floor(rng() * s), 1, 1);
    }
  });

  // Sun-warmed downtown architectural plaza flagstones
  const concreteTile = makeTile(64, (g, s) => {
    g.fillStyle = PALETTE.concrete;
    g.fillRect(0, 0, s, s);
    const tints = ['rgba(255,248,234,0.10)', 'rgba(84,78,68,0.07)', 'rgba(235,222,202,0.08)', 'rgba(72,68,62,0.05)'];
    for (let gy = 0; gy < 2; gy += 1) {
      for (let gx = 0; gx < 2; gx += 1) {
        g.fillStyle = tints[(gx + gy * 2) % tints.length];
        g.fillRect(gx * 32 + 1, gy * 32 + 1, 30, 30);
        g.fillStyle = 'rgba(255,250,240,0.14)';
        g.fillRect(gx * 32 + 1, gy * 32 + 1, 30, 1);
      }
    }
    g.strokeStyle = 'rgba(84,78,70,0.24)';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, 31, 31);
    g.strokeRect(32.5, 0.5, 31, 31);
    g.strokeRect(0.5, 32.5, 31, 31);
    g.strokeRect(32.5, 32.5, 31, 31);
    for (let i = 0; i < 95; i += 1) {
      g.fillStyle = rng() > 0.5 ? 'rgba(255,250,240,0.07)' : 'rgba(56,52,46,0.08)';
      g.fillRect(Math.floor(rng() * s), Math.floor(rng() * s), 2, 1);
    }
  });

  // Industrial concrete dock slabs with weathered joints & subtle salt/oil stains
  const dockTile = makeTile(64, (g, s) => {
    g.fillStyle = PALETTE.dock;
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,248,238,0.06)';
    g.fillRect(0, 0, s, 32);
    g.fillStyle = 'rgba(40,44,50,0.07)';
    g.beginPath();
    g.arc(18, 46, 10, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(38,42,48,0.30)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, 32.5); g.lineTo(s, 32.5);
    g.moveTo(32.5, 0); g.lineTo(32.5, s);
    g.stroke();
    for (let i = 0; i < 95; i += 1) {
      g.fillStyle = rng() > 0.55 ? 'rgba(240,238,232,0.06)' : 'rgba(28,32,38,0.10)';
      g.fillRect(Math.floor(rng() * s), Math.floor(rng() * s), 2, 1);
    }
  });

  // Park grass with layered organic tonal mottling and fine blades
  const parkTile = makeTile(64, (g, s) => {
    g.fillStyle = PALETTE.park;
    g.fillRect(0, 0, s, s);
    // Subtle sunlit lawn stripe
    g.fillStyle = 'rgba(134,186,92,0.09)';
    g.fillRect(0, 0, s * 0.5, s);
    for (let i = 0; i < 16; i += 1) {
      g.fillStyle = rng() > 0.5 ? 'rgba(138,192,98,0.18)' : 'rgba(38,80,34,0.16)';
      g.beginPath();
      g.arc(rng() * s, rng() * s, 5 + rng() * 9, 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 110; i += 1) {
      const bx = rng() * s;
      const by = rng() * s;
      g.strokeStyle = rng() > 0.5 ? 'rgba(164,214,118,0.30)' : 'rgba(36,74,32,0.26)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + (rng() - 0.5) * 2.5, by - 3 - rng() * 2);
      g.stroke();
    }
  });

  // Suburban lawn grass (warm sunlit coastal lawn with soft mower stripe)
  const lawnTile = makeTile(64, (g, s) => {
    g.fillStyle = '#89a564';
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(180,208,124,0.09)';
    g.fillRect(0, 0, s, s * 0.5);
    for (let i = 0; i < 14; i += 1) {
      g.fillStyle = rng() > 0.5 ? 'rgba(182,208,128,0.16)' : 'rgba(78,108,54,0.15)';
      g.beginPath();
      g.arc(rng() * s, rng() * s, 5 + rng() * 8, 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 85; i += 1) {
      const bx = rng() * s;
      const by = rng() * s;
      g.fillStyle = rng() > 0.5 ? 'rgba(205,222,150,0.22)' : 'rgba(66,92,46,0.18)';
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
