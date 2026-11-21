// The player on foot: WASD movement with sprint, wall sliding, a walk cycle and dust.
// Driving hooks in here in milestone B; the controller owns no drawing state beyond the pose.

import { PALETTE, PLAYER } from './config.js';
import { TAU, angleLerp, damp } from './util.js';

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
  };
}

export function updatePlayer(p, dt, input, world, particles) {
  const ax = input.axis();
  p.sprinting = input.isDown('sprint') && (ax.x !== 0 || ax.y !== 0);
  const speed = p.sprinting ? PLAYER.sprint : PLAYER.walk;
  p.vx = damp(p.vx, ax.x * speed, PLAYER.accel, dt);
  p.vy = damp(p.vy, ax.y * speed, PLAYER.accel, dt);
  const res = world.moveCircle(p.x, p.y, PLAYER.radius, p.vx * dt, p.vy * dt);
  // Report the velocity actually achieved so the camera never leads into a wall.
  p.vx = (res.x - p.x) / dt;
  p.vy = (res.y - p.y) / dt;
  p.x = res.x;
  p.y = res.y;
  const sp = Math.hypot(p.vx, p.vy);
  p.moving = sp > 20;
  if (p.moving) p.angle = angleLerp(p.angle, Math.atan2(p.vy, p.vx), 1 - Math.exp(-dt * 14));
  p.walkPhase += sp * dt * 0.09;
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
}

export function drawPlayer(ctx, p) {
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
