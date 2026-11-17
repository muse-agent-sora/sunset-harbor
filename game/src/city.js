// Sunset Harbor — the city itself: a road grid, buildings, parks, trees,
// a beach, a harbor with piers, and traffic lights. Built once from a seed.
// This module also answers the spatial questions the rest of the game asks:
// is this point on a road, does this circle hit a building, what is the
// traffic light doing at this intersection.
import { BEACH_TOP, COLORS, DISTRICTS, HARBOR_LEFT, ROAD_W, ROAD_X, ROAD_Y, WATER_TOP, WORLD_H, WORLD_W } from './config.js';

export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const lights = [];
  const piers = [];

  // Traffic lights at every intersection, each with its own phase offset.
  for (let xi = 0; xi < ROAD_X.length; xi += 1) {
    for (let yi = 0; yi < ROAD_Y.length; yi += 1) {
      lights.push({ x: ROAD_X[xi], y: ROAD_Y[yi], offset: (xi * 2.3 + yi * 3.1) % 8, period: 8 });
    }
  }

  // Buildings fill the blocks between roads. Each block gets 1-3 buildings
  // with a roof colour, a wall colour and a seeded height for the skyline.
  for (let xi = 0; xi < ROAD_X.length - 1; xi += 1) {
    for (let yi = 0; yi < ROAD_Y.length - 1; yi += 1) {
      const bx0 = ROAD_X[xi] + ROAD_W / 2 + 14;
      const by0 = ROAD_Y[yi] + ROAD_W / 2 + 14;
      const bx1 = ROAD_X[xi + 1] - ROAD_W / 2 - 14;
      const by1 = ROAD_Y[yi + 1] - ROAD_W / 2 - 14;
      const bw = bx1 - bx0;
      const bh = by1 - by0;
      if (bw < 60 || bh < 60) continue;
      // A few blocks are parks instead of buildings.
      if (rng.chance(0.14)) {
        parks.push({ x: bx0, y: by0, w: bw, h: bh });
        const treeCount = Math.floor((bw * bh) / 9000);
        for (let t = 0; t < treeCount; t += 1) {
          trees.push({ x: rng.range(bx0 + 14, bx1 - 14), y: rng.range(by0 + 14, by1 - 14), r: rng.range(7, 12) });
        }
        continue;
      }
      const count = rng.int(1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(70, Math.max(72, bw / count - 16));
        const h = rng.range(60, Math.max(62, bh - 20));
        const x = bx0 + (b * bw) / count + rng.range(4, Math.max(5, bw / count - w - 4));
        const y = by0 + rng.range(4, Math.max(5, bh - h - 4));
        const ci = rng.int(0, COLORS.buildingRoof.length - 1);
        buildings.push({
          x, y, w, h,
          roof: COLORS.buildingRoof[ci],
          wall: COLORS.buildingWall[ci],
          height: rng.int(1, 4),
          windows: rng.int(2, 5),
        });
      }
      // Street trees along the block edge.
      if (rng.chance(0.6)) {
        trees.push({ x: bx0 + 8, y: by0 + 8, r: 8 });
        trees.push({ x: bx1 - 8, y: by1 - 8, r: 8 });
      }
    }
  }

  // Harbor piers jutting into the water on the east edge.
  for (let i = 0; i < 3; i += 1) {
    piers.push({ x: HARBOR_LEFT - 10, y: 700 + i * 520, w: 150, h: 34 });
  }
  // A few boats moored in the harbor.
  const boats = [];
  for (let i = 0; i < 5; i += 1) {
    boats.push({ x: rng.range(HARBOR_LEFT + 30, WORLD_W - 60), y: rng.range(500, 2200), angle: rng.range(-0.4, 0.4), color: rng.pick(['#d8d8d8', '#c23b3b', '#4f7fb8']) });
  }
  // Beach umbrellas and palms along the sand.
  const palms = [];
  for (let i = 0; i < 14; i += 1) {
    palms.push({ x: rng.range(80, WORLD_W - 220), y: rng.range(BEACH_TOP + 20, WATER_TOP - 30), r: rng.range(8, 11) });
  }

  return {
    buildings, trees, parks, lights, piers, boats, palms,
    districts: DISTRICTS,
    // Hand-picked landmarks the missions use.
    landmarks: {
      garage: { x: 680, y: 560, label: 'Sunset Garage' },
      marina: { x: 2680, y: 1520, label: 'Marina' },
      safehouse: { x: 280, y: 1840, label: 'Safehouse' },
      docks: { x: 3060, y: 1200, label: 'The Docks' },
      plaza: { x: 1480, y: 1200, label: 'Harbor Plaza' },
      beach: { x: 1480, y: 2320, label: 'Sunset Beach' },
    },
  };
}

// True when the point is on asphalt (inside a road band, not in the water).
export function isRoadAt(x, y) {
  if (y > BEACH_TOP || x > HARBOR_LEFT) return false;
  for (const rx of ROAD_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

// True when the point is inside a road band in the given direction.
export function onRoadAxis(x, y, axis) {
  if (axis === 'x') {
    for (const rx of ROAD_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  } else {
    for (const ry of ROAD_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  }
  return false;
}

// Nearest road centre line to a point, used to snap wandering cars back on course.
export function nearestRoadX(x) {
  let best = ROAD_X[0];
  for (const rx of ROAD_X) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}
export function nearestRoadY(y) {
  let best = ROAD_Y[0];
  for (const ry of ROAD_Y) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

// Traffic light state for a car travelling along `axis` ('x' = vertical road,
// 'y' = horizontal road) at this moment in the game clock.
export function lightFor(light, axis, time) {
  const phase = (time + light.offset) % light.period;
  const nsGreen = phase < light.period / 2;
  if (axis === 'x') return nsGreen ? 'green' : 'red';
  return nsGreen ? 'red' : 'green';
}

// Find the light at an intersection near (x, y), if any.
export function lightNear(city, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const light of city.lights) {
    const d = Math.hypot(light.x - x, light.y - y);
    if (d < bestD) {
      bestD = d;
      best = light;
    }
  }
  return best;
}

// Push a circle out of every building it overlaps; returns true on a hit.
export function collideBuildings(city, body, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * radius;
      body.y = cy + (dy / d) * radius;
    } else {
      body.y = b.y - radius;
    }
  }
  return hit;
}

// Keep a body inside the walkable world (not in the water, not off the map).
export function clampToWorld(body, radius) {
  let clamped = false;
  if (body.x < radius + 8) { body.x = radius + 8; clamped = true; }
  if (body.x > WORLD_W - radius - 8) { body.x = WORLD_W - radius - 8; clamped = true; }
  if (body.y < radius + 8) { body.y = radius + 8; clamped = true; }
  if (body.y > WATER_TOP - radius - 6) { body.y = WATER_TOP - radius - 6; clamped = true; }
  return clamped;
}

export { WORLD_H, WORLD_W };
