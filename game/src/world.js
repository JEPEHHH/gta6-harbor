// Deterministic city generation: the road grid, districts, buildings, harbour, park and props.
// One seed lays out the same Blackwater Harbor every time; nothing here runs per frame.

import { CITY, CITY_SEED, PALETTE, PLAYER } from './config.js';
import { TAU, clamp, int, makeRng, pick, pointInRect, range, circleHitsRect } from './util.js';
import { populateCityClutter } from './clutter.js';

const HOUSE_COLORS = ['#e6c7a0', '#d8e0e6', '#e4cedb', '#cde0c6', '#efe0be', '#deb6a4'];
const TOWER_COLORS = ['#6d9fb3', '#cfc5b4', '#dfd8cb', '#d8a189', '#88a4b5'];
const HOTEL_COLORS = ['#f0e5d4', '#e6b59c', '#9cd0c8', '#eed4a2'];
const CONTAINER_COLORS = ['#b5493a', '#247888', '#c99736', '#3366a0', '#5a8748', '#874c8a'];

const TOWER_ROOFS = ['#9b978e', '#868b92', '#a8a196', '#79818a', '#b5ada0'];
const AWNING_COLORS = [
  ['#d84a42', '#f4ede0'],
  ['#1f8f96', '#f2efe6'],
  ['#e08938', '#f6f0e2'],
  ['#2b4c7a', '#ebe8df'],
  ['#c93f7c', '#f4ebf0'],
];
const NEON_SPECS = [
  { label: 'HARBOR BAR', rgb: '255, 59, 154', hex: '#ff3b9a', radius: 130 },
  { label: 'PIER 9', rgb: '43, 228, 228', hex: '#2be4e4', radius: 125 },
  { label: 'FUEL & ICE', rgb: '255, 157, 59', hex: '#ff9d3b', radius: 115 },
  { label: 'CLUB CORAL', rgb: '255, 59, 154', hex: '#ff3b9a', radius: 135 },
  { label: 'MARINA', rgb: '43, 228, 228', hex: '#2be4e4', radius: 120 },
  { label: '24H DINER', rgb: '255, 168, 66', hex: '#ffa842', radius: 110 },
];

export function createWorld(seed = CITY_SEED) {
  const rng = makeRng(seed);
  const roadsV = [];
  const roadsH = [];
  for (let i = 0; i < CITY.cols; i += 1) roadsV.push(CITY.first + i * CITY.pitch);
  for (let j = 0; j < CITY.rows; j += 1) roadsH.push(CITY.first + j * CITY.pitch);

  const blocks = [];
  const buildings = [];
  const props = [];
  const lamps = [];
  const decor = [];
  const grounds = [];
  const waves = [];

  const piers = [
    { x: CITY.eastX - 12, y: 880, w: 280, h: 44 },
    { x: CITY.eastX - 12, y: 2560, w: 240, h: 40 },
  ];
  const bridges = [
    { x: CITY.basin.x - 60, y: roadsH[4] - CITY.roadHalf - CITY.walk, w: CITY.eastX - CITY.basin.x + 60, h: (CITY.roadHalf + CITY.walk) * 2 },
    { x: roadsV[10] - CITY.roadHalf - CITY.walk, y: CITY.basin.y - 60, w: (CITY.roadHalf + CITY.walk) * 2, h: CITY.basin.h + 120 },
  ];
  const solidsExtra = [];

  function isWater(x, y) {
    const inSea = y > CITY.seaY || x > CITY.eastX || pointInRect(x, y, CITY.basin);
    if (!inSea) return false;
    for (const p of piers) if (pointInRect(x, y, p)) return false;
    for (const b of bridges) if (pointInRect(x, y, b)) return false;
    return true;
  }

  function overWater(r) {
    return isWater(r.x, r.y) || isWater(r.x + r.w, r.y)
      || isWater(r.x, r.y + r.h) || isWater(r.x + r.w, r.y + r.h)
      || isWater(r.x + r.w / 2, r.y + r.h / 2);
  }

  function addBuilding(r, kind, ht, color, roof) {
    if (overWater(r)) return;
    buildings.push({ ...r, kind, ht, color, roof, seed: int(rng, 0, 1e9) });
  }

  function districtFor(i, j) {
    if (i === 3 && j === 3) return 'park';
    if (i === 9 && j >= 2 && j <= 5) return 'docks';
    if (i >= 4 && i <= 6 && j >= 2 && j <= 4) return 'downtown';
    if (j === 6) return 'beachfront';
    if (j === 0) return 'northgate';
    return 'suburbs';
  }

  const blockEdge = CITY.roadHalf + CITY.walk;
  const blockSize = CITY.pitch - blockEdge * 2;

  for (let i = 0; i < CITY.cols - 1; i += 1) {
    for (let j = 0; j < CITY.rows - 1; j += 1) {
      const x = roadsV[i] + blockEdge;
      const y = roadsH[j] + blockEdge;
      const district = districtFor(i, j);
      blocks.push({ x, y, w: blockSize, h: blockSize, district, i, j });
      const groundColor = district === 'park' ? PALETTE.park
        : district === 'downtown' ? PALETTE.concrete
        : district === 'docks' ? PALETTE.dock
        : district === 'beachfront' ? '#cfc3a4'
        : '#8eaa6b';
      grounds.push({ x, y, w: blockSize, h: blockSize, color: groundColor, district });

      if (district === 'downtown') {
        for (let lot = 0; lot < 2; lot += 1) {
          const w = range(rng, 104, 142);
          const h = range(rng, 112, 164);
          const bx = x + lot * 166 + range(rng, 8, Math.max(9, 160 - w));
          const by = y + range(rng, 10, Math.max(11, 320 - h));
          const ht = range(rng, 120, 262);
          addBuilding({ x: bx, y: by, w, h }, 'tower', ht, pick(rng, TOWER_COLORS), '#a8a296');
        }
      } else if (district === 'suburbs') {
        for (let cx = 0; cx < 2; cx += 1) {
          for (let cy = 0; cy < 3; cy += 1) {
            const w = range(rng, 74, 104);
            const h = range(rng, 56, 80);
            const bx = x + cx * 166 + range(rng, 12, Math.max(13, 150 - w));
            const by = y + cy * 110 + range(rng, 10, Math.max(11, 100 - h));
            addBuilding({ x: bx, y: by, w, h }, 'house', range(rng, 22, 38), pick(rng, HOUSE_COLORS), rng() < 0.6 ? '#b86240' : '#7b8089');
          }
        }
        props.push({ kind: rng() < 0.35 ? 'palm' : 'tree', x: x + range(rng, 10, 320), y: y + range(rng, 10, 320), ph: range(rng, 0, TAU), s: range(rng, 0.85, 1.2) });
        props.push({ kind: 'hydrant', x: x - 8, y: y + 40 });
      } else if (district === 'northgate') {
        for (let lot = 0; lot < 2; lot += 1) {
          const w = range(rng, 130, 170);
          const h = range(rng, 90, 120);
          addBuilding({ x: x + lot * 166 + 8, y: y + range(rng, 30, 180), w, h }, 'flat', range(rng, 48, 74), pick(rng, HOUSE_COLORS), '#958e83');
        }
      } else if (district === 'beachfront') {
        for (let lot = 0; lot < 2; lot += 1) {
          const w = range(rng, 150, 208);
          const h = range(rng, 84, 104);
          addBuilding({ x: x + lot * 166 + range(rng, 4, Math.max(5, 160 - w)), y: y + range(rng, 16, 60), w, h }, 'hotel', range(rng, 56, 112), pick(rng, HOTEL_COLORS), '#e3dac8');
        }
        for (let p = 0; p < 3; p += 1) {
          props.push({ kind: 'palm', x: x + 30 + p * 110, y: y + blockSize + 22, ph: range(rng, 0, TAU), s: range(rng, 0.9, 1.25) });
        }
      } else if (district === 'docks') {
        addBuilding({ x: x + 14, y: y + 12, w: 252, h: 122 }, 'warehouse', 42, '#919ba4', '#6d7782');
        for (let row = 0; row < 3; row += 1) {
          for (let col = 0; col < 4; col += 1) {
            if (rng() < 0.22) continue;
            addBuilding({ x: x + 12 + col * 66, y: y + 156 + row * 40, w: 58, h: 24 }, 'container', 26, pick(rng, CONTAINER_COLORS), '#000000');
          }
        }
      } else if (district === 'park') {
        const pond = { x: x + 178, y: y + 158, w: 118, h: 84 };
        decor.push({ kind: 'pond', ...pond });
        solidsExtra.push(pond);
        decor.push({ kind: 'path', x: x + 150, y, w: 26, h: blockSize });
        decor.push({ kind: 'path', x, y: y + 150, w: blockSize, h: 26 });
        decor.push({ kind: 'fountain', x: x + 84, y: y + 84, r: 20 });
        for (let t = 0; t < 13; t += 1) {
          const tx = x + range(rng, 16, 316);
          const ty = y + range(rng, 16, 316);
          if (pointInRect(tx, ty, { x: pond.x - 16, y: pond.y - 16, w: pond.w + 32, h: pond.h + 32 })) continue;
          props.push({ kind: rng() < 0.3 ? 'palm' : 'tree', x: tx, y: ty, ph: range(rng, 0, TAU), s: range(rng, 0.9, 1.35) });
        }
        props.push({ kind: 'bench', x: x + 120, y: y + 140 });
        props.push({ kind: 'bench', x: x + 210, y: y + 128 });
        props.push({ kind: 'bench', x: x + 140, y: y + 210 });
      }
    }
  }

  // The quay: a concrete working strip between the dock blocks and the eastern sea.
  grounds.push({ x: 4484, y: 600, w: CITY.eastX - 4484, h: 2500, color: PALETTE.dock, district: 'docks' });
  props.push({ kind: 'crane', x: 4552, y: 1180, ph: 0 });
  props.push({ kind: 'crane', x: 4552, y: 2380, ph: 1.7 });
  for (let c = 0; c < 8; c += 1) {
    addBuilding({ x: 4500 + (c % 2) * 64, y: 700 + Math.floor(c / 2) * 46, w: 58, h: 24 }, 'container', 26, pick(rng, CONTAINER_COLORS), '#000000');
  }

  // Street lights along every road, staggered side to side, skipped at intersections.
  function nearCross(v, lines) {
    return lines.some((c) => Math.abs(v - c) < 72);
  }
  for (let i = 0; i < CITY.cols; i += 1) {
    for (let y = 120; y < 3200; y += 210) {
      if (nearCross(y, roadsH)) continue;
      const lamp = { kind: 'lamp', x: roadsV[i] - CITY.roadHalf - 8, y, ph: 0, side: 1 };
      props.push(lamp);
      lamps.push(lamp);
      if (y + 105 < 3200 && !nearCross(y + 105, roadsH)) {
        const other = { kind: 'lamp', x: roadsV[i] + CITY.roadHalf + 8, y: y + 105, ph: 0, side: -1 };
        props.push(other);
        lamps.push(other);
      }
    }
  }
  for (let j = 0; j < CITY.rows; j += 1) {
    for (let x = 120; x < 4560; x += 210) {
      if (nearCross(x, roadsV)) continue;
      const lamp = { kind: 'lamp', x, y: roadsH[j] - CITY.roadHalf - 8, ph: 0, side: 0 };
      props.push(lamp);
      lamps.push(lamp);
    }
  }

  // Palms: the coastal highway avenue, the beach, and the park edges.
  for (let x = 100; x < 4560; x += 88) {
    props.push({ kind: 'palm', x: x + range(rng, -8, 8), y: roadsH[7] + CITY.roadHalf + 26, ph: range(rng, 0, TAU), s: range(rng, 0.9, 1.3) });
  }
  for (let p = 0; p < 26; p += 1) {
    props.push({ kind: 'palm', x: range(rng, 120, 4480), y: range(rng, CITY.beachY + 28, CITY.seaY - 26), ph: range(rng, 0, TAU), s: range(rng, 0.85, 1.3) });
  }

  // Wave glints, pre-scattered so the sea animates without per-frame randomness.
  for (let w = 0; w < 170; w += 1) {
    const region = rng();
    let x;
    let y;
    if (region < 0.45) {
      x = range(rng, 40, CITY.width - 40);
      y = range(rng, CITY.seaY + 30, CITY.height - 30);
    } else if (region < 0.8) {
      x = range(rng, CITY.eastX + 30, CITY.width - 30);
      y = range(rng, 40, CITY.seaY - 40);
    } else {
      x = range(rng, CITY.basin.x + 20, CITY.basin.x + CITY.basin.w - 20);
      y = range(rng, CITY.basin.y + 20, CITY.basin.y + CITY.basin.h - 20);
    }
    waves.push({ x, y, ph: range(rng, 0, TAU), len: range(rng, 14, 36) });
  }

  // ── Visual polish layer (separate RNG so city geometry stays 100% deterministic) ──
  const visRng = makeRng(seed ^ 0x5f3759df);

  // Enrich buildings with varied roof tones, storefront awnings & rooftop details
  for (const b of buildings) {
    if (b.kind === 'tower' || b.kind === 'flat') {
      b.roof = pick(visRng, TOWER_ROOFS);
      b.hasWaterTank = b.ht > 100 && visRng() < 0.48;
      b.hasSkylight = !b.hasWaterTank && b.ht <= 210 && visRng() < 0.35;
      b.awning = visRng() < 0.65 ? pick(visRng, AWNING_COLORS) : null;
      b.awningSide = visRng() < 0.5 ? 'south' : 'west';
    } else if (b.kind === 'hotel') {
      b.awning = pick(visRng, AWNING_COLORS);
      b.awningSide = 'south';
      b.hasSkylight = visRng() < 0.5;
    } else if (b.kind === 'warehouse') {
      b.hasVents = true;
    }
  }

  // Manhole covers & weathered asphalt repair patches along roads
  const manholes = [];
  const wornPatches = [];
  for (let i = 0; i < roadsV.length; i += 1) {
    const vx = roadsV[i];
    for (let j = 0; j < roadsH.length - 1; j += 1) {
      const midY = (roadsH[j] + roadsH[j + 1]) * 0.5;
      if (!isWater(vx, midY) && visRng() < 0.72) {
        manholes.push({ x: vx + (visRng() < 0.5 ? -9 : 9), y: midY + range(visRng, -55, 55) });
      }
      if (!isWater(vx, midY) && visRng() < 0.6) {
        wornPatches.push({
          x: vx - 20 + range(visRng, 0, 18),
          y: midY + range(visRng, -110, 90),
          w: range(visRng, 16, 26),
          h: range(visRng, 26, 52),
          shade: visRng() < 0.5 ? 0 : 1,
        });
      }
    }
  }
  for (let j = 0; j < roadsH.length; j += 1) {
    const hy = roadsH[j];
    for (let i = 0; i < roadsV.length - 1; i += 1) {
      const midX = (roadsV[i] + roadsV[i + 1]) * 0.5;
      if (!isWater(midX, hy) && visRng() < 0.75) {
        manholes.push({ x: midX + range(visRng, -65, 65), y: hy + (visRng() < 0.5 ? -10 : 10) });
      }
      if (!isWater(midX, hy) && visRng() < 0.65) {
        wornPatches.push({
          x: midX + range(visRng, -110, 80),
          y: hy - 18 + range(visRng, 0, 16),
          w: range(visRng, 28, 56),
          h: range(visRng, 14, 24),
          shade: visRng() < 0.5 ? 0 : 1,
        });
      }
    }
  }

  // Construction lots with hazard fencing in open corners of selected blocks
  const constructionLots = [];
  for (const blk of blocks) {
    if (blk.district !== 'downtown' && blk.district !== 'suburbs') continue;
    if ((blk.i + blk.j) % 4 !== 0) continue;
    // Try placing a fenced construction lot in a corner that doesn't overlap any building
    const candidates = [
      { x: blk.x + 12, y: blk.y + blk.h - 92, w: 96, h: 78 },
      { x: blk.x + blk.w - 108, y: blk.y + 12, w: 96, h: 78 },
      { x: blk.x + 12, y: blk.y + 12, w: 92, h: 74 },
      { x: blk.x + blk.w - 104, y: blk.y + blk.h - 88, w: 92, h: 74 },
    ];
    for (const c of candidates) {
      const overlaps = buildings.some((b) =>
        c.x < b.x + b.w + 8 && c.x + c.w + 8 > b.x && c.y < b.y + b.h + 8 && c.y + c.h + 8 > b.y
      );
      if (!overlaps && !overWater(c)) {
        constructionLots.push({ ...c, seed: int(visRng, 0, 1e6) });
        break;
      }
    }
  }

  // Neon signs near the docks, quay warehouses, and Midtown street corners
  const neonSigns = [];
  let neonIdx = 0;
  for (const b of buildings) {
    if (b.kind === 'warehouse') {
      const spec = NEON_SPECS[neonIdx % NEON_SPECS.length];
      neonIdx += 1;
      neonSigns.push({
        x: b.x + b.w * 0.5,
        y: b.y + b.h + 2,
        w: 64,
        h: 10,
        orient: 'h',
        ...spec,
        flicker: neonIdx % 3 === 0,
        ph: range(visRng, 0, TAU),
      });
      // Second accent neon on the east dockside wall
      const spec2 = NEON_SPECS[(neonIdx + 1) % NEON_SPECS.length];
      neonSigns.push({
        x: b.x + b.w + 2,
        y: b.y + b.h * 0.52,
        w: 10,
        h: 52,
        orient: 'v',
        ...spec2,
        flicker: false,
        ph: range(visRng, 0, TAU),
      });
    } else if ((b.kind === 'tower' || b.kind === 'hotel') && visRng() < 0.34) {
      const spec = NEON_SPECS[neonIdx % NEON_SPECS.length];
      neonIdx += 1;
      neonSigns.push({
        x: b.x + b.w * 0.5,
        y: b.y + b.h + 2,
        w: 54,
        h: 9,
        orient: 'h',
        ...spec,
        flicker: neonIdx % 4 === 0,
        ph: range(visRng, 0, TAU),
      });
    }
  }
  // Extra vibrant dockside quay neon markers right near the cranes & mission docks
  neonSigns.push(
    { x: 4496, y: 1126, w: 12, h: 56, orient: 'v', label: 'DOCK 4', rgb: '255, 59, 154', hex: '#ff3b9a', radius: 145, flicker: false, ph: 0.4 },
    { x: 4496, y: 1244, w: 12, h: 56, orient: 'v', label: 'HARBOR', rgb: '43, 228, 228', hex: '#2be4e4', radius: 145, flicker: true, ph: 1.9 },
    { x: 4324, y: 1524, w: 68, h: 11, orient: 'h', label: 'BASIN CLUB', rgb: '255, 59, 154', hex: '#ff3b9a', radius: 140, flicker: false, ph: 2.7 },
    { x: 4496, y: 2320, w: 12, h: 54, orient: 'v', label: 'CARGO', rgb: '43, 228, 228', hex: '#2be4e4', radius: 135, flicker: false, ph: 0.8 },
  );

  // District labels for the analogue minimap
  const districtLabels = [
    { name: 'MIDTOWN', x: roadsV[5] + 210, y: roadsH[3] + 210 },
    { name: 'PALMETTO', x: roadsV[3] + 210, y: roadsH[3] + 210 },
    { name: 'THE PALMS', x: roadsV[2] + 100, y: roadsH[2] + 180 },
    { name: 'DOCKSIDE', x: roadsV[9] + 240, y: roadsH[3] + 120 },
    { name: 'THE BASIN', x: CITY.basin.x + 150, y: CITY.basin.y + 270 },
    { name: 'BEACHFRONT', x: roadsV[5] + 120, y: roadsH[6] + 220 },
    { name: 'CORAL BEACH', x: roadsV[4] + 200, y: CITY.beachY + 85 },
    { name: 'NORTHGATE', x: roadsV[5] + 100, y: roadsH[0] + 200 },
  ];

  function districtAt(x, y) {
    if (y > CITY.beachY) return 'Coral Beach';
    if (x > 4484) return 'Dockside';
    if (pointInRect(x, y, { x: CITY.basin.x - 40, y: CITY.basin.y - 40, w: CITY.basin.w + 80, h: CITY.basin.h + 80 })) return 'The Basin';
    if (x > roadsV[3] && x < roadsV[4] && y > roadsH[3] && y < roadsH[4]) return 'Palmetto Park';
    if (x > roadsV[4] - 44 && x < roadsV[7] + 44 && y > roadsH[2] - 44 && y < roadsH[5] + 44) return 'Midtown';
    if (y > roadsH[6] - 44) return 'Beachfront';
    if (y < roadsH[1]) return 'Northgate';
    return 'The Palms';
  }

  function blocked(x, y, r) {
    if (isWater(x, y)) return true;
    for (const b of buildings) if (circleHitsRect(x, y, r, b)) return true;
    for (const s of solidsExtra) if (circleHitsRect(x, y, r, s)) return true;
    return false;
  }

  /** Move a circle by (dx, dy), sliding along walls and shorelines axis by axis. */
  function moveCircle(x, y, r, dx, dy) {
    const nx = x + dx;
    if (!blocked(nx, y, r)) x = nx;
    const ny = y + dy;
    if (!blocked(x, ny, r)) y = ny;
    return { x: clamp(x, r, CITY.width - r), y: clamp(y, r, CITY.height - r) };
  }

  /** Snap a world point to the nearest road centre-line, for traffic spawning. */
  function nearestRoad(x, y) {
    let bestDist = Infinity;
    let bestX = x;
    let bestY = y;
    for (const v of roadsV) {
      const d = Math.abs(x - v);
      if (d < bestDist) { bestDist = d; bestX = v; bestY = y; }
    }
    for (const h of roadsH) {
      const d = Math.abs(y - h);
      if (d < bestDist) { bestDist = d; bestX = x; bestY = h; }
    }
    return { x: bestX, y: bestY };
  }

  function surfaceAt(x, y) {
    if (isWater(x, y)) return 'water';
    if (y > CITY.beachY) return 'sand';
    if (roadsV.some((v) => Math.abs(x - v) < CITY.roadHalf) && y < roadsH[7] + CITY.roadHalf) return 'road';
    if (roadsH.some((h) => Math.abs(y - h) < CITY.roadHalf) && x < CITY.eastX) return 'road';
    return 'grass';
  }

  const world = {
    w: CITY.width,
    h: CITY.height,
    roadsV,
    roadsH,
    blocks,
    buildings,
    props,
    lamps,
    decor,
    grounds,
    waves,
    piers,
    bridges,
    manholes,
    wornPatches,
    constructionLots,
    neonSigns,
    districtLabels,
    spawn: { ...PLAYER.spawn },
    isWater,
    districtAt,
    moveCircle,
    nearestRoad,
    surfaceAt,
  };
  populateCityClutter(world, seed);
  return world;
}
