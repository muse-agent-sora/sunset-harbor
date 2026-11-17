// Sunset Harbor — screenshot staging behind ?shot=start|play|mission|end.
// Each scene is built by playing the real rules forward from a fresh world for
// a fixed number of steps, steered by a small autopilot that drives the player's
// car toward the mission marker, so the frame is what a real game looks like
// and the same seed always gives the same frame.
import { WORLD, VIEW, ROADS_X, ROADS_Y } from './config.js';
import { clamp, dist } from './rng.js';
import { createGame } from './state.js';
import {
  updateTraffic, updatePeds, updatePolice, updateThugs, updateBullets,
  updateParticles, updateWorldClock, resolveCarCollisions,
  playerCar, makeCar,
} from './entities.js';
import { resolveBuildingCollision } from './city.js';
import { startMission, updateMission, missionMarker, MISSIONS } from './missions.js';

const STEP = 1 / 60;

/** Put the player behind the wheel of the nearest parked car. */
function putPlayerInCar(state, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.driver !== 'parked') continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return null;
  best.driver = 'player';
  best.speed = 0;
  state.player.carId = best.id;
  state.player.x = best.x;
  state.player.y = best.y;
  state.player.angle = best.angle;
  return best;
}

/** Drive the player's car toward a target, following the road grid: first along
 * the current road to the target's x, then up or down to the target's y. */
function autopilotDrive(state, targetX, targetY, dt) {
  const car = playerCar(state);
  if (!car) return;
  const alongX = Math.abs(car.x - targetX) > 60;
  // Snap the waypoint onto the nearest road centreline, so the car stays on
  // the asphalt instead of drifting across the blocks.
  const roadY = ROADS_Y.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
  const roadX = ROADS_X.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
  const wx = alongX ? targetX : roadX;
  const wy = alongX ? roadY : targetY;
  const want = Math.atan2(wy - car.y, wx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
  car.speed = Math.min(340, car.speed + 300 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 40, WORLD.width - 40);
  car.y = clamp(car.y, 40, WORLD.height - 40);
  // Stay out of buildings even when a police ram shoves the car sideways.
  resolveBuildingCollision(state.city, car, 26);
  // The driver rides with the car: keep the player glued to it, as the real
  // driving code does every frame.
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
}

/** Step the ambient world (traffic, pedestrians, police, particles) forward. */
function stepWorld(state, dt) {
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateThugs(state, dt);
  updateBullets(state, dt);
  updateParticles(state, dt);
  updateWorldClock(state, dt);
  resolveCarCollisions(state);
  state.time += dt;
  state.camera.x = clamp(state.player.x - VIEW.width / 2, -60, WORLD.width - VIEW.width + 60);
  state.camera.y = clamp(state.player.y - VIEW.height / 2, -60, WORLD.height - VIEW.height + 60);
}

/** Spawn a patrol car at a distance from the player, already in pursuit. */
function spawnPursuit(state, angle, distance) {
  const p = state.player;
  const x = clamp(p.x + Math.cos(angle) * distance, 100, WORLD.width - 300);
  const y = clamp(p.y + Math.sin(angle) * distance, 100, 2350);
  const car = makeCar(x, y, Math.atan2(p.y - y, p.x - x), 'police', 'police', '#2a4a8a');
  car.speed = 320;
  state.cars.push(car);
  return car;
}

/**
 * Build the named scene and return the state to draw. The caller draws one
 * frame and sets window.__shotReady.
 */
export function stageShot(name, seed) {
  const state = createGame(seed);
  if (name === 'start') {
    // Title screen over a living city: let traffic flow for a while.
    state.mode = 'title';
    state.camera.x = 1100;
    state.camera.y = 900;
    for (let i = 0; i < 5 / STEP; i += 1) stepWorld(state, STEP);
    state.camera.x = 1100;
    state.camera.y = 900;
    return state;
  }

  if (name === 'mission') {
    state.mode = 'play';
    startMission(state, 0);
    putPlayerInCar(state, 1280, 1160);
    const car = playerCar(state);
    if (car) {
      car.angle = 0;
      car.x = 2400;
      car.y = 840;
      state.player.x = car.x;
      state.player.y = car.y;
    }
    state.player.cash = 150;
    state.score = 220;
    // Drive east toward the marker for a few seconds so the frame is mid-job,
    // following the mission marker as the stages advance.
    for (let i = 0; i < 3.5 / STEP; i += 1) {
      const marker = missionMarker(state);
      if (marker) autopilotDrive(state, marker.x, marker.y, STEP);
      stepWorld(state, STEP);
      updateMission(state, STEP);
    }
    state.mission.introTimer = 2;
    return state;
  }

  if (name === 'end') {
    // Busted after a good run: one job done, cash in hand, police closing in.
    state.mode = 'play';
    startMission(state, 0);
    putPlayerInCar(state, 1280, 1160);
    state.player.cash = 320;
    state.score = 480;
    state.missionsDone = 1;
    state.wanted = 3;
    spawnPursuit(state, Math.PI, 260);
    spawnPursuit(state, Math.PI / 2, 320);
    state.cops.push({
      id: 9001, x: state.player.x + 60, y: state.player.y + 30, angle: 0,
      speed: 190, health: 60, punchCooldown: 0, arrestTimer: 1.2,
    });
    for (let i = 0; i < 2 / STEP; i += 1) stepWorld(state, STEP);
    state.mode = 'busted';
    state.endReason = 'busted';
    state.bestScore = 480;
    // A clean end frame: no mission dialogue or message pill over the screen.
    state.mission.introTimer = 0;
    state.message = '';
    state.messageTimer = 0;
    return state;
  }

  // 'play' (and anything else): a live chase — HUD, minimap, traffic, police.
  state.mode = 'play';
  startMission(state, 0);
  putPlayerInCar(state, 1280, 1160);
  const car = playerCar(state);
  if (car) {
    car.angle = 0;
    car.x = 1500;
    car.y = 1160;
    state.player.x = car.x;
    state.player.y = car.y;
  }
  state.wanted = 2;
  state.lastCrime = 'car theft';
  state.wantedFlash = 0.8;
  spawnPursuit(state, Math.PI, 650);
  state.player.cash = 150;
  state.score = 180;
  for (let i = 0; i < 4 / STEP; i += 1) {
    autopilotDrive(state, 2900, 840, STEP);
    stepWorld(state, STEP);
    updateMission(state, STEP);
  }
  state.mission.introTimer = 1.5;
  return state;
}
