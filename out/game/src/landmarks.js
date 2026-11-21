// Distinct procedural city landmarks: Midtown construction site (crane, scaffolding, dirt,
// fencing), Palmetto central park (pond, bandstand, jogging paths), Blackwater Arena stadium,
// harbour cargo pier & lighthouse, beachfront timber boardwalk, rubble lots and gardens/pools.

import { CITY, PALETTE } from './config.js';
import { TAU, hash01, int, range, rectsOverlap, shade } from './util.js';
import { drawCastRectShadow, drawSoftDropShadow } from './lighting.js';

const LEAN = 0.0012;

/** Build the Midtown Construction Site landmark block (5,3) — crane, scaffolding, dirt & fencing. */
export function buildConstructionLandmark(blk, ctx) {
  const { addBuilding, props, landmarks } = ctx;
  const { x, y, w, h } = blk;

  landmarks.constructionSites.push({ x: x + 8, y: y + 8, w: w - 16, h: h - 16 });

  // Half-built concrete & steel tower core wrapped in 3D scaffolding (solid collision!)
  addBuilding({
    x: x + 36,
    y: y + 36,
    w: 136,
    h: 132,
    kind: 'construction_core',
    ht: 118,
    material: 'concrete',
    color: '#9e9b94',
    roof: '#8c8a84',
    trim: '#d8c27a',
    seed: 5301,
    scaffolding: true,
  });

  // Portable site office trailer (white/blue metal cabin)
  addBuilding({
    x: x + 206,
    y: y + 236,
    w: 94,
    h: 42,
    kind: 'container',
    ht: 24,
    material: 'corrugated',
    color: '#3c729c',
    roof: '#d8dde2',
    seed: 5309,
  });

  // Towering yellow lattice construction crane spanning right over the half-built scaffolding core
  props.push({
    kind: 'tower_crane',
    x: x + 236,
    y: y + 154,
    ph: 0.8,
    jibAngle: -2.84,
    jibLen: 152,
  });
}

/** Build the expanded Palmetto Central Park landmark blocks (3,3) & (3,4). */
export function buildParkLandmark(blk, ctx) {
  const { rng, props, solidsExtra, landmarks } = ctx;
  const { x, y, w, h, j } = blk;

  if (j === 3) {
    // North Central Park (centerpiece of 2-foot.png!)
    const pond = { x: x + 186, y: y + 184, w: 122, h: 102 };
    solidsExtra.push({ x: pond.x + 8, y: pond.y + 8, w: pond.w - 16, h: pond.h - 16 });

    const bandstand = { x: x + 88, y: y + 92, r: 34 };
    solidsExtra.push({ x: bandstand.x - 24, y: bandstand.y - 24, w: 48, h: 48 });

    landmarks.parks.push({
      x,
      y,
      w,
      h,
      variant: 'north',
      pond,
      bandstand,
      flowerbeds: [
        { x: x + 28, y: y + 196, w: 66, h: 24, hue: 'magenta' },
        { x: x + 28, y: y + 232, w: 54, h: 22, hue: 'gold' },
        { x: x + 226, y: y + 126, w: 64, h: 20, hue: 'coral' },
      ],
    });
    landmarks.bandstands.push(bandstand);

    // Trees avoiding pond, bandstand, jogging track center & NE staged chatting peds (local 200..248, 42..86)
    const avoid = [
      { x: pond.x - 20, y: pond.y - 20, w: pond.w + 40, h: pond.h + 40 },
      { x: bandstand.x - 46, y: bandstand.y - 46, w: 92, h: 92 },
      { x: x + 196, y: y + 36, w: 60, h: 64 },
      { x: x + 144, y: y + 144, w: 44, h: 44 },
    ];
    for (let t = 0; t < 14; t += 1) {
      const tx = x + range(rng, 20, w - 20);
      const ty = y + range(rng, 20, h - 20);
      if (avoid.some((r) => tx >= r.x && tx <= r.x + r.w && ty >= r.y && ty <= r.y + r.h)) continue;
      props.push({
        kind: rng() < 0.34 ? 'palm' : 'tree',
        x: tx,
        y: ty,
        ph: range(rng, 0, TAU),
        s: range(rng, 0.88, 1.32),
      });
    }
    props.push({ kind: 'bench', x: x + 122, y: y + 146 });
    props.push({ kind: 'bench', x: x + 214, y: y + 148 });
    props.push({ kind: 'bench', x: x + 144, y: y + 230 });
  } else {
    // South Central Park (3,4): jogging loop, botanical flower promenade, sports court & fountain
    const court = { x: x + 36, y: y + 38, w: 124, h: 86 };
    const fountain = { x: x + 236, y: y + 166, r: 24 };
    solidsExtra.push({ x: fountain.x - 18, y: fountain.y - 18, w: 36, h: 36 });

    landmarks.parks.push({
      x,
      y,
      w,
      h,
      variant: 'south',
      court,
      fountain,
      flowerbeds: [
        { x: x + 42, y: y + 188, w: 84, h: 24, hue: 'gold' },
        { x: x + 42, y: y + 228, w: 84, h: 24, hue: 'magenta' },
        { x: x + 196, y: y + 48, w: 86, h: 22, hue: 'coral' },
      ],
    });
    for (let t = 0; t < 13; t += 1) {
      const tx = x + range(rng, 22, w - 22);
      const ty = y + range(rng, 22, h - 22);
      if (tx > court.x - 16 && tx < court.x + court.w + 16 && ty > court.y - 16 && ty < court.y + court.h + 16) continue;
      if (Math.hypot(tx - fountain.x, ty - fountain.y) < 44) continue;
      props.push({
        kind: rng() < 0.35 ? 'palm' : 'tree',
        x: tx,
        y: ty,
        ph: range(rng, 0, TAU),
        s: range(rng, 0.9, 1.3),
      });
    }
  }
}

/** Build the Blackwater Arena / Stadium block (7,3). */
export function buildStadiumLandmark(blk, ctx) {
  const { solidsExtra, landmarks } = ctx;
  const { x, y, w, h } = blk;
  const stadium = {
    x: x + 22,
    y: y + 26,
    w: w - 44,
    h: h - 52,
    cx: x + w * 0.5,
    cy: y + h * 0.5,
    rx: (w - 44) * 0.5,
    ry: (h - 52) * 0.5,
    ht: 82,
    name: 'BLACKWATER ARENA',
  };
  landmarks.stadiums.push(stadium);
  // Register inner core as solid so vehicles/peds stay on the surrounding concourse plaza
  solidsExtra.push({ x: stadium.x + 14, y: stadium.y + 14, w: stadium.w - 28, h: stadium.h - 28 });
}

/** Build the Harbour Cargo Pier, Stone Breakwater Jetty & Lighthouse (visible in 4-mission.png!). */
export function buildHarbourLandmarks(ctx) {
  const { piers, addBuilding, props, landmarks, solidsExtra } = ctx;

  // 1. Heavy Harbour Cargo Pier extending east into the bay at y = 1036..1102
  const cargoPier = { x: CITY.eastX - 12, y: 1036, w: 268, h: 66, kind: 'cargo_pier' };
  piers.push(cargoPier);

  // Stacked containers & cargo crane right on the cargo pier!
  addBuilding({
    x: 4650,
    y: 1046,
    w: 56,
    h: 22,
    kind: 'container',
    ht: 42,
    material: 'corrugated',
    color: '#b5493a',
    roof: '#000000',
    seed: 9801,
  });
  addBuilding({
    x: 4714,
    y: 1046,
    w: 56,
    h: 22,
    kind: 'container',
    ht: 26,
    material: 'corrugated',
    color: '#247888',
    roof: '#000000',
    seed: 9802,
  });
  addBuilding({
    x: 4650,
    y: 1074,
    w: 56,
    h: 22,
    kind: 'container',
    ht: 26,
    material: 'corrugated',
    color: '#c99736',
    roof: '#000000',
    seed: 9803,
  });
  props.push({ kind: 'crane', x: 4774, y: 1072, ph: 0.9 });
  props.push({ kind: 'crates', x: 4726, y: 1084, variant: 1, angle: 0.1 });

  // 2. Stone Breakwater Jetty & Red-and-White Harbour Lighthouse at y = 1384..1440
  const jetty = { x: CITY.eastX - 12, y: 1384, w: 236, h: 56, kind: 'breakwater' };
  piers.push(jetty);

  // Keeper's tiny whitewashed timber cottage on the stone jetty
  addBuilding({
    x: 4712,
    y: 1396,
    w: 44,
    h: 32,
    kind: 'house',
    ht: 22,
    material: 'stucco',
    color: '#f2ece0',
    roof: '#b84c3c',
    roofStyle: 'gable',
    seed: 9810,
  });

  // Iconic cylindrical red-and-white striped Lighthouse at the tip of the breakwater!
  const lighthouse = { x: 4812, y: 1412, r: 20, ht: 122 };
  landmarks.lighthouses.push(lighthouse);
  solidsExtra.push({ x: lighthouse.x - 18, y: lighthouse.y - 18, w: 36, h: 36 });
}

/** Build the Coral Beach Timber Boardwalk & beach kiosks. */
export function buildBoardwalkLandmark(ctx) {
  const { landmarks, props, rng } = ctx;
  landmarks.boardwalk = {
    x: 120,
    y: CITY.beachY,
    w: CITY.eastX - 200,
    h: 30,
    stairs: [],
    kiosks: [],
  };
  for (let sx = 280; sx < CITY.eastX - 240; sx += 340) {
    landmarks.boardwalk.stairs.push(sx);
  }
  const kioskCols = ['#e04b3e', '#229ca8', '#e89d38', '#c94c82'];
  for (let kx = 460; kx < CITY.eastX - 300; kx += 520) {
    landmarks.boardwalk.kiosks.push({
      x: kx,
      y: CITY.beachY + 4,
      w: 46,
      h: 22,
      color: kioskCols[Math.floor(kx / 520) % kioskCols.length],
    });
    props.push({
      kind: 'umbrella',
      x: kx + 72,
      y: CITY.beachY + 62,
      colors: ['#229ca8', '#f5f2e8'],
      r: 14,
      angle: range(rng, 0, TAU),
    });
  }
}

/** Draw all ground-level landmark features (parks, construction dirt pits, boardwalk, rubble lots, gardens & pools). */
export function drawLandmarkGrounds(ctx, world, view, t, sun) {
  const lm = world.landmarks;
  if (!lm) return;

  // 1. Coral Beach elevated timber boardwalk + beach stairs + kiosks
  if (lm.boardwalk && view.y + view.h > CITY.beachY - 24 && view.y < CITY.seaY + 20) {
    const bw = lm.boardwalk;
    const x0 = Math.max(bw.x, Math.floor(view.x / 16) * 16 - 32);
    const x1 = Math.min(bw.x + bw.w, view.x + view.w + 32);
    if (x1 > x0) {
      ctx.save();
      // Drop shadow onto golden beach sand
      ctx.fillStyle = 'rgba(62, 46, 24, 0.34)';
      ctx.fillRect(x0, bw.y + 4, x1 - x0, bw.h + 4);
      // Warm weathered cedar decking
      ctx.fillStyle = '#c49d72';
      ctx.fillRect(x0, bw.y, x1 - x0, bw.h);
      ctx.fillStyle = 'rgba(255, 246, 224, 0.18)';
      ctx.fillRect(x0, bw.y + 2, x1 - x0, 5);
      // Cross plank seams
      ctx.strokeStyle = 'rgba(84, 58, 34, 0.42)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let px = x0; px <= x1; px += 9) {
        ctx.moveTo(px, bw.y + 1);
        ctx.lineTo(px, bw.y + bw.h - 1);
      }
      ctx.stroke();
      // Top & bottom timber curb rails
      ctx.fillStyle = '#8b6540';
      ctx.fillRect(x0, bw.y, x1 - x0, 2.5);
      ctx.fillRect(x0, bw.y + bw.h - 2.5, x1 - x0, 2.5);
      // Stairs leading down onto the sand
      for (const sx of bw.stairs) {
        if (sx < view.x - 40 || sx > view.x + view.w + 40) continue;
        ctx.fillStyle = '#b48c60';
        ctx.fillRect(sx, bw.y + bw.h, 28, 16);
        ctx.strokeStyle = '#6c4d2c';
        ctx.lineWidth = 1;
        for (let st = 4; st <= 14; st += 4) {
          ctx.beginPath();
          ctx.moveTo(sx, bw.y + bw.h + st);
          ctx.lineTo(sx + 28, bw.y + bw.h + st);
          ctx.stroke();
        }
      }
      // Colourful beachside surf kiosks along boardwalk
      for (const k of bw.kiosks) {
        if (k.x < view.x - 60 || k.x > view.x + view.w + 60) continue;
        ctx.fillStyle = 'rgba(40, 28, 16, 0.30)';
        ctx.fillRect(k.x + 4, k.y + 5, k.w, k.h);
        ctx.fillStyle = '#f4eee0';
        ctx.fillRect(k.x, k.y, k.w, k.h);
        ctx.fillStyle = k.color;
        for (let s = 0; s < 6; s += 2) {
          ctx.fillRect(k.x + s * (k.w / 6), k.y, k.w / 6, k.h);
        }
        ctx.strokeStyle = '#5a4228';
        ctx.lineWidth = 1;
        ctx.strokeRect(k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1);
      }
      ctx.restore();
    }
  }

  // 2. Palmetto Central Park jogging paths, organic pond, flowerbeds & sports court
  for (const pk of lm.parks) {
    if (!rectsOverlap({ x: pk.x - 16, y: pk.y - 16, w: pk.w + 32, h: pk.h + 32 }, view)) continue;
    ctx.save();
    // Rounded-rectangle terracotta jogging path loop around the park
    const pad = 26;
    ctx.strokeStyle = '#d8b994';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.roundRect(pk.x + pad, pk.y + pad, pk.w - pad * 2, pk.h - pad * 2, 42);
    ctx.stroke();
    ctx.strokeStyle = '#c29972';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.roundRect(pk.x + pad, pk.y + pad, pk.w - pad * 2, pk.h - pad * 2, 42);
    ctx.stroke();
    // Subtle jogging lane centre dash
    ctx.strokeStyle = 'rgba(250, 244, 232, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.roundRect(pk.x + pad, pk.y + pad, pk.w - pad * 2, pk.h - pad * 2, 42);
    ctx.stroke();
    ctx.setLineDash([]);

    // Stone cross-paths meeting at a central circular plaza medallion
    ctx.fillStyle = '#dfd4b8';
    ctx.fillRect(pk.x + pk.w * 0.5 - 10, pk.y, 20, pk.h);
    ctx.fillRect(pk.x, pk.y + pk.h * 0.5 - 10, pk.w, 20);
    ctx.fillStyle = '#ebe2cc';
    ctx.beginPath();
    ctx.arc(pk.x + pk.w * 0.5, pk.y + pk.h * 0.5, 22, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#9c927d';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Vibrant organic botanical flowerbeds (lush foliage clusters + scattered blossoms)
    for (let fbi = 0; fbi < pk.flowerbeds.length; fbi += 1) {
      const fb = pk.flowerbeds[fbi];
      ctx.fillStyle = '#4e3b2c';
      ctx.beginPath();
      ctx.roundRect(fb.x, fb.y, fb.w, fb.h, 8);
      ctx.fill();
      ctx.strokeStyle = '#c8beaa';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      const petals = fb.hue === 'magenta' ? ['#e64b8c', '#ff94bd', '#f4d06f']
        : fb.hue === 'gold' ? ['#f2bc38', '#ff8c38', '#ffe48c']
        : ['#e85a4a', '#ffd06b', '#f28ca8'];
      const count = Math.floor((fb.w * fb.h) / 52);
      for (let k = 0; k < count; k += 1) {
        const bx = fb.x + 5 + hash01(fbi * 97 + k * 17) * (fb.w - 10);
        const by = fb.y + 5 + hash01(fbi * 97 + k * 31) * (fb.h - 10);
        ctx.fillStyle = k % 2 === 0 ? '#3f8442' : '#58a34c';
        ctx.beginPath();
        ctx.arc(bx, by, 4.2, 0, TAU);
        ctx.fill();
      }
      for (let k = 0; k < count; k += 1) {
        const bx = fb.x + 6 + hash01(fbi * 131 + k * 23) * (fb.w - 12);
        const by = fb.y + 5 + hash01(fbi * 131 + k * 41) * (fb.h - 10);
        ctx.fillStyle = petals[k % petals.length];
        ctx.beginPath();
        ctx.arc(bx, by, 2.2 + hash01(k * 13) * 1.1, 0, TAU);
        ctx.fill();
      }
    }

    // Organic pond with cobblestone rim, lily pads, wooden duck jetty & animated ripples
    if (pk.pond) {
      const p = pk.pond;
      const pcx = p.x + p.w * 0.5;
      const pcy = p.y + p.h * 0.5;
      // Stone shoreline bank
      ctx.fillStyle = '#c4ba9e';
      ctx.beginPath();
      ctx.ellipse(pcx, pcy, p.w * 0.52, p.h * 0.52, -0.14, 0, TAU);
      ctx.fill();
      // Deep coastal pond gradient
      const pGrad = ctx.createRadialGradient(pcx - 14, pcy - 10, 6, pcx, pcy, p.w * 0.52);
      pGrad.addColorStop(0, '#36b2c0');
      pGrad.addColorStop(0.65, '#197b8e');
      pGrad.addColorStop(1, '#105466');
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.ellipse(pcx, pcy, p.w * 0.47, p.h * 0.47, -0.14, 0, TAU);
      ctx.fill();
      // Secondary cove lobe for natural organic shape
      ctx.beginPath();
      ctx.ellipse(pcx + 26, pcy + 14, p.w * 0.28, p.h * 0.28, 0.25, 0, TAU);
      ctx.fill();
      // Water edge glint
      ctx.strokeStyle = 'rgba(218, 248, 242, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(pcx, pcy, p.w * 0.46, p.h * 0.46, -0.14, 0, TAU);
      ctx.stroke();
      // Lily pads & tiny pink lotus blooms
      const pads = [[pcx - 24, pcy + 12], [pcx - 14, pcy + 19], [pcx + 28, pcy - 14], [pcx + 36, pcy - 6]];
      for (let k = 0; k < pads.length; k += 1) {
        const [lx, ly] = pads[k];
        ctx.fillStyle = '#3d8f4a';
        ctx.beginPath();
        ctx.arc(lx, ly, 5.2, 0.3, TAU - 0.3);
        ctx.lineTo(lx, ly);
        ctx.fill();
        if (k % 2 === 0) {
          ctx.fillStyle = '#ff9ec2';
          ctx.beginPath();
          ctx.arc(lx, ly, 1.8, 0, TAU);
          ctx.fill();
        }
      }
      // Wooden viewing jetty jutting into pond
      ctx.fillStyle = '#9c7348';
      ctx.fillRect(p.x - 4, pcy - 9, 26, 18);
      ctx.strokeStyle = '#5e4226';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 4, pcy - 9, 26, 18);
      // Expanding ripple
      const rr = ((t * 14) % 24) + 8;
      ctx.strokeStyle = `rgba(224, 252, 248, ${(0.36 * (1 - rr / 32)).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(pcx + 4, pcy, rr, rr * 0.62, 0, 0, TAU);
      ctx.stroke();
    }

    // South Park community sports court + fountain
    if (pk.court) {
      const c = pk.court;
      ctx.fillStyle = '#3c7a7c';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = '#f2efe6';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(c.x + 8, c.y + 8, c.w - 16, c.h - 16);
      ctx.beginPath();
      ctx.moveTo(c.x + c.w * 0.5, c.y + 6);
      ctx.lineTo(c.x + c.w * 0.5, c.y + c.h - 6);
      ctx.stroke();
    }
    if (pk.fountain) {
      const f = pk.fountain;
      ctx.fillStyle = '#e5ddc9';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2597a8';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r - 5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(240, 254, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4 + Math.sin(t * 4) * 1.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. Midtown Construction Site excavation pit, dirt tracks, rebar, stacked beams & hazard fence
  for (const cs of lm.constructionSites) {
    if (!rectsOverlap(cs, view)) continue;
    ctx.save();
    // Excavated warm ochre dirt & gravel pad
    ctx.fillStyle = '#a8906e';
    ctx.fillRect(cs.x, cs.y, cs.w, cs.h);
    ctx.fillStyle = '#927958';
    ctx.fillRect(cs.x + 12, cs.y + 12, cs.w - 24, cs.h - 24);
    // Muddy wheel track ruts entering from south-west gate
    ctx.strokeStyle = 'rgba(72, 56, 38, 0.34)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cs.x + 124, cs.y + cs.h);
    ctx.quadraticCurveTo(cs.x + 150, cs.y + 230, cs.x + 210, cs.y + 184);
    ctx.moveTo(cs.x + 140, cs.y + cs.h);
    ctx.quadraticCurveTo(cs.x + 166, cs.y + 232, cs.x + 224, cs.y + 190);
    ctx.stroke();

    // Poured concrete foundation slab + exposed rebar grid
    ctx.fillStyle = '#b4b2aa';
    ctx.fillRect(cs.x + 18, cs.y + 18, 162, 162);
    ctx.strokeStyle = '#7c7b74';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cs.x + 18, cs.y + 18, 162, 162);
    // Secondary excavated pit with rebar mesh in SW corner
    ctx.fillStyle = '#7e684c';
    ctx.fillRect(cs.x + 24, cs.y + 196, 126, 94);
    ctx.strokeStyle = 'rgba(130, 88, 62, 0.72)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let rx = cs.x + 32; rx < cs.x + 144; rx += 12) {
      ctx.moveTo(rx, cs.y + 202); ctx.lineTo(rx, cs.y + 284);
    }
    for (let ry = cs.y + 204; ry < cs.y + 286; ry += 12) {
      ctx.moveTo(cs.x + 30, ry); ctx.lineTo(cs.x + 144, ry);
    }
    ctx.stroke();

    // Sand & gravel mounds
    ctx.fillStyle = '#c8ae7e';
    ctx.beginPath();
    ctx.ellipse(cs.x + 258, cs.y + 52, 34, 22, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#dfd0a8';
    ctx.beginPath();
    ctx.ellipse(cs.x + 252, cs.y + 46, 16, 10, 0.2, 0, TAU);
    ctx.fill();

    // Stacked steel I-beams & timber stacks
    ctx.fillStyle = '#c85b34';
    for (let k = 0; k < 4; k += 1) {
      ctx.fillRect(cs.x + 196, cs.y + 166 + k * 7, 68, 4.5);
    }
    ctx.fillStyle = '#c49052';
    for (let k = 0; k < 3; k += 1) {
      ctx.fillRect(cs.x + 162, cs.y + 204 + k * 6, 36, 4);
    }

    // Yellow-and-black hazard jersey barriers & chain-link perimeter fencing
    ctx.strokeStyle = '#e8b630';
    ctx.lineWidth = 3.2;
    ctx.strokeRect(cs.x + 1.5, cs.y + 1.5, cs.w - 3, cs.h - 3);
    ctx.strokeStyle = '#242830';
    ctx.lineWidth = 3.2;
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(cs.x + 1.5, cs.y + 1.5, cs.w - 3, cs.h - 3);
    ctx.setLineDash([]);

    // Bright orange safety cones along the site entrance
    const cones = [[cs.x + 112, cs.y + cs.h - 6], [cs.x + 154, cs.y + cs.h - 6], [cs.x + 190, cs.y + 148], [cs.x + 286, cs.y + 190]];
    for (const [cx, cy] of cones) {
      ctx.fillStyle = '#ff6b22';
      ctx.beginPath();
      ctx.arc(cx, cy, 3.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff8e8';
      ctx.beginPath();
      ctx.arc(cx, cy, 1.3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // 4. Empty urban lots with cracked concrete, rubble piles, weeds & graffiti retaining wall
  for (const rl of (world.rubbleLots || [])) {
    if (!rectsOverlap(rl, view)) continue;
    ctx.save();
    ctx.fillStyle = '#9c9484';
    ctx.fillRect(rl.x, rl.y, rl.w, rl.h);
    // Cracked demolished foundation pad
    ctx.fillStyle = '#b4ada0';
    ctx.fillRect(rl.x + 10, rl.y + 10, rl.w - 20, rl.h - 20);
    ctx.strokeStyle = 'rgba(42, 40, 38, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(rl.x + 14, rl.y + 28);
    ctx.lineTo(rl.x + rl.w * 0.48, rl.y + rl.h * 0.52);
    ctx.lineTo(rl.x + rl.w - 16, rl.y + 42);
    ctx.moveTo(rl.x + rl.w * 0.48, rl.y + rl.h * 0.52);
    ctx.lineTo(rl.x + rl.w * 0.62, rl.y + rl.h - 14);
    ctx.stroke();

    // Scattered brick & concrete rubble mounds + scrub weeds
    for (let k = 0; k < 16; k += 1) {
      const rx = rl.x + 14 + hash01(rl.seed + k * 13) * (rl.w - 28);
      const ry = rl.y + 14 + hash01(rl.seed + k * 29) * (rl.h - 28);
      const rs = 3 + hash01(rl.seed + k * 41) * 6;
      ctx.fillStyle = k % 3 === 0 ? '#a85a46' : k % 3 === 1 ? '#82807a' : '#5e7e46';
      ctx.fillRect(rx, ry, rs, rs * 0.8);
    }

    // Low graffiti-tagged cinderblock retaining wall along north edge
    ctx.fillStyle = '#787670';
    ctx.fillRect(rl.x + 4, rl.y + 2, rl.w - 8, 7);
    if (rl.graffiti) {
      const gCols = ['#ff3b9a', '#2be4e4', '#ffd24c', '#74e84c'];
      for (let g = 0; g < 4; g += 1) {
        ctx.fillStyle = gCols[g];
        ctx.fillRect(rl.x + 14 + g * ((rl.w - 36) / 4), rl.y + 3, 18, 4.5);
      }
    }
    // Weathered chain-link perimeter
    ctx.strokeStyle = 'rgba(130, 138, 144, 0.72)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(rl.x + 1, rl.y + 1, rl.w - 2, rl.h - 2);
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 5. Suburban gardens, patios & resort/courtyard swimming pools
  for (const gd of (world.gardens || [])) {
    if (!rectsOverlap(gd, view)) continue;
    ctx.save();
    if (gd.kind === 'patio') {
      ctx.fillStyle = '#d6c8b0';
      ctx.fillRect(gd.x, gd.y, gd.w, gd.h);
      ctx.strokeStyle = 'rgba(92, 80, 64, 0.34)';
      ctx.lineWidth = 1;
      ctx.strokeRect(gd.x + 0.5, gd.y + 0.5, gd.w - 1, gd.h - 1);
      // Tiny patio table umbrella
      ctx.fillStyle = '#e06b48';
      ctx.beginPath();
      ctx.arc(gd.x + gd.w * 0.5, gd.y + gd.h * 0.5, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff5e4';
      ctx.beginPath();
      ctx.arc(gd.x + gd.w * 0.5, gd.y + gd.h * 0.5, 2, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = '#544130';
      ctx.beginPath();
      ctx.roundRect(gd.x, gd.y, gd.w, gd.h, 6);
      ctx.fill();
      ctx.strokeStyle = '#9c8b70';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      const fl = ['#e85a78', '#f2c842', '#ff8f52', '#64b2e0'];
      const count = Math.max(8, Math.floor((gd.w * gd.h) / 72));
      for (let k = 0; k < count; k += 1) {
        const fx = gd.x + 6 + hash01(gd.seed + k * 19) * (gd.w - 12);
        const fy = gd.y + 6 + hash01(gd.seed + k * 37) * (gd.h - 12);
        ctx.fillStyle = k % 2 === 0 ? '#3f8442' : '#5aa64e';
        ctx.beginPath();
        ctx.arc(fx, fy, 4.4, 0, TAU);
        ctx.fill();
      }
      for (let k = 0; k < count; k += 1) {
        const fx = gd.x + 6 + hash01(gd.seed + k * 29) * (gd.w - 12);
        const fy = gd.y + 6 + hash01(gd.seed + k * 53) * (gd.h - 12);
        ctx.fillStyle = fl[(k + gd.seed) % fl.length];
        ctx.beginPath();
        ctx.arc(fx, fy, 2.2 + hash01(gd.seed + k * 7) * 1.1, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  for (const pl of (world.pools || [])) {
    if (!rectsOverlap(pl, view)) continue;
    ctx.save();
    if (pl.kind === 'courtyard_garden') {
      ctx.fillStyle = '#629450';
      ctx.beginPath();
      ctx.roundRect(pl.x, pl.y, pl.w, pl.h, 6);
      ctx.fill();
      ctx.strokeStyle = '#d4cab4';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Decorative courtyard water basin
      ctx.fillStyle = '#28a4b8';
      ctx.beginPath();
      ctx.arc(pl.x + pl.w * 0.5, pl.y + pl.h * 0.5, Math.min(pl.w, pl.h) * 0.24, 0, TAU);
      ctx.fill();
    } else {
      // Sun deck tile border + shimmering turquoise swimming pool
      ctx.fillStyle = '#ebe2d0';
      ctx.beginPath();
      ctx.roundRect(pl.x - 6, pl.y - 6, pl.w + 12, pl.h + 12, 6);
      ctx.fill();
      ctx.fillStyle = '#2ec4d6';
      ctx.beginPath();
      ctx.roundRect(pl.x, pl.y, pl.w, pl.h, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.4;
      const waveOff = Math.sin(t * 2.2) * 3;
      ctx.beginPath();
      ctx.moveTo(pl.x + 8, pl.y + pl.h * 0.35);
      ctx.quadraticCurveTo(pl.x + pl.w * 0.5, pl.y + pl.h * 0.35 + waveOff, pl.x + pl.w - 8, pl.y + pl.h * 0.35);
      ctx.moveTo(pl.x + 8, pl.y + pl.h * 0.7);
      ctx.quadraticCurveTo(pl.x + pl.w * 0.5, pl.y + pl.h * 0.7 - waveOff, pl.x + pl.w - 8, pl.y + pl.h * 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 6. Special decor: dock safety aprons & motel parking lots
  for (const d of (world.decor || [])) {
    if (!rectsOverlap({ x: d.x - 10, y: d.y - 10, w: (d.w || 40) + 20, h: (d.h || 40) + 20 }, view)) continue;
    if (d.kind === 'dock_apron') {
      ctx.save();
      ctx.fillStyle = 'rgba(232, 184, 52, 0.26)';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = 'rgba(240, 194, 56, 0.72)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(d.x, d.y, d.w, d.h);
      ctx.setLineDash([]);
      ctx.restore();
    } else if (d.kind === 'motel_lot') {
      ctx.save();
      ctx.fillStyle = '#484c56';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = 'rgba(242, 236, 220, 0.65)';
      ctx.lineWidth = 1.5;
      for (let sx = d.x + 28; sx < d.x + d.w - 20; sx += 30) {
        ctx.beginPath();
        ctx.moveTo(sx, d.y + 6);
        ctx.lineTo(sx - 8, d.y + 34);
        ctx.moveTo(sx, d.y + d.h - 6);
        ctx.lineTo(sx - 8, d.y + d.h - 34);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  void sun;
}

/** Draw an octagonal Victorian Park Bandstand in 2.5D with columns, ribbed copper roof & finial. */
export function drawBandstand(ctx, bs, cam, night, sun) {
  const ox = (bs.x - cam.x) * 44 * LEAN;
  const oy = (bs.y - cam.y) * 44 * LEAN;
  ctx.save();

  // Directional sun shadow
  if (sun) {
    drawSoftDropShadow(ctx, bs.x, bs.y + 2, bs.r * 1.05, bs.r * 0.92, sun, 34);
  }

  // Raised octagonal stone base & steps
  const oct = (cx, cy, rad) => {
    ctx.beginPath();
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * TAU + Math.PI / 8;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  oct(bs.x, bs.y, bs.r + 5);
  ctx.fillStyle = '#d4cab4';
  ctx.fill();
  ctx.strokeStyle = '#8f8674';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  oct(bs.x, bs.y, bs.r - 1);
  ctx.fillStyle = '#b0865a';
  ctx.fill();

  // White columns connecting deck to roof
  const rx = bs.x + ox;
  const ry = bs.y + oy;
  ctx.strokeStyle = '#f2ede2';
  ctx.lineWidth = 2.4;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * TAU + Math.PI / 8;
    const cRad = bs.r - 5;
    ctx.beginPath();
    ctx.moveTo(bs.x + Math.cos(a) * cRad, bs.y + Math.sin(a) * cRad);
    ctx.lineTo(rx + Math.cos(a) * cRad, ry + Math.sin(a) * cRad);
    ctx.stroke();
  }

  // Ornate ribbed patina-copper dome roof
  for (let k = 0; k < 8; k += 1) {
    const a0 = (k / 8) * TAU + Math.PI / 8;
    const a1 = ((k + 1) / 8) * TAU + Math.PI / 8;
    ctx.fillStyle = k % 2 === 0 ? '#3a9088' : '#2d7a74';
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + Math.cos(a0) * (bs.r + 3), ry + Math.sin(a0) * (bs.r + 3));
    ctx.lineTo(rx + Math.cos(a1) * (bs.r + 3), ry + Math.sin(a1) * (bs.r + 3));
    ctx.closePath();
    ctx.fill();
  }
  oct(rx, ry, bs.r + 3);
  ctx.strokeStyle = '#e8dfc8';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Gold cupola finial
  ctx.fillStyle = '#e8bf4c';
  ctx.beginPath();
  ctx.arc(rx, ry, 5.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = night > 0.2 ? '#fff4b8' : '#fff0b2';
  ctx.beginPath();
  ctx.arc(rx, ry, 2.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Draw the Blackwater Arena / Stadium 2.5D elliptical bowl, pitch, roof trusses & floodlight pylons. */
export function drawStadium(ctx, st, cam, night, sun) {
  const ox = (st.cx - cam.x) * st.ht * LEAN;
  const oy = (st.cy - cam.y) * st.ht * LEAN;
  ctx.save();

  // Cast shadow onto entry plaza
  if (sun) {
    ctx.fillStyle = `rgba(14, 20, 38, ${(sun.alpha * 0.85).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(st.cx + sun.dx * st.ht * 0.9, st.cy + sun.dy * st.ht * 0.9, st.rx + 4, st.ry + 4, 0, 0, TAU);
    ctx.fill();
  }

  // Outer extruded stadium drum wall (base -> roof)
  ctx.fillStyle = '#8b929a';
  ctx.beginPath();
  ctx.ellipse(st.cx, st.cy, st.rx, st.ry, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#58606a';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner playing field (lush striped turf) visible inside the bowl
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(st.cx, st.cy, st.rx * 0.56, st.ry * 0.52, 0, 0, TAU);
  ctx.clip();
  ctx.fillStyle = '#4c9446';
  ctx.fillRect(st.cx - st.rx, st.cy - st.ry, st.rx * 2, st.ry * 2);
  ctx.fillStyle = 'rgba(130, 198, 96, 0.28)';
  for (let sx = st.cx - st.rx; sx < st.cx + st.rx; sx += 22) {
    ctx.fillRect(sx, st.cy - st.ry, 11, st.ry * 2);
  }
  ctx.strokeStyle = 'rgba(250, 248, 240, 0.85)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(st.cx - 56, st.cy - 34, 112, 68);
  ctx.beginPath();
  ctx.moveTo(st.cx, st.cy - 34);
  ctx.lineTo(st.cx, st.cy + 34);
  ctx.arc(st.cx, st.cy, 14, 0, TAU);
  ctx.stroke();
  ctx.restore();

  // Terraced stadium seating ring
  ctx.strokeStyle = '#385878';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(st.cx, st.cy, st.rx * 0.64, st.ry * 0.61, 0, 0, TAU);
  ctx.stroke();

  // Elevated cantilevered stadium roof canopy ring with radial trusses
  const rcx = st.cx + ox;
  const rcy = st.cy + oy;
  ctx.fillStyle = '#d8dce0';
  ctx.beginPath();
  ctx.ellipse(rcx, rcy, st.rx, st.ry, 0, 0, TAU);
  ctx.ellipse(rcx, rcy, st.rx * 0.58, st.ry * 0.54, 0, 0, TAU, true);
  ctx.fill('evenodd');

  // Radial white steel roof ribs
  ctx.strokeStyle = 'rgba(60, 72, 86, 0.46)';
  ctx.lineWidth = 1.6;
  for (let k = 0; k < 20; k += 1) {
    const a = (k / 20) * TAU;
    ctx.beginPath();
    ctx.moveTo(rcx + Math.cos(a) * st.rx * 0.58, rcy + Math.sin(a) * st.ry * 0.54);
    ctx.lineTo(rcx + Math.cos(a) * st.rx, rcy + Math.sin(a) * st.ry);
    ctx.stroke();
  }
  // Outer fascia accent stripe
  ctx.strokeStyle = '#248c9c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(rcx, rcy, st.rx - 2, st.ry - 2, 0, 0, TAU);
  ctx.stroke();

  // 4 corner floodlight pylons
  const pylons = [[-0.78, -0.74], [0.78, -0.74], [-0.78, 0.74], [0.78, 0.74]];
  for (const [px, py] of pylons) {
    const lx = rcx + px * st.rx;
    const ly = rcy + py * st.ry;
    ctx.fillStyle = '#38424d';
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = night > 0.2 ? '#fff8d4' : '#dce4ec';
    ctx.beginPath();
    ctx.arc(lx, ly, 3.6, 0, TAU);
    ctx.fill();
  }

  // Roofline marquee text
  ctx.fillStyle = '#182432';
  ctx.font = '800 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(st.name, rcx, rcy - st.ry * 0.78);
  ctx.restore();
}

/** Draw the 2.5D Red-and-White Striped Harbour Lighthouse with glass lantern room & copper dome. */
export function drawLighthouse(ctx, lh, cam, night, dusk, sun, t) {
  const ox = (lh.x - cam.x) * lh.ht * LEAN;
  const oy = (lh.y - cam.y) * lh.ht * LEAN;
  ctx.save();

  // Cast shadow onto stone breakwater & harbour water
  if (sun) {
    ctx.strokeStyle = `rgba(10, 16, 30, ${(sun.alpha * 0.85).toFixed(3)})`;
    ctx.lineWidth = lh.r * 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lh.x, lh.y);
    ctx.lineTo(lh.x + sun.dx * lh.ht * 0.95, lh.y + sun.dy * lh.ht * 0.95);
    ctx.stroke();
  }

  // Stone octagonal plinth
  ctx.fillStyle = '#9e9c94';
  ctx.beginPath();
  ctx.arc(lh.x, lh.y, lh.r + 4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#5c5a54';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Extruded tapered red-and-white striped masonry shaft (6 stacked bands)
  const bands = 6;
  for (let b = 0; b < bands; b += 1) {
    const t0 = b / bands;
    const bx = lh.x + ox * t0;
    const by = lh.y + oy * t0;
    const rad = lh.r * (1 - t0 * 0.36);
    ctx.fillStyle = b % 2 === 0 ? '#f2ece2' : '#cf3c32';
    ctx.beginPath();
    ctx.arc(bx, by, rad, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 24, 32, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Black iron observation gallery deck at top
  const topX = lh.x + ox;
  const topY = lh.y + oy;
  const topR = lh.r * 0.72;
  ctx.fillStyle = '#242c36';
  ctx.beginPath();
  ctx.arc(topX, topY, topR + 3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#9aa6b2';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Glowing glass lantern room + warm rotating optic
  const lit = Math.max(night, dusk * 0.85);
  ctx.fillStyle = lit > 0.15 ? '#fff2b0' : '#a6dce6';
  ctx.beginPath();
  ctx.arc(topX, topY, topR - 1.5, 0, TAU);
  ctx.fill();

  // Copper cupola dome & brass finial
  ctx.fillStyle = '#328078';
  ctx.beginPath();
  ctx.arc(topX + ox * 0.06, topY + oy * 0.06, topR * 0.62, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2c84b';
  ctx.beginPath();
  ctx.arc(topX + ox * 0.08, topY + oy * 0.08, 2.5, 0, TAU);
  ctx.fill();

  // Crisp bright lantern flare at night
  if (lit > 0.15) {
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.5);
    ctx.fillStyle = `rgba(255, 244, 186, ${(0.75 * lit * pulse).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(topX, topY, 6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Draw the towering yellow lattice Construction Tower Crane with counterweight, jib & beacon. */
export function drawTowerCrane(ctx, p, night, t, sun) {
  const jibAngle = p.jibAngle + Math.sin(t * 0.25 + p.ph) * 0.16;
  const jibLen = p.jibLen || 156;
  const counterLen = 46;
  const mastH = 128;
  const topX = p.x;
  const topY = p.y - mastH;
  const tipX = topX + Math.cos(jibAngle) * jibLen;
  const tipY = topY + Math.sin(jibAngle) * jibLen * 0.72;
  const backX = topX - Math.cos(jibAngle) * counterLen;
  const backY = topY - Math.sin(jibAngle) * counterLen * 0.72;

  ctx.save();
  // Ground shadow of crane mast & jib
  const sdx = sun ? sun.dx * 90 : 28;
  const sdy = sun ? sun.dy * 90 : 22;
  const shA = sun ? sun.alpha * 0.82 : 0.22;
  ctx.strokeStyle = `rgba(12, 16, 28, ${shA.toFixed(3)})`;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + sdx, p.y + sdy);
  ctx.moveTo(p.x + sdx - Math.cos(jibAngle) * counterLen, p.y + sdy - Math.sin(jibAngle) * counterLen * 0.72);
  ctx.lineTo(p.x + sdx + Math.cos(jibAngle) * jibLen, p.y + sdy + Math.sin(jibAngle) * jibLen * 0.72);
  ctx.stroke();

  // Heavy concrete ballast pad at mast base
  ctx.fillStyle = '#8b8a84';
  ctx.fillRect(p.x - 16, p.y - 16, 32, 32);
  ctx.strokeStyle = '#383c42';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(p.x - 16, p.y - 16, 32, 32);

  // Yellow steel lattice mast
  ctx.fillStyle = '#e8b028';
  ctx.fillRect(p.x - 6, topY, 12, mastH);
  ctx.strokeStyle = '#8c5e12';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(p.x - 6, topY, 12, mastH);
  ctx.beginPath();
  for (let my = p.y - 10; my > topY + 6; my -= 14) {
    ctx.moveTo(p.x - 6, my);
    ctx.lineTo(p.x + 6, my - 12);
    ctx.moveTo(p.x + 6, my);
    ctx.lineTo(p.x - 6, my - 12);
  }
  ctx.stroke();

  // Horizontal jib boom + counter-jib
  ctx.strokeStyle = '#f0ba32';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(backX, backY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.strokeStyle = '#9c6814';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(backX, backY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Concrete counterweight blocks on counter-jib
  ctx.fillStyle = '#6c727a';
  ctx.fillRect(backX - 10, backY - 8, 20, 16);
  ctx.strokeStyle = '#383e46';
  ctx.strokeRect(backX - 10, backY - 8, 20, 16);

  // Operator cabin beside slewing ring
  ctx.fillStyle = '#f6f2e8';
  ctx.fillRect(topX + 4, topY - 4, 14, 12);
  ctx.fillStyle = '#3a6b84';
  ctx.fillRect(topX + 7, topY - 2, 9, 8);

  // Trolley, hoist cable & suspended steel beam
  const tx = topX + Math.cos(jibAngle) * (jibLen * 0.68);
  const ty = topY + Math.sin(jibAngle) * (jibLen * 0.68) * 0.72;
  ctx.strokeStyle = '#2d323a';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx, ty + 48);
  ctx.stroke();
  ctx.fillStyle = '#c85b34';
  ctx.fillRect(tx - 14, ty + 46, 28, 5);

  // Blinking red aviation beacon at apex
  if (night > 0.1 || Math.sin(t * 4.2 + p.ph) > -0.2) {
    ctx.fillStyle = '#ff3838';
    ctx.beginPath();
    ctx.arc(topX, topY - 8, 3.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  void drawCastRectShadow;
  void shade;
  void int;
}
