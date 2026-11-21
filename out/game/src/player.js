// The player on foot and driving: WASD movement with sprint, wall sliding, a walk cycle,
// entering/exiting vehicles, aiming toward the mouse. The controller owns no drawing state
// beyond the pose.

import { PALETTE, PLAYER, CAMERA } from './config.js';
import { TAU, angleLerp, clamp, damp, dist, shade } from './util.js';
import { canEnter, updateVehicle } from './vehicles.js';
import { reportCrime } from './wanted.js';
import { drawSoftDropShadow } from './lighting.js';

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

export function updatePlayer(p, dt, input, world, particles, vehicles, camera, wantedState, elapsed, skidmarks) {
  p.shooting = false;

  if (p.inCar) {
    updateDriving(p, dt, input, world, particles, vehicles, camera, skidmarks);
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

function updateDriving(p, dt, input, world, particles, vehicles, camera, skidmarks) {
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

  updateVehicle(car, dt, world, particles, skidmarks);

  // Sync player pos/angle to car
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.vx = car.vx;
  p.vy = car.vy;
}

export function drawPlayer(ctx, p, sun, weapon = 'fist') {
  if (p.inCar) return;   // drawn as the vehicle instead

  const swing = p.moving ? Math.sin(p.walkPhase) * 4.2 : 0;
  const bob = p.moving ? Math.abs(Math.cos(p.walkPhase)) * 0.9 : 0;

  if (sun) {
    drawSoftDropShadow(ctx, p.x, p.y + 2, 10, 5.5, sun, 11);
  } else {
    ctx.fillStyle = 'rgba(16, 20, 28, 0.30)';
    ctx.beginPath();
    ctx.ellipse(p.x + 3, p.y + 4, 10, 5, 0, 0, TAU);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(p.x, p.y - bob);
  ctx.rotate(p.angle + Math.PI / 2);

  // Legs / trousers
  ctx.fillStyle = '#242e3b';
  ctx.beginPath();
  ctx.roundRect(-5.2, 1 + swing * 0.5, 4.2, 7.2, 1.5);
  ctx.roundRect(1.0, 1 - swing * 0.5, 4.2, 7.2, 1.5);
  ctx.fill();

  // Arms
  ctx.fillStyle = '#cc9162';
  ctx.beginPath();
  ctx.arc(-7.4, -0.8 - swing * 0.55, 2.7, 0, TAU);
  ctx.arc(7.4, weapon !== 'fist' ? -6.5 : -0.8 + swing * 0.55, 2.7, 0, TAU);
  ctx.fill();

  // Held weapon (pistol or SMG)
  if (weapon === 'pistol' || weapon === 'smg') {
    ctx.fillStyle = '#1e242c';
    const gunLen = weapon === 'smg' ? 10 : 7;
    ctx.fillRect(6.2, -7 - gunLen, 2.6, gunLen);
    ctx.fillStyle = '#6c7682';
    ctx.fillRect(6.5, -7 - gunLen, 1.2, gunLen * 0.6);
  }

  // Shaded teal harbor jacket
  const jGrad = ctx.createLinearGradient(-6, -7, 6, 5);
  jGrad.addColorStop(0, shade('#2fb4bc', 1.22));
  jGrad.addColorStop(0.55, '#2b9ea6');
  jGrad.addColorStop(1, shade('#2b9ea6', 0.72));
  ctx.fillStyle = jGrad;
  ctx.beginPath();
  ctx.roundRect(-6.5, -7.2, 13, 12.2, 4.2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 252, 240, 0.25)';
  ctx.fillRect(-5.5, -7, 11, 2.6);
  ctx.strokeStyle = 'rgba(12, 18, 26, 0.42)';
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // Head & styled dark hair with rim highlight
  ctx.fillStyle = '#cc9162';
  ctx.beginPath();
  ctx.arc(0, -6.2, 5.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1f2833';
  ctx.beginPath();
  ctx.arc(0, -7.5, 4.9, Math.PI * 0.92, TAU + 0.25);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.arc(-1.5, -8.8, 1.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}
