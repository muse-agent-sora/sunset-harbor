// Sunset Harbor — the world: one state object and the step that moves it.
// Everything the game simulates lives here: the player on foot and in a car,
// traffic, pedestrians, police, bullets, particles, pickups, missions and the
// wanted level. Rendering and screens read this state; they never change it.
import { CAR_TYPES, PLAYER, ROAD_W, ROAD_X, ROAD_Y, SAVE_KEY, START_CASH, STEP, WANTED, WORLD_H, WORLD_W } from './config.js';
import { createRandom } from './random.js';
import { buildCity, clampToWorld, collideBuildings, isRoadAt } from './city.js';
import { collideCars, drivePlayerCar, makeCar, nearestCar, spawnTrafficCar, updateTrafficCar } from './vehicles.js';
import { hurtPerson, makePed, makeThug, scarePeds, updatePed, updateThug } from './people.js';
import { addWanted, maintainPolice, prunePolice, updateCop, updatePoliceCar, updateWanted } from './police.js';
import { fireBullet, punch, updateBullets } from './combat.js';
import { createMissionRuntime, spawnCashDrop, startMission, updateCourier, updateMission } from './missions.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;

const TRAFFIC_COUNT = 26;
const PARKED_COUNT = 6;
const PED_COUNT = 40;

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const state = {
    rng,
    city,
    cityWidth: WORLD_W,
    cityHeight: WORLD_H,
    seed,
    time: 0,
    dayTime: 0.32, // golden hour: 0 is dawn, 0.5 is dusk
    player: null,
    playerCar: null,
    cars: [],
    peds: [],
    cops: [],
    policeCars: [],
    bullets: [],
    particles: [],
    skids: [],
    pickups: [],
    crates: [],
    cash: START_CASH,
    earned: 0,
    wanted: 0,
    lastCrimeTime: -100,
    hiddenTime: 0,
    flashWanted: 0,
    mission: createMissionRuntime(),
    courier: { active: false, index: 0, timeLeft: 0, collected: 0 },
    camera: { x: 0, y: 0 },
    shake: 0,
    hurtFlash: 0,
    muzzleFlash: 0,
    lastShotX: 0,
    lastShotY: 0,
    bannerText: '',
    bannerTimer: 0,
    bannerColor: '#e8b73a',
    missionCompleteTimer: 0,
    missionFailedTimer: 0,
    lastCompletedMission: '',
    missionsDone: 0,
    bestScore: 0,
    busted: false,
    wasted: false,
    bustReason: '',
    cashTimer: 0,
    shotHeatTimer: 0,
    audio: null,
  };

  // --- helpers the other modules call back through -------------------------
  state.banner = function (text, color) {
    state.bannerText = text;
    state.bannerTimer = 3.2;
    state.bannerColor = color || '#e8b73a';
  };
  state.setWanted = function (stars, reason) {
    addWanted(state, stars, reason);
  };
  state.spawnThug = function (x, y, armed) {
    state.peds.push(makeThug(state.rng, x, y, armed));
  };
  state.spawnCrates = function (x, y, count) {
    for (let i = 0; i < count; i += 1) {
      state.crates.push({ x: x + state.rng.range(-90, 90), y: y + state.rng.range(-90, 90), taken: false });
    }
  };
  state.spawnSparks = function (x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const a = state.rng.range(0, Math.PI * 2);
      state.particles.push({ x, y, vx: Math.cos(a) * state.rng.range(60, 240), vy: Math.sin(a) * state.rng.range(60, 240), life: 0.35, maxLife: 0.35, color: '#ffd76a', size: 2.5, kind: 'spark' });
    }
  };
  state.spawnSmoke = function (x, y, n) {
    for (let i = 0; i < n; i += 1) {
      state.particles.push({ x: x + state.rng.range(-8, 8), y: y + state.rng.range(-8, 8), vx: state.rng.range(-12, 12), vy: state.rng.range(-40, -12), life: state.rng.range(0.8, 1.6), maxLife: 1.6, color: '#5a5a5a', size: state.rng.range(5, 9), kind: 'smoke' });
    }
  };
  state.spawnBlood = function (x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const a = state.rng.range(0, Math.PI * 2);
      state.particles.push({ x, y, vx: Math.cos(a) * state.rng.range(30, 160), vy: Math.sin(a) * state.rng.range(30, 160), life: 0.5, maxLife: 0.5, color: '#a02020', size: 3, kind: 'blood' });
    }
  };
  state.spawnMuzzle = function (x, y, angle) {
    state.particles.push({ x: x + Math.cos(angle) * 18, y: y + Math.sin(angle) * 18, vx: Math.cos(angle) * 40, vy: Math.sin(angle) * 40, life: 0.07, maxLife: 0.07, color: '#ffe9a0', size: 7, kind: 'muzzle' });
  };
  state.addSkid = function (x, y, angle) {
    state.skids.push({ x, y, angle, life: 6 });
    if (state.skids.length > 220) state.skids.shift();
  };
  state.enemyShoot = function (x, y, angle) {
    fireBullet(state, x, y, angle, 'enemy', 20);
    if (state.audio) state.audio.shot();
    scarePeds(state, x, y, 320);
  };
  state.onThugDown = function () {
    state.mission.kills += 1;
  };
  state.damagePlayer = function (amount, fromX, fromY) {
    const p = state.player;
    if (p.dead || p.invuln > 0) return;
    p.health -= amount;
    p.invuln = 0.35;
    state.hurtFlash = 0.35;
    state.shake = Math.min(12, state.shake + 4);
    if (state.audio) state.audio.hit();
    if (p.health <= 0) {
      p.health = 0;
      p.dead = true;
      state.wasted = true;
      state.bustReason = 'wasted';
      if (state.audio) state.audio.busted();
    }
  };
  state.bustPlayer = function () {
    if (state.player.dead) return;
    state.player.dead = true;
    state.busted = true;
    state.bustReason = 'busted';
    if (state.audio) state.audio.busted();
  };
  state.ejectPlayer = function () {
    const car = state.playerCar;
    if (!car) return;
    state.playerCar = null;
    car.occupied = false;
    car.speed = 0;
    state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    state.player.aimAngle = car.angle;
  };
  state.save = function () {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.cash,
        earned: state.earned,
        missionsDone: state.missionsDone,
        bestScore: Math.max(state.bestScore, state.score()),
      }));
    } catch { /* storage off: progress lasts this visit only */ }
  };
  state.score = function () {
    return state.earned + state.missionsDone * 100;
  };

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function resetPlayer(x, y) {
    state.player = {
      x, y,
      angle: 0,
      aimAngle: 0,
      health: PLAYER.maxHealth,
      dead: false,
      ammo: PLAYER.pistolAmmo,
      reserve: PLAYER.pistolReserve,
      punchCooldown: 0,
      punchAnim: 0,
      shootCooldown: 0,
      invuln: 0,
      moving: false,
    };
  }

  function reset() {
    state.time = 0;
    state.dayTime = 0.32;
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.policeCars = [];
    state.bullets = [];
    state.particles = [];
    state.skids = [];
    state.pickups = [];
    state.crates = [];
    state.cash = START_CASH;
    state.earned = 0;
    state.wanted = 0;
    state.lastCrimeTime = -100;
    state.hiddenTime = 0;
    state.flashWanted = 0;
    state.mission = createMissionRuntime();
    state.courier = { active: false, index: 0, timeLeft: 0, collected: 0 };
    state.shake = 0;
    state.hurtFlash = 0;
    state.muzzleFlash = 0;
    state.bannerText = '';
    state.bannerTimer = 0;
    state.missionCompleteTimer = 0;
    state.missionFailedTimer = 0;
    state.lastCompletedMission = '';
    state.busted = false;
    state.wasted = false;
    state.bustReason = '';
    state.playerCar = null;
    state.cashTimer = 0;

    resetPlayer(1080, 880);
    // Traffic on the roads, parked cars at the kerb.
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) state.cars.push(spawnTrafficCar(rng));
    for (let i = 0; i < PARKED_COUNT; i += 1) {
      const roadX = rng.pick(ROAD_X);
      const roadY = rng.pick(ROAD_Y);
      const vertical = rng.chance(0.5);
      const car = makeCar(rng.pick(['sedan', 'sports', 'taxi', 'van']), vertical ? roadX + ROAD_W / 4 : rng.range(200, 3000), vertical ? rng.range(200, 2100) : roadY + ROAD_W / 4, vertical ? Math.PI / 2 : 0, 'none');
      car.occupied = false;
      car.speed = 0;
      state.cars.push(car);
    }
    // A sports car near the garage for mission one.
    const gt = makeCar('sports', 700, 600, 0, 'none');
    gt.occupied = false;
    state.cars.push(gt);
    // Pedestrians on the sidewalks.
    for (let i = 0; i < PED_COUNT; i += 1) {
      const ped = makePed(rng, rng.range(140, 3120), rng.range(140, 2220));
      ped.targetX = ped.x;
      ped.targetY = ped.y;
      state.peds.push(ped);
    }
    // Cash drops scattered around the city.
    for (let i = 0; i < 8; i += 1) {
      spawnCashDrop(state, rng.range(200, 3100), rng.range(200, 2200), rng.pick([25, 25, 40, 60]));
    }
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }

  // --- player actions ------------------------------------------------------
  function tryEnterCar() {
    const p = state.player;
    if (p.dead) return;
    if (state.playerCar) {
      // Get out beside the car.
      const car = state.playerCar;
      state.playerCar = null;
      car.occupied = false;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 32;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 32;
      p.aimAngle = car.angle;
      car.speed *= 0.2;
      return;
    }
    const car = nearestCar(state.cars, p.x, p.y, 58);
    if (!car) return;
    if (car.type === 'police') {
      addWanted(state, 2, 'Stealing a police car');
    } else if (car.occupied) {
      // Steal it: the driver bails and runs.
      car.occupied = false;
      const driver = makePed(rng, car.x, car.y);
      driver.fleeTime = 4;
      state.peds.push(driver);
      addWanted(state, WANTED.steal, 'Grand theft auto');
      if (state.audio) state.audio.wantedUp();
    }
    // A car the player takes is tougher than a random traffic car: it has
    // to survive a getaway, not just a commute.
    state.playerCar = car;
    car.driver = 'player';
    car.occupied = true;
    car.maxHealth = Math.max(car.maxHealth || 100, 160);
    car.health = Math.max(car.health, 120);
    if (state.audio) state.audio.uiClick();
  }

  function tryShoot() {
    const p = state.player;
    if (p.dead || p.shootCooldown > 0) return;
    if (p.ammo <= 0) {
      if (p.reserve > 0) reload();
      return;
    }
    p.shootCooldown = 0.18;
    p.ammo -= 1;
    const ox = state.playerCar ? state.playerCar.x : p.x;
    const oy = state.playerCar ? state.playerCar.y : p.y;
    fireBullet(state, ox, oy, p.aimAngle, 'player', PLAYER.pistolDamage);
    if (state.audio) state.audio.shot();
    scarePeds(state, ox, oy, 420);
    if (state.shotHeatTimer <= 0) {
      addWanted(state, 1, 'Gunfire in the streets');
      state.shotHeatTimer = 4;
    }
    state.shake = Math.min(6, state.shake + 1.5);
  }

  function reload() {
    const p = state.player;
    if (p.reserve <= 0 || p.ammo >= PLAYER.pistolAmmo) return;
    const need = PLAYER.pistolAmmo - p.ammo;
    const take = Math.min(need, p.reserve);
    p.ammo += take;
    p.reserve -= take;
    if (state.audio) state.audio.uiClick();
  }

  function movePlayerOnFoot(dt, input, aimAngle) {
    const p = state.player;
    const axis = input.moveAxis();
    const len = Math.hypot(axis.x, axis.y) || 1;
    const speed = input.sprint() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    p.moving = axis.x !== 0 || axis.y !== 0;
    p.x += (axis.x / len) * speed * dt * (p.moving ? 1 : 0);
    p.y += (axis.y / len) * speed * dt * (p.moving ? 1 : 0);
    p.aimAngle = aimAngle;
    if (p.moving) p.angle = Math.atan2(axis.y, axis.x);
    collideBuildings(city, p, PLAYER.radius);
    clampToWorld(p, PLAYER.radius);
  }

  // --- the step ------------------------------------------------------------
  function step(dt, input, aimAngle, harmless) {
    let events = 0;
    state.time += dt;
    state.dayTime = 0.32 + 0.06 * Math.sin(state.time * 0.004);
    if (state.flashWanted > 0) state.flashWanted -= dt;
    if (state.hurtFlash > 0) state.hurtFlash -= dt;
    if (state.muzzleFlash > 0) state.muzzleFlash -= dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.missionCompleteTimer > 0) state.missionCompleteTimer -= dt;
    if (state.missionFailedTimer > 0) state.missionFailedTimer -= dt;
    if (state.shotHeatTimer > 0) state.shotHeatTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 30 * dt);
    const p = state.player;
    if (p.punchCooldown > 0) p.punchCooldown -= dt;
    if (p.punchAnim > 0) p.punchAnim -= dt;
    if (p.shootCooldown > 0) p.shootCooldown -= dt;
    if (p.invuln > 0) p.invuln -= dt;

    // Traffic and pedestrians always move, even on the title screen.
    // Only cars with a traffic driver move on their own: parked cars stay
    // parked until the player (or a thief) takes them.
    for (const car of state.cars) {
      if (car === state.playerCar) continue;
      if (car.driver !== 'traffic') continue;
      updateTrafficCar(car, city, state.cars, dt, state.time, state.playerCar ? null : state.player);
    }
    for (const ped of state.peds) {
      if (ped.kind === 'thug') updateThug(ped, rng, city, state, dt);
      else updatePed(ped, rng, city, state, dt);
    }
    state.peds = state.peds.filter((ped) => ped.alive || ped.kind === 'thug');

    if (harmless) {
      // Title-screen backdrop: the city lives, nothing can hurt the player.
      updateCamera(dt);
      return events;
    }

    // --- player ---
    if (!p.dead) {
      if (state.playerCar) {
        const car = state.playerCar;
        drivePlayerCar(car, input, dt, state);
        p.x = car.x;
        p.y = car.y;
        p.aimAngle = aimAngle;
        if (input.shooting()) tryShoot();
        // Speeding past a cop is a crime.
        if (Math.abs(car.speed) > 430) {
          for (const cop of state.cops) {
            if (cop.alive && Math.hypot(cop.x - car.x, cop.y - car.y) < 180 && state.shotHeatTimer <= 0) {
              addWanted(state, 1, 'Speeding past an officer');
              state.shotHeatTimer = 5;
            }
          }
        }
      } else {
        movePlayerOnFoot(dt, input, aimAngle);
        if (input.shooting()) tryShoot();
      }
      // Edge actions (enter car, punch, reload) are handled by the caller,
      // which reads the input queue once per frame.
    }

    // --- car vs car collisions ---
    const allCars = state.cars.concat(state.policeCars);
    for (let i = 0; i < allCars.length; i += 1) {
      for (let j = i + 1; j < allCars.length; j += 1) {
        collideCars(allCars[i], allCars[j], state);
      }
    }

    // --- player car running over pedestrians (a crime) ---
    if (state.playerCar && !p.dead) {
      const car = state.playerCar;
      for (const ped of state.peds) {
        if (!ped.alive || ped.kind === 'cop') continue;
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 24 && Math.abs(car.speed) > 60) {
          hurtPerson(ped, 200, state);
          addWanted(state, 1, 'Running over a pedestrian');
          state.shake = Math.min(12, state.shake + 5);
          if (state.audio) state.audio.crash();
        }
      }
    }
    // --- traffic hitting the player on foot ---
    if (!state.playerCar && !p.dead) {
      for (const car of state.cars) {
        if (car === state.playerCar || car.wrecked) continue;
        if (Math.hypot(car.x - p.x, car.y - p.y) < 24 && Math.abs(car.speed) > 60) {
          state.damagePlayer(16, car.x, car.y);
          p.x += (p.x - car.x) * 0.6;
          p.y += (p.y - car.y) * 0.6;
        }
      }
    }

    // --- police ---
    if (!harmless) {
      updateWanted(state, dt);
      maintainPolice(state, rng);
      for (const cop of state.cops) updateCop(cop, state, dt);
      for (const car of state.policeCars) updatePoliceCar(car, state, dt);
      prunePolice(state);
    }

    // --- combat, missions, pickups ---
    updateBullets(state, dt);
    updateMission(state, dt);
    updateCourier(state, dt);

    // Cash drops and crates.
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const px = state.playerCar ? state.playerCar.x : p.x;
      const py = state.playerCar ? state.playerCar.y : p.y;
      if (Math.hypot(pickup.x - px, pickup.y - py) < 34) {
        pickup.taken = true;
        state.cash += pickup.amount;
        state.earned += pickup.amount;
        if (state.audio) state.audio.cash();
        if (state.banner) state.banner(`+$${pickup.amount} found cash`, '#7fbf5a');
      }
    }
    state.pickups = state.pickups.filter((pk) => !pk.taken);
    state.cashTimer -= dt;
    if (state.cashTimer <= 0) {
      state.cashTimer = 14;
      spawnCashDrop(state, rng.range(200, 3100), rng.range(200, 2200), rng.pick([25, 25, 40]));
    }
    for (const crate of state.crates) {
      if (crate.taken) continue;
      const px = state.playerCar ? state.playerCar.x : p.x;
      const py = state.playerCar ? state.playerCar.y : p.y;
      if (Math.hypot(crate.x - px, crate.y - py) < 40) {
        crate.taken = true;
        state.mission.crates += 1;
        if (state.audio) state.audio.pickup();
      }
    }
    state.crates = state.crates.filter((c) => !c.taken);

    // Ammo pickups are part of cash drops on the street: walking over a
    // dropped magazine tops the reserve up.
    // (Handled by the same pickup loop above via kind checks in future.)

    // --- particles ---
    for (const part of state.particles) {
      part.life -= dt;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.vx *= 0.94;
      part.vy *= 0.94;
    }
    state.particles = state.particles.filter((part) => part.life > 0);
    for (const skid of state.skids) skid.life -= dt;
    state.skids = state.skids.filter((s) => s.life > 0);

    // --- audio follows the world ---
    if (state.audio) {
      const driving = !!state.playerCar;
      const ratio = driving ? Math.abs(state.playerCar.speed) / state.playerCar.spec.topSpeed : 0;
      state.audio.setEngine(ratio, driving);
      const sirenNear = state.policeCars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 700) || state.wanted >= 2;
      state.audio.setSiren(sirenNear && !p.dead, dt);
    }

    updateCamera(dt);
    if (state.busted) events |= EVENT_BUSTED;
    if (state.wasted) events |= EVENT_WASTED;
    return events;
  }

  function updateCamera(dt) {
    const p = state.player;
    const tx = state.playerCar ? state.playerCar.x : p.x;
    const ty = state.playerCar ? state.playerCar.y : p.y;
    const k = Math.min(1, 5 * dt);
    state.camera.x += (tx - state.camera.x) * k;
    state.camera.y += (ty - state.camera.y) * k;
  }

  function startNewGame(save) {
    reset();
    if (save) {
      state.cash = save.cash ?? START_CASH;
      state.earned = save.earned ?? 0;
      state.missionsDone = save.missionsDone ?? 0;
      state.bestScore = save.bestScore ?? 0;
    }
  }

  function continueGame(save) {
    startNewGame(save);
    if (save && save.missionsDone > 0 && save.missionsDone < 5) {
      startMission(state, save.missionsDone);
    }
  }

  reset();
  return {
    state,
    reset,
    step,
    startNewGame,
    continueGame,
    loadSave,
    tryEnterCar,
    tryShoot,
    reload,
    startMission: (index) => startMission(state, index),
    isRoadAt: (x, y) => isRoadAt(x, y),
    CAR_TYPES,
    STEP,
  };
}
