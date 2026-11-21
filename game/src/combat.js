// Weapons, bullets, melee and damage resolution.
// One job: handle all combat interactions.

import { WEAPONS, PLAYER } from './config.js';
import { TAU, clamp, dist } from './util.js';
import { createBullet, impactBurst } from './shots.js';
import { spawnExplosion } from './effects.js';

/** Create the player combat state. */
export function createCombatState() {
  return {
    weapon: 'fist',
    ammo: { pistol: 24, smg: 60 },
    fireTimer: 0,
    muzzleFlash: 0,
    meleeTimer: 0,
    shooting: false,
  };
}

/** Switch to the next weapon in the cycle. */
export function cycleWeapon(cs) {
  const order = ['fist', 'pistol', 'smg'];
  const idx = order.indexOf(cs.weapon);
  cs.weapon = order[(idx + 1) % order.length];
}

/** Handle fire input and produce bullets / melee hits. */
export function updateCombat(cs, dt, player, input, camera, world, bullets, particles, peds, policeUnits, reportCrimeFn) {
  cs.fireTimer -= dt;
  cs.muzzleFlash = Math.max(0, cs.muzzleFlash - dt);
  cs.meleeTimer = Math.max(0, cs.meleeTimer - dt);
  cs.shooting = false;

  if (player.inCar) return;   // no shooting while driving (for now)

  const w = WEAPONS[cs.weapon];

  // Melee
  if (input.pressed('melee') && cs.meleeTimer <= 0) {
    cs.meleeTimer = w.rate;
    cs.weapon = 'fist';
    const meleeW = WEAPONS.fist;
    // Check hits on peds
    for (const ped of peds) {
      if (!ped.alive) continue;
      if (dist(player.x, player.y, ped.x, ped.y) < meleeW.range) {
        ped.health -= meleeW.damage;
        impactBurst(particles, ped.x, ped.y, '181,42,42');
        camera.shake(3, 0.15);
        reportCrimeFn('assault');
        if (ped.health <= 0) {
          ped.alive = false;
          reportCrimeFn('kill_ped');
        }
      }
    }
    return;
  }

  // Fire button (mouse click)
  if (input.mouse.down && cs.fireTimer <= 0 && cs.weapon !== 'fist') {
    if (cs.ammo[cs.weapon] > 0 || w.ammo === Infinity) {
      cs.fireTimer = w.rate;
      cs.shooting = true;
      cs.muzzleFlash = 0.08;
      player.shooting = true;

      if (cs.ammo[cs.weapon] !== undefined) {
        cs.ammo[cs.weapon] -= 1;
      }

      // Create bullet toward the mouse cursor (world-space)
      const cam = camera;
      const bullet = createBullet(player.x, player.y, player.angle, 800);
      bullets.push(bullet);

      // Screen shake
      camera.shake(2.5, 0.1);

      // Muzzle flash light burst + gunsmoke puff
      particles.push({
        kind: 'flash',
        x: player.x + Math.cos(player.angle) * 14,
        y: player.y + Math.sin(player.angle) * 14,
        vx: Math.cos(player.angle) * 35,
        vy: Math.sin(player.angle) * 35,
        age: 0, life: 0.11, size: 7,
        color: '255,235,140',
      });
      particles.push({
        kind: 'smoke',
        x: player.x + Math.cos(player.angle) * 16,
        y: player.y + Math.sin(player.angle) * 16,
        vx: Math.cos(player.angle) * 28 + (Math.random() - 0.5) * 14,
        vy: Math.sin(player.angle) * 28 + (Math.random() - 0.5) * 14,
        age: 0, life: 0.42, size: 3.2,
        color: '215,212,206',
      });

      reportCrimeFn('shoot');
    } else {
      // Auto-switch back to fist when out of ammo
      cs.weapon = 'fist';
    }
  }
}

/** Resolve bullet hits against peds, police, vehicles and the world. */
export function resolveBulletHits(bullets, peds, policeUnits, player, world, particles, camera, reportCrimeFn) {
  for (const b of bullets) {
    if (b.hit) continue;

    // Hit peds
    for (const ped of peds) {
      if (!ped.alive) continue;
      if (dist(b.x, b.y, ped.x, ped.y) < 10) {
        ped.health -= 20;
        b.hit = true;
        impactBurst(particles, b.x, b.y, '181,42,42');
        if (ped.health <= 0) {
          ped.alive = false;
          reportCrimeFn('kill_ped');
        }
        break;
      }
    }

    // Hit police cars
    if (!b.hit) {
      for (const u of policeUnits) {
        if (dist(b.x, b.y, u.car.x, u.car.y) < 20) {
          const prevHp = u.car.hp;
          u.car.hp -= 15;
          b.hit = true;
          impactBurst(particles, b.x, b.y, '220,180,120');
          if (prevHp > 0 && u.car.hp <= 0) {
            spawnExplosion(particles, u.car.x, u.car.y, 1.15);
            camera.shake(7, 0.35);
          }
          reportCrimeFn('shoot');
          break;
        }
      }
    }

    // Hit player (from police bullets)
    if (!b.hit && dist(b.x, b.y, player.x, player.y) < 10) {
      // Damage player
      if (player.armour > 0) {
        player.armour = Math.max(0, player.armour - 12);
      } else {
        player.health -= 15;
      }
      b.hit = true;
      impactBurst(particles, b.x, b.y, '181,42,42');
      camera.shake(4, 0.2);
    }

    // Hit buildings
    if (!b.hit) {
      for (const bld of world.buildings) {
        if (b.x >= bld.x && b.x <= bld.x + bld.w && b.y >= bld.y && b.y <= bld.y + bld.h) {
          b.hit = true;
          impactBurst(particles, b.x, b.y, '180,170,160');
          break;
        }
      }
    }
  }
}

/** Check if the player is dead. */
export function isPlayerDead(player) {
  return player.health <= 0;
}

/** Handle death: respawn at hospital with a money penalty. */
export function respawnPlayer(player, world, camera) {
  player.x = world.spawn.x;
  player.y = world.spawn.y;
  player.health = PLAYER.health;
  player.armour = 0;
  player.money = Math.max(0, player.money - 500);
  player.inCar = null;
  player.vx = 0;
  player.vy = 0;
  camera.snap(player.x, player.y);
}

/** Draw the weapon indicator and ammo count. */
export function drawWeaponHUD(ctx, cs, x, y, font) {
  const w = WEAPONS[cs.weapon];
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f2f5f7';
  ctx.font = `700 16px ${font}`;
  ctx.fillText(w.name, x, y);

  if (cs.weapon !== 'fist') {
    ctx.fillStyle = '#9fb0ba';
    ctx.font = `600 13px ${font}`;
    const ammoText = cs.ammo[cs.weapon] !== undefined ? String(cs.ammo[cs.weapon]) : '∞';
    ctx.fillText(ammoText, x, y + 18);
  }

  // Muzzle flash indicator
  if (cs.muzzleFlash > 0) {
    ctx.fillStyle = `rgba(255,230,120,${clamp(cs.muzzleFlash * 10, 0, 0.6).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x - 70, y - 5, 8, 0, TAU);
    ctx.fill();
  }
}

/** Draw crosshair. */
export function drawCrosshair(ctx, mx, my) {
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1.5;
  const s = 10;
  ctx.beginPath();
  ctx.moveTo(mx - s, my); ctx.lineTo(mx - 4, my);
  ctx.moveTo(mx + 4, my); ctx.lineTo(mx + s, my);
  ctx.moveTo(mx, my - s); ctx.lineTo(mx, my - 4);
  ctx.moveTo(mx, my + 4); ctx.lineTo(mx, my + s);
  ctx.stroke();
}
