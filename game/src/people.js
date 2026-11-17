// Sunset Harbor — the people on foot: pedestrians who stroll the sidewalks
// and scatter when shots are fired, and street thugs who pick fights and
// guard mission spots. All of them share one body shape: {x, y, angle,
// speed, hp, kind, ...} and a small state machine.
import { PLAYER, ROAD_W, ROAD_X, ROAD_Y } from './config.js';
import { clampToWorld, collideBuildings } from './city.js';

const PED_SHIRTS = ['#e8b73a', '#4f7fb8', '#c23b3b', '#8a9a7a', '#b0563f', '#7a6a8a', '#d8d8d8', '#3f9fb0'];
const PED_SKINS = ['#e8b88a', '#c98a5a', '#8a5a35', '#f0c8a0'];

let nextPersonId = 1;

export function makePed(rng, x, y) {
  return {
    id: nextPersonId += 1,
    kind: 'ped',
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    hp: 30,
    alive: true,
    shirt: rng.pick(PED_SHIRTS),
    skin: rng.pick(PED_SKINS),
    walkSpeed: rng.range(45, 75),
    targetX: x,
    targetY: y,
    fleeTime: 0,
    retarget: 0,
    hitFlash: 0,
  };
}

export function makeThug(rng, x, y, armed) {
  const thug = makePed(rng, x, y);
  thug.kind = 'thug';
  thug.hp = 60;
  thug.armed = !!armed;
  thug.walkSpeed = 95;
  thug.shirt = '#2a2f38';
  thug.attackCooldown = 0;
  thug.shootCooldown = rng.range(0.5, 1.5);
  return thug;
}

// Pick a new strolling target on a sidewalk near the ped.
function pickStrollTarget(rng, ped) {
  const vertical = rng.chance(0.5);
  if (vertical) {
    const line = rng.pick(ROAD_X);
    ped.targetX = line + (rng.chance(0.5) ? -(ROAD_W / 2 + 14) : ROAD_W / 2 + 14);
    ped.targetY = Math.max(60, Math.min(2240, ped.y + rng.range(-320, 320)));
  } else {
    const line = rng.pick(ROAD_Y);
    ped.targetY = line + (rng.chance(0.5) ? -(ROAD_W / 2 + 14) : ROAD_W / 2 + 14);
    ped.targetX = Math.max(60, Math.min(3140, ped.x + rng.range(-320, 320)));
  }
}

function moveToward(body, tx, ty, speed, dt, city) {
  const dx = tx - body.x;
  const dy = ty - body.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return true;
  body.angle = Math.atan2(dy, dx);
  body.x += (dx / d) * speed * dt;
  body.y += (dy / d) * speed * dt;
  collideBuildings(city, body, 12);
  clampToWorld(body, 12);
  return false;
}

// One step for a pedestrian: stroll, or run from the last gunshot.
export function updatePed(ped, rng, city, world, dt) {
  if (!ped.alive) return;
  if (ped.hitFlash > 0) ped.hitFlash -= dt;
  if (ped.fleeTime > 0) {
    ped.fleeTime -= dt;
    // Run away from the gunshot point.
    const dx = ped.x - world.lastShotX;
    const dy = ped.y - world.lastShotY;
    const d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * ped.walkSpeed * 2.6 * dt;
    ped.y += (dy / d) * ped.walkSpeed * 2.6 * dt;
    collideBuildings(city, ped, 12);
    clampToWorld(ped, 12);
    return;
  }
  ped.retarget -= dt;
  const arrived = moveToward(ped, ped.targetX, ped.targetY, ped.walkSpeed, dt, city);
  if (arrived || ped.retarget <= 0) {
    pickStrollTarget(rng, ped);
    ped.retarget = rng.range(4, 9);
  }
}

// Thugs chase the player when close, punch up close, and shoot if armed.
export function updateThug(thug, rng, city, world, dt) {
  if (!thug.alive) return;
  if (thug.hitFlash > 0) thug.hitFlash -= dt;
  thug.attackCooldown -= dt;
  thug.shootCooldown -= dt;
  const player = world.player;
  const d = Math.hypot(player.x - thug.x, player.y - thug.y);
  const inCar = !!world.playerCar;
  if (d > 520 || player.dead) {
    // Idle: stroll like anyone else.
    updatePed(thug, rng, city, world, dt);
    return;
  }
  if (thug.armed && d > 130 && d < 460 && thug.shootCooldown <= 0 && !inCar) {
    thug.shootCooldown = rng.range(1.1, 2.0);
    world.enemyShoot(thug.x, thug.y, Math.atan2(player.y - thug.y, player.x - thug.x));
    return;
  }
  if (d > 26) {
    moveToward(thug, player.x, player.y, thug.walkSpeed * (inCar ? 1.15 : 1), dt, city);
  } else if (thug.attackCooldown <= 0) {
    thug.attackCooldown = 0.9;
    world.damagePlayer(PLAYER.punchDamage * 0.6, thug.x, thug.y);
    if (world.audio) world.audio.punch();
  }
}

// Damage a person; returns true when they go down.
export function hurtPerson(person, amount, world) {
  if (!person.alive) return false;
  person.hp -= amount;
  person.hitFlash = 0.18;
  if (person.hp <= 0) {
    person.alive = false;
    person.hp = 0;
    if (world.spawnBlood) world.spawnBlood(person.x, person.y, 10);
    return true;
  }
  return false;
}

// Every living ped within range of a gunshot starts fleeing.
export function scarePeds(world, x, y, radius) {
  world.lastShotX = x;
  world.lastShotY = y;
  for (const ped of world.peds) {
    if (!ped.alive) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) ped.fleeTime = 3 + Math.random() * 2;
  }
}
