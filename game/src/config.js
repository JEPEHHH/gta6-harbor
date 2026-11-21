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
  land: '#a9b585',
  sand: '#e9d69c',
  wetSand: '#d8bf85',
  sea: '#17798a',
  seaDeep: '#0d5468',
  foam: '#bfe8e2',
  asphalt: '#63616b',
  highway: '#5c5a66',
  sidewalk: '#cbc6b6',
  lane: '#d9b64c',
  zebra: '#e8e6df',
  grass: '#8fb573',
  park: '#7cae62',
  concrete: '#a3a6ab',
  dock: '#8f959c',
  pier: '#a9825f',
  trunk: '#8a6a48',
  palm: '#3f8f4f',
  tree: '#4f8f4a',
  night: '#333c6e',
  lamp: '#ffd98a',
  hud: '#f2f5f7',
  hudDim: '#9fb0ba',
  hudPanel: 'rgba(10, 18, 26, 0.72)',
  accent: '#ff9e4a',
  teal: '#37c2c9',
  health: '#67d06f',
  armour: '#5aa7e8',
  star: '#ffcf4d',
  blood: '#b52a2a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'blackwater-harbor.save.v1';
