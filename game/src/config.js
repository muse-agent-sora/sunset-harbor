// Sunset Harbor — shared constants for the open-world crime game.
// Everything here is tuning data: world size, road layout, car specs,
// wanted rules, and the save key. No game logic lives in this file.
export const STEP = 1 / 60;

export const WORLD_W = 3400;
export const WORLD_H = 2600;
export const ROAD_W = 72;
export const SIDEWALK = 46;

// Centre lines of the city's roads. The grid makes a real street network
// that traffic, police and the minimap all share.
export const ROAD_X = [280, 680, 1080, 1480, 1880, 2280, 2680, 3060];
export const ROAD_Y = [240, 560, 880, 1200, 1520, 1840, 2160];

// Water: the beach runs along the south edge, the harbor along the east.
export const BEACH_TOP = 2290;
export const WATER_TOP = 2450;
export const HARBOR_LEFT = 3200;

// Named districts, shown on the minimap and in mission text.
export const DISTRICTS = [
  { name: 'Uptown', x: 120, y: 80, w: 1500, h: 420, color: '#8a6fb8' },
  { name: 'Old Town', x: 120, y: 560, w: 760, h: 620, color: '#b8863f' },
  { name: 'Downtown', x: 1080, y: 560, w: 1200, h: 1000, color: '#4f7fb8' },
  { name: 'Marina', x: 2400, y: 560, w: 760, h: 1000, color: '#3f9fb0' },
  { name: 'The Docks', x: 3060, y: 560, w: 260, h: 1600, color: '#7a6a55' },
  { name: 'Beachside', x: 120, y: 1840, w: 2940, h: 420, color: '#c9a35f' },
];

// Palette: a sun-soaked coastal city at golden hour.
export const COLORS = {
  grass: '#7fae62',
  grassDark: '#6f9c54',
  park: '#5d9b4a',
  road: '#3c3f46',
  roadEdge: '#2e3036',
  lane: '#e8d98a',
  sidewalk: '#9aa0a8',
  sand: '#e8d29a',
  water: '#2f7fb8',
  waterDeep: '#256a9e',
  buildingRoof: ['#b0563f', '#7a6a8a', '#4f7a8a', '#8a6a4f', '#5f8a5f', '#96604a'],
  buildingWall: ['#c98a6a', '#a89ab8', '#7fa8b8', '#c9a878', '#8ab88a', '#b87a6a'],
  tree: '#3f7a35',
  treeLight: '#5a9a45',
};

// Car types: each drives differently, so stealing a sports car matters.
export const CAR_TYPES = {
  sedan: { name: 'Harbor Sedan', topSpeed: 430, accel: 300, brake: 520, steer: 2.6, grip: 8.0, color: '#4f7fb8', length: 46, width: 22 },
  sports: { name: 'Vortex GT', topSpeed: 580, accel: 420, brake: 620, steer: 3.1, grip: 9.5, color: '#c23b3b', length: 46, width: 21 },
  taxi: { name: 'City Cab', topSpeed: 450, accel: 310, brake: 540, steer: 2.7, grip: 8.2, color: '#e8b73a', length: 46, width: 22 },
  truck: { name: 'Flatbed Truck', topSpeed: 340, accel: 220, brake: 420, steer: 2.0, grip: 7.0, color: '#7a7f85', length: 58, width: 26 },
  van: { name: 'Delivery Van', topSpeed: 380, accel: 250, brake: 460, steer: 2.2, grip: 7.4, color: '#8a9a7a', length: 52, width: 24 },
  police: { name: 'Interceptor', topSpeed: 540, accel: 400, brake: 640, steer: 3.0, grip: 9.2, color: '#2a2f38', length: 48, width: 22 },
};

export const TRAFFIC_COLORS = ['#b0563f', '#4f7fb8', '#8a9a7a', '#c9a878', '#7a6a8a', '#5f8a5f', '#d8d8d8', '#3f3f46'];

// Player tuning.
export const PLAYER = {
  walkSpeed: 210,
  sprintSpeed: 330,
  radius: 13,
  maxHealth: 100,
  punchDamage: 18,
  punchRange: 34,
  punchArc: 1.1,
  pistolDamage: 34,
  pistolAmmo: 12,
  pistolReserve: 48,
  bulletSpeed: 900,
  bulletRange: 620,
};

// Wanted level rules.
export const WANTED = {
  max: 5,
  decayDelay: 6, // seconds with no crime and no police nearby before it drops
  decayInterval: 4, // seconds per star lost while hidden
  steal: 1,
  assault: 1,
  shoot: 2,
  kill: 2,
  speedingNearCop: 1,
};

// Police response by wanted level.
export const POLICE = {
  footCops: [0, 2, 3, 4, 6, 8],
  cars: [0, 0, 1, 2, 3, 4],
  arrestTime: 1.4,
  sightRange: 720,
};

// Scoring and saving.
export const SAVE_KEY = 'sunset-harbor-save-v1';
export const START_CASH = 120;

// Mission rewards (cash) in story order.
export const MISSION_REWARDS = [150, 250, 400, 600, 1000];

export const VIEW_W = 1280;
export const VIEW_H = 720;
