// Sunset Harbor — every moving thing in the city: the player on foot and behind
// the wheel, traffic cars and pedestrians, foot cops and patrol cars, thugs,
// bullets, particles and skid marks. The wanted level lives here too, since it
// is the cops who enforce it.
import { WORLD, PLAYER, CAR_TYPES, CAR_TYPE_KEYS, WANTED, BEACH_X, HARBOR_Y } from './config.js';
import { clamp, angleDiff, dist, makeRng } from './rng.js';
import {
  isOnRoad, isWater, isBeach, hitBuilding, resolveBuildingCollision,
  nearestRoadPoint, lightAt, lightGreenFor, stepLights,
} from './city.js';
import { input, aimAngle } from './input.js';
import { sfx, engineSound, sirenSound } from './audio.js';

let nextId = 1;

const TRAFFIC_COLORS = ['#c84b4b', '#4b7ac8', '#c8a24b', '#4bc87a', '#8a4bc8', '#c8c8c8', '#3a3a3a', '#e07840'];
const PED_COLORS = ['#d8a878', '#a8c8d8', '#c8d8a8', '#d8b8c8', '#b8a8d8', '#e8c898'];
const THUG_COLORS = ['#5c2a2a', '#2a2a3a', '#3a2a1a'];

/** Make a fresh car. `driver` is traffic | player | police | parked | mission | none. */
export function makeCar(x, y, angle, typeKey, driver, color) {
  const type = CAR_TYPES[typeKey];
  return {
    id: nextId += 1,
    type: typeKey,
    x, y, angle,
    speed: 0,
    color: color || TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
    driver,
    health: type.health,
    maxHealth: type.health,
    // Traffic AI state: which road it follows and which way.
    roadVertical: Math.abs(Math.sin(angle)) > 0.7,
    roadCoord: 0,
    direction: 1,
    cruise: 150 + Math.random() * 90,
    ramCooldown: 0,
    backoffTimer: 0,
    smokeTimer: 0,
  };
}

/** Spawn the traffic and parked cars for a fresh game. */
export function spawnCars(state) {
  const rng = makeRng(state.seed + 101);
  for (const spot of state.city.spawn.cars) {
    const typeKey = rng.pick(CAR_TYPE_KEYS.filter((k) => k !== 'police'));
    const car = makeCar(spot.x, spot.y, spot.angle, typeKey, 'parked');
    car.roadVertical = Math.abs(Math.sin(spot.angle)) > 0.7;
    state.cars.push(car);
  }
  for (let i = 0; i < 16; i += 1) {
    const car = spawnTrafficCar(state, rng);
    if (car) state.cars.push(car);
  }
}

/** A traffic car cruising a random road, or null when it cannot be placed. */
export function spawnTrafficCar(state, rng) {
  const vertical = rng.chance(0.5);
  const roads = vertical
    ? [200, 560, 920, 1280, 1640, 2000, 2360, 2720]
    : [200, 520, 840, 1160, 1480, 1800, 2120];
  const road = rng.pick(roads);
  const dir = rng.chance(0.5) ? 1 : -1;
  const x = vertical ? road + (dir > 0 ? 14 : -14) : rng.range(200, WORLD.width - 300);
  const y = vertical ? rng.range(200, 2300) : road + (dir > 0 ? 14 : -14);
  if (dist(x, y, state.player.x, state.player.y) < 300) return null;
  const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  const car = makeCar(x, y, angle, rng.pick(CAR_TYPE_KEYS.filter((k) => k !== 'police' && k !== 'truck')), 'traffic');
  car.roadVertical = vertical;
  car.direction = dir;
  car.speed = car.cruise;
  return car;
}

/** Pedestrians wandering the sidewalks. */
export function spawnPeds(state) {
  const rng = makeRng(state.seed + 202);
  for (const spot of state.city.spawn.peds) {
    state.peds.push({
      id: nextId += 1,
      x: spot.x, y: spot.y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 55),
      color: rng.pick(PED_COLORS),
      state: 'walk',
      fleeTimer: 0,
      targetAngle: rng.range(0, Math.PI * 2),
      changeTimer: rng.range(2, 6),
      health: 40,
      scared: false,
    });
  }
}

/** Scatter cash drops around the city for free-roam collection. */
export function spawnCashDrops(state) {
  const rng = makeRng(state.seed + 303);
  for (let i = 0; i < 14; i += 1) {
    state.pickups.push({
      x: rng.range(250, WORLD.width - 350),
      y: rng.range(250, 2350),
      amount: 25,
      bob: rng.range(0, Math.PI * 2),
      taken: false,
    });
  }
}

export function addParticles(state, x, y, count, color, speed, life) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = speed * (0.4 + Math.random() * 0.8);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: life * (0.5 + Math.random() * 0.7),
      maxLife: life,
      color,
      size: 2 + Math.random() * 3,
    });
  }
  if (state.particles.length > 500) state.particles.splice(0, state.particles.length - 500);
}

export function addSkid(state, x, y, angle) {
  state.skids.push({ x, y, angle, life: 6 });
  if (state.skids.length > 300) state.skids.shift();
}

/** Raise the wanted level, capped at 5, and remember why for the HUD flash. */
export function addWanted(state, amount, reason) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + amount, 0, WANTED.max);
  if (state.wanted > before) {
    state.wantedFlash = 1.2;
    state.lastCrime = reason;
    state.hideTimer = 0;
  }
}

/** The player's car, or null when on foot. */
export function playerCar(state) {
  if (state.player.carId === null) return null;
  return state.cars.find((c) => c.id === state.player.carId) || null;
}

function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** E to enter or exit the nearest car. */
function tryEnterExitCar(state) {
  const p = state.player;
  if (p.carId !== null) {
    const car = playerCar(state);
    if (car) {
      car.driver = 'parked';
      car.speed = 0;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      p.angle = car.angle;
      p.carId = null;
      sfx.enterCar();
      state.message = 'On foot — find a car or a mission marker';
      state.messageTimer = 2.5;
    }
    return;
  }
  const car = nearestCar(state, p.x, p.y, 64);
  if (!car) return;
  if (car.driver === 'traffic') {
    // Stealing an occupied car: the driver bails out and flees, and the law notices.
    addWanted(state, WANTED.stealOccupied, 'car theft');
    state.peds.push({
      id: nextId += 1, x: car.x + 30, y: car.y + 30,
      angle: Math.random() * Math.PI * 2, speed: 90, color: '#d8a878',
      state: 'flee', fleeTimer: 4, targetAngle: 0, changeTimer: 0, health: 40, scared: true,
    });
    state.stats.carsStolen += 1;
    addParticles(state, car.x, car.y, 8, '#ffd24b', 120, 0.5);
    state.message = 'You stole the car! The police are on their way.';
    state.messageTimer = 3;
  } else if (car.driver === 'police') {
    addWanted(state, 2, 'stole a patrol car');
    state.message = 'You stole a patrol car! Every cop in the city is coming.';
    state.messageTimer = 3;
  } else {
    state.message = `Driving the ${CAR_TYPES[car.type].name}`;
    state.messageTimer = 2;
  }
  car.driver = 'player';
  p.carId = car.id;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  sfx.enterCar();
}

/** Punch (F): a short arc in front of the player, on foot or leaning from a car. */
function tryPunch(state) {
  const p = state.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  sfx.punch();
  const px = p.x + Math.cos(p.angle) * 30;
  const py = p.y + Math.sin(p.angle) * 30;
  addParticles(state, px, py, 5, '#ffffff', 140, 0.3);
  let hitSomething = false;
  const tryHit = (list, onHit) => {
    for (const e of list) {
      if (e.health <= 0) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < PLAYER.punchRange + 14 && Math.abs(angleDiff(p.angle, Math.atan2(e.y - p.y, e.x - p.x))) < PLAYER.punchArc) {
        e.health -= PLAYER.punchDamage;
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        e.x += Math.cos(a) * 14;
        e.y += Math.sin(a) * 14;
        addParticles(state, e.x, e.y, 8, '#ff6b5e', 160, 0.4);
        hitSomething = true;
        onHit(e);
      }
    }
  };
  tryHit(state.peds, (e) => {
    e.state = 'flee';
    e.fleeTimer = 3;
    addWanted(state, WANTED.assault, 'assault');
  });
  tryHit(state.cops, (e) => {
    addWanted(state, WANTED.assault, 'assaulted an officer');
  });
  tryHit(state.thugs, () => {
    addWanted(state, 0.2, 'fight');
  });
  if (hitSomething) {
    sfx.hit();
    state.shake = Math.max(state.shake, 4);
  }
}

/** Mouse click / trigger: fire the pistol toward the mouse. */
function tryShoot(state) {
  const p = state.player;
  if (p.reloadTimer > 0 || p.shootCooldown > 0) return;
  if (p.ammo <= 0) {
    p.reloadTimer = PLAYER.reloadSeconds;
    sfx.reload();
    return;
  }
  p.ammo -= 1;
  p.shootCooldown = 0.22;
  state.stats.shotsFired += 1;
  const a = p.aimAngle;
  const mx = p.x + Math.cos(a) * 26;
  const my = p.y + Math.sin(a) * 26;
  state.bullets.push({
    x: mx, y: my,
    vx: Math.cos(a) * PLAYER.bulletSpeed,
    vy: Math.sin(a) * PLAYER.bulletSpeed,
    life: 0.9, from: 'player', damage: PLAYER.pistolDamage,
  });
  addParticles(state, mx, my, 6, '#ffd24b', 220, 0.18);
  state.shake = Math.max(state.shake, 3);
  sfx.shoot();
  addWanted(state, WANTED.shooting, 'gunfire');
  // Nearby pedestrians flee the sound of the shot.
  for (const ped of state.peds) {
    if (dist(p.x, p.y, ped.x, ped.y) < 320) {
      ped.state = 'flee';
      ped.fleeTimer = 3;
    }
  }
}

/** The player: on foot (WASD, sprint, punch, shoot) or driving (W/S/A/D, handbrake). */
export function updatePlayer(state, dt) {
  const p = state.player;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) {
      p.ammo = PLAYER.magazine;
      p.reserveAmmo = Math.max(0, p.reserveAmmo - PLAYER.magazine);
    }
  }
  p.aimAngle = aimAngle(p.x, p.y, state.camera);

  if (input.wasPressed('KeyE')) tryEnterExitCar(state);
  if (input.wasPressed('KeyF')) tryPunch(state);
  if (input.wasPressed('KeyR') && p.ammo < PLAYER.magazine && p.reloadTimer <= 0) {
    p.reloadTimer = PLAYER.reloadSeconds;
    sfx.reload();
  }
  if (input.mouseDown || input.clicked) tryShoot(state);

  const car = playerCar(state);
  if (car) {
    updatePlayerCar(state, car, dt);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    return;
  }

  // On foot.
  let mx = 0;
  let my = 0;
  if (input.any('KeyW', 'ArrowUp')) my -= 1;
  if (input.any('KeyS', 'ArrowDown')) my += 1;
  if (input.any('KeyA', 'ArrowLeft')) mx -= 1;
  if (input.any('KeyD', 'ArrowRight')) mx += 1;
  const sprinting = input.any('ShiftLeft', 'ShiftRight');
  const speed = sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    const vx = (mx / len) * speed;
    const vy = (my / len) * speed;
    const nx = p.x + vx * dt;
    const ny = p.y + vy * dt;
    p.x = nx;
    p.y = ny;
    p.angle = Math.atan2(vy, vx);
    // Face the mouse while shooting, otherwise face the walk direction.
    if (input.mouseDown) p.angle = p.aimAngle;
    p.moving = true;
    p.stepTimer = (p.stepTimer || 0) + dt;
  } else {
    p.moving = false;
    if (input.mouseDown) p.angle = p.aimAngle;
  }
  // Stay out of buildings and water (piers are fine to walk on).
  resolveBuildingCollision(state.city, p, PLAYER.radius);
  if (isWater(p.x, p.y) && !onPier(state, p.x, p.y)) {
    p.y = HARBOR_Y - PLAYER.radius - 2;
  }
  p.x = clamp(p.x, 20, WORLD.width - 20);
  p.y = clamp(p.y, 20, WORLD.height - 20);

  // Cash drops.
  for (const drop of state.pickups) {
    if (!drop.taken && dist(p.x, p.y, drop.x, drop.y) < 30) {
      drop.taken = true;
      p.cash += drop.amount;
      state.score += drop.amount;
      sfx.cash();
      addParticles(state, drop.x, drop.y, 10, '#ffd24b', 160, 0.5);
      state.message = `Picked up $${drop.amount}`;
      state.messageTimer = 1.5;
    }
  }
}

function onPier(state, x, y) {
  for (const pier of state.city.piers) {
    if (x >= pier.x - 6 && x <= pier.x + pier.w + 6 && y >= pier.y && y <= pier.y + pier.h) return true;
  }
  return false;
}

/** Arcade driving: acceleration, braking, steering that bites with speed, handbrake drift. */
function updatePlayerCar(state, car, dt) {
  const type = CAR_TYPES[car.type];
  const p = state.player;
  const forward = input.any('KeyW', 'ArrowUp');
  const brake = input.any('KeyS', 'ArrowDown');
  const handbrake = input.any('Space');
  let steer = 0;
  if (input.any('KeyA', 'ArrowLeft')) steer -= 1;
  if (input.any('KeyD', 'ArrowRight')) steer += 1;

  if (forward) car.speed += type.accel * dt;
  else if (brake) {
    if (car.speed > 40) car.speed -= type.accel * 1.4 * dt;
    else car.speed -= type.accel * 0.5 * dt; // reverse
  } else {
    car.speed -= Math.sign(car.speed) * 120 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * 420 * dt;
    if (Math.abs(car.speed) < 20) car.speed = 0;
  }
  car.speed = clamp(car.speed, -type.topSpeed * 0.45, type.topSpeed);

  // Steering: stronger at low speed, and the handbrake lets the tail step out.
  const speedFactor = clamp(Math.abs(car.speed) / type.topSpeed, 0, 1);
  const steerAmount = steer * type.steer * (0.35 + 0.65 * (1 - speedFactor * 0.6)) * dt * Math.sign(car.speed || 1);
  car.angle += steerAmount * (handbrake ? 1.6 : 1);
  if (handbrake && Math.abs(car.speed) > 120 && steer !== 0) {
    addSkid(state, car.x - Math.cos(car.angle) * 30, car.y - Math.sin(car.angle) * 30, car.angle);
    if (Math.random() < 0.5) addParticles(state, car.x, car.y, 1, '#c8c8c8', 60, 0.4);
  }

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx;
  car.y = ny;
  car.x = clamp(car.x, 30, WORLD.width - 30);
  car.y = clamp(car.y, 30, WORLD.height - 30);

  // Buildings stop the car hard; water stops it too (no driving into the harbor).
  const beforeX = car.x;
  const beforeY = car.y;
  if (resolveBuildingCollision(state.city, car, 26)) {
    if (Math.abs(car.speed) > 180) {
      damageCar(state, car, Math.abs(car.speed) * 0.06);
      state.shake = Math.max(state.shake, 6);
      sfx.crash();
      addParticles(state, car.x, car.y, 12, '#ffb14b', 200, 0.5);
    }
    car.speed *= -0.25;
  }
  if (isWater(car.x, car.y)) {
    car.x = beforeX;
    car.y = beforeY;
    car.speed *= -0.3;
  }
  // Beach sand slows the car.
  if (isBeach(car.x, car.y)) car.speed *= (1 - 0.4 * dt);

  // Damage smoke as the car wears out.
  car.smokeTimer -= dt;
  if (car.health < car.maxHealth * 0.4 && car.smokeTimer <= 0) {
    car.smokeTimer = 0.12;
    addParticles(state, car.x - Math.cos(car.angle) * 30, car.y - Math.sin(car.angle) * 30, 2, '#666666', 40, 0.8);
  }
  // Speeding past a cop is a crime.
  if (Math.abs(car.speed) > 380) {
    for (const cop of state.cops) {
      if (dist(car.x, car.y, cop.x, cop.y) < 320) {
        addWanted(state, WANTED.speedingNearCop * dt, 'speeding');
        break;
      }
    }
    for (const pc of state.cars) {
      if (pc.driver === 'police' && dist(car.x, car.y, pc.x, pc.y) < 320) {
        addWanted(state, WANTED.speedingNearCop * dt, 'speeding');
        break;
      }
    }
  }
  engineSound(Math.abs(car.speed) / type.topSpeed, true);
}

function damageCar(state, car, amount) {
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    addParticles(state, car.x, car.y, 30, '#ff6b3a', 260, 0.9);
    addParticles(state, car.x, car.y, 20, '#333333', 120, 1.4);
    state.shake = Math.max(state.shake, 10);
    sfx.crash();
    if (car.driver === 'player') {
      // The player's car is wrecked: they are thrown out on foot.
      state.player.carId = null;
      state.player.x = car.x + 50;
      state.player.y = car.y;
      state.player.health = Math.max(10, state.player.health - 15);
      state.message = 'Your car is wrecked!';
      state.messageTimer = 3;
    }
    car.driver = 'wrecked';
    car.speed = 0;
  }
}

/** Traffic: follow the road, stop at red lights, turn at intersections sometimes. */
export function updateTraffic(state, dt) {
  const rng = state.rng;
  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    const type = CAR_TYPES[car.type];
    let targetSpeed = car.cruise;
    // Red light ahead: stop at the line.
    const ahead = 70;
    const ax = car.x + Math.cos(car.angle) * ahead;
    const ay = car.y + Math.sin(car.angle) * ahead;
    const light = lightAt(state.city, ax, ay);
    if (light && !lightGreenFor(light, car.roadVertical)) {
      targetSpeed = 0;
    }
    // The car ahead is too close: slow down.
    for (const other of state.cars) {
      if (other === car || other.driver === 'wrecked') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(dx * -Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along > 0 && along < 90 && side < 40) {
        targetSpeed = Math.min(targetSpeed, 0);
        break;
      }
    }
    car.speed += clamp(targetSpeed - car.speed, -260 * dt, 200 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // At an intersection, sometimes turn onto the cross street.
    const nearX = nearestRoadX(state, car.x);
    const nearY = nearestRoadY(state, car.y);
    if (car.roadVertical && Math.abs(car.x - nearX) < 4 && Math.abs(car.y - nearY) < 6 && rng.chance(0.006)) {
      car.roadVertical = false;
      car.angle = rng.chance(0.5) ? 0 : Math.PI;
      car.direction = Math.cos(car.angle) >= 0 ? 1 : -1;
    } else if (!car.roadVertical && Math.abs(car.y - nearY) < 4 && Math.abs(car.x - nearX) < 6 && rng.chance(0.006)) {
      car.roadVertical = true;
      car.angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      car.direction = Math.sin(car.angle) >= 0 ? 1 : -Math.PI / 2;
    }
    // Wrap around the map edges instead of vanishing.
    if (car.x < 60 || car.x > WORLD.width - 240 || car.y < 60 || car.y > 2380) {
      const fresh = spawnTrafficCar(state, rng);
      if (fresh) {
        car.x = fresh.x; car.y = fresh.y; car.angle = fresh.angle;
        car.roadVertical = fresh.roadVertical; car.direction = fresh.direction;
        car.speed = fresh.speed;
      }
    }
  }
  // Parked cars never move; mission and police cars are driven by their own code.
}

function nearestRoadX(state, x) {
  let best = 1e9;
  let bestV = 0;
  for (const rx of [200, 560, 920, 1280, 1640, 2000, 2360, 2720, 3080]) {
    if (Math.abs(rx - x) < best) { best = Math.abs(rx - x); bestV = rx; }
  }
  return bestV;
}
function nearestRoadY(state, y) {
  let best = 1e9;
  let bestV = 0;
  for (const ry of [200, 520, 840, 1160, 1480, 1800, 2120, 2400]) {
    if (Math.abs(ry - y) < best) { best = Math.abs(ry - y); bestV = ry; }
  }
  return bestV;
}

/** Car-vs-car bumps: push apart, trade a little speed, spark and shake. */
export function resolveCarCollisions(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.driver === 'wrecked' && b.driver === 'wrecked') continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = 52;
      if (d === 0 || d >= minD) continue;
      const push = (minD - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      // A police ram PUSHES the player car instead of wrecking it.
      const aIsPlayer = a.driver === 'player';
      const bIsPlayer = b.driver === 'player';
      const aIsPolice = a.driver === 'police';
      const bIsPolice = b.driver === 'police';
      if ((aIsPolice && bIsPlayer) || (bIsPolice && aIsPlayer)) {
        const victim = aIsPlayer ? a : b;
        const rammer = aIsPlayer ? b : a;
        victim.x += nx * push * (aIsPlayer ? 1 : -1) * 1.4;
        victim.y += ny * push * (aIsPlayer ? 1 : -1) * 1.4;
        // A ram is a shove, not a wreck: the speed cut and the damage tick at
        // most twice a second, and damage can never push the car below 25 HP.
        if (rammer.ramCooldown <= 0) {
          rammer.ramCooldown = 0.5;
          victim.speed = clamp(victim.speed * 0.92, -200, 600);
          if (victim.health > 25) damageCar(state, victim, Math.min(3, victim.health - 25));
          rammer.backoffTimer = 1.0; // back off after a second of contact
          if (Math.abs(victim.speed) > 60) {
            state.shake = Math.max(state.shake, 4);
            sfx.crash();
          }
        }
        continue;
      }
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const avg = (a.speed + b.speed) / 2;
      a.speed = avg * 0.85;
      b.speed = avg * 0.85;
      if (Math.abs(a.speed) > 120 || Math.abs(b.speed) > 120) {
        addParticles(state, (a.x + b.x) / 2, (a.y + b.y) / 2, 6, '#ffd24b', 160, 0.35);
        if (aIsPlayer || bIsPlayer) {
          state.shake = Math.max(state.shake, 4);
          sfx.crash();
          const pc = aIsPlayer ? a : b;
          damageCar(state, pc, 4);
        }
      }
    }
  }
}

/** Pedestrians: stroll the sidewalks, flee gunfire and thugs, avoid buildings. */
export function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.health <= 0) continue;
    ped.changeTimer -= dt;
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
      const away = Math.atan2(ped.y - state.player.y, ped.x - state.player.x);
      ped.angle = away;
      ped.x += Math.cos(away) * ped.speed * 2.2 * dt;
      ped.y += Math.sin(away) * ped.speed * 2.2 * dt;
    } else {
      if (ped.changeTimer <= 0) {
        ped.changeTimer = state.rng.range(2, 7);
        ped.targetAngle = state.rng.range(0, Math.PI * 2);
      }
      ped.angle += angleDiff(ped.angle, ped.targetAngle) * Math.min(1, dt * 3);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      // Drift toward the nearest road so they stay near sidewalks.
      if (!isOnRoad(ped.x, ped.y) && state.rng.chance(0.02)) {
        const rp = nearestRoadPoint(ped.x, ped.y);
        ped.targetAngle = Math.atan2(rp.y - ped.y, rp.x - ped.x);
      }
    }
    resolveBuildingCollision(state.city, ped, 12);
    if (isWater(ped.x, ped.y)) ped.y = HARBOR_Y - 14;
    ped.x = clamp(ped.x, 30, WORLD.width - 30);
    ped.y = clamp(ped.y, 30, WORLD.height - 30);
  }
  state.peds = state.peds.filter((p) => p.health > 0 || p.state === 'flee');
}

/** Foot cops chase the player, punch up close, and arrest a near-stopped driver. */
export function updatePolice(state, dt) {
  const p = state.player;
  const pc = playerCar(state);
  // Spawn to match the wanted level.
  const wantedCars = state.wanted >= 2 ? Math.min(3, Math.ceil(state.wanted / 2)) : 0;
  const wantedCops = Math.min(6, Math.ceil(state.wanted));
  const currentCars = state.cars.filter((c) => c.driver === 'police').length;
  const currentCops = state.cops.length;
  if (currentCars < wantedCars && state.wanted >= 1) {
    const angle = state.rng.range(0, Math.PI * 2);
    const x = clamp(p.x + Math.cos(angle) * 700, 100, WORLD.width - 300);
    const y = clamp(p.y + Math.sin(angle) * 700, 100, 2350);
    const car = makeCar(x, y, Math.atan2(p.y - y, p.x - x), 'police', 'police', '#2a4a8a');
    car.speed = 300;
    state.cars.push(car);
  }
  if (currentCops < wantedCops && state.wanted >= 1) {
    const angle = state.rng.range(0, Math.PI * 2);
    state.cops.push({
      id: nextId += 1,
      x: clamp(p.x + Math.cos(angle) * 420, 60, WORLD.width - 100),
      y: clamp(p.y + Math.sin(angle) * 420, 60, 2350),
      angle: 0, speed: 190, health: 60,
      punchCooldown: 0, arrestTimer: 0,
    });
  }
  // Foot cops.
  for (const cop of state.cops) {
    if (cop.health <= 0) continue;
    cop.punchCooldown = Math.max(0, cop.punchCooldown - dt);
    const d = dist(cop.x, cop.y, p.x, p.y);
    const targetAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle += angleDiff(cop.angle, targetAngle) * Math.min(1, dt * 6);
    if (state.wanted > 0) {
      const chaseSpeed = cop.speed * (d > 200 ? 1.15 : 1);
      cop.x += Math.cos(cop.angle) * chaseSpeed * dt;
      cop.y += Math.sin(cop.angle) * chaseSpeed * dt;
    }
    resolveBuildingCollision(state.city, cop, 13);
    // Arrest: only from a near-stopped car, after a 1.5 s hold.
    if (pc && Math.abs(pc.speed) < 30 && d < 52 && state.wanted > 0) {
      cop.arrestTimer += dt;
      if (cop.arrestTimer >= 1.5) {
        state.mode = 'busted';
        state.endReason = 'busted';
        sfx.arrest();
        saveBest(state);
        return;
      }
    } else {
      cop.arrestTimer = Math.max(0, cop.arrestTimer - dt * 2);
    }
    // Punch the player on foot.
    if (!pc && d < 30 && cop.punchCooldown <= 0) {
      cop.punchCooldown = 0.9;
      hurtPlayer(state, 8, cop);
      addWanted(state, 0, 'resisting');
    }
  }
  state.cops = state.cops.filter((c) => c.health > 0);

  // Police cars chase and ram.
  for (const car of state.cars) {
    if (car.driver !== 'police') continue;
    car.ramCooldown = Math.max(0, car.ramCooldown - dt);
    car.backoffTimer = Math.max(0, car.backoffTimer - dt);
    const type = CAR_TYPES.police;
    const targetAngle = Math.atan2(p.y - car.y, p.x - car.x);
    if (car.backoffTimer > 0) {
      car.speed = Math.max(-160, car.speed - 300 * dt);
      car.angle += angleDiff(car.angle, targetAngle + Math.PI) * Math.min(1, dt * 2);
    } else {
      car.angle += clamp(angleDiff(car.angle, targetAngle), -type.steer * dt, type.steer * dt);
      car.speed = Math.min(type.topSpeed, car.speed + type.accel * dt);
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (resolveBuildingCollision(state.city, car, 26)) car.speed *= 0.4;
    if (isWater(car.x, car.y)) car.speed *= -0.3;
  }

  // Wanted decays while the player hides; faster when no cop can see them.
  const anyCopNear = state.cops.some((c) => dist(c.x, c.y, p.x, p.y) < 520)
    || state.cars.some((c) => c.driver === 'police' && dist(c.x, c.y, p.x, p.y) < 520);
  if (state.wanted > 0) {
    state.hideTimer += dt;
    const decay = WANTED.decayPerSecond + (anyCopNear ? 0 : WANTED.hideBonus);
    if (state.hideTimer > 4) state.wanted = Math.max(0, state.wanted - decay * dt);
  } else {
    state.hideTimer = 0;
  }
  state.wantedFlash = Math.max(0, state.wantedFlash - dt);
  const sirenNear = state.cars.some((c) => c.driver === 'police' && dist(c.x, c.y, p.x, p.y) < 700);
  sirenSound(sirenNear && state.wanted > 0, dt);
}

/** Thugs: chase the player, punch up close, shoot from a distance. */
export function updateThugs(state, dt) {
  const p = state.player;
  for (const thug of state.thugs) {
    if (thug.health <= 0) continue;
    thug.punchCooldown = Math.max(0, thug.punchCooldown - dt);
    thug.shootCooldown = Math.max(0, thug.shootCooldown - dt);
    const d = dist(thug.x, thug.y, p.x, p.y);
    const targetAngle = Math.atan2(p.y - thug.y, p.x - thug.x);
    thug.angle += angleDiff(thug.angle, targetAngle) * Math.min(1, dt * 5);
    if (d > 60) {
      thug.x += Math.cos(thug.angle) * thug.speed * dt;
      thug.y += Math.sin(thug.angle) * thug.speed * dt;
    }
    resolveBuildingCollision(state.city, thug, 13);
    if (d < 34 && thug.punchCooldown <= 0) {
      thug.punchCooldown = 0.8;
      hurtPlayer(state, 10, thug);
      sfx.punch();
    } else if (thug.shooter && d > 120 && d < 420 && thug.shootCooldown <= 0) {
      thug.shootCooldown = 1.6;
      state.bullets.push({
        x: thug.x + Math.cos(thug.angle) * 24,
        y: thug.y + Math.sin(thug.angle) * 24,
        vx: Math.cos(thug.angle) * 620,
        vy: Math.sin(thug.angle) * 620,
        life: 0.8, from: 'enemy', damage: 9,
      });
      sfx.shoot();
    }
  }
  state.thugs = state.thugs.filter((t) => t.health > 0);
}

export function spawnThug(state, x, y, shooter) {
  const thug = {
    id: nextId += 1,
    x, y, angle: 0, speed: 150, health: 60,
    color: THUG_COLORS[Math.floor(Math.random() * THUG_COLORS.length)],
    shooter: !!shooter,
    punchCooldown: 0, shootCooldown: 1,
  };
  state.thugs.push(thug);
  return thug;
}

/** Bullets fly, spark on walls, hurt whoever they hit. */
export function updateBullets(state, dt) {
  const p = state.player;
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (hitBuilding(state.city, b.x, b.y, 2)) {
      b.life = 0;
      addParticles(state, b.x, b.y, 4, '#ffd24b', 140, 0.25);
      continue;
    }
    if (b.from === 'player') {
      const check = (list, onHit) => {
        for (const e of list) {
          if (e.health > 0 && dist(b.x, b.y, e.x, e.y) < 18) {
            e.health -= b.damage;
            b.life = 0;
            addParticles(state, b.x, b.y, 8, '#ff6b5e', 180, 0.4);
            onHit(e);
            return true;
          }
        }
        return false;
      };
      if (check(state.thugs, () => { state.score += 25; })) continue;
      if (check(state.cops, () => { addWanted(state, WANTED.kill, 'shot an officer'); })) continue;
      if (check(state.peds, (e) => {
        e.state = 'flee';
        e.fleeTimer = 4;
        addWanted(state, WANTED.kill, 'shot a bystander');
      })) continue;
      for (const car of state.cars) {
        if (car.driver === 'player') continue;
        if (dist(b.x, b.y, car.x, car.y) < 40) {
          b.life = 0;
          damageCar(state, car, b.damage);
          addParticles(state, b.x, b.y, 6, '#ffd24b', 160, 0.3);
          break;
        }
      }
    } else {
      const pc = playerCar(state);
      if (pc) {
        if (dist(b.x, b.y, pc.x, pc.y) < 42) {
          b.life = 0;
          damageCar(state, pc, b.damage);
          continue;
        }
      } else if (dist(b.x, b.y, p.x, p.y) < 16) {
        b.life = 0;
        hurtPlayer(state, b.damage, null);
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

/** Hurt the player: flash, shake, and wasted when health runs out. */
export function hurtPlayer(state, amount, from) {
  const p = state.player;
  if (state.mode !== 'play' || p.health <= 0) return;
  p.health -= amount;
  state.hurtFlash = 0.6;
  state.shake = Math.max(state.shake, 5);
  sfx.hit();
  addParticles(state, p.x, p.y, 8, '#ff6b5e', 160, 0.4);
  if (p.health <= 0) {
    p.health = 0;
    state.mode = 'wasted';
    state.endReason = 'wasted';
    sfx.fail();
    saveBest(state);
  }
}

export function saveBest(state) {
  const score = Math.max(state.score, state.bestScore || 0);
  state.bestScore = score;
  try {
    const save = JSON.parse(localStorage.getItem('sunset-harbor-save-v1') || '{}');
    save.bestScore = score;
    save.cash = state.player.cash;
    save.missionsDone = state.missionsDone;
    localStorage.setItem('sunset-harbor-save-v1', JSON.stringify(save));
  } catch {
    // Storage unavailable (private mode): the game still plays.
  }
}

/** Particles and skid marks age out. */
export function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= (1 - 2 * dt);
    pt.vy *= (1 - 2 * dt);
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const s of state.skids) s.life -= dt;
  state.skids = state.skids.filter((s) => s.life > 0);
  for (const drop of state.pickups) drop.bob += dt * 3;
}

/** Advance the world clock (traffic lights) every frame. */
export function updateWorldClock(state, dt) {
  stepLights(state.city, dt);
  state.time += dt;
}
