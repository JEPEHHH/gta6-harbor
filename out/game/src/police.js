// Police AI: cruiser pursuit, officers on foot, roadblocks, busted logic.
// One job: enforce the law in Blackwater Harbor.

import { CITY } from './config.js';
import { TAU, clamp, dist } from './util.js';
import { createVehicle, updateVehicle } from './vehicles.js';
import { nearestNode } from './roads.js';
import { createBullet } from './shots.js';

const SPAWN_DIST = 900;
const DESPAWN_DIST = 2400;
const PURSUIT_SPEED = [0, 160, 200, 260, 310, 350];
const MAX_UNITS = [0, 1, 2, 3, 5, 7];
const SHOOT_RANGE = 320;
const SHOOT_RATE = 0.8;
const BUSTED_RANGE = 40;
const BUSTED_SPEED = 30;

/** Create the police manager state. */
export function createPoliceState() {
  return {
    units: [],           // each unit: { car, officers[], state }
    bustedTimer: 0,
    respawnTimer: 0,
    sirenPhase: 0,
  };
}

/** Spawn a police unit (car + 2 officers conceptually). */
function spawnUnit(world, player, graph, rng) {
  // Spawn off-screen on a road
  const angle = rng() * TAU;
  let sx = player.x + Math.cos(angle) * SPAWN_DIST;
  let sy = player.y + Math.sin(angle) * SPAWN_DIST;
  sx = clamp(sx, 100, world.w - 100);
  sy = clamp(sy, 100, CITY.seaY - 50);
  if (world.isWater(sx, sy)) {
    const snap = world.nearestRoad(sx, sy);
    sx = snap.x;
    sy = snap.y;
  }
  const toPlayer = Math.atan2(player.y - sy, player.x - sx);
  const car = createVehicle(sx, sy, toPlayer, 'police');
  car.driver = 'police';
  car.headlights = true;
  return {
    car,
    state: 'chase',    // chase, block, foot
    shootTimer: 0,
    sirenOn: true,
    x: sx, y: sy,
  };
}

/** Update the entire police system. */
export function updatePolice(ps, dt, world, graph, player, wantedLevel, allVehicles, bullets, particles, rng, elapsed) {
  ps.sirenPhase += dt * 6;

  if (wantedLevel === 0) {
    // De-escalate: remove all units
    for (const u of ps.units) u.state = 'leave';
    for (let i = ps.units.length - 1; i >= 0; i -= 1) {
      const u = ps.units[i];
      const d = dist(u.car.x, u.car.y, player.x, player.y);
      if (d > DESPAWN_DIST) ps.units.splice(i, 1);
    }
    if (wantedLevel === 0) return;
  }

  // Spawn units up to the cap
  const maxUnits = MAX_UNITS[clamp(wantedLevel, 0, 5)];
  ps.respawnTimer -= dt;
  if (ps.units.length < maxUnits && ps.respawnTimer <= 0) {
    ps.units.push(spawnUnit(world, player, graph, rng));
    ps.respawnTimer = 3 + rng() * 2;
  }

  const pursuitSpeed = PURSUIT_SPEED[clamp(wantedLevel, 0, 5)];

  for (const u of ps.units) {
    const car = u.car;
    u.x = car.x;
    u.y = car.y;

    // Chase AI: steer toward the player
    const toPlayerX = player.x - car.x;
    const toPlayerY = player.y - car.y;
    const toPlayerDist = Math.hypot(toPlayerX, toPlayerY) || 1;
    const targetAngle = Math.atan2(toPlayerY, toPlayerX);

    let angleDiff = targetAngle - car.angle;
    while (angleDiff > Math.PI) angleDiff -= TAU;
    while (angleDiff < -Math.PI) angleDiff += TAU;
    car.steer = clamp(angleDiff * 2.0, -1, 1);

    const curSpeed = Math.hypot(car.vx, car.vy);
    if (toPlayerDist > 60) {
      car.throttle = curSpeed < pursuitSpeed ? 0.8 : 0.2;
      car.brake = 0;
    } else {
      car.throttle = 0;
      car.brake = 0.5;
    }

    // Ram attempt at higher wanted levels
    if (wantedLevel >= 3 && toPlayerDist < 120) {
      car.throttle = 1.0;
    }

    updateVehicle(car, dt, world, particles);

    // Shooting at higher wanted levels
    if (wantedLevel >= 2 && toPlayerDist < SHOOT_RANGE) {
      u.shootTimer -= dt;
      if (u.shootTimer <= 0) {
        u.shootTimer = SHOOT_RATE / (1 + wantedLevel * 0.15);
        const aimAngle = Math.atan2(player.y - car.y, player.x - car.x);
        const spread = 0.12;
        bullets.push(createBullet(car.x, car.y, aimAngle + (rng() - 0.5) * spread, 600));
      }
    }

    // Busted check: player is on foot, slow, and very close to police
    if (!player.inCar && toPlayerDist < BUSTED_RANGE && Math.hypot(player.vx, player.vy) < BUSTED_SPEED) {
      ps.bustedTimer += dt;
    } else if (toPlayerDist < 80) {
      ps.bustedTimer += dt * 0.3;
    }
  }

  // Despawn units that are too far
  for (let i = ps.units.length - 1; i >= 0; i -= 1) {
    const d = dist(ps.units[i].car.x, ps.units[i].car.y, player.x, player.y);
    if (d > DESPAWN_DIST) ps.units.splice(i, 1);
  }
}

/** Check if the player is busted. */
export function isBusted(ps) {
  return ps.bustedTimer >= 3.0;
}

/** Reset police state after busted / death. */
export function resetPolice(ps) {
  ps.units.length = 0;
  ps.bustedTimer = 0;
  ps.respawnTimer = 2;
}

/** Draw police siren lights on cars and vibrant dual-side ground strobe pools. */
export function drawPoliceLights(ctx, ps, t) {
  for (const u of ps.units) {
    if (!u.sirenOn) continue;
    const car = u.car;
    const flash = Math.sin(t * 14 + car.id) > 0;
    const perpX = -Math.sin(car.angle);
    const perpY = Math.cos(car.angle);

    // Dual-side flashing ground light pools (red on one side, blue on the other)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sides = [
      { ox: perpX * 16, oy: perpY * 16, col: flash ? '255,40,48' : '44,124,255', a: flash ? 0.48 : 0.36 },
      { ox: -perpX * 16, oy: -perpY * 16, col: flash ? '44,124,255' : '255,40,48', a: flash ? 0.36 : 0.48 },
    ];
    for (const s of sides) {
      const gx = car.x + s.ox;
      const gy = car.y + s.oy;
      const grad = ctx.createRadialGradient(gx, gy, 3, gx, gy, 88);
      grad.addColorStop(0, `rgba(${s.col},${s.a})`);
      grad.addColorStop(0.45, `rgba(${s.col},${(s.a * 0.42).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${s.col},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gx, gy, 88, 0, TAU);
      ctx.fill();
    }

    // Crisp blooming roof lightbar flares
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = flash ? '#ff3636' : '#3884ff';
    ctx.beginPath();
    ctx.arc(-1.5, -car.h * 0.22, 4.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-1.5, -car.h * 0.22, 1.8, 0, TAU);
    ctx.fill();

    ctx.fillStyle = flash ? '#3884ff' : '#ff3636';
    ctx.beginPath();
    ctx.arc(-1.5, car.h * 0.22, 4.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-1.5, car.h * 0.22, 1.8, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/** Spawn police units for a screenshot state. */
export function forcePoliceChase(ps, world, player, graph, rng, count = 3) {
  ps.units.length = 0;
  for (let i = 0; i < count; i += 1) {
    const u = spawnUnit(world, player, graph, rng);
    // Place them closer for the screenshot
    const offset = 150 + i * 80;
    u.car.x = player.x - Math.cos(player.angle) * offset + (rng() - 0.5) * 60;
    u.car.y = player.y - Math.sin(player.angle) * offset + (rng() - 0.5) * 60;
    u.car.x = clamp(u.car.x, 100, world.w - 100);
    u.car.y = clamp(u.car.y, 100, CITY.seaY - 50);
    u.car.vx = Math.cos(player.angle) * 120;
    u.car.vy = Math.sin(player.angle) * 120;
    ps.units.push(u);
  }
}
