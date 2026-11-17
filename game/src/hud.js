// Sunset Harbor — the HUD, the minimap, dialogue and the menu screens.
// Drawn on top of the world each frame, in screen space. The minimap is a
// live top-down view of the whole city: roads, the player, police, cars and
// the mission marker. The screens (title, pause, busted, wasted) are panels
// over the dimmed world.
import { DISTRICTS, ROAD_X, ROAD_Y, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';
import { currentMarker, currentObjective, MISSIONS } from './missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MAP_W = 216;
const MAP_H = 164;

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');

  // The canvas backing store is device pixels; draw everything in CSS pixels.
  function begin() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function text(value, x, y, size, color, align, bold) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function panel(x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill || 'rgba(15,18,26,0.82)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawMinimap(state, x, y) {
    begin();
    const sx = MAP_W / WORLD_W;
    const sy = MAP_H / WORLD_H;
    panel(x - 6, y - 6, MAP_W + 12, MAP_H + 12, 'rgba(10,14,22,0.85)', 'rgba(255,255,255,0.25)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, MAP_W, MAP_H);
    ctx.clip();
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(x, y, MAP_W, MAP_H);
    ctx.fillStyle = '#7fae62';
    ctx.fillRect(x, y, MAP_W, MAP_H * 0.9);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(x, y + MAP_H * 0.9, MAP_W, MAP_H * 0.1);
    // Roads.
    ctx.strokeStyle = '#3c3f46';
    ctx.lineWidth = 4;
    for (const rx of ROAD_X) {
      ctx.beginPath();
      ctx.moveTo(x + rx * sx, y);
      ctx.lineTo(x + rx * sx, y + MAP_H);
      ctx.stroke();
    }
    for (const ry of ROAD_Y) {
      ctx.beginPath();
      ctx.moveTo(x, y + ry * sy);
      ctx.lineTo(x + MAP_W, y + ry * sy);
      ctx.stroke();
    }
    // District labels, clamped inside the map so none is cut off.
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = `9px ${FONT}`;
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const lx = Math.max(30, Math.min(MAP_W - 34, (d.x + d.w / 2) * sx));
      const ly = Math.max(10, Math.min(MAP_H - 4, (d.y + d.h / 2) * sy));
      ctx.fillText(d.name, x + lx, y + ly);
    }
    // Mission marker: a pulsing yellow dot with a ring.
    const marker = currentMarker(state);
    if (marker) {
      const pulse = 3 + Math.sin(state.time * 5) * 1.5;
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(x + marker.x * sx, y + marker.y * sy, pulse + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a5a00';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Courier target.
    if (state.courier.active) {
      const target = state.courierTarget;
      if (target) {
        ctx.fillStyle = '#7fbf5a';
        ctx.beginPath();
        ctx.arc(x + target.x * sx, y + target.y * sy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Cars as grey dots.
    ctx.fillStyle = 'rgba(220,220,220,0.8)';
    for (const car of state.cars) {
      ctx.fillRect(x + car.x * sx - 1, y + car.y * sy - 1, 2, 2);
    }
    // Police: flashing blue.
    const flash = Math.floor(state.time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#2a6aff' : '#ff2a2a';
    for (const car of state.policeCars) {
      ctx.beginPath();
      ctx.arc(x + car.x * sx, y + car.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of state.cops) {
      if (!cop.alive) continue;
      ctx.beginPath();
      ctx.arc(x + cop.x * sx, y + cop.y * sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player: a white dot with a dark ring, always on top.
    const px = state.playerCar ? state.playerCar.x : state.player.x;
    const py = state.playerCar ? state.playerCar.y : state.player.y;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + px * sx, y + py * sy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    text('SUNSET HARBOR', x + MAP_W / 2, y + MAP_H + 20, 11, 'rgba(255,255,255,0.75)', 'center', true);
  }

  function drawStars(state, cx, y) {
    const flashing = state.flashWanted > 0 && Math.floor(state.flashWanted * 8) % 2 === 0;
    for (let i = 0; i < 5; i += 1) {
      const filled = i < state.wanted;
      const x = cx + (i - 2) * 34;
      ctx.font = 'bold 30px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = filled ? (flashing ? '#ff6a3d' : '#ffd94d') : 'rgba(255,255,255,0.28)';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 4;
      ctx.strokeText('★', x, y);
      ctx.fillText('★', x, y);
    }
  }

  function drawHud(state, view) {
    begin();
    const w = view.w;
    const h = view.h;
    const p = state.player;
    // Top-left: health, cash, score.
    panel(16, 14, 250, 86, 'rgba(15,18,26,0.78)');
    text('HEALTH', 28, 36, 12, '#9aa0a8', 'left', true);
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(28, 44, 150, 14, 7);
    ctx.fill();
    const hpRatio = Math.max(0, p.health / 100);
    ctx.fillStyle = hpRatio > 0.5 ? '#7fbf5a' : hpRatio > 0.25 ? '#e8b73a' : '#e5534b';
    ctx.beginPath();
    ctx.roundRect(28, 44, 150 * hpRatio, 14, 7);
    ctx.fill();
    text(`${Math.ceil(p.health)}`, 186, 58, 16, '#fff', 'left', true);
    text(`$${state.cash}`, 28, 88, 20, '#7fbf5a', 'left', true);
    text(`Score ${state.score()}`, 130, 88, 14, '#cfd3da', 'left');
    // Top-centre: wanted stars.
    drawStars(state, w / 2, 44);
    if (state.wanted > 0) text('WANTED', w / 2, 66, 11, '#e5534b', 'center', true);
    // Top-right: minimap.
    drawMinimap(state, w - MAP_W - 22, 16);
    // Bottom-left: mission objective.
    const objective = currentObjective(state);
    if (state.mission.active && objective) {
      const def = MISSIONS[state.mission.index];
      panel(16, h - 96, 420, 80, 'rgba(15,18,26,0.78)', 'rgba(232,183,58,0.5)');
      text(`JOB ${state.mission.index + 1}/5 — ${def.title}`, 30, h - 66, 13, '#e8b73a', 'left', true);
      text(objective, 30, h - 40, 15, '#fff', 'left');
      if (state.mission.dialogue) text('Press E to continue…', 30, h - 22, 12, '#9aa0a8', 'left');
    } else if (state.missionsDone > 0 && state.missionsDone < 5) {
      panel(16, h - 96, 420, 80, 'rgba(15,18,26,0.78)');
      text('NO ACTIVE JOB', 30, h - 66, 13, '#9aa0a8', 'left', true);
      text(`Press T to start job ${state.missionsDone + 1}, or run a courier at the plaza.`, 30, h - 40, 13, '#fff', 'left');
    } else if (state.missionsDone >= 5) {
      panel(16, h - 96, 420, 80, 'rgba(15,18,26,0.78)', 'rgba(127,191,90,0.6)');
      text('ALL JOBS DONE', 30, h - 66, 13, '#7fbf5a', 'left', true);
      text('Sunset Harbor is yours. Free roam, courier runs, cash drops.', 30, h - 40, 13, '#fff', 'left');
    }
    // Bottom-right: speed and ammo, stacked so nothing overlaps.
    panel(w - 210, h - 96, 194, 80, 'rgba(15,18,26,0.78)');
    text(`Ammo ${p.ammo} / ${p.reserve}`, w - 196, h - 80, 13, '#fff', 'left', true);
    if (state.playerCar) {
      const mph = Math.round(Math.abs(state.playerCar.speed) * 0.14);
      text(state.playerCar.spec.name, w - 196, h - 60, 12, '#e8b73a', 'left', true);
      text(state.playerCar.wrecked ? 'WRECKED' : `Condition ${Math.ceil((state.playerCar.health / (state.playerCar.maxHealth || 100)) * 100)}%`, w - 196, h - 42, 12, state.playerCar.wrecked ? '#e5534b' : '#cfd3da', 'left');
      text(`${mph}`, w - 26, h - 30, 30, '#fff', 'right', true);
      text('mph', w - 26, h - 18, 12, '#9aa0a8', 'right');
    } else {
      text('ON FOOT', w - 196, h - 44, 22, '#fff', 'left', true);
      text('E near a car to drive', w - 196, h - 24, 12, '#9aa0a8', 'left');
    }
    // Banner (mission news, wanted changes).
    if (state.bannerTimer > 0) {
      const alpha = Math.min(1, state.bannerTimer);
      ctx.globalAlpha = alpha;
      const bw = 560;
      panel(w / 2 - bw / 2, 78, bw, 40, 'rgba(15,18,26,0.85)', state.bannerColor);
      text(state.bannerText, w / 2, 105, 16, '#fff', 'center', true);
      ctx.globalAlpha = 1;
    }
    // Mission-complete splash.
    if (state.missionCompleteTimer > 0) {
      ctx.globalAlpha = Math.min(1, state.missionCompleteTimer);
      panel(w / 2 - 260, h / 2 - 90, 520, 120, 'rgba(15,18,26,0.9)', '#7fbf5a');
      text('JOB COMPLETE', w / 2, h / 2 - 40, 34, '#7fbf5a', 'center', true);
      text(state.lastCompletedMission, w / 2, h / 2, 18, '#fff', 'center');
      ctx.globalAlpha = 1;
    }
    // Dialogue box.
    if (state.mission.dialogue) {
      const dlg = state.mission.dialogue;
      const line = dlg.lines[dlg.index];
      panel(w / 2 - 360, h - 210, 720, 96, 'rgba(15,18,26,0.92)', '#e8b73a');
      text(line[0], w / 2 - 340, h - 178, 15, '#e8b73a', 'left', true);
      text(line[1], w / 2 - 340, h - 148, 17, '#fff', 'left');
      text(`E / click — ${dlg.index + 1}/${dlg.lines.length}`, w / 2 + 340, h - 126, 12, '#9aa0a8', 'right');
    }
    // Controls hint, early in the game, just above the bottom panels.
    if (state.time < 14 && !state.mission.dialogue) {
      ctx.globalAlpha = Math.min(1, 14 - state.time);
      text('WASD move / drive · E enter car · F punch · Click shoot · R reload · Shift sprint · Space handbrake · P pause · M mute', w / 2, h - 104, 13, 'rgba(255,255,255,0.85)', 'center');
      ctx.globalAlpha = 1;
    }
    // Mute indicator.
    if (state.muted) text('MUTED (M)', w - 24, h - 110, 12, '#e5534b', 'right', true);
    // "Press E" prompt when a car is near on foot.
    if (!state.playerCar && state.nearCar && !state.player.dead) {
      const px = state.player.x;
      const py = state.player.y;
      const sx = px - state.camera.x + w / 2;
      const sy = py - state.camera.y + h / 2;
      panel(sx - 92, sy - 58, 184, 30, 'rgba(15,18,26,0.85)', '#e8b73a');
      text(state.nearCar.occupied ? 'Press E to steal car' : 'Press E to drive', sx, sy - 36, 13, '#fff', 'center', true);
    }
  }

  function drawCenterPanel(title, lines, prompt, accent) {
    begin();
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fillRect(0, 0, w, h);
    const pw = 640;
    const ph = 150 + lines.length * 30;
    panel(w / 2 - pw / 2, h / 2 - ph / 2, pw, ph, 'rgba(15,18,26,0.95)', accent || '#e8b73a');
    text(title, w / 2, h / 2 - ph / 2 + 64, 44, accent || '#e8b73a', 'center', true);
    lines.forEach((line, i) => {
      text(line.text, w / 2, h / 2 - ph / 2 + 116 + i * 30, line.size || 17, line.color || '#dfe3e8', 'center');
    });
    if (prompt) text(prompt, w / 2, h / 2 + ph / 2 - 26, 16, '#e8b73a', 'center', true);
  }

  function drawTitle(state, save) {
    begin();
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.fillStyle = 'rgba(8,10,16,0.55)';
    ctx.fillRect(0, 0, w, h);
    // Sun.
    const sunX = w * 0.72;
    const sunY = h * 0.3;
    const grad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 190);
    grad.addColorStop(0, 'rgba(255,200,90,0.95)');
    grad.addColorStop(0.5, 'rgba(255,140,60,0.45)');
    grad.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
    ctx.fill();
    text('SUNSET HARBOR', w / 2, h * 0.30, 64, '#ffd94d', 'center', true);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 6;
    ctx.strokeText('SUNSET HARBOR', w / 2, h * 0.30);
    text('An open-world crime story in a sun-soaked coastal city', w / 2, h * 0.30 + 38, 19, '#fff', 'center');
    const lines = [
      { text: 'Steal cars. Outrun the cops. Run five jobs for Marla and own the city.', size: 17 },
      { text: '', size: 12 },
      { text: 'WASD / arrows — move & drive      E — enter / steal car      F — punch', size: 15, color: '#cfd3da' },
      { text: 'Mouse aim + click — shoot      R — reload      Shift — sprint      Space — handbrake', size: 15, color: '#cfd3da' },
      { text: 'P — pause      M — mute      T — courier run at the plaza', size: 15, color: '#cfd3da' },
    ];
    if (save && save.missionsDone > 0) {
      lines.push({ text: `Save found: ${save.missionsDone}/5 jobs done, $${save.cash} in pocket.`, size: 16, color: '#7fbf5a' });
    }
    const pw = 680;
    const ph = 120 + lines.length * 30;
    panel(w / 2 - pw / 2, h * 0.44, pw, ph, 'rgba(15,18,26,0.88)', '#e8b73a');
    lines.forEach((line, i) => {
      text(line.text, w / 2, h * 0.44 + 52 + i * 30, line.size || 16, line.color || '#dfe3e8', 'center');
    });
    const prompt = save && save.missionsDone > 0
      ? 'ENTER — continue your story      N — start fresh'
      : 'ENTER or click — start a new story';
    text(prompt, w / 2, h * 0.44 + ph + 44, 18, '#e8b73a', 'center', true);
    text('A completely original game. No real places, people or brands — only Sunset Harbor.', w / 2, h - 24, 13, 'rgba(255,255,255,0.6)', 'center');
  }

  return { drawHud, drawTitle, drawCenterPanel, text, panel };
}
