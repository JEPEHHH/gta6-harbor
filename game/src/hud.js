// The HUD: translucent rounded glass panels with soft drop shadows, clean typography,
// analogue-style minimap with district labels and blips, animated wanted stars,
// smoothly ticking money counter, analogue speedometer, dialogue box, title & pause screens.

import { CITY, FONT, PALETTE } from './config.js';
import { TAU, clamp, formatClock, formatMoney } from './util.js';
import { drawWeaponHUD } from './combat.js';

const MM = { x: 24, y: 720 - 178, w: 224, h: 154 };
const MM_RANGE = 1520; // world units across the minimap

// Smoothly ticking money counter display state (purely visual)
let displayMoney = null;
let moneyFlash = 0;

/** Translucent rounded glass panel with soft drop shadow and crisp luminous rim. */
function panel(ctx, x, y, w, h, r = 10, accent = null) {
  ctx.save();
  ctx.shadowColor = 'rgba(2, 6, 14, 0.48)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  // Subtle vertical glass sheen
  const sheen = ctx.createLinearGradient(x, y, x, y + h);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0.01)');
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();

  ctx.strokeStyle = PALETTE.hudBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.stroke();

  if (accent) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 6, 3.2, h - 12, 2);
    ctx.fill();
  }
}

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 10; k += 1) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * 0.44;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawMinimap(ctx, g) {
  const p = g.player;
  const world = g.world;
  const scale = MM.w / MM_RANGE;
  const mx = (wx) => MM.x + (wx - p.x) * scale + MM.w * 0.5;
  const my = (wy) => MM.y + (wy - p.y) * scale + MM.h * 0.5;

  // Outer bezel frame
  panel(ctx, MM.x - 5, MM.y - 5, MM.w + 10, MM.h + 10, 12);

  // Emergency pursuit bezel glow when wanted
  if (g.wanted > 0) {
    const flash = Math.sin(g.elapsed * 10) > 0;
    ctx.save();
    ctx.strokeStyle = flash ? 'rgba(242, 58, 58, 0.92)' : 'rgba(56, 124, 255, 0.92)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(MM.x - 5, MM.y - 5, MM.w + 10, MM.h + 10, 12);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(MM.x, MM.y, MM.w, MM.h, 8);
  ctx.clip();

  // Warm parchment-slate nautical radar background
  ctx.fillStyle = '#14222c';
  ctx.fillRect(MM.x, MM.y, MM.w, MM.h);

  // Sea & harbor basin in rich coastal teal
  ctx.fillStyle = '#125366';
  const seaTop = my(CITY.seaY);
  if (seaTop < MM.y + MM.h) ctx.fillRect(MM.x, Math.max(MM.y, seaTop), MM.w, MM.h);
  const eastLeft = mx(CITY.eastX);
  if (eastLeft < MM.x + MM.w) ctx.fillRect(Math.max(MM.x, eastLeft), MM.y, MM.w, MM.h);
  ctx.fillRect(mx(CITY.basin.x), my(CITY.basin.y), CITY.basin.w * scale, CITY.basin.h * scale);

  // Subtle latitude/longitude chart gridlines
  ctx.strokeStyle = 'rgba(130, 185, 200, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = MM.x + 32; gx < MM.x + MM.w; gx += 32) {
    ctx.moveTo(gx, MM.y); ctx.lineTo(gx, MM.y + MM.h);
  }
  for (let gy = MM.y + 32; gy < MM.y + MM.h; gy += 32) {
    ctx.moveTo(MM.x, gy); ctx.lineTo(MM.x + MM.w, gy);
  }
  ctx.stroke();

  // Land blocks shaded by district
  for (const b of world.blocks) {
    if (b.district === 'park') ctx.fillStyle = '#295b3c';
    else if (b.district === 'downtown') ctx.fillStyle = '#364657';
    else if (b.district === 'docks') ctx.fillStyle = '#404d5a';
    else if (b.district === 'beachfront') ctx.fillStyle = '#4f5547';
    else ctx.fillStyle = '#263830';
    const bx = mx(b.x);
    const by = my(b.y);
    const bw = b.w * scale;
    const bh = b.h * scale;
    if (bx + bw < MM.x || bx > MM.x + MM.w || by + bh < MM.y || by > MM.y + MM.h) continue;
    ctx.fillRect(bx, by, bw, bh);
  }

  // Beach strip
  const beachTop = my(CITY.beachY);
  const beachBot = my(CITY.seaY);
  if (beachTop < MM.y + MM.h && beachBot > MM.y) {
    ctx.fillStyle = 'rgba(232, 208, 148, 0.36)';
    ctx.fillRect(MM.x, Math.max(MM.y, beachTop), MM.w, Math.min(MM.y + MM.h, beachBot) - Math.max(MM.y, beachTop));
  }

  // Crisp road grid
  ctx.strokeStyle = 'rgba(222, 228, 224, 0.72)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (const v of world.roadsV) {
    const x = mx(v);
    if (x < MM.x - 4 || x > MM.x + MM.w + 4) continue;
    ctx.moveTo(x, Math.max(MM.y, my(0)));
    ctx.lineTo(x, Math.min(MM.y + MM.h, my(world.roadsH[CITY.rows - 1])));
  }
  for (const h of world.roadsH) {
    const y = my(h);
    if (y < MM.y - 4 || y > MM.y + MM.h + 4) continue;
    ctx.moveTo(Math.max(MM.x, mx(0)), y);
    ctx.lineTo(Math.min(MM.x + MM.w, mx(CITY.eastX)), y);
  }
  ctx.stroke();

  // District labels etched directly onto the analogue map
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 8px ${FONT}`;
  for (const dl of (world.districtLabels || [])) {
    const lx = mx(dl.x);
    const ly = my(dl.y);
    if (lx < MM.x + 14 || lx > MM.x + MM.w - 14 || ly < MM.y + 14 || ly > MM.y + MM.h - 10) continue;
    ctx.fillStyle = 'rgba(8, 14, 22, 0.65)';
    ctx.fillText(dl.name, lx + 0.8, ly + 0.8);
    ctx.fillStyle = 'rgba(226, 236, 240, 0.56)';
    ctx.fillText(dl.name, lx, ly);
  }

  // Traffic dots
  for (const v of (g.traffic || [])) {
    const vx = mx(v.x);
    const vy = my(v.y);
    if (vx < MM.x || vx > MM.x + MM.w || vy < MM.y || vy > MM.y + MM.h) continue;
    ctx.fillStyle = 'rgba(210, 218, 226, 0.42)';
    ctx.beginPath();
    ctx.arc(vx, vy, 1.4, 0, TAU);
    ctx.fill();
  }

  // Police blips with pulsing red/blue ring
  const policeFlash = Math.sin(g.elapsed * 12) > 0;
  for (const blip of g.blips) {
    const bx = mx(blip.x);
    const by = my(blip.y);
    if (bx < MM.x - 6 || bx > MM.x + MM.w + 6 || by < MM.y - 6 || by > MM.y + MM.h + 6) continue;
    if (blip.color === '#5080e0') {
      ctx.fillStyle = policeFlash ? 'rgba(245, 62, 62, 0.38)' : 'rgba(66, 134, 255, 0.38)';
      ctx.beginPath();
      ctx.arc(bx, by, 6.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = policeFlash ? '#ff4a4a' : '#4a8cff';
      ctx.beginPath();
      ctx.arc(bx, by, 3.2, 0, TAU);
      ctx.fill();
    }
  }

  // Mission waypoint pulsing diamond (clamped to radar edge if off-map)
  if (g.mission && g.mission.waypoint) {
    const wp = g.mission.waypoint;
    const wx = clamp(mx(wp.x), MM.x + 9, MM.x + MM.w - 9);
    const wy = clamp(my(wp.y), MM.y + 9, MM.y + MM.h - 9);
    const pulse = 1 + Math.sin(g.elapsed * 5) * 0.16;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(0, -6.5);
    ctx.lineTo(5.5, 0);
    ctx.lineTo(0, 6.5);
    ctx.lineTo(-5.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
  }

  // Player heading cone + crisp chevron
  ctx.save();
  ctx.translate(mx(p.x), my(p.y));
  ctx.rotate(p.angle + Math.PI / 2);
  ctx.fillStyle = 'rgba(47, 208, 214, 0.22)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 22, -Math.PI * 0.72, -Math.PI * 0.28);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0c1420';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -7.5);
  ctx.lineTo(5.2, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-5.2, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Analogue bezel tick marks along top & bottom edges
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let tx = MM.x + 16; tx < MM.x + MM.w; tx += 16) {
    ctx.moveTo(tx, MM.y); ctx.lineTo(tx, MM.y + 3);
    ctx.moveTo(tx, MM.y + MM.h); ctx.lineTo(tx, MM.y + MM.h - 3);
  }
  ctx.stroke();
  ctx.restore();

  // North compass badge at top centre of bezel
  ctx.fillStyle = '#0e1724';
  ctx.beginPath();
  ctx.roundRect(MM.x + MM.w * 0.5 - 10, MM.y - 7, 20, 14, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = PALETTE.teal;
  ctx.font = `800 9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', MM.x + MM.w * 0.5, MM.y + 0.5);
  ctx.textBaseline = 'alphabetic';
}

function drawSpeedometer(ctx, g) {
  const car = g.player.inCar;
  if (!car) return;
  const cx = 1178;
  const cy = 612;
  const speed = Math.hypot(car.vx, car.vy);
  const kmh = Math.round(speed * 0.36);
  const ratio = clamp(speed / 340, 0, 1);

  panel(ctx, cx - 78, cy - 76, 156, 138, 14);

  // Analogue dial ticks around the 270-degree arc
  const startA = Math.PI * 0.75;
  const spanA = Math.PI * 1.5;
  ctx.save();
  for (let i = 0; i <= 12; i += 1) {
    const a = startA + (i / 12) * spanA;
    const major = i % 3 === 0;
    const r0 = major ? 42 : 46;
    const r1 = 52;
    ctx.strokeStyle = i >= 10 ? 'rgba(242, 74, 68, 0.8)' : 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = major ? 2 : 1.1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }

  // Track background & illuminated speed arc
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 55, startA, startA + spanA);
  ctx.stroke();

  const arcGrad = ctx.createLinearGradient(cx - 55, cy, cx + 55, cy);
  arcGrad.addColorStop(0, PALETTE.teal);
  arcGrad.addColorStop(0.65, PALETTE.accent);
  arcGrad.addColorStop(1, '#ff4848');
  ctx.strokeStyle = arcGrad;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 55, startA, startA + spanA * Math.max(0.02, ratio));
  ctx.stroke();

  // Crisp red-orange needle
  const needleA = startA + spanA * ratio;
  ctx.strokeStyle = '#ff6b4a';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(needleA) * 6, cy - Math.sin(needleA) * 6);
  ctx.lineTo(cx + Math.cos(needleA) * 40, cy + Math.sin(needleA) * 40);
  ctx.stroke();
  ctx.restore();

  // Digital readout inside dial
  ctx.fillStyle = PALETTE.hud;
  ctx.font = `800 28px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(kmh), cx, cy + 12);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `700 10px ${FONT}`;
  ctx.fillText('KM/H', cx, cy + 27);

  // Vehicle class pill
  ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
  ctx.font = `700 10px ${FONT}`;
  ctx.fillText(car.name.toUpperCase(), cx, cy + 48);
}

function drawDialogue(ctx, g) {
  if (!g.dialogue) return;
  const fadeIn = clamp((g.dialogueTimer + 0.1) / 0.25, 0.65, 1);
  const fadeOut = clamp((8 - g.dialogueTimer) / 0.5, 0, 1);
  const alpha = Math.min(fadeIn, fadeOut);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  const text = g.dialogue;
  const isQuote = text.includes(':');
  let speaker = '';
  let msg = text;
  if (isQuote) {
    const colonIdx = text.indexOf(':');
    speaker = text.substring(0, colonIdx).trim();
    msg = text.substring(colonIdx + 1).trim();
  }

  ctx.font = `700 14px ${FONT}`;
  const spW = speaker ? ctx.measureText(speaker.toUpperCase()).width + 20 : 0;
  ctx.font = `500 15px ${FONT}`;
  const msgW = ctx.measureText(msg).width;
  const bw = clamp(spW + msgW + 52, 320, 740);
  const bx = 640 - bw * 0.5;
  const by = 616;

  panel(ctx, bx, by, bw, 50, 12, PALETTE.accent);

  if (speaker) {
    // Clean speaker pill badge so name and quote NEVER overlap
    ctx.fillStyle = 'rgba(255, 154, 68, 0.18)';
    ctx.beginPath();
    ctx.roundRect(bx + 16, by + 11, spW - 6, 22, 6);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `800 12px ${FONT}`;
    ctx.fillText(speaker.toUpperCase(), bx + 23, by + 26);

    ctx.fillStyle = PALETTE.hud;
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText(msg, bx + 20 + spW, by + 26);
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(msg, 640, by + 26);
  }

  // Animated progress bar along bottom of dialogue panel
  const remain = clamp(1 - g.dialogueTimer / 8, 0.15, 1);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(bx + 16, by + 40, bw - 32, 2.5);
  ctx.fillStyle = PALETTE.accent;
  ctx.fillRect(bx + 16, by + 40, (bw - 32) * remain, 2.5);
  ctx.restore();
}

export function drawHUD(ctx, g) {
  const p = g.player;
  ctx.textBaseline = 'alphabetic';

  // Smoothly ticking money counter
  if (displayMoney === null) {
    displayMoney = p.money;
  } else if (displayMoney !== p.money) {
    const diff = p.money - displayMoney;
    if (diff > 0) moneyFlash = 1;
    const step = Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * 0.14));
    displayMoney = Math.abs(diff) <= Math.abs(step) ? p.money : displayMoney + step;
  }
  moneyFlash = Math.max(0, moneyFlash - 0.03);

  drawMinimap(ctx, g);

  // District + Health & Armour capsule above the minimap
  const vitalsY = MM.y - 62;
  panel(ctx, MM.x - 5, vitalsY, MM.w + 10, 50, 10);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.teal;
  ctx.font = `800 11px ${FONT}`;
  ctx.fillText(g.district.toUpperCase(), MM.x + 6, vitalsY + 16);

  // Health bar
  const barX = MM.x + 6;
  const barW = MM.w - 12;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.beginPath();
  ctx.roundRect(barX, vitalsY + 23, barW, 8, 4);
  ctx.fill();
  const hpFill = p.health > 30 ? PALETTE.health : '#ef4c43';
  ctx.fillStyle = hpFill;
  ctx.beginPath();
  ctx.roundRect(barX, vitalsY + 23, barW * clamp(p.health / 100, 0, 1), 8, 4);
  ctx.fill();

  // Armour bar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.roundRect(barX, vitalsY + 35, barW, 6, 3);
  ctx.fill();
  if (p.armour > 0) {
    ctx.fillStyle = PALETTE.armour;
    ctx.beginPath();
    ctx.roundRect(barX, vitalsY + 35, barW * clamp(p.armour / 100, 0, 1), 6, 3);
    ctx.fill();
  }

  // Top-right status panel: ticking cash, animated wanted stars & clock
  const trW = 196;
  const trX = 1280 - 24 - trW;
  panel(ctx, trX, 20, trW, 92, 12);

  // Money readout with smooth roll + green flash
  ctx.textAlign = 'right';
  ctx.fillStyle = moneyFlash > 0.1 ? '#b8ffc0' : '#8ae69a';
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText(formatMoney(displayMoney), trX + trW - 14, 52);

  // Clock badge on left of top-right card
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `700 12px ${FONT}`;
  ctx.fillText(formatClock(g.time), trX + 14, 48);

  // Animated wanted stars
  const wantedFlash = Math.sin(g.elapsed * 9) > 0;
  for (let i = 0; i < 5; i += 1) {
    const sx = trX + trW - 22 - i * 31;
    const sy = 84;
    const active = i < g.wanted;
    ctx.save();
    ctx.translate(sx, sy);
    if (active) {
      const pulse = 1 + 0.12 * Math.sin(g.elapsed * 7 + i * 0.9);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = wantedFlash ? '#ff4a4a' : '#ffcf4d';
      ctx.shadowBlur = 10;
      starPath(ctx, 0, 0, 11);
      ctx.fillStyle = PALETTE.star;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff5cc';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    } else {
      starPath(ctx, 0, 0, 10.2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Objective panel, top left
  if (g.objective) {
    ctx.textAlign = 'left';
    ctx.font = `600 15px ${FONT}`;
    const objW = clamp(ctx.measureText(g.objective).width + 46, 240, 560);
    panel(ctx, 24, 20, objW, 56, 11, PALETTE.accent);
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `800 10px ${FONT}`;
    ctx.fillText('CURRENT OBJECTIVE', 40, 39);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(g.objective, 40, 61);
  }

  // Notifications, top centre (compact pill)
  ctx.textAlign = 'center';
  let ny = 108;
  for (const n of g.notifications) {
    const fadeIn = clamp(n.age / 0.25, 0, 1);
    const fadeOut = clamp((n.life - n.age) / 0.5, 0, 1);
    const a = Math.min(fadeIn, fadeOut);
    ctx.font = `600 14px ${FONT}`;
    const w = ctx.measureText(n.text).width + 38;
    ctx.save();
    ctx.globalAlpha = a;
    panel(ctx, 640 - w * 0.5, ny - 20, w, 32, 16);
    ctx.fillStyle = PALETTE.hud;
    ctx.fillText(n.text, 640, ny);
    ctx.restore();
    ny += 40;
  }

  drawSpeedometer(ctx, g);

  // Weapon HUD panel bottom-right when on foot
  if (g.combat && !g.player.inCar) {
    panel(ctx, 1126, 624, 130, 58, 11, PALETTE.teal);
    drawWeaponHUD(ctx, g.combat, 1244, 650, FONT);
  }

  drawDialogue(ctx, g);

  // Subtle bottom-right key legend
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(218, 228, 236, 0.58)';
  ctx.font = `500 11px ${FONT}`;
  ctx.fillText('WASD move · Shift sprint · F vehicle · R weapon · N rain · P pause', 1256, 708);
}

export function drawTitle(ctx, g, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0, 'rgba(6, 10, 20, 0.20)');
  grad.addColorStop(1, 'rgba(6, 10, 20, 0.86)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALETTE.teal;
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText('A N   O R I G I N A L   O P E N - W O R L D   C R I M E   S T O R Y', 92, 194);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = PALETTE.hud;
  ctx.font = `900 88px ${FONT}`;
  ctx.fillText('BLACKWATER', 88, 282);
  const sun = ctx.createLinearGradient(88, 300, 620, 380);
  sun.addColorStop(0, PALETTE.accent);
  sun.addColorStop(0.55, '#ffd08a');
  sun.addColorStop(1, PALETTE.neonMagenta);
  ctx.fillStyle = sun;
  ctx.fillText('HARBOR', 88, 370);
  ctx.restore();

  ctx.fillStyle = `rgba(47, 208, 214, ${(0.68 + 0.28 * Math.sin(t * 2)).toFixed(3)})`;
  ctx.fillRect(92, 390, 310, 4);

  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `500 17px ${FONT}`;
  ctx.fillText('Sun, speed and salt air. The harbor belongs to whoever takes it.', 92, 426);

  const items = g.titleItems;
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const y = 492 + i * 46;
    const sel = i === g.menuIndex;
    ctx.globalAlpha = it.disabled ? 0.35 : 1;
    ctx.fillStyle = sel ? PALETTE.accent : PALETTE.hud;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(sel ? '▸ ' + it.label : '   ' + it.label, 92, y);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(it.key, 320, y);
    ctx.globalAlpha = 1;
  }

  panel(ctx, 856, 444, 340, 212, 12, PALETTE.teal);
  ctx.fillStyle = PALETTE.accent;
  ctx.font = `800 11px ${FONT}`;
  ctx.fillText('CONTROLS', 880, 472);
  ctx.fillStyle = PALETTE.hud;
  ctx.font = `500 14px ${FONT}`;
  const lines = [
    'WASD / Arrows — move',
    'Shift — sprint / handbrake',
    'Mouse — aim · Click — fire',
    'F — enter / exit vehicle',
    'H — horn · V — melee · N — rain',
    'P / Esc — pause',
  ];
  for (let i = 0; i < lines.length; i += 1) ctx.fillText(lines[i], 880, 498 + i * 24);

  ctx.fillStyle = 'rgba(154, 176, 191, 0.72)';
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText('Blackwater Harbor · v1.0 · original — every pixel drawn by this engine', 92, 692);
}

export function drawPause(ctx, g) {
  ctx.fillStyle = 'rgba(6, 10, 18, 0.66)';
  ctx.fillRect(0, 0, 1280, 720);
  panel(ctx, 440, 168, 400, 410, 16, PALETTE.accent);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hud;
  ctx.font = `900 48px ${FONT}`;
  ctx.fillText('PAUSED', 640, 236);
  const items = ['Resume', 'Save Game', 'Restart', 'Quit to Title'];
  for (let i = 0; i < items.length; i += 1) {
    const sel = i === g.menuIndex;
    ctx.fillStyle = sel ? PALETTE.accent : PALETTE.hud;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(sel ? '▸ ' + items[i] : items[i], 640, 314 + i * 48);
  }
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText('↑ ↓ choose · Enter select · Esc resume', 640, 534);
  if (g.saveFlash > 0) {
    ctx.fillStyle = PALETTE.teal;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText('Progress saved', 640, 560);
  }
}
