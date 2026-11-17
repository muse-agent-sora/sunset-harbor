// Sunset Harbor — the city itself. Builds the street grid, the buildings that fill
// the blocks between roads, the parks, the beach, the harbor piers and the traffic
// lights, and answers the questions the rest of the game asks about the map:
// is this point on a road, does this circle hit a building, where can a car spawn.
import { WORLD, ROADS_X, ROADS_Y, ROAD_HALF, BEACH_X, HARBOR_Y, DISTRICTS, PALETTE } from './config.js';
import { makeRng, clamp } from './rng.js';

const ROOF_COLORS = [PALETTE.buildingRoof, PALETTE.buildingRoof2, PALETTE.buildingRoof3, '#7d6a8a', '#5c7a6a'];

/**
 * Build the city from a seed. Returns an object with:
 *  buildings: [{x, y, w, h, color, height, district}]
 *  parks:     [{x, y, w, h}]
 *  piers:     [{x, y, w, h}] (wooden piers reaching into the harbor)
 *  lights:    [{x, y, phase, timer}] traffic lights at busy intersections
 *  spawn:     {player: {x, y}, cars: [{x, y, angle}], peds: [...]}
 */
export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];

  // Walk the grid of blocks between neighbouring roads and fill each block.
  for (let ix = 0; ix < ROADS_X.length - 1; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy += 1) {
      const bx = ROADS_X[ix] + ROAD_HALF + 10;
      const by = ROADS_Y[iy] + ROAD_HALF + 10;
      const bw = ROADS_X[ix + 1] - ROADS_X[ix] - ROAD_HALF * 2 - 20;
      const bh = ROADS_Y[iy + 1] - ROADS_Y[iy] - ROAD_HALF * 2 - 20;
      if (bw < 60 || bh < 60) continue;
      // The beach blocks (east of the last road) and harbor blocks stay open.
      if (bx > BEACH_X - 120 || by > HARBOR_Y - 120) continue;
      // One block in five is a park instead of buildings.
      if (rng.chance(0.2)) {
        parks.push({ x: bx, y: by, w: bw, h: bh });
        continue;
      }
      // Split the block into 2-4 buildings with a small gap between them.
      const cols = rng.int(1, 2);
      const rows = rng.int(1, 2);
      const gap = 14;
      const cw = (bw - gap * (cols - 1)) / cols;
      const ch = (bh - gap * (rows - 1)) / rows;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const w = cw * rng.range(0.72, 0.96);
          const h = ch * rng.range(0.72, 0.96);
          const x = bx + cx * (cw + gap) + (cw - w) / 2;
          const y = by + cy * (ch + gap) + (ch - h) / 2;
          buildings.push({
            x, y, w, h,
            color: rng.pick(ROOF_COLORS),
            height: rng.int(1, 4),
            district: districtAt(x + w / 2, y + h / 2).name,
          });
        }
      }
    }
  }

  // Harbor piers: wooden walkways jutting south into the water.
  const piers = [
    { x: 420, y: HARBOR_Y - 10, w: 26, h: 150 },
    { x: 1180, y: HARBOR_Y - 10, w: 26, h: 190 },
    { x: 1980, y: HARBOR_Y - 10, w: 26, h: 150 },
    { x: 2760, y: HARBOR_Y - 10, w: 26, h: 190 },
  ];

  // Traffic lights at the busiest intersections (every other crossing).
  const lights = [];
  for (let ix = 1; ix < ROADS_X.length - 1; ix += 2) {
    for (let iy = 1; iy < ROADS_Y.length - 1; iy += 2) {
      lights.push({ x: ROADS_X[ix], y: ROADS_Y[iy], phase: rng.int(0, 1), timer: rng.range(0, 6) });
    }
  }

  // Player starts on foot outside the Downtown parking garage, near a parked car.
  const spawn = {
    player: { x: 1280, y: 1160 + 60 },
    cars: [],
    peds: [],
  };
  // A ring of parked cars near the spawn, plus scattered ones on roads.
  const parkedSpots = [
    { x: 1280 - 46, y: 1160 + 60, angle: 0 },
    { x: 1280 + 46, y: 1160 + 60, angle: Math.PI },
    { x: 1640 - 46, y: 840 + 60, angle: Math.PI / 2 },
    { x: 920 + 46, y: 1480 - 60, angle: -Math.PI / 2 },
    { x: 2000 - 46, y: 1160 - 60, angle: 0 },
    { x: 2360 + 46, y: 1800 + 60, angle: Math.PI },
  ];
  for (const spot of parkedSpots) spawn.cars.push(spot);
  for (let i = 0; i < 26; i += 1) {
    const vertical = rng.chance(0.5);
    if (vertical) {
      const road = rng.pick(ROADS_X);
      spawn.cars.push({
        x: road + (rng.chance(0.5) ? -14 : 14),
        y: rng.range(120, WORLD.height - 200),
        angle: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2,
      });
    } else {
      const road = rng.pick(ROADS_Y);
      spawn.cars.push({
        x: rng.range(120, WORLD.width - 260),
        y: road + (rng.chance(0.5) ? -14 : 14),
        angle: rng.chance(0.5) ? 0 : Math.PI,
      });
    }
  }
  for (let i = 0; i < 40; i += 1) {
    spawn.peds.push({
      x: rng.range(150, WORLD.width - 300),
      y: rng.range(150, HARBOR_Y - 60),
    });
  }

  return { buildings, parks, piers, lights, spawn, seed };
}

/** The district whose rectangle contains (x, y), or the last one as a fallback. */
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

/** True when (x, y) is on a road (within half the road width of a centreline). */
export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  return false;
}

/** True when (x, y) is on the beach sand or in the harbor water. */
export function isBeach(x, y) {
  return x >= BEACH_X && y < HARBOR_Y;
}
export function isWater(x, y) {
  return y >= HARBOR_Y;
}

/** The nearest road centreline point to (x, y), used to snap wandering cars back. */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y: clamp(y, 100, WORLD.height - 100), vertical: true }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x: clamp(x, 100, WORLD.width - 200), y: ry, vertical: false }; }
  }
  return best;
}

/**
 * Circle-vs-buildings collision: returns the building hit by a circle at (x, y)
 * with radius r, or null. Piers and water are walkable for the player on foot
 * only at the piers themselves; cars treat water as a wall.
 */
export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

/** Push a circle out of any building it overlaps; returns true if it was pushed. */
export function resolveBuildingCollision(city, body, r) {
  const b = hitBuilding(city, body.x, body.y, r);
  if (!b) return false;
  const cx = clamp(body.x, b.x, b.x + b.w);
  const cy = clamp(body.y, b.y, b.y + b.h);
  let dx = body.x - cx;
  let dy = body.y - cy;
  let d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) {
    // Centre inside the rectangle: push out along the smallest penetration axis.
    const left = body.x - b.x;
    const right = b.x + b.w - body.x;
    const top = body.y - b.y;
    const bottom = b.y + b.h - body.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) { body.x = b.x - r; }
    else if (m === right) { body.x = b.x + b.w + r; }
    else if (m === top) { body.y = b.y - r; }
    else { body.y = b.y + b.h + r; }
    return true;
  }
  dx /= d;
  dy /= d;
  body.x = cx + dx * r;
  body.y = cy + dy * r;
  return true;
}

/** The traffic light at (or nearest to) an intersection, or null. */
export function lightAt(city, x, y) {
  for (const l of city.lights) {
    if (Math.abs(l.x - x) < 40 && Math.abs(l.y - y) < 40) return l;
  }
  return null;
}

/** Advance all traffic-light timers; phase 0 = north/south green, 1 = east/west green. */
export function stepLights(city, dt) {
  for (const l of city.lights) {
    l.timer += dt;
    if (l.timer > 6) {
      l.timer = 0;
      l.phase = 1 - l.phase;
    }
  }
}

/** Is the light green for travel along `vertical` roads at this intersection? */
export function lightGreenFor(light, vertical) {
  if (!light) return true;
  return vertical ? light.phase === 0 : light.phase === 1;
}
