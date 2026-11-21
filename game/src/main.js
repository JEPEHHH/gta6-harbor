// Bootstrap and the one loop: fixed 1/60 s steps, a title / play / pause state machine, and
// window.__harbor — the deterministic hooks the screenshot capture drives the game through.

import { PLAYER, STEP, TIME } from './config.js';
import { createInput } from './input.js';
import { createCamera } from './camera.js';
import { createWorld } from './world.js';
import { createPlayer, updatePlayer } from './player.js';
import { createRenderer } from './render.js';
import { hasSave, loadGame, saveGame } from './save.js';
import { clamp, damp } from './util.js';

const MAX_FRAME = 0.25;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const camera = createCamera(world.spawn.x, world.spawn.y);
const player = createPlayer(world);

const game = {
  screen: 'title',
  world,
  camera,
  player,
  time: TIME.title,
  elapsed: 0,
  wanted: 0,
  district: world.districtAt(world.spawn.x, world.spawn.y),
  objective: '',
  particles: [],
  notifications: [],
  blips: [],
  mission: null,
  menuIndex: 0,
  saveExists: hasSave(),
  saveFlash: 0,
  titleItems: [],
  // Filled by milestone B: traffic, peds, police, vehicles, bullets.
  traffic: [],
  peds: [],
  police: [],
  bullets: [],
};

function announce(message) {
  status.textContent = message;
}

function notify(text, life = 4) {
  game.notifications.push({ text, age: 0, life });
  if (game.notifications.length > 4) game.notifications.shift();
}

function refreshTitleItems() {
  game.saveExists = hasSave();
  game.titleItems = [
    { label: 'New Game', key: 'Enter', disabled: false },
    { label: 'Continue', key: 'C', disabled: !game.saveExists },
  ];
}

function newGame() {
  Object.assign(player, createPlayer(world));
  game.time = TIME.start;
  game.wanted = 0;
  game.mission = null;
  game.particles.length = 0;
  game.notifications.length = 0;
  game.objective = 'Explore the harbor — find a ride and make a name';
  game.screen = 'play';
  camera.snap(player.x, player.y);
  notify('Welcome to Blackwater Harbor');
  announce('Playing. On foot in Blackwater Harbor.');
}

function continueGame() {
  const data = loadGame();
  if (!data) return;
  newGame();
  player.x = clamp(data.x, PLAYER.radius, world.w - PLAYER.radius);
  player.y = clamp(data.y, PLAYER.radius, world.h - PLAYER.radius);
  player.angle = data.angle ?? player.angle;
  player.money = data.money ?? player.money;
  player.health = data.health ?? player.health;
  player.armour = data.armour ?? 0;
  game.time = data.time ?? game.time;
  game.wanted = data.wanted ?? 0;
  camera.snap(player.x, player.y);
  game.notifications.length = 0;
  notify('Welcome back to the harbor');
}

function toTitle() {
  game.screen = 'title';
  game.time = TIME.title;
  game.menuIndex = 0;
  refreshTitleItems();
  camera.snap(2400, 3020);
  announce('Blackwater Harbor. Press Enter to start.');
}

function moveMenu(dir) {
  const items = game.screen === 'title' ? game.titleItems : [0, 1, 2, 3];
  let i = (game.menuIndex + dir + items.length) % items.length;
  if (game.screen === 'title' && items[i].disabled) i = (i + dir + items.length) % items.length;
  game.menuIndex = i;
}

function handleInput() {
  if (game.screen === 'title') {
    if (input.pressed('up')) moveMenu(-1);
    if (input.pressed('down')) moveMenu(1);
    if (input.pressed('continue') && game.saveExists) continueGame();
    else if (input.pressed('confirm') || input.takeMousePress()) {
      if (game.menuIndex === 1 && game.saveExists) continueGame();
      else newGame();
    }
  } else if (game.screen === 'play') {
    if (input.pressed('pause')) {
      game.screen = 'pause';
      game.menuIndex = 0;
      announce('Paused.');
    }
  } else if (game.screen === 'pause') {
    if (input.pressed('up')) moveMenu(-1);
    if (input.pressed('down')) moveMenu(1);
    if (input.pressed('pause')) {
      game.screen = 'play';
      announce('Playing.');
    } else if (input.pressed('confirm')) {
      if (game.menuIndex === 0) {
        game.screen = 'play';
        announce('Playing.');
      } else if (game.menuIndex === 1) {
        if (saveGame(game)) game.saveFlash = 2;
        announce('Game saved.');
      } else if (game.menuIndex === 2) {
        newGame();
      } else {
        toTitle();
      }
    }
  }
}

function stepParticles(dt) {
  const parts = game.particles;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const pt = parts[i];
    pt.age += dt;
    if (pt.age >= pt.life) {
      parts.splice(i, 1);
      continue;
    }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.94;
    pt.vy *= 0.94;
  }
}

function step(dt) {
  game.elapsed += dt;
  if (game.screen === 'title') {
    // A slow drift along the coast at dusk behind the title.
    const panX = 2400 + Math.sin(game.elapsed * 0.05) * 1000;
    const panY = 3020 + Math.sin(game.elapsed * 0.023) * 120;
    camera.x = damp(camera.x, panX, 1.2, dt);
    camera.y = damp(camera.y, panY, 1.2, dt);
    camera.zoom = damp(camera.zoom, 0.95, 2, dt);
    return;
  }
  if (game.screen === 'pause') {
    game.saveFlash = Math.max(0, game.saveFlash - dt);
    return;
  }

  game.time = (game.time + (dt * 24) / TIME.daySeconds) % 24;
  updatePlayer(player, dt, input, world, game.particles);
  camera.update(dt, player, player.vx, player.vy, Boolean(player.inCar));
  stepParticles(dt);

  const district = world.districtAt(player.x, player.y);
  if (district !== game.district) {
    game.district = district;
    notify(district, 2.5);
  }
  for (let i = game.notifications.length - 1; i >= 0; i -= 1) {
    game.notifications[i].age += dt;
    if (game.notifications[i].age >= game.notifications[i].life) game.notifications.splice(i, 1);
  }
  game.saveFlash = Math.max(0, game.saveFlash - dt);
}

let last = performance.now();
let accumulator = 0;
let frames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  handleInput();
  while (accumulator >= STEP) {
    step(STEP);
    accumulator -= STEP;
  }
  renderer.draw(game);
  input.endFrame();
  frames += 1;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.screen === 'play') {
    game.screen = 'pause';
    game.menuIndex = 0;
    announce('Paused.');
  }
});

// Deterministic hooks for the screenshot capture. car/chase/mission gain their full forcing
// behaviour in milestones B and C; today they stage the closest real situation.
window.__harbor = {
  ready() {
    return frames > 2;
  },
  state(name) {
    if (name === 'title') {
      toTitle();
      return true;
    }
    if (game.screen !== 'play') newGame();
    if (name === 'pause') {
      game.screen = 'pause';
      game.menuIndex = 0;
      return true;
    }
    if (name === 'foot') player.inCar = null;
    if (name === 'wanted' || name === 'chase') game.wanted = 3;
    return true;
  },
  setWanted(n) {
    game.wanted = clamp(Math.round(n), 0, 5);
  },
  teleport(x, y) {
    player.x = clamp(x, PLAYER.radius, world.w - PLAYER.radius);
    player.y = clamp(y, PLAYER.radius, world.h - PLAYER.radius);
    camera.snap(player.x, player.y);
  },
  spawnTraffic() {
    return false;
  },
  startMission() {
    return false;
  },
  setTime(h) {
    game.time = ((h % 24) + 24) % 24;
  },
  game,
};

refreshTitleItems();
camera.snap(2400, 3020);
announce('Blackwater Harbor. Press Enter to start.');
requestAnimationFrame(frame);
