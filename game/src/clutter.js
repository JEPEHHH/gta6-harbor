// Deterministic street furniture, parking bays, storm drains, fences, signage, dockside cargo
// and beach clutter generation. Runs once at city creation with an independent seeded RNG so
// gameplay geometry and building collisions remain completely unchanged.

import { CITY, CITY_SEED } from './config.js';
import { TAU, int, makeRng, pick, pointInRect, range } from './util.js';

const UMBRELLA_PALETTES = [
  ['#e04b3e', '#f7f1e3'],
  ['#229ca8', '#f5f2e8'],
  ['#eba834', '#f8f3e4'],
  ['#d6588c', '#f8eff3'],
  ['#3c8c58', '#f2f4ea'],
];

const BILLBOARD_DESIGNS = [
  { bg: '#16344a', accent: '#ff9a44', accent2: '#2fd0d6', title: 'HARBOR FM', sub: '104.7 SUNSET' },
  { bg: '#2c1e38', accent: '#ff4f8b', accent2: '#ffd06b', title: 'CORAL COLA', sub: 'ICE COLD' },
  { bg: '#1d443e', accent: '#f4c64b', accent2: '#f4efe2', title: 'PIER COFFEE', sub: 'FRESH ROAST' },
  { bg: '#38241e', accent: '#f06d44', accent2: '#5fd4b8', title: 'PALM MOTORS', sub: 'ZERO DOWN' },
];

const SHOP_SIGN_COLORS = ['#d84a42', '#1f8f96', '#e08938', '#38689e', '#c93f7c', '#4a8c52'];

/**
 * Populate world with rich procedural street clutter, ground details, parking bays,
 * storm drains, fences, billboards, dock cargo and beach gear.
 */
export function populateCityClutter(world, seed = CITY_SEED) {
  const rng = makeRng((seed ^ 0x2c1b3c6d) >>> 0);
  const { roadsV, roadsH, blocks, buildings, props, isWater } = world;

  const drains = [];
  const parkingBays = [];
  const busBays = [];
  const fences = [];
  const driveways = [];

  function nearCross(v, lines, margin = 66) {
    return lines.some((c) => Math.abs(v - c) < margin);
  }

  function hitsAnyBuilding(x, y, pad = 10) {
    for (const b of buildings) {
      if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) {
        return true;
      }
    }
    return false;
  }

  // 1. Storm drains tucked right at curb corners near intersections
  for (const vx of roadsV) {
    for (const hy of roadsH) {
      if (isWater(vx, hy)) continue;
      const off = CITY.roadHalf - 4;
      const d = CITY.roadHalf + 24;
      const candidates = [
        { x: vx - off, y: hy - d, orient: 'v' },
        { x: vx + off, y: hy + d, orient: 'v' },
        { x: vx - d, y: hy + off, orient: 'h' },
        { x: vx + d, y: hy - off, orient: 'h' },
      ];
      for (const c of candidates) {
        if (!isWater(c.x, c.y) && rng() < 0.72) drains.push(c);
      }
    }
  }

  // 2. Painted parking bays along BOTH curbs of every mid-block street segment
  //    Plus bus-stop bays along key avenues
  const bayLen = 44;
  const bayDepth = 10;
  for (let i = 0; i < roadsV.length; i += 1) {
    const vx = roadsV[i];
    for (let j = 0; j < roadsH.length - 1; j += 1) {
      const y0 = roadsH[j] + 74;
      const y1 = roadsH[j + 1] - 74;
      const midY = (roadsH[j] + roadsH[j + 1]) * 0.5;
      if (isWater(vx, midY)) continue;

      // West curb & East curb bays
      for (const side of [-1, 1]) {
        const curbX = vx + side * (CITY.roadHalf - bayDepth * 0.5);
        const angle = side === 1 ? -Math.PI * 0.5 : Math.PI * 0.5;
        let slotIdx = 0;
        for (let y = y0; y + bayLen <= y1; y += bayLen + 6) {
          const cy = y + bayLen * 0.5;
          if (isWater(curbX, cy)) continue;
          // Reserve occasional bus stop bay on central avenues
          if (slotIdx === 2 && side === 1 && (i === 3 || i === 4 || i === 5 || i === 6) && (j >= 1 && j <= 5) && (i + j) % 2 === 0) {
            busBays.push({ x: vx + side * (CITY.roadHalf - 5), y: cy, w: 10, h: 64, orient: 'v' });
            props.push({ kind: 'bus_stop', x: vx + side * (CITY.roadHalf + 11), y: cy, orient: 'v', side });
            props.push({ kind: 'bin', x: vx + side * (CITY.roadHalf + 10), y: cy + 28 });
          } else if (rng() < 0.78) {
            parkingBays.push({
              x: curbX,
              y: cy,
              w: bayDepth,
              h: bayLen,
              orient: 'v',
              side,
              carX: vx + side * (CITY.roadHalf - 6.2),
              carY: cy,
              angle,
            });
          }
          slotIdx += 1;
        }
      }
    }
  }

  for (let j = 0; j < roadsH.length; j += 1) {
    const hy = roadsH[j];
    const isHighway = j === roadsH.length - 1;
    for (let i = 0; i < roadsV.length - 1; i += 1) {
      const x0 = roadsV[i] + 74;
      const x1 = roadsV[i + 1] - 74;
      const midX = (roadsV[i] + roadsV[i + 1]) * 0.5;
      if (isWater(midX, hy)) continue;

      for (const side of [-1, 1]) {
        if (isHighway && side === 1) continue; // keep coastal boulevard beach side open for palms
        const curbY = hy + side * (CITY.roadHalf - bayDepth * 0.5);
        const angle = side === 1 ? 0 : Math.PI;
        let slotIdx = 0;
        for (let x = x0; x + bayLen <= x1; x += bayLen + 6) {
          const cx = x + bayLen * 0.5;
          if (isWater(cx, curbY)) continue;
          if (slotIdx === 1 && side === -1 && (j === 2 || j === 3 || j === 4 || j === 6) && (i >= 2 && i <= 7) && (i + j) % 2 === 1) {
            busBays.push({ x: cx, y: hy + side * (CITY.roadHalf - 5), w: 64, h: 10, orient: 'h' });
            props.push({ kind: 'bus_stop', x: cx, y: hy + side * (CITY.roadHalf + 11), orient: 'h', side });
            props.push({ kind: 'bin', x: cx + 28, y: hy + side * (CITY.roadHalf + 10) });
          } else if (rng() < 0.78) {
            parkingBays.push({
              x: cx,
              y: curbY,
              w: bayLen,
              h: bayDepth,
              orient: 'h',
              side,
              carX: cx,
              carY: hy + side * (CITY.roadHalf - 6.2),
              angle,
            });
          }
          slotIdx += 1;
        }
      }
    }
  }

  // 3. Per-block street furniture, fences, planters, bikes, bins, newsboxes, hydrants, signs, billboards
  for (const blk of blocks) {
    const sx = blk.x - CITY.walk;
    const sy = blk.y - CITY.walk;
    const sw = blk.w + CITY.walk * 2;
    const sh = blk.h + CITY.walk * 2;
    const d = blk.district;

    // Corner hydrants & litter bins along sidewalk corners
    if (!isWater(sx + 8, sy + 8)) {
      if (rng() < 0.72) props.push({ kind: 'hydrant', x: sx + 7, y: sy + 18 });
      if (rng() < 0.68) props.push({ kind: 'bin', x: sx + sw - 9, y: sy + 16 });
      if (rng() < 0.65) props.push({ kind: 'bin', x: sx + 12, y: sy + sh - 9 });
      if (rng() < 0.55) props.push({ kind: 'hydrant', x: sx + sw - 7, y: sy + sh - 18 });
    }

    if (d === 'downtown' || d === 'northgate' || d === 'beachfront') {
      // Raised stone planters along sidewalks
      const planterOffsets = [56, 134, 214, 294];
      for (const off of planterOffsets) {
        if (rng() < 0.72) props.push({ kind: 'planter', x: blk.x + off, y: sy + 7, seed: int(rng, 0, 1e6), shape: 'rect' });
        if (rng() < 0.72) props.push({ kind: 'planter', x: blk.x + off, y: sy + sh - 7, seed: int(rng, 0, 1e6), shape: 'rect' });
        if (rng() < 0.65) props.push({ kind: 'planter', x: sx + 7, y: blk.y + off, seed: int(rng, 0, 1e6), shape: 'round' });
        if (rng() < 0.65) props.push({ kind: 'planter', x: sx + sw - 7, y: blk.y + off, seed: int(rng, 0, 1e6), shape: 'round' });
      }

      // Newspaper boxes clustered at corners
      if (rng() < 0.85) {
        props.push({ kind: 'newsbox', x: sx + 22, y: sy + 7, orient: 'h' });
      }
      if (rng() < 0.75) {
        props.push({ kind: 'newsbox', x: sx + sw - 26, y: sy + sh - 7, orient: 'h' });
      }

      // Sidewalk benches & parked bicycles
      props.push({ kind: 'bench', x: blk.x + 92, y: sy + sh - 8, orient: 'h' });
      if (rng() < 0.8) props.push({ kind: 'bench', x: blk.x + 240, y: sy + 8, orient: 'h' });
      if (rng() < 0.78) {
        props.push({ kind: 'bike', x: sx + 10, y: blk.y + 84, angle: rng() * 0.4 - 0.2, color: pick(rng, ['#d9463e', '#2ea4ad', '#e8b838', '#3c6eb0']) });
        props.push({ kind: 'bike', x: sx + 10, y: blk.y + 96, angle: rng() * 0.4 - 0.2, color: pick(rng, ['#3a8c56', '#d86e34', '#4a5464', '#c94c82']) });
      }
      if (rng() < 0.72) {
        props.push({ kind: 'bike', x: blk.x + 172, y: sy + sh - 9, angle: Math.PI * 0.5 + (rng() - 0.5) * 0.35, color: pick(rng, ['#d9463e', '#2ea4ad', '#e8b838']) });
      }

      // Corner billboard in open plaza spots
      if (d === 'downtown' && (blk.i + blk.j) % 2 === 0) {
        const bbx = blk.x + blk.w - 36;
        const bby = blk.y + blk.h - 22;
        if (!hitsAnyBuilding(bbx, bby, 18)) {
          props.push({
            kind: 'billboard',
            x: bbx,
            y: bby,
            design: BILLBOARD_DESIGNS[(blk.i * 3 + blk.j) % BILLBOARD_DESIGNS.length],
            orient: 'h',
          });
        }
      }

      // Pocket plaza trees in open block corners
      for (let t = 0; t < 3; t += 1) {
        const tx = blk.x + range(rng, 22, blk.w - 22);
        const ty = blk.y + range(rng, 22, blk.h - 22);
        if (!hitsAnyBuilding(tx, ty, 18)) {
          props.push({ kind: rng() < 0.48 ? 'palm' : 'tree', x: tx, y: ty, ph: range(rng, 0, TAU), s: range(rng, 0.85, 1.15) });
        }
      }
    } else if (d === 'suburbs') {
      // Wooden yard divider fences along property lines & hedges
      fences.push({ x1: blk.x + blk.w * 0.5, y1: blk.y + 10, x2: blk.x + blk.w * 0.5, y2: blk.y + blk.h - 10, kind: 'wood' });
      fences.push({ x1: blk.x + 8, y1: blk.y + 108, x2: blk.x + blk.w - 8, y2: blk.y + 108, kind: 'wood' });
      fences.push({ x1: blk.x + 8, y1: blk.y + 220, x2: blk.x + blk.w - 8, y2: blk.y + 220, kind: 'wood' });
      // Front yard low fences / hedges with gaps
      fences.push({ x1: blk.x + 2, y1: blk.y + 2, x2: blk.x + 96, y2: blk.y + 2, kind: 'hedge' });
      fences.push({ x1: blk.x + 210, y1: blk.y + 2, x2: blk.x + blk.w - 4, y2: blk.y + 2, kind: 'hedge' });
      fences.push({ x1: blk.x + 2, y1: blk.y + blk.h - 2, x2: blk.x + 110, y2: blk.y + blk.h - 2, kind: 'hedge' });
      fences.push({ x1: blk.x + 218, y1: blk.y + blk.h - 2, x2: blk.x + blk.w - 4, y2: blk.y + blk.h - 2, kind: 'hedge' });

      // Extra backyard trees/palms & sidewalk benches
      for (let t = 0; t < 4; t += 1) {
        const tx = blk.x + range(rng, 18, blk.w - 18);
        const ty = blk.y + range(rng, 18, blk.h - 18);
        if (!hitsAnyBuilding(tx, ty, 16)) {
          props.push({ kind: rng() < 0.35 ? 'palm' : 'tree', x: tx, y: ty, ph: range(rng, 0, TAU), s: range(rng, 0.8, 1.15) });
        }
      }
      if (rng() < 0.6) props.push({ kind: 'bench', x: blk.x + 150, y: sy + 8, orient: 'h' });
      if (rng() < 0.5) props.push({ kind: 'bike', x: blk.x + 128, y: sy + sh - 9, angle: 1.4, color: '#3b82b0' });
    } else if (d === 'park') {
      // Extra park benches, bins, planters, parked bicycles near park entrances
      props.push({ kind: 'bench', x: blk.x + 114, y: blk.y + 188, orient: 'h' });
      props.push({ kind: 'bench', x: blk.x + 228, y: blk.y + 136, orient: 'h' });
      props.push({ kind: 'bench', x: blk.x + 190, y: blk.y + 272, orient: 'h' });
      props.push({ kind: 'bench', x: blk.x + 84, y: sy + 9, orient: 'h' });
      props.push({ kind: 'bench', x: blk.x + 244, y: sy + 9, orient: 'h' });
      props.push({ kind: 'bin', x: blk.x + 144, y: blk.y + 142 });
      props.push({ kind: 'bin', x: blk.x + 182, y: blk.y + 142 });
      props.push({ kind: 'bin', x: blk.x + 144, y: blk.y + 184 });
      props.push({ kind: 'planter', x: blk.x + 142, y: sy + 8, seed: 401, shape: 'round' });
      props.push({ kind: 'planter', x: blk.x + 184, y: sy + 8, seed: 402, shape: 'round' });
      props.push({ kind: 'planter', x: sx + sw - 8, y: blk.y + 142, seed: 403, shape: 'round' });
      props.push({ kind: 'planter', x: sx + sw - 8, y: blk.y + 184, seed: 404, shape: 'round' });
      props.push({ kind: 'bike', x: blk.x + 206, y: sy + 10, angle: 0.25, color: '#e05a3a' });
      props.push({ kind: 'bike', x: blk.x + 216, y: sy + 10, angle: -0.15, color: '#2ea4ad' });
      // Low decorative iron park perimeter railing segments
      fences.push({ x1: blk.x + 4, y1: blk.y + 2, x2: blk.x + 134, y2: blk.y + 2, kind: 'iron' });
      fences.push({ x1: blk.x + 192, y1: blk.y + 2, x2: blk.x + blk.w - 4, y2: blk.y + 2, kind: 'iron' });
      fences.push({ x1: blk.x + blk.w - 2, y1: blk.y + 4, x2: blk.x + blk.w - 2, y2: blk.y + 134, kind: 'iron' });
      fences.push({ x1: blk.x + blk.w - 2, y1: blk.y + 192, x2: blk.x + blk.w - 2, y2: blk.y + blk.h - 4, kind: 'iron' });
    } else if (d === 'docks') {
      // Industrial dock crates, barrels, pallets & chain-link yard fences
      fences.push({ x1: blk.x + 2, y1: blk.y + 2, x2: blk.x + blk.w - 2, y2: blk.y + 2, kind: 'chain' });
      fences.push({ x1: blk.x + 2, y1: blk.y + 2, x2: blk.x + 2, y2: blk.y + blk.h - 2, kind: 'chain' });
      for (let c = 0; c < 6; c += 1) {
        const cx = blk.x + 20 + rng() * (blk.w - 40);
        const cy = blk.y + 136 + rng() * (blk.h - 154);
        if (!hitsAnyBuilding(cx, cy, 12) && !isWater(cx, cy)) {
          props.push({ kind: 'crates', x: cx, y: cy, variant: c % 3, angle: (rng() - 0.5) * 0.25 });
        }
      }
    }
  }

  // 4. Suburban driveways & projecting shop signs on downtown/hotel buildings
  for (const b of buildings) {
    if (b.kind === 'house') {
      // Short concrete driveway stub on west or east side facing nearest road
      const dw = 20;
      const dh = 26;
      driveways.push({ x: b.x + b.w * 0.5 - dw * 0.5, y: b.y + b.h, w: dw, h: dh });
    } else if (b.kind === 'tower' || b.kind === 'hotel' || b.kind === 'flat') {
      if (rng() < 0.72) {
        const onSouth = rng() < 0.6;
        props.push({
          kind: 'shop_sign',
          x: onSouth ? b.x + b.w * 0.24 : b.x - 4,
          y: onSouth ? b.y + b.h + 5 : b.y + b.h * 0.28,
          orient: onSouth ? 'h' : 'v',
          color: pick(rng, SHOP_SIGN_COLORS),
        });
      }
    }
  }

  // 5. Extra cargo crates, oil drums & pallets along the eastern quay and near dock cranes
  const quayCrates = [
    { x: 4514, y: 1120, variant: 0 },
    { x: 4580, y: 1150, variant: 1 },
    { x: 4506, y: 1234, variant: 2 },
    { x: 4576, y: 1272, variant: 0 },
    { x: 4512, y: 1318, variant: 1 },
    { x: 4588, y: 1364, variant: 2 },
    { x: 4524, y: 1440, variant: 0 },
    { x: 4528, y: 2308, variant: 1 },
    { x: 4586, y: 2420, variant: 2 },
    { x: 4516, y: 2510, variant: 0 },
  ];
  for (const qc of quayCrates) {
    if (!isWater(qc.x, qc.y)) {
      props.push({ kind: 'crates', x: qc.x, y: qc.y, variant: qc.variant, angle: (rng() - 0.5) * 0.2 });
    }
  }

  // 6. Coral Beach umbrellas, towels & elevated wooden lifeguard towers
  for (let x = 360; x < 4420; x += 480) {
    props.push({
      kind: 'lifeguard',
      x: x + range(rng, -40, 40),
      y: CITY.beachY + 62,
      ph: range(rng, 0, TAU),
    });
  }
  for (let x = 200; x < 4480; x += 115) {
    if (rng() < 0.78) {
      props.push({
        kind: 'umbrella',
        x: x + range(rng, -26, 26),
        y: CITY.beachY + range(rng, 44, 118),
        colors: pick(rng, UMBRELLA_PALETTES),
        r: range(rng, 12, 16),
        angle: range(rng, 0, TAU),
      });
    }
  }
  // Beachfront promenade railing along north edge of sand
  for (let x = 180; x < 4460; x += 160) {
    fences.push({ x1: x, y1: CITY.beachY + 3, x2: x + 128, y2: CITY.beachY + 3, kind: 'iron' });
  }

  // 7. Roadside billboards along coastal boulevard & major avenues
  for (let i = 2; i < roadsV.length - 2; i += 2) {
    const bx = roadsV[i] + CITY.roadHalf + 34;
    const by = roadsH[2] - CITY.roadHalf - 22;
    if (!hitsAnyBuilding(bx, by, 14) && !isWater(bx, by)) {
      props.push({
        kind: 'billboard',
        x: bx,
        y: by,
        design: BILLBOARD_DESIGNS[i % BILLBOARD_DESIGNS.length],
        orient: 'h',
      });
    }
  }

  // 8. Guaranteed rich street life around Palmetto Park / Midtown core avenues for crisp vistas
  const heroCornerProps = [
    { kind: 'bus_stop', x: roadsV[4] - CITY.roadHalf - 11, y: roadsH[3] + 124, orient: 'v', side: -1 },
    { kind: 'bin', x: roadsV[4] - CITY.roadHalf - 10, y: roadsH[3] + 156 },
    { kind: 'newsbox', x: roadsV[4] + CITY.roadHalf + 24, y: roadsH[3] - CITY.roadHalf - 9, orient: 'h' },
    { kind: 'hydrant', x: roadsV[4] - CITY.roadHalf - 8, y: roadsH[3] - CITY.roadHalf - 24 },
    { kind: 'planter', x: roadsV[4] + CITY.roadHalf + 78, y: roadsH[3] - CITY.roadHalf - 8, seed: 801, shape: 'rect' },
    { kind: 'planter', x: roadsV[4] + CITY.roadHalf + 156, y: roadsH[3] - CITY.roadHalf - 8, seed: 802, shape: 'rect' },
    { kind: 'planter', x: roadsV[4] + CITY.roadHalf + 78, y: roadsH[3] + CITY.roadHalf + 8, seed: 803, shape: 'rect' },
    { kind: 'bench', x: roadsV[4] + CITY.roadHalf + 118, y: roadsH[3] - CITY.roadHalf - 9, orient: 'h' },
    { kind: 'bench', x: roadsV[4] - CITY.roadHalf - 94, y: roadsH[3] + CITY.roadHalf + 9, orient: 'h' },
    { kind: 'bike', x: roadsV[4] + CITY.roadHalf + 52, y: roadsH[3] + CITY.roadHalf + 9, angle: 0.18, color: '#d9463e' },
    { kind: 'bike', x: roadsV[4] + CITY.roadHalf + 62, y: roadsH[3] + CITY.roadHalf + 9, angle: -0.12, color: '#2ea4ad' },
  ];
  for (const hp of heroCornerProps) {
    if (!hitsAnyBuilding(hp.x, hp.y, 6) && !isWater(hp.x, hp.y)) {
      props.push(hp);
    }
  }

  // Avoid duplicate placement of streetlights right on top of intersections
  void nearCross;
  void pointInRect;

  world.drains = drains;
  world.parkingBays = parkingBays;
  world.busBays = busBays;
  world.fences = fences;
  world.driveways = driveways;
}
