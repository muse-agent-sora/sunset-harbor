// Sunset Harbor — the game loop and the state machine. Builds a fresh game from
// a seed, runs the title / play / pause / end screens, wires the modules
// together, saves progress to localStorage, and stages the ?shot= scenes the
// screenshots are taken from.
import { WORLD, VIEW, SAVE_KEY, SHOT_SEED_DEFAULT } from './config.js';
import { makeRng } from './rng.js';
import { buildCity } from './city.js';
import { input, attachInput } from './input.js';
import { unlockAudio, setMuted, isMuted, engineSound } from './audio.js';
import { createGame, loadSave } from './state.js';
import {
  spawnCars, spawnPeds, spawnCashDrops, updatePlayer, updateTraffic,
  updatePeds, updatePolice, updateThugs, updateBullets, updateParticles,
  updateWorldClock, resolveCarCollisions, playerCar, saveBest,
} from './entities.js';
import { startMission, updateMission, offerNextMission, updateSideJob, MISSIONS } from './missions.js';
import { draw, updateCamera } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
attachInput(canvas);

/** Read the saved game, if any. (Re-exported for the playtest hooks.) */
export { loadSave };

let state = createGame(SHOT_SEED_DEFAULT);

/** Start a new run from the title screen. `continueSave` resumes progress. */
function startRun(continueSave) {
  const seed = Math.floor(Math.random() * 100000) + 1;
  const keep = {
    cash: continueSave && state.save ? state.save.cash || 0 : 0,
    missionsDone: continueSave && state.save ? state.save.missionsDone || 0 : 0,
    bestScore: state.bestScore,
  };
  state = createGame(seed);
  state.player.cash = keep.cash;
  state.missionsDone = keep.missionsDone;
  state.bestScore = keep.bestScore;
  state.mode = 'play';
  state.nextMissionTimer = 2.5;
  state.message = keep.missionsDone > 0
    ? `Welcome back, Rook — ${keep.missionsDone} job(s) done. Marla has more work.`
    : 'Welcome to Sunset Harbor. Find a car — Marla will call.';
  state.messageTimer = 4;
  unlockAudio();
}

/** The ambient world keeps moving behind the title screen. */
function updateAmbient(dt) {
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updateParticles(state, dt);
  updateWorldClock(state, dt);
  // Slow cinematic pan across Downtown on the title screen.
  if (state.mode === 'title') {
    state.camera.x += 12 * dt;
    if (state.camera.x > WORLD.width - VIEW.width) state.camera.x = 0;
    state.camera.y = 900 - VIEW.height / 2;
  } else {
    updateCamera(state, dt);
  }
}

function updatePlay(dt) {
  updatePlayer(state, dt);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateThugs(state, dt);
  updateBullets(state, dt);
  updateParticles(state, dt);
  updateWorldClock(state, dt);
  resolveCarCollisions(state);
  updateMission(state, dt);
  offerNextMission(state, dt);
  updateSideJob(state, dt);
  updateCamera(state, dt);
  state.mission.introTimer = Math.max(0, state.mission.introTimer - dt);
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  state.hurtFlash = Math.max(0, state.hurtFlash - dt);
  if (state.splash) {
    state.splash.timer -= dt;
    if (state.splash.timer <= 0) state.splash = null;
  }
  if (!playerCar(state)) engineSound(0, false);
  // Autosave progress quietly as the player earns it.
  state.saveTimer = (state.saveTimer || 0) + dt;
  if (state.saveTimer > 10) {
    state.saveTimer = 0;
    saveBest(state);
  }
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  state.time += dt;
  state.mouseDownNow = input.mouseDown;

  // Global keys.
  if (input.wasPressed('KeyM')) {
    setMuted(!isMuted());
    state.message = isMuted() ? 'Sound muted (M to unmute)' : 'Sound on';
    state.messageTimer = 1.5;
  }
  unlockAudio();

  if (state.mode === 'title') {
    if (input.wasPressed('Enter') || input.clicked) startRun(false);
    else if (input.wasPressed('KeyC') && state.save && state.save.missionsDone > 0) startRun(true);
    updateAmbient(dt);
  } else if (state.mode === 'play') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      state.mode = 'pause';
    } else {
      updatePlay(dt);
    }
  } else if (state.mode === 'pause') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) state.mode = 'play';
    else if (input.wasPressed('KeyR')) startRun(false);
  } else if (state.mode === 'busted' || state.mode === 'wasted' || state.mode === 'gameover') {
    if (input.wasPressed('Enter') || input.clicked) startRun(false);
    updateAmbient(dt);
  }

  draw(ctx, state);
  input.endFrame();
  requestAnimationFrame(frame);
}

// Boot: stage a screenshot scene when ?shot= is present, else the title screen.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  const seed = Number(params.get('seed') || SHOT_SEED_DEFAULT);
  state = stageShot(shot, seed);
  updateCamera(state, 0.001);
  draw(ctx, state);
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}

// Expose the live state for the in-browser playtest hooks and debugging.
window.__sunsetHarbor = {
  get state() { return state; },
  startRun,
  createGame,
};
