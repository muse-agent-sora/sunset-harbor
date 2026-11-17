// Sunset Harbor — tuning constants and world layout.
// Every number here is original to this build: the city is 3400 x 2600 world units,
// laid out on a street grid with a beach on the east edge and a harbor along the south.
export const WORLD = { width: 3400, height: 2600 };

export const VIEW = { width: 1280, height: 720 };

// Street grid: vertical and horizontal road centrelines. Road width 64, so blocks
// between roads are wide enough for buildings, parks and plazas.
export const ROADS_X = [200, 560, 920, 1280, 1640, 2000, 2360, 2720, 3080];
export const ROADS_Y = [200, 520, 840, 1160, 1480, 1800, 2120, 2400];
export const ROAD_HALF = 32;
export const LANE = 14;

// The beach strip (east) and the harbor water (south) frame the city.
export const BEACH_X = 3160;
export const HARBOR_Y = 2460;

// Six named districts, each a rectangle with its own flavour and palette hint.
export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 1100, h: 900, tint: '#e8c98a' },
  { name: 'Marina Bay', x: 1100, y: 0, w: 1100, h: 900, tint: '#9fc8d8' },
  { name: 'Palm Heights', x: 2200, y: 0, w: 1200, h: 900, tint: '#d8b48a' },
  { name: 'Dockside', x: 0, y: 900, w: 1100, h: 900, tint: '#b8a898' },
  { name: 'Downtown', x: 1100, y: 900, w: 1100, h: 900, tint: '#c8b8d8' },
  { name: 'Sunset Strip', x: 2200, y: 900, w: 1200, h: 900, tint: '#e8a878' },
  { name: 'Harborfront', x: 0, y: 1800, w: 3400, h: 800, tint: '#a8c0c8' },
];

// Player tuning.
export const PLAYER = {
  walkSpeed: 210,
  sprintSpeed: 330,
  radius: 14,
  maxHealth: 100,
  punchDamage: 18,
  punchRange: 42,
  punchArc: 1.1,
  pistolDamage: 34,
  magazine: 12,
  reloadSeconds: 1.1,
  bulletSpeed: 900,
};

// Car types: name, top speed, acceleration, steering, body colour set, toughness.
export const CAR_TYPES = {
  sedan:   { name: 'Sedan',    topSpeed: 430, accel: 300, steer: 2.6, grip: 3.2, health: 120, w: 46, l: 84 },
  coupe:   { name: 'Coupe',    topSpeed: 540, accel: 380, steer: 3.1, grip: 3.6, health: 100, w: 44, l: 80 },
  taxi:    { name: 'Taxi',     topSpeed: 450, accel: 320, steer: 2.7, grip: 3.3, health: 130, w: 46, l: 84 },
  truck:   { name: 'Truck',    topSpeed: 360, accel: 230, steer: 2.1, grip: 2.6, health: 200, w: 52, l: 104 },
  van:     { name: 'Van',      topSpeed: 390, accel: 250, steer: 2.2, grip: 2.8, health: 170, w: 50, l: 96 },
  police:  { name: 'Patrol',   topSpeed: 500, accel: 360, steer: 3.0, grip: 3.5, health: 160, w: 46, l: 84 },
  muscle:  { name: 'Muscle',   topSpeed: 580, accel: 420, steer: 2.9, grip: 3.1, health: 110, w: 48, l: 86 },
};
export const CAR_TYPE_KEYS = Object.keys(CAR_TYPES);

// Wanted level: how many police units respond and how fast heat decays.
export const WANTED = {
  max: 5,
  decayPerSecond: 0.045,
  hideBonus: 0.06, // extra decay while no cop can see the player
  stealOccupied: 1,
  assault: 1,
  shooting: 1,
  speedingNearCop: 0.4,
  kill: 1,
};

// Mission rewards and the fixer who hires the player.
export const FIXER_NAME = 'Marla';
export const DRIVER_NAME = 'Rook';
export const MISSION_REWARDS = [150, 250, 400, 600, 1000];

// Save key and screenshot staging.
export const SAVE_KEY = 'sunset-harbor-save-v1';
export const SHOT_SEED_DEFAULT = 7;

// Golden-hour palette.
export const PALETTE = {
  sky: '#f7b267',
  grass: '#7fae62',
  sand: '#e8d39a',
  water: '#3f7d9e',
  road: '#3c3a44',
  roadEdge: '#2a2830',
  sidewalk: '#9a938a',
  buildingRoof: '#8a6f5c',
  buildingRoof2: '#6f7f8a',
  buildingRoof3: '#a8845c',
  park: '#6da85e',
  hud: '#f5e9d0',
};
