// Pedestrian AI and rendering: sidewalk walkers with a full walk cycle, pedestrians waiting
// at crossings, small chatting groups, joggers, and dog walkers with animated leashed dogs.
// Fleeing and collision gameplay rules remain untouched.

import { CITY } from './config.js';
import { TAU, clamp, dist, shade } from './util.js';
import { drawSoftDropShadow } from './lighting.js';

const SHIRT_COLORS = ['#2ca8ad', '#c76d3b', '#6d44b8', '#3da65d', '#c43e47', '#d4aa3d', '#4f7ec9', '#cc568b', '#e2d8c5', '#3d5873'];
const PANTS_COLORS = ['#252a36', '#38465a', '#4a4238', '#22262e', '#566474'];
const HAIR_COLORS = ['#26303b', '#5a3a1a', '#8c6b47', '#18181c', '#b39066', '#40261b', '#c6a674'];
const SKIN_TONES = ['#d69c72', '#c38458', '#e6b892', '#8f5a3c', '#b2764f'];
const DOG_COLORS = ['#a66b3c', '#d8b684', '#383430', '#c88a4a'];

let pedId = 1;

/** Create a single pedestrian at (x, y) with optional role: walker|waiting|group|jogger|dog_walker. */
export function createPed(x, y, rng, role = null) {
  const rRoll = rng();
  const resolvedRole = role || (
    rRoll < 0.08 ? 'jogger'
    : rRoll < 0.14 ? 'dog_walker'
    : rRoll < 0.26 ? 'waiting'
    : rRoll < 0.36 ? 'group'
    : 'walker'
  );
  const isJogger = resolvedRole === 'jogger';
  const isWaiting = resolvedRole === 'waiting' || resolvedRole === 'group';
  return {
    id: pedId++,
    role: resolvedRole,
    x, y,
    vx: 0, vy: 0,
    angle: rng() * TAU,
    speed: isJogger ? (102 + rng() * 22) : (46 + rng() * 28),
    walkPhase: rng() * TAU,
    state: isWaiting ? 'idle' : 'walk', // walk, idle, flee
    stateTimer: isWaiting ? (6 + rng() * 8) : (3 + rng() * 6),
    targetX: x,
    targetY: y,
    health: 40,
    alive: true,
    shirt: isJogger ? (rng() < 0.5 ? '#e65a3c' : '#26b8a8') : SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)],
    pants: isJogger ? '#222834' : PANTS_COLORS[Math.floor(rng() * PANTS_COLORS.length)],
    hair: HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)],
    skin: SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)],
    hat: rng() < 0.18 ? SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)] : null,
    bag: !isJogger && rng() < 0.34 ? (rng() < 0.5 ? 'backpack' : 'tote') : null,
    dogColor: resolvedRole === 'dog_walker' ? DOG_COLORS[Math.floor(rng() * DOG_COLORS.length)] : null,
    fleeTimer: 0,
  };
}

/** Pick a sidewalk coordinate near roads so pedestrians naturally inhabit pavements & crossings. */
function pickSidewalkPoint(world, rng) {
  const roadIdx = Math.floor(rng() * world.roadsV.length);
  const roadJdx = Math.floor(rng() * world.roadsH.length);
  const useV = rng() < 0.5;
  const side = rng() < 0.5 ? 1 : -1;
  const walkOff = CITY.roadHalf + 8 + rng() * 5;
  let x;
  let y;
  let angle;
  if (useV) {
    x = world.roadsV[roadIdx] + side * walkOff;
    y = world.roadsH[roadJdx] + (rng() - 0.5) * CITY.pitch * 0.78;
    angle = rng() < 0.5 ? Math.PI * 0.5 : -Math.PI * 0.5;
  } else {
    x = world.roadsV[roadIdx] + (rng() - 0.5) * CITY.pitch * 0.78;
    y = world.roadsH[roadJdx] + side * walkOff;
    angle = rng() < 0.5 ? 0 : Math.PI;
  }
  return { x, y, angle };
}

/** Spawn lively pedestrians along sidewalks, crossings, and small groups around the player. */
export function spawnPeds(world, player, rng, existing, target = 48) {
  const peds = [];
  if (existing.length >= target) return peds;
  const needed = target - existing.length;
  for (let n = 0; n < needed; n += 1) {
    const pt = pickSidewalkPoint(world, rng);
    if (world.isWater(pt.x, pt.y)) continue;
    const d = dist(pt.x, pt.y, player.x, player.y);
    if (d < 220 || d > 1750) continue;

    const p = createPed(pt.x, pt.y, rng);
    p.angle = pt.angle;
    p.targetX = clamp(p.x + Math.cos(pt.angle) * (180 + rng() * 200), 100, world.w - 100);
    p.targetY = clamp(p.y + Math.sin(pt.angle) * (180 + rng() * 200), 100, CITY.seaY - 20);
    peds.push(p);

    // Small chatting group: spawn 1-2 companions facing each other on the sidewalk
    if (p.role === 'group' && peds.length < needed - 1) {
      const mate = createPed(pt.x + 13, pt.y + 4, rng, 'group');
      mate.angle = Math.PI + 0.15;
      p.angle = 0.15;
      peds.push(mate);
    }
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
      ped.vx = Math.cos(fleeAngle) * ped.speed * 1.9;
      ped.vy = Math.sin(fleeAngle) * ped.speed * 1.9;
      ped.angle = fleeAngle;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        ped.stateTimer = 3 + rng() * 5;
      }
    } else if (ped.state === 'walk') {
      const toX = ped.targetX - ped.x;
      const toY = ped.targetY - ped.y;
      const toD = Math.hypot(toX, toY);
      if (toD < 12 || ped.stateTimer <= 0) {
        if (ped.role !== 'jogger' && rng() < 0.28) {
          ped.state = 'idle';
          ped.stateTimer = 2 + rng() * 4;
          ped.vx = 0;
          ped.vy = 0;
        } else {
          // Keep walking mostly axis-aligned along sidewalks
          const turn = rng() < 0.7 ? 0 : (rng() < 0.5 ? Math.PI * 0.5 : -Math.PI * 0.5);
          const dir = ped.angle + turn;
          ped.targetX = clamp(ped.x + Math.cos(dir) * (180 + rng() * 220), 100, world.w - 100);
          ped.targetY = clamp(ped.y + Math.sin(dir) * (180 + rng() * 220), 100, CITY.seaY - 20);
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
        if (ped.role === 'group' && rng() < 0.65) {
          ped.stateTimer = 5 + rng() * 6;
        } else {
          ped.state = 'walk';
          ped.targetX = clamp(ped.x + Math.cos(ped.angle) * (160 + rng() * 180), 100, world.w - 100);
          ped.targetY = clamp(ped.y + Math.sin(ped.angle) * (160 + rng() * 180), 100, CITY.seaY - 20);
          ped.stateTimer = 4 + rng() * 6;
        }
      }
    }

    const nx = ped.x + ped.vx * dt;
    const ny = ped.y + ped.vy * dt;
    if (!world.isWater(nx, ny) && nx > 20 && nx < world.w - 20 && ny > 20 && ny < world.h - 20) {
      ped.x = nx;
      ped.y = ny;
    } else {
      ped.angle += Math.PI;
      ped.vx = -ped.vx;
      ped.vy = -ped.vy;
    }

    ped.walkPhase += Math.hypot(ped.vx, ped.vy) * dt * (ped.role === 'jogger' ? 0.13 : 0.105);

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

/** Draw an animated leashed dog trotting ahead of a dog_walker pedestrian. */
function drawLeashedDog(ctx, ped, sun, t) {
  const fx = Math.cos(ped.angle);
  const fy = Math.sin(ped.angle);
  const lx = -fy;
  const ly = fx;
  const sway = Math.sin(ped.walkPhase * 1.4 + t * 2) * 2.2;
  const dogX = ped.x + fx * 18 + lx * (5 + sway * 0.4);
  const dogY = ped.y + fy * 18 + ly * (5 + sway * 0.4);
  const handX = ped.x + fx * 3 + lx * 5.5;
  const handY = ped.y + fy * 3 + ly * 5.5;

  // Dog contact + sun shadow
  if (sun) drawSoftDropShadow(ctx, dogX, dogY + 1.5, 5.2, 3.0, sun, 5, ped.angle);

  // Leash connecting ped hand to dog collar
  ctx.save();
  ctx.strokeStyle = '#d44c3c';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(handX, handY - 2);
  ctx.quadraticCurveTo((handX + dogX) * 0.5, (handY + dogY) * 0.5 + 2.5, dogX - fx * 2, dogY - fy * 2);
  ctx.stroke();

  // Dog body, head, ears & wagging tail with crisp dark outline
  ctx.translate(Math.round(dogX), Math.round(dogY));
  ctx.rotate(ped.angle);
  const coat = ped.dogColor || '#b57842';
  const tailWag = Math.sin(t * 14 + ped.id) * 2.4;
  // Tail
  ctx.strokeStyle = '#090d14';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-4.5, 0);
  ctx.lineTo(-8.2, tailWag);
  ctx.stroke();
  ctx.strokeStyle = coat;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Torso
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.roundRect(-5, -2.5, 9.2, 5.0, 2.2);
  ctx.fill();
  ctx.strokeStyle = '#090d14';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  // Red collar
  ctx.fillStyle = '#e03c32';
  ctx.fillRect(2.2, -2.4, 1.5, 4.8);
  // Head & snout
  ctx.fillStyle = shade(coat, 1.12);
  ctx.beginPath();
  ctx.arc(5.2, 0, 2.7, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#090d14';
  ctx.lineWidth = 1.05;
  ctx.stroke();
  // Floppy ears
  ctx.fillStyle = shade(coat, 0.70);
  ctx.fillRect(3.6, -3.2, 2.2, 1.6);
  ctx.fillRect(3.6, 1.6, 2.2, 1.6);
  ctx.restore();
}

/** Draw a crisp top-down pedestrian with grounded contact shadow, clear shoulder/head/hair read,
 *  and dark outline so figures never blur into the asphalt or sidewalks. */
export function drawPed(ctx, ped, sun, t = 0) {
  if (!ped.alive) return;

  if (ped.role === 'dog_walker') {
    drawLeashedDog(ctx, ped, sun, t);
  }

  const sp = Math.hypot(ped.vx, ped.vy);
  const moving = sp > 6;
  const isJogger = ped.role === 'jogger';
  const strideAmp = isJogger ? 5.2 : 3.8;
  const stride = moving ? Math.sin(ped.walkPhase) * strideAmp : 0;
  const bob = moving ? Math.abs(Math.cos(ped.walkPhase)) * (isJogger ? 1.4 : 0.8) : 0;
  const twist = moving ? Math.sin(ped.walkPhase) * (isJogger ? 0.12 : 0.07) : 0;
  const skin = ped.skin || '#c98d5f';
  const px = Math.round(ped.x);
  const py = Math.round(ped.y);
  const outline = '#090d14';

  // Soft contact + directional sun shadow on pavement (preserved)
  if (sun) {
    drawSoftDropShadow(ctx, px, py + 2, 7.6, 4.6, sun, 11);
  } else {
    ctx.fillStyle = 'rgba(14, 18, 28, 0.30)';
    ctx.beginPath();
    ctx.ellipse(px + 2, py + 3, 7.2, 4.2, 0, 0, TAU);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(px, Math.round(py - bob));
  ctx.rotate(ped.angle + Math.PI / 2);

  // 1. Stepping legs & shoes underneath shoulders (with crisp dark outline)
  const leftFootY = -0.5 + stride * 0.85;
  const rightFootY = -0.5 - stride * 0.85;
  ctx.fillStyle = ped.pants || '#252a36';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-4.6, leftFootY, 3.4, 5.8, 1.4);
  ctx.roundRect(1.2, rightFootY, 3.4, 5.8, 1.4);
  ctx.fill();
  ctx.stroke();

  // Shoes (bright sneakers on joggers)
  ctx.fillStyle = isJogger ? '#f4f6fa' : '#1b1e25';
  ctx.beginPath();
  ctx.roundRect(-4.6, leftFootY + (stride > 0 ? 3.8 : 0), 3.4, 2.3, 1);
  ctx.roundRect(1.2, rightFootY + (stride < 0 ? 3.8 : 0), 3.4, 2.3, 1);
  ctx.fill();
  ctx.stroke();

  // Subtle torso shoulder twist while striding
  ctx.rotate(twist);

  // 2. Swinging arms & hands with dark outline
  const armSwing = stride * (isJogger ? 0.85 : 0.65);
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(-5.2, -0.2); ctx.lineTo(-6.8, -0.6 - armSwing);
  ctx.moveTo(5.2, -0.2); ctx.lineTo(6.8, -0.6 + armSwing);
  ctx.stroke();
  ctx.strokeStyle = isJogger ? skin : shade(ped.shirt, 0.92);
  ctx.lineWidth = 2.4;
  ctx.stroke();

  ctx.fillStyle = skin;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(-6.8, -0.6 - armSwing, 1.9, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(6.8, -0.6 + armSwing, 1.9, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // Optional tote bag carried on right side
  if (ped.bag === 'tote') {
    ctx.fillStyle = '#cf9e5c';
    ctx.fillRect(6.4, -2.0 + armSwing, 3.4, 5.2);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.0;
    ctx.strokeRect(6.4, -2.0 + armSwing, 3.4, 5.2);
  }

  // Optional backpack worn cleanly behind shoulders
  if (ped.bag === 'backpack') {
    ctx.fillStyle = '#3d4f62';
    ctx.beginPath();
    ctx.roundRect(-4.4, 1.8, 8.8, 4.4, 1.8);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.15;
    ctx.stroke();
  }

  // 3. Clear top-down shoulder silhouette with sunlit ridge highlight & dark outline
  const shirtGrad = ctx.createLinearGradient(-6, -4, 6, 4);
  shirtGrad.addColorStop(0, shade(ped.shirt, 1.32));
  shirtGrad.addColorStop(0.5, ped.shirt);
  shirtGrad.addColorStop(1, shade(ped.shirt, 0.74));
  ctx.fillStyle = shirtGrad;
  ctx.beginPath();
  ctx.roundRect(-6.4, -3.8, 12.8, 7.6, 3.6);
  ctx.fill();

  // Subtle sunlit shoulder highlight bar separating shoulders cleanly from ground & head
  ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.beginPath();
  ctx.roundRect(-5.0, -3.0, 10.0, 2.0, 1.0);
  ctx.fill();

  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-6.4, -3.8, 12.8, 7.6, 3.6);
  ctx.stroke();

  // 4. Distinct centered-forward head + face rim + hair/hat read with crisp dark outline
  const headY = -1.4;
  const headR = 4.3;
  // Base head (warm skin showing cleanly along the forward-facing brow)
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, TAU);
  ctx.fill();

  // Hair cap or baseball cap covering crown & back of head
  if (ped.hat) {
    // Cap brim facing forward (-y)
    ctx.fillStyle = shade(ped.hat, 0.80);
    ctx.beginPath();
    ctx.roundRect(-3.2, headY - headR - 2.2, 6.4, 2.8, 1.2);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    // Cap dome
    ctx.fillStyle = ped.hat;
    ctx.beginPath();
    ctx.arc(0, headY + 0.3, headR, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.arc(-1.1, headY - 0.8, 1.4, 0, TAU);
    ctx.fill();
  } else {
    // Distinct hair mass leaving a clear forward skin brow read (-y) so facing direction & head read cleanly
    ctx.fillStyle = ped.hair;
    ctx.beginPath();
    ctx.arc(0, headY + 0.9, headR - 0.15, -Math.PI * 0.12, Math.PI * 1.12);
    ctx.closePath();
    ctx.fill();
    // Crown volume & crisp hair highlight crescent so hair reads clearly even on dark hair tones
    ctx.fillStyle = ped.hair;
    ctx.beginPath();
    ctx.ellipse(0, headY + 1.1, headR * 0.90, headR * 0.72, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.beginPath();
    ctx.arc(-1.2, headY + 0.4, 1.45, 0, TAU);
    ctx.fill();
    if (isJogger) {
      // Bright athletic headband across forehead
      ctx.fillStyle = '#f6f8fa';
      ctx.fillRect(-3.7, headY - 2.4, 7.4, 1.6);
    }
  }

  // Crisp dark outline around head silhouette so head separates from shoulders & asphalt
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.35;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, TAU);
  ctx.stroke();

  ctx.restore();
}
