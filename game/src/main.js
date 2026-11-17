// Sunset Harbor — boot and the one loop: input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. Screens: title, play, paused, busted, wasted.
//
// ?seed=N fixes the city. ?shot=start|play|mission|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_RELOAD, ACTION_SIDE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';
import { nearestCar } from './vehicles.js';
import { CHECKPOINTS, currentMarker, startCourierRun, startMission } from './missions.js';
import { punch } from './combat.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const state = world.state;
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const audio = createAudio();
state.audio = audio;
// A read-only handle for playtesting and debugging (the game itself never
// needs it): lets a test drive check positions, wanted level and missions.
window.__sunsetHarbor = state;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  state.missionMarker = name === 'play' ? { x: 3060, y: 560 } : currentMarker(state);
  let painted = 0;
  function paint() {
    renderer.drawWorld(state);
    if (scene.screen === SCREEN_TITLE) hud.drawTitle(state, null);
    else if (scene.screen === SCREEN_BUSTED) {
      hud.drawCenterPanel('BUSTED', [
        { text: 'The Sunset Harbor police caught up with you.', size: 18 },
        { text: `Score ${scene.best}  ·  Cash $${state.cash}  ·  Jobs done ${state.missionsDone}/5`, size: 17 },
      ], 'Press Enter to play again', '#e5534b');
    } else {
      hud.drawHud(state, renderer.view);
    }
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let best = save ? save.bestScore || 0 : 0;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startFresh() {
    world.startNewGame(null);
    screen = SCREEN_PLAY;
    audio.resume();
    announce('Playing Sunset Harbor. First job: get to the garage in Old Town.');
  }

  function continueStory() {
    world.continueGame(save);
    screen = SCREEN_PLAY;
    audio.resume();
    announce('Continuing your story in Sunset Harbor.');
  }

  function endRun(reason) {
    screen = reason === 'busted' ? SCREEN_BUSTED : SCREEN_WASTED;
    const score = state.score();
    if (score > best) {
      best = score;
      state.bestScore = best;
    }
    state.save();
    announce(reason === 'busted' ? `Busted. Score ${score}.` : `Wasted. Score ${score}.`);
  }

  function advanceDialogue() {
    const dlg = state.mission.dialogue;
    if (!dlg) return false;
    dlg.index += 1;
    if (dlg.index >= dlg.lines.length) state.mission.dialogue = null;
    audio.resume();
    return true;
  }

  function handleActions() {
    const { actions, clicked } = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.toggleMute();
      state.muted = audio.muted;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM || clicked) {
        if (save && save.missionsDone > 0 && !input.isDown('KeyN')) continueStory();
        else startFresh();
      }
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM || clicked) {
        save = readSave();
        screen = SCREEN_TITLE;
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    // Dialogue eats E / Enter / click first.
    if (state.mission.dialogue) {
      if (actions & (ACTION_ENTER | ACTION_CONFIRM) || clicked) advanceDialogue();
      return;
    }
    if (actions & ACTION_ENTER) world.tryEnterCar();
    if (actions & ACTION_PUNCH) punch(state);
    if (actions & ACTION_RELOAD) world.reload();
    if (actions & ACTION_SIDE) {
      const px = state.playerCar ? state.playerCar.x : state.player.x;
      const py = state.playerCar ? state.playerCar.y : state.player.y;
      const atPlaza = Math.hypot(px - 1480, py - 1200) < 160;
      if (atPlaza && !state.courier.active) {
        startCourierRun(state);
      } else if (!state.mission.active && state.missionsDone < 5) {
        startMission(state, state.missionsDone);
      }
    }
    if (clicked) audio.resume();
  }

  function aimAngle() {
    const view = renderer.view;
    const px = state.playerCar ? state.playerCar.x : state.player.x;
    const py = state.playerCar ? state.playerCar.y : state.player.y;
    const wx = input.mouse.x + state.camera.x - view.w / 2;
    const wy = input.mouse.y + state.camera.y - view.h / 2;
    return Math.atan2(wy - py, wx - px);
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, input, 0, true);
      return;
    }
    const events = world.step(STEP, input, aimAngle(), false);
    if (events & EVENT_BUSTED) endRun('busted');
    else if (events & EVENT_WASTED) endRun('wasted');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    // Per-frame derived state the HUD and renderer read.
    state.muted = audio.muted;
    state.missionMarker = currentMarker(state);
    state.courierTarget = state.courier.active ? CHECKPOINTS[state.courier.index % CHECKPOINTS.length] : null;
    state.nearCar = !state.playerCar && !state.player.dead
      ? nearestCar(state.cars, state.player.x, state.player.y, 58)
      : null;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.drawWorld(state);
    if (screen === SCREEN_TITLE) {
      hud.drawTitle(state, save);
    } else if (screen === SCREEN_PAUSED) {
      hud.drawHud(state, renderer.view);
      hud.drawCenterPanel('PAUSED', [
        { text: 'The city waits for you.', size: 18 },
        { text: `Cash $${state.cash}  ·  Jobs done ${state.missionsDone}/5  ·  Score ${state.score()}`, size: 16 },
      ], 'Press P to resume', '#e8b73a');
    } else if (screen === SCREEN_BUSTED) {
      hud.drawCenterPanel('BUSTED', [
        { text: 'The Sunset Harbor police caught up with you.', size: 18 },
        { text: 'Your cash stays where it fell. The story can start again.', size: 16, color: '#9aa0a8' },
        { text: `Score ${state.score()}  ·  Best ${best}  ·  Jobs done ${state.missionsDone}/5`, size: 17 },
      ], 'Press Enter to return to the title screen', '#e5534b');
    } else if (screen === SCREEN_WASTED) {
      hud.drawCenterPanel('WASTED', [
        { text: 'Sunset Harbor is a rough town. You got caught out.', size: 18 },
        { text: 'Your cash stays where it fell. The story can start again.', size: 16, color: '#9aa0a8' },
        { text: `Score ${state.score()}  ·  Best ${best}  ·  Jobs done ${state.missionsDone}/5`, size: 17 },
      ], 'Press Enter to return to the title screen', '#e5534b');
    } else {
      hud.drawHud(state, renderer.view);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Sunset Harbor. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
