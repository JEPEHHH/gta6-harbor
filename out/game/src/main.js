// Bootstrap and the one loop: fixed 1/60 s steps, a title / play / pause state machine, and
// window.__harbor — the deterministic hooks the screenshot capture drives the game through.
// Milestone C: missions, day/night polish, effects, deterministic hooks.

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
import {
  createMissionState, startNextMission, startMissionByIndex, currentMission,
  currentStep, currentObjective, currentWaypoint, updateMissions,
  saveMissionData, loadMissionData, missionCount,
} from './missions.js';

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
const parkedCars = spawnParkedCars(world, rng, 115);
const combat = createCombatState();
const wantedState = createWantedState();
const policeState = createPoliceState();
const missionState = createMissionState();

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
  districtBanner: null,
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
  // Milestone C — missions, dialogue and effects
  missionState,
  dialogue: null,
  dialogueTimer: 0,
  skidmarks: [],
  rain: false,
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
  game.dialogue = null;
  game.screen = 'play';

  // Reset subsystems
  clearWanted(wantedState);
  resetPolice(policeState);
  Object.assign(combat, createCombatState());
  Object.assign(missionState, createMissionState());

  // Start the first mission automatically
  startNextMission(missionState);
  game.objective = currentObjective(missionState);
  updateMissionBlips();

  // Spawn initial traffic and peds
  game.traffic = spawnTraffic(world, roadGraph, rng, 26);
  game.peds = [];
  const newPeds = spawnPeds(world, player, rng, game.peds, 48);
  game.peds.push(...newPeds);

  camera.snap(player.x, player.y);
  game.district = world.districtAt(player.x, player.y);
  game.districtBanner = { name: game.district, age: 0, life: 3.8 };
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
  if (data.mission) loadMissionData(missionState, data.mission);
  game.objective = currentObjective(missionState);
  updateMissionBlips();
  camera.snap(player.x, player.y);
  game.notifications.length = 0;
  notify('Welcome back to the harbor');
}

function toTitle() {
  game.screen = 'title';
  game.time = TIME.title;
  game.menuIndex = 0;
  game.deathScreen = null;
  game.dialogue = null;
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
    game.objective = currentObjective(missionState);
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
    if (input.pressed('rain')) {
      game.rain = !game.rain;
      notify(game.rain ? 'Harbor rain: ON' : 'Harbor rain: OFF', 2);
    }
    // Start next mission with C key when between missions
    if (input.pressed('continue') && !missionState.active && !missionState.epilogueDone && missionState.missionJustCompleted) {
      startNextMission(missionState);
      game.objective = currentObjective(missionState);
      updateMissionBlips();
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

function updateMissionBlips() {
  const wp = currentWaypoint(missionState);
  game.mission = wp ? { waypoint: wp } : null;
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
  updatePlayer(player, dt, input, world, game.particles, allVehicles, camera, wantedState, game.elapsed, game.skidmarks);
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
  refillTraffic(game.traffic, world, roadGraph, player, rng, 26);

  // ── Vehicle-to-vehicle collisions (all pairs that matter) ───
  for (let i = 0; i < allVehicles.length; i += 1) {
    for (let j = i + 1; j < allVehicles.length; j += 1) {
      vehicleCollision(allVehicles[i], allVehicles[j]);
    }
  }

  // ── Pedestrians ─────────────────────────────────────────────
  updatePeds(game.peds, dt, world, player, allVehicles, game.particles, rng);
  cullPeds(game.peds, player);
  const newPeds = spawnPeds(world, player, rng, game.peds, 48);
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

  // ── Missions ────────────────────────────────────────────────
  if (missionState.active) {
    const mResult = updateMissions(missionState, dt, player, game.wanted);
    if (mResult.advanced) {
      updateMissionBlips();
    }
    if (mResult.raiseWanted) {
      setWantedLevel(wantedState, mResult.raiseWanted);
      game.wanted = mResult.raiseWanted;
    }
    if (mResult.completed) {
      player.money += mResult.reward;
      playPickup();
    }
    if (mResult.notification) {
      notify(mResult.notification, 5);
    }
    game.objective = currentObjective(missionState);
  } else {
    // Between missions or epilogue
    game.objective = currentObjective(missionState);
    if (missionState.missionJustCompleted && !missionState.epilogueDone) {
      // Show "Press C for next mission" after a short delay
      if (!game.objective.includes('Press C')) {
        game.objective = 'Press C to start the next mission';
      }
    }
  }

  // ── Dialogue ────────────────────────────────────────────────
  game.dialogue = missionState.dialogue;
  game.dialogueTimer = missionState.dialogueTimer;

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
    game.districtBanner = { name: district, age: 0, life: 3.8 };
  }
  if (game.districtBanner) {
    game.districtBanner.age += dt;
    if (game.districtBanner.age >= game.districtBanner.life) game.districtBanner = null;
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
  // Mission waypoint blip
  const wp = currentWaypoint(missionState);
  if (wp) {
    game.blips.push({ x: wp.x, y: wp.y, color: '#ff9e4a' });
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

// ── Deterministic hooks for the screenshot capture ────────────────────
// window.__harbor provides programmatic control so capture.mjs can force
// specific game states and take repeatable screenshots.
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
    game.deathScreen = null;
    policeState.bustedTimer = 0;
    if (name === 'pause') {
      game.screen = 'pause';
      game.menuIndex = 0;
      return true;
    }
    if (name === 'foot') {
      player.inCar = null;
      if (engineRunning) { stopEngine(); engineRunning = false; }
      this.setTime(8 + 10 / 60); // 08:10 morning with long shadows
      this.setWanted(0);
      resetPolice(policeState);
      game.skidmarks.length = 0;
      game.particles.length = 0;
      game.bullets.length = 0;
      game.notifications.length = 0;
      game.dialogue = null;
      game.rain = false;
      this.teleport(1848, 1538);
      player.angle = -Math.PI * 0.14;
      player.moving = true;
      player.walkPhase = 1.1;
      player.health = 100;
      player.armour = 75;
      combat.weapon = 'smg';
      game.district = world.districtAt(player.x, player.y);
      game.districtBanner = { name: 'Palmetto Park', age: 1.1, life: 4.0 };
      game.objective = 'Drive to the docks — meet Marcus';
      game.mission = { waypoint: { x: 4500, y: 1180 } };

      // Set nearby intersection light (1920, 1500) to NS green / EW red so east-west cars queue
      for (const l of roadGraph.lights) {
        if (Math.abs(l.x - 1920) < 30 && Math.abs(l.y - 1500) < 30) {
          l.phase = 0;
          l.timer = 1.0;
        }
      }

      // Clear any previous staged vehicles or parked cars colliding with the staged intersection
      for (let i = parkedCars.length - 1; i >= 0; i -= 1) {
        const pc = parkedCars[i];
        if (pc._staged || (Math.abs(pc.y - 1500) < 34 && pc.x > 1650 && pc.x < 2130)) {
          parkedCars.splice(i, 1);
        }
      }
      // Place clean kerbside parked cars along BOTH curbs on the avenue
      const addCurbCar = (x, y, angle, type, color) => {
        const c = createVehicle(x, y, angle, type);
        c.color = color;
        c._staged = true;
        parkedCars.push(c);
      };
      addCurbCar(1622, 1478, Math.PI, 'sedan', '#3b82b0');
      addCurbCar(1674, 1522, 0, 'suv', '#2d3b4c');
      addCurbCar(2128, 1478, Math.PI, 'van', '#e2e7ec');
      addCurbCar(2168, 1522, 0, 'pickup', '#d8823c');
      addCurbCar(2230, 1478, Math.PI, 'sedan', '#688c5c');

      // Rich busy sidewalk life: walkers, jogger, dog walker, small chatting groups, crossing waiters
      game.peds = spawnPeds(world, player, rng, [], 44);
      const makePed = (id, role, x, y, vx, vy, angle, walkPhase, shirt, hair, skin, extra = {}) => ({
        id, role, x, y, vx, vy, angle, speed: Math.hypot(vx, vy) || 50, walkPhase,
        state: Math.hypot(vx, vy) > 2 ? 'walk' : 'idle', stateTimer: 8,
        targetX: x + vx * 4, targetY: y + vy * 4, health: 40, alive: true,
        shirt, pants: '#2c3442', hair, skin, hat: null, bag: null, dogColor: null, fleeTimer: 0, ...extra,
      });
      game.peds.push(
        // Walkers along north & south Midtown/Palmetto sidewalks
        makePed(9901, 'walker', 1776, 1538, 46, 0, 0, 0.9, '#2ca8ad', '#18181c', '#d69c72', { bag: 'tote' }),
        makePed(9902, 'walker', 1998, 1538, -42, 0, Math.PI, 2.2, '#c76d3b', '#5a3a1a', '#b2764f', { bag: 'backpack' }),
        makePed(9903, 'walker', 2124, 1538, -44, 0, Math.PI, 0.5, '#6d44b8', '#8c6b47', '#e6b892', { hat: '#e08938' }),
        makePed(9904, 'walker', 1742, 1462, 48, 0, 0, 1.8, '#d4aa3d', '#26303b', '#c38458'),
        makePed(9905, 'walker', 2016, 1462, -45, 0, Math.PI, 1.3, '#4f7ec9', '#40261b', '#d69c72', { bag: 'tote' }),
        makePed(9906, 'walker', 1956, 1618, 0, -44, -Math.PI * 0.5, 0.7, '#3da65d', '#18181c', '#8f5a3c', { bag: 'backpack' }),
        makePed(9907, 'walker', 1882, 1648, 0, 44, Math.PI * 0.5, 2.5, '#cc568b', '#b39066', '#e6b892'),
        makePed(9908, 'walker', 1958, 1384, 0, 45, Math.PI * 0.5, 1.2, '#e2d8c5', '#26303b', '#c38458'),
        // Jogger running along Palmetto Park north sidewalk
        makePed(9910, 'jogger', 1708, 1542, 108, 0, 0, 1.1, '#e65a3c', '#26303b', '#d69c72'),
        // Dog walker with trotting golden dog on leash right in the Midtown sunlight
        makePed(9911, 'dog_walker', 2082, 1540, -42, 0, Math.PI, 0.8, '#3d8f7d', '#5a3a1a', '#e6b892', { dogColor: '#c88a4a' }),
        // Pedestrians waiting at the zebra crossing corners
        makePed(9912, 'waiting', 1882, 1535, 0, 0, 0, 0, '#c43e47', '#18181c', '#b2764f', { bag: 'tote' }),
        makePed(9913, 'waiting', 1882, 1549, 0, 0, -0.1, 0, '#3d5873', '#8c6b47', '#e6b892'),
        makePed(9914, 'waiting', 1958, 1463, 0, 0, Math.PI, 0, '#2ca8ad', '#40261b', '#c38458', { hat: '#2c6eb2' }),
        // Small chatting group near park fountain & sidewalk bench
        makePed(9915, 'group', 1756, 1598, 0, 0, 0.4, 0, '#cc568b', '#5a3a1a', '#e6b892'),
        makePed(9916, 'group', 1770, 1604, 0, 0, Math.PI + 0.3, 0, '#d4aa3d', '#18181c', '#8f5a3c'),
        makePed(9917, 'group', 1763, 1615, 0, 0, -Math.PI * 0.45, 0, '#4f7ec9', '#b39066', '#d69c72'),
        // Second small group outside Midtown storefront
        makePed(9918, 'group', 2046, 1446, 0, 0, 0.3, 0, '#3da65d', '#26303b', '#c38458'),
        makePed(9919, 'group', 2060, 1450, 0, 0, Math.PI - 0.2, 0, '#c76d3b', '#8c6b47', '#e6b892'),
      );

      // Varied morning traffic: bus, taxi, van, pickup, truck queuing cleanly at red light
      game.traffic = spawnTraffic(world, roadGraph, rng, 18).filter(
        (c) => Math.hypot(c.x - 1920, c.y - 1500) > 280
      );
      const qTaxi = createVehicle(1844, 1511, 0, 'taxi');
      qTaxi.driver = 'traffic'; qTaxi.brake = 0.9; qTaxi.blinker = 1; qTaxi.color = '#f0c436';
      const qVan = createVehicle(1790, 1511, 0, 'van');
      qVan.driver = 'traffic'; qVan.brake = 0.85; qVan.color = '#e2e7ec';
      const qBus = createVehicle(1724, 1511, 0, 'bus');
      qBus.driver = 'traffic'; qBus.brake = 0.85; qBus.color = '#e4ecef';
      const qPickup = createVehicle(2004, 1489, Math.PI, 'pickup');
      qPickup.driver = 'traffic'; qPickup.brake = 0.9; qPickup.blinker = -1; qPickup.color = '#b84c38';
      const qSedan = createVehicle(2066, 1489, Math.PI, 'sedan');
      qSedan.driver = 'traffic'; qSedan.brake = 0.8; qSedan.color = '#3b82b0';
      const nsTruck = createVehicle(1931, 1384, -Math.PI * 0.5, 'truck');
      nsTruck.driver = 'traffic'; nsTruck.vy = -88; nsTruck.color = '#7a8f62';
      const nsSuv = createVehicle(1909, 1612, Math.PI * 0.5, 'suv');
      nsSuv.driver = 'traffic'; nsSuv.vy = 92; nsSuv.color = '#2b3948';
      game.traffic.push(qTaxi, qVan, qBus, qPickup, qSedan, nsTruck, nsSuv);

      camera.snap(1892, 1516);
      return true;
    }
    if (name === 'car') {
      this.setTime(17 + 20 / 60); // 17:20 golden hour
      this.setWanted(0);
      resetPolice(policeState);
      game.notifications.length = 0;
      game.dialogue = null;
      game.particles.length = 0;
      game.bullets.length = 0;
      game.rain = false;
      this.teleport(2110, 1505);

      // Clear previous staged vehicles or parked cars in the immediate player driving corridor
      for (let i = parkedCars.length - 1; i >= 0; i -= 1) {
        const pc = parkedCars[i];
        if (pc._staged || (Math.abs(pc.y - 1500) < 30 && pc.x > 1950 && pc.x < 2360)) {
          parkedCars.splice(i, 1);
        }
      }
      // Neat kerbside parked cars lining both curbs
      const addBayCar = (x, y, angle, type, color) => {
        const c = createVehicle(x, y, angle, type);
        c.color = color;
        c._staged = true;
        parkedCars.push(c);
      };
      addBayCar(2015, 1478, Math.PI, 'sedan', '#4a82a8');
      addBayCar(2248, 1478, Math.PI, 'suv', '#303f52');
      addBayCar(2052, 1522, 0, 'pickup', '#c46c38');
      addBayCar(2468, 1478, Math.PI, 'van', '#e2e7ec');
      addBayCar(2524, 1522, 0, 'sedan', '#6d8c5c');

      const car = createVehicle(player.x, player.y, -0.07, 'sports');
      car.driver = 'player';
      car.speed = 360;
      car.vx = 358;
      car.vy = -24;
      car.throttle = 1.0;
      car.steer = -0.62;
      car.bodyRoll = 0.78;
      car.driftAngle = 0.45;
      player.inCar = car;
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.vx = car.vx;
      player.vy = car.vy;
      game.district = world.districtAt(player.x, player.y);
      game.districtBanner = null;
      game.objective = 'Drive to the docks — meet Marcus';
      game.mission = { waypoint: { x: 4500, y: 1180 } };

      // Bold sweeping twin-tyre drift skid marks behind the speeding sports car
      game.skidmarks = [];
      for (let k = 0; k < 28; k += 1) {
        const t0 = k / 28;
        const t1 = (k + 1) / 28;
        const x0 = car.x - 16 - t0 * 320;
        const y0 = car.y + 4 + Math.sin(t0 * 2.25) * 24;
        const x1 = car.x - 16 - t1 * 320;
        const y1 = car.y + 4 + Math.sin(t1 * 2.25) * 24;
        const ang = Math.atan2(y1 - y0, x1 - x0);
        const px = -Math.sin(ang) * 6.0;
        const py = Math.cos(ang) * 6.0;
        const fade = (1 - t0 * 0.65) * 0.66;
        game.skidmarks.push({ x1: x0 + px, y1: y0 + py, x2: x1 + px, y2: y1 + py, alpha: fade, w: 3.4 });
        game.skidmarks.push({ x1: x0 - px, y1: y0 - py, x2: x1 - px, y2: y1 - py, alpha: fade, w: 3.4 });
      }
      for (let s = 0; s < 16; s += 1) {
        game.particles.push({ kind: 'smoke', x: car.x - 18 - s * 11, y: car.y + 4 + (s % 2 === 0 ? 6 : -6), vx: -34, vy: (s % 2 === 0 ? 10 : -10), age: s * 0.032, life: 1.35, size: 5.5 + s * 0.9, color: '220,218,214' });
      }

      // Rich golden-hour traffic variety cleanly spaced around the boulevard (zero collisions!)
      game.traffic = spawnTraffic(world, roadGraph, rng, 18).filter(
        (c) => Math.hypot(c.x - car.x, c.y - car.y) > 320
      );
      const tBus = createVehicle(car.x + 292, 1511, 0, 'bus');
      tBus.driver = 'traffic'; tBus.vx = 84; tBus.color = '#e4ecef';
      const tTaxi = createVehicle(car.x + 178, 1488, Math.PI, 'taxi');
      tTaxi.driver = 'traffic'; tTaxi.vx = -96; tTaxi.color = '#f0c436'; tTaxi.blinker = 1;
      const tPickup = createVehicle(car.x + 392, 1488, Math.PI, 'pickup');
      tPickup.driver = 'traffic'; tPickup.vx = -90; tPickup.color = '#b84c38';
      const tVan = createVehicle(car.x - 172, 1488, Math.PI, 'van');
      tVan.driver = 'traffic'; tVan.vx = -85; tVan.color = '#e2e7ec';
      const tTruck = createVehicle(2340 - 11, car.y + 114, Math.PI * 0.5, 'truck');
      tTruck.driver = 'traffic'; tTruck.vy = 82; tTruck.color = '#7a8f62';
      const tSedan = createVehicle(2340 + 11, car.y - 108, -Math.PI * 0.5, 'sedan');
      tSedan.driver = 'traffic'; tSedan.vy = -86; tSedan.color = '#3b82b0'; tSedan.brake = 0.6;
      game.traffic.push(tBus, tTaxi, tPickup, tVan, tTruck, tSedan);

      // Sidewalk pedestrians during golden hour
      game.peds = spawnPeds(world, player, rng, [], 38);
      game.peds.push(
        { id: 9931, role: 'walker', x: car.x - 58, y: 1460, vx: 44, vy: 0, angle: 0, speed: 44, walkPhase: 1.0, state: 'walk', stateTimer: 6, targetX: car.x + 150, targetY: 1460, health: 40, alive: true, shirt: '#2ca8ad', pants: '#252a36', hair: '#18181c', skin: '#d69c72', hat: null, bag: 'tote', dogColor: null, fleeTimer: 0 },
        { id: 9932, role: 'walker', x: car.x + 88, y: 1540, vx: -42, vy: 0, angle: Math.PI, speed: 42, walkPhase: 2.1, state: 'walk', stateTimer: 6, targetX: car.x - 100, targetY: 1540, health: 40, alive: true, shirt: '#c76d3b', pants: '#38465a', hair: '#5a3a1a', skin: '#c38458', hat: null, bag: 'backpack', dogColor: null, fleeTimer: 0 },
        { id: 9933, role: 'dog_walker', x: car.x + 190, y: 1460, vx: 40, vy: 0, angle: 0, speed: 40, walkPhase: 0.6, state: 'walk', stateTimer: 6, targetX: car.x + 360, targetY: 1460, health: 40, alive: true, shirt: '#d4aa3d', pants: '#252a36', hair: '#8c6b47', skin: '#e6b892', hat: null, bag: null, dogColor: '#a66b3c', fleeTimer: 0 },
      );

      camera.snap(car.x + 42, 1500);
      return true;
    }
    if (name === 'chase') {
      this.state('car');
      this.setTime(19 + 40 / 60); // 19:40 dramatic coastal dusk
      setWantedLevel(wantedState, 3);
      game.wanted = 3;
      forcePoliceChase(policeState, world, player, roadGraph, rng, 3);
      if (policeState.units[0]) {
        const c = policeState.units[0].car;
        c.x = player.x - 108; c.y = 1511; c.angle = -0.05; c.vx = 305; c.vy = -12; c.steer = -0.35; c.bodyRoll = 0.42;
      }
      if (policeState.units[1]) {
        const c = policeState.units[1].car;
        c.x = player.x - 210; c.y = 1488; c.angle = 0.08; c.vx = 310; c.vy = 16; c.steer = 0.3; c.bodyRoll = -0.36;
      }
      if (policeState.units[2]) {
        const c = policeState.units[2].car;
        c.x = 2340 - 11; c.y = 1390; c.angle = Math.PI * 0.56; c.vx = -16; c.vy = 175; c.steer = 0.45; c.bodyRoll = -0.4;
      }
      // Keep the police chase lane unobstructed
      game.traffic = game.traffic.filter((c) => Math.hypot(c.x - (player.x - 160), c.y - 1500) > 95);
      game.objective = 'Drive to the docks — meet Marcus';
      game.mission = { waypoint: { x: 4500, y: 1180 } };
      game.district = world.districtAt(player.x, player.y);
      game.districtBanner = null;
      game.notifications.length = 0;

      // Extra fleeing & sidewalk pedestrians for vivid dusk chaos
      game.peds.push(
        { id: 9991, role: 'walker', x: player.x + 56, y: 1456, vx: 65, vy: -24, angle: -0.36, speed: 72, walkPhase: 0.4, state: 'flee', stateTimer: 5, targetX: 0, targetY: 0, health: 40, alive: true, shirt: '#c43e47', pants: '#252a36', hair: '#18181c', skin: '#d69c72', hat: null, bag: null, dogColor: null, fleeTimer: 5 },
        { id: 9992, role: 'walker', x: player.x + 118, y: 1544, vx: 62, vy: 26, angle: 0.38, speed: 75, walkPhase: 1.6, state: 'flee', stateTimer: 5, targetX: 0, targetY: 0, health: 40, alive: true, shirt: '#2ca8ad', pants: '#38465a', hair: '#5a3a1a', skin: '#c38458', hat: null, bag: 'backpack', dogColor: null, fleeTimer: 5 },
        { id: 9993, role: 'walker', x: player.x - 95, y: 1545, vx: -58, vy: 22, angle: 2.75, speed: 70, walkPhase: 2.3, state: 'flee', stateTimer: 5, targetX: 0, targetY: 0, health: 40, alive: true, shirt: '#d4aa3d', pants: '#252a36', hair: '#8c6b47', skin: '#e6b892', hat: null, bag: null, dogColor: null, fleeTimer: 5 },
        { id: 9994, role: 'walker', x: player.x - 175, y: 1456, vx: -55, vy: -20, angle: -2.8, speed: 68, walkPhase: 0.9, state: 'flee', stateTimer: 5, targetX: 0, targetY: 0, health: 40, alive: true, shirt: '#cc568b', pants: '#22262e', hair: '#40261b', skin: '#b2764f', hat: null, bag: 'tote', dogColor: null, fleeTimer: 5 },
      );
      game.bullets.push({ x: player.x - 56, y: player.y + 4, vx: 650, vy: -22, age: 0.04, life: 0.6, hit: false });
      game.particles.push({ kind: 'spark', x: player.x - 18, y: player.y + 6, vx: -80, vy: 45, age: 0, life: 0.45, size: 2.5, color: '255,220,120' });
      game.particles.push({ kind: 'spark', x: player.x - 16, y: player.y - 5, vx: -70, vy: -50, age: 0, life: 0.45, size: 2.5, color: '255,220,120' });

      // Refresh blips immediately so minimap shows all 3 police cruisers + waypoint on frame 1
      game.blips.length = 0;
      for (const u of policeState.units) {
        game.blips.push({ x: u.car.x, y: u.car.y, color: '#5080e0' });
      }
      game.blips.push({ x: 4500, y: 1180, color: '#ff9e4a' });

      camera.snap(player.x + 25, 1500);
      return true;
    }
    if (name === 'wanted') {
      setWantedLevel(wantedState, 3);
      game.wanted = 3;
      forcePoliceChase(policeState, world, player, roadGraph, rng, 2);
      return true;
    }
    if (name === 'mission') {
      player.inCar = null;
      if (engineRunning) { stopEngine(); engineRunning = false; }
      this.setWanted(0);
      resetPolice(policeState);
      game.skidmarks.length = 0;
      game.particles.length = 0;
      game.bullets.length = 0;
      game.notifications.length = 0;
      game.rain = false;
      startMissionByIndex(missionState, 0);
      missionState.stepIndex = 1; // "Collect the package from the warehouse"
      game.objective = currentObjective(missionState);
      this.setTime(21.0); // 21:00 deep coastal night with vibrant neon & mild bloom
      this.teleport(4498, 1256); // Squarely inside Dockside district (> 4484)
      player.angle = Math.PI * 0.42;
      player.moving = false;
      player.health = 100;
      player.armour = 60;
      combat.weapon = 'pistol';
      for (let i = parkedCars.length - 1; i >= 0; i -= 1) {
        if (parkedCars[i]._staged) parkedCars.splice(i, 1);
      }
      const dockCar = createVehicle(4386, 1184, 0.14, 'sports');
      dockCar.color = '#d93d32';
      dockCar.headlights = true;
      dockCar._headlightsOn = true;
      dockCar._staged = true;
      parkedCars.push(dockCar);
      const dockVan = createVehicle(4440, 1086, Math.PI * 0.5, 'van');
      dockVan.driver = 'traffic';
      dockVan.vy = 62;
      dockVan.color = '#dce4ec';
      game.traffic = [dockVan];
      game.peds = [
        { id: 9971, role: 'walker', x: 4416, y: 1296, vx: 0, vy: 34, angle: Math.PI * 0.5, speed: 34, walkPhase: 1.2, state: 'walk', stateTimer: 6, targetX: 4416, targetY: 1420, health: 40, alive: true, shirt: '#d4aa3d', pants: '#252a36', hair: '#18181c', skin: '#c38458', hat: '#2c6eb2', bag: null, dogColor: null, fleeTimer: 0 },
      ];
      game.mission = { waypoint: { x: 4520, y: 1340 } };
      game.dialogue = 'Marcus: "Grab the crate from the back. Don\'t let anyone see you."';
      game.dialogueTimer = 1.2;
      missionState.dialogue = game.dialogue;
      missionState.dialogueTimer = 1.2;
      game.district = world.districtAt(player.x, player.y);
      game.districtBanner = null;
      updateMissionBlips();
      camera.snap(4420, 1236);
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
    if (player.inCar) {
      player.inCar.x = player.x;
      player.inCar.y = player.y;
    }
    camera.snap(player.x, player.y);
  },
  setRain(on) {
    game.rain = Boolean(on);
    return game.rain;
  },
  spawnTraffic(n) {
    const extra = spawnTraffic(world, roadGraph, rng, n || 8);
    game.traffic.push(...extra);
    return true;
  },
  startMission(i) {
    const idx = typeof i === 'number' ? i : 0;
    startMissionByIndex(missionState, idx);
    game.objective = currentObjective(missionState);
    updateMissionBlips();
    return true;
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
