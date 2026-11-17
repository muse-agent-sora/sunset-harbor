// Sunset Harbor — synthesized sound. No audio files: every effect is built from
// WebAudio oscillators and noise buffers, so the game makes no network requests
// and ships no samples. The engine hum, sirens, gunshots, pickups and UI blips
// are all small functions over one AudioContext, created lazily on first input.
let ctx = null;
let master = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let sirenOscA = null;
let sirenOscB = null;
let sirenGain = null;
let sirenTimer = 0;

function ensureContext() {
  if (ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return true;
  } catch {
    return false;
  }
}

/** Call once from a user gesture (or the first key press) to unlock audio. */
export function unlockAudio() {
  if (!ensureContext()) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

/** True while the player has muted with M. */
export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  if (master && ctx) master.gain.value = muted ? 0 : 0.5;
}

function noiseBuffer(seconds) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function blip(freq, duration, type, volume, slideTo) {
  if (!ensureContext() || muted) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noiseBurst(duration, volume, filterFreq) {
  if (!ensureContext() || muted) return;
  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(duration + 0.05);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(now);
  source.stop(now + duration + 0.05);
}

export const sfx = {
  shoot() {
    noiseBurst(0.12, 0.5, 3200);
    blip(220, 0.08, 'square', 0.25, 60);
  },
  punch() {
    noiseBurst(0.09, 0.35, 900);
  },
  hit() {
    blip(140, 0.12, 'sawtooth', 0.3, 70);
  },
  pickup() {
    blip(660, 0.09, 'sine', 0.35);
    setTimeout(() => blip(990, 0.14, 'sine', 0.3), 70);
  },
  cash() {
    blip(880, 0.08, 'triangle', 0.35);
    setTimeout(() => blip(1174, 0.12, 'triangle', 0.3), 60);
    setTimeout(() => blip(1568, 0.16, 'triangle', 0.25), 120);
  },
  mission() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.32), i * 90));
  },
  fail() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sawtooth', 0.22), i * 130));
  },
  ui() {
    blip(520, 0.06, 'sine', 0.25);
  },
  enterCar() {
    blip(180, 0.12, 'triangle', 0.3, 320);
  },
  crash() {
    noiseBurst(0.25, 0.55, 500);
    blip(90, 0.2, 'sawtooth', 0.3, 40);
  },
  reload() {
    blip(300, 0.05, 'square', 0.2);
    setTimeout(() => blip(420, 0.05, 'square', 0.2), 120);
  },
  checkpoint() {
    blip(740, 0.1, 'sine', 0.35);
    setTimeout(() => blip(1108, 0.18, 'sine', 0.3), 80);
  },
  arrest() {
    [660, 520, 440].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'square', 0.2), i * 160));
  },
};

/** Continuous engine hum: call every frame with speed 0..1 (0 = off). */
export function engineSound(speedRatio, on) {
  if (!ensureContext()) return;
  if (!on || muted || speedRatio <= 0.01) {
    if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    return;
  }
  if (!engineOsc) {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }
  const now = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(50 + speedRatio * 160, now, 0.05);
  engineGain.gain.setTargetAtTime(0.05 + speedRatio * 0.07, now, 0.08);
}

/** Two-tone police siren that wails while any police unit is close. */
export function sirenSound(active, dt) {
  if (!ensureContext()) return;
  if (!active || muted) {
    if (sirenGain) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    return;
  }
  if (!sirenOscA) {
    sirenOscA = ctx.createOscillator();
    sirenOscA.type = 'triangle';
    sirenOscA.frequency.value = 700;
    sirenOscB = ctx.createOscillator();
    sirenOscB.type = 'triangle';
    sirenOscB.frequency.value = 950;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOscA.connect(sirenGain);
    sirenOscB.connect(sirenGain);
    sirenGain.connect(master);
    sirenOscA.start();
    sirenOscB.start();
  }
  sirenTimer += dt;
  const high = Math.floor(sirenTimer / 0.45) % 2 === 0;
  const now = ctx.currentTime;
  sirenOscA.frequency.setTargetAtTime(high ? 950 : 700, now, 0.03);
  sirenOscB.frequency.setTargetAtTime(high ? 700 : 950, now, 0.03);
  sirenGain.gain.setTargetAtTime(0.045, now, 0.1);
}
