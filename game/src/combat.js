// Sunset Harbor — combat: the pistol, the punch, and the bullets in the air.
// Bullets fly straight, spark off buildings, and hurt whoever they touch:
// pedestrians, thugs, cops, or the player. Punching is a short arc in front
// of the player and knocks its target back a step.
import { PLAYER } from './config.js';
import { collideBuildings } from './city.js';
import { hurtPerson } from './people.js';
import { addWanted } from './police.js';

export function fireBullet(world, x, y, angle, owner, damage) {
  world.bullets.push({
    x, y,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    owner, // 'player' or 'enemy'
    damage: damage || PLAYER.pistolDamage,
    travelled: 0,
    alive: true,
  });
  world.muzzleFlash = 0.06;
  if (world.spawnMuzzle) world.spawnMuzzle(x, y, angle);
}

// Punch: everything living in a short arc in front of the player takes damage.
export function punch(world) {
  const player = world.player;
  if (player.punchCooldown > 0) return;
  player.punchCooldown = 0.38;
  player.punchAnim = 0.22;
  if (world.audio) world.audio.punch();
  const range = PLAYER.punchRange;
  const arc = PLAYER.punchArc;
  let hitAnyone = false;
  const targets = [...world.peds, ...world.cops];
  for (const target of targets) {
    if (!target.alive) continue;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d > range + 12) continue;
    let diff = Math.atan2(dy, dx) - player.aimAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > arc) continue;
    hitAnyone = true;
    const wasCop = target.kind === 'cop';
    const died = hurtPerson(target, PLAYER.punchDamage, world);
    // Shove the target away from the player.
    target.x += (dx / (d || 1)) * 14;
    target.y += (dy / (d || 1)) * 14;
    if (world.audio) world.audio.hit();
    if (wasCop) addWanted(world, 1, 'Assaulting an officer');
    else if (target.kind === 'ped') addWanted(world, WANTED_ASSAULT, 'Assault');
    if (died && target.kind === 'cop') addWanted(world, 1, 'Officer down');
    if (died && target.kind === 'ped') addWanted(world, 1, 'Pedestrian down');
  }
  // Punching a car door dents it too.
  for (const car of world.cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < 44) {
      hitAnyone = true;
      if (world.spawnSparks) world.spawnSparks(player.x + Math.cos(player.aimAngle) * 26, player.y + Math.sin(player.aimAngle) * 26, 3);
    }
  }
  if (hitAnyone && world.shake !== undefined) world.shake = Math.min(8, world.shake + 2);
}

const WANTED_ASSAULT = 1;

// Move every bullet one step and resolve what it hits.
export function updateBullets(world, dt) {
  for (const bullet of world.bullets) {
    if (!bullet.alive) continue;
    const stepX = bullet.vx * dt;
    const stepY = bullet.vy * dt;
    bullet.x += stepX;
    bullet.y += stepY;
    bullet.travelled += Math.hypot(stepX, stepY);
    if (bullet.travelled > PLAYER.bulletRange) {
      bullet.alive = false;
      continue;
    }
    // Buildings stop bullets with a spark.
    const probe = { x: bullet.x, y: bullet.y };
    if (collideBuildings(world.city, probe, 2)) {
      bullet.alive = false;
      if (world.spawnSparks) world.spawnSparks(bullet.x, bullet.y, 4);
      continue;
    }
    if (bullet.x < 0 || bullet.y < 0 || bullet.x > world.cityWidth || bullet.y > world.cityHeight) {
      bullet.alive = false;
      continue;
    }
    if (bullet.owner === 'player') {
      let hit = false;
      for (const target of [...world.peds, ...world.cops]) {
        if (!target.alive) continue;
        if (Math.hypot(target.x - bullet.x, target.y - bullet.y) < 14) {
          const wasCop = target.kind === 'cop';
          const died = hurtPerson(target, bullet.damage, world);
          if (wasCop) addWanted(world, 2, 'Shooting an officer');
          else if (target.kind === 'thug') addWanted(world, 0, '');
          else addWanted(world, 1, 'Shooting a pedestrian');
          if (died && target.kind === 'ped') addWanted(world, 1, 'Pedestrian down');
          if (died && target.kind === 'cop') addWanted(world, 1, 'Officer down');
          if (died && target.kind === 'thug') world.onThugDown?.(target);
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const car of world.cars) {
          if (car.wrecked) continue;
          if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < 24) {
            if (world.spawnSparks) world.spawnSparks(bullet.x, bullet.y, 3);
            hit = true;
            break;
          }
        }
      }
      if (hit) bullet.alive = false;
    } else {
      // Enemy bullets only threaten the player.
      const player = world.player;
      if (!player.dead && Math.hypot(player.x - bullet.x, player.y - bullet.y) < 14) {
        bullet.alive = false;
        world.damagePlayer(bullet.damage * 0.6, bullet.x, bullet.y);
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.alive);
}
