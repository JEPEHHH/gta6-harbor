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
  land: '#92a46f',
  sand: '#e8d094',
  wetSand: '#caa96b',
  sea: '#127384',
  seaShallow: '#1f8f9e',
  seaDeep: '#093f52',
  foam: '#d4f4ee',
  asphalt: '#3e4049',
  highway: '#353740',
  asphaltPatch: '#4b4d57',
  sidewalk: '#d8cfbd',
  curb: '#eee7d8',
  curbShadow: '#8c867b',
  lane: '#e8b949',
  laneWhite: '#ece7da',
  zebra: '#f0ece0',
  grass: '#6f9b55',
  park: '#588c46',
  concrete: '#b7b0a2',
  dock: '#8c8d90',
  pier: '#a47b54',
  trunk: '#7f5e3e',
  palm: '#348344',
  tree: '#468443',

  // Atmosphere, lighting & neon accents
  night: '#1f2b52',
  duskWarm: '#ff7a45',
  duskMagenta: '#c8428e',
  lamp: '#ffca6b',
  neonMagenta: '#ff3b9a',
  neonCyan: '#2be4e4',
  neonAmber: '#ff9d3b',

  // HUD palette
  hud: '#f4f7fa',
  hudDim: '#9ab0bf',
  hudPanel: 'rgba(11, 17, 27, 0.78)',
  hudBorder: 'rgba(255, 255, 255, 0.15)',
  accent: '#ff9a44',
  teal: '#2fd0d6',
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
