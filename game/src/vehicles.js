// Vehicle entities: sedans, trucks, sports cars. Arcade driving physics with drift,
// damage model, skid marks, headlights and engine audio hooks. One job: be a vehicle.

import { CITY, PALETTE, CAMERA } from './config.js';
import { TAU, clamp, damp, dist, angleLerp } from './util.js';

const TYPES = {
  sedan:  { name: 'Sedan',  w: 32, h: 16, mass: 1.0, power: 320, maxSpeed: 280, grip: 0.92, color: '#4a8ab5', hp: 100 },
  sports: { name: 'Sports', w: 34, h: 15, mass: 0.85, power: 460, maxSpeed: 360, grip: 0.88, color: '#c94a3a', hp: 80 },
  truck:  { name: 'Truck',  w: 42, h: 18, mass: 1.6, power: 240, maxSpeed: 200, grip: 0.95, color: '#8a9a6a', hp: 160 },
  suv:    { name: 'SUV',    w: 38, h: 17, mass: 1.3, power: 300, maxSpeed: 240, grip: 0.93, color: '#2e3a46', hp: 130 },
  taxi:   { name: 'Taxi',   w: 33, h: 16, mass: 1.0, power: 310, maxSpeed: 270, grip: 0.91, color: '#e8c840', hp: 100 },
  police: { name: 'Cruiser',w: 34, h: 16, mass: 1.1, power: 420, maxSpeed: 340, grip: 0.90, color: '#1a2a3a', hp: 140 },
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
  };
}

/** Arcade driving physics: throttle, brake, drift and collision with the world. */
export function updateVehicle(v, dt, world, particles) {
  const t = TYPES[v.type] || TYPES.sedan;
  const drag = 0.98;
  const brakePower = 600;
  const steerSpeed = 3.2;

  // Forward direction
  const fx = Math.cos(v.angle);
  const fy = Math.sin(v.angle);

  // Current forward speed component
  v.speed = v.vx * fx + v.vy * fy;

  // Throttle force
  const accel = v.throttle * t.power / t.mass;
  v.vx += fx * accel * dt;
  v.vy += fy * accel * dt;

  // Brake force
  if (v.brake > 0) {
    const bs = v.brake * brakePower * dt / t.mass;
    const sp = Math.hypot(v.vx, v.vy);
    if (sp > 0.5) {
      v.vx -= (v.vx / sp) * Math.min(bs, sp);
      v.vy -= (v.vy / sp) * Math.min(bs, sp);
    }
  }

  // Lateral grip: kill the sideways velocity component partially
  const lx = -fy;
  const ly = fx;
  const latSpeed = v.vx * lx + v.vy * ly;
  const gripFactor = v.handbrake ? t.grip * 0.4 : t.grip;
  const latKill = latSpeed * gripFactor;
  v.vx -= lx * latKill * dt * 8;
  v.vy -= ly * latKill * dt * 8;

  // Drift detection
  v.driftAngle = Math.abs(latSpeed) > 30 ? latSpeed * 0.015 : 0;

  // Steering — only effective when moving
  const speedFactor = clamp(Math.abs(v.speed) / 60, 0, 1);
  const turnRate = steerSpeed * speedFactor * (v.speed >= 0 ? 1 : -1);
  v.angle += v.steer * turnRate * dt;

  // Drag
  v.vx *= drag;
  v.vy *= drag;

  // Speed cap
  const curSpeed = Math.hypot(v.vx, v.vy);
  if (curSpeed > t.maxSpeed) {
    v.vx *= t.maxSpeed / curSpeed;
    v.vy *= t.maxSpeed / curSpeed;
  }

  // Recalc forward speed after all adjustments
  v.speed = v.vx * fx + v.vy * fy;

  // Engine RPM for audio
  v.engineRpm = clamp(Math.abs(v.speed) / t.maxSpeed, 0, 1) * 0.7 + v.throttle * 0.3;

  // Move with world collision (axis-separate slide)
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

  // Building collision
  for (const b of world.buildings) {
    if (Math.abs(v.x - b.x - b.w / 2) < (halfW + b.w / 2) &&
        Math.abs(v.y - b.y - b.h / 2) < (t.h / 2 + b.h / 2)) {
      // Push out
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
      }
    }
  }

  v.hp = clamp(v.hp, 0, v.maxHp);

  // Skid marks / tyre smoke particles
  if ((v.handbrake || Math.abs(latSpeed) > 50) && Math.abs(v.speed) > 40) {
    v.skidTimer -= dt;
    if (v.skidTimer <= 0) {
      v.skidTimer = 0.03;
      particles.push({
        x: v.x - fx * halfW * 0.7 + (Math.random() - 0.5) * 8,
        y: v.y - fy * halfW * 0.7 + (Math.random() - 0.5) * 8,
        vx: -v.vx * 0.02, vy: -v.vy * 0.02,
        age: 0, life: 1.2, size: 3 + Math.random() * 2,
        color: '180,178,172',
      });
    }
  }

  // Exhaust when accelerating
  if (v.throttle > 0.3 && Math.abs(v.speed) > 20) {
    if (Math.random() < 0.15) {
      particles.push({
        x: v.x - fx * halfW + (Math.random() - 0.5) * 4,
        y: v.y - fy * halfW + (Math.random() - 0.5) * 4,
        vx: -fx * 20 + (Math.random() - 0.5) * 10,
        vy: -fy * 20 + (Math.random() - 0.5) * 10,
        age: 0, life: 0.6, size: 2 + Math.random() * 1.5,
        color: '160,160,165',
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
    // Transfer some momentum
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

/** Draw one vehicle, top-down with a 2.5D hint. */
export function drawVehicle(ctx, v, night) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);

  // Shadow
  ctx.fillStyle = 'rgba(20,24,32,0.22)';
  ctx.beginPath();
  ctx.ellipse(3, 4, v.w * 0.52, v.h * 0.42, 0, 0, TAU);
  ctx.fill();

  // Body
  const bodyColor = v.damaged ? '#6a6a6a' : v.color;
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.roundRect(-v.w / 2, -v.h / 2, v.w, v.h, 4);
  ctx.fill();

  // Roof / windshield
  ctx.fillStyle = 'rgba(140,180,210,0.5)';
  ctx.fillRect(-v.w * 0.15, -v.h * 0.35, v.w * 0.35, v.h * 0.7);

  // Stripe for police cars
  if (v.type === 'police') {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-v.w * 0.1, -v.h / 2, v.w * 0.06, v.h);
    ctx.fillStyle = '#3a6ad0';
    ctx.fillRect(-v.w * 0.04, -v.h / 2, v.w * 0.06, v.h);
    ctx.fillStyle = '#d04040';
    ctx.fillRect(v.w * 0.02, -v.h / 2, v.w * 0.06, v.h);
  }

  // Tail lights
  ctx.fillStyle = v.brake > 0 ? '#ff3030' : '#8a2020';
  ctx.fillRect(-v.w / 2, -v.h * 0.35, 3, 4);
  ctx.fillRect(-v.w / 2, v.h * 0.35 - 4, 3, 4);

  // Headlights
  if (v.headlights && night > 0.2) {
    ctx.fillStyle = '#ffe8b0';
    ctx.fillRect(v.w / 2 - 3, -v.h * 0.35, 3, 4);
    ctx.fillRect(v.w / 2 - 3, v.h * 0.35 - 4, 3, 4);
  } else {
    ctx.fillStyle = '#e8e0c0';
    ctx.fillRect(v.w / 2 - 3, -v.h * 0.35, 3, 4);
    ctx.fillRect(v.w / 2 - 3, v.h * 0.35 - 4, 3, 4);
  }

  // Damage scratches
  if (v.hp < v.maxHp * 0.6) {
    ctx.strokeStyle = 'rgba(60,60,60,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-v.w * 0.3, -v.h * 0.2);
    ctx.lineTo(v.w * 0.1, v.h * 0.1);
    ctx.moveTo(v.w * 0.1, -v.h * 0.3);
    ctx.lineTo(-v.w * 0.2, v.h * 0.2);
    ctx.stroke();
  }

  ctx.restore();

  // Headlight beams at night
  if (v.headlights && night > 0.25 && v.driver) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bx = v.x + Math.cos(v.angle) * v.w * 0.5;
    const by = v.y + Math.sin(v.angle) * v.w * 0.5;
    const grad = ctx.createRadialGradient(bx, by, 2, bx + Math.cos(v.angle) * 90, by + Math.sin(v.angle) * 90, 60);
    grad.addColorStop(0, `rgba(255,230,160,${(0.18 * night).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx + Math.cos(v.angle) * 45, by + Math.sin(v.angle) * 45, 65, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
}

/** Spawn parked cars along streets. */
export function spawnParkedCars(world, rng, count = 40) {
  const cars = [];
  const typeNames = ['sedan', 'sports', 'truck', 'suv', 'taxi'];
  for (let n = 0; n < count; n += 1) {
    // Pick a random road position
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
    // Random color variation
    const colors = ['#4a8ab5', '#c94a3a', '#8a9a6a', '#2e3a46', '#e8c840', '#a05a9a', '#d09848', '#5a8a5a', '#c0c0c8'];
    car.color = colors[Math.floor(rng() * colors.length)];
    cars.push(car);
  }
  return cars;
}
