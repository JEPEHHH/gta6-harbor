// Save/load to localStorage. Milestone A stores the roam state (position, money, health,
// clock, wanted level); missions and garage join the snapshot in later milestones.

import { SAVE_KEY } from './config.js';

export function saveGame(g) {
  try {
    const p = g.player;
    const data = {
      v: 1,
      x: p.x,
      y: p.y,
      angle: p.angle,
      money: p.money,
      health: p.health,
      armour: p.armour,
      time: g.time,
      wanted: g.wanted,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.v === 1 ? data : null;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off (private windows): nothing to clear then.
  }
}
