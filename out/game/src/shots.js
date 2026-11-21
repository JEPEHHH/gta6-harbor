// Projectile and impact effects for the combat system. Milestone A defines the data
// structures and the particle burst; milestone B adds actual weapon firing and damage.

import { TAU } from './util.js';

/** Create a bullet entity heading from (sx, sy) toward angle with given speed. */
export function createBullet(sx, sy, angle, speed = 800) {
  return {
    x: sx,
    y: sy,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    age: 0,
    life: 0.6,
    hit: false,
  };
}

/** Advance every bullet, remove expired ones, return the survivors. */
export function updateBullets(bullets, dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.age += dt;
    if (b.age >= b.life || b.hit) {
      bullets.splice(i, 1);
    }
  }
}

/** Spawn a small ring of particles (dust/sparks/blood) at an impact point. */
export function impactBurst(particles, x, y, color = '220,180,120') {
  const isSpark = color === '220,180,120';
  for (let k = 0; k < 7; k += 1) {
    const a = (k / 7) * TAU + Math.random() * 0.4;
    const sp = (isSpark ? 75 : 42) + Math.random() * (isSpark ? 90 : 55);
    particles.push({
      kind: isSpark ? 'spark' : 'dust',
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      age: 0,
      life: (isSpark ? 0.25 : 0.36) + Math.random() * 0.18,
      size: 1.9 + Math.random() * 1.5,
      color,
    });
  }
  if (isSpark) {
    particles.push({
      kind: 'flash',
      x,
      y,
      vx: 0,
      vy: 0,
      age: 0,
      life: 0.12,
      size: 6,
      color: '255,220,130',
    });
  }
}
