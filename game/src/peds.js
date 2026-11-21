// Pedestrian AI: civilians walking on sidewalks, fleeing from gunfire and vehicles
// on the pavement. One job: be a pedestrian.

import { CITY, PALETTE } from './config.js';
import { TAU, clamp, dist } from './util.js';

const SHIRT_COLORS = ['#37a7ad', '#ad6837', '#5a37ad', '#37ad5a', '#ad3737', '#c0a040', '#6080c0', '#c06080'];
const HAIR_COLORS = ['#2e3a46', '#5a3a1a', '#8a6a4a', '#1a1a1a', '#a08060'];

let pedId = 1;

/** Create a single pedestrian at (x, y). */
export function createPed(x, y, rng) {
  return {
    id: pedId++,
    x, y,
    vx: 0, vy: 0,
    angle: rng() * TAU,
    speed: 50 + rng() * 40,
    walkPhase: rng() * TAU,
    state: 'walk',           // walk, idle, flee
    stateTimer: 2 + rng() * 6,
    targetX: x,
    targetY: y,
    health: 40,
    alive: true,
    shirt: SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)],
    hair: HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)],
    fleeTimer: 0,
  };
}

/** Spawn pedestrians near sidewalks around the player. */
export function spawnPeds(world, player, rng, existing, target = 20) {
  const peds = [];
  if (existing.length >= target) return peds;
  const needed = target - existing.length;
  for (let n = 0; n < needed; n += 1) {
    // Pick a spot on a sidewalk near a road, offset from player
    const roadIdx = Math.floor(rng() * world.roadsV.length);
    const roadJdx = Math.floor(rng() * world.roadsH.length);
    const useV = rng() < 0.5;
    let x, y;
    if (useV) {
      x = world.roadsV[roadIdx] + (rng() < 0.5 ? 1 : -1) * (CITY.roadHalf + 10);
      y = world.roadsH[roadJdx] + (rng() - 0.5) * CITY.pitch * 0.8;
    } else {
      x = world.roadsV[roadIdx] + (rng() - 0.5) * CITY.pitch * 0.8;
      y = world.roadsH[roadJdx] + (rng() < 0.5 ? 1 : -1) * (CITY.roadHalf + 10);
    }
    if (world.isWater(x, y)) continue;
    const d = dist(x, y, player.x, player.y);
    if (d < 300 || d > 1800) continue;
    peds.push(createPed(x, y, rng));
  }
  return peds;
}

/** Update all pedestrians for one tick. */
export function updatePeds(peds, dt, world, player, vehicles, particles, rng) {
  for (const ped of peds) {
    if (!ped.alive) continue;

    // Check for threats: gunfire, speeding vehicles near them on the sidewalk
    let threatX = 0;
    let threatY = 0;
    let threatened = false;

    // Vehicles close and fast — flee
    for (const v of vehicles) {
      if (!v.driver) continue;
      const d = dist(ped.x, ped.y, v.x, v.y);
      const sp = Math.hypot(v.vx, v.vy);
      if (d < 80 && sp > 60) {
        threatened = true;
        threatX = v.x;
        threatY = v.y;
      }
    }

    // Player shooting nearby — flee
    if (player.shooting && dist(ped.x, ped.y, player.x, player.y) < 300) {
      threatened = true;
      threatX = player.x;
      threatY = player.y;
    }

    if (threatened && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeTimer = 5 + rng() * 3;
    }

    ped.stateTimer -= dt;

    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      // Run away from the threat
      const fleeAngle = Math.atan2(ped.y - threatY, ped.x - threatX);
      ped.vx = Math.cos(fleeAngle) * ped.speed * 2;
      ped.vy = Math.sin(fleeAngle) * ped.speed * 2;
      ped.angle = fleeAngle;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        ped.stateTimer = 3 + rng() * 5;
      }
    } else if (ped.state === 'walk') {
      // Walk toward target
      const toX = ped.targetX - ped.x;
      const toY = ped.targetY - ped.y;
      const toD = Math.hypot(toX, toY);
      if (toD < 10 || ped.stateTimer <= 0) {
        // Pick a new target on a sidewalk nearby
        if (rng() < 0.3) {
          ped.state = 'idle';
          ped.stateTimer = 2 + rng() * 4;
          ped.vx = 0;
          ped.vy = 0;
        } else {
          ped.targetX = ped.x + (rng() - 0.5) * 400;
          ped.targetY = ped.y + (rng() - 0.5) * 400;
          ped.targetX = clamp(ped.targetX, 100, world.w - 100);
          ped.targetY = clamp(ped.targetY, 100, CITY.seaY - 20);
          ped.stateTimer = 4 + rng() * 6;
        }
      } else {
        ped.vx = (toX / toD) * ped.speed;
        ped.vy = (toY / toD) * ped.speed;
        ped.angle = Math.atan2(ped.vy, ped.vx);
      }
    } else {
      // Idle
      ped.vx = 0;
      ped.vy = 0;
      if (ped.stateTimer <= 0) {
        ped.state = 'walk';
        ped.targetX = ped.x + (rng() - 0.5) * 300;
        ped.targetY = ped.y + (rng() - 0.5) * 300;
        ped.targetX = clamp(ped.targetX, 100, world.w - 100);
        ped.targetY = clamp(ped.targetY, 100, CITY.seaY - 20);
        ped.stateTimer = 4 + rng() * 6;
      }
    }

    // Move with collision
    const nx = ped.x + ped.vx * dt;
    const ny = ped.y + ped.vy * dt;
    if (!world.isWater(nx, ny) && nx > 20 && nx < world.w - 20 && ny > 20 && ny < world.h - 20) {
      ped.x = nx;
      ped.y = ny;
    } else {
      ped.vx = -ped.vx;
      ped.vy = -ped.vy;
    }

    ped.walkPhase += Math.hypot(ped.vx, ped.vy) * dt * 0.09;

    // Vehicle hit detection
    for (const v of vehicles) {
      if (!v.driver) continue;
      const sp = Math.hypot(v.vx, v.vy);
      if (sp < 40) continue;
      if (dist(ped.x, ped.y, v.x, v.y) < 20) {
        ped.health -= sp * 0.3;
        ped.vx = v.vx * 0.3;
        ped.vy = v.vy * 0.3;
        // Blood particles
        for (let k = 0; k < 4; k += 1) {
          particles.push({
            x: ped.x, y: ped.y,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            age: 0, life: 0.4, size: 2,
            color: '181,42,42',
          });
        }
      }
    }

    if (ped.health <= 0) ped.alive = false;
  }
}

/** Remove dead or far-away peds. */
export function cullPeds(peds, player, maxDist = 2000) {
  for (let i = peds.length - 1; i >= 0; i -= 1) {
    if (!peds[i].alive || dist(peds[i].x, peds[i].y, player.x, player.y) > maxDist) {
      peds.splice(i, 1);
    }
  }
}

/** Draw a single pedestrian. */
export function drawPed(ctx, ped) {
  if (!ped.alive) return;

  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle + Math.PI / 2);

  const moving = Math.hypot(ped.vx, ped.vy) > 10;
  const swing = moving ? Math.sin(ped.walkPhase) * 3.5 : 0;

  // Shadow
  ctx.fillStyle = 'rgba(20,24,32,0.2)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 7, 4, 0, 0, TAU);
  ctx.fill();

  // Legs
  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(-4, 1 + swing * 0.4, 3, 6);
  ctx.fillRect(1, 1 - swing * 0.4, 3, 6);

  // Body (shirt)
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.roundRect(-5, -6, 10, 10, 3);
  ctx.fill();

  // Head
  ctx.fillStyle = '#c98d5f';
  ctx.beginPath();
  ctx.arc(0, -5, 4, 0, TAU);
  ctx.fill();

  // Hair
  ctx.fillStyle = ped.hair;
  ctx.beginPath();
  ctx.arc(0, -6.2, 3.8, Math.PI, TAU);
  ctx.fill();

  ctx.restore();
}
