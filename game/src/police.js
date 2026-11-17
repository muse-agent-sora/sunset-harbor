// Sunset Harbor — the wanted system and the police who answer it.
// Wanted stars rise with crimes and fall when the player stays out of sight.
// Foot cops run the player down and try to arrest them; police cars chase
// and ram. The numbers in POLICE (config) decide how many of each show up.
import { POLICE, ROAD_X, ROAD_Y, WANTED } from './config.js';
import { makeCar } from './vehicles.js';
import { clampToWorld, collideBuildings, nearestRoadX, nearestRoadY } from './city.js';

export function addWanted(world, stars, reason) {
  if (stars <= 0 || world.player.dead) return;
  const before = world.wanted;
  world.wanted = Math.min(WANTED.max, world.wanted + stars);
  world.lastCrimeTime = world.time;
  world.hiddenTime = 0;
  if (world.wanted > before) {
    world.flashWanted = 1.2;
    if (world.audio) world.audio.wantedUp();
    if (world.banner) world.banner(`WANTED LEVEL ${world.wanted} — ${reason}`, '#e5534b');
  }
}

// Wanted falls only while no crime has happened recently and no police
// officer can see the player.
export function updateWanted(world, dt) {
  if (world.wanted === 0) return;
  const anyNear = world.cops.some((c) => c.alive && Math.hypot(c.x - world.player.x, c.y - world.player.y) < 560)
    || world.policeCars.some((c) => Math.hypot(c.x - world.player.x, c.y - world.player.y) < 560);
  if (world.time - world.lastCrimeTime > WANTED.decayDelay && !anyNear) {
    world.hiddenTime += dt;
    if (world.hiddenTime >= WANTED.decayInterval) {
      world.hiddenTime = 0;
      world.wanted -= 1;
      if (world.wanted === 0 && world.banner) world.banner('You lost the cops. Heat is off.', '#7fbf5a');
    }
  } else {
    world.hiddenTime = 0;
  }
}

function makeCop(world, x, y) {
  return {
    kind: 'cop',
    x, y,
    angle: 0,
    speed: 0,
    hp: 50,
    alive: true,
    shirt: '#1e3a5f',
    skin: '#e8b88a',
    walkSpeed: 175,
    arrestTimer: 0,
    hitFlash: 0,
    punchCooldown: 0,
  };
}

// Spawn the police the current wanted level calls for, at the map edges
// and on roads near the player, never right on top of them.
export function maintainPolice(world, rng) {
  const level = world.wanted;
  const wantFoot = POLICE.footCops[level] || 0;
  const wantCars = POLICE.cars[level] || 0;
  const player = world.player;

  while (world.cops.filter((c) => c.alive).length < wantFoot) {
    const edge = rng.int(0, 3);
    let x;
    let y;
    if (edge === 0) { x = rng.range(100, 3100); y = 120; }
    else if (edge === 1) { x = rng.range(100, 3100); y = 2220; }
    else if (edge === 2) { x = 120; y = rng.range(100, 2200); }
    else { x = 3120; y = rng.range(100, 2200); }
    if (Math.hypot(x - player.x, y - player.y) < 420) continue;
    world.cops.push(makeCop(world, x, y));
  }
  while (world.policeCars.length < wantCars) {
    const roadX = rng.pick(ROAD_X);
    const roadY = rng.pick(ROAD_Y);
    const onVertical = rng.chance(0.5);
    const x = onVertical ? roadX : rng.range(200, 3000);
    const y = onVertical ? rng.range(200, 2100) : roadY;
    if (Math.hypot(x - player.x, y - player.y) < 480) continue;
    const car = makeCar('police', x, y, onVertical ? Math.PI / 2 : 0, 'police');
    car.cruise = 420;
    car.stuckTime = 0;
    world.policeCars.push(car);
  }
}

// A foot cop: run at the player, punch them when close, and arrest them
// if they stay in reach — unless the player is in a car, which a cop cannot stop.
export function updateCop(cop, world, dt) {
  if (!cop.alive) return;
  if (cop.hitFlash > 0) cop.hitFlash -= dt;
  cop.punchCooldown -= dt;
  const player = world.player;
  if (player.dead) return;
  const d = Math.hypot(player.x - cop.x, player.y - cop.y);
  if (world.playerCar) {
    // On foot no more: cops chase the car on foot. They can only yank the
    // player out of a car that has nearly stopped, and only after holding
    // on for a second — a moving getaway is safe from them.
    if (d < 40 && Math.abs(world.playerCar.speed) < 8) {
      cop.ejectTimer = (cop.ejectTimer || 0) + dt;
      if (cop.ejectTimer >= 1.5) {
        world.ejectPlayer();
        cop.arrestTimer = 0;
        cop.ejectTimer = 0;
      }
    } else {
      cop.ejectTimer = 0;
    }
    if (d > 30) {
      const dx = player.x - cop.x;
      const dy = player.y - cop.y;
      const dist = d || 1;
      cop.angle = Math.atan2(dy, dx);
      cop.x += (dx / dist) * cop.walkSpeed * 1.15 * dt;
      cop.y += (dy / dist) * cop.walkSpeed * 1.15 * dt;
      collideBuildings(world.city, cop, 12);
      clampToWorld(cop, 12);
    }
    return;
  }
  if (d > 22) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    cop.angle = Math.atan2(dy, dx);
    cop.x += (dx / d) * cop.walkSpeed * dt;
    cop.y += (dy / d) * cop.walkSpeed * dt;
    collideBuildings(world.city, cop, 12);
    clampToWorld(cop, 12);
    cop.arrestTimer = 0;
  } else {
    cop.arrestTimer += dt;
    if (cop.punchCooldown <= 0) {
      cop.punchCooldown = 0.8;
      world.damagePlayer(10, cop.x, cop.y);
      if (world.audio) world.audio.punch();
    }
    if (cop.arrestTimer >= POLICE.arrestTime) {
      world.bustPlayer();
    }
  }
}

// A police car: steer straight at the player, ram them, and keep going if
// it gets stuck on a building — it backs off and re-approaches.
export function updatePoliceCar(car, world, dt) {
  if (car.wrecked) {
    car.speed = 0;
    return;
  }
  const player = world.player;
  const targetX = world.playerCar ? world.playerCar.x : player.x;
  const targetY = world.playerCar ? world.playerCar.y : player.y;
  const dx = targetX - car.x;
  const dy = targetY - car.y;
  const dist = Math.hypot(dx, dy);
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const near = dist < 260;
  const wantSpeed = near ? 460 : 520;
  if (car.speed < wantSpeed) car.speed += 380 * dt;
  else car.speed -= 300 * dt;
  car.angle += steer * 2.9 * dt * (0.4 + Math.min(1, Math.abs(car.speed) / 200));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const hitWall = collideBuildings(world.city, car, 20);
  if (hitWall) {
    car.speed *= 0.5;
    if (Math.abs(car.speed) < 40) car.stuckTime += dt;
    else car.stuckTime = 0;
    if (car.stuckTime > 1.6) {
      // Back up and turn around instead of grinding on the wall.
      car.speed = -160;
      car.angle += Math.PI * 0.6;
      car.stuckTime = 0;
    }
  } else {
    car.stuckTime = 0;
  }
  clampToWorld(car, 24);
  // Ram the player's car (or the player on foot).
  if (world.playerCar) {
    const pd = Math.hypot(world.playerCar.x - car.x, world.playerCar.y - car.y);
    if (pd < 40) {
      const push = 320 * dt;
      world.playerCar.x += (world.playerCar.x - car.x) / (pd || 1) * push;
      world.playerCar.y += (world.playerCar.y - car.y) / (pd || 1) * push;
      world.playerCar.speed *= 0.92;
      if (world.shake !== undefined) world.shake = Math.min(12, world.shake + 3);
      if (world.audio && Math.random() < 0.2) world.audio.crash();
      // Do not grind the player into a wall: after a second of contact,
      // back off and come around again.
      car.pushTime = (car.pushTime || 0) + dt;
      if (car.pushTime > 1.0) {
        car.backoff = 0.9;
        car.pushTime = 0;
      }
    } else {
      car.pushTime = 0;
    }
    if (car.backoff > 0) {
      car.backoff -= dt;
      car.speed = -220;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      return;
    }
  } else if (dist < 26 && !player.dead) {
    world.damagePlayer(22, car.x, car.y);
    car.speed *= 0.6;
  }
}

// Clean up police that are far away or dead once the heat is off.
export function prunePolice(world) {
  if (world.wanted === 0) {
    world.cops = world.cops.filter((c) => c.alive && Math.hypot(c.x - world.player.x, c.y - world.player.y) < 900);
    world.policeCars = world.policeCars.filter((c) => Math.hypot(c.x - world.player.x, c.y - world.player.y) < 900);
  }
}

export { nearestRoadX, nearestRoadY };
