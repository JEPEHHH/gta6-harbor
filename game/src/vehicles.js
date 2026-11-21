// Vehicle entities: sedans, trucks, sports cars. Arcade driving physics with drift,
// damage model, skid marks, headlights, steering wheels, suspension bounce and shaded bodies.

import { CITY, PALETTE, CAMERA } from './config.js';
import { TAU, clamp, damp, dist, angleLerp, shade } from './util.js';
import { drawSoftDropShadow } from './lighting.js';

const TYPES = {
  sedan:  { name: 'Sedan',  w: 34, h: 17, mass: 1.0, power: 320, maxSpeed: 280, grip: 0.92, color: '#3b82b0', hp: 100 },
  sports: { name: 'Sports', w: 36, h: 16, mass: 0.85, power: 460, maxSpeed: 360, grip: 0.88, color: '#d93d32', hp: 80 },
  truck:  { name: 'Truck',  w: 44, h: 19, mass: 1.6, power: 240, maxSpeed: 200, grip: 0.95, color: '#7a8f62', hp: 160 },
  suv:    { name: 'SUV',    w: 40, h: 18, mass: 1.3, power: 300, maxSpeed: 240, grip: 0.93, color: '#2b3948', hp: 130 },
  taxi:   { name: 'Taxi',   w: 35, h: 17, mass: 1.0, power: 310, maxSpeed: 270, grip: 0.91, color: '#f0c436', hp: 100 },
  police: { name: 'Cruiser',w: 36, h: 17, mass: 1.1, power: 420, maxSpeed: 340, grip: 0.90, color: '#182436', hp: 140 },
};

export const VEHICLE_TYPES = TYPES;

let nextId = 1;

/** Create a vehicle entity at (x, y) facing angle. */
export function createVehicle(x, y, angle, typeName = 'sedan') {
  const t = TYPES[typeName] || TYPES.sedan;
  return {
    id: nextId++,
    type: typeName,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,              // signed scalar along the facing direction
    steer: 0,              // -1..1 current steering
    throttle: 0,           // 0..1
    brake: 0,              // 0..1
    handbrake: false,
    hp: t.hp,
    maxHp: t.hp,
    w: t.w, h: t.h,
    mass: t.mass,
    power: t.power,
    maxSpeed: t.maxSpeed,
    grip: t.grip,
    color: t.color,
    name: t.name,
    driver: null,           // null = parked, 'player', or a ped/police ref
    horn: 0,
    headlights: true,
    skidTimer: 0,
    engineRpm: 0,
    driftAngle: 0,          // visual drift offset for the tyres
    damaged: false,
    bouncePhase: 0,
  };
}

/** Arcade driving physics: throttle, brake, drift and collision with the world. */
export function updateVehicle(v, dt, world, particles, skidmarks) {
  const t = TYPES[v.type] || TYPES.sedan;
  const drag = 0.98;
  const brakePower = 600;
  const steerSpeed = 3.2;

  const fx = Math.cos(v.angle);
  const fy = Math.sin(v.angle);

  v.speed = v.vx * fx + v.vy * fy;

  const accel = v.throttle * t.power / t.mass;
  v.vx += fx * accel * dt;
  v.vy += fy * accel * dt;

  if (v.brake > 0) {
    const bs = v.brake * brakePower * dt / t.mass;
    const sp = Math.hypot(v.vx, v.vy);
    if (sp > 0.5) {
      v.vx -= (v.vx / sp) * Math.min(bs, sp);
      v.vy -= (v.vy / sp) * Math.min(bs, sp);
    }
  }

  const lx = -fy;
  const ly = fx;
  const latSpeed = v.vx * lx + v.vy * ly;
  const gripFactor = v.handbrake ? t.grip * 0.4 : t.grip;
  const latKill = latSpeed * gripFactor;
  v.vx -= lx * latKill * dt * 8;
  v.vy -= ly * latKill * dt * 8;

  v.driftAngle = Math.abs(latSpeed) > 30 ? latSpeed * 0.015 : 0;

  const speedFactor = clamp(Math.abs(v.speed) / 60, 0, 1);
  const turnRate = steerSpeed * speedFactor * (v.speed >= 0 ? 1 : -1);
  v.angle += v.steer * turnRate * dt;

  v.vx *= drag;
  v.vy *= drag;

  const curSpeed = Math.hypot(v.vx, v.vy);
  if (curSpeed > t.maxSpeed) {
    v.vx *= t.maxSpeed / curSpeed;
    v.vy *= t.maxSpeed / curSpeed;
  }

  v.speed = v.vx * fx + v.vy * fy;
  v.engineRpm = clamp(Math.abs(v.speed) / t.maxSpeed, 0, 1) * 0.7 + v.throttle * 0.3;
  v.bouncePhase = (v.bouncePhase || 0) + dt * (6 + Math.abs(v.speed) * 0.08);

  const halfW = t.w / 2;
  const nx = v.x + v.vx * dt;
  if (!world.isWater(nx, v.y) && nx > halfW && nx < world.w - halfW) {
    v.x = nx;
  } else {
    v.vx *= -0.3;
    v.hp -= Math.abs(v.speed) * 0.05;
  }
  const ny = v.y + v.vy * dt;
  if (!world.isWater(v.x, ny) && ny > halfW && ny < world.h - halfW) {
    v.y = ny;
  } else {
    v.vy *= -0.3;
    v.hp -= Math.abs(v.speed) * 0.05;
  }

  for (const b of world.buildings) {
    if (Math.abs(v.x - b.x - b.w / 2) < (halfW + b.w / 2) &&
        Math.abs(v.y - b.y - b.h / 2) < (t.h / 2 + b.h / 2)) {
      const overlapX = (halfW + b.w / 2) - Math.abs(v.x - b.x - b.w / 2);
      const overlapY = (t.h / 2 + b.h / 2) - Math.abs(v.y - b.y - b.h / 2);
      if (overlapX < overlapY) {
        v.x += overlapX * (v.x < b.x + b.w / 2 ? -1 : 1);
        v.vx *= -0.2;
      } else {
        v.y += overlapY * (v.y < b.y + b.h / 2 ? -1 : 1);
        v.vy *= -0.2;
      }
      const impactSpeed = Math.abs(v.speed);
      if (impactSpeed > 60) {
        v.hp -= impactSpeed * 0.08;
        v.damaged = v.hp < v.maxHp * 0.5;
        // Impact sparks
        for (let k = 0; k < 5; k += 1) {
          particles.push({
            kind: 'spark',
            x: v.x + fx * halfW * 0.7,
            y: v.y + fy * halfW * 0.7,
            vx: -v.vx * 0.4 + (Math.random() - 0.5) * 110,
            vy: -v.vy * 0.4 + (Math.random() - 0.5) * 110,
            age: 0, life: 0.25 + Math.random() * 0.15, size: 2.2,
            color: '255,215,120',
          });
        }
      }
    }
  }

  v.hp = clamp(v.hp, 0, v.maxHp);

  // Skid marks & billowing tyre smoke
  if ((v.handbrake || Math.abs(latSpeed) > 45) && Math.abs(v.speed) > 40) {
    v.skidTimer -= dt;
    if (v.skidTimer <= 0) {
      v.skidTimer = 0.028;
      particles.push({
        kind: 'smoke',
        x: v.x - fx * halfW * 0.65 + (Math.random() - 0.5) * 8,
        y: v.y - fy * halfW * 0.65 + (Math.random() - 0.5) * 8,
        vx: -v.vx * 0.03 + (Math.random() - 0.5) * 14,
        vy: -v.vy * 0.03 + (Math.random() - 0.5) * 14,
        age: 0, life: 1.15, size: 4 + Math.random() * 2.5,
        color: '205,205,212',
      });
      if (skidmarks) {
        const perpX = -fy * (v.h * 0.38);
        const perpY = fx * (v.h * 0.38);
        const rx = v.x - fx * halfW * 0.68;
        const ry = v.y - fy * halfW * 0.68;
        const prevX = rx - v.vx * 0.032;
        const prevY = ry - v.vy * 0.032;
        skidmarks.push({ x1: prevX + perpX, y1: prevY + perpY, x2: rx + perpX, y2: ry + perpY, alpha: 0.48, w: 3.1 });
        skidmarks.push({ x1: prevX - perpX, y1: prevY - perpY, x2: rx - perpX, y2: ry - perpY, alpha: 0.48, w: 3.1 });
        if (skidmarks.length > 260) skidmarks.splice(0, 2);
      }
    }
  }

  // Exhaust smoke puff when accelerating (darker if heavily damaged)
  if (v.throttle > 0.3 && Math.abs(v.speed) > 20) {
    if (Math.random() < (v.damaged ? 0.32 : 0.14)) {
      particles.push({
        kind: 'smoke',
        x: v.x - fx * halfW + (Math.random() - 0.5) * 4,
        y: v.y - fy * halfW + (Math.random() - 0.5) * 4,
        vx: -fx * 22 + (Math.random() - 0.5) * 10,
        vy: -fy * 22 + (Math.random() - 0.5) * 10,
        age: 0, life: 0.65, size: (v.damaged ? 3.5 : 2.2) + Math.random() * 1.5,
        color: v.damaged ? '72,74,80' : '175,178,186',
      });
    }
  }
}

/** Check if a point is near enough to enter a vehicle. */
export function canEnter(v, px, py) {
  return dist(v.x, v.y, px, py) < 50 && v.driver === null;
}

/** Vehicle-to-vehicle collision (simple AABB overlap push). */
export function vehicleCollision(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const minDist = (a.w + b.w) * 0.4;
  const d = Math.hypot(dx, dy);
  if (d < minDist && d > 0.01) {
    const push = (minDist - d) * 0.5;
    const nx = dx / d;
    const ny = dy / d;
    a.x += nx * push;
    a.y += ny * push;
    b.x -= nx * push;
    b.y -= ny * push;
    const relSpeed = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
    const bounce = 0.3;
    a.vx += nx * relSpeed * bounce / a.mass;
    a.vy += ny * relSpeed * bounce / a.mass;
    b.vx -= nx * relSpeed * bounce / b.mass;
    b.vy -= ny * relSpeed * bounce / b.mass;
    if (relSpeed > 80) {
      a.hp -= relSpeed * 0.06;
      b.hp -= relSpeed * 0.06;
    }
    return true;
  }
  return false;
}

function drawWheel(ctx, wx, wy, steerAngle) {
  ctx.save();
  ctx.translate(wx, wy);
  if (steerAngle) ctx.rotate(steerAngle);
  ctx.fillStyle = '#181a1f';
  ctx.beginPath();
  ctx.roundRect(-3.8, -1.8, 7.6, 3.6, 1.2);
  ctx.fill();
  ctx.fillStyle = '#5c626e';
  ctx.fillRect(-1.5, -1.1, 3, 2.2);
  ctx.restore();
}

/** Draw one vehicle with directional shadow, turning wheels, shaded glossy body,
 *  tinted glass, specular streak, suspension bounce, brake glow and night headlight cones. */
export function drawVehicle(ctx, v, night, sun, dusk = 0) {
  const hw = v.w * 0.5;
  const hh = v.h * 0.5;
  const speedRatio = clamp(Math.hypot(v.vx, v.vy) / 260, 0, 1);
  // Subtle suspension bounce scaled by road speed + engine rumble
  const bounce = (v.driver ? Math.sin((v.bouncePhase || 0) * 1.4 + v.id) * (0.28 + speedRatio * 0.48) : 0);
  const scaleBounce = 1 + bounce * 0.022;

  // 1. Directional sun shadow + soft ground contact shadow
  if (sun) {
    drawSoftDropShadow(ctx, v.x, v.y, hw * 1.06, hh * 1.08, sun, 13, v.angle);
  } else {
    ctx.save();
    ctx.translate(v.x + 3, v.y + 4);
    ctx.rotate(v.angle);
    ctx.fillStyle = 'rgba(14, 18, 28, 0.28)';
    ctx.beginPath();
    ctx.roundRect(-hw - 1, -hh - 1, v.w + 2, v.h + 2, 5);
    ctx.fill();
    ctx.restore();
  }

  // 2. Volumetric dual headlight cones at dusk & night (drawn beneath/ahead of hood)
  const lightPower = clamp(night * 1.1 + dusk * 0.65, 0, 1);
  if (v.headlights && lightPower > 0.16 && v.driver) {
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1]) {
      const ly = side * hh * 0.54;
      const beamLen = v.type === 'police' ? 128 : 112;
      const spread = 24;
      const grad = ctx.createLinearGradient(hw - 1, ly, hw + beamLen, ly);
      grad.addColorStop(0, `rgba(255, 240, 190, ${(0.42 * lightPower).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(255, 224, 152, ${(0.16 * lightPower).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255, 210, 120, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(hw - 1, ly - 2.2);
      ctx.lineTo(hw + beamLen, ly - spread);
      ctx.lineTo(hw + beamLen, ly + spread);
      ctx.lineTo(hw - 1, ly + 2.2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. Vehicle chassis & wheels
  ctx.save();
  ctx.translate(v.x, v.y + bounce * 0.45);
  ctx.rotate(v.angle);
  ctx.scale(scaleBounce, scaleBounce);

  // Visible wheels: front pair turns visibly with v.steer!
  const steerVis = clamp((v.steer || 0) * 0.42, -0.45, 0.45);
  drawWheel(ctx, hw * 0.54, -hh - 0.6, steerVis);
  drawWheel(ctx, hw * 0.54, hh + 0.6, steerVis);
  drawWheel(ctx, -hw * 0.54, -hh - 0.6, 0);
  drawWheel(ctx, -hw * 0.54, hh + 0.6, 0);

  // Lower dark bumper / skirt outline
  ctx.fillStyle = '#1d2129';
  ctx.beginPath();
  ctx.roundRect(-hw - 0.8, -hh - 0.5, v.w + 1.6, v.h + 1, 5);
  ctx.fill();

  // Shaded metallic body gradient (sunlit top-left to richer shaded lower flank)
  const baseColor = v.damaged ? '#696d74' : v.color;
  const bodyGrad = ctx.createLinearGradient(0, -hh, 0, hh);
  bodyGrad.addColorStop(0, shade(baseColor, 1.24));
  bodyGrad.addColorStop(0.42, baseColor);
  bodyGrad.addColorStop(1, shade(baseColor, 0.70));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, v.w, v.h, 4.5);
  ctx.fill();

  // Hood crease & crisp specular highlight ribbon along sunlit flank
  ctx.fillStyle = 'rgba(255, 252, 244, 0.28)';
  ctx.beginPath();
  ctx.roundRect(-hw + 3, -hh + 1.4, v.w - 6, 2.2, 1);
  ctx.fill();

  // Type-specific silhouettes & trim
  if (v.type === 'truck') {
    // Cargo flatbed behind cab with slatted ribs
    ctx.fillStyle = '#363b42';
    ctx.fillRect(-hw + 2.5, -hh + 2.2, v.w * 0.52, v.h - 4.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    for (let rx = -hw + 6; rx < 0; rx += 5) {
      ctx.beginPath();
      ctx.moveTo(rx, -hh + 2.5);
      ctx.lineTo(rx, hh - 2.5);
      ctx.stroke();
    }
    // Cab windshield
    ctx.fillStyle = '#182b3a';
    ctx.beginPath();
    ctx.roundRect(hw * 0.24, -hh * 0.72, hw * 0.34, v.h * 0.72, 2);
    ctx.fill();
  } else {
    // Tinted cabin greenhouse (windshield + rear glass + metallic roof cap)
    const cabinX = v.type === 'sports' ? -hw * 0.34 : -hw * 0.38;
    const cabinW = v.type === 'suv' ? v.w * 0.56 : v.w * 0.46;
    ctx.fillStyle = '#132331';
    ctx.beginPath();
    ctx.roundRect(cabinX, -hh * 0.74, cabinW, v.h * 0.74, 3);
    ctx.fill();

    // Windshield sky specular glint
    ctx.fillStyle = 'rgba(175, 224, 245, 0.36)';
    ctx.beginPath();
    ctx.moveTo(cabinX + cabinW - 5, -hh * 0.66);
    ctx.lineTo(cabinX + cabinW - 1, -hh * 0.66);
    ctx.lineTo(cabinX + cabinW - 3.5, hh * 0.66);
    ctx.lineTo(cabinX + cabinW - 7.5, hh * 0.66);
    ctx.closePath();
    ctx.fill();

    // Roof panel slightly lighter than body
    const roofX = cabinX + (v.type === 'suv' ? 4 : 5);
    const roofW = cabinW - (v.type === 'suv' ? 10 : 12);
    ctx.fillStyle = v.type === 'police' ? '#f2f4f8' : shade(baseColor, 1.14);
    ctx.beginPath();
    ctx.roundRect(roofX, -hh * 0.6, roofW, v.h * 0.6, 2);
    ctx.fill();

    // Sports car racing stripes & rear spoiler
    if (v.type === 'sports') {
      ctx.fillStyle = 'rgba(255, 246, 230, 0.68)';
      ctx.fillRect(cabinX + cabinW + 1, -1.8, hw - (cabinX + cabinW) - 3, 1.3);
      ctx.fillRect(cabinX + cabinW + 1, 0.6, hw - (cabinX + cabinW) - 3, 1.3);
      ctx.fillStyle = shade(baseColor, 0.55);
      ctx.fillRect(-hw + 1, -hh + 1.5, 3, v.h - 3);
    }

    // Taxi roof sign & checkerboard accent
    if (v.type === 'taxi') {
      ctx.fillStyle = '#1c1e22';
      ctx.fillRect(-3, -4, 6, 8);
      ctx.fillStyle = '#ffe278';
      ctx.fillRect(-2, -3, 4, 6);
    }

    // Police cruiser black-and-white doors, push bar & roof lightbar housing
    if (v.type === 'police') {
      ctx.fillStyle = '#f2f4f8';
      ctx.fillRect(-hw * 0.25, -hh + 0.5, v.w * 0.28, 1.6);
      ctx.fillRect(-hw * 0.25, hh - 2.1, v.w * 0.28, 1.6);
      // Lightbar bracket
      ctx.fillStyle = '#202630';
      ctx.fillRect(-3.5, -hh * 0.52, 4.5, v.h * 0.52);
      ctx.fillStyle = '#2d70ff';
      ctx.fillRect(-3, -hh * 0.48, 3.5, v.h * 0.22);
      ctx.fillStyle = '#ff3232';
      ctx.fillRect(-3, 0.4, 3.5, v.h * 0.22);
      // Front push bumper
      ctx.fillStyle = '#181c22';
      ctx.fillRect(hw, -hh * 0.45, 2.2, v.h * 0.45);
    }

    // Side mirrors
    ctx.fillStyle = shade(baseColor, 0.9);
    ctx.fillRect(cabinX + cabinW - 4, -hh - 1.4, 2.5, 1.8);
    ctx.fillRect(cabinX + cabinW - 4, hh - 0.4, 2.5, 1.8);
  }

  // Brake lights & tail lights (bright glowing red bloom when braking or reversing)
  const braking = v.brake > 0.05 || v.handbrake || v.speed < -5;
  ctx.fillStyle = braking ? '#ff2a2a' : '#8a1c1c';
  ctx.fillRect(-hw, -hh * 0.72, 2.8, 3.8);
  ctx.fillRect(-hw, hh * 0.72 - 3.8, 2.8, 3.8);
  if (braking || night > 0.25) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bAlpha = braking ? 0.55 : 0.24 * night;
    const bRad = braking ? 11 : 6;
    for (const ly of [-hh * 0.52, hh * 0.52]) {
      const tg = ctx.createRadialGradient(-hw, ly, 1, -hw - 2, ly, bRad);
      tg.addColorStop(0, `rgba(255, 50, 40, ${bAlpha.toFixed(3)})`);
      tg.addColorStop(1, 'rgba(255, 30, 20, 0)');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.arc(-hw - 1, ly, bRad, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Crisp headlight lenses
  ctx.fillStyle = (v.headlights && lightPower > 0.16) ? '#fff6d6' : '#ebe4c8';
  ctx.fillRect(hw - 2.6, -hh * 0.72, 2.6, 3.8);
  ctx.fillRect(hw - 2.6, hh * 0.72 - 3.8, 2.6, 3.8);

  // Body scratches if damaged
  if (v.hp < v.maxHp * 0.6) {
    ctx.strokeStyle = 'rgba(28, 30, 36, 0.58)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.55, -hh * 0.35);
    ctx.lineTo(hw * 0.2, hh * 0.18);
    ctx.moveTo(hw * 0.22, -hh * 0.45);
    ctx.lineTo(-hw * 0.35, hh * 0.32);
    ctx.stroke();
  }

  ctx.restore();
}

/** Spawn parked cars along streets. */
export function spawnParkedCars(world, rng, count = 40) {
  const cars = [];
  const typeNames = ['sedan', 'sports', 'truck', 'suv', 'taxi'];
  for (let n = 0; n < count; n += 1) {
    const useV = rng() < 0.5;
    let x, y, angle;
    if (useV) {
      const road = world.roadsV[Math.floor(rng() * world.roadsV.length)];
      y = 300 + rng() * 2600;
      x = road + CITY.roadHalf + 6;
      angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const road = world.roadsH[Math.floor(rng() * (world.roadsH.length - 1))];
      x = 300 + rng() * 4000;
      y = road + CITY.roadHalf + 6;
      angle = rng() < 0.5 ? 0 : Math.PI;
    }
    if (world.isWater(x, y)) continue;
    const typeName = typeNames[Math.floor(rng() * typeNames.length)];
    const car = createVehicle(x, y, angle, typeName);
    const colors = ['#3b82b0', '#d94538', '#78945e', '#2b3948', '#f0c436', '#a84b8e', '#dc8d3c', '#3d8f7d', '#c6cad0'];
    car.color = colors[Math.floor(rng() * colors.length)];
    cars.push(car);
  }
  return cars;
}
