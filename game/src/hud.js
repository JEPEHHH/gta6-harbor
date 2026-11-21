// The HUD: minimap with blips, health and armour, money, wanted stars, the objective line,
// notifications and the speedometer — plus the title and pause screens, all in 1280x720 space.

import { CITY, FONT, PALETTE } from './config.js';
import { TAU, clamp, formatClock, formatMoney } from './util.js';

const MM = { x: 24, y: 720 - 174, w: 216, h: 150 };
const MM_RANGE = 1500; // world units across the minimap

function panel(ctx, x, y, w, h, r = 8) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 10; k += 1) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * 0.45;
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
  const mx = (wx) => MM.x + (wx - p.x) * scale + MM.w / 2;
  const my = (wy) => MM.y + (wy - p.y) * scale + MM.h / 2;

  panel(ctx, MM.x - 3, MM.y - 3, MM.w + 6, MM.h + 6, 10);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(MM.x, MM.y, MM.w, MM.h, 7);
  ctx.clip();
  ctx.fillStyle = '#12242c';
  ctx.fillRect(MM.x, MM.y, MM.w, MM.h);

  ctx.fillStyle = '#1d5f70';
  const seaTop = my(CITY.seaY);
  if (seaTop < MM.y + MM.h) ctx.fillRect(MM.x, Math.max(MM.y, seaTop), MM.w, MM.h);
  const eastLeft = mx(CITY.eastX);
  if (eastLeft < MM.x + MM.w) ctx.fillRect(Math.max(MM.x, eastLeft), MM.y, MM.w, MM.h);
  ctx.fillRect(mx(CITY.basin.x), my(CITY.basin.y), CITY.basin.w * scale, CITY.basin.h * scale);

  for (const b of world.blocks) {
    if (b.district !== 'park') continue;
    ctx.fillStyle = '#2f6a44';
    ctx.fillRect(mx(b.x), my(b.y), b.w * scale, b.h * scale);
  }

  ctx.strokeStyle = 'rgba(226,228,222,0.75)';
  ctx.lineWidth = 2.4;
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

  for (const blip of g.blips) {
    ctx.fillStyle = blip.color;
    ctx.beginPath();
    ctx.arc(mx(blip.x), my(blip.y), 3, 0, TAU);
    ctx.fill();
  }
  if (g.mission && g.mission.waypoint) {
    const wp = g.mission.waypoint;
    const wx = clamp(mx(wp.x), MM.x + 7, MM.x + MM.w - 7);
    const wy = clamp(my(wp.y), MM.y + 7, MM.y + MM.h - 7);
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(wx, wy - 6);
    ctx.lineTo(wx + 5, wy);
    ctx.lineTo(wx, wy + 6);
    ctx.lineTo(wx - 5, wy);
    ctx.closePath();
    ctx.fill();
  }

  // The player arrow, pointing where they face.
  ctx.save();
  ctx.translate(mx(p.x), my(p.y));
  ctx.rotate(p.angle + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.5, 5);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(-4.5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();

  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('N', MM.x + MM.w / 2, MM.y + 12);
}

function drawSpeedometer(ctx, g) {
  const car = g.player.inCar;
  if (!car) return;
  const cx = 1180;
  const cy = 616;
  const speed = Math.hypot(car.vx, car.vy);
  const kmh = Math.round(speed * 0.36);
  panel(ctx, cx - 74, cy - 74, 148, 132, 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, 50, Math.PI * 0.75, Math.PI * 2.25);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, 50, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * clamp(speed / 340, 0, 1));
  ctx.stroke();
  ctx.fillStyle = PALETTE.hud;
  ctx.font = `800 26px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(kmh), cx, cy + 6);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText('KM/H', cx, cy + 24);
}

export function drawHUD(ctx, g) {
  const p = g.player;
  ctx.textBaseline = 'alphabetic';

  drawMinimap(ctx, g);

  // District, health and armour above the minimap.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText(g.district.toUpperCase(), MM.x, MM.y - 48);
  ctx.fillStyle = 'rgba(10,18,26,0.6)';
  ctx.beginPath();
  ctx.roundRect(MM.x, MM.y - 34, MM.w, 9, 4);
  ctx.fill();
  ctx.fillStyle = p.health > 30 ? PALETTE.health : '#e05545';
  ctx.beginPath();
  ctx.roundRect(MM.x, MM.y - 34, MM.w * clamp(p.health / 100, 0, 1), 9, 4);
  ctx.fill();
  if (p.armour > 0) {
    ctx.fillStyle = 'rgba(10,18,26,0.6)';
    ctx.beginPath();
    ctx.roundRect(MM.x, MM.y - 22, MM.w, 6, 3);
    ctx.fill();
    ctx.fillStyle = PALETTE.armour;
    ctx.beginPath();
    ctx.roundRect(MM.x, MM.y - 22, MM.w * clamp(p.armour / 100, 0, 1), 6, 3);
    ctx.fill();
  }

  // Money, wanted stars and the clock, top right.
  ctx.textAlign = 'right';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 5;
  ctx.fillStyle = '#9fd6a0';
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText(formatMoney(p.money), 1256, 42);
  ctx.shadowBlur = 0;
  for (let i = 0; i < 5; i += 1) {
    star(ctx, 1244 - i * 27, 66, 11);
    if (i < g.wanted) {
      ctx.fillStyle = PALETTE.star;
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText(formatClock(g.time), 1256, 96);

  // Objective line, top left.
  if (g.objective) {
    ctx.textAlign = 'left';
    panel(ctx, 24, 22, Math.min(560, 40 + ctx.measureText(g.objective).width), 52, 8);
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `800 11px ${FONT}`;
    ctx.fillText('OBJECTIVE', 38, 42);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(g.objective, 38, 63);
  }

  // Notifications, top centre.
  ctx.textAlign = 'center';
  let ny = 116;
  for (const n of g.notifications) {
    const fadeIn = clamp(n.age / 0.25, 0, 1);
    const fadeOut = clamp((n.life - n.age) / 0.5, 0, 1);
    const a = Math.min(fadeIn, fadeOut);
    ctx.font = `600 16px ${FONT}`;
    const w = ctx.measureText(n.text).width + 36;
    ctx.globalAlpha = a;
    panel(ctx, 640 - w / 2, ny - 20, w, 32, 16);
    ctx.fillStyle = PALETTE.hud;
    ctx.fillText(n.text, 640, ny + 2);
    ctx.globalAlpha = 1;
    ny += 40;
  }

  drawSpeedometer(ctx, g);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(200,212,220,0.55)';
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText('WASD move · Shift sprint · F enter vehicle · P pause', 1256, 700);
}

export function drawTitle(ctx, g, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0, 'rgba(6,10,18,0.16)');
  grad.addColorStop(1, 'rgba(6,10,18,0.82)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALETTE.teal;
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText('A N   O R I G I N A L   O P E N - W O R L D   C R I M E   S T O R Y', 92, 196);

  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = PALETTE.hud;
  ctx.font = `900 88px ${FONT}`;
  ctx.fillText('BLACKWATER', 88, 284);
  const sun = ctx.createLinearGradient(88, 300, 620, 380);
  sun.addColorStop(0, PALETTE.accent);
  sun.addColorStop(1, '#ffd08a');
  ctx.fillStyle = sun;
  ctx.fillText('HARBOR', 88, 372);
  ctx.shadowBlur = 0;
  ctx.fillStyle = `rgba(55,194,201,${(0.65 + 0.3 * Math.sin(t * 2)).toFixed(3)})`;
  ctx.fillRect(92, 392, 300, 4);

  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `500 17px ${FONT}`;
  ctx.fillText('Sun, speed and salt air. The harbor belongs to whoever takes it.', 92, 428);

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

  panel(ctx, 860, 452, 332, 200, 10);
  ctx.fillStyle = PALETTE.accent;
  ctx.font = `800 12px ${FONT}`;
  ctx.fillText('CONTROLS', 884, 480);
  ctx.fillStyle = PALETTE.hud;
  ctx.font = `500 14px ${FONT}`;
  const lines = [
    'WASD / Arrows — move',
    'Shift — sprint',
    'Mouse — aim · Click — fire',
    'F — enter / exit vehicle',
    'H — horn · V — melee',
    'P / Esc — pause',
  ];
  for (let i = 0; i < lines.length; i += 1) ctx.fillText(lines[i], 884, 506 + i * 23);

  ctx.fillStyle = 'rgba(159,176,186,0.7)';
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText('Blackwater Harbor · v0.1 · every pixel drawn by this game', 92, 692);
}

export function drawPause(ctx, g) {
  ctx.fillStyle = 'rgba(8,12,20,0.62)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hud;
  ctx.font = `900 54px ${FONT}`;
  ctx.fillText('PAUSED', 640, 236);
  const items = ['Resume', 'Save Game', 'Restart', 'Quit to Title'];
  for (let i = 0; i < items.length; i += 1) {
    const sel = i === g.menuIndex;
    ctx.fillStyle = sel ? PALETTE.accent : PALETTE.hud;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(sel ? '▸ ' + items[i] : items[i], 640, 320 + i * 46);
  }
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText('↑ ↓ choose · Enter select · Esc resume', 640, 560);
  if (g.saveFlash > 0) {
    ctx.fillStyle = PALETTE.teal;
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText('Progress saved', 640, 596);
  }
}
