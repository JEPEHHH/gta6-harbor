// Pedestrian AI: civilians walking on sidewalks, fleeing from gunfire and vehicles
// on the pavement. Rendered as shaded figures with walking animation & contact shadows.

import { CITY, PALETTE } from './config.js';
import { TAU, clamp, dist, shade } from './util.js';
import { drawSoftDropShadow } from './lighting.js';

const SHIRT_COLORS = ['#2ca8ad', '#c76d3b', '#6d44b8', '#3da65d', '#c43e47', '#d4aa3d', '#4f7ec9', '#cc568b'];
const HAIR_COLORS = ['#26303b', '#5a3a1a', '#8c6b47', '#18181c', '#b39066', '#40261b'];
const SKIN_TONES = ['#d69c72', '#c38458', '#e6b892', '#8f5a3c', '#b2764f'];

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
    skin: SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)],
    fleeTimer: 0,
  };
}

/** Spawn pedestrians near sidewalks around the player. */
export function spawnPeds(world, player, rng, existing, target = 20) {
  const peds = [];
  if (existing.length >= target) return peds;
  const needed = target - existing.length;
  for (let n = 0; n < needed; n += 1) {
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

    let threatX = 0;
    let threatY = 0;
    let threatened = false;

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
      const fleeAngle = Math.atan2(ped.y - threatY, ped.x - threatX);
      ped.vx = Math.cos(fleeAngle) * ped.speed * 2;
      ped.vy = Math.sin(fleeAngle) * ped.speed * 2;
      ped.angle = fleeAngle;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        ped.stateTimer = 3 + rng() * 5;
      }
    } else if (ped.state === 'walk') {
      const toX = ped.targetX - ped.x;
      const toY = ped.targetY - ped.y;
      const toD = Math.hypot(toX, toY);
      if (toD < 10 || ped.stateTimer <= 0) {
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

    for (const v of vehicles) {
      if (!v.driver) continue;
      const sp = Math.hypot(v.vx, v.vy);
      if (sp < 40) continue;
      if (dist(ped.x, ped.y, v.x, v.y) < 20) {
        ped.health -= sp * 0.3;
        ped.vx = v.vx * 0.3;
        ped.vy = v.vy * 0.3;
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

/** Draw a shaded pedestrian figure with walking swing and soft contact shadow. */
export function drawPed(ctx, ped, sun) {
  if (!ped.alive) return;

  const sp = Math.hypot(ped.vx, ped.vy);
  const moving = sp > 8;
  const stride = moving ? Math.sin(ped.walkPhase) * 3.8 : 0;
  const bob = moving ? Math.abs(Math.cos(ped.walkPhase)) * 0.8 : 0;
  const skin = ped.skin || '#c98d5f';

  // Soft contact + sun shadow on pavement
  if (sun) {
    drawSoftDropShadow(ctx, ped.x, ped.y + 2, 7.5, 4.5, sun, 9);
  } else {
    ctx.fillStyle = 'rgba(14, 18, 28, 0.26)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 2, ped.y + 3, 7.2, 4.2, 0, 0, TAU);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(ped.x, ped.y - bob);
  ctx.rotate(ped.angle + Math.PI / 2);

  // Walking legs / shoes
  ctx.fillStyle = '#252a36';
  ctx.beginPath();
  ctx.roundRect(-4.2, 0.5 + stride * 0.55, 3.2, 6.2, 1.4);
  ctx.roundRect(1.0, 0.5 - stride * 0.55, 3.2, 6.2, 1.4);
  ctx.fill();

  // Swinging arms (hands)
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(-6.4, -1.5 - stride * 0.55, 2.2, 0, TAU);
  ctx.arc(6.4, -1.5 + stride * 0.55, 2.2, 0, TAU);
  ctx.fill();

  // Shaded torso / shirt with directional shoulder highlight
  const shirtGrad = ctx.createLinearGradient(-5, -6, 5, 4);
  shirtGrad.addColorStop(0, shade(ped.shirt, 1.24));
  shirtGrad.addColorStop(0.55, ped.shirt);
  shirtGrad.addColorStop(1, shade(ped.shirt, 0.72));
  ctx.fillStyle = shirtGrad;
  ctx.beginPath();
  ctx.roundRect(-5.6, -6.2, 11.2, 10.2, 3.6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 20, 28, 0.35)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Head with subtle face lighting
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -5.2, 4.3, 0, TAU);
  ctx.fill();

  // Hair cap + highlight sheen
  ctx.fillStyle = ped.hair;
  ctx.beginPath();
  ctx.arc(0, -6.2, 4.1, Math.PI * 0.92, TAU + 0.25);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.arc(-1.2, -7.2, 1.4, 0, TAU);
  ctx.fill();

  ctx.restore();
}
