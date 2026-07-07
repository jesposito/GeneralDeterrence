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
let sirenLfo: OscillatorNode | null = null;

// Ambient music-pad nodes.
let musicOscs: OscillatorNode[] = [];
let musicGain: GainNode | null = null;
let musicFilter: BiquadFilterNode | null = null;
let musicLfo: OscillatorNode | null = null;

// Continuous engine drone nodes — kept around so we can modulate + stop
let engineOsc: OscillatorNode | null = null;
let engineFilter: BiquadFilterNode | null = null;
let engineGain: GainNode | null = null;

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

// Short metronome tick — for time-pressure countdown in the final seconds of a shift.
// Reuses masterGain + the muted check via the early-return guard.
export function tick(pitchHz = 800): void {
  if (muted) return;
  const c = getCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(pitchHz, now);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  osc.connect(env).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.06);
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

// Looping two-tone siren driven by one continuous LFO sweeping the oscillator
// frequencies. No finite scheduling, so it never decays into a dead tone (the old
// setValueCurve loop only covered ~5.6s). sirenStart() on activate, sirenStop() to end.
export function sirenStart(): void {
  if (muted || sirenOsc1) return; // already playing
  const c = getCtx();
  if (!c || !masterGain) return;
  sirenGain = c.createGain();
  sirenGain.gain.value = 0.12;
  sirenGain.connect(masterGain);

  sirenLfo = c.createOscillator();
  sirenLfo.type = 'sine';
  sirenLfo.frequency.value = 0.9; // ~1.1s per wail cycle

  // High wail voice: centre 760 Hz, swept +/- 220 Hz.
  sirenOsc1 = c.createOscillator();
  sirenOsc1.type = 'sawtooth';
  sirenOsc1.frequency.value = 760;
  const depth1 = c.createGain();
  depth1.gain.value = 220;
  sirenLfo.connect(depth1).connect(sirenOsc1.frequency);
  sirenOsc1.connect(sirenGain);

  // Low body voice an octave down, swept less, quieter.
  sirenOsc2 = c.createOscillator();
  sirenOsc2.type = 'square';
  sirenOsc2.frequency.value = 400;
  const depth2 = c.createGain();
  depth2.gain.value = 90;
  sirenLfo.connect(depth2).connect(sirenOsc2.frequency);
  const g2 = c.createGain();
  g2.gain.value = 0.45;
  sirenOsc2.connect(g2).connect(sirenGain);

  sirenLfo.start();
  sirenOsc1.start();
  sirenOsc2.start();
}

// Continuous engine drone tied to player speed.
// engineStart() lazily creates the oscillator chain. setEngineLevel(0..1) modulates
// frequency + gain. engineStop() tears down. Idempotent — safe to call repeatedly.
export function engineStart(): void {
  if (muted || engineOsc) return;
  const c = getCtx();
  if (!c || !masterGain) return;
  engineGain = c.createGain();
  engineGain.gain.value = 0.04;
  engineFilter = c.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 600;
  engineFilter.Q.value = 4;
  engineOsc = c.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 80;
  engineOsc.connect(engineFilter).connect(engineGain).connect(masterGain);
  engineOsc.start();
}

export function setEngineLevel(level: number): void {
  if (!engineOsc || !engineGain || !engineFilter) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const lv = Math.max(0, Math.min(1, level));
  // Idle 80 Hz → max 240 Hz (3x range, sounds like an engine revving)
  const targetFreq = 80 + lv * 160;
  // Gain 0.04 idle → 0.14 max (low background; doesn't drown discrete sounds)
  const targetGain = 0.04 + lv * 0.10;
  // Filter cutoff opens with revving for brighter sound
  const targetCutoff = 600 + lv * 1400;
  engineOsc.frequency.linearRampToValueAtTime(targetFreq, now + 0.1);
  engineGain.gain.linearRampToValueAtTime(targetGain, now + 0.1);
  engineFilter.frequency.linearRampToValueAtTime(targetCutoff, now + 0.1);
}

export function engineStop(): void {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  if (engineGain) {
    engineGain.gain.cancelScheduledValues(now);
    engineGain.gain.setValueAtTime(engineGain.gain.value, now);
    engineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
  }
  if (engineOsc) {
    try { engineOsc.stop(now + 0.2); } catch { /* ignore */ }
    engineOsc = null;
  }
  engineFilter = null;
  engineGain = null;
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
  if (sirenLfo) {
    try { sirenLfo.stop(now + 0.1); } catch { /* ignore */ }
    sirenLfo = null;
  }
  sirenGain = null;
}

// Soft high blip for collecting a deterrence pickup (kept quiet — collected often).
export function pickup(): void {
  if (muted) return;
  const c = getCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1400, now);
  osc.frequency.exponentialRampToValueAtTime(2100, now + 0.06);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
  osc.connect(env).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.12);
}

// Ambient minor-chord pad bed — low, slow, non-intrusive. A very slow LFO opens/closes
// the filter for gentle movement. musicStart() on shift start, musicStop() on end.
export function musicStart(): void {
  if (muted || musicGain) return;
  const c = getCtx();
  if (!c || !masterGain) return;
  musicGain = c.createGain();
  musicGain.gain.value = 0.06;
  musicFilter = c.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = 500;
  musicFilter.Q.value = 2;
  musicFilter.connect(musicGain).connect(masterGain);

  // A-minor pad: A2, E3, A3, C4.
  for (const f of [110, 164.81, 220, 261.63]) {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 0.25;
    osc.connect(g).connect(musicFilter);
    osc.start();
    musicOscs.push(osc);
  }

  musicLfo = c.createOscillator();
  musicLfo.type = 'sine';
  musicLfo.frequency.value = 0.05; // ~20s cycle
  const depth = c.createGain();
  depth.gain.value = 350;
  musicLfo.connect(depth).connect(musicFilter.frequency);
  musicLfo.start();
}

export function musicStop(): void {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  if (musicGain) {
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  }
  for (const osc of musicOscs) {
    try { osc.stop(now + 0.5); } catch { /* ignore */ }
  }
  musicOscs = [];
  if (musicLfo) {
    try { musicLfo.stop(now + 0.5); } catch { /* ignore */ }
    musicLfo = null;
  }
  musicFilter = null;
  musicGain = null;
}
