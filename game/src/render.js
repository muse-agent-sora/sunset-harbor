// Sunset Harbor — everything the player sees: the golden-hour city, the cars and
// people in it, the HUD with its minimap, and the title / pause / end screens.
// All drawing is plain canvas 2D; the art direction is flat shapes, long shadows
// and a warm sunset tint over the whole frame.
import { WORLD, VIEW, ROADS_X, ROADS_Y, ROAD_HALF, BEACH_X, HARBOR_Y, DISTRICTS, CAR_TYPES, PALETTE, PLAYER } from './config.js';
import { clamp, money } from './rng.js';
import { districtAt, isOnRoad } from './city.js';
import { currentObjective, missionMarker, MISSIONS } from './missions.js';
import { playerCar } from './entities.js';

const MINIMAP = { x: 16, y: 516, w: 188, h: 144 };

/** Camera: follow the player, clamped to the world, with a shake offset. */
export function updateCamera(state, dt) {
  const p = state.player;
  const targetX = p.x - VIEW.width / 2;
  const targetY = p.y - VIEW.height / 2;
  state.camera.x += (targetX - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (targetY - state.camera.y) * Math.min(1, dt * 5);
  state.camera.x = clamp(state.camera.x, -60, WORLD.width - VIEW.width + 60);
  state.camera.y = clamp(state.camera.y, -60, WORLD.height - VIEW.height + 60);
  state.shake = Math.max(0, state.shake - dt * 22);
}

/** Draw the whole frame for the current mode. */
export function draw(ctx, state) {
  ctx.save();
  // Golden-hour wash over everything.
  const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
  const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
  const camX = Math.round(state.camera.x + shakeX);
  const camY = Math.round(state.camera.y + shakeY);
  ctx.fillStyle = '#e8c98a';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  drawWorld(ctx, state, camX, camY);
  drawSkids(ctx, state, camX, camY);
  drawPickups(ctx, state, camX, camY);
  drawCars(ctx, state, camX, camY);
  drawPeds(ctx, state, camX, camY);
  drawThugs(ctx, state, camX, camY);
  drawCops(ctx, state, camX, camY);
  drawPlayer(ctx, state, camX, camY);
  drawBullets(ctx, state, camX, camY);
  drawParticles(ctx, state, camX, camY);
  drawMissionMarker(ctx, state, camX, camY);
  drawSideJobRings(ctx, state, camX, camY);
  // Sunset tint.
  ctx.fillStyle = 'rgba(247, 178, 103, 0.10)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.restore();

  if (state.mode === 'title') drawTitle(ctx, state);
  else if (state.mode === 'pause') { drawHUD(ctx, state); drawPause(ctx, state); }
  else if (state.mode === 'play') drawHUD(ctx, state);
  else if (state.mode === 'busted' || state.mode === 'wasted' || state.mode === 'gameover') {
    drawHUD(ctx, state);
    drawEndScreen(ctx, state);
  }

  if (state.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200, 30, 30, ${state.hurtFlash * 0.35})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  drawSplash(ctx, state);
  drawMessage(ctx, state);
}

function drawWorld(ctx, state, camX, camY) {
  const city = state.city;
  const x0 = camX - 80;
  const y0 = camY - 80;
  const x1 = camX + VIEW.width + 80;
  const y1 = camY + VIEW.height + 80;
  // Everything in the world is laid out in world coordinates: shift the canvas
  // by the camera so a road under the player is a road on the screen.
  ctx.save();
  ctx.translate(-camX, -camY);

  // Ground: grass everywhere, then districts, parks, beach and water on top.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (const d of DISTRICTS) {
    if (d.x > x1 || d.x + d.w < x0 || d.y > y1 || d.y + d.h < y0) continue;
    ctx.fillStyle = d.tint + '22';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = 'rgba(60, 40, 20, 0.55)';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(d.name.toUpperCase(), d.x + 24, d.y + 34);
  }
  // Parks.
  for (const park of city.parks) {
    if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#4a7a3a';
    for (let i = 0; i < 5; i += 1) {
      const tx = park.x + 20 + ((i * 53) % Math.max(20, park.w - 40));
      const ty = park.y + 24 + ((i * 37) % Math.max(20, park.h - 48));
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Beach and harbor water.
  if (x1 > BEACH_X) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(Math.max(x0, BEACH_X), y0, x1 - Math.max(x0, BEACH_X), Math.min(y1, HARBOR_Y) - y0);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let y = 120; y < HARBOR_Y; y += 90) {
      ctx.fillRect(BEACH_X + 6, y, 60, 3);
    }
  }
  if (y1 > HARBOR_Y) {
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, Math.max(y0, HARBOR_Y), x1 - x0, y1 - Math.max(y0, HARBOR_Y));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    for (let x = 100; x < WORLD.width; x += 260) {
      const wy = HARBOR_Y + 40 + ((x * 7) % 60);
      ctx.fillRect(x, wy, 90, 3);
    }
  }
  // Piers.
  ctx.fillStyle = '#8a6f4d';
  for (const pier of city.piers) {
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.fillStyle = '#6f5638';
    for (let y = pier.y + 12; y < pier.y + pier.h; y += 22) ctx.fillRect(pier.x, y, pier.w, 3);
    ctx.fillStyle = '#8a6f4d';
  }

  // Roads: dark asphalt with a lighter edge and a dashed centre line.
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_HALF, y0, ROAD_HALF * 2, y1 - y0);
  for (const ry of ROADS_Y) ctx.fillRect(x0, ry - ROAD_HALF, x1 - x0, ROAD_HALF * 2);
  ctx.fillStyle = PALETTE.roadEdge;
  for (const rx of ROADS_X) {
    ctx.fillRect(rx - ROAD_HALF, y0, 3, y1 - y0);
    ctx.fillRect(rx + ROAD_HALF - 3, y0, 3, y1 - y0);
  }
  for (const ry of ROADS_Y) {
    ctx.fillRect(x0, ry - ROAD_HALF, x1 - x0, 3);
    ctx.fillRect(x0, ry + ROAD_HALF - 3, x1 - x0, 3);
  }
  ctx.fillStyle = '#d8c86a';
  for (const rx of ROADS_X) {
    for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) ctx.fillRect(rx - 2, y, 4, 22);
  }
  for (const ry of ROADS_Y) {
    for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x, ry - 2, 22, 4);
  }
  // Sidewalks: a pale frame around each block.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROADS_X) {
    ctx.fillRect(rx - ROAD_HALF - 8, y0, 8, y1 - y0);
    ctx.fillRect(rx + ROAD_HALF, y0, 8, y1 - y0);
  }
  for (const ry of ROADS_Y) {
    ctx.fillRect(x0, ry - ROAD_HALF - 8, x1 - x0, 8);
    ctx.fillRect(x0, ry + ROAD_HALF, x1 - x0, 8);
  }

  // Buildings: roof, long sunset shadow, and a darker inset for height.
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(40, 20, 10, 0.25)';
    ctx.fillRect(b.x + 10, b.y + 12, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    const inset = 8;
    ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
    if (b.height >= 3) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(b.x + b.w / 2 - 6, b.y + 10, 12, b.h - 20);
    }
  }

  // Traffic lights at intersections.
  for (const light of city.lights) {
    if (light.x < x0 || light.x > x1 || light.y < y0 || light.y > y1) continue;
    ctx.fillStyle = '#222222';
    ctx.fillRect(light.x - 5, light.y - 5, 10, 10);
    ctx.fillStyle = light.phase === 0 ? '#3ddc5e' : '#e03a2a';
    ctx.beginPath();
    ctx.arc(light.x, light.y - 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = light.phase === 1 ? '#3ddc5e' : '#e03a2a';
    ctx.beginPath();
    ctx.arc(light.x + 12, light.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSkids(ctx, state, camX, camY) {
  ctx.strokeStyle = 'rgba(20, 20, 20, 0.35)';
  ctx.lineWidth = 4;
  for (const s of state.skids) {
    ctx.globalAlpha = Math.min(1, s.life / 3);
    ctx.beginPath();
    ctx.moveTo(s.x - camX - Math.cos(s.angle) * 14, s.y - camY - Math.sin(s.angle) * 14);
    ctx.lineTo(s.x - camX + Math.cos(s.angle) * 14, s.y - camY + Math.sin(s.angle) * 14);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPickups(ctx, state, camX, camY) {
  for (const drop of state.pickups) {
    if (drop.taken) continue;
    const bob = Math.sin(drop.bob) * 3;
    const sx = drop.x - camX;
    const sy = drop.y - camY + bob;
    ctx.fillStyle = '#ffd24b';
    ctx.beginPath();
    ctx.arc(sx, sy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6a10';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', sx, sy + 5);
    ctx.textAlign = 'left';
  }
}

function drawCarShape(ctx, car, camX, camY, state) {
  const type = CAR_TYPES[car.type];
  const sx = car.x - camX;
  const sy = car.y - camY;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(-type.l / 2 + 4, -type.w / 2 + 5, type.l, type.w);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -type.l / 2, -type.w / 2, type.l, type.w, 10);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = 'rgba(20, 30, 44, 0.85)';
  roundRect(ctx, -type.l * 0.18, -type.w / 2 + 7, type.l * 0.36, type.w - 14, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(180, 220, 240, 0.7)';
  ctx.fillRect(type.l * 0.22, -type.w / 2 + 8, 6, type.w - 16);
  // Headlights and taillights.
  ctx.fillStyle = '#fff8c8';
  ctx.fillRect(type.l / 2 - 4, -type.w / 2 + 4, 4, 8);
  ctx.fillRect(type.l / 2 - 4, type.w / 2 - 12, 4, 8);
  ctx.fillStyle = '#e03a2a';
  ctx.fillRect(-type.l / 2, -type.w / 2 + 4, 4, 8);
  ctx.fillRect(-type.l / 2, type.w / 2 - 12, 4, 8);
  if (car.type === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6, -type.w / 2 + 4, 12, type.w - 8);
    ctx.fillStyle = '#1a3a8a';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 4);
    ctx.textAlign = 'left';
    const blink = Math.floor(state.time * 4) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2a2a' : '#2a6aff';
    ctx.beginPath();
    ctx.arc(-2, -type.w / 2 + 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#2a6aff' : '#ff2a2a';
    ctx.beginPath();
    ctx.arc(6, -type.w / 2 + 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#222222';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 4);
    ctx.textAlign = 'left';
  }
  ctx.restore();
  // Damage smoke and health bar for battered cars.
  if (car.health < car.maxHealth * 0.6) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(sx - 24, sy - type.w / 2 - 12, 48, 5);
    ctx.fillStyle = car.health < car.maxHealth * 0.3 ? '#e03a2a' : '#ffd24b';
    ctx.fillRect(sx - 24, sy - type.w / 2 - 12, 48 * (car.health / car.maxHealth), 5);
  }
}

function drawCars(ctx, state, camX, camY) {
  for (const car of state.cars) drawCarShape(ctx, car, camX, camY, state);
}

function drawPerson(ctx, x, y, angle, color, camX, camY, opts = {}) {
  const sx = x - camX;
  const sy = y - camY;
  ctx.save();
  ctx.translate(sx, sy);
  // Shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(3, 5, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  // Body: simple long-armed figure in the game's flat style.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = opts.shirt || '#3a5a8a';
  ctx.fillRect(-8, -6, 16, 14);
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(12, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Arms reach forward (long arms, simple round hands).
  ctx.strokeStyle = opts.shirt || '#3a5a8a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(2, -7);
  ctx.lineTo(14, -8);
  ctx.moveTo(2, 7);
  ctx.lineTo(14, 8);
  ctx.stroke();
  if (opts.gun) {
    ctx.fillStyle = '#222222';
    ctx.fillRect(12, -2, 12, 4);
  }
  ctx.restore();
  if (opts.health !== undefined && opts.health < opts.maxHealth) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(sx - 14, sy - 24, 28, 4);
    ctx.fillStyle = '#e03a2a';
    ctx.fillRect(sx - 14, sy - 24, 28 * (opts.health / opts.maxHealth), 4);
  }
}

function drawPlayer(ctx, state, camX, camY) {
  const p = state.player;
  if (p.carId !== null) return; // the driver is inside the car shape
  drawPerson(ctx, p.x, p.y, p.angle, '#e8b88a', camX, camY, {
    shirt: '#c84b4b',
    gun: p.ammo >= 0,
  });
  // Aim line while the pistol is out.
  if (inputMouseDown(state)) {
    const ax = p.x - camX + Math.cos(p.aimAngle) * 60;
    const ay = p.y - camY + Math.sin(p.aimAngle) * 60;
    ctx.strokeStyle = 'rgba(255, 210, 75, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - camX, p.y - camY);
    ctx.lineTo(ax, ay);
    ctx.stroke();
  }
  // Arrest progress ring over a driver a cop is pulling out.
  for (const cop of state.cops) {
    if (cop.arrestTimer > 0) {
      const sx = p.x - camX;
      const sy = p.y - camY - 34;
      ctx.strokeStyle = '#ff2a2a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sx, sy, 12, -Math.PI / 2, -Math.PI / 2 + (cop.arrestTimer / 1.5) * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ff2a2a';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ARREST!', sx, sy - 20);
      ctx.textAlign = 'left';
    }
  }
}

function inputMouseDown(state) {
  return state.mouseDownNow === true;
}

function drawPeds(ctx, state, camX, camY) {
  for (const ped of state.peds) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, '#e8c39a', camX, camY, {
      shirt: ped.color,
    });
  }
}

function drawThugs(ctx, state, camX, camY) {
  for (const thug of state.thugs) {
    drawPerson(ctx, thug.x, thug.y, thug.angle, '#d8a878', camX, camY, {
      shirt: thug.color,
      gun: thug.shooter,
      health: thug.health,
      maxHealth: 60,
    });
    ctx.fillStyle = '#ff2a2a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', thug.x - camX, thug.y - camY - 22);
    ctx.textAlign = 'left';
  }
}

function drawCops(ctx, state, camX, camY) {
  for (const cop of state.cops) {
    drawPerson(ctx, cop.x, cop.y, cop.angle, '#e8c39a', camX, camY, {
      shirt: '#1a3a8a',
      health: cop.health,
      maxHealth: 60,
    });
    // Police cap.
    ctx.fillStyle = '#122a6a';
    ctx.beginPath();
    ctx.arc(cop.x - camX + Math.cos(cop.angle) * 10, cop.y - camY + Math.sin(cop.angle) * 10, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBullets(ctx, state, camX, camY) {
  ctx.fillStyle = '#ffd24b';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x - camX, b.y - camY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx, state, camX, camY) {
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x - camX, pt.y - camY, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMissionMarker(ctx, state, camX, camY) {
  const marker = missionMarker(state);
  if (!marker) return;
  const sx = marker.x - camX;
  const sy = marker.y - camY;
  const onScreen = sx > 0 && sx < VIEW.width && sy > 0 && sy < VIEW.height;
  const pulse = 1 + Math.sin(state.time * 5) * 0.15;
  if (onScreen) {
    ctx.strokeStyle = '#ffd24b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd24b';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 34);
    ctx.lineTo(sx - 10, sy - 16);
    ctx.lineTo(sx + 10, sy - 16);
    ctx.closePath();
    ctx.fill();
  } else {
    // Off-screen arrow at the edge pointing toward the objective.
    const cx = clamp(sx, 40, VIEW.width - 40);
    const cy = clamp(sy, 60, VIEW.height - 40);
    const a = Math.atan2(sy - cy, sx - cx);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd24b';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawSideJobRings(ctx, state, camX, camY) {
  const job = state.sideJob;
  if (!job.active) {
    // Show the start ring faintly so players can find the side job.
    const sx = 1280 - camX;
    const sy = 840 - camY;
    if (sx > -60 && sx < VIEW.width + 60 && sy > -60 && sy < VIEW.height + 60) {
      ctx.strokeStyle = 'rgba(80, 200, 120, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, 40, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  const ring = job.rings[job.index];
  if (!ring) return;
  const sx = ring.x - camX;
  const sy = ring.y - camY;
  ctx.strokeStyle = '#50c878';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(sx, sy, 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#50c878';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`RING ${job.index + 1}/${job.rings.length} — ${Math.ceil(job.timer)}s`, sx, sy - 54);
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------- HUD

function drawHUD(ctx, state) {
  const p = state.player;
  const pc = playerCar(state);
  // Top-left: health and cash.
  ctx.fillStyle = 'rgba(10, 10, 16, 0.55)';
  roundRect(ctx, 12, 12, 230, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#f5e9d0';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('HEALTH', 24, 32);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(90, 22, 130, 12);
  ctx.fillStyle = p.health > 50 ? '#3ddc5e' : p.health > 25 ? '#ffd24b' : '#e03a2a';
  ctx.fillRect(90, 22, 130 * (p.health / PLAYER.maxHealth), 12);
  ctx.fillStyle = '#ffd24b';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(money(p.cash), 24, 62);
  ctx.fillStyle = '#f5e9d0';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`SCORE ${Math.round(state.score)}`, 130, 62);

  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10, 10, 16, 0.55)';
  roundRect(ctx, VIEW.width - 212, 12, 200, 44, 10);
  ctx.fill();
  const stars = Math.floor(state.wanted);
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd24b' : 'rgba(255, 255, 255, 0.25)';
    drawStar(ctx, VIEW.width - 190 + i * 36, 34, 13);
  }
  if (state.wantedFlash > 0) {
    ctx.fillStyle = `rgba(255, 42, 42, ${Math.min(1, state.wantedFlash)})`;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(state.lastCrime || 'WANTED', VIEW.width - 200, 74);
  }

  // Top-centre: mission objective and district.
  const obj = currentObjective(state);
  const district = districtAt(p.x, p.y);
  ctx.fillStyle = 'rgba(10, 10, 16, 0.55)';
  const objText = obj ? obj.label : (state.missionsDone >= MISSIONS.length ? 'All jobs done — free roam!' : 'Free roam — a new job is coming');
  ctx.font = 'bold 15px system-ui, sans-serif';
  const tw = ctx.measureText(objText).width;
  roundRect(ctx, VIEW.width / 2 - tw / 2 - 16, 12, tw + 32, 34, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd24b';
  ctx.textAlign = 'center';
  ctx.fillText(objText, VIEW.width / 2, 34);
  ctx.fillStyle = 'rgba(245, 233, 208, 0.85)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(district.name, VIEW.width / 2, 62);
  ctx.textAlign = 'left';

  // Bottom-right: speed and ammo.
  ctx.fillStyle = 'rgba(10, 10, 16, 0.55)';
  roundRect(ctx, VIEW.width - 212, VIEW.height - 76, 200, 64, 10);
  ctx.fill();
  const speed = pc ? Math.abs(Math.round(pc.speed * 0.22)) : 0;
  ctx.fillStyle = '#f5e9d0';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`${speed}`, VIEW.width - 190, VIEW.height - 40);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('mph', VIEW.width - 140, VIEW.height - 40);
  ctx.fillStyle = '#ffd24b';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`AMMO ${p.ammo}/${p.reserveAmmo}${p.reloadTimer > 0 ? ' …' : ''}`, VIEW.width - 190, VIEW.height - 20);
  if (pc) {
    ctx.fillStyle = '#f5e9d0';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`${CAR_TYPES[pc.type].name} — ${Math.round(pc.health)}/${pc.maxHealth} HP`, 24, 92);
  }

  drawMinimap(ctx, state);

  // Mission intro dialogue — kept clear of the minimap at bottom-left.
  if (state.mission.introTimer > 0 && state.mission.intro) {
    ctx.fillStyle = 'rgba(10, 10, 16, 0.72)';
    roundRect(ctx, 220, VIEW.height - 150, VIEW.width - 280, 64, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd24b';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('MARLA', 238, VIEW.height - 126);
    ctx.fillStyle = '#f5e9d0';
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, state.mission.intro, 238, VIEW.height - 104, VIEW.width - 320, 20);
  }

  // Controls reminder, bottom-left above the minimap.
  ctx.fillStyle = 'rgba(245, 233, 208, 0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('WASD move/drive · E enter car · F punch · Click shoot · R reload · Shift sprint · Space handbrake · P pause · M mute', 16, VIEW.height - 8);
}

function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawMinimap(ctx, state) {
  const m = MINIMAP;
  ctx.fillStyle = 'rgba(10, 10, 16, 0.7)';
  roundRect(ctx, m.x - 4, m.y - 4, m.w + 8, m.h + 8, 8);
  ctx.fill();
  const sx = m.w / WORLD.width;
  const sy = m.h / WORLD.height;
  const mx = (x) => m.x + x * sx;
  const my = (y) => m.y + y * sy;
  // Water and beach.
  ctx.fillStyle = '#3f7d9e';
  ctx.fillRect(mx(0), my(HARBOR_Y), m.w, m.y + m.h - my(HARBOR_Y));
  ctx.fillStyle = '#e8d39a';
  ctx.fillRect(mx(BEACH_X), my(0), m.w - (mx(BEACH_X) - m.x), my(HARBOR_Y) - m.y);
  // Roads.
  ctx.strokeStyle = 'rgba(220, 220, 220, 0.75)';
  ctx.lineWidth = 2;
  for (const rx of ROADS_X) {
    ctx.beginPath();
    ctx.moveTo(mx(rx), my(0));
    ctx.lineTo(mx(rx), my(HARBOR_Y));
    ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath();
    ctx.moveTo(mx(0), my(ry));
    ctx.lineTo(mx(BEACH_X), my(ry));
    ctx.stroke();
  }
  // Cars as small dots, police in blue, the player in white, marker in gold.
  for (const car of state.cars) {
    ctx.fillStyle = car.driver === 'police' ? '#2a6aff' : car.driver === 'player' ? '#ffffff' : 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(mx(car.x) - 2, my(car.y) - 2, 4, 4);
  }
  const marker = missionMarker(state);
  if (marker) {
    ctx.fillStyle = '#ffd24b';
    ctx.beginPath();
    ctx.arc(mx(marker.x), my(marker.y), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd24b';
    ctx.beginPath();
    ctx.arc(mx(marker.x), my(marker.y), 8 + Math.sin(state.time * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  const p = state.player;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mx(p.x), my(p.y), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f5e9d0';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('SUNSET HARBOR', m.x, m.y - 8);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

// ---------------------------------------------------------------- Screens

function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(20, 10, 8, 0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24b';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('SUNSET HARBOR', VIEW.width / 2, 190);
  ctx.fillStyle = '#f5e9d0';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('An open-world crime game — drive, steal, run jobs, outrun the law.', VIEW.width / 2, 240);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(245, 233, 208, 0.9)';
  ctx.fillText('Five jobs from Marla. A whole city to take. One driver: Rook.', VIEW.width / 2, 272);
  const blink = Math.floor(state.time * 2) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('PRESS ENTER OR CLICK TO START', VIEW.width / 2, 360);
  }
  if (state.save && state.save.missionsDone > 0) {
    ctx.fillStyle = '#ffd24b';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(`Continue: ${state.save.missionsDone} job(s) done, ${money(state.save.cash || 0)} — press C`, VIEW.width / 2, 400);
  }
  ctx.fillStyle = 'rgba(245, 233, 208, 0.85)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD / arrows — move & drive · E — enter / exit car · F — punch · Mouse — aim, click — shoot', VIEW.width / 2, 470);
  ctx.fillText('Shift — sprint · Space — handbrake · R — reload · P — pause · M — mute', VIEW.width / 2, 496);
  ctx.fillText(`Best score: ${Math.round(state.bestScore || 0)}`, VIEW.width / 2, 540);
  ctx.textAlign = 'left';
}

function drawPause(ctx, state) {
  ctx.fillStyle = 'rgba(10, 10, 16, 0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5e9d0';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW.width / 2, 300);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('P or Esc — resume · R — restart the run · M — mute', VIEW.width / 2, 350);
  ctx.fillText(`Cash ${money(state.player.cash)} · Jobs done ${state.missionsDone}/5 · Score ${Math.round(state.score)}`, VIEW.width / 2, 384);
  ctx.textAlign = 'left';
}

function drawEndScreen(ctx, state) {
  ctx.fillStyle = 'rgba(10, 10, 16, 0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  let title = 'WASTED';
  let sub = 'Rook went down in Sunset Harbor.';
  if (state.endReason === 'busted') {
    title = 'BUSTED';
    sub = 'The police pulled Rook out of the car. The city keeps its secrets.';
  } else if (state.endReason === 'complete') {
    title = 'THE HARBOR RUN — DONE';
    sub = 'All five jobs complete. Marla pays, Rook drives off into the sunset.';
  }
  ctx.fillStyle = state.endReason === 'complete' ? '#3ddc5e' : '#e03a2a';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, VIEW.width / 2, 260);
  ctx.fillStyle = '#f5e9d0';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(sub, VIEW.width / 2, 306);
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = '#ffd24b';
  ctx.fillText(`SCORE ${Math.round(state.score)}   ·   CASH ${money(state.player.cash)}   ·   JOBS ${state.missionsDone}/5`, VIEW.width / 2, 370);
  ctx.fillStyle = '#f5e9d0';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(`Best score: ${Math.round(state.bestScore || 0)}`, VIEW.width / 2, 408);
  const blink = Math.floor(state.time * 2) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('PRESS ENTER TO PLAY AGAIN', VIEW.width / 2, 470);
  }
  ctx.textAlign = 'left';
}

function drawSplash(ctx, state) {
  const splash = state.splash;
  if (!splash || splash.timer <= 0) return;
  const alpha = Math.min(1, splash.timer);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10, 10, 16, 0.6)';
  roundRect(ctx, VIEW.width / 2 - 260, 180, 520, 96, 12);
  ctx.fill();
  ctx.fillStyle = '#ffd24b';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText(splash.title, VIEW.width / 2, 224);
  ctx.fillStyle = '#f5e9d0';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(splash.subtitle, VIEW.width / 2, 256);
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawMessage(ctx, state) {
  if (!state.message || state.messageTimer <= 0) return;
  ctx.fillStyle = 'rgba(10, 10, 16, 0.65)';
  ctx.font = '15px system-ui, sans-serif';
  const tw = ctx.measureText(state.message).width;
  roundRect(ctx, VIEW.width / 2 - tw / 2 - 14, VIEW.height - 210, tw + 28, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#f5e9d0';
  ctx.textAlign = 'center';
  ctx.fillText(state.message, VIEW.width / 2, VIEW.height - 190);
  ctx.textAlign = 'left';
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
