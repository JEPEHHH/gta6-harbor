// Bootstrap and the one loop: fixed 1/60 s steps, a title / play / pause state machine, and
// window.__harbor — the deterministic hooks the screenshot capture drives the game through.
// Milestone B: vehicles, traffic, peds, police, wanted level, combat, audio, save/load.

import { PLAYER, STEP, TIME } from './config.js';
import { createInput } from './input.js';
import { createCamera } from './camera.js';
import { createWorld } from './world.js';
import { createPlayer, updatePlayer } from './player.js';
import { createRenderer } from './render.js';
import { hasSave, loadGame, saveGame } from './save.js';
import { clamp, damp, makeRng } from './util.js';
import { buildRoadGraph, updateLights } from './roads.js';
import { createVehicle, spawnParkedCars, updateVehicle, vehicleCollision } from './vehicles.js';
import { spawnTraffic, updateTrafficAI, cullTraffic, refillTraffic } from './traffic.js';
import { spawnPeds, updatePeds, cullPeds } from './peds.js';
import { createPoliceState, updatePolice, isBusted, resetPolice, forcePoliceChase } from './police.js';
import { createWantedState, updateWanted, reportCrime, setWantedLevel, clearWanted } from './wanted.js';
import { createCombatState, updateCombat, resolveBulletHits, isPlayerDead, respawnPlayer, cycleWeapon } from './combat.js';
import { updateBullets } from './shots.js';
import {
  resumeAudio, startEngine, updateEngine, stopEngine,
  startSiren, stopSiren, playGunshot, playHorn,
  playFootstep, playSkid, playImpact, playWasted, playPickup,
} from './audio.js';
import { createRandom } from './random.js';

const MAX_FRAME = 0.25;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const camera = createCamera(world.spawn.x, world.spawn.y);
const player = createPlayer(world);
const roadGraph = buildRoadGraph(world);
const rng = createRandom(42);

// Parked cars stay across sessions; traffic and peds are dynamic.
const parkedCars = spawnParkedCars(world, rng, 40);
const combat = createCombatState();
const wantedState = createWantedState();
const policeState = createPoliceState();

const game = {
  screen: 'title',
  world,
  camera,
  player,
  input,
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
  // Milestone B — populated systems
  traffic: [],
  peds: [],
  police: [],
  bullets: [],
  roadGraph,
  parkedCars,
  combat,
  wantedState,
  policeState,
  deathScreen: null,
};

// Audio state tracking
let engineRunning = false;
let sirenRunning = false;
let lastSkidTime = 0;
let footstepCooldown = 0;

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

/** All vehicles the player can steal or collide with. */
function allInteractableVehicles() {
  const list = [...parkedCars, ...game.traffic];
  for (const u of policeState.units) list.push(u.car);
  return list;
}

function newGame() {
  Object.assign(player, createPlayer(world));
  game.time = TIME.start;
  game.wanted = 0;
  game.mission = null;
  game.particles.length = 0;
  game.notifications.length = 0;
  game.bullets.length = 0;
  game.deathScreen = null;
  game.objective = 'Explore the harbor — find a ride and make a name';
  game.screen = 'play';

  // Reset subsystems
  clearWanted(wantedState);
  resetPolice(policeState);
  Object.assign(combat, createCombatState());

  // Spawn initial traffic and peds
  game.traffic = spawnTraffic(world, roadGraph, rng, 14);
  game.peds = [];
  const newPeds = spawnPeds(world, player, rng, game.peds, 20);
  game.peds.push(...newPeds);

  camera.snap(player.x, player.y);
  notify('Welcome to Blackwater Harbor');
  announce('Playing. On foot in Blackwater Harbor.');
  resumeAudio();
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
  if (data.weapon) combat.weapon = data.weapon;
  if (data.ammo) Object.assign(combat.ammo, data.ammo);
  wantedState.heat = data.wanted ? data.wanted * 1.1 : 0;
  wantedState.level = data.wanted ?? 0;
  camera.snap(player.x, player.y);
  game.notifications.length = 0;
  notify('Welcome back to the harbor');
}

function toTitle() {
  game.screen = 'title';
  game.time = TIME.title;
  game.menuIndex = 0;
  game.deathScreen = null;
  refreshTitleItems();
  camera.snap(2400, 3020);
  announce('Blackwater Harbor. Press Enter to start.');
  // Stop audio
  if (engineRunning) { stopEngine(); engineRunning = false; }
  if (sirenRunning) { stopSiren(); sirenRunning = false; }
}

function moveMenu(dir) {
  const items = game.screen === 'title' ? game.titleItems : [0, 1, 2, 3];
  let i = (game.menuIndex + dir + items.length) % items.length;
  if (game.screen === 'title' && items[i].disabled) i = (i + dir + items.length) % items.length;
  game.menuIndex = i;
}

function handleDeath(type) {
  game.deathScreen = type;    // 'wasted' or 'busted'
  if (engineRunning) { stopEngine(); engineRunning = false; }
  if (sirenRunning) { stopSiren(); sirenRunning = false; }
  playWasted();
}

function handleDeathInput() {
  if (input.pressed('confirm') || input.takeMousePress()) {
    respawnPlayer(player, world, camera);
    clearWanted(wantedState);
    resetPolice(policeState);
    game.wanted = 0;
    game.deathScreen = null;
    player.money = Math.max(0, player.money - 500);
    game.objective = 'Explore the harbor — find a ride and make a name';
    notify(game.deathScreen === 'busted' ? 'Released from custody — $500 bail' : 'Patched up at the hospital — $500');
  }
}

function handleInput() {
  if (game.deathScreen) {
    handleDeathInput();
    return;
  }
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
    // Weapon cycling with scroll or number keys (handled via radio key for simplicity)
    if (input.pressed('radio')) {
      cycleWeapon(combat);
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

/** The crime reporter callback, bound to this module's scope. */
function crimeReporter(crimeName) {
  reportCrime(wantedState, crimeName, game.elapsed);
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

  // ── Day/night ───────────────────────────────────────────────
  game.time = (game.time + (dt * 24) / TIME.daySeconds) % 24;

  // ── Traffic lights ──────────────────────────────────────────
  updateLights(roadGraph, dt);

  // ── Gather all vehicles for collision / interaction ─────────
  const allVehicles = allInteractableVehicles();

  // ── Player ──────────────────────────────────────────────────
  updatePlayer(player, dt, input, world, game.particles, allVehicles, camera, wantedState, game.elapsed);
  camera.update(dt, player, player.vx, player.vy, Boolean(player.inCar));

  // ── Combat (on foot) ────────────────────────────────────────
  if (!game.deathScreen) {
    updateCombat(combat, dt, player, input, camera, world, game.bullets, game.particles, game.peds, policeState.units, crimeReporter);
    if (combat.shooting) {
      playGunshot();
    }
  }

  // ── Bullets ─────────────────────────────────────────────────
  updateBullets(game.bullets, dt);
  resolveBulletHits(game.bullets, game.peds, policeState.units, player, world, game.particles, camera, crimeReporter);

  // ── Traffic AI ──────────────────────────────────────────────
  updateTrafficAI(game.traffic, dt, world, roadGraph, player, allVehicles, game.particles, rng);
  cullTraffic(game.traffic, player);
  refillTraffic(game.traffic, world, roadGraph, player, rng, 14);

  // ── Vehicle-to-vehicle collisions (all pairs that matter) ───
  for (let i = 0; i < allVehicles.length; i += 1) {
    for (let j = i + 1; j < allVehicles.length; j += 1) {
      vehicleCollision(allVehicles[i], allVehicles[j]);
    }
  }

  // ── Pedestrians ─────────────────────────────────────────────
  updatePeds(game.peds, dt, world, player, allVehicles, game.particles, rng);
  cullPeds(game.peds, player);
  const newPeds = spawnPeds(world, player, rng, game.peds, 20);
  game.peds.push(...newPeds);

  // ── Wanted system ───────────────────────────────────────────
  // Detect vehicle hit on ped (crime)
  if (player.inCar) {
    const sp = Math.hypot(player.inCar.vx, player.inCar.vy);
    if (sp > 60) {
      for (const ped of game.peds) {
        if (ped.alive && Math.hypot(ped.x - player.x, ped.y - player.y) < 20) {
          crimeReporter('hit_ped');
        }
      }
    }
  }

  updateWanted(wantedState, dt, game.elapsed, player, policeState.units.map((u) => u.car));
  game.wanted = wantedState.level;

  // ── Police ──────────────────────────────────────────────────
  updatePolice(policeState, dt, world, roadGraph, player, game.wanted, allVehicles, game.bullets, game.particles, rng, game.elapsed);

  // ── Death / busted ──────────────────────────────────────────
  if (!game.deathScreen) {
    if (isPlayerDead(player)) {
      handleDeath('wasted');
    } else if (game.wanted > 0 && isBusted(policeState)) {
      handleDeath('busted');
    }
  }

  // ── Particles ───────────────────────────────────────────────
  stepParticles(dt);

  // ── Audio management ────────────────────────────────────────
  if (player.inCar) {
    if (!engineRunning) { startEngine(); engineRunning = true; }
    updateEngine(player.inCar.engineRpm, player.inCar.throttle);
    // Skid sound
    if (player.inCar.driftAngle !== 0 && game.elapsed - lastSkidTime > 0.4) {
      playSkid();
      lastSkidTime = game.elapsed;
    }
    // Horn
    if (player.inCar.horn > 0.45) {
      playHorn();
    }
  } else {
    if (engineRunning) { stopEngine(); engineRunning = false; }
    // Footsteps
    if (player.moving) {
      footstepCooldown -= dt;
      if (footstepCooldown <= 0) {
        playFootstep();
        footstepCooldown = player.sprinting ? 0.22 : 0.35;
      }
    }
  }

  // Police siren audio
  if (game.wanted > 0 && policeState.units.length > 0) {
    if (!sirenRunning) { startSiren(); sirenRunning = true; }
  } else {
    if (sirenRunning) { stopSiren(); sirenRunning = false; }
  }

  // ── HUD data ────────────────────────────────────────────────
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

  // ── Blips ───────────────────────────────────────────────────
  game.blips.length = 0;
  for (const u of policeState.units) {
    game.blips.push({ x: u.car.x, y: u.car.y, color: '#5080e0' });
  }
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

// Deterministic hooks for the screenshot capture.
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
    if (name === 'foot') {
      player.inCar = null;
      if (engineRunning) { stopEngine(); engineRunning = false; }
      return true;
    }
    if (name === 'car') {
      // Put the player in a nearby vehicle or spawn one
      const nearby = allInteractableVehicles().find((v) => !v.driver);
      if (nearby) {
        player.inCar = nearby;
        nearby.driver = 'player';
        nearby.vx = Math.cos(nearby.angle) * 160;
        nearby.vy = Math.sin(nearby.angle) * 160;
      } else {
        const car = createVehicle(player.x + 30, player.y, player.angle, 'sports');
        car.driver = 'player';
        car.vx = Math.cos(car.angle) * 160;
        car.vy = Math.sin(car.angle) * 160;
        parkedCars.push(car);
        player.inCar = car;
      }
      player.x = player.inCar.x;
      player.y = player.inCar.y;
      return true;
    }
    if (name === 'chase') {
      // Force a police chase scene
      this.state('car');
      setWantedLevel(wantedState, 3);
      game.wanted = 3;
      forcePoliceChase(policeState, world, player, roadGraph, rng, 3);
      return true;
    }
    if (name === 'wanted') {
      setWantedLevel(wantedState, 3);
      game.wanted = 3;
      forcePoliceChase(policeState, world, player, roadGraph, rng, 2);
      return true;
    }
    if (name === 'mission') {
      game.objective = 'Meet Marcus at the docks — collect the package';
      game.mission = { waypoint: { x: 4500, y: 1200 } };
      return true;
    }
    return true;
  },
  setWanted(n) {
    const level = clamp(Math.round(n), 0, 5);
    setWantedLevel(wantedState, level);
    game.wanted = level;
  },
  teleport(x, y) {
    player.x = clamp(x, PLAYER.radius, world.w - PLAYER.radius);
    player.y = clamp(y, PLAYER.radius, world.h - PLAYER.radius);
    camera.snap(player.x, player.y);
  },
  spawnTraffic(n) {
    const extra = spawnTraffic(world, roadGraph, rng, n || 8);
    game.traffic.push(...extra);
    return true;
  },
  startMission() {
    return false;   // milestone C
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
