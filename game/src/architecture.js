// Procedural district architecture: 8 distinct facade material palettes, varied building
// footprints (L-shaped, courtyard, terrace rows, setback towers), balconies, rooftop
// equipment, corner shops with awnings, graffiti walls, empty rubble lots and gardens.

import { TAU, int, pick, range } from './util.js';

/** Eight cohesive architectural facade palettes for rich visual variety across districts. */
export const MATERIAL_PALETTES = {
  brick: {
    walls: ['#b55d47', '#9e4c3d', '#c26e52', '#8f4a3c', '#b9694a'],
    roofs: ['#7c746c', '#6e665f', '#8a7e74'],
    trim: '#dfd4c0',
  },
  sandstone: {
    walls: ['#dfd1b4', '#d4c19d', '#e6dac0', '#cbb68e', '#d9c8a6'],
    roofs: ['#9f988c', '#8f897e', '#b0a798'],
    trim: '#f3ebd8',
  },
  glass: {
    walls: ['#4f7e94', '#3e637a', '#56848a', '#64798c', '#4b6c84'],
    roofs: ['#6c7884', '#5c6976', '#7b8792'],
    trim: '#b8d0dc',
  },
  concrete: {
    walls: ['#c6c1b8', '#b7bdc2', '#d4cab8', '#a8b0b4', '#cfc8bc'],
    roofs: ['#8e8c86', '#7f848a', '#9c9890'],
    trim: '#e4dfd4',
  },
  corrugated: {
    walls: ['#7e8b96', '#6b7984', '#8d877c', '#627380', '#7a8288'],
    roofs: ['#5f6a74', '#6d7782', '#58626b'],
    trim: '#a4aeb6',
  },
  timber: {
    walls: ['#b9895d', '#a6774e', '#c79c6f', '#9c714b', '#c29264'],
    roofs: ['#6f757c', '#9c5a40', '#5b7260'],
    trim: '#efe5d2',
  },
  stucco: {
    walls: ['#f0e3ce', '#eabfa8', '#a6d4cb', '#f0d89f', '#e5c7d2', '#d5e4cf'],
    roofs: ['#c26b48', '#b05d3f', '#dfd5c3', '#77848c'],
    trim: '#faf4e8',
  },
  terracotta: {
    walls: ['#cc845f', '#d6976b', '#ba7150', '#d18e66'],
    roofs: ['#9e563a', '#8c4b34', '#a86446'],
    trim: '#efe0c8',
  },
};

export const HOUSE_ROOFS = ['#b86240', '#636d78', '#567862', '#8f523a', '#7c6a58', '#9e5d48'];

export const AWNING_PALETTES = [
  ['#d84a42', '#f4ede0'],
  ['#1f8f96', '#f2efe6'],
  ['#e08938', '#f6f0e2'],
  ['#2b4c7a', '#ebe8df'],
  ['#c93f7c', '#f4ebf0'],
  ['#3c7d52', '#f3f0e4'],
];

export const CONTAINER_COLORS = ['#b5493a', '#247888', '#c99736', '#3366a0', '#5a8748', '#874c8a'];

const ROOF_SIGNS = [
  { text: 'APEX', hex: '#ff9d3b', rgb: '255, 157, 59' },
  { text: 'HARBOR', hex: '#2be4e4', rgb: '43, 228, 228' },
  { text: 'CORAL', hex: '#ff3b9a', rgb: '255, 59, 154' },
  { text: 'PLAZA', hex: '#ffd24c', rgb: '255, 210, 76' },
  { text: 'MARINA', hex: '#2be4e4', rgb: '43, 228, 228' },
  { text: 'SUNCOAST', hex: '#ff6d4a', rgb: '255, 109, 74' },
  { text: 'BLACKWATER', hex: '#ff9d3b', rgb: '255, 157, 59' },
];

const MOTEL_NEONS = [
  { label: 'PALMS MOTEL', hex: '#ff3b9a', rgb: '255, 59, 154', radius: 150 },
  { label: 'NO VACANCY', hex: '#2be4e4', rgb: '43, 228, 228', radius: 135 },
  { label: 'STARLIGHT', hex: '#ff9d3b', rgb: '255, 157, 59', radius: 145 },
  { label: 'BLUE WAVE', hex: '#2be4e4', rgb: '43, 228, 228', radius: 145 },
  { label: 'SUNSET INN', hex: '#ff3b9a', rgb: '255, 59, 154', radius: 140 },
];

function matColors(rng, mat) {
  const spec = MATERIAL_PALETTES[mat] || MATERIAL_PALETTES.concrete;
  return {
    material: mat,
    color: pick(rng, spec.walls),
    roof: pick(rng, spec.roofs),
    trim: spec.trim,
  };
}

/**
 * Helper to create a detailed building entry with material, roof features, balconies,
 * awnings, setbacks, spires, roof signs, and alley graffiti.
 */
function makeBuilding(rng, rect, kind, ht, mat, opts = {}) {
  const m = matColors(rng, mat);
  return {
    ...rect,
    kind,
    ht,
    material: m.material,
    color: opts.color || m.color,
    roof: opts.roof || m.roof,
    trim: opts.trim || m.trim,
    seed: int(rng, 0, 1e9),
    roofStyle: opts.roofStyle || (kind === 'house' ? (rng() < 0.55 ? 'hip' : 'gable') : 'flat'),
    balconies: opts.balconies ?? false,
    balconySides: opts.balconySides || null,
    awning: opts.awning ?? null,
    awningSide: opts.awningSide || 'south',
    cornerAwning: opts.cornerAwning ?? false,
    hasWaterTank: opts.hasWaterTank ?? false,
    hasBulkhead: opts.hasBulkhead ?? false,
    hasSatDish: opts.hasSatDish ?? false,
    hasSkylight: opts.hasSkylight ?? false,
    hasHelipad: opts.hasHelipad ?? false,
    hasVents: opts.hasVents ?? false,
    graffiti: opts.graffiti ?? null,
    setbacks: opts.setbacks || null,
    spire: opts.spire ?? null,
    roofSign: opts.roofSign ?? null,
    scaffolding: opts.scaffolding ?? false,
    loadingBays: opts.loadingBays ?? 0,
  };
}

/** Populate one Downtown (Midtown) block with rich silhouette, material & shape variety. */
export function buildDowntownBlock(blk, ctx) {
  const { rng, addBuilding, pools, rubbleLots, props, neonSigns } = ctx;
  const { x, y, w, h, i, j } = blk;

  // Curated hero Midtown core blocks (visible in 1-cover, 2-foot, 3-car)
  // Note: keep south edge of (4,2) y <= 1438 so staged chatting peds at (2046, 1446) stay clear.
  if (i === 4 && j === 2) {
    // West: Art Deco Sandstone Setback Tower with Spire & Roof Sign + Corner Shop Awning
    const artDeco = makeBuilding(rng, { x: x + 12, y: y + 18, w: 126, h: 162 }, 'tower', 238, 'sandstone', {
      color: '#e0cfa9',
      roof: '#a69d8c',
      awning: ['#d84a42', '#f4ede0'],
      awningSide: 'south',
      cornerAwning: true,
      hasBulkhead: true,
      setbacks: [
        { insetX: 16, insetY: 22, ht: 48, color: '#eadcc0', roof: '#b5ab98' },
      ],
      spire: { height: 52, beacon: true },
      roofSign: { text: 'APEX', hex: '#ff9d3b', rgb: '255, 157, 59', side: 'south' },
    });
    addBuilding(artDeco);

    // SW corner low timber-and-brick café shopfront (clear of y=1446!)
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 206, w: 112, h: 98 }, 'shop', 58, 'brick', {
      color: '#b45a44',
      roof: '#786e66',
      awning: ['#1f8f96', '#f2efe6'],
      awningSide: 'south',
      cornerAwning: true,
      hasWaterTank: true,
      hasSatDish: true,
      balconies: true,
      balconySides: ['south', 'west'],
      graffiti: { side: 'east', seed: 4201 },
    }));

    // East: L-shaped Teal Glass Curtain-Wall Office (2 staggered wings)
    addBuilding(makeBuilding(rng, { x: x + 170, y: y + 20, w: 146, h: 132 }, 'tower', 176, 'glass', {
      color: '#467c92',
      roof: '#697884',
      hasBulkhead: true,
      hasSatDish: true,
      hasSkylight: true,
      setbacks: [{ insetX: 24, insetY: 20, ht: 34, color: '#5890a6', roof: '#788894' }],
    }));
    addBuilding(makeBuilding(rng, { x: x + 226, y: y + 152, w: 90, h: 146 }, 'tower', 112, 'glass', {
      color: '#4f869c',
      roof: '#72828e',
      awning: ['#2b4c7a', '#ebe8df'],
      awningSide: 'south',
      hasBulkhead: true,
    }));
    return;
  }

  if (i === 5 && j === 2) {
    // West: Historic Red-Brick & Terracotta Terrace Row with Water Tank, Balconies & Graffiti
    addBuilding(makeBuilding(rng, { x: x + 12, y: y + 24, w: 122, h: 110 }, 'flat', 94, 'brick', {
      color: '#a94f3e',
      roof: '#746c65',
      balconies: true,
      balconySides: ['west', 'north'],
      hasWaterTank: true,
      hasBulkhead: true,
      graffiti: { side: 'east', seed: 5202 },
    }));
    addBuilding(makeBuilding(rng, { x: x + 14, y: y + 152, w: 62, h: 146 }, 'shop', 72, 'timber', {
      color: '#bc8d5e',
      roof: '#7a726a',
      awning: ['#d84a42', '#f4ede0'],
      awningSide: 'south',
      cornerAwning: true,
      hasSatDish: true,
      balconies: true,
      balconySides: ['west'],
    }));
    addBuilding(makeBuilding(rng, { x: x + 76, y: y + 162, w: 58, h: 136 }, 'shop', 64, 'terracotta', {
      color: '#cc825c',
      roof: '#8c4e36',
      awning: ['#e08938', '#f6f0e2'],
      awningSide: 'south',
      hasBulkhead: true,
      graffiti: { side: 'east', seed: 5208 },
    }));

    // East: Signature Navy Curtain-Wall Spire Skyscraper (tallest downtown landmark!)
    addBuilding(makeBuilding(rng, { x: x + 168, y: y + 36, w: 146, h: 242 }, 'tower', 252, 'glass', {
      color: '#3c5f78',
      roof: '#5d6b78',
      awning: ['#1f8f96', '#f2efe6'],
      awningSide: 'south',
      setbacks: [
        { insetX: 18, insetY: 28, ht: 52, color: '#4c728d', roof: '#6e7e8c' },
        { insetX: 38, insetY: 56, ht: 38, color: '#5f88a3', roof: '#8292a0' },
      ],
      spire: { height: 64, beacon: true },
      roofSign: { text: 'HARBOR', hex: '#2be4e4', rgb: '43, 228, 228', side: 'south' },
    }));
    return;
  }

  if (i === 4 && j === 3) {
    // West: U-shaped Terracotta & Painted Concrete Courtyard Complex enclosing green garden
    addBuilding(makeBuilding(rng, { x: x + 12, y: y + 14, w: 146, h: 72 }, 'flat', 82, 'terracotta', {
      color: '#cd835d',
      roof: '#92523a',
      balconies: true,
      balconySides: ['north', 'west'],
      awning: ['#3c7d52', '#f3f0e4'],
      awningSide: 'west',
      cornerAwning: true,
      hasWaterTank: true,
      hasSatDish: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 12, y: y + 86, w: 58, h: 142 }, 'flat', 68, 'concrete', {
      color: '#cfc6b6',
      roof: '#8f8b84',
      balconies: true,
      balconySides: ['west'],
      hasBulkhead: true,
      graffiti: { side: 'east', seed: 4309 },
    }));
    addBuilding(makeBuilding(rng, { x: x + 12, y: y + 228, w: 144, h: 80 }, 'flat', 78, 'brick', {
      color: '#b45c46',
      roof: '#756c64',
      balconies: true,
      balconySides: ['south', 'west'],
      awning: ['#c93f7c', '#f4ebf0'],
      awningSide: 'south',
      hasBulkhead: true,
    }));
    // Inner courtyard garden / pool tucked inside the U-shape!
    pools.push({ x: x + 84, y: y + 114, w: 62, h: 86, kind: 'courtyard_garden' });
    props.push({ kind: 'palm', x: x + 114, y: y + 158, ph: 1.2, s: 0.95 });

    // East: Tall Bronze-Sandstone Setback Tower with Helipad & Magenta Roof Sign
    addBuilding(makeBuilding(rng, { x: x + 184, y: y + 28, w: 132, h: 256 }, 'tower', 228, 'sandstone', {
      color: '#d6be96',
      roof: '#9c9488',
      hasHelipad: true,
      hasBulkhead: true,
      awning: ['#c93f7c', '#f4ebf0'],
      awningSide: 'south',
      setbacks: [
        { insetX: 14, insetY: 22, ht: 42, color: '#e2cca7', roof: '#a9a093' },
      ],
      roofSign: { text: 'CORAL', hex: '#ff3b9a', rgb: '255, 59, 154', side: 'north' },
    }));
    return;
  }

  if (i === 6 && j === 2) {
    // West edge: Terrace row of 3 narrow colorful downtown shopfronts facing roadsV[6]
    const terraceSpecs = [
      { mat: 'brick', col: '#a84f3d', ht: 64, aw: ['#d84a42', '#f4ede0'] },
      { mat: 'sandstone', col: '#dfd0b2', ht: 78, aw: ['#1f8f96', '#f2efe6'] },
      { mat: 'timber', col: '#ba895c', ht: 56, aw: ['#e08938', '#f6f0e2'] },
    ];
    for (let t = 0; t < 3; t += 1) {
      const sp = terraceSpecs[t];
      addBuilding(makeBuilding(rng, { x: x + 12, y: y + 18 + t * 98, w: 108, h: 92 }, 'shop', sp.ht, sp.mat, {
        color: sp.col,
        awning: sp.aw,
        awningSide: 'west',
        balconies: t !== 2,
        balconySides: ['west'],
        hasWaterTank: t === 0,
        hasSatDish: t === 1,
        hasBulkhead: t === 2,
        graffiti: t === 2 ? { side: 'south', seed: 6214 } : null,
      }));
    }
    // East: Modernist Painted Concrete Slab Tower with Spire & Roof Sign
    addBuilding(makeBuilding(rng, { x: x + 156, y: y + 34, w: 158, h: 256 }, 'tower', 248, 'concrete', {
      color: '#cfd0cc',
      roof: '#8b8f94',
      balconies: true,
      balconySides: ['south', 'west'],
      setbacks: [{ insetX: 20, insetY: 26, ht: 46, color: '#ddddd8', roof: '#989ca0' }],
      spire: { height: 50, beacon: true },
      roofSign: { text: 'PLAZA', hex: '#ffd24c', rgb: '255, 210, 76', side: 'south' },
    }));
    return;
  }

  if (i === 6 && j === 3) {
    // North: Tall Glass-and-Concrete Setback Tower
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 16, w: 154, h: 174 }, 'tower', 216, 'glass', {
      color: '#527f8c',
      roof: '#6c7a86',
      hasSkylight: true,
      hasBulkhead: true,
      awning: ['#1f8f96', '#f2efe6'],
      awningSide: 'west',
      setbacks: [{ insetX: 20, insetY: 20, ht: 44, color: '#6492a0', roof: '#7c8b96' }],
      roofSign: { text: 'MARINA', hex: '#2be4e4', rgb: '43, 228, 228', side: 'west' },
    }));
    // East: Red-Brick L-shaped Warehouse-Loft conversion
    addBuilding(makeBuilding(rng, { x: x + 190, y: y + 20, w: 126, h: 280 }, 'flat', 118, 'brick', {
      color: '#9e4c3d',
      roof: '#756b64',
      balconies: true,
      balconySides: ['west', 'south'],
      hasWaterTank: true,
      hasBulkhead: true,
      hasSatDish: true,
    }));
    // SW corner: Empty urban lot with rubble & graffiti retaining wall
    rubbleLots.push({ x: x + 16, y: y + 210, w: 146, h: 104, seed: 6301, graffiti: true });
    return;
  }

  // Other downtown blocks: (4,4), (5,4), (6,4) — varied procedural architectural templates
  const template = (i * 3 + j) % 3;
  if (template === 0) {
    // Tall setback spire tower + brick mid-rise with water tank + corner shop
    const sign = ROOF_SIGNS[(i + j) % ROOF_SIGNS.length];
    addBuilding(makeBuilding(rng, { x: x + 14, y: y + 16, w: 144, h: 212 }, 'tower', range(rng, 210, 265), pick(rng, ['glass', 'sandstone']), {
      hasBulkhead: true,
      hasHelipad: rng() < 0.4,
      awning: pick(rng, AWNING_PALETTES),
      awningSide: 'west',
      setbacks: [{ insetX: 18, insetY: 22, ht: 46, color: '#d8ceb8', roof: '#9a9488' }],
      spire: { height: 54, beacon: true },
      roofSign: { ...sign, side: 'south' },
    }));
    addBuilding(makeBuilding(rng, { x: x + 182, y: y + 20, w: 132, h: 130 }, 'flat', range(rng, 88, 126), 'brick', {
      balconies: true,
      balconySides: ['south', 'east'],
      hasWaterTank: true,
      hasSatDish: true,
      graffiti: { side: 'west', seed: int(rng, 1, 9999) },
    }));
    addBuilding(makeBuilding(rng, { x: x + 182, y: y + 178, w: 132, h: 128 }, 'shop', range(rng, 58, 86), 'timber', {
      awning: pick(rng, AWNING_PALETTES),
      awningSide: 'south',
      cornerAwning: true,
      hasBulkhead: true,
    }));
  } else if (template === 1) {
    // Courtyard concrete/terracotta office + tall glass tower
    addBuilding(makeBuilding(rng, { x: x + 14, y: y + 18, w: 148, h: 66 }, 'flat', 86, 'concrete', {
      balconies: true,
      balconySides: ['north'],
      hasBulkhead: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 14, y: y + 84, w: 56, h: 148 }, 'flat', 72, 'sandstone', {
      hasSatDish: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 14, y: y + 232, w: 148, h: 74 }, 'flat', 90, 'terracotta', {
      awning: pick(rng, AWNING_PALETTES),
      awningSide: 'south',
      hasWaterTank: true,
    }));
    pools.push({ x: x + 82, y: y + 106, w: 68, h: 102, kind: 'courtyard_garden' });
    addBuilding(makeBuilding(rng, { x: x + 186, y: y + 24, w: 130, h: 274 }, 'tower', range(rng, 220, 275), 'glass', {
      hasSkylight: true,
      setbacks: [{ insetX: 16, insetY: 26, ht: 44, color: '#5b8ba0', roof: '#768692' }],
      spire: { height: 48, beacon: true },
      roofSign: { ...ROOF_SIGNS[(i * 2 + j) % ROOF_SIGNS.length], side: 'south' },
    }));
  } else {
    // Terrace row of 4 mixed-palette shopfronts + mid-rise tower + rubble lot
    const mats = ['brick', 'sandstone', 'concrete', 'timber'];
    for (let k = 0; k < 4; k += 1) {
      addBuilding(makeBuilding(rng, { x: x + 12 + k * 76, y: y + 16, w: 72, h: 112 }, 'shop', range(rng, 64, 108), mats[k], {
        awning: k % 2 === 0 ? pick(rng, AWNING_PALETTES) : null,
        awningSide: 'south',
        balconies: k === 1 || k === 2,
        balconySides: ['south'],
        hasWaterTank: k === 0,
        hasBulkhead: k === 2,
        hasSatDish: k === 3,
      }));
    }
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 160, w: 160, h: 148 }, 'tower', range(rng, 165, 225), 'sandstone', {
      hasHelipad: true,
      setbacks: [{ insetX: 20, insetY: 18, ht: 38, color: '#e5d8bc', roof: '#aba192' }],
      awning: pick(rng, AWNING_PALETTES),
      awningSide: 'south',
    }));
    rubbleLots.push({ x: x + 196, y: y + 168, w: 120, h: 136, seed: int(rng, 1, 9999), graffiti: true });
  }
  void w;
  void h;
  void neonSigns;
}

/** Populate a Suburban block: low-rise homes, L-shapes, gardens, fences, terrace rows, corner shops & occasional rubble lots. */
export function buildSuburbBlock(blk, ctx) {
  const { rng, addBuilding, gardens, pools, rubbleLots, props, neonSigns } = ctx;
  const { x, y, w, h, i, j } = blk;

  // Curated hero suburban block (3,2) right above Palmetto Park & visible in 2-foot.png!
  if (i === 3 && j === 2) {
    // NW: L-shaped pastel cream stucco cottage with slate roof & flower garden patio
    addBuilding(makeBuilding(rng, { x: x + 18, y: y + 16, w: 98, h: 64 }, 'house', 30, 'stucco', {
      color: '#f2e6cf',
      roof: '#626d78',
      roofStyle: 'hip',
      hasSatDish: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 18, y: y + 80, w: 50, h: 48 }, 'house', 24, 'stucco', {
      color: '#eee0c4',
      roof: '#626d78',
      roofStyle: 'gable',
    }));
    gardens.push({ x: x + 78, y: y + 86, w: 68, h: 54, kind: 'patio', seed: 3201 });

    // NE: Warm brick gable house with cedar roof & backyard flower garden
    addBuilding(makeBuilding(rng, { x: x + 188, y: y + 18, w: 112, h: 72 }, 'house', 34, 'brick', {
      color: '#b86248',
      roof: '#8f523a',
      roofStyle: 'gable',
    }));
    gardens.push({ x: x + 190, y: y + 102, w: 108, h: 42, kind: 'flowers', seed: 3202 });

    // SW: Timber bungalow with sage roof, backyard pool & flower garden (cleanly inside yard fences)
    addBuilding(makeBuilding(rng, { x: x + 18, y: y + 216, w: 106, h: 68 }, 'house', 26, 'timber', {
      color: '#c29264',
      roof: '#567862',
      roofStyle: 'hip',
    }));
    pools.push({ x: x + 24, y: y + 178, w: 54, h: 26, kind: 'pool' });
    gardens.push({ x: x + 90, y: y + 178, w: 56, h: 24, kind: 'flowers', seed: 3203 });

    // SE (facing Midtown & Park!): Neighborhood Corner Bakery / Timber Shopfront with striped awning!
    addBuilding(makeBuilding(rng, { x: x + 184, y: y + 186, w: 124, h: 108 }, 'shop', 44, 'terracotta', {
      color: '#d48e66',
      roof: '#8c523c',
      awning: ['#1f8f96', '#f4f0e6'],
      awningSide: 'south',
      cornerAwning: true,
      balconies: true,
      balconySides: ['south', 'east'],
      hasSatDish: true,
      hasBulkhead: true,
    }));
    props.push({ kind: 'palm', x: x + 156, y: y + 258, ph: 0.7, s: 1.05 });
    return;
  }

  // (2,2) & (2,3): visible on left side of 2-foot.png — terrace row + garden houses + rubble lot!
  if (i === 2 && j === 2) {
    // North terrace row of 4 colorful narrow townhouses
    const rowCols = [
      { mat: 'stucco', col: '#eabfa8', roof: '#b86240', ht: 32 },
      { mat: 'stucco', col: '#a8d4cb', roof: '#636d78', ht: 36 },
      { mat: 'brick', col: '#b35c46', roof: '#7c6a58', ht: 30 },
      { mat: 'stucco', col: '#f0d89f', roof: '#567862', ht: 34 },
    ];
    for (let k = 0; k < 4; k += 1) {
      const r = rowCols[k];
      addBuilding(makeBuilding(rng, { x: x + 16 + k * 74, y: y + 22, w: 68, h: 78 }, 'house', r.ht, r.mat, {
        color: r.col,
        roof: r.roof,
        roofStyle: 'gable',
        hasSatDish: k === 1,
      }));
    }
    gardens.push({ x: x + 22, y: y + 112, w: 286, h: 36, kind: 'flowers', seed: 2204 });
    // South: two varied L-shaped cottages with patio & pool
    addBuilding(makeBuilding(rng, { x: x + 18, y: y + 182, w: 108, h: 70 }, 'house', 28, 'timber', {
      roof: '#567862',
      roofStyle: 'hip',
    }));
    addBuilding(makeBuilding(rng, { x: x + 196, y: y + 176, w: 110, h: 66 }, 'house', 32, 'sandstone', {
      roof: '#636d78',
      roofStyle: 'hip',
    }));
    addBuilding(makeBuilding(rng, { x: x + 252, y: y + 242, w: 54, h: 48 }, 'house', 24, 'sandstone', {
      roof: '#636d78',
      roofStyle: 'gable',
    }));
    gardens.push({ x: x + 182, y: y + 248, w: 58, h: 44, kind: 'patio', seed: 2207 });
    return;
  }

  if (i === 2 && j === 3) {
    // NW: Empty suburban lot with rubble & graffiti wall
    rubbleLots.push({ x: x + 18, y: y + 18, w: 126, h: 112, seed: 2305, graffiti: true });
    // NE: Pastel cottage with garden & backyard pool
    addBuilding(makeBuilding(rng, { x: x + 186, y: y + 22, w: 116, h: 74 }, 'house', 30, 'stucco', {
      color: '#d8e6d0',
      roof: '#b86240',
      roofStyle: 'hip',
      hasSatDish: true,
    }));
    pools.push({ x: x + 206, y: y + 112, w: 68, h: 36, kind: 'pool' });
    // South: Brick corner bungalow + timber cottage with garden
    addBuilding(makeBuilding(rng, { x: x + 20, y: y + 196, w: 114, h: 82 }, 'house', 32, 'brick', {
      roof: '#636d78',
      roofStyle: 'gable',
    }));
    addBuilding(makeBuilding(rng, { x: x + 192, y: y + 190, w: 114, h: 88 }, 'house', 28, 'stucco', {
      color: '#f0e2c8',
      roof: '#567862',
      roofStyle: 'hip',
    }));
    gardens.push({ x: x + 26, y: y + 150, w: 102, h: 36, kind: 'flowers', seed: 2309 });
    return;
  }

  // Block (9,1) right north of the mission Docks block (visible at top of 4-mission.png!)
  if (i === 9 && j === 1) {
    // Dockside maritime transition: brick workshop + corrugated storage + timber harbour tavern with neon!
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 18, w: 146, h: 118 }, 'warehouse', 46, 'corrugated', {
      hasVents: true,
      loadingBays: 2,
      graffiti: { side: 'south', seed: 9101 },
    }));
    addBuilding(makeBuilding(rng, { x: x + 186, y: y + 22, w: 128, h: 112 }, 'flat', 54, 'brick', {
      balconies: true,
      balconySides: ['south'],
      hasWaterTank: true,
      hasBulkhead: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 18, y: y + 188, w: 132, h: 104 }, 'shop', 42, 'timber', {
      awning: ['#d84a42', '#f4ede0'],
      awningSide: 'south',
      cornerAwning: true,
      hasSatDish: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 184, y: y + 194, w: 128, h: 98 }, 'flat', 48, 'concrete', {
      balconies: true,
      balconySides: ['south', 'east'],
      hasBulkhead: true,
      graffiti: { side: 'west', seed: 9104 },
    }));
    neonSigns.push({
      x: x + 84,
      y: y + 295,
      w: 58,
      h: 10,
      orient: 'h',
      label: 'SALTY DOG',
      rgb: '255, 157, 59',
      hex: '#ff9d3b',
      radius: 130,
      flicker: false,
      ph: 1.1,
    });
    return;
  }

  // Block (8,2) west of mission Docks block (left edge of 4-mission.png)
  if (i === 8 && j === 2) {
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 20, w: 140, h: 124 }, 'flat', 64, 'brick', {
      hasWaterTank: true,
      hasBulkhead: true,
      balconies: true,
      balconySides: ['east'],
    }));
    addBuilding(makeBuilding(rng, { x: x + 186, y: y + 22, w: 126, h: 120 }, 'warehouse', 44, 'corrugated', {
      hasVents: true,
      loadingBays: 2,
      graffiti: { side: 'south', seed: 8201 },
    }));
    addBuilding(makeBuilding(rng, { x: x + 18, y: y + 186, w: 138, h: 112 }, 'shop', 48, 'concrete', {
      awning: ['#2b4c7a', '#ebe8df'],
      awningSide: 'south',
      hasSatDish: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 188, y: y + 184, w: 124, h: 116 }, 'flat', 58, 'terracotta', {
      balconies: true,
      balconySides: ['east', 'south'],
      hasBulkhead: true,
      graffiti: { side: 'north', seed: 8204 },
    }));
    return;
  }

  // General procedural suburbs: 4 distinct layout archetypes so suburbs never look like uniform boxes!
  const style = (i * 5 + j * 3) % 4;
  const subMats = ['stucco', 'timber', 'brick', 'sandstone'];

  if (style === 0) {
    // 4 generous garden homes (some L-shaped) with flowerbeds & backyard patios
    const quadrants = [
      [x + 16, y + 16],
      [x + 182, y + 16],
      [x + 16, y + 184],
      [x + 182, y + 184],
    ];
    for (let q = 0; q < 4; q += 1) {
      const [qx, qy] = quadrants[q];
      const mat = pick(rng, subMats);
      const roof = pick(rng, HOUSE_ROOFS);
      const bw = range(rng, 92, 118);
      const bh = range(rng, 62, 82);
      addBuilding(makeBuilding(rng, { x: qx, y: qy, w: bw, h: bh }, 'house', range(rng, 22, 36), mat, {
        roof,
        hasSatDish: q === 1 && rng() < 0.65,
      }));
      if (q === 0 && rng() < 0.7) {
        addBuilding(makeBuilding(rng, { x: qx, y: qy + bh, w: 46, h: 42 }, 'house', 22, mat, {
          roof,
          roofStyle: 'gable',
        }));
      } else {
        gardens.push({
          x: qx + 6,
          y: qy + bh + 10,
          w: Math.min(100, bw - 8),
          h: 34,
          kind: q % 2 === 0 ? 'flowers' : 'patio',
          seed: int(rng, 1, 9999),
        });
      }
    }
  } else if (style === 1) {
    // Terrace row along top + 2 garden houses + backyard pool
    for (let k = 0; k < 4; k += 1) {
      addBuilding(makeBuilding(rng, { x: x + 14 + k * 76, y: y + 18, w: 70, h: 82 }, 'house', range(rng, 28, 38), pick(rng, subMats), {
        roof: pick(rng, HOUSE_ROOFS),
        roofStyle: 'gable',
        hasSatDish: k === 2,
      }));
    }
    gardens.push({ x: x + 22, y: y + 114, w: 280, h: 34, kind: 'flowers', seed: int(rng, 1, 9999) });
    addBuilding(makeBuilding(rng, { x: x + 18, y: y + 184, w: 120, h: 86 }, 'house', 28, pick(rng, subMats), {
      roof: pick(rng, HOUSE_ROOFS),
    }));
    addBuilding(makeBuilding(rng, { x: x + 190, y: y + 184, w: 120, h: 86 }, 'house', 32, pick(rng, subMats), {
      roof: pick(rng, HOUSE_ROOFS),
    }));
    if (rng() < 0.65) pools.push({ x: x + 132, y: y + 146, w: 58, h: 32, kind: 'pool' });
  } else if (style === 2) {
    // Corner shopfront + 3 varied houses + occasional empty rubble lot
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 18, w: 118, h: 84 }, 'house', 28, pick(rng, subMats), {
      roof: pick(rng, HOUSE_ROOFS),
    }));
    gardens.push({ x: x + 20, y: y + 112, w: 108, h: 36, kind: 'patio', seed: int(rng, 1, 9999) });
    if (rng() < 0.55) {
      rubbleLots.push({ x: x + 184, y: y + 18, w: 126, h: 116, seed: int(rng, 1, 9999), graffiti: true });
    } else {
      addBuilding(makeBuilding(rng, { x: x + 186, y: y + 20, w: 116, h: 82 }, 'house', 30, pick(rng, subMats), {
        roof: pick(rng, HOUSE_ROOFS),
      }));
    }
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 186, w: 116, h: 86 }, 'house', 26, 'timber', {
      roof: pick(rng, HOUSE_ROOFS),
      hasSatDish: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 184, y: y + 184, w: 126, h: 108 }, 'shop', 42, pick(rng, ['brick', 'timber', 'terracotta']), {
      awning: pick(rng, AWNING_PALETTES),
      awningSide: 'south',
      cornerAwning: true,
      balconies: true,
      balconySides: ['south'],
      hasBulkhead: true,
    }));
  } else {
    // Quiet suburban block with 5 staggered varied cottages & lush gardens
    for (let cx = 0; cx < 2; cx += 1) {
      for (let cy = 0; cy < 3; cy += 1) {
        if (cx === 1 && cy === 1) {
          gardens.push({ x: x + 182, y: y + 122, w: 124, h: 84, kind: 'flowers', seed: int(rng, 1, 9999) });
          continue;
        }
        const bw = range(rng, 82, 110);
        const bh = range(rng, 58, 76);
        const bx = x + cx * 166 + range(rng, 12, Math.max(13, 150 - bw));
        const by = y + cy * 110 + range(rng, 10, Math.max(11, 98 - bh));
        addBuilding(makeBuilding(rng, { x: bx, y: by, w: bw, h: bh }, 'house', range(rng, 22, 36), pick(rng, subMats), {
          roof: pick(rng, HOUSE_ROOFS),
          hasSatDish: cy === 0 && cx === 0 && rng() < 0.5,
        }));
      }
    }
  }
  void w;
  void h;
}

/** Populate Northgate blocks: mixed brick/concrete flats, terrace rows, courtyards & occasional rubble lots. */
export function buildNorthgateBlock(blk, ctx) {
  const { rng, addBuilding, rubbleLots, pools } = ctx;
  const { x, y, i } = blk;

  if (i % 3 === 0) {
    // U-shaped brick & concrete apartment courtyard
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 18, w: 296, h: 74 }, 'flat', 66, 'brick', {
      balconies: true,
      balconySides: ['north', 'south'],
      hasWaterTank: true,
      hasBulkhead: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 92, w: 72, h: 184 }, 'flat', 54, 'concrete', {
      balconies: true,
      balconySides: ['west'],
      hasSatDish: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 240, y: y + 92, w: 72, h: 184 }, 'flat', 58, 'sandstone', {
      balconies: true,
      balconySides: ['east'],
      graffiti: { side: 'west', seed: int(rng, 1, 9999) },
    }));
    pools.push({ x: x + 112, y: y + 124, w: 104, h: 120, kind: 'courtyard_garden' });
  } else if (i % 3 === 1) {
    // Terrace row + mid-rise flat + empty rubble lot
    for (let k = 0; k < 4; k += 1) {
      addBuilding(makeBuilding(rng, { x: x + 14 + k * 76, y: y + 20, w: 70, h: 102 }, 'shop', range(rng, 46, 68), pick(rng, ['brick', 'timber', 'terracotta', 'concrete']), {
        awning: k % 2 === 0 ? pick(rng, AWNING_PALETTES) : null,
        awningSide: 'south',
        hasSatDish: k === 1,
        hasBulkhead: k === 3,
      }));
    }
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 168, w: 164, h: 126 }, 'flat', 74, 'concrete', {
      balconies: true,
      balconySides: ['south'],
      hasWaterTank: true,
      graffiti: { side: 'east', seed: int(rng, 1, 9999) },
    }));
    rubbleLots.push({ x: x + 198, y: y + 174, w: 118, h: 118, seed: int(rng, 1, 9999), graffiti: true });
  } else {
    // Paired L-shaped residential flats with varied materials
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 24, w: 142, h: 126 }, 'flat', 68, 'sandstone', {
      balconies: true,
      balconySides: ['south', 'west'],
      hasBulkhead: true,
      hasSatDish: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 150, w: 76, h: 132 }, 'flat', 52, 'sandstone', {
      awning: pick(rng, AWNING_PALETTES),
      awningSide: 'south',
    }));
    addBuilding(makeBuilding(rng, { x: x + 180, y: y + 32, w: 136, h: 256 }, 'flat', 78, 'brick', {
      balconies: true,
      balconySides: ['south', 'east'],
      hasWaterTank: true,
      hasBulkhead: true,
      graffiti: { side: 'west', seed: int(rng, 1, 9999) },
    }));
  }
}

/** Populate Beachfront blocks: light and airy pastel resorts, courtyard pools, balconies & palms. */
export function buildBeachfrontBlock(blk, ctx) {
  const { rng, addBuilding, pools, props } = ctx;
  const { x, y, i } = blk;

  const isCourtyard = i % 2 === 0;
  if (isCourtyard) {
    // Light airy U-shaped coastal boutique resort framing a turquoise swimming pool!
    const col = pick(rng, ['#f4ead8', '#f0cfc0', '#b8e0d8', '#f6e1b2']);
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 16, w: 298, h: 78 }, 'hotel', range(rng, 68, 98), 'stucco', {
      color: col,
      roof: '#e8dfd0',
      balconies: true,
      balconySides: ['south', 'north'],
      awning: pick(rng, AWNING_PALETTES),
      awningSide: 'south',
      hasSkylight: true,
      hasSatDish: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 94, w: 74, h: 142 }, 'hotel', 54, 'stucco', {
      color: col,
      roof: '#e8dfd0',
      balconies: true,
      balconySides: ['east', 'west'],
      hasBulkhead: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 240, y: y + 94, w: 74, h: 142 }, 'hotel', 54, 'stucco', {
      color: col,
      roof: '#e8dfd0',
      balconies: true,
      balconySides: ['west', 'east'],
    }));
    pools.push({ x: x + 114, y: y + 118, w: 102, h: 108, kind: 'resort_pool' });
    props.push({ kind: 'palm', x: x + 48, y: y + 278, ph: range(rng, 0, TAU), s: 1.05 });
    props.push({ kind: 'palm', x: x + 284, y: y + 278, ph: range(rng, 0, TAU), s: 1.1 });
  } else {
    // Twin airy pastel L-shaped beach villas & boardwalk café with sun terraces
    const col1 = pick(rng, ['#f5ece0', '#b2dcd4', '#f2cfb8']);
    const col2 = pick(rng, ['#f4e0b4', '#e8c8d4', '#dceae0']);
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 20, w: 144, h: 98 }, 'hotel', range(rng, 62, 104), 'stucco', {
      color: col1,
      roof: '#ebe2d4',
      balconies: true,
      balconySides: ['south', 'west'],
      awning: ['#229ca8', '#f5f2e8'],
      awningSide: 'south',
      hasSkylight: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 16, y: y + 118, w: 74, h: 92 }, 'shop', 42, 'timber', {
      awning: ['#e08938', '#f6f0e2'],
      awningSide: 'south',
      cornerAwning: true,
    }));
    addBuilding(makeBuilding(rng, { x: x + 180, y: y + 26, w: 136, h: 112 }, 'hotel', range(rng, 72, 114), 'stucco', {
      color: col2,
      roof: '#ebe2d4',
      balconies: true,
      balconySides: ['south', 'east'],
      awning: ['#d84a42', '#f4ede0'],
      awningSide: 'south',
      hasBulkhead: true,
      hasSatDish: true,
    }));
    pools.push({ x: x + 124, y: y + 164, w: 120, h: 68, kind: 'resort_pool' });
    for (let p = 0; p < 3; p += 1) {
      props.push({ kind: 'palm', x: x + 36 + p * 124, y: y + 284, ph: range(rng, 0, TAU), s: range(rng, 0.95, 1.2) });
    }
  }
}

/** Populate the Motel Strip Landmark (blocks (1,6), (2,6) & roadside motel): pastel motor courts + neon signs! */
export function buildMotelBlock(blk, ctx) {
  const { rng, addBuilding, pools, props, neonSigns, decor } = ctx;
  const { x, y, i } = blk;

  const isFirst = i % 2 === 1;
  const wallCol = isFirst ? '#f0d7c4' : '#c0e2dc';
  const roofCol = isFirst ? '#d4745a' : '#4a8e94';

  // Angled asphalt motel parking lot along the south front facing coastal boulevard
  decor.push({ kind: 'motel_lot', x: x + 16, y: y + 216, w: 300, h: 102 });

  // Classic U-shaped 2-story motor court with exterior corridor balconies
  addBuilding(makeBuilding(rng, { x: x + 16, y: y + 16, w: 300, h: 66 }, 'hotel', 48, 'stucco', {
    color: wallCol,
    roof: roofCol,
    balconies: true,
    balconySides: ['south'],
    hasSatDish: true,
    hasBulkhead: true,
  }));
  addBuilding(makeBuilding(rng, { x: x + 16, y: y + 82, w: 66, h: 122 }, 'hotel', 44, 'stucco', {
    color: wallCol,
    roof: roofCol,
    balconies: true,
    balconySides: ['east'],
    awning: isFirst ? ['#c93f7c', '#f4ebf0'] : ['#1f8f96', '#f2efe6'],
    awningSide: 'south',
  }));
  addBuilding(makeBuilding(rng, { x: x + 250, y: y + 82, w: 66, h: 122 }, 'hotel', 44, 'stucco', {
    color: wallCol,
    roof: roofCol,
    balconies: true,
    balconySides: ['west'],
  }));

  // Turquoise motel courtyard swimming pool
  pools.push({ x: x + 114, y: y + 104, w: 104, h: 82, kind: 'resort_pool' });

  // Iconic freestanding & rooftop retro motel neon signs!
  const specA = MOTEL_NEONS[isFirst ? 0 : 2];
  const specB = MOTEL_NEONS[isFirst ? 1 : 3];
  neonSigns.push(
    {
      x: x + 166,
      y: y + 214,
      w: 84,
      h: 13,
      orient: 'h',
      ...specA,
      flicker: false,
      ph: 0.6,
    },
    {
      x: x + 48,
      y: y + 298,
      w: 64,
      h: 11,
      orient: 'h',
      ...specB,
      flicker: true,
      ph: 2.1,
    },
    {
      x: x + 284,
      y: y + 298,
      w: 58,
      h: 11,
      orient: 'h',
      ...MOTEL_NEONS[4],
      flicker: false,
      ph: 1.4,
    },
  );

  // Palm accents framing the motel sign
  props.push({ kind: 'palm', x: x + 98, y: y + 286, ph: 0.4, s: 1.05 });
  props.push({ kind: 'palm', x: x + 234, y: y + 286, ph: 2.2, s: 1.05 });
}

/** Populate Industrial Docks blocks: corrugated steel warehouses, loading bays, graffiti & stacked containers. */
export function buildDocksBlock(blk, ctx) {
  const { rng, addBuilding, decor } = ctx;
  const { x, y, j } = blk;

  // Yellow/black industrial cargo striping apron in front of warehouse loading doors
  decor.push({ kind: 'dock_apron', x: x + 12, y: y + 132, w: 256, h: 24 });

  // Main corrugated-metal warehouse (keeps east strip x+270..x+332 clear for dockCar in (9,2)!)
  const whColor = j === 2 ? '#7b8a96' : pick(rng, ['#6f7e8a', '#8c8376', '#677984']);
  addBuilding(makeBuilding(rng, { x: x + 14, y: y + 12, w: 250, h: 118 }, 'warehouse', 46, 'corrugated', {
    color: whColor,
    roof: '#5d6974',
    hasVents: true,
    hasSkylight: true,
    loadingBays: 3,
    graffiti: { side: 'south', seed: 9000 + j * 37 },
  }));

  // Shipping containers: mix of single-stacked (ht: 26) and double-stacked (ht: 44)
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      if (rng() < 0.2) continue;
      // Keep NE yard of (9,2) clear for mission dockCar at (4386, 1184)
      const cx = x + 12 + col * 66;
      const cy = y + 162 + row * 42;
      const stacked = (row + col + j) % 3 === 0;
      addBuilding(makeBuilding(rng, { x: cx, y: cy, w: 58, h: 24 }, 'container', stacked ? 44 : 26, 'corrugated', {
        color: pick(rng, CONTAINER_COLORS),
        roof: '#000000',
      }));
    }
  }
}
