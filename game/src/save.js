// Save/load to localStorage. Stores roam state (position, money, health,
// clock, wanted level), weapon/ammo and mission progress.

import { SAVE_KEY } from './config.js';

export function saveGame(g) {
  try {
    const p = g.player;
    const data = {
      v: 2,
      x: p.x,
      y: p.y,
      angle: p.angle,
      money: p.money,
      health: p.health,
      armour: p.armour,
      time: g.time,
      wanted: g.wanted,
    };
    if (g.combat) {
      data.weapon = g.combat.weapon;
      data.ammo = { ...g.combat.ammo };
    }
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
    if (!data) return null;
    if (data.v === 1 || data.v === 2) return data;
    return null;
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
