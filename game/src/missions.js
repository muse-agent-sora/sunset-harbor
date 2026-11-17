// Sunset Harbor — missions and the story. Marla, a fixer who runs jobs out of a
// Downtown parking garage, hires the driver Rook. Five chained jobs escalate from
// a simple courier run to a harbor finale, plus free-roam side work: cash drops
// and a timed checkpoint run. Each mission is a list of objectives the game walks
// through one at a time; the HUD always shows the current one.
import { MISSION_REWARDS, FIXER_NAME, DRIVER_NAME } from './config.js';
import { dist, money } from './rng.js';
import { addWanted, spawnThug, makeCar, playerCar } from './entities.js';
import { sfx } from './audio.js';

// Mission marker positions: east leg, then south leg, then the rest of the city.
const MARK = {
  depot: { x: 1280, y: 1160 },
  eastGate: { x: 2900, y: 840 },
  southPier: { x: 2360, y: 2300 },
  marinaContact: { x: 1640, y: 520 },
  docksideDrop: { x: 560, y: 1480 },
  courierStart: { x: 2000, y: 1800 },
  downtownBlock: { x: 1640, y: 1160 },
  harborPier: { x: 1980, y: 2520 },
  checkpointStart: { x: 1280, y: 840 },
};

export const MISSIONS = [
  {
    id: 1,
    title: 'First Delivery',
    brief: `${FIXER_NAME}: "${DRIVER_NAME}, a parcel needs legs. East gate first, then the south pier. Drive like you mean it."`,
    reward: MISSION_REWARDS[0],
    objectives: [
      { type: 'goto', x: MARK.eastGate.x, y: MARK.eastGate.y, radius: 70, label: 'Drive to the east gate' },
      { type: 'goto', x: MARK.southPier.x, y: MARK.southPier.y, radius: 70, label: 'Drive south to the pier drop' },
      { type: 'deliver', x: MARK.southPier.x, y: MARK.southPier.y, radius: 70, label: 'Deliver the parcel' },
    ],
  },
  {
    id: 2,
    title: 'The Pickup',
    brief: `${FIXER_NAME}: "A client is waiting in Marina Bay. Pick them up, then take them to Dockside. No detours."`,
    reward: MISSION_REWARDS[1],
    objectives: [
      { type: 'goto', x: MARK.marinaContact.x, y: MARK.marinaContact.y, radius: 70, label: 'Pick up the client in Marina Bay' },
      { type: 'wait', x: MARK.marinaContact.x, y: MARK.marinaContact.y, radius: 80, seconds: 3, label: 'Wait for the client to get in' },
      { type: 'goto', x: MARK.docksideDrop.x, y: MARK.docksideDrop.y, radius: 70, label: 'Drive the client to Dockside' },
      { type: 'deliver', x: MARK.docksideDrop.x, y: MARK.docksideDrop.y, radius: 70, label: 'Drop off the client' },
    ],
  },
  {
    id: 3,
    title: 'Tail the Courier',
    brief: `${FIXER_NAME}: "A courier skipped out with my money. Stay on his tail until he gives up — or nudge him off the road."`,
    reward: MISSION_REWARDS[2],
    objectives: [
      { type: 'chase', x: MARK.courierStart.x, y: MARK.courierStart.y, radius: 260, seconds: 10, label: 'Stay on the courier for 10 seconds' },
    ],
  },
  {
    id: 4,
    title: 'Clear the Block',
    brief: `${FIXER_NAME}: "A crew is shaking down my drivers in Downtown. Send them a message. All three of them."`,
    reward: MISSION_REWARDS[3],
    objectives: [
      { type: 'takedown', x: MARK.downtownBlock.x, y: MARK.downtownBlock.y, radius: 320, count: 3, label: 'Deal with the crew (0/3)' },
    ],
  },
  {
    id: 5,
    title: 'The Harbor Run',
    brief: `${FIXER_NAME}: "Last one, ${DRIVER_NAME}. The whole harbor is hot — three stars and climbing. Get the package to the pier anyway."`,
    reward: MISSION_REWARDS[4],
    objectives: [
      { type: 'goto', x: MARK.harborPier.x, y: MARK.harborPier.y, radius: 80, label: 'Reach the harbor pier — the police are coming' },
      { type: 'deliver', x: MARK.harborPier.x, y: MARK.harborPier.y, radius: 80, label: 'Hand over the package' },
    ],
  },
];

/** Start mission `index` (0-based). Sets the first objective and the intro text. */
export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return;
  state.mission.index = index;
  state.mission.stage = 0;
  state.mission.stageTimer = 0;
  state.mission.chaseTimer = 0;
  state.mission.targetCar = null;
  state.mission.takedownLeft = 0;
  state.mission.active = true;
  state.mission.intro = def.brief;
  state.mission.introTimer = 6;
  state.message = `Mission ${def.id}: ${def.title}`;
  state.messageTimer = 4;
  sfx.mission();
  if (def.id === 3) {
    // The fleeing courier: a fast car that runs from the player.
    const car = makeCar(MARK.courierStart.x, MARK.courierStart.y, 0, 'muscle', 'mission', '#e07840');
    car.speed = 200;
    state.cars.push(car);
    state.mission.targetCar = car;
  }
  if (def.id === 4) {
    const spots = [
      { x: MARK.downtownBlock.x - 80, y: MARK.downtownBlock.y - 40 },
      { x: MARK.downtownBlock.x + 60, y: MARK.downtownBlock.y + 30 },
      { x: MARK.downtownBlock.x + 10, y: MARK.downtownBlock.y - 90 },
    ];
    for (const s of spots) spawnThug(state, s.x, s.y, false);
    state.mission.takedownLeft = 3;
  }
  if (def.id === 5) {
    addWanted(state, 3, 'the harbor run');
  }
}

/** The current objective, or null when no mission is running. */
export function currentObjective(state) {
  if (!state.mission.active) return null;
  const def = MISSIONS[state.mission.index];
  if (!def) return null;
  return def.objectives[state.mission.stage] || null;
}

/** The marker the HUD and minimap should point at, or null. */
export function missionMarker(state) {
  const obj = currentObjective(state);
  if (!obj) return null;
  if (obj.type === 'chase' && state.mission.targetCar) {
    return { x: state.mission.targetCar.x, y: state.mission.targetCar.y, label: obj.label };
  }
  return { x: obj.x, y: obj.y, label: obj.label };
}

/** Advance the active mission one frame. */
export function updateMission(state, dt) {
  if (!state.mission.active) return;
  const def = MISSIONS[state.mission.index];
  const obj = def.objectives[state.mission.stage];
  if (!obj) return;
  const p = state.player;
  state.mission.stageTimer += dt;

  if (obj.type === 'goto' || obj.type === 'deliver') {
    if (dist(p.x, p.y, obj.x, obj.y) < obj.radius) {
      advanceStage(state);
    }
  } else if (obj.type === 'wait') {
    if (dist(p.x, p.y, obj.x, obj.y) < obj.radius) {
      state.mission.waitProgress = (state.mission.waitProgress || 0) + dt;
      if (state.mission.waitProgress >= obj.seconds) {
        state.mission.waitProgress = 0;
        state.message = 'The client is in. Go!';
        state.messageTimer = 2;
        sfx.checkpoint();
        advanceStage(state);
      }
    } else {
      state.mission.waitProgress = 0;
    }
  } else if (obj.type === 'chase') {
    const target = state.mission.targetCar;
    if (!target || target.health <= 0) {
      advanceStage(state);
      return;
    }
    // The courier flees: steer away from the player, keep to the roads.
    const away = Math.atan2(target.y - p.y, target.x - p.x);
    const want = away + Math.sin(state.time * 0.7) * 0.4;
    let diff = want - target.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    target.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    target.speed = Math.min(520, target.speed + 260 * dt);
    target.x += Math.cos(target.angle) * target.speed * dt;
    target.y += Math.sin(target.angle) * target.speed * dt;
    target.x = Math.max(80, Math.min(3300, target.x));
    target.y = Math.max(80, Math.min(2380, target.y));
    const d = dist(p.x, p.y, target.x, target.y);
    if (d < obj.radius) {
      state.mission.chaseTimer += dt;
      if (state.mission.chaseTimer >= obj.seconds) {
        state.message = 'He gave up — the money is yours.';
        state.messageTimer = 3;
        advanceStage(state);
      }
    } else {
      state.mission.chaseTimer = Math.max(0, state.mission.chaseTimer - dt * 0.5);
    }
  } else if (obj.type === 'takedown') {
    const left = state.thugs.filter((t) => t.health > 0).length;
    state.mission.takedownLeft = left;
    obj.label = `Deal with the crew (${3 - left}/3)`;
    if (left <= 0) advanceStage(state);
  }
}

function advanceStage(state) {
  const def = MISSIONS[state.mission.index];
  state.mission.stage += 1;
  state.mission.stageTimer = 0;
  sfx.checkpoint();
  if (state.mission.stage >= def.objectives.length) {
    completeMission(state, def);
  } else {
    const next = def.objectives[state.mission.stage];
    state.message = next.label;
    state.messageTimer = 3;
  }
}

function completeMission(state, def) {
  const p = state.player;
  p.cash += def.reward;
  state.score += def.reward * 2 + 100;
  state.missionsDone += 1;
  state.mission.active = false;
  state.mission.index = -1;
  state.mission.stage = 0;
  state.splash = {
    title: 'JOB COMPLETE',
    subtitle: `${def.title} — ${money(def.reward)} earned`,
    timer: 3.2,
  };
  sfx.mission();
  // The next job unlocks automatically after a breather.
  state.nextMissionTimer = 5;
  if (def.id === 5) {
    state.mode = 'gameover';
    state.endReason = 'complete';
    saveBest(state);
  }
  saveBest(state);
}

/** Offer the next mission after the breather, if the player is free-roaming. */
export function offerNextMission(state, dt) {
  if (state.mission.active) return;
  if (state.missionsDone >= MISSIONS.length) return;
  if (state.nextMissionTimer > 0) {
    state.nextMissionTimer -= dt;
    if (state.nextMissionTimer <= 0) {
      startMission(state, state.missionsDone);
    }
  }
}

/** The timed checkpoint run: rings the player drives through for a bonus. */
export function updateSideJob(state, dt) {
  const job = state.sideJob;
  if (!job.active) {
    // Driving through the start ring kicks it off.
    const p = state.player;
    if (dist(p.x, p.y, MARK.checkpointStart.x, MARK.checkpointStart.y) < 60 && playerCar(state)) {
      startSideJob(state);
    }
    return;
  }
  job.timer -= dt;
  const p = state.player;
  const ring = job.rings[job.index];
  if (ring && dist(p.x, p.y, ring.x, ring.y) < 70) {
    job.index += 1;
    p.cash += 20;
    state.score += 20;
    sfx.checkpoint();
    state.message = `Checkpoint ${job.index}/${job.rings.length} — +$20`;
    state.messageTimer = 2;
    if (job.index >= job.rings.length) {
      p.cash += 200;
      state.score += 200;
      state.splash = { title: 'CHECKPOINT RUN DONE', subtitle: '+$200 bonus', timer: 2.5 };
      sfx.mission();
      job.active = false;
      return;
    }
  }
  if (job.timer <= 0) {
    job.active = false;
    state.message = 'Checkpoint run timed out';
    state.messageTimer = 2;
  }
}

function startSideJob(state) {
  const rng = state.rng;
  const rings = [];
  let x = MARK.checkpointStart.x;
  let y = MARK.checkpointStart.y;
  for (let i = 0; i < 5; i += 1) {
    x = Math.max(300, Math.min(3000, x + rng.range(-500, 700)));
    y = Math.max(300, Math.min(2200, y + rng.range(-400, 500)));
    rings.push({ x, y });
  }
  state.sideJob = { active: true, index: 0, timer: 60, rings };
  state.message = 'Checkpoint run! Hit all 5 rings in 60 seconds';
  state.messageTimer = 3;
  sfx.mission();
}

// Re-exported for main.js's save helper (kept here so missions own the economy).
function saveBest(state) {
  try {
    const save = JSON.parse(localStorage.getItem('sunset-harbor-save-v1') || '{}');
    save.bestScore = Math.max(state.score, state.bestScore || 0);
    save.cash = state.player.cash;
    save.missionsDone = state.missionsDone;
    localStorage.setItem('sunset-harbor-save-v1', JSON.stringify(save));
  } catch {
    // Storage unavailable: the game still plays.
  }
}
