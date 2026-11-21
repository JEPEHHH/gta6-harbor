// Visual combat & world effects: smooth rubber skidmarks, muzzle flash light bursts,
// bullet tracers, typed particles (dust, sparks, smoke, explosions, blood) and mission beacon.

import { PALETTE } from './config.js';
import { TAU, clamp } from './util.js';

/** Draw smooth tyre skidmarks on asphalt with tapered opacity. */
export function drawSkidmarks(ctx, skidmarks, view) {
  if (!skidmarks || skidmarks.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (const sm of skidmarks) {
    if (sm.x1 < view.x - 40 && sm.x2 < view.x - 40) continue;
    if (sm.x1 > view.x + view.w + 40 && sm.x2 > view.x + view.w + 40) continue;
    if (sm.y1 < view.y - 40 && sm.y2 < view.y - 40) continue;
    if (sm.y1 > view.y + view.h + 40 && sm.y2 > view.y + view.h + 40) continue;
    const alpha = clamp(sm.alpha ?? 0.42, 0, 0.72);
    // Soft outer rubber smear
    ctx.strokeStyle = `rgba(18, 19, 24, ${(alpha * 0.45).toFixed(3)})`;
    ctx.lineWidth = (sm.w || 3.4) + 1.8;
    ctx.beginPath();
    ctx.moveTo(sm.x1, sm.y1);
    ctx.lineTo(sm.x2, sm.y2);
    ctx.stroke();
    // Crisp dark tyre core
    ctx.strokeStyle = `rgba(14, 15, 20, ${alpha.toFixed(3)})`;
    ctx.lineWidth = sm.w || 3.0;
    ctx.beginPath();
    ctx.moveTo(sm.x1, sm.y1);
    ctx.lineTo(sm.x2, sm.y2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw glowing bullet tracers and hot projectile cores. */
export function drawBulletTracers(ctx, bullets, view) {
  if (!bullets || bullets.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const bl of bullets) {
    if (bl.x < view.x - 60 || bl.x > view.x + view.w + 60 || bl.y < view.y - 60 || bl.y > view.y + view.h + 60) continue;
    const a = clamp(1 - bl.age / bl.life, 0, 1);
    const sp = Math.hypot(bl.vx, bl.vy) || 1;
    const tailLen = Math.min(34, sp * 0.042);
    const tx = bl.x - (bl.vx / sp) * tailLen;
    const ty = bl.y - (bl.vy / sp) * tailLen;

    const grad = ctx.createLinearGradient(tx, ty, bl.x, bl.y);
    grad.addColorStop(0, 'rgba(255, 180, 70, 0)');
    grad.addColorStop(0.6, `rgba(255, 210, 110, ${(0.55 * a).toFixed(3)})`);
    grad.addColorStop(1, `rgba(255, 250, 220, ${(0.95 * a).toFixed(3)})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(bl.x, bl.y);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 252, 235, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(bl.x, bl.y, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Draw muzzle flash star and radial light burst when firing on foot. */
export function drawMuzzleFlash(ctx, player, combat) {
  if (!combat || combat.muzzleFlash <= 0 || player.inCar) return;
  const k = clamp(combat.muzzleFlash / 0.08, 0, 1);
  const mx = player.x + Math.cos(player.angle) * 14;
  const my = player.y + Math.sin(player.angle) * 14;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Radial light burst illuminating the street around the shooter
  const glow = ctx.createRadialGradient(mx, my, 2, mx, my, 68 * (0.7 + 0.3 * k));
  glow.addColorStop(0, `rgba(255, 244, 190, ${(0.75 * k).toFixed(3)})`);
  glow.addColorStop(0.35, `rgba(255, 175, 65, ${(0.35 * k).toFixed(3)})`);
  glow.addColorStop(1, 'rgba(255, 120, 30, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(mx, my, 68, 0, TAU);
  ctx.fill();

  // Sharp multi-spike muzzle cone
  ctx.translate(mx, my);
  ctx.rotate(player.angle);
  ctx.fillStyle = `rgba(255, 250, 215, ${(0.92 * k).toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(0, -2.5);
  ctx.lineTo(14 * k, 0);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(6 * k, 6 * k);
  ctx.lineTo(-2, 1.5);
  ctx.lineTo(6 * k, -6 * k);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Draw typed world particles: dust, tyre smoke, hot sparks, explosions and blood. */
export function drawParticles(ctx, particles, view) {
  if (!particles || particles.length === 0) return;
  ctx.save();
  for (const pt of particles) {
    if (pt.x < view.x - 60 || pt.x > view.x + view.w + 60 || pt.y < view.y - 60 || pt.y > view.y + view.h + 60) continue;
    const progress = clamp(pt.age / pt.life, 0, 1);
    const fade = 1 - progress;

    if (pt.kind === 'spark') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255, 224, 130, ${(fade * 0.95).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.2, pt.size * 0.65);
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - pt.vx * 0.045, pt.y - pt.vy * 0.045);
      ctx.stroke();
      ctx.restore();
    } else if (pt.kind === 'flash' || pt.kind === 'explosion') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = pt.size * (0.7 + progress * 2.2);
      const grad = ctx.createRadialGradient(pt.x, pt.y, 1, pt.x, pt.y, r);
      grad.addColorStop(0, `rgba(255, 252, 220, ${(fade * 0.9).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(255, 142, 42, ${(fade * 0.65).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(200, 48, 20, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (pt.kind === 'smoke') {
      const r = pt.size * (0.75 + progress * 1.45);
      const a = fade * 0.36;
      ctx.fillStyle = `rgba(${pt.color || '192,194,200'},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, TAU);
      ctx.fill();
    } else {
      const a = fade * 0.55;
      const r = pt.size * (0.65 + progress * 0.95);
      ctx.fillStyle = `rgba(${pt.color || '210,196,170'},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Spawn a dramatic explosion flash + sparks + dark smoke cloud (e.g. on heavy crashes/destruction). */
export function spawnExplosion(particles, x, y, scale = 1) {
  particles.push({
    kind: 'explosion',
    x, y, vx: 0, vy: 0,
    age: 0, life: 0.32, size: 22 * scale,
    color: '255,180,80',
  });
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * TAU + Math.random() * 0.4;
    const sp = (70 + Math.random() * 140) * scale;
    particles.push({
      kind: 'spark',
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      age: 0, life: 0.35 + Math.random() * 0.25,
      size: 2.4, color: '255,215,120',
    });
  }
  for (let i = 0; i < 8; i += 1) {
    const a = Math.random() * TAU;
    const sp = (18 + Math.random() * 35) * scale;
    particles.push({
      kind: 'smoke',
      x: x + (Math.random() - 0.5) * 14,
      y: y + (Math.random() - 0.5) * 14,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      age: 0, life: 1.1 + Math.random() * 0.6,
      size: (8 + Math.random() * 7) * scale,
      color: '56,58,64',
    });
  }
}

/** Draw the glowing in-world mission waypoint ring, light beam and floating diamond. */
export function drawMissionWaypoint(ctx, wp, t) {
  if (!wp) return;
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  const wpR = 24 + pulse * 5;

  ctx.save();
  // Soft ground light bloom
  ctx.globalCompositeOperation = 'lighter';
  const bloom = ctx.createRadialGradient(wp.x, wp.y, 4, wp.x, wp.y, 52);
  bloom.addColorStop(0, 'rgba(255, 168, 72, 0.34)');
  bloom.addColorStop(0.5, 'rgba(255, 130, 52, 0.14)');
  bloom.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(wp.x, wp.y, 52, 0, TAU);
  ctx.fill();

  // Vertical translucent beacon column
  const colGrad = ctx.createLinearGradient(wp.x, wp.y - 76, wp.x, wp.y);
  colGrad.addColorStop(0, 'rgba(255, 180, 92, 0)');
  colGrad.addColorStop(1, 'rgba(255, 162, 68, 0.24)');
  ctx.fillStyle = colGrad;
  ctx.fillRect(wp.x - 14, wp.y - 76, 28, 76);
  ctx.restore();

  // Crisp double elliptical ground rings
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(wp.x, wp.y, wpR, wpR * 0.55, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255, 154, 68, 0.22)';
  ctx.fill();
  ctx.strokeStyle = PALETTE.accent;
  ctx.lineWidth = 2.6;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(wp.x, wp.y, wpR * 0.58, wpR * 0.32, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(255, 240, 210, 0.72)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Floating beveled diamond marker
  const bobY = wp.y - 34 + Math.sin(t * 3.5) * 6;
  ctx.fillStyle = PALETTE.accent;
  ctx.beginPath();
  ctx.moveTo(wp.x, bobY - 13);
  ctx.lineTo(wp.x + 10, bobY);
  ctx.lineTo(wp.x, bobY + 13);
  ctx.lineTo(wp.x - 10, bobY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 246, 224, 0.45)';
  ctx.beginPath();
  ctx.moveTo(wp.x, bobY - 13);
  ctx.lineTo(wp.x + 10, bobY);
  ctx.lineTo(wp.x, bobY - 1);
  ctx.lineTo(wp.x - 10, bobY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(wp.x, bobY - 13);
  ctx.lineTo(wp.x + 10, bobY);
  ctx.lineTo(wp.x, bobY + 13);
  ctx.lineTo(wp.x - 10, bobY);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}
