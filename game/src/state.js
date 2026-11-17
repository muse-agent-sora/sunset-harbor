// Sunset Harbor — game state construction. Kept apart from the loop so the
// screenshot stager can build a fresh game without importing the loop itself.
import { VIEW, PLAYER, SAVE_KEY } from './config.js';
import { makeRng } from './rng.js';
import { buildCity } from './city.js';
import { spawnCars, spawnPeds, spawnCashDrops } from './entities.js';

/** Read the saved game, if any. */
export function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') || null;
  } catch {
    return null;
  }
}

/** A fresh game state for a seed. */
export function createGame(seed) {
  const rng = makeRng(seed);
  const save = loadSave();
  const city = buildCity(seed);
  const state = {
    seed,
    rng,
    city,
    time: 0,
    mode: 'title',
    save,
    bestScore: (save && save.bestScore) || 0,
    player: {
      x: city.spawn.player.x,
      y: city.spawn.player.y,
      angle: 0,
      aimAngle: 0,
      vx: 0, vy: 0,
      health: PLAYER.maxHealth,
      cash: (save && save.cash) || 0,
      ammo: PLAYER.magazine,
      reserveAmmo: 96,
      reloadTimer: 0,
      punchCooldown: 0,
      shootCooldown: 0,
      carId: null,
      moving: false,
      stepTimer: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    thugs: [],
    bullets: [],
    particles: [],
    skids: [],
    pickups: [],
    wanted: 0,
    wantedFlash: 0,
    lastCrime: '',
    hideTimer: 0,
    mission: {
      active: false, index: -1, stage: 0, stageTimer: 0,
      chaseTimer: 0, waitProgress: 0, takedownLeft: 0,
      intro: '', introTimer: 0, targetCar: null,
    },
    missionsDone: (save && save.missionsDone) || 0,
    nextMissionTimer: 0,
    score: 0,
    camera: { x: 0, y: 0 },
    shake: 0,
    hurtFlash: 0,
    sideJob: { active: false, index: 0, timer: 0, rings: [] },
    message: '',
    messageTimer: 0,
    splash: null,
    endReason: '',
    stats: { shotsFired: 0, carsStolen: 0 },
    mouseDownNow: false,
    saveTimer: 0,
  };
  spawnCars(state);
  spawnPeds(state);
  spawnCashDrops(state);
  state.camera.x = state.player.x - VIEW.width / 2;
  state.camera.y = state.player.y - VIEW.height / 2;
  return state;
}
