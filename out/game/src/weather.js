// Rain weather system: wind-slanted multi-layer raindrops, wet road sheen,
// organic road puddles with night/dusk street-lamp & neon reflections,
// speed-reactive screen-edge lens droplets, and subtle thunder flashes.

import { CITY, CITY_SEED } from './config.js';
import { TAU, clamp, damp, hash01, makeRng, range } from './util.js';

const EDGE_DROP_COUNT = 54;

/** Normalize external weather strings/booleans into 'dry' or 'rain'. */
export function normalizeWeather(mode) {
  if (mode === true) return 'rain';
  if (mode === false || mode == null) return 'dry';
  const s = String(mode).trim().toLowerCase();
  if (s === 'rain' || s === 'rainy' || s === 'storm' || s === 'wet') return 'rain';
  return 'dry';
}

/** Generate deterministic road puddles pre-linked to nearby street lamps and neon signs. */
function generatePuddles(world, seed) {
  const rng = makeRng((seed ^ 0x71a2b3c4) >>> 0);
  const puddles = [];
  const { roadsV, roadsH, lamps = [], neonSigns = [], isWater } = world;
  const roadEndY = roadsH[CITY.rows - 1] + CITY.roadHalf;

  function nearIntersection(x, y) {
    const nearV = roadsV.some((v) => Math.abs(x - v) < 42);
    const nearH = roadsH.some((h) => Math.abs(y - h) < 42);
    return nearV && nearH;
  }

  function makePuddle(x, y, orient, roadCenter) {
    if (x < 30 || x > CITY.eastX - 24 || y < 30 || y > roadEndY - 12) return null;
    if (isWater && isWater(x, y)) return null;
    const along = orient === 'v';
    const rx = along ? range(rng, 8, 13) : range(rng, 16, 28);
    const ry = along ? range(rng, 16, 28) : range(rng, 8, 13);
    // Keep puddle + lobes strictly inside the asphalt curbs
    const maxOff = CITY.roadHalf - (along ? rx : ry) - 4;
    const clampedX = along ? clamp(x, roadCenter - maxOff, roadCenter + maxOff) : x;
    const clampedY = along ? y : clamp(y, roadCenter - maxOff, roadCenter + maxOff);
    const angle = range(rng, -0.14, 0.14);
    const lobes = [
      { ox: range(rng, -rx * 0.36, rx * 0.36), oy: range(rng, -ry * 0.36, ry * 0.36), rx: rx * range(rng, 0.48, 0.66), ry: ry * range(rng, 0.48, 0.66) },
      { ox: range(rng, -rx * 0.36, rx * 0.36), oy: range(rng, -ry * 0.36, ry * 0.36), rx: rx * range(rng, 0.38, 0.54), ry: ry * range(rng, 0.38, 0.54) },
    ];
    return {
      x: clampedX,
      y: clampedY,
      rx,
      ry,
      angle,
      lobes,
      ph: range(rng, 0, TAU),
      lamps: [],
      neons: [],
    };
  }

  function overlapsExisting(x, y, minDist = 42) {
    for (let i = 0; i < puddles.length; i += 1) {
      const p = puddles[i];
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < minDist * minDist) return true;
    }
    return false;
  }

  // 1. Place glossy curb-lane puddles near street lamps so night reflections pop along every street
  for (let i = 0; i < lamps.length; i += 1) {
    if (rng() > 0.68) continue;
    const l = lamps[i];
    let px = l.x;
    let py = l.y;
    let orient = 'v';
    let center = l.x;
    if (l.side === 1) {
      center = l.x + CITY.roadHalf + 8;
      px = center - range(rng, 6, 13);
      py = l.y + range(rng, -18, 18);
      orient = 'v';
    } else if (l.side === -1) {
      center = l.x - CITY.roadHalf - 8;
      px = center + range(rng, 6, 13);
      py = l.y + range(rng, -18, 18);
      orient = 'v';
    } else {
      center = l.y + CITY.roadHalf + 8;
      px = l.x + range(rng, -20, 20);
      py = center - range(rng, 6, 13);
      orient = 'h';
    }
    if (nearIntersection(px, py) || overlapsExisting(px, py, 46)) continue;
    const pd = makePuddle(px, py, orient, center);
    if (pd) puddles.push(pd);
  }

  // 2. Additional mid-block puddles along vertical & horizontal avenues
  for (let i = 0; i < roadsV.length; i += 1) {
    const vx = roadsV[i];
    for (let j = 0; j < roadsH.length - 1; j += 1) {
      if (rng() > 0.55) continue;
      const px = vx + (rng() < 0.5 ? -1 : 1) * range(rng, 5, 13);
      const py = roadsH[j] + range(rng, 78, CITY.pitch - 78);
      if (overlapsExisting(px, py, 50)) continue;
      const pd = makePuddle(px, py, 'v', vx);
      if (pd) puddles.push(pd);
    }
  }
  for (let j = 0; j < roadsH.length; j += 1) {
    const hy = roadsH[j];
    for (let i = 0; i < roadsV.length - 1; i += 1) {
      if (rng() > 0.58) continue;
      const px = roadsV[i] + range(rng, 78, CITY.pitch - 78);
      const py = hy + (rng() < 0.5 ? -1 : 1) * range(rng, 5, 13);
      if (overlapsExisting(px, py, 50)) continue;
      const pd = makePuddle(px, py, 'h', hy);
      if (pd) puddles.push(pd);
    }
  }

  // 3. Pre-link nearby street lamps and neon signs for O(1) reflection rendering per visible puddle
  for (let i = 0; i < puddles.length; i += 1) {
    const pd = puddles[i];
    for (let k = 0; k < lamps.length; k += 1) {
      const l = lamps[k];
      const armX = l.x + (l.side ? l.side * 9 : 0);
      const armY = l.y - 4 + (l.side === 0 ? 7 : 0);
      const d = Math.hypot(armX - pd.x, armY - pd.y);
      if (d < 138) {
        pd.lamps.push({ x: armX, y: armY, dist: d, strength: clamp(1 - d / 138, 0.15, 1) });
      }
    }
    for (let k = 0; k < neonSigns.length; k += 1) {
      const n = neonSigns[k];
      const d = Math.hypot(n.x - pd.x, n.y - pd.y);
      if (d < 175) {
        pd.neons.push({
          x: n.x,
          y: n.y,
          rgb: n.rgb,
          flicker: n.flicker,
          ph: n.ph,
          strength: clamp(1 - d / 175, 0.15, 1),
        });
      }
    }
  }

  return puddles;
}

/** Place one droplet randomly around the outer screen perimeter, keeping center unobstructed. */
function seedEdgeDroplet(drop, rng, staggerLife = false) {
  const edge = Math.floor(rng() * 4); // 0=left, 1=right, 2=top, 3=bottom
  const depth = 0.012 + (rng() ** 1.65) * 0.105;
  if (edge === 0) {
    drop.nx = depth;
    drop.ny = range(rng, 0.04, 0.96);
  } else if (edge === 1) {
    drop.nx = 1 - depth;
    drop.ny = range(rng, 0.04, 0.96);
  } else if (edge === 2) {
    drop.nx = range(rng, 0.04, 0.96);
    drop.ny = depth * 1.15;
  } else {
    drop.nx = range(rng, 0.04, 0.96);
    drop.ny = 1 - depth * 1.15;
  }
  drop.r = range(rng, 3.0, 6.8);
  drop.life = range(rng, 1.4, 3.6);
  drop.age = staggerLife ? range(rng, 0, drop.life) : 0;
  drop.slide = range(rng, 0.65, 1.45);
  drop.seed = rng();
}

/** Create the weather state bound to a world instance (defaults to dry). */
export function createWeatherState(world, seed = CITY_SEED) {
  const rng = makeRng((seed ^ 0x41c64e6d) >>> 0);
  const puddles = generatePuddles(world, seed);

  const edgeDrops = [];
  for (let i = 0; i < EDGE_DROP_COUNT; i += 1) {
    const drop = { nx: 0, ny: 0, r: 3, age: 0, life: 2, slide: 1, seed: 0 };
    seedEdgeDroplet(drop, rng, true);
    edgeDrops.push(drop);
  }

  return {
    mode: 'dry',
    wetness: 0,
    windX: -0.34,
    speedFactor: 0,
    thunderTimer: 5.5,
    thunderFlash: 0,
    thunderPulse: 0,
    thunderAge: 10,
    thunderX: 0.72,
    puddles,
    edgeDrops,
    rng,
  };
}

/** Switch weather mode ('dry' | 'rain'). When immediate is true, snap wetness with no ramp delay. */
export function setWeatherMode(weather, mode, immediate = false) {
  const next = normalizeWeather(mode);
  const changed = weather.mode !== next;
  weather.mode = next;
  if (next === 'rain') {
    if (immediate) {
      weather.wetness = 1;
    } else if (weather.wetness < 0.35) {
      weather.wetness = 0.35;
    }
    if (changed || immediate) {
      weather.thunderTimer = 4.2 + weather.rng() * 5.0;
    }
  } else {
    if (immediate) {
      weather.wetness = 0;
    }
    weather.thunderFlash = 0;
    weather.thunderPulse = 0;
    weather.thunderAge = 10;
  }
  return weather.mode;
}

/** Step rain dynamics, wind gusting, speed-driven edge droplets and subtle thunder flashes. */
export function updateWeather(weather, dt, player, elapsed) {
  const isRain = weather.mode === 'rain';
  const targetWet = isRain ? 1 : 0;
  weather.wetness = damp(weather.wetness, targetWet, isRain ? 2.6 : 3.2, dt);
  if (!isRain && weather.wetness < 0.005) weather.wetness = 0;
  if (isRain && weather.wetness > 0.995) weather.wetness = 1;

  // Smoothly gusting harbor wind slant (blowing right-to-left as rain falls)
  const targetWind = -0.32 - 0.09 * Math.sin(elapsed * 0.42) - 0.05 * Math.sin(elapsed * 1.17 + 1.1);
  weather.windX = damp(weather.windX, targetWind, 3.0, dt);

  // Measure player / vehicle movement speed for screen-edge droplets
  let vx = player ? player.vx : 0;
  let vy = player ? player.vy : 0;
  if (player && player.inCar) {
    vx = player.inCar.vx;
    vy = player.inCar.vy;
  }
  const speed = Math.hypot(vx, vy);
  const targetSpeedFactor = isRain ? clamp((speed - 65) / 225, 0, 1) : 0;
  weather.speedFactor = damp(weather.speedFactor, targetSpeedFactor, 4.5, dt);

  // Update perimeter droplets when moving fast in rain
  if (weather.wetness > 0.05) {
    const sf = weather.speedFactor;
    for (let i = 0; i < weather.edgeDrops.length; i += 1) {
      const d = weather.edgeDrops[i];
      d.age += dt * (0.45 + sf * 1.45);
      // Drift radially outward from screen center and slightly down with gravity + wind
      const cx = d.nx - 0.5;
      const cy = d.ny - 0.5;
      const push = (0.012 + sf * 0.115) * d.slide * dt;
      d.nx += cx * push + weather.windX * 0.008 * dt;
      d.ny += cy * push + (0.018 + sf * 0.025) * d.slide * dt;
      if (d.age >= d.life || d.nx < -0.02 || d.nx > 1.02 || d.ny < -0.02 || d.ny > 1.02) {
        seedEdgeDroplet(d, weather.rng, false);
      }
    }
  }

  // Subtle thunder flash scheduling & double-flicker envelope
  let thunderTriggered = false;
  if (isRain) {
    weather.thunderTimer -= dt;
    if (weather.thunderTimer <= 0) {
      weather.thunderAge = 0;
      weather.thunderX = 0.18 + weather.rng() * 0.64;
      weather.thunderTimer = 9.5 + weather.rng() * 8.5;
      thunderTriggered = true;
    }
  }

  if (weather.thunderAge < 1.2) {
    weather.thunderAge += dt;
    const a = weather.thunderAge;
    // Crisp initial sheet flash + subtle secondary flutter 0.14s later
    const p1 = Math.exp(-(((a - 0.045) / 0.042) ** 2));
    const p2 = 0.62 * Math.exp(-(((a - 0.19) / 0.055) ** 2));
    const tail = Math.max(0, 1 - a / 0.72) * 0.18;
    weather.thunderFlash = clamp((p1 + p2 + tail) * (isRain ? 1 : 0.4), 0, 1);
  } else {
    weather.thunderFlash = 0;
  }

  return { thunderTriggered };
}

/** Trace an organic multi-lobe puddle silhouette centered at (p.x, p.y). */
function tracePuddlePath(ctx, p, expand = 0) {
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, p.rx + expand, p.ry + expand, p.angle, 0, TAU);
  for (let i = 0; i < p.lobes.length; i += 1) {
    const lb = p.lobes[i];
    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);
    const lx = p.x + lb.ox * cos - lb.oy * sin;
    const ly = p.y + lb.ox * sin + lb.oy * cos;
    ctx.moveTo(lx + lb.rx + expand, ly);
    ctx.ellipse(lx, ly, lb.rx + expand, lb.ry + expand, p.angle * 0.7, 0, TAU);
  }
}

/**
 * Draw wet road sheen and road puddle bases in world space (under vehicles, peds & buildings).
 */
export function drawWetRoadsAndPuddles(ctx, weather, world, view, night, dusk, t) {
  const wet = weather ? weather.wetness : 0;
  if (wet <= 0.01) return;

  const roadEndY = world.roadsH[CITY.rows - 1] + CITY.roadHalf;
  const rh = CITY.roadHalf;

  ctx.save();

  // 1. Wet asphalt darkening + cool specular road sheen along vertical & horizontal streets
  const darkA = (0.20 + night * 0.14 + dusk * 0.06) * wet;
  const sheenA = (0.12 + dusk * 0.07 + night * 0.06) * wet;
  const sheenRgb = dusk > 0.35 ? '186, 178, 214' : night > 0.45 ? '116, 152, 206' : '176, 204, 224';

  for (let i = 0; i < world.roadsV.length; i += 1) {
    const v = world.roadsV[i];
    if (v + rh < view.x || v - rh > view.x + view.w) continue;
    const y0 = Math.max(0, view.y - 20);
    const y1 = Math.min(roadEndY, view.y + view.h + 20);
    if (y1 <= y0) continue;

    ctx.fillStyle = `rgba(10, 15, 24, ${darkA.toFixed(3)})`;
    ctx.fillRect(v - rh, y0, rh * 2, y1 - y0);

    const g = ctx.createLinearGradient(v - rh, 0, v + rh, 0);
    g.addColorStop(0, `rgba(${sheenRgb}, 0)`);
    g.addColorStop(0.24, `rgba(${sheenRgb}, ${(sheenA * 0.95).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(${sheenRgb}, ${(sheenA * 0.38).toFixed(3)})`);
    g.addColorStop(0.76, `rgba(${sheenRgb}, ${(sheenA * 0.85).toFixed(3)})`);
    g.addColorStop(1, `rgba(${sheenRgb}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(v - rh, y0, rh * 2, y1 - y0);
  }

  for (let j = 0; j < world.roadsH.length; j += 1) {
    const h = world.roadsH[j];
    if (h + rh < view.y || h - rh > view.y + view.h) continue;
    const x0 = Math.max(0, view.x - 20);
    const x1 = Math.min(CITY.eastX, view.x + view.w + 20);
    if (x1 <= x0) continue;

    ctx.fillStyle = `rgba(10, 15, 24, ${darkA.toFixed(3)})`;
    ctx.fillRect(x0, h - rh, x1 - x0, rh * 2);

    const g = ctx.createLinearGradient(0, h - rh, 0, h + rh);
    g.addColorStop(0, `rgba(${sheenRgb}, 0)`);
    g.addColorStop(0.26, `rgba(${sheenRgb}, ${(sheenA * 0.95).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(${sheenRgb}, ${(sheenA * 0.38).toFixed(3)})`);
    g.addColorStop(0.74, `rgba(${sheenRgb}, ${(sheenA * 0.85).toFixed(3)})`);
    g.addColorStop(1, `rgba(${sheenRgb}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x0, h - rh, x1 - x0, rh * 2);
  }

  // 2. Organic road puddles with sky glaze and animated raindrop impact ripples
  const skyFill = night > 0.55
    ? `rgba(26, 44, 74, ${(0.62 * wet).toFixed(3)})`
    : dusk > 0.32
      ? `rgba(74, 72, 108, ${(0.54 * wet).toFixed(3)})`
      : `rgba(92, 126, 152, ${(0.48 * wet).toFixed(3)})`;
  const rimStroke = `rgba(182, 214, 236, ${(0.24 * wet).toFixed(3)})`;

  for (let i = 0; i < weather.puddles.length; i += 1) {
    const p = weather.puddles[i];
    if (p.x + p.rx + 20 < view.x || p.x - p.rx - 20 > view.x + view.w) continue;
    if (p.y + p.ry + 20 < view.y || p.y - p.ry - 20 > view.y + view.h) continue;

    // Dark wet soaked asphalt margin around puddle
    tracePuddlePath(ctx, p, 3.2);
    ctx.fillStyle = `rgba(8, 12, 20, ${(0.36 * wet).toFixed(3)})`;
    ctx.fill();

    // Glossy water surface
    tracePuddlePath(ctx, p, 0);
    ctx.fillStyle = skyFill;
    ctx.fill();
    ctx.strokeStyle = rimStroke;
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Subtle raindrop ripple rings inside the puddle
    for (let r = 0; r < 2; r += 1) {
      const cycle = (t * 1.9 + p.ph + r * 0.51) % 1;
      const slot = Math.floor(t * 1.9 + p.ph + r * 0.51);
      const rxOff = (hash01(slot * 31 + i * 17 + r * 7) - 0.5) * p.rx * 1.1;
      const ryOff = (hash01(slot * 47 + i * 29 + r * 13) - 0.5) * p.ry * 1.1;
      const rad = 1.6 + cycle * Math.min(p.rx, p.ry) * 0.52;
      ctx.strokeStyle = `rgba(216, 240, 255, ${((1 - cycle) * 0.34 * wet).toFixed(3)})`;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.ellipse(p.x + rxOff, p.y + ryOff, rad, rad * 0.62, 0, 0, TAU);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Draw luminous night/dusk reflections of street lamps, neon signs and nearby vehicle lights
 * clipped inside each road puddle (called after world night multiply so reflections gleam).
 */
export function drawPuddleReflections(ctx, weather, world, view, night, dusk, t, vehicles = []) {
  const wet = weather ? weather.wetness : 0;
  if (wet <= 0.02) return;

  const lampPower = clamp(night * 1.18 + dusk * 0.72, 0, 1);
  if (lampPower <= 0.1) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // 1. Subtle elongated wet-road specular strip beneath each visible street lamp
  for (let i = 0; i < world.lamps.length; i += 1) {
    const l = world.lamps[i];
    if (l.x < view.x - 110 || l.x > view.x + view.w + 110 || l.y < view.y - 110 || l.y > view.y + view.h + 110) continue;
    const rx = l.x + (l.side ? l.side * 16 : 0);
    const ry = l.y + (l.side === 0 ? 15 : 0);
    const grad = ctx.createRadialGradient(rx, ry, 3, rx, ry, 62);
    grad.addColorStop(0, `rgba(255, 206, 118, ${(0.18 * lampPower * wet).toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(255, 166, 74, ${(0.07 * lampPower * wet).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255, 150, 60, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(rx, ry, l.side === 0 ? 52 : 34, l.side === 0 ? 28 : 54, 0, 0, TAU);
    ctx.fill();
  }

  // Filter nearby illuminated vehicles once for quick puddle reflection checks
  const litCars = [];
  for (let i = 0; i < vehicles.length; i += 1) {
    const v = vehicles[i];
    if (v.x < view.x - 120 || v.x > view.x + view.w + 120 || v.y < view.y - 120 || v.y > view.y + view.h + 120) continue;
    litCars.push(v);
  }

  // 2. Clipped shimmering puddle reflections for street lamps, neon signs & nearby headlights
  for (let i = 0; i < weather.puddles.length; i += 1) {
    const p = weather.puddles[i];
    if (p.x + p.rx + 18 < view.x || p.x - p.rx - 18 > view.x + view.w) continue;
    if (p.y + p.ry + 18 < view.y || p.y - p.ry - 18 > view.y + view.h) continue;

    // Skip reflection if a vehicle chassis overlaps the puddle
    let occluded = false;
    for (let c = 0; c < litCars.length; c += 1) {
      const v = litCars[c];
      const dx = v.x - p.x;
      const dy = v.y - p.y;
      if (dx * dx + dy * dy < 1150) {
        occluded = true;
        break;
      }
    }
    if (occluded) continue;

    const hasStatic = p.lamps.length > 0 || p.neons.length > 0;
    let nearCar = null;
    for (let c = 0; c < litCars.length; c += 1) {
      const v = litCars[c];
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d < 98 && (v.driver || v._headlightsOn || v.type === 'police')) {
        nearCar = v;
        break;
      }
    }
    if (!hasStatic && !nearCar) continue;

    ctx.save();
    tracePuddlePath(ctx, p, -0.5);
    ctx.clip();

    // Reflected street lamps: warm amber-gold shimmer + water-ripple streaks inside the dark puddle
    for (let k = 0; k < p.lamps.length; k += 1) {
      const lp = p.lamps[k];
      const cx = p.x + clamp((lp.x - p.x) * 0.24, -p.rx * 0.45, p.rx * 0.45);
      const cy = p.y + clamp((lp.y - p.y) * 0.24, -p.ry * 0.45, p.ry * 0.45);
      const shimmer = 0.86 + 0.14 * Math.sin(t * 5.2 + p.ph + k * 1.7);
      const pwr = lampPower * wet * lp.strength * shimmer;
      const rad = Math.min(p.rx, p.ry) * 1.25;

      const grad = ctx.createRadialGradient(cx, cy, 1.0, cx, cy, rad);
      grad.addColorStop(0, `rgba(255, 224, 146, ${(0.46 * pwr).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(255, 174, 72, ${(0.24 * pwr).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255, 140, 48, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - p.rx - 14, p.y - p.ry - 14, (p.rx + 14) * 2, (p.ry + 14) * 2);

      // Rippled amber-gold specular streaks across the puddle surface
      ctx.fillStyle = `rgba(255, 232, 168, ${(0.34 * pwr).toFixed(3)})`;
      for (let s = -2; s <= 2; s += 1) {
        const wob = Math.sin(t * 6.5 + p.ph + s * 1.9) * 2.4;
        const sw = (9.5 - Math.abs(s) * 2.1) * (0.65 + 0.35 * lp.strength);
        ctx.fillRect(cx - sw * 0.5 + wob, cy + s * 2.9, sw, 1.2);
      }
    }

    // Reflected neon signs near docks & Midtown
    for (let k = 0; k < p.neons.length; k += 1) {
      const n = p.neons[k];
      const flick = n.flicker && Math.sin(t * 23 + n.ph) > 0.92 ? 0.55 : 1;
      const pwr = lampPower * wet * n.strength * flick;
      const cx = p.x + clamp((n.x - p.x) * 0.22, -p.rx * 0.45, p.rx * 0.45);
      const cy = p.y + clamp((n.y - p.y) * 0.22, -p.ry * 0.45, p.ry * 0.45);
      const rad = Math.min(p.rx, p.ry) * 1.2;
      const grad = ctx.createRadialGradient(cx, cy, 1.2, cx, cy, rad);
      grad.addColorStop(0, `rgba(${n.rgb}, ${(0.46 * pwr).toFixed(3)})`);
      grad.addColorStop(0.55, `rgba(${n.rgb}, ${(0.18 * pwr).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${n.rgb}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - p.rx - 14, p.y - p.ry - 14, (p.rx + 14) * 2, (p.ry + 14) * 2);
    }

    // Brief headlight or police strobe glint from a nearby passing vehicle
    if (nearCar) {
      const isPolice = nearCar.type === 'police';
      const strobe = isPolice ? (Math.sin(t * 14 + p.ph) > 0 ? '255, 76, 86' : '74, 152, 255') : '255, 228, 170';
      const pwr = lampPower * wet * 0.36;
      const rad = Math.min(p.rx, p.ry) * 1.1;
      const grad = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, rad);
      grad.addColorStop(0, `rgba(${strobe}, ${(0.45 * pwr).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${strobe}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - p.rx - 12, p.y - p.ry - 12, (p.rx + 12) * 2, (p.ry + 12) * 2);
    }

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draw screen-space rain effects: overcast slate wash, multi-layer wind-slanted falling
 * raindrops, speed-reactive screen-edge lens droplets, and subtle thunder flash.
 */
export function drawRainOverlay(ctx, weather, cssW, cssH, night, dusk, t, cam = null) {
  const wet = weather ? weather.wetness : 0;
  if (wet <= 0.01) return;

  const windX = weather.windX;
  const camX = cam ? cam.x : 0;
  const camY = cam ? cam.y : 0;

  ctx.save();

  // 1. Cool stormy overcast grade
  const tintA = (0.11 + night * 0.05) * wet;
  ctx.fillStyle = `rgba(14, 26, 44, ${tintA.toFixed(3)})`;
  ctx.fillRect(0, 0, cssW, cssH);

  // 2. Multi-layer wind-slanted raindrops (far mist, mid rainfall, near fast streaks)
  const layers = [
    { count: 104, speed: 660, len: 16, width: 0.85, alpha: 0.18, parallax: 0.25 },
    { count: 148, speed: 940, len: 26, width: 1.15, alpha: 0.30, parallax: 0.52 },
    { count: 56, speed: 1280, len: 38, width: 1.5, alpha: 0.40, parallax: 0.85 },
  ];
  const padX = 120;
  const padY = 90;
  const spanX = cssW + padX * 2;
  const spanY = cssH + padY * 2;

  ctx.lineCap = 'round';
  for (let li = 0; li < layers.length; li += 1) {
    const L = layers[li];
    const vx = windX * L.speed;
    const vy = L.speed;
    const dx = windX * L.len;
    const dy = L.len;
    const bright = night > 0.45 ? '184, 214, 240' : '212, 234, 248';
    const flashBoost = weather.thunderFlash * 0.22;

    ctx.strokeStyle = `rgba(${bright}, ${clamp((L.alpha + flashBoost) * wet, 0, 0.72).toFixed(3)})`;
    ctx.lineWidth = L.width;
    ctx.beginPath();
    for (let i = 0; i < L.count; i += 1) {
      const id = li * 300 + i;
      const sx = hash01(id * 19 + 3) * spanX;
      const sy = hash01(id * 37 + 11) * spanY;
      const rx = (((sx + t * vx - camX * L.parallax) % spanX) + spanX) % spanX - padX;
      const ry = (((sy + t * vy - camY * L.parallax) % spanY) + spanY) % spanY - padY;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + dx, ry + dy);
    }
    ctx.stroke();
  }

  // 3. Subtle scattered rain splash rings across the frame
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 20; i += 1) {
    const life = (t * 2.5 + i * 0.39) % 1;
    const cycle = Math.floor(t * 2.5 + i * 0.39);
    const sx = hash01(cycle * 53 + i * 19) * cssW;
    const sy = hash01(cycle * 71 + i * 29) * cssH;
    ctx.strokeStyle = `rgba(210, 236, 250, ${((1 - life) * 0.24 * wet).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 1.8 + life * 6.5, 1.0 + life * 3.4, 0, 0, TAU);
    ctx.stroke();
  }

  // 4. Droplets clinging to and streaking along screen edges at speed
  const sf = weather.speedFactor;
  if (sf > 0.03) {
    const warmCatch = clamp(night * 0.8 + dusk * 0.5, 0, 1);
    for (let i = 0; i < weather.edgeDrops.length; i += 1) {
      const d = weather.edgeDrops[i];
      const fadeIn = clamp(d.age / 0.22, 0, 1);
      const fadeOut = clamp((d.life - d.age) / 0.45, 0, 1);
      const a = Math.min(fadeIn, fadeOut) * sf * wet;
      if (a <= 0.015) continue;

      const x = d.nx * cssW;
      const y = d.ny * cssH;
      const dx = x - cssW * 0.5;
      const dy = y - cssH * 0.5;
      const ang = Math.atan2(dy + 120 * (1 - sf * 0.5), dx);
      const stretch = 1 + sf * (1.2 + d.seed * 1.1);
      const r = d.r * (0.78 + sf * 0.32);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);

      // Subtle trailing water streak behind fast-sliding edge droplets
      if (sf > 0.22) {
        const tailLen = r * (1.8 + sf * 3.4);
        const tailGrad = ctx.createLinearGradient(-tailLen, 0, r * 0.5, 0);
        tailGrad.addColorStop(0, 'rgba(196, 226, 246, 0)');
        tailGrad.addColorStop(1, `rgba(206, 232, 248, ${(0.22 * a).toFixed(3)})`);
        ctx.strokeStyle = tailGrad;
        ctx.lineWidth = r * 0.68;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-tailLen, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
      }

      // Translucent glass bead body
      ctx.fillStyle = `rgba(182, 220, 246, ${(0.34 * a).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * stretch, r * 0.82, 0, 0, TAU);
      ctx.fill();

      // Refractive dark lower edge + crisp pale rim
      ctx.strokeStyle = `rgba(12, 24, 42, ${(0.42 * a).toFixed(3)})`;
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // Specular highlight glint (picks up subtle warm sodium tint at night)
      const glintCol = warmCatch > 0.35
        ? `rgba(255, 244, 218, ${(0.85 * a).toFixed(3)})`
        : `rgba(246, 252, 255, ${(0.85 * a).toFixed(3)})`;
      ctx.fillStyle = glintCol;
      ctx.beginPath();
      ctx.ellipse(-r * 0.26, -r * 0.24, r * 0.42, r * 0.25, -0.35, 0, TAU);
      ctx.fill();

      ctx.restore();
    }
  }

  // 5. Subtle thunder / sheet-lightning flash
  if (weather.thunderFlash > 0.01) {
    const f = weather.thunderFlash;
    const peak = (0.16 + night * 0.11 + dusk * 0.05) * f;
    const lx = weather.thunderX * cssW;
    const flashGrad = ctx.createRadialGradient(lx, 0, 20, lx, cssH * 0.35, Math.max(cssW, cssH) * 0.95);
    flashGrad.addColorStop(0, `rgba(222, 238, 255, ${(peak * 1.25).toFixed(3)})`);
    flashGrad.addColorStop(0.5, `rgba(186, 214, 252, ${(peak * 0.68).toFixed(3)})`);
    flashGrad.addColorStop(1, `rgba(150, 188, 238, ${(peak * 0.24).toFixed(3)})`);
    ctx.fillStyle = flashGrad;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  ctx.restore();
}
