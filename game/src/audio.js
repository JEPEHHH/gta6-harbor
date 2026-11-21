// WebAudio synthesis: engine, siren, gunshots, radio sting, footsteps, horn, skid.
// No audio files — everything is built from oscillators, noise and filters.
// One job: make the game sound good with zero external assets.

const AC_OPTS = { latencyHint: 'interactive', sampleRate: 44100 };

let ctx = null;
let masterGain = null;
let started = false;

/** Lazy-init the AudioContext on the first user gesture. */
function ensureCtx() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)(AC_OPTS);
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.4;
    masterGain.connect(ctx.destination);
    started = true;
    return true;
  } catch {
    return false;
  }
}

/** Resume on user gesture (Chrome autoplay policy). */
export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

// ── Engine drone ──────────────────────────────────────────────

let engineOsc = null;
let engineGain = null;

export function startEngine() {
  if (!ensureCtx()) return;
  if (engineOsc) return;
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 60;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  engineOsc.connect(filter);
  filter.connect(engineGain);
  engineGain.connect(masterGain);
  engineOsc.start();
}

export function updateEngine(rpm, throttle) {
  if (!engineOsc) return;
  // rpm 0..1 maps to 55–180 Hz, throttle adds volume
  engineOsc.frequency.value = 55 + rpm * 125;
  engineGain.gain.value = 0.06 + throttle * 0.08;
}

export function stopEngine() {
  if (engineOsc) {
    try { engineOsc.stop(); } catch { /* already stopped */ }
    engineOsc = null;
  }
  if (engineGain) {
    engineGain.disconnect();
    engineGain = null;
  }
}

// ── Siren ─────────────────────────────────────────────────────

let sirenOsc = null;
let sirenGain = null;
let sirenLfo = null;

export function startSiren() {
  if (!ensureCtx()) return;
  if (sirenOsc) return;
  sirenOsc = ctx.createOscillator();
  sirenOsc.type = 'sine';
  sirenOsc.frequency.value = 650;
  sirenGain = ctx.createGain();
  sirenGain.gain.value = 0.07;
  sirenLfo = ctx.createOscillator();
  sirenLfo.type = 'sine';
  sirenLfo.frequency.value = 2.2;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 250;
  sirenLfo.connect(lfoGain);
  lfoGain.connect(sirenOsc.frequency);
  sirenOsc.connect(sirenGain);
  sirenGain.connect(masterGain);
  sirenOsc.start();
  sirenLfo.start();
}

export function stopSiren() {
  if (sirenOsc) {
    try { sirenOsc.stop(); } catch { /* ok */ }
    sirenOsc = null;
  }
  if (sirenLfo) {
    try { sirenLfo.stop(); } catch { /* ok */ }
    sirenLfo = null;
  }
  if (sirenGain) {
    sirenGain.disconnect();
    sirenGain = null;
  }
}

// ── One-shot sound effects ────────────────────────────────────

/** Gunshot: sharp noise burst. */
export function playGunshot() {
  if (!ensureCtx()) return;
  const dur = 0.08;
  const bufSize = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i += 1) {
    const t = i / bufSize;
    data[i] = (Math.random() * 2 - 1) * (1 - t) * (1 - t);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = 0.18;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 800;
  src.connect(f);
  f.connect(g);
  g.connect(masterGain);
  src.start();
}

/** Horn: a brief tone. */
export function playHorn() {
  if (!ensureCtx()) return;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 320;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.1, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.connect(g);
  g.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}

/** Footstep: low thud. */
export function playFootstep() {
  if (!ensureCtx()) return;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 80 + Math.random() * 40;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.04, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc.connect(g);
  g.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

/** Skid / tyre squeal. */
export function playSkid() {
  if (!ensureCtx()) return;
  const dur = 0.3;
  const bufSize = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i += 1) {
    const t = i / bufSize;
    data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - t * 2) * 0.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2200;
  f.Q.value = 3;
  const g = ctx.createGain();
  g.gain.value = 0.06;
  src.connect(f);
  f.connect(g);
  g.connect(masterGain);
  src.start();
}

/** Impact thud. */
export function playImpact() {
  if (!ensureCtx()) return;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(g);
  g.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.22);
}

/** Radio sting: ascending arpeggio. */
export function playRadioSting() {
  if (!ensureCtx()) return;
  const notes = [440, 554, 659, 880];
  for (let i = 0; i < notes.length; i += 1) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = notes[i];
    const g = ctx.createGain();
    const start = ctx.currentTime + i * 0.1;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.06, start + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(start);
    osc.stop(start + 0.22);
  }
}

/** Pickup collect sound. */
export function playPickup() {
  if (!ensureCtx()) return;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(g);
  g.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.22);
}

/** Busted / wasted jingle. */
export function playWasted() {
  if (!ensureCtx()) return;
  const notes = [440, 370, 310, 260];
  for (let i = 0; i < notes.length; i += 1) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = notes[i];
    const g = ctx.createGain();
    const start = ctx.currentTime + i * 0.2;
    g.gain.setValueAtTime(0.08, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(start);
    osc.stop(start + 0.4);
  }
}
