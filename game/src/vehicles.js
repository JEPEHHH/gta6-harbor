// Vehicle entities: sedans, sports cars, SUVs, taxis, vans, pickups, trucks, buses and police
// cruisers. Arcade driving physics with drift, damage model, skid marks, headlights, steering
// tyres, cornering body roll, brake lights, blinking indicators and grounded contact shadows.

import { CITY } from './config.js';
import { TAU, clamp, damp, dist, shade } from './util.js';
import { drawVehicleShadow } from './lighting.js';

const TYPES = {
  sedan:  { name: 'Sedan',  w: 34, h: 17, mass: 1.0, power: 320, maxSpeed: 280, grip: 0.92, color: '#3b82b0', hp: 100 },
  sports: { name: 'Sports', w: 36, h: 16, mass: 0.85, power: 460, maxSpeed: 360, grip: 0.88, color: '#d93d32', hp: 80 },
  truck:  { name: 'Truck',  w: 46, h: 20, mass: 1.6, power: 240, maxSpeed: 200, grip: 0.95, color: '#7a8f62', hp: 160 },
  suv:    { name: 'SUV',    w: 40, h: 18, mass: 1.3, power: 300, maxSpeed: 240, grip: 0.93, color: '#2b3948', hp: 130 },
  taxi:   { name: 'Taxi',   w: 35, h: 17, mass: 1.0, power: 310, maxSpeed: 270, grip: 0.91, color: '#f0c436', hp: 100 },
  van:    { name: 'Van',    w: 41, h: 19, mass: 1.35, power: 270, maxSpeed: 225, grip: 0.94, color: '#dde3e8', hp: 135 },
  pickup: { name: 'Pickup', w: 42, h: 18, mass: 1.25, power: 300, maxSpeed: 250, grip: 0.92, color: '#b8503c', hp: 140 },
  bus:    { name: 'Bus',    w: 58, h: 21, mass: 2.2, power: 220, maxSpeed: 180, grip: 0.96, color: '#e4ecef', hp: 220 },
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
    bodyRoll: 0,            // -1..1 subtle visual body roll when cornering
    blinker: 0,             // -1 left, 0 off, 1 right turn indicator
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

  // Visual cornering body roll (purely cosmetic, driven by steering + speed + lateral slip)
  const speedRatio = clamp(Math.abs(v.speed) / 220, 0, 1);
  const targetRoll = clamp(-v.steer * speedRatio * 0.95 - latSpeed * 0.008, -1, 1);
  v.bodyRoll = damp(v.bodyRoll || 0, targetRoll, 9, dt);

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

  // Exhaust smoke puff when accelerating
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

function drawWheel(ctx, wx, wy, steerAngle, heavy = false) {
  ctx.save();
  ctx.translate(wx, wy);
  if (steerAngle) ctx.rotate(steerAngle);
  const wl = heavy ? 8.6 : 7.8;
  const wt = heavy ? 4.2 : 3.8;
  ctx.fillStyle = '#14161b';
  ctx.beginPath();
  ctx.roundRect(-wl * 0.5, -wt * 0.5, wl, wt, 1.3);
  ctx.fill();
  ctx.fillStyle = '#5c6370';
  ctx.fillRect(-1.8, -wt * 0.32, 3.6, wt * 0.64);
  ctx.restore();
}

/** Draw one vehicle with grounded contact shadow, steering tyres, subtle cornering body roll,
 *  shaded glossy body, brake lights, blinking indicators and night headlight cones. */
export function drawVehicle(ctx, v, night, sun, dusk = 0, t = 0) {
  const hw = v.w * 0.5;
  const hh = v.h * 0.5;
  const speedRatio = clamp(Math.hypot(v.vx, v.vy) / 260, 0, 1);
  const bounce = (v.driver ? Math.sin((v.bouncePhase || 0) * 1.4 + v.id) * (0.28 + speedRatio * 0.45) : 0);
  const scaleBounce = 1 + bounce * 0.020;
  const roll = clamp(v.bodyRoll || 0, -1, 1);
  const rollBodyY = roll * 1.4;
  const rollRoofY = roll * 2.4;
  const lift = v.type === 'bus' ? 22 : v.type === 'truck' ? 20 : v.type === 'van' ? 17 : 13;

  // 1. Grounded contact shadow + directional sun shadow following the chassis
  drawVehicleShadow(ctx, v.x, v.y, v.w, v.h, v.angle, sun, lift);

  // 2. Volumetric dual headlight cones at dusk & night (drawn beneath/ahead of hood)
  const lightPower = clamp(night * 1.1 + dusk * 0.68, 0, 1);
  if (v.headlights && lightPower > 0.16 && (v.driver || v._headlightsOn)) {
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1]) {
      const ly = side * hh * 0.56;
      const beamLen = v.type === 'police' ? 132 : v.type === 'bus' ? 124 : 112;
      const spread = 24;
      const grad = ctx.createLinearGradient(hw - 1, ly, hw + beamLen, ly);
      grad.addColorStop(0, `rgba(255, 240, 190, ${(0.44 * lightPower).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(255, 224, 152, ${(0.17 * lightPower).toFixed(3)})`);
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

  // 3. Wheels (planted on the road, front pair steers visibly)
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);

  const steerVis = clamp((v.steer || 0) * 0.48, -0.5, 0.5);
  const heavy = v.type === 'bus' || v.type === 'truck';
  const frontAxle = v.type === 'bus' ? hw * 0.64 : hw * 0.56;
  const rearAxle = v.type === 'bus' ? -hw * 0.60 : -hw * 0.54;
  drawWheel(ctx, frontAxle, -hh - 0.8, steerVis, heavy);
  drawWheel(ctx, frontAxle, hh + 0.8, steerVis, heavy);
  drawWheel(ctx, rearAxle, -hh - 0.8, 0, heavy);
  drawWheel(ctx, rearAxle, hh + 0.8, 0, heavy);

  // 4. Chassis body (shifts subtly with cornering body roll + suspension bounce)
  ctx.translate(0, rollBodyY + bounce * 0.35);
  ctx.scale(scaleBounce, scaleBounce);

  // Lower dark bumper / skirt outline
  ctx.fillStyle = '#1b1f27';
  ctx.beginPath();
  ctx.roundRect(-hw - 0.8, -hh - 0.5, v.w + 1.6, v.h + 1, v.type === 'bus' ? 3.5 : 5);
  ctx.fill();

  // Shaded metallic body gradient (subtle highlight shift with body roll)
  const baseColor = v.damaged ? '#696d74' : v.color;
  const bodyGrad = ctx.createLinearGradient(0, -hh, 0, hh);
  bodyGrad.addColorStop(0, shade(baseColor, 1.24 - roll * 0.08));
  bodyGrad.addColorStop(0.45, baseColor);
  bodyGrad.addColorStop(1, shade(baseColor, 0.70 + roll * 0.08));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, v.w, v.h, v.type === 'bus' ? 3 : 4.5);
  ctx.fill();

  // Crisp sunlit flank specular ribbon
  ctx.fillStyle = 'rgba(255, 252, 244, 0.28)';
  ctx.beginPath();
  ctx.roundRect(-hw + 3, -hh + 1.4, v.w - 6, 2.0, 1);
  ctx.fill();

  // 5. Type-specific upper silhouettes (roof shifts slightly more with body roll for 2.5D lean)
  if (v.type === 'bus') {
    // Coastal teal & amber transit livery stripes along flanks
    ctx.fillStyle = '#1f8f96';
    ctx.fillRect(-hw + 2, -hh + 1.2, v.w - 4, 2.6);
    ctx.fillRect(-hw + 2, hh - 3.8, v.w - 4, 2.6);
    ctx.fillStyle = '#f0a63b';
    ctx.fillRect(-hw + 4, -hh + 3.8, v.w - 10, 1.1);
    ctx.fillRect(-hw + 4, hh - 4.9, v.w - 10, 1.1);

    // Panoramic front windshield & rear glass
    ctx.fillStyle = '#152736';
    ctx.beginPath();
    ctx.roundRect(hw - 7.5, -hh + 1.8, 6.2, v.h - 3.6, 1.8);
    ctx.fill();
    ctx.fillStyle = 'rgba(175, 224, 245, 0.36)';
    ctx.fillRect(hw - 4.2, -hh + 2.5, 2.0, v.h - 5);

    // Elevated white bus roof with subtle body-roll shift & twin rooftop AC pods
    ctx.save();
    ctx.translate(0, rollRoofY * 0.45);
    ctx.fillStyle = '#f2f6f8';
    ctx.beginPath();
    ctx.roundRect(-hw + 3.5, -hh + 3.2, v.w - 11.5, v.h - 6.4, 2.2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 52, 66, 0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Dual rooftop HVAC pods + emergency hatch
    ctx.fillStyle = '#c8d2d8';
    ctx.fillRect(-10, -5, 11, 10);
    ctx.fillRect(6, -5, 10, 10);
    ctx.fillStyle = '#7c8994';
    ctx.fillRect(-8, -3.2, 7, 6.4);
    ctx.fillRect(8, -3.2, 6, 6.4);
    ctx.fillStyle = '#ffaa3b';
    ctx.fillRect(hw - 9.5, -3.5, 2.2, 7); // destination board header
    ctx.restore();
  } else if (v.type === 'van') {
    // Front windshield
    ctx.fillStyle = '#152736';
    ctx.beginPath();
    ctx.roundRect(hw * 0.26, -hh * 0.78, hw * 0.50, v.h * 0.78, 2.2);
    ctx.fill();
    ctx.fillStyle = 'rgba(175, 224, 245, 0.36)';
    ctx.fillRect(hw * 0.56, -hh * 0.70, 2.2, v.h * 0.70);

    // Extended boxy van roof with roof rack bars & rear door seam
    ctx.save();
    ctx.translate(0, rollRoofY * 0.45);
    ctx.fillStyle = shade(baseColor, 1.12);
    ctx.beginPath();
    ctx.roundRect(-hw + 2.5, -hh * 0.78, v.w * 0.68, v.h * 0.78, 2.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 38, 48, 0.35)';
    ctx.lineWidth = 1.1;
    // Utility roof rack rails
    ctx.beginPath();
    ctx.moveTo(-hw + 5, -hh * 0.56); ctx.lineTo(hw * 0.22, -hh * 0.56);
    ctx.moveTo(-hw + 5, hh * 0.56); ctx.lineTo(hw * 0.22, hh * 0.56);
    ctx.moveTo(-hw + 8, -hh * 0.56); ctx.lineTo(-hw + 8, hh * 0.56);
    ctx.moveTo(-2, -hh * 0.56); ctx.lineTo(-2, hh * 0.56);
    ctx.stroke();
    // Rear double-door split line
    ctx.beginPath();
    ctx.moveTo(-hw, 0); ctx.lineTo(-hw + 3.2, 0);
    ctx.stroke();
    ctx.restore();
  } else if (v.type === 'pickup') {
    // Open recessed dark pickup cargo bed with ribbed liner & occasional cargo box
    ctx.fillStyle = '#2d323a';
    ctx.beginPath();
    ctx.roundRect(-hw + 2.2, -hh + 2.2, v.w * 0.44, v.h - 4.4, 1.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 0.9;
    for (let rx = -hw + 5; rx < -hw + v.w * 0.44; rx += 4.2) {
      ctx.beginPath();
      ctx.moveTo(rx, -hh + 2.8); ctx.lineTo(rx, hh - 2.8);
      ctx.stroke();
    }
    // Toolbox / cargo crate in bed
    ctx.fillStyle = v.id % 2 === 0 ? '#a88050' : '#bfc6cc';
    ctx.fillRect(-hw + v.w * 0.32, -hh + 3.2, 5.5, v.h - 6.4);

    // Pickup cab greenhouse & roof
    ctx.fillStyle = '#152736';
    ctx.beginPath();
    ctx.roundRect(-hw + v.w * 0.48, -hh * 0.76, v.w * 0.30, v.h * 0.76, 2.2);
    ctx.fill();
    ctx.fillStyle = 'rgba(175, 224, 245, 0.36)';
    ctx.fillRect(hw * 0.40, -hh * 0.68, 2.2, v.h * 0.68);
    ctx.save();
    ctx.translate(0, rollRoofY * 0.45);
    ctx.fillStyle = shade(baseColor, 1.15);
    ctx.beginPath();
    ctx.roundRect(-hw + v.w * 0.51, -hh * 0.64, v.w * 0.16, v.h * 0.64, 1.8);
    ctx.fill();
    ctx.restore();
  } else if (v.type === 'truck') {
    // Box/flatbed cargo rear with ribbed panels
    ctx.save();
    ctx.translate(0, rollRoofY * 0.45);
    ctx.fillStyle = '#d6d4cc';
    ctx.beginPath();
    ctx.roundRect(-hw + 2.0, -hh + 1.5, v.w * 0.62, v.h - 3.0, 1.8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(42, 48, 56, 0.25)';
    ctx.lineWidth = 1;
    for (let rx = -hw + 7; rx < -hw + v.w * 0.62; rx += 6) {
      ctx.beginPath();
      ctx.moveTo(rx, -hh + 2); ctx.lineTo(rx, hh - 2);
      ctx.stroke();
    }
    ctx.restore();
    // Cab windshield
    ctx.fillStyle = '#182b3a';
    ctx.beginPath();
    ctx.roundRect(hw * 0.34, -hh * 0.74, hw * 0.38, v.h * 0.74, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(175, 224, 245, 0.34)';
    ctx.fillRect(hw * 0.58, -hh * 0.66, 2.2, v.h * 0.66);
  } else {
    // Sedan / Sports / SUV / Taxi / Police greenhouse & rolling roof cap
    const cabinX = v.type === 'sports' ? -hw * 0.34 : -hw * 0.38;
    const cabinW = v.type === 'suv' ? v.w * 0.56 : v.w * 0.46;
    ctx.fillStyle = '#132331';
    ctx.beginPath();
    ctx.roundRect(cabinX, -hh * 0.74, cabinW, v.h * 0.74, 3);
    ctx.fill();

    // Windshield sky specular glint
    ctx.fillStyle = 'rgba(175, 224, 245, 0.38)';
    ctx.beginPath();
    ctx.moveTo(cabinX + cabinW - 5, -hh * 0.66);
    ctx.lineTo(cabinX + cabinW - 1, -hh * 0.66);
    ctx.lineTo(cabinX + cabinW - 3.5, hh * 0.66);
    ctx.lineTo(cabinX + cabinW - 7.5, hh * 0.66);
    ctx.closePath();
    ctx.fill();

    // Roof panel with subtle cornering lean
    ctx.save();
    ctx.translate(0, rollRoofY * 0.5);
    const roofX = cabinX + (v.type === 'suv' ? 4 : 5);
    const roofW = cabinW - (v.type === 'suv' ? 10 : 12);
    ctx.fillStyle = v.type === 'police' ? '#f2f4f8' : shade(baseColor, 1.15);
    ctx.beginPath();
    ctx.roundRect(roofX, -hh * 0.6, roofW, v.h * 0.6, 2);
    ctx.fill();

    if (v.type === 'taxi') {
      ctx.fillStyle = '#1c1e22';
      ctx.fillRect(-3.2, -4.2, 6.4, 8.4);
      ctx.fillStyle = '#ffe278';
      ctx.fillRect(-2.2, -3.2, 4.4, 6.4);
    }

    if (v.type === 'police') {
      ctx.fillStyle = '#202630';
      ctx.fillRect(-3.5, -hh * 0.52, 4.5, v.h * 0.52);
      ctx.fillStyle = '#2d70ff';
      ctx.fillRect(-3, -hh * 0.48, 3.5, v.h * 0.22);
      ctx.fillStyle = '#ff3232';
      ctx.fillRect(-3, 0.4, 3.5, v.h * 0.22);
    }
    ctx.restore();

    if (v.type === 'sports') {
      ctx.fillStyle = 'rgba(255, 246, 230, 0.72)';
      ctx.fillRect(cabinX + cabinW + 1, -1.8, hw - (cabinX + cabinW) - 3, 1.3);
      ctx.fillRect(cabinX + cabinW + 1, 0.6, hw - (cabinX + cabinW) - 3, 1.3);
      ctx.fillStyle = shade(baseColor, 0.55);
      ctx.fillRect(-hw + 1, -hh + 1.5, 3, v.h - 3);
    }

    if (v.type === 'taxi') {
      // Iconic black-and-white checker dashes along flanks
      for (let cx = -hw + 5; cx < hw - 6; cx += 4) {
        ctx.fillStyle = (Math.floor(cx / 4) % 2 === 0) ? '#1a1c20' : '#f4f0e4';
        ctx.fillRect(cx, -hh + 0.6, 2.2, 1.3);
        ctx.fillRect(cx, hh - 1.9, 2.2, 1.3);
      }
    }

    if (v.type === 'police') {
      ctx.fillStyle = '#f2f4f8';
      ctx.fillRect(-hw * 0.25, -hh + 0.5, v.w * 0.28, 1.6);
      ctx.fillRect(-hw * 0.25, hh - 2.1, v.w * 0.28, 1.6);
      ctx.fillStyle = '#181c22';
      ctx.fillRect(hw, -hh * 0.45, 2.2, v.h * 0.45);
    }

    // Side mirrors
    ctx.fillStyle = shade(baseColor, 0.9);
    ctx.fillRect(cabinX + cabinW - 4, -hh - 1.4, 2.5, 1.8);
    ctx.fillRect(cabinX + cabinW - 4, hh - 0.4, 2.5, 1.8);
  }

  // 6. Brake lights & tail lights (bright red when braking/queuing, mild bloom at night)
  const braking = v.brake > 0.05 || v.handbrake || v.speed < -5;
  ctx.fillStyle = braking ? '#ff2a2a' : '#8a1c1c';
  ctx.fillRect(-hw, -hh * 0.74, 3.0, 3.8);
  ctx.fillRect(-hw, hh * 0.74 - 3.8, 3.0, 3.8);
  if (braking) {
    // Crisp brake lamp flare readable even in daylight
    ctx.fillStyle = 'rgba(255, 110, 96, 0.75)';
    ctx.fillRect(-hw - 0.6, -hh * 0.68, 2.0, 2.6);
    ctx.fillRect(-hw - 0.6, hh * 0.68 - 2.6, 2.0, 2.6);
  }
  if (braking || night > 0.25) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bAlpha = braking ? (0.34 + night * 0.36) : 0.24 * night;
    const bRad = braking ? (8 + night * 5) : 6;
    for (const ly of [-hh * 0.54, hh * 0.54]) {
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

  // 7. Blinking amber turn-signal indicators (left = -1, right = 1)
  if (v.blinker && Math.sin(t * 9.5 + v.id) > -0.15) {
    const sy = v.blinker < 0 ? -hh * 0.78 : hh * 0.78 - 2.4;
    ctx.fillStyle = '#ffae24';
    ctx.fillRect(hw - 2.6, sy, 2.8, 2.6);
    ctx.fillRect(-hw, sy, 2.8, 2.6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const bx of [hw - 1, -hw + 1]) {
      const ig = ctx.createRadialGradient(bx, sy + 1.2, 0.6, bx, sy + 1.2, 7.5);
      ig.addColorStop(0, 'rgba(255, 186, 48, 0.72)');
      ig.addColorStop(1, 'rgba(255, 160, 20, 0)');
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.arc(bx, sy + 1.2, 7.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // 8. Crisp headlight lenses
  ctx.fillStyle = (v.headlights && lightPower > 0.16 && (v.driver || v._headlightsOn)) ? '#fff6d6' : '#ebe4c8';
  ctx.fillRect(hw - 2.6, -hh * 0.74, 2.6, 3.8);
  ctx.fillRect(hw - 2.6, hh * 0.74 - 3.8, 2.6, 3.8);

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

/** Spawn parked cars neatly inside painted parking bays along BOTH curbs across the city. */
export function spawnParkedCars(world, rng, count = 115) {
  const cars = [];
  const typeNames = ['sedan', 'sedan', 'suv', 'pickup', 'van', 'sports', 'taxi'];
  const colors = ['#3b82b0', '#d94538', '#688c5c', '#2d3b4c', '#e6c038', '#984c82', '#d8823c', '#3d8f7d', '#c6ccd2', '#e4e8ec'];

  const bays = world.parkingBays || [];
  if (bays.length > 0) {
    // Deterministically pick bays along both curbs, leaving gaps so curbs look natural
    const step = Math.max(1, Math.floor(bays.length / count));
    for (let i = 0; i < bays.length && cars.length < count; i += step) {
      const idx = (i + Math.floor(rng() * Math.min(3, step))) % bays.length;
      const bay = bays[idx];
      if (!bay || world.isWater(bay.carX, bay.carY)) continue;
      // Avoid parking right on top of another parked car
      if (cars.some((c) => dist(c.x, c.y, bay.carX, bay.carY) < 42)) continue;
      const typeName = typeNames[Math.floor(rng() * typeNames.length)];
      const car = createVehicle(bay.carX, bay.carY, bay.angle, typeName);
      car.color = typeName === 'taxi' ? '#f0c436' : typeName === 'van' ? (rng() < 0.6 ? '#e2e7ec' : '#3a7c8c') : colors[Math.floor(rng() * colors.length)];
      cars.push(car);
    }
    return cars;
  }

  // Fallback if parkingBays are absent
  for (let n = 0; n < count; n += 1) {
    const useV = rng() < 0.5;
    const side = rng() < 0.5 ? 1 : -1;
    let x;
    let y;
    let angle;
    if (useV) {
      const road = world.roadsV[Math.floor(rng() * world.roadsV.length)];
      y = 300 + rng() * 2600;
      x = road + side * (CITY.roadHalf - 9);
      angle = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      const road = world.roadsH[Math.floor(rng() * (world.roadsH.length - 1))];
      x = 300 + rng() * 4000;
      y = road + side * (CITY.roadHalf - 9);
      angle = side === 1 ? 0 : Math.PI;
    }
    if (world.isWater(x, y)) continue;
    const typeName = typeNames[Math.floor(rng() * typeNames.length)];
    const car = createVehicle(x, y, angle, typeName);
    car.color = colors[Math.floor(rng() * colors.length)];
    cars.push(car);
  }
  return cars;
}
