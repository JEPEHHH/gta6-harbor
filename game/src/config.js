// Blackwater Harbor — every tuning number, the city seed and the palette in one place.
// World units are pixels at zoom 1; the renderer scales the view to the window.

/** Fixed seed: the city lays out identically on every visit and every screenshot. */
export const CITY_SEED = 20261121;

export const STEP = 1 / 60;

export const CITY = {
  width: 4800,
  height: 3800,
  pitch: 420,          // distance between road centre lines
  roadHalf: 28,        // half the asphalt width (two lanes)
  walk: 16,            // sidewalk width on each block side
  cols: 11,            // vertical roads
  rows: 8,             // horizontal roads
  first: 240,          // first road centre on each axis
  seaY: 3420,          // ocean starts south of this
  beachY: 3260,        // sand starts here
  eastX: 4620,         // ocean starts east of this
  basin: { x: 4300, y: 1560, w: 320, h: 540 }, // harbour basin cut into the docks
};

export const PLAYER = {
  radius: 9,
  walk: 150,
  sprint: 242,
  accel: 12,
  health: 100,
  startMoney: 250,
  spawn: { x: 1710, y: 3212 },
};

export const CAMERA = {
  footZoom: 1.06,
  carZoom: 0.92,
  lead: 0.32,          // seconds of velocity the camera looks ahead
  maxLead: 150,
  smooth: 5.5,
};

export const TIME = {
  start: 17.3,         // golden hour on a new game
  title: 18.1,         // dusk behind the title screen
  daySeconds: 1200,    // real seconds for a full 24 h cycle
};

export const PALETTE = {
  // Terrain & coastline: sun-warmed concrete, rich teal water, golden sand
  land: '#8da16a',
  sand: '#ebd49b',
  wetSand: '#c8a668',
  sea: '#127384',
  seaShallow: '#1f8f9e',
  seaDeep: '#093f52',
  foam: '#d4f4ee',
  asphalt: '#42454f',
  highway: '#383b45',
  asphaltPatch: '#50535e',
  sidewalk: '#dfd6c5',
  curb: '#f4efe2',
  curbFace: '#9d9688',
  curbShadow: '#767066',
  lane: '#ebb947',
  laneWhite: '#f0ece0',
  zebra: '#f2eee2',
  grass: '#6d9953',
  park: '#588c46',
  concrete: '#c0b8a8',
  dock: '#8c8f94',
  pier: '#a47b54',
  trunk: '#84603e',
  palm: '#348344',
  tree: '#468443',

  // Atmosphere, lighting & neon accents
  night: '#18244a',
  duskWarm: '#ff7a45',
  duskMagenta: '#c8428e',
  lamp: '#ffca6b',
  neonMagenta: '#ff3b9a',
  neonCyan: '#2be4e4',
  neonAmber: '#ff9d3b',

  // HUD palette
  hud: '#f6f9fc',
  hudDim: '#dde8f2',
  hudPanel: 'rgba(6, 10, 18, 0.94)',
  hudBorder: 'rgba(222, 238, 252, 0.36)',
  hudOutline: 'rgba(3, 6, 12, 0.95)',
  accent: '#ff9a44',
  accentValue: '#ffc464',
  teal: '#2fd0d6',
  tealValue: '#66eef2',
  health: '#5fd475',
  armour: '#4fa8f2',
  star: '#ffd24c',
  blood: '#b82828',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'blackwater-harbor.save.v1';

/** Weapon definitions used by combat.js (milestone B). */
export const WEAPONS = {
  fist: { name: 'Fist', damage: 8, range: 22, rate: 0.4, ammo: Infinity },
  pistol: { name: 'Pistol', damage: 22, range: 600, rate: 0.28, ammo: 12 },
  smg: { name: 'SMG', damage: 14, range: 480, rate: 0.08, ammo: 30 },
};
