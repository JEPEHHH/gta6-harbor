// Wanted level rules: crime registry, heat accumulation, decay when line of sight
// is broken, escalation thresholds. One job: track and manage the wanted level.

import { clamp, dist } from './util.js';

/** Crimes and how much heat each one adds (0–5 scale mapped to thresholds). */
const CRIME_HEAT = {
  carjack: 0.6,
  assault: 0.4,
  shoot: 0.3,
  kill_ped: 1.0,
  kill_cop: 1.8,
  hit_vehicle: 0.15,
  hit_ped: 0.5,
  speeding_near_cop: 0.05,
};

const THRESHOLDS = [0, 1.0, 2.5, 4.5, 7.0, 10.0];
const DECAY_RATE = 0.12;         // heat per second when out of sight
const DECAY_LOS_RANGE = 400;    // must be this far from all police to decay
const DECAY_DELAY = 8;          // seconds with no crime before decay starts

export function createWantedState() {
  return {
    heat: 0,
    level: 0,
    lastCrimeTime: -999,
    decayPaused: false,
  };
}

/** Register a crime. */
export function reportCrime(ws, crimeName, elapsed) {
  const amount = CRIME_HEAT[crimeName] ?? 0.3;
  ws.heat += amount;
  ws.lastCrimeTime = elapsed;
  ws.decayPaused = true;
  ws.level = heatToLevel(ws.heat);
}

function heatToLevel(heat) {
  for (let i = THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (heat >= THRESHOLDS[i]) return i;
  }
  return 0;
}

/** Tick the wanted system: decay heat when the player is hiding. */
export function updateWanted(ws, dt, elapsed, player, policeUnits) {
  // Check if any police can see the player
  let seen = false;
  for (const p of policeUnits) {
    if (dist(player.x, player.y, p.x, p.y) < DECAY_LOS_RANGE) {
      seen = true;
      break;
    }
  }

  // Start decay timer after delay
  if (elapsed - ws.lastCrimeTime > DECAY_DELAY) {
    ws.decayPaused = false;
  }

  if (!ws.decayPaused && !seen && ws.heat > 0) {
    ws.heat = Math.max(0, ws.heat - DECAY_RATE * dt);
  }

  ws.level = heatToLevel(ws.heat);
}

/** Force-set wanted level (for the screenshot hooks). */
export function setWantedLevel(ws, level) {
  ws.level = clamp(level, 0, 5);
  ws.heat = level > 0 ? THRESHOLDS[level] + 0.1 : 0;
}

/** Clear wanted (used on death / busted). */
export function clearWanted(ws) {
  ws.heat = 0;
  ws.level = 0;
  ws.decayPaused = false;
}
