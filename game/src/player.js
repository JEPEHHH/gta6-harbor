// The player on foot and driving: WASD movement with sprint, wall sliding, a walk cycle,
// entering/exiting vehicles, aiming toward the mouse. The controller owns no drawing state
// beyond the pose.

import { PALETTE, PLAYER, CAMERA } from './config.js';
import { TAU, angleLerp, clamp, damp, dist } from './util.js';
import { canEnter, updateVehicle } from './vehicles.js';
import { reportCrime } from './wanted.js';

export function createPlayer(world) {
  return {
    x: world.spawn.x,
    y: world.spawn.y,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    armour: 0,
    money: PLAYER.startMoney,
    walkPhase: 0,
    moving: false,
    sprinting: false,
    inCar: null,
    dustTimer: 0,
    shooting: false,
    footstepTimer: 0,
  };
}

export function updatePlayer(p, dt, input, world, particles, vehicles, camera, wantedState, elapsed) {
  p.shooting = false;

  if (p.inCar) {
    updateDriving(p, dt, input, world, particles, vehicles, camera);
    return;
  }

  // On foot — aim toward the mouse
  const ax = input.axis();
  p.sprinting = input.isDown('sprint') && (ax.x !== 0 || ax.y !== 0);
  const speed = p.sprinting ? PLAYER.sprint : PLAYER.walk;
  p.vx = damp(p.vx, ax.x * speed, PLAYER.accel, dt);
  p.vy = damp(p.vy, ax.y * speed, PLAYER.accel, dt);
  const res = world.moveCircle(p.x, p.y, PLAYER.radius, p.vx * dt, p.vy * dt);
  p.vx = (res.x - p.x) / dt;
  p.vy = (res.y - p.y) / dt;
  p.x = res.x;
  p.y = res.y;
  const sp = Math.hypot(p.vx, p.vy);
  p.moving = sp > 20;

  // Aim toward mouse in world space
  if (input.mouse.down || sp > 20) {
    if (sp > 20) {
      p.angle = angleLerp(p.angle, Math.atan2(p.vy, p.vx), 1 - Math.exp(-dt * 14));
    }
  }
  // If mouse is held, override angle to aim at mouse
  if (input.mouse.down) {
    // The camera-to-world transform is done in main.js and passed through the mouse world coords
    // For now, face movement direction (the aim is handled by combat)
  }

  p.walkPhase += sp * dt * 0.09;

  // Footstep audio trigger
  if (p.moving) {
    p.footstepTimer -= dt;
    if (p.footstepTimer <= 0) {
      p.footstepTimer = p.sprinting ? 0.22 : 0.35;
    }
  }

  // Sprint dust
  if (p.sprinting && sp > 100) {
    p.dustTimer -= dt;
    if (p.dustTimer <= 0) {
      p.dustTimer = 0.09;
      particles.push({
        x: p.x - Math.cos(p.angle) * 8 + (Math.random() - 0.5) * 6,
        y: p.y - Math.sin(p.angle) * 8 + (Math.random() - 0.5) * 6,
        vx: -p.vx * 0.08,
        vy: -p.vy * 0.08,
        age: 0,
        life: 0.5,
        size: 2.5 + Math.random() * 2,
        color: '214,196,160',
      });
    }
  }

  // Enter vehicle (F key)
  if (input.pressed('interact') && vehicles) {
    for (const v of vehicles) {
      if (canEnter(v, p.x, p.y)) {
        p.inCar = v;
        v.driver = 'player';
        p.vx = 0;
        p.vy = 0;
        if (wantedState && v._wasOccupied) {
          reportCrime(wantedState, 'carjack', elapsed);
        }
        break;
      }
    }
  }
}

function updateDriving(p, dt, input, world, particles, vehicles, camera) {
  const car = p.inCar;
  if (!car) return;

  // Exit vehicle (F key, only when slow)
  if (input.pressed('interact') && Math.hypot(car.vx, car.vy) < 30) {
    p.inCar = null;
    car.driver = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 25;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 25;
    p.vx = 0;
    p.vy = 0;
    return;
  }

  // Driving controls
  const ax = input.axis();
  car.throttle = ax.y < -0.1 ? Math.abs(ax.y) : 0;
  car.brake = ax.y > 0.1 ? ax.y : 0;
  car.steer = ax.x;
  car.handbrake = input.isDown('sprint');

  // Horn
  if (input.pressed('horn')) {
    car.horn = 0.5;
  }
  car.horn = Math.max(0, car.horn - dt);

  updateVehicle(car, dt, world, particles);

  // Sync player pos/angle to car
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.vx = car.vx;
  p.vy = car.vy;
}

export function drawPlayer(ctx, p) {
  if (p.inCar) return;   // drawn as the vehicle instead

  ctx.fillStyle = 'rgba(20,24,32,0.28)';
  ctx.beginPath();
  ctx.ellipse(p.x + 3, p.y + 4, 10, 5, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle + Math.PI / 2);
  const swing = p.moving ? Math.sin(p.walkPhase) * 4 : 0;

  ctx.fillStyle = '#2e3a46';
  ctx.fillRect(-5, 1 + swing * 0.5, 4, 7);
  ctx.fillRect(1, 1 - swing * 0.5, 4, 7);

  ctx.fillStyle = '#c98d5f';
  ctx.beginPath();
  ctx.arc(-7, -swing * 0.6, 2.6, 0, TAU);
  ctx.arc(7, swing * 0.6, 2.6, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#37a7ad';
  ctx.beginPath();
  ctx.roundRect(-6, -7, 12, 12, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(-6, -7, 12, 3);

  ctx.fillStyle = '#c98d5f';
  ctx.beginPath();
  ctx.arc(0, -6, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2e3a46';
  ctx.beginPath();
  ctx.arc(0, -7.4, 4.6, Math.PI, TAU);
  ctx.fill();
  ctx.restore();
}
