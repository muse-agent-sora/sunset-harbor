// Sunset Harbor — missions and the story.
// Marla, a fixer with a garage in Old Town, hires Rook (the player) for a
// chain of five jobs across the city. Each mission is a list of steps; a step
// is done by reaching its marker, collecting its items, or clearing its
// enemies. Side work: cash drops scattered around the city and a timed
// courier run started with T at the plaza.
import { MISSION_REWARDS } from './config.js';

// Dialogue is [speaker, line] pairs shown when a mission starts.
export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Job',
    giver: 'Marla',
    intro: [
      ['Marla', 'Rook. You need wheels and a reputation. Get to my garage in Old Town.'],
      ['Marla', 'There is a sedan with your name on it. Take it — the owner owes me.'],
      ['Rook', 'Borrowing it, you mean.'],
      ['Marla', 'Drive it to the Marina drop-off. Do not scratch the paint. Much.'],
    ],
    steps: [
      { id: 'garage', text: 'Go to Sunset Garage in Old Town', marker: { x: 680, y: 560 }, radius: 70 },
      { id: 'getcar', text: 'Get in a car (walk up and press E)', marker: { x: 680, y: 560 }, radius: 90, needCar: true },
      { id: 'marina', text: 'Drive to the Marina drop-off', marker: { x: 2680, y: 1520 }, radius: 80, needCar: true },
    ],
  },
  {
    id: 'm2',
    title: 'The Package',
    giver: 'Marla',
    intro: [
      ['Marla', 'A package is waiting at Harbor Plaza. Pick it up on foot.'],
      ['Marla', 'Two street punks are guarding it. They are not friendly. Deal with them.'],
      ['Rook', 'Deal with them. Got it.'],
    ],
    steps: [
      { id: 'plaza', text: 'Reach Harbor Plaza', marker: { x: 1480, y: 1200 }, radius: 80 },
      { id: 'thugs', text: 'Deal with the two guards (F to punch, click to shoot)', marker: { x: 1480, y: 1200 }, radius: 220, needKills: 2, spawnThugs: 2 },
      { id: 'pickup', text: 'Pick up the package', marker: { x: 1480, y: 1200 }, radius: 46 },
      { id: 'deliver', text: 'Deliver the package to the Safehouse', marker: { x: 280, y: 1840 }, radius: 80 },
    ],
  },
  {
    id: 'm3',
    title: 'Hot Wheels',
    giver: 'Marla',
    intro: [
      ['Marla', 'The cops are onto the package. They will be watching you.'],
      ['Marla', 'Lose the heat and get to the Safehouse. Do not get busted.'],
      ['Rook', 'They will have to catch me first.'],
    ],
    steps: [
      { id: 'heat', text: 'The heat is on — lose the cops (wanted to 0)', marker: { x: 280, y: 1840 }, radius: 90, needWantedZero: true, startWanted: 2 },
      { id: 'safe', text: 'Reach the Safehouse in Beachside', marker: { x: 280, y: 1840 }, radius: 80 },
    ],
  },
  {
    id: 'm4',
    title: 'Dockside Score',
    giver: 'Marla',
    intro: [
      ['Marla', 'Three crates of "imported goods" are sitting at the Docks.'],
      ['Marla', 'Grab all three and bring them to the garage. The dock crew will object.'],
      ['Rook', 'They always do.'],
    ],
    steps: [
      { id: 'crates', text: 'Collect 3 crates at the Docks (0/3)', marker: { x: 3060, y: 1200 }, radius: 200, needCrates: 3, spawnThugs: 2 },
      { id: 'garage2', text: 'Bring the crates back to Sunset Garage', marker: { x: 680, y: 560 }, radius: 80 },
    ],
  },
  {
    id: 'm5',
    title: 'The Sunset Run',
    giver: 'Marla',
    intro: [
      ['Marla', 'One last job. A timed run: five checkpoints, coast to coast.'],
      ['Marla', 'Beat the clock and the whole city knows your name. Miss it and walk home.'],
      ['Rook', 'Then I had better not miss.'],
    ],
    steps: [
      { id: 'run', text: 'Hit all 5 checkpoints before the clock runs out', marker: { x: 280, y: 240 }, radius: 70, needCheckpoints: 5, timeLimit: 150 },
      { id: 'beach', text: 'Finish at Sunset Beach', marker: { x: 1480, y: 2320 }, radius: 90 },
    ],
  },
];

export const CHECKPOINTS = [
  { x: 280, y: 240 },
  { x: 3060, y: 560 },
  { x: 2280, y: 1840 },
  { x: 680, y: 2160 },
  { x: 1480, y: 880 },
];

export function missionCount() {
  return MISSIONS.length;
}

// The live mission runtime: which mission, which step, and the step's counters.
export function createMissionRuntime() {
  return {
    active: false,
    index: -1,
    step: 0,
    stepTimer: 0,
    kills: 0,
    crates: 0,
    checkpoints: 0,
    checkpointIndex: 0,
    timeLeft: 0,
    dialogue: null, // {lines, index} while intro text is showing
    failed: false,
  };
}

export function startMission(world, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  const m = world.mission;
  m.active = true;
  m.index = index;
  m.step = 0;
  m.stepTimer = 0;
  m.kills = 0;
  m.crates = 0;
  m.checkpoints = 0;
  m.checkpointIndex = 0;
  m.timeLeft = 0;
  m.failed = false;
  m.dialogue = { lines: def.intro, index: 0 };
  if (world.audio) world.audio.missionStart();
  if (world.banner) world.banner(`New job: ${def.title}`, '#e8b73a');
  // Step-specific setup runs when the step becomes current.
  enterStep(world);
  return true;
}

export function currentStep(world) {
  const m = world.mission;
  if (!m.active) return null;
  const def = MISSIONS[m.index];
  return def.steps[m.step] || null;
}

export function currentObjective(world) {
  const step = currentStep(world);
  if (!step) return null;
  let text = step.text;
  if (step.needCrates) text = `Collect ${step.needCrates} crates at the Docks (${world.mission.crates}/${step.needCrates})`;
  if (step.needKills) text = `Deal with the guards (${world.mission.kills}/${step.needKills})`;
  if (step.needCheckpoints) text = `Checkpoints ${world.mission.checkpoints}/${step.needCheckpoints} — ${Math.ceil(world.mission.timeLeft)}s left`;
  return text;
}

export function currentMarker(world) {
  const m = world.mission;
  const step = currentStep(world);
  if (!step) return null;
  if (step.needCheckpoints) {
    return CHECKPOINTS[m.checkpointIndex] || step.marker;
  }
  return step.marker;
}

// Spawn what a step needs (thugs, crates, heat) when the step starts.
function enterStep(world) {
  const m = world.mission;
  const step = currentStep(world);
  if (!step) return;
  if (step.spawnThugs) {
    for (let i = 0; i < step.spawnThugs; i += 1) {
      const x = step.marker.x + (i === 0 ? -60 : 60);
      const y = step.marker.y + (i === 0 ? 40 : -40);
      world.spawnThug(x, y, i === 1);
    }
  }
  if (step.needCrates) {
    world.spawnCrates(step.marker.x, step.marker.y, step.needCrates);
  }
  if (step.startWanted) {
    world.setWanted(step.startWanted, 'The cops are onto you');
  }
  if (step.timeLimit) {
    m.timeLeft = step.timeLimit;
  }
  if (step.needCheckpoints) {
    m.checkpointIndex = 0;
    m.checkpoints = 0;
  }
}

function advanceStep(world) {
  const m = world.mission;
  const def = MISSIONS[m.index];
  m.step += 1;
  m.stepTimer = 0;
  if (m.step >= def.steps.length) {
    completeMission(world);
    return;
  }
  enterStep(world);
}

export function completeMission(world) {
  const m = world.mission;
  const def = MISSIONS[m.index];
  const reward = MISSION_REWARDS[m.index] || 100;
  world.cash += reward;
  world.earned += reward;
  world.missionsDone = Math.max(world.missionsDone, m.index + 1);
  m.active = false;
  m.index = -1;
  if (world.audio) world.audio.missionDone();
  if (world.banner) world.banner(`Job done: ${def.title} — +$${reward}`, '#7fbf5a');
  world.lastCompletedMission = def.title;
  world.missionCompleteTimer = 3.5;
  world.save();
}

export function failMission(world, reason) {
  const m = world.mission;
  if (!m.active) return;
  m.active = false;
  m.failed = true;
  if (world.audio) world.audio.missionFail();
  if (world.banner) world.banner(`Job failed: ${reason}`, '#e5534b');
  world.missionFailedTimer = 3;
}

export function updateMission(world, dt) {
  const m = world.mission;
  if (!m.active) return;
  const step = currentStep(world);
  if (!step) return;
  m.stepTimer += dt;
  const player = world.player;
  const px = world.playerCar ? world.playerCar.x : player.x;
  const py = world.playerCar ? world.playerCar.y : player.y;

  if (step.timeLimit) {
    m.timeLeft -= dt;
    if (m.timeLeft <= 0) {
      failMission(world, 'Out of time');
      return;
    }
  }
  if (step.needWantedZero && world.wanted > 0) return; // wait for the heat to die down

  const marker = currentMarker(world);
  const d = Math.hypot(px - marker.x, py - marker.y);

  if (step.needKills && m.kills < step.needKills) return;
  if (step.needCrates && m.crates < step.needCrates) return;
  if (step.needCheckpoints) {
    if (d < step.radius) {
      m.checkpoints += 1;
      m.checkpointIndex += 1;
      if (world.audio) world.audio.pickup();
      if (world.banner) world.banner(`Checkpoint ${m.checkpoints}/${step.needCheckpoints}`, '#7fbf5a');
      if (m.checkpoints >= step.needCheckpoints) advanceStep(world);
    }
    return;
  }
  if (step.needCar && !world.playerCar) return;
  if (d < step.radius) advanceStep(world);
}

// --- Side activities ------------------------------------------------------
// Cash drops: green bundles that appear around the city and pay on pickup.
export function spawnCashDrop(world, x, y, amount) {
  world.pickups.push({ kind: 'cash', x, y, amount: amount || 25, bob: Math.random() * 6 });
}

// The courier run: a timed checkpoint loop started with T at the plaza.
export function startCourierRun(world) {
  if (world.courier.active) return;
  world.courier.active = true;
  world.courier.index = 0;
  world.courier.timeLeft = 90;
  world.courier.collected = 0;
  if (world.banner) world.banner('Courier run! 4 checkpoints, 90 seconds.', '#e8b73a');
  if (world.audio) world.audio.missionStart();
}

export function updateCourier(world, dt) {
  const c = world.courier;
  if (!c.active) return;
  c.timeLeft -= dt;
  if (c.timeLeft <= 0) {
    c.active = false;
    if (world.banner) world.banner('Courier run over — too slow.', '#e5534b');
    return;
  }
  const target = CHECKPOINTS[c.index % CHECKPOINTS.length];
  const player = world.player;
  const px = world.playerCar ? world.playerCar.x : player.x;
  const py = world.playerCar ? world.playerCar.y : player.y;
  if (Math.hypot(px - target.x, py - target.y) < 70) {
    c.collected += 1;
    c.index += 1;
    world.cash += 40;
    world.earned += 40;
    if (world.audio) world.audio.cash();
    if (c.collected >= 4) {
      c.active = false;
      world.cash += 100;
      world.earned += 100;
      if (world.banner) world.banner('Courier run complete! +$260', '#7fbf5a');
      if (world.audio) world.audio.missionDone();
    }
  }
}
