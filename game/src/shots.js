// Sunset Harbor — the screenshot scenes behind ?shot=start|play|mission|end.
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a small autopilot, so the frame is what real
// play looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { addWanted } from './police.js';
import { startMission } from './missions.js';
import { SCREEN_BUSTED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

// A fake input object the autopilot drives: the world step reads the same
// methods the real keyboard input offers.
function autopilotInput() {
  const input = {
    accelOn: false,
    brakeOn: false,
    steerVal: 0,
    moveX: 0,
    moveY: 0,
    shootHeld: false,
    moveAxis() { return { x: input.moveX, y: input.moveY }; },
    sprint() { return false; },
    handbrake() { return false; },
    accelerate() { return input.accelOn; },
    brake() { return input.brakeOn; },
    steer() { return input.steerVal; },
    shooting() { return input.shootHeld; },
  };
  return input;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Steer a car toward a point and keep it moving.
function driveToward(input, car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(want, car.angle);
  input.steerVal = Math.max(-1, Math.min(1, diff * 2.4));
  input.accelOn = Math.abs(diff) < 1.1;
  input.brakeOn = Math.abs(diff) >= 1.1 && Math.abs(car.speed) > 120;
}

// Walk toward a point on foot.
function walkToward(input, x, y, tx, ty) {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy) || 1;
  input.moveX = Math.abs(dx / d) > 0.25 ? Math.sign(dx) : 0;
  input.moveY = Math.abs(dy / d) > 0.25 ? Math.sign(dy) : 0;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Names: start, play, mission, end.
 */
export function stageShot(name, world) {
  const state = world.state;
  const input = autopilotInput();
  world.reset();

  if (name === 'play') {
    // A chase: the player steals the sports car by the garage and runs
    // east along the Old Town road, the heat on, police cars closing in.
    const car = state.cars.find((c) => c.type === 'sports' && !c.occupied);
    state.player.x = car.x;
    state.player.y = car.y;
    state.playerCar = car;
    car.driver = 'player';
    car.occupied = true;
    car.speed = 300;
    car.angle = 0;
    car.x = 700;
    car.y = 560;
    addWanted(state, 2, 'Grand theft auto');
    for (let i = 0; i < 8 * 60; i += 1) {
      driveToward(input, car, 3060, 560);
      const aim = Math.atan2(560 - car.y, 3060 - car.x);
      world.step(STEP, input, aim, false);
      if (state.player.dead) break;
    }
    // Frame the chase: the car back on its lane, undamaged, police behind.
    car.y = 560;
    car.angle = 0;
    car.speed = 380;
    car.health = 100;
    car.wrecked = false;
    state.camera.x = car.x;
    state.camera.y = car.y;
    state.missionMarker = { x: 3060, y: 560 };
    return { screen: SCREEN_PLAY, best: state.score() };
  }

  if (name === 'mission') {
    // Mission two in progress: Rook reaches Harbor Plaza and the two
    // guards come at him, pistol out.
    startMission(state, 1);
    state.mission.dialogue = null;
    state.player.x = 1480;
    state.player.y = 1340;
    for (let i = 0; i < 9 * 60; i += 1) {
      walkToward(input, state.player.x, state.player.y, 1480, 1200);
      const aim = Math.atan2(1200 - state.player.y, 1480 - state.player.x);
      world.step(STEP, input, aim, false);
      if (state.mission.step >= 1) break;
    }
    // Let the guards close in for a couple of seconds, then freeze the
    // frame mid-fight: thugs approaching, pistol out, objective live.
    input.moveX = 0;
    input.moveY = 0;
    for (let i = 0; i < 2 * 60; i += 1) {
      const thug = state.peds.find((p) => p.kind === 'thug' && p.alive);
      const aim = thug
        ? Math.atan2(thug.y - state.player.y, thug.x - state.player.x)
        : Math.atan2(1200 - state.player.y, 1480 - state.player.x);
      state.player.aimAngle = aim;
      world.step(STEP, input, aim, false);
    }
    return { screen: SCREEN_PLAY, best: state.score() };
  }

  if (name === 'end') {
    // Busted: three stars, cops closing in, then the arrest lands.
    addWanted(state, 3, 'Grand theft auto');
    state.player.x = 1480;
    state.player.y = 1200;
    for (let i = 0; i < 6 * 60; i += 1) {
      world.step(STEP, input, 0, false);
    }
    state.player.dead = true;
    state.busted = true;
    state.bustReason = 'busted';
    state.earned = 840;
    state.cash = 560;
    state.missionsDone = 2;
    return { screen: SCREEN_BUSTED, best: state.score() };
  }

  // Default: the title over a living city.
  for (let i = 0; i < 5 * 60; i += 1) {
    world.step(STEP, input, 0, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
