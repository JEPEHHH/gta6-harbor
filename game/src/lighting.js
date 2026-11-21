// Directional sun shadows, warm dusk sky wash, sodium lamp pools, dockside neon spill,
// optional atmospheric rain and cinematic screen vignette.

import { PALETTE } from './config.js';
import { TAU, clamp, mixColor } from './util.js';

/**
 * Compute directional sun shadow vector and intensity from the 24-hour clock.
 * Low sun (dawn 6-8:30, dusk 16:30-19:30) throws dramatic long shadows across streets.
 */
export function sunShadowVector(hour) {
  // Normalized daylight progress: 6h = sunrise (east), 12.5h = high sun, 19h = sunset (west)
  const dayT = clamp((hour - 6) / 13, 0, 1);
  const lowSun = Math.abs(dayT - 0.5) * 2; // 0 at noon, 1 at sunrise/sunset
  const length = 0.14 + lowSun * 0.42;     // much longer at low sun
  // Sun sweeps from east-south-east to west-north-west -> shadow sweeps from WNW to ESE
  const angle = -2.45 + dayT * 2.95;       // radians
  const nightFade = hour >= 20.2 || hour <= 5.2 ? 0.18
    : hour > 18.6 ? clamp(1 - (hour - 18.6) / 1.6, 0.18, 1)
    : hour < 6.4 ? clamp((hour - 5.2) / 1.2, 0.18, 1)
    : 1;
  return {
    dx: Math.cos(angle) * length,
    dy: Math.sin(angle) * length * 0.72 + 0.08,
    alpha: 0.28 * nightFade,
    length,
    lowSun,
  };
}

/** Draw an extruded directional polygon shadow cast from a rectangular footprint. */
export function drawCastRectShadow(ctx, x, y, w, h, ht, sun) {
  const sx = sun.dx * ht;
  const sy = sun.dy * ht;
  if (Math.abs(sx) < 1 && Math.abs(sy) < 1) return;

  const x2 = x + w;
  const y2 = y + h;

  ctx.save();
  ctx.fillStyle = `rgba(14, 18, 30, ${sun.alpha.toFixed(3)})`;
  ctx.beginPath();
  // Build convex hull of footprint + shifted footprint based on quadrant of (sx, sy)
  if (sx >= 0 && sy >= 0) {
    ctx.moveTo(x, y2);
    ctx.lineTo(x + sx, y2 + sy);
    ctx.lineTo(x2 + sx, y2 + sy);
    ctx.lineTo(x2 + sx, y + sy);
    ctx.lineTo(x2, y);
    ctx.lineTo(x2, y2);
  } else if (sx < 0 && sy >= 0) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + sx, y + sy);
    ctx.lineTo(x + sx, y2 + sy);
    ctx.lineTo(x2 + sx, y2 + sy);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x, y2);
  } else if (sx >= 0 && sy < 0) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + sx, y + sy);
    ctx.lineTo(x2 + sx, y + sy);
    ctx.lineTo(x2 + sx, y2 + sy);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y);
  } else {
    ctx.moveTo(x2, y);
    ctx.lineTo(x2 + sx, y + sy);
    ctx.lineTo(x + sx, y + sy);
    ctx.lineTo(x + sx, y2 + sy);
    ctx.lineTo(x, y2);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // Subtle ambient-occlusion contact ring right around the building base
  ctx.fillStyle = 'rgba(10, 14, 24, 0.16)';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.restore();
}

/** Draw a soft elliptical contact + sun-offset shadow for grounded objects (cars, peds, props). */
export function drawSoftDropShadow(ctx, x, y, rx, ry, sun, lift = 8, angle = 0) {
  ctx.save();
  ctx.translate(x + sun.dx * lift, y + sun.dy * lift);
  if (angle) ctx.rotate(angle);
  ctx.fillStyle = `rgba(12, 16, 26, ${(sun.alpha * 0.95).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 1.06, ry * 1.06, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Tighter darker contact shadow directly under the object
  ctx.save();
  ctx.translate(x + 1.5, y + 2);
  if (angle) ctx.rotate(angle);
  ctx.fillStyle = 'rgba(8, 12, 20, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.94, ry * 0.90, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** World-space night multiply, warm sodium streetlamps, and dockside/downtown neon glow pools. */
export function drawWorldLighting(ctx, world, view, night, dusk, t) {
  // 1. Night & twilight color multiply (deep marine indigo, never flat grey)
  const shadeAmt = clamp(night * 0.72 + dusk * 0.16, 0, 0.78);
  if (shadeAmt > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const tint = dusk > 0.35
      ? mixColor('#ffe0c8', PALETTE.night, clamp(night * 0.65, 0, 0.7))
      : mixColor('#ffffff', PALETTE.night, shadeAmt);
    ctx.fillStyle = tint;
    ctx.fillRect(view.x - 40, view.y - 40, view.w + 80, view.h + 80);
    ctx.restore();
  }

  // 2. Warm sodium street lamp light pools (active through dusk and night)
  const lampPower = clamp(night * 1.15 + dusk * 0.65, 0, 1);
  if (lampPower > 0.12) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of world.lamps) {
      if (l.x < view.x - 100 || l.x > view.x + view.w + 100 || l.y < view.y - 100 || l.y > view.y + view.h + 100) continue;
      // Ground pool
      const grad = ctx.createRadialGradient(l.x, l.y - 4, 4, l.x, l.y - 4, 96);
      grad.addColorStop(0, `rgba(255, 198, 102, ${(0.28 * lampPower).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(255, 162, 68, ${(0.12 * lampPower).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255, 140, 48, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(l.x, l.y - 4, 96, 0, TAU);
      ctx.fill();

      // Bulb bloom
      const bulb = ctx.createRadialGradient(l.x, l.y - 16, 1, l.x, l.y - 16, 18);
      bulb.addColorStop(0, `rgba(255, 240, 195, ${(0.65 * lampPower).toFixed(3)})`);
      bulb.addColorStop(1, 'rgba(255, 196, 100, 0)');
      ctx.fillStyle = bulb;
      ctx.beginPath();
      ctx.arc(l.x, l.y - 16, 18, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. Neon signs near docks & Midtown casting magenta/cyan/amber light onto ground & water
  const neonPower = clamp(0.32 + night * 0.68 + dusk * 0.5, 0.32, 1);
  if (world.neonSigns && world.neonSigns.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const n of world.neonSigns) {
      if (n.x < view.x - 140 || n.x > view.x + view.w + 140 || n.y < view.y - 140 || n.y > view.y + view.h + 140) continue;
      const flicker = n.flicker && Math.sin(t * 23 + n.ph) > 0.92 ? 0.55 : 1;
      const p = neonPower * flicker;
      const r = n.radius || 110;
      const grad = ctx.createRadialGradient(n.x, n.y, 4, n.x, n.y, r);
      grad.addColorStop(0, `rgba(${n.rgb}, ${(0.52 * p).toFixed(3)})`);
      grad.addColorStop(0.42, `rgba(${n.rgb}, ${(0.22 * p).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${n.rgb}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Screen-space warm dusk gradient sky tint, optional rain streaks & subtle cinematic vignette. */
export function drawScreenAtmosphere(ctx, cssW, cssH, dusk, night, t, rain) {
  // Warm dusk gradient sky wash over the map (coral-gold upper left fading into twilight magenta-indigo)
  if (dusk > 0.04) {
    ctx.save();
    const skyGrad = ctx.createLinearGradient(0, 0, cssW, cssH);
    skyGrad.addColorStop(0, `rgba(255, 134, 66, ${(0.19 * dusk).toFixed(3)})`);
    skyGrad.addColorStop(0.5, `rgba(224, 86, 130, ${(0.09 * dusk).toFixed(3)})`);
    skyGrad.addColorStop(1, `rgba(38, 48, 108, ${(0.14 * dusk).toFixed(3)})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.restore();
  } else if (night < 0.15) {
    // Subtle warm sunlit coastal sheen by day
    const sunGrad = ctx.createLinearGradient(0, 0, cssW, cssH);
    sunGrad.addColorStop(0, 'rgba(255, 240, 200, 0.06)');
    sunGrad.addColorStop(1, 'rgba(20, 90, 110, 0.04)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  // Optional rain streaks & subtle wet-pavement sheen
  if (rain) {
    ctx.save();
    ctx.fillStyle = 'rgba(18, 32, 48, 0.12)';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.strokeStyle = 'rgba(195, 224, 242, 0.28)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    const count = 110;
    for (let i = 0; i < count; i += 1) {
      const rx = ((i * 197.3 + t * 240) % (cssW + 120)) - 60;
      const ry = ((i * 113.7 + t * 880) % (cssH + 80)) - 40;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 7, ry + 22);
    }
    ctx.stroke();

    // Small splash rings on the ground
    ctx.strokeStyle = 'rgba(210, 236, 248, 0.22)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 22; i += 1) {
      const life = (t * 2.4 + i * 0.37) % 1;
      const sx = ((i * 331.7 + Math.floor(t * 2.4 + i * 0.37) * 97) % cssW);
      const sy = ((i * 179.3 + Math.floor(t * 2.4 + i * 0.37) * 53) % cssH);
      ctx.globalAlpha = (1 - life) * 0.35;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 2 + life * 7, 1 + life * 3.5, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Subtle cinematic vignette
  const vig = ctx.createRadialGradient(
    cssW * 0.5, cssH * 0.5, Math.min(cssW, cssH) * 0.44,
    cssW * 0.5, cssH * 0.5, Math.hypot(cssW, cssH) * 0.58
  );
  vig.addColorStop(0, 'rgba(6, 10, 18, 0)');
  vig.addColorStop(0.75, 'rgba(6, 10, 18, 0.14)');
  vig.addColorStop(1, `rgba(4, 8, 16, ${(0.34 + night * 0.12).toFixed(3)})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, cssW, cssH);
}
