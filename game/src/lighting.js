// Directional sun shadows, building base ambient occlusion, cohesive daytime colour grading,
// night-only mild highlight bloom, sodium lamp pools, dockside neon spill, rain & vignette.

import { PALETTE } from './config.js';
import { TAU, clamp, mixColor } from './util.js';

/**
 * Compute directional sun shadow vector and intensity from the 24-hour clock.
 * Morning (06:00-09:30) and late afternoon / golden hour (16:00-19:30) cast long dramatic
 * shadows that shorten noticeably toward solar noon (12:30).
 */
export function sunShadowVector(hour) {
  // Normalized daylight progress: 6.0 = sunrise (east), 12.5 = solar noon, 19.0 = sunset (west)
  const dayT = clamp((hour - 6.0) / 13.0, 0, 1);
  const lowSun = clamp(Math.abs(dayT - 0.5) * 2, 0, 1); // 0 at noon, 1 at sunrise/sunset
  // Dramatic long shadows at morning/golden hour, compact crisp shadows near noon
  const length = 0.16 + (lowSun ** 1.15) * 0.72;
  // Morning sun in east -> shadows stretch WSW/WNW; afternoon sun in west -> shadows stretch ESE
  const angle = Math.PI * 0.88 - dayT * (Math.PI * 0.68);
  const nightFade = hour >= 20.6 || hour <= 5.2 ? 0.18
    : hour > 19.2 ? clamp(1 - (hour - 19.2) / 1.4, 0.18, 1)
    : hour < 6.4 ? clamp((hour - 5.2) / 1.2, 0.18, 1)
    : 1;
  const morning = hour >= 6.0 && hour <= 10.5 ? Math.exp(-(((hour - 8.0) / 2.0) ** 2)) : 0;
  const golden = hour >= 15.0 && hour <= 19.4 ? Math.exp(-(((hour - 17.4) / 1.45) ** 2)) : 0;
  return {
    dx: Math.cos(angle) * length,
    dy: Math.sin(angle) * length * 0.76 + 0.10,
    alpha: (0.29 + lowSun * 0.08) * nightFade,
    length,
    lowSun,
    morning,
    golden,
    nightFade,
  };
}

/**
 * Draw an extruded directional polygon shadow plus a layered soft ambient-occlusion band
 * hugging the building's base so every structure feels firmly anchored in daylight.
 */
export function drawCastRectShadow(ctx, x, y, w, h, ht, sun) {
  const sx = sun.dx * ht;
  const sy = sun.dy * ht;
  const x2 = x + w;
  const y2 = y + h;

  ctx.save();

  // 1. Directional extruded sun shadow (feathered penumbra + crisp umbra)
  if (Math.abs(sx) >= 1 || Math.abs(sy) >= 1) {
    const traceHull = (ox, oy) => {
      ctx.beginPath();
      if (ox >= 0 && oy >= 0) {
        ctx.moveTo(x, y2);
        ctx.lineTo(x + ox, y2 + oy);
        ctx.lineTo(x2 + ox, y2 + oy);
        ctx.lineTo(x2 + ox, y + oy);
        ctx.lineTo(x2, y);
        ctx.lineTo(x2, y2);
      } else if (ox < 0 && oy >= 0) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + ox, y + oy);
        ctx.lineTo(x + ox, y2 + oy);
        ctx.lineTo(x2 + ox, y2 + oy);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x, y2);
      } else if (ox >= 0 && oy < 0) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + ox, y + oy);
        ctx.lineTo(x2 + ox, y + oy);
        ctx.lineTo(x2 + ox, y2 + oy);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, y);
      } else {
        ctx.moveTo(x2, y);
        ctx.lineTo(x2 + ox, y + oy);
        ctx.lineTo(x + ox, y + oy);
        ctx.lineTo(x + ox, y2 + oy);
        ctx.lineTo(x, y2);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    // Cool marine-slate shadow hue reads far richer than flat grey against warm ground
    const penumbraA = sun.alpha * 0.42;
    const umbraA = sun.alpha * 0.72;
    traceHull(sx * 1.07, sy * 1.07);
    ctx.fillStyle = `rgba(18, 26, 46, ${penumbraA.toFixed(3)})`;
    ctx.fill();

    traceHull(sx * 0.96, sy * 0.96);
    ctx.fillStyle = `rgba(14, 20, 38, ${umbraA.toFixed(3)})`;
    ctx.fill();
  }

  // 2. Layered ambient-occlusion band at the building base (wide soft halo + tight dark crease)
  const aoScale = 0.85 + (sun.nightFade ?? 1) * 0.15;
  ctx.fillStyle = `rgba(14, 18, 28, ${(0.11 * aoScale).toFixed(3)})`;
  ctx.beginPath();
  ctx.roundRect(x - 10, y - 10, w + 20, h + 20, 6);
  ctx.fill();

  ctx.fillStyle = `rgba(10, 14, 24, ${(0.18 * aoScale).toFixed(3)})`;
  ctx.beginPath();
  ctx.roundRect(x - 5, y - 5, w + 10, h + 10, 3);
  ctx.fill();

  ctx.fillStyle = `rgba(8, 10, 18, ${(0.28 * aoScale).toFixed(3)})`;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

  ctx.restore();
}

/** Draw a soft elliptical contact + sun-offset shadow for grounded objects (peds, props, trees). */
export function drawSoftDropShadow(ctx, x, y, rx, ry, sun, lift = 8, angle = 0) {
  ctx.save();
  ctx.translate(x + sun.dx * lift, y + sun.dy * lift);
  if (angle) ctx.rotate(angle);
  ctx.fillStyle = `rgba(16, 22, 38, ${(sun.alpha * 0.92).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 1.12, ry * 1.12, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Tighter darker contact shadow directly under the object
  ctx.save();
  ctx.translate(x + 1.0, y + 1.6);
  if (angle) ctx.rotate(angle);
  ctx.fillStyle = 'rgba(8, 12, 20, 0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.96, ry * 0.92, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Draw a crisp vehicle contact shadow + directional sun shadow that tracks the chassis. */
export function drawVehicleShadow(ctx, x, y, w, h, angle, sun, lift = 14) {
  const hw = w * 0.5;
  const hh = h * 0.5;

  // 1. Directional sun shadow cast onto asphalt
  if (sun) {
    ctx.save();
    ctx.translate(x + sun.dx * lift, y + sun.dy * lift);
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(14, 20, 36, ${(sun.alpha * 0.96).toFixed(3)})`;
    ctx.beginPath();
    ctx.roundRect(-hw - 1.2, -hh - 1.0, w + 2.4, h + 2.0, 5.5);
    ctx.fill();
    ctx.restore();
  }

  // 2. Soft ambient-occlusion shadow directly beneath the chassis
  ctx.save();
  ctx.translate(x + 0.8, y + 1.4);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(6, 9, 16, 0.24)';
  ctx.beginPath();
  ctx.roundRect(-hw - 3.0, -hh - 2.6, w + 6.0, h + 5.2, 6.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(4, 7, 12, 0.48)';
  ctx.beginPath();
  ctx.roundRect(-hw - 0.8, -hh - 0.6, w + 1.6, h + 1.2, 5);
  ctx.fill();
  ctx.restore();
}

/** World-space night multiply, warm sodium streetlamps, dockside neon & night-only mild bloom. */
export function drawWorldLighting(ctx, world, view, night, dusk, t) {
  // 1. Night & twilight color multiply (deep marine indigo, never flat grey)
  const shadeAmt = clamp(night * 0.74 + dusk * 0.22, 0, 0.78);
  if (shadeAmt > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const tint = dusk > 0.35
      ? mixColor('#ffdcc4', PALETTE.night, clamp(night * 0.62 + dusk * 0.14, 0, 0.72))
      : mixColor('#ffffff', PALETTE.night, shadeAmt);
    ctx.fillStyle = tint;
    ctx.fillRect(view.x - 40, view.y - 40, view.w + 80, view.h + 80);
    ctx.restore();
  }

  // 2. Warm sodium street lamp light pools (active through dusk and night, off in bright day)
  const lampPower = clamp(night * 1.15 + dusk * 0.72, 0, 1);
  if (lampPower > 0.14) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of world.lamps) {
      if (l.x < view.x - 110 || l.x > view.x + view.w + 110 || l.y < view.y - 110 || l.y > view.y + view.h + 110) continue;
      const armX = l.x + (l.side ? l.side * 9 : 0);
      const armY = l.y - 18 + (l.side === 0 ? 7 : 0);
      // Warm ground light pool
      const grad = ctx.createRadialGradient(armX, l.y - 2, 4, armX, l.y - 2, 102);
      grad.addColorStop(0, `rgba(255, 198, 102, ${(0.29 * lampPower).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(255, 160, 66, ${(0.12 * lampPower).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255, 140, 48, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(armX, l.y - 2, 102, 0, TAU);
      ctx.fill();

      // Mild night-only highlight bloom around the luminaire head
      const bloomR = 20 + night * 14;
      const bulb = ctx.createRadialGradient(armX, armY, 1, armX, armY, bloomR);
      bulb.addColorStop(0, `rgba(255, 244, 206, ${(0.62 * lampPower).toFixed(3)})`);
      bulb.addColorStop(0.45, `rgba(255, 198, 108, ${(0.22 * night).toFixed(3)})`);
      bulb.addColorStop(1, 'rgba(255, 180, 88, 0)');
      ctx.fillStyle = bulb;
      ctx.beginPath();
      ctx.arc(armX, armY, bloomR, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. Neon signs near docks & Midtown — crisp unlit/subtle by day, rich glow & mild bloom at dusk/night
  const neonPower = clamp(night * 1.05 + dusk * 0.72, 0, 1);
  if (neonPower > 0.08 && world.neonSigns && world.neonSigns.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const n of world.neonSigns) {
      if (n.x < view.x - 160 || n.x > view.x + view.w + 160 || n.y < view.y - 160 || n.y > view.y + view.h + 160) continue;
      const flicker = n.flicker && Math.sin(t * 23 + n.ph) > 0.92 ? 0.55 : 1;
      const p = neonPower * flicker;
      const r = (n.radius || 115) * (0.9 + night * 0.22);
      const grad = ctx.createRadialGradient(n.x, n.y, 4, n.x, n.y, r);
      grad.addColorStop(0, `rgba(${n.rgb}, ${(0.44 * p).toFixed(3)})`);
      grad.addColorStop(0.42, `rgba(${n.rgb}, ${(0.18 * p).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${n.rgb}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, TAU);
      ctx.fill();

      // Mild secondary night highlight bloom core (silky glow, no harsh clipping)
      if (night > 0.35) {
        const coreR = Math.max(n.w, n.h) * 0.62;
        const core = ctx.createRadialGradient(n.x, n.y, 2, n.x, n.y, coreR);
        core.addColorStop(0, `rgba(255, 248, 255, ${(0.16 * night * flicker).toFixed(3)})`);
        core.addColorStop(0.5, `rgba(${n.rgb}, ${(0.16 * night * flicker).toFixed(3)})`);
        core.addColorStop(1, `rgba(${n.rgb}, 0)`);
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(n.x, n.y, coreR, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

/**
 * Screen-space colour grading: crisp sunlit morning, warm afternoon/golden-hour tint,
 * coral-indigo dusk wash, deep night balance, optional rain streaks & subtle vignette.
 */
export function drawScreenAtmosphere(ctx, cssW, cssH, dusk, night, t, rain, hour = 14) {
  const morning = hour >= 6.0 && hour <= 10.5 ? Math.exp(-(((hour - 8.1) / 1.9) ** 2)) : 0;
  const afternoon = hour >= 13.5 && hour <= 18.8 ? Math.exp(-(((hour - 16.8) / 2.2) ** 2)) : 0;
  const golden = hour >= 16.0 && hour <= 18.8 ? Math.exp(-(((hour - 17.35) / 1.05) ** 2)) : 0;

  // 1. Cohesive daytime & twilight colour grade
  if (dusk > 0.08) {
    ctx.save();
    const skyGrad = ctx.createLinearGradient(0, 0, cssW, cssH);
    skyGrad.addColorStop(0, `rgba(255, 134, 66, ${(0.21 * dusk).toFixed(3)})`);
    skyGrad.addColorStop(0.5, `rgba(224, 86, 130, ${(0.10 * dusk).toFixed(3)})`);
    skyGrad.addColorStop(1, `rgba(32, 44, 104, ${(0.15 * dusk).toFixed(3)})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.restore();
  }

  if (night < 0.25) {
    ctx.save();
    if (golden > 0.15) {
      // Rich warm golden-hour honey/amber grade across the whole frame
      const gGrad = ctx.createLinearGradient(0, 0, cssW, cssH);
      gGrad.addColorStop(0, `rgba(255, 192, 92, ${(0.22 * golden).toFixed(3)})`);
      gGrad.addColorStop(0.55, `rgba(255, 168, 82, ${(0.14 * golden).toFixed(3)})`);
      gGrad.addColorStop(1, `rgba(196, 108, 68, ${(0.09 * golden).toFixed(3)})`);
      ctx.fillStyle = gGrad;
      ctx.fillRect(0, 0, cssW, cssH);
    } else if (morning > 0.15) {
      // Crisp sunlit coastal morning: warm eastern sun corner + cool fresh shadow balance
      const mGrad = ctx.createLinearGradient(cssW, 0, 0, cssH);
      mGrad.addColorStop(0, `rgba(255, 232, 176, ${(0.13 * morning).toFixed(3)})`);
      mGrad.addColorStop(0.55, `rgba(255, 240, 206, ${(0.05 * morning).toFixed(3)})`);
      mGrad.addColorStop(1, `rgba(42, 92, 128, ${(0.06 * morning).toFixed(3)})`);
      ctx.fillStyle = mGrad;
      ctx.fillRect(0, 0, cssW, cssH);
    } else {
      // Warm afternoon coastal tint (keeps midday & afternoon cohesive and sunlit)
      const warmA = 0.06 + afternoon * 0.07;
      const sunGrad = ctx.createLinearGradient(0, 0, cssW, cssH);
      sunGrad.addColorStop(0, `rgba(255, 224, 162, ${warmA.toFixed(3)})`);
      sunGrad.addColorStop(1, `rgba(220, 168, 104, ${(warmA * 0.45).toFixed(3)})`);
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, cssW, cssH);
    }
    ctx.restore();
  }

  // 2. Optional rain streaks & subtle wet-pavement sheen
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

  // 3. Subtle cinematic vignette (gentle by day, deeper at night)
  const vig = ctx.createRadialGradient(
    cssW * 0.5, cssH * 0.5, Math.min(cssW, cssH) * 0.45,
    cssW * 0.5, cssH * 0.5, Math.hypot(cssW, cssH) * 0.58
  );
  vig.addColorStop(0, 'rgba(6, 10, 18, 0)');
  vig.addColorStop(0.75, `rgba(6, 10, 18, ${(0.09 + night * 0.08).toFixed(3)})`);
  vig.addColorStop(1, `rgba(4, 8, 16, ${(0.24 + night * 0.18 + dusk * 0.08).toFixed(3)})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, cssW, cssH);
}
