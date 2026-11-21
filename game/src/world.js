// Deterministic city generation: the road grid, districts, buildings, harbour, park and props.
// One seed lays out the same Blackwater Harbor every time; nothing here runs per frame.

import { CITY, CITY_SEED, PALETTE, PLAYER } from './config.js';
import { TAU, clamp, int, makeRng, pick, pointInRect, range, circleHitsRect } from './util.js';

const HOUSE_COLORS = ['#e8c8a0', '#d9e2e8', '#e6d3e0', '#cfe0c8', '#f0e0c0', '#e0b8a8'];
const TOWER_COLORS = ['#7fb6c9', '#d8cfc0', '#e8e4da', '#e0a890', '#9fb8c8'];
const HOTEL_COLORS = ['#f2e8d8', '#e8b8a0', '#a8d8d0', '#f0d8a8'];
const CONTAINER_COLORS = ['#b5493a', '#2e7f8c', '#c99a3a', '#3a6ea8', '#6a8f4f', '#8a5a8f'];

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
        : district === 'beachfront' ? '#c9c1a4'
        : '#b3c094';
      grounds.push({ x, y, w: blockSize, h: blockSize, color: groundColor });

      if (district === 'downtown') {
        for (let lot = 0; lot < 2; lot += 1) {
          const w = range(rng, 104, 142);
          const h = range(rng, 112, 164);
          const bx = x + lot * 166 + range(rng, 8, Math.max(9, 160 - w));
          const by = y + range(rng, 10, Math.max(11, 320 - h));
          const ht = range(rng, 120, 262);
          addBuilding({ x: bx, y: by, w, h }, 'tower', ht, pick(rng, TOWER_COLORS), '#c8c4ba');
        }
      } else if (district === 'suburbs') {
        for (let cx = 0; cx < 2; cx += 1) {
          for (let cy = 0; cy < 3; cy += 1) {
            const w = range(rng, 74, 104);
            const h = range(rng, 56, 80);
            const bx = x + cx * 166 + range(rng, 12, Math.max(13, 150 - w));
            const by = y + cy * 110 + range(rng, 10, Math.max(11, 100 - h));
            addBuilding({ x: bx, y: by, w, h }, 'house', range(rng, 22, 38), pick(rng, HOUSE_COLORS), rng() < 0.6 ? '#b56a4a' : '#8f9298');
          }
        }
        props.push({ kind: rng() < 0.35 ? 'palm' : 'tree', x: x + range(rng, 10, 320), y: y + range(rng, 10, 320), ph: range(rng, 0, TAU), s: range(rng, 0.85, 1.2) });
        props.push({ kind: 'hydrant', x: x - 8, y: y + 40 });
      } else if (district === 'northgate') {
        for (let lot = 0; lot < 2; lot += 1) {
          const w = range(rng, 130, 170);
          const h = range(rng, 90, 120);
          addBuilding({ x: x + lot * 166 + 8, y: y + range(rng, 30, 180), w, h }, 'flat', range(rng, 48, 74), pick(rng, HOUSE_COLORS), '#9f9a90');
        }
      } else if (district === 'beachfront') {
        for (let lot = 0; lot < 2; lot += 1) {
          const w = range(rng, 150, 208);
          const h = range(rng, 84, 104);
          addBuilding({ x: x + lot * 166 + range(rng, 4, Math.max(5, 160 - w)), y: y + range(rng, 16, 60), w, h }, 'hotel', range(rng, 56, 112), pick(rng, HOTEL_COLORS), '#e8e2d4');
        }
        for (let p = 0; p < 3; p += 1) {
          props.push({ kind: 'palm', x: x + 30 + p * 110, y: y + blockSize + 22, ph: range(rng, 0, TAU), s: range(rng, 0.9, 1.25) });
        }
      } else if (district === 'docks') {
        addBuilding({ x: x + 14, y: y + 12, w: 252, h: 122 }, 'warehouse', 42, '#9aa4ad', '#7d8790');
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
  grounds.push({ x: 4484, y: 600, w: CITY.eastX - 4484, h: 2500, color: PALETTE.dock });
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
      const lamp = { kind: 'lamp', x: roadsV[i] - CITY.roadHalf - 8, y, ph: 0 };
      props.push(lamp);
      lamps.push(lamp);
      if (y + 105 < 3200 && !nearCross(y + 105, roadsH)) {
        const other = { kind: 'lamp', x: roadsV[i] + CITY.roadHalf + 8, y: y + 105, ph: 0 };
        props.push(other);
        lamps.push(other);
      }
    }
  }
  for (let j = 0; j < CITY.rows; j += 1) {
    for (let x = 120; x < 4560; x += 210) {
      if (nearCross(x, roadsV)) continue;
      const lamp = { kind: 'lamp', x, y: roadsH[j] - CITY.roadHalf - 8, ph: 0 };
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

  return {
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
    spawn: { ...PLAYER.spawn },
    isWater,
    districtAt,
    moveCircle,
    nearestRoad,
    surfaceAt,
  };
}
