// Sunset Harbor — all sound is synthesized with WebAudio: no audio files,
// no network. Engine hum, sirens, gunshots, punches, pickups and UI blips
// are oscillators and filtered noise, mixed through one master gain.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;
  let sirenOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a triangle that wails between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 750;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch { /* audio is cosmetic; never break the game */ }
  }

  function noiseBurst(dur, vol, cutoff) {
    if (!ensure()) return;
    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff || 1200;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.3;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch { /* cosmetic */ }
  }

  return {
    resume,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    // Called every frame while driving: pitch and loudness follow speed.
    setEngine(speedRatio, driving) {
      if (!ensure()) return;
      const target = driving ? 0.05 + speedRatio * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, ctx.currentTime, 0.08);
    },
    // Called every frame: siren wails only while police are close.
    setSiren(active, dt) {
      sirenOn = active;
      if (!ensure()) return;
      if (active) {
        sirenTimer += dt;
        const high = Math.floor(sirenTimer * 1.6) % 2 === 0;
        sirenOsc.frequency.setTargetAtTime(high ? 880 : 620, ctx.currentTime, 0.05);
        sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
      } else {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      }
    },
    shot() {
      noiseBurst(0.14, 0.5, 2600);
      tone(180, 0.08, 'square', 0.22, 60);
    },
    punch() {
      noiseBurst(0.09, 0.3, 700);
    },
    hit() {
      tone(140, 0.12, 'sawtooth', 0.2, 70);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.25);
      setTimeout(() => tone(1318, 0.12, 'sine', 0.22), 70);
    },
    cash() {
      tone(1046, 0.08, 'sine', 0.22);
      setTimeout(() => tone(1568, 0.14, 'sine', 0.2), 80);
    },
    crash() {
      noiseBurst(0.25, 0.5, 500);
      tone(90, 0.2, 'sawtooth', 0.25, 40);
    },
    skid() {
      noiseBurst(0.12, 0.12, 1800);
    },
    uiClick() {
      tone(660, 0.06, 'sine', 0.18);
    },
    missionStart() {
      [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.22), i * 110));
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.24), i * 120));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.22), i * 140));
    },
    wantedUp() {
      tone(440, 0.1, 'square', 0.18, 880);
    },
    busted() {
      [330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.18), i * 180));
    },
  };
}
