// Sunset Harbor — drawing the world: ground, roads, buildings, cars, people,
// particles and the golden-hour light. Everything is canvas 2D, drawn from
// the world state each frame, culled to the camera's view.
import { BEACH_TOP, COLORS, DISTRICTS, HARBOR_LEFT, ROAD_W, ROAD_X, ROAD_Y, VIEW_H, VIEW_W, WATER_TOP, WORLD_H, WORLD_W } from './config.js';
import { lightFor } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: VIEW_W, h: VIEW_H, dpr: 1 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    view.dpr = dpr;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function inView(x, y, margin, cam) {
    return x > cam.x - view.w / 2 - margin && x < cam.x + view.w / 2 + margin
      && y > cam.y - view.h / 2 - margin && y < cam.y + view.h / 2 + margin;
  }

  function drawGround(state, cam) {
    const city = state.city;
    // Grass base.
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(cam.x - view.w / 2 - 20, cam.y - view.h / 2 - 20, view.w + 40, view.h + 40);
    // Beach sand and water along the south and east edges.
    if (cam.y + view.h / 2 > BEACH_TOP) {
      ctx.fillStyle = COLORS.sand;
      ctx.fillRect(cam.x - view.w / 2 - 20, BEACH_TOP, view.w + 40, WATER_TOP - BEACH_TOP);
    }
    if (cam.y + view.h / 2 > WATER_TOP || cam.x + view.w / 2 > HARBOR_LEFT) {
      ctx.fillStyle = COLORS.water;
      ctx.fillRect(Math.max(cam.x - view.w / 2 - 20, HARBOR_LEFT), Math.max(cam.y - view.h / 2 - 20, WATER_TOP), view.w + 40, view.h + 40);
      ctx.fillStyle = COLORS.waterDeep;
      ctx.fillRect(cam.x - view.w / 2 - 20, WATER_TOP, view.w + 40, view.h + 40);
      // Wave lines.
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      const t = state.time;
      for (let i = 0; i < 8; i += 1) {
        const wy = WATER_TOP + 18 + i * 26;
        if (wy < cam.y - view.h / 2 || wy > cam.y + view.h / 2) continue;
        ctx.beginPath();
        for (let x = cam.x - view.w / 2; x < cam.x + view.w / 2; x += 40) {
          const y = wy + Math.sin(x * 0.02 + t * 1.4 + i) * 3;
          if (x === cam.x - view.w / 2) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // Parks.
    for (const park of city.parks) {
      if (!inView(park.x + park.w / 2, park.y + park.h / 2, 100, cam)) continue;
      ctx.fillStyle = COLORS.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // District name labels, faint, on the ground.
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.font = `bold 26px ${FONT}`;
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const cx = d.x + d.w / 2;
      const cy = d.y + d.h / 2;
      if (inView(cx, cy, 200, cam)) ctx.fillText(d.name.toUpperCase(), cx, cy);
    }
  }

  function drawRoads(state, cam) {
    const city = state.city;
    ctx.fillStyle = COLORS.road;
    for (const rx of ROAD_X) {
      if (rx < cam.x - view.w / 2 - 60 || rx > cam.x + view.w / 2 + 60) continue;
      ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, BEACH_TOP);
    }
    for (const ry of ROAD_Y) {
      if (ry < cam.y - view.h / 2 - 60 || ry > cam.y + view.h / 2 + 60) continue;
      ctx.fillRect(0, ry - ROAD_W / 2, HARBOR_LEFT, ROAD_W);
    }
    // Sidewalk edges.
    ctx.fillStyle = COLORS.sidewalk;
    for (const rx of ROAD_X) {
      if (rx < cam.x - view.w / 2 - 60 || rx > cam.x + view.w / 2 + 60) continue;
      ctx.fillRect(rx - ROAD_W / 2 - 8, 0, 8, BEACH_TOP);
      ctx.fillRect(rx + ROAD_W / 2, 0, 8, BEACH_TOP);
    }
    for (const ry of ROAD_Y) {
      if (ry < cam.y - view.h / 2 - 60 || ry > cam.y + view.h / 2 + 60) continue;
      ctx.fillRect(0, ry - ROAD_W / 2 - 8, HARBOR_LEFT, 8);
      ctx.fillRect(0, ry + ROAD_W / 2, HARBOR_LEFT, 8);
    }
    // Dashed centre lines.
    ctx.fillStyle = COLORS.lane;
    for (const rx of ROAD_X) {
      if (rx < cam.x - view.w / 2 - 60 || rx > cam.x + view.w / 2 + 60) continue;
      for (let y = 0; y < BEACH_TOP; y += 44) {
        if (y < cam.y - view.h / 2 - 20 || y > cam.y + view.h / 2 + 20) continue;
        ctx.fillRect(rx - 2, y, 4, 22);
      }
    }
    for (const ry of ROAD_Y) {
      if (ry < cam.y - view.h / 2 - 60 || ry > cam.y + view.h / 2 + 60) continue;
      for (let x = 0; x < HARBOR_LEFT; x += 44) {
        if (x < cam.x - view.w / 2 - 20 || x > cam.x + view.w / 2 + 20) continue;
        ctx.fillRect(x, ry - 2, 22, 4);
      }
    }
    // Traffic lights at intersections.
    for (const light of city.lights) {
      if (!inView(light.x, light.y, 60, cam)) continue;
      const ns = lightFor(light, 'x', state.time) === 'green';
      ctx.fillStyle = '#22242a';
      ctx.fillRect(light.x - 22, light.y - 22, 10, 26);
      ctx.fillRect(light.x + 12, light.y - 4, 10, 26);
      ctx.fillStyle = ns ? '#39d353' : '#e5534b';
      ctx.beginPath();
      ctx.arc(light.x - 17, light.y - 15, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ns ? '#e5534b' : '#39d353';
      ctx.beginPath();
      ctx.arc(light.x + 17, light.y + 3, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBuildings(state, cam) {
    const city = state.city;
    for (const b of city.buildings) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, 120, cam)) continue;
      // Long sunset shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 10 + b.height * 3, b.y + 8 + b.height * 3, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      // Windows on the roof face.
      ctx.fillStyle = 'rgba(255,240,200,0.75)';
      const cols = Math.max(1, Math.floor((b.w - 20) / 22));
      const rows = Math.max(1, Math.floor((b.h - 20) / 22));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i * 7 + j * 3 + b.height) % 3 === 0) continue;
          ctx.fillRect(b.x + 12 + i * 22, b.y + 12 + j * 22, 10, 8);
        }
      }
    }
    // Trees and palms.
    for (const tree of city.trees) {
      if (!inView(tree.x, tree.y, 30, cam)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(tree.x + 4, tree.y + 5, tree.r, tree.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.tree;
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.treeLight;
      ctx.beginPath();
      ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const palm of city.palms) {
      if (!inView(palm.x, palm.y, 30, cam)) continue;
      ctx.strokeStyle = '#8a6a4f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y + 8);
      ctx.lineTo(palm.x, palm.y - 6);
      ctx.stroke();
      ctx.fillStyle = '#4f8a3f';
      ctx.beginPath();
      ctx.arc(palm.x, palm.y - 8, palm.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Piers and boats.
    ctx.fillStyle = '#8a6a4f';
    for (const pier of city.piers) {
      if (!inView(pier.x + pier.w / 2, pier.y, 100, cam)) continue;
      ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let x = pier.x + 12; x < pier.x + pier.w; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, pier.y);
        ctx.lineTo(x, pier.y + pier.h);
        ctx.stroke();
      }
    }
    for (const boat of city.boats) {
      if (!inView(boat.x, boat.y, 40, cam)) continue;
      ctx.save();
      ctx.translate(boat.x, boat.y);
      ctx.rotate(boat.angle);
      ctx.fillStyle = boat.color;
      roundRect(-22, -8, 44, 16, 6);
      ctx.fill();
      ctx.fillStyle = '#2a2f38';
      ctx.fillRect(-6, -5, 12, 10);
      ctx.restore();
    }
  }

  function drawCar(car, state, cam) {
    if (!inView(car.x, car.y, 60, cam)) return;
    const spec = car.spec;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(-spec.length / 2 + 3, -spec.width / 2 + 4, spec.length, spec.width, 8);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#14161a';
    const wl = spec.length / 2 - 8;
    const ww = spec.width / 2 - 1;
    ctx.fillRect(-wl - 4, -ww - 3, 10, 6);
    ctx.fillRect(-wl - 4, ww - 3, 10, 6);
    ctx.fillRect(wl - 6, -ww - 3, 10, 6);
    ctx.fillRect(wl - 6, ww - 3, 10, 6);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(-spec.length / 2, -spec.width / 2, spec.length, spec.width, 7);
    ctx.fill();
    // Roof and windshield.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(-spec.length / 6, -spec.width / 2 + 3, spec.length / 3, spec.width - 6, 4);
    ctx.fill();
    ctx.fillStyle = '#bfe3f0';
    ctx.fillRect(spec.length / 6, -spec.width / 2 + 3, 5, spec.width - 6);
    ctx.fillRect(-spec.length / 6 - 5, -spec.width / 2 + 3, 4, spec.width - 6);
    // Headlights.
    ctx.fillStyle = '#fff6c8';
    ctx.fillRect(spec.length / 2 - 2, -spec.width / 2 + 2, 3, 4);
    ctx.fillRect(spec.length / 2 - 2, spec.width / 2 - 6, 3, 4);
    if (car.brakeLight) {
      ctx.fillStyle = '#ff2a2a';
      ctx.fillRect(-spec.length / 2 - 1, -spec.width / 2 + 2, 3, 4);
      ctx.fillRect(-spec.length / 2 - 1, spec.width / 2 - 6, 3, 4);
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#222';
      for (let i = 0; i < 5; i += 1) ctx.fillRect(-spec.length / 2 + 6 + i * 7, -2, 4, 4);
    }
    if (car.type === 'police') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-spec.length / 6, -spec.width / 2, spec.length / 3, 4);
      ctx.fillRect(-spec.length / 6, spec.width / 2 - 4, spec.length / 3, 4);
      const flash = Math.floor(state.time * 6 + car.sirenPhase) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
      ctx.beginPath();
      ctx.arc(-2, -spec.width / 2 + 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flash ? '#2a6aff' : '#ff2a2a';
      ctx.beginPath();
      ctx.arc(6, -spec.width / 2 + 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car.wrecked) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(-spec.length / 2, -spec.width / 2, spec.length, spec.width, 7);
      ctx.fill();
    }
    ctx.restore();
    // Smoke from a damaged car.
    if (!car.wrecked && car.health < (car.maxHealth || 100) * 0.4 && Math.random() < 0.06) {
      ctx.fillStyle = 'rgba(90,90,90,0.5)';
      ctx.beginPath();
      ctx.arc(car.x + (Math.random() - 0.5) * 10, car.y + (Math.random() - 0.5) * 10, 6 + Math.random() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPerson(person, cam, isPlayer) {
    if (!person.alive || !inView(person.x, person.y, 30, cam)) return;
    const flash = person.hitFlash > 0 && Math.floor(person.hitFlash * 20) % 2 === 0;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(person.x + 2, person.y + 4, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(person.x, person.y);
    ctx.rotate(person.angle);
    ctx.fillStyle = flash ? '#ffffff' : person.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : person.skin;
    ctx.beginPath();
    ctx.arc(6, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // A gun in hand for armed thugs and the player when shooting.
    if ((person.kind === 'thug' && person.armed) || isPlayer) {
      ctx.fillStyle = '#22242a';
      ctx.fillRect(8, -2, 10, 4);
    }
    ctx.restore();
    if (person.kind === 'cop') {
      ctx.fillStyle = '#d8d8d8';
      ctx.font = `bold 9px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', person.x, person.y - 16);
    }
  }

  function drawPickups(state, cam) {
    for (const pk of state.pickups) {
      if (!inView(pk.x, pk.y, 30, cam)) continue;
      const bob = Math.sin(state.time * 3 + pk.bob) * 3;
      ctx.fillStyle = '#2a7a3a';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7fbf5a';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + bob + 4);
    }
    for (const crate of state.crates) {
      if (!inView(crate.x, crate.y, 30, cam)) continue;
      ctx.fillStyle = '#8a6a3f';
      ctx.fillRect(crate.x - 11, crate.y - 11, 22, 22);
      ctx.strokeStyle = '#5a4226';
      ctx.lineWidth = 2;
      ctx.strokeRect(crate.x - 11, crate.y - 11, 22, 22);
      ctx.beginPath();
      ctx.moveTo(crate.x - 11, crate.y - 11);
      ctx.lineTo(crate.x + 11, crate.y + 11);
      ctx.moveTo(crate.x + 11, crate.y - 11);
      ctx.lineTo(crate.x - 11, crate.y + 11);
      ctx.stroke();
    }
  }

  function drawMissionMarker(state, cam) {
    const marker = state.missionMarker;
    if (!marker) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.12;
    // A beacon column and a bouncing arrow above the marker.
    const grad = ctx.createLinearGradient(marker.x, marker.y - 130, marker.x, marker.y);
    grad.addColorStop(0, 'rgba(232,183,58,0)');
    grad.addColorStop(1, 'rgba(232,183,58,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(marker.x - 7, marker.y - 130, 14, 130);
    ctx.fillStyle = '#e8b73a';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 10 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5a00';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 5, 0, Math.PI * 2);
    ctx.fill();
    const ay = marker.y - 34 - Math.sin(state.time * 5) * 6;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(marker.x, ay + 12);
    ctx.lineTo(marker.x - 9, ay - 4);
    ctx.lineTo(marker.x + 9, ay - 4);
    ctx.closePath();
    ctx.fill();
  }

  // Draw the whole world from the camera, then the golden-hour tint.
  function drawWorld(state) {
    const cam = state.camera;
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const ox = view.w / 2 - cam.x + shakeX;
    const oy = view.h / 2 - cam.y + shakeY;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#1b1f2a';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, ox * view.dpr, oy * view.dpr);
    drawGround(state, cam);
    drawRoads(state, cam);
    drawBuildings(state, cam);
    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,20,0.4)';
    ctx.lineWidth = 5;
    for (const skid of state.skids) {
      if (!inView(skid.x, skid.y, 30, cam)) continue;
      ctx.globalAlpha = Math.min(1, skid.life / 3);
      ctx.beginPath();
      ctx.moveTo(skid.x - Math.cos(skid.angle) * 10, skid.y - Math.sin(skid.angle) * 10);
      ctx.lineTo(skid.x + Math.cos(skid.angle) * 10, skid.y + Math.sin(skid.angle) * 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawPickups(state, cam);
    drawMissionMarker(state, cam);
    for (const car of state.cars) drawCar(car, state, cam);
    for (const car of state.policeCars) drawCar(car, state, cam);
    for (const ped of state.peds) drawPerson(ped, cam, false);
    for (const cop of state.cops) drawPerson(cop, cam, false);
    // The player on foot (hidden while driving: they are inside the car).
    if (!state.playerCar) {
      const p = state.player;
      if (!p.dead) {
        const blink = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0;
        if (!blink) {
          drawPerson({ ...p, shirt: '#e8b73a', skin: '#e8b88a', kind: 'player', alive: true, hitFlash: 0 }, cam, true);
          // Aim line while the pistol is out.
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(p.aimAngle) * 46, p.y + Math.sin(p.aimAngle) * 46);
          ctx.stroke();
          // Punch swing.
          if (p.punchAnim > 0) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 26, p.aimAngle - 0.7, p.aimAngle + 0.7);
            ctx.stroke();
          }
        }
      }
    }
    // Bullets.
    ctx.fillStyle = '#ffe9a0';
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Particles.
    for (const part of state.particles) {
      const alpha = Math.max(0, part.life / part.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size * (part.kind === 'smoke' ? (1.6 - alpha * 0.6) : 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Muzzle flash glow.
    if (state.muzzleFlash > 0) {
      ctx.fillStyle = 'rgba(255,233,160,0.5)';
      const ox2 = state.playerCar ? state.playerCar.x : state.player.x;
      const oy2 = state.playerCar ? state.playerCar.y : state.player.y;
      ctx.beginPath();
      ctx.arc(ox2 + Math.cos(state.player.aimAngle) * 20, oy2 + Math.sin(state.player.aimAngle) * 20, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    // Golden-hour tint: warm at the edges, stronger as dusk approaches.
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const tint = 0.10 + state.dayTime * 0.10;
    const grad = ctx.createRadialGradient(view.w / 2, view.h * 0.35, view.h * 0.3, view.w / 2, view.h / 2, view.w * 0.75);
    grad.addColorStop(0, `rgba(255,170,80,${tint * 0.4})`);
    grad.addColorStop(1, `rgba(255,120,40,${tint})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);
    // Hurt flash.
    if (state.hurtFlash > 0) {
      ctx.fillStyle = `rgba(200,30,30,${state.hurtFlash * 0.5})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { drawWorld, view };
}
