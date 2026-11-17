// Sunset Harbor — cars: creation, traffic AI, and arcade driving physics.
// Traffic cars follow the road grid and stop at red lights; the player's car
// uses acceleration, steering, handbrake drift and collision damage.
// A car is {x, y, angle, speed, slide, type, spec, driver, health, ...}.
import { CAR_TYPES, ROAD_W, ROAD_X, ROAD_Y, TRAFFIC_COLORS } from './config.js';
import { clampToWorld, collideBuildings, isRoadAt, lightFor, lightNear, nearestRoadX, nearestRoadY } from './city.js';

let nextCarId = 1;

export function makeCar(type, x, y, angle, driver) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  const car = {
    id: nextCarId += 1,
    type,
    spec,
    x, y,
    angle,
    speed: 0,
    slide: 0, // lateral velocity, for handbrake drift
    driver: driver || 'traffic',
    color: type === 'police' ? spec.color : TRAFFIC_COLORS[(nextCarId * 7) % TRAFFIC_COLORS.length],
    health: 100,
    maxHealth: 100,
    wrecked: false,
    occupied: driver === 'traffic' || driver === 'police',
    // Traffic AI state: which road it is on and which way it is heading.
    roadAxis: 'x',
    roadLine: 0,
    roadDir: 1,
    cruise: 150 + Math.random() * 90,
    stuckTime: 0,
    brakeLight: false,
    sirenPhase: Math.random() * 10,
  };
  if (type === 'taxi') car.color = CAR_TYPES.taxi.color;
  if (type === 'sports') car.color = CAR_TYPES.sports.color;
  return car;
}

// Put a traffic car on a random road, heading along it, in the right lane.
export function spawnTrafficCar(rng) {
  const vertical = rng.chance(0.5);
  let x;
  let y;
  let angle;
  let axis;
  let line;
  let dir;
  if (vertical) {
    line = rng.pick(ROAD_X);
    dir = rng.chance(0.5) ? 1 : -1;
    x = line + (dir === 1 ? -ROAD_W / 4 : ROAD_W / 4);
    y = rng.range(120, 2200);
    angle = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    axis = 'x';
  } else {
    line = rng.pick(ROAD_Y);
    dir = rng.chance(0.5) ? 1 : -1;
    y = line + (dir === 1 ? -ROAD_W / 4 : ROAD_W / 4);
    x = rng.range(120, 3100);
    angle = dir === 1 ? 0 : Math.PI;
    axis = 'y';
  }
  const car = makeCar(rng.pick(['sedan', 'sedan', 'taxi', 'van', 'truck', 'sports']), x, y, angle, 'traffic');
  car.roadAxis = axis;
  car.roadLine = line;
  car.roadDir = dir;
  car.speed = car.cruise * rng.range(0.7, 1);
  return car;
}

// --- Traffic AI -----------------------------------------------------------
// Drive along the current road. At an intersection, sometimes turn. Stop for
// a red light ahead and for the car in front. Cars never leave the road.
export function updateTrafficCar(car, city, cars, dt, time, walker) {
  if (car.wrecked) {
    car.speed = 0;
    return;
  }
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const aheadX = car.x + forward.x * 52;
  const aheadY = car.y + forward.y * 52;

  // Red light ahead on this road: ease to a stop at the stop line.
  let wantSpeed = car.cruise;
  const light = lightNear(city, aheadX, aheadY, 70);
  if (light) {
    const state = lightFor(light, car.roadAxis, time);
    const distToLight = Math.hypot(light.x - car.x, light.y - car.y);
    if (state === 'red' && distToLight < 78) wantSpeed = 0;
  }
  // Car ahead in the same lane: match its speed.
  for (const other of cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * forward.x + dy * forward.y;
    const side = Math.abs(dx * -forward.y + dy * forward.x);
    if (along > 0 && along < 64 && side < 24) {
      wantSpeed = Math.min(wantSpeed, Math.max(0, other.speed - 20));
    }
  }
  // A person on foot right ahead: stop for them, like a real driver.
  if (walker && !walker.dead) {
    const dx = walker.x - car.x;
    const dy = walker.y - car.y;
    const along = dx * forward.x + dy * forward.y;
    const side = Math.abs(dx * -forward.y + dy * forward.x);
    if (along > 0 && along < 58 && side < 20) wantSpeed = 0;
  }

  // Ease toward the wanted speed.
  if (car.speed < wantSpeed) car.speed = Math.min(wantSpeed, car.speed + 240 * dt);
  else if (car.speed > wantSpeed) car.speed = Math.max(wantSpeed, car.speed - 420 * dt);

  // Lane keeping: steer gently back to the lane centre.
  const laneOffset = car.roadAxis === 'x'
    ? car.x - (car.roadLine + (car.roadDir === 1 ? -ROAD_W / 4 : ROAD_W / 4))
    : car.y - (car.roadLine + (car.roadDir === 1 ? -ROAD_W / 4 : ROAD_W / 4));
  const targetAngle = car.roadAxis === 'x'
    ? (car.roadDir === 1 ? Math.PI / 2 : -Math.PI / 2)
    : (car.roadDir === 1 ? 0 : Math.PI);
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += diff * Math.min(1, 3.2 * dt) - Math.sign(laneOffset) * 0.35 * dt * Math.min(1, Math.abs(laneOffset) / 20);

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // At an intersection, sometimes turn onto the cross road.
  const cross = car.roadAxis === 'x' ? ROAD_Y : ROAD_X;
  for (const line of cross) {
    const along = car.roadAxis === 'x' ? car.y : car.x;
    if (Math.abs(along - line) < 6 && car.speed > 40) {
      if (Math.random() < 0.22) {
        const newDir = Math.random() < 0.5 ? 1 : -1;
        if (car.roadAxis === 'x') {
          car.roadAxis = 'y';
          car.roadLine = line;
          car.roadDir = newDir;
          car.y = line + (newDir === 1 ? -ROAD_W / 4 : ROAD_W / 4);
        } else {
          car.roadAxis = 'x';
          car.roadLine = line;
          car.roadDir = newDir;
          car.x = line + (newDir === 1 ? -ROAD_W / 4 : ROAD_W / 4);
        }
      }
      break;
    }
  }
  clampToWorld(car, 24);
}

// --- Player driving -------------------------------------------------------
// Arcade feel: speed along the heading, a lateral slide that builds with the
// handbrake, steering that bites harder at low speed, and damage on hard hits.
export function drivePlayerCar(car, input, dt, world) {
  const spec = car.spec;
  // A wrecked car is dead metal: it coasts to a stop and answers nothing.
  if (car.wrecked) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 300 * dt);
    car.slide *= Math.max(0, 1 - 6 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    collideBuildings(world.city, car, 20);
    clampToWorld(car, 24);
    car.brakeLight = false;
    return 0;
  }
  const speedRatio = Math.abs(car.speed) / spec.topSpeed;
  let steering = input.steer();
  if (car.speed < 0) steering = -steering;

  const handbrake = input.handbrake();
  const grip = handbrake ? spec.grip * 0.35 : spec.grip;

  if (input.accelerate()) car.speed += spec.accel * dt * (car.speed < 0 ? 2.2 : 1);
  if (input.brake()) {
    if (car.speed > 8) car.speed -= spec.brake * dt;
    else car.speed -= spec.accel * 0.55 * dt; // reverse
  }
  if (!input.accelerate() && !input.brake()) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  }
  if (handbrake && Math.abs(car.speed) > 60) {
    car.speed -= Math.sign(car.speed) * 260 * dt;
    car.slide += steering * 260 * dt;
    if (world.addSkid) world.addSkid(car.x, car.y, car.angle);
  }
  car.speed = Math.max(-spec.topSpeed * 0.45, Math.min(spec.topSpeed, car.speed));

  // Steering: less bite at speed, more at a crawl; drift adds slide.
  const steerPower = spec.steer * (1.25 - Math.min(0.8, speedRatio * 0.8));
  car.angle += steering * steerPower * dt * (0.35 + Math.min(1, Math.abs(car.speed) / 160));
  car.slide *= Math.max(0, 1 - grip * dt);
  car.slide = Math.max(-140, Math.min(140, car.slide));

  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const px = -fy;
  const py = fx;
  car.x += (fx * car.speed + px * car.slide) * dt;
  car.y += (fy * car.speed + py * car.slide) * dt;

  const hitWall = collideBuildings(world.city, car, 20);
  if (hitWall) {
    if (Math.abs(car.speed) > 300) {
      damageCar(world, car, Math.abs(car.speed) * 0.03);
      world.shake = Math.min(14, world.shake + 6);
      if (world.audio) world.audio.crash();
    }
    car.speed *= 0.7;
    car.slide *= 0.4;
  }
  clampToWorld(car, 24);
  car.brakeLight = input.brake();
  return speedRatio;
}

// Push two cars apart and trade speed; returns true when they collided.
export function collideCars(a, b, world) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = 34;
  if (dist >= minDist || dist < 0.01) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  const push = (minDist - dist) / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const impact = Math.abs(a.speed - b.speed);
  const policeInvolved = a.type === 'police' || b.type === 'police';
  if (impact > 220 && !policeInvolved) {
    // A police ram pushes the player around but does not total their car:
    // the damage below is for traffic crashes only.
    damageCar(world, a, impact * 0.02);
    damageCar(world, b, impact * 0.02);
    if (world.audio && impact > 220) world.audio.crash();
    if (world.spawnSparks) world.spawnSparks((a.x + b.x) / 2, (a.y + b.y) / 2, 6);
  }
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.85;
  b.speed = avg * 0.85;
  return true;
}

export function damageCar(world, car, amount) {
  if (car.wrecked) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    if (world.spawnSmoke) world.spawnSmoke(car.x, car.y, 24);
  } else if (car.health < (car.maxHealth || 100) * 0.4 && world.spawnSmoke && Math.random() < 0.3) {
    world.spawnSmoke(car.x, car.y, 2);
  }
}

// Is this point close enough to a car to get in? Returns the nearest car.
export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export { isRoadAt, nearestRoadX, nearestRoadY };
