// Procedural sound effects via Web Audio API.
// No external assets — all sounds synthesized at runtime.
// AudioContext is lazily created on first user gesture to comply with
// browser autoplay policies (iOS Safari, Chrome). Calls before that
// gesture are no-ops.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;
let unlocked = false;

// Continuous-loop nodes for siren — kept around so we can stop them
let sirenOsc1: OscillatorNode | null = null;
let sirenOsc2: OscillatorNode | null = null;
let sirenGain: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

// Call from a user-gesture handler (pointerdown/click) to unlock iOS Safari + Chrome.
export function unlockAudio(): void {
  if (unlocked) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') {
    c.resume().catch(() => { /* ignore */ });
  }
  // Play a silent buffer to fully unlock iOS
  try {
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  } catch { /* ignore */ }
  unlocked = true;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (masterGain) masterGain.gain.value = m ? 0 : 0.5;
}

export function isMuted(): boolean {
  return muted;
}

// Short percussive tap — for any button press.
export function click(): void {
  if (muted) return;
  const c = getCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(900, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
  env.gain.setValueAtTime(0.18, now);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  osc.connect(env).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.07);
}

// Higher-pitched confirmation beep — for RIDS check, dispatch lock-on, etc.
export function beep(): void {
  if (muted) return;
  const c = getCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(1800, now + 0.08);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(env).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.2);
}

// Score-up zap — bright sweep upward for points awarded.
export function zap(): void {
  if (muted) return;
  const c = getCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(2400, now + 0.18);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  osc.connect(env).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.27);
}

// Low thud / collision — filtered noise burst.
export function thud(): void {
  if (muted) return;
  const c = getCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const buffer = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(220, now);
  filter.frequency.exponentialRampToValueAtTime(80, now + 0.25);
  const env = c.createGain();
  env.gain.setValueAtTime(0.4, now);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  noise.connect(filter).connect(env).connect(masterGain);
  noise.start(now);
  noise.stop(now + 0.32);
}

// Looping two-tone siren — call sirenStart() on activate, sirenStop() on deactivate.
export function sirenStart(): void {
  if (muted || sirenOsc1) return; // already playing
  const c = getCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  sirenGain = c.createGain();
  sirenGain.gain.value = 0.12;
  sirenGain.connect(masterGain);

  // Two oscillators alternating in volume to create the wail
  sirenOsc1 = c.createOscillator();
  sirenOsc1.type = 'sawtooth';
  sirenOsc1.frequency.value = 900;
  const g1 = c.createGain();
  g1.gain.setValueCurveAtTime(buildSirenCurve(true), now, 1.4);
  // Use periodic schedule for continuous wail
  scheduleSirenLoop(c, g1, true, now);
  sirenOsc1.connect(g1).connect(sirenGain);
  sirenOsc1.start(now);

  sirenOsc2 = c.createOscillator();
  sirenOsc2.type = 'sawtooth';
  sirenOsc2.frequency.value = 650;
  const g2 = c.createGain();
  g2.gain.setValueCurveAtTime(buildSirenCurve(false), now, 1.4);
  scheduleSirenLoop(c, g2, false, now);
  sirenOsc2.connect(g2).connect(sirenGain);
  sirenOsc2.start(now);
}

function buildSirenCurve(highFirst: boolean): Float32Array {
  // 64 samples over 1.4s — alternating gain envelope for one wail cycle
  const arr = new Float32Array(64);
  for (let i = 0; i < arr.length; i++) {
    const t = i / arr.length;
    const phase = highFirst ? Math.sin(t * Math.PI) : Math.sin((t + 0.5) * Math.PI);
    arr[i] = Math.max(0, phase) * 0.9;
  }
  return arr;
}

function scheduleSirenLoop(c: AudioContext, g: GainNode, highFirst: boolean, startTime: number): void {
  // Schedule the wail curve to repeat for ~4s; sirenStop will tear down before that
  const cycle = 1.4;
  for (let i = 1; i < 4; i++) {
    g.gain.setValueCurveAtTime(buildSirenCurve(highFirst), startTime + i * cycle, cycle);
  }
}

export function sirenStop(): void {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  if (sirenGain) {
    sirenGain.gain.cancelScheduledValues(now);
    sirenGain.gain.setValueAtTime(sirenGain.gain.value, now);
    sirenGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  }
  if (sirenOsc1) {
    try { sirenOsc1.stop(now + 0.1); } catch { /* ignore */ }
    sirenOsc1 = null;
  }
  if (sirenOsc2) {
    try { sirenOsc2.stop(now + 0.1); } catch { /* ignore */ }
    sirenOsc2 = null;
  }
  sirenGain = null;
}
