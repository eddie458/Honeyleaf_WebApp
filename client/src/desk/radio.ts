// The little radio: soft music composed right here, as it plays, with the
// Web Audio API. No recordings and nothing from other sites: a felt-piano
// melody wanders over slow, warm chords (never quite the same twice), and
// the second station adds rain on the window. Starts only when you switch
// it on (browsers allow sound only after a tap or click).

import { create } from 'zustand';

export type Station = 'piano' | 'rain';

interface RadioState {
  playing: boolean;
  station: Station;
  /** 0..1 */
  volume: number;
  set(patch: Partial<Pick<RadioState, 'playing' | 'station' | 'volume'>>): void;
}

export const useRadio = create<RadioState>((set) => ({
  playing: false,
  station: 'piano',
  volume: 0.6,
  set: (patch) => set(patch),
}));

/* ----------------------------------------------------------- harmony */

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

interface Chord {
  /** MIDI notes for the warm pad (middle register). */
  pad: number[];
  /** Root for the soft bass. */
  root: number;
  /** Notes the melody leans on. */
  tones: number[];
}

// F major, gently: Fmaj7, Dm9, B♭maj7, C6sus, Am7, Gm9, B♭maj9, Csus4.
const C: Record<string, Chord> = {
  Fmaj7: { pad: [53, 57, 60, 64], root: 41, tones: [65, 69, 72, 76] },
  Dm9: { pad: [50, 57, 60, 64], root: 38, tones: [62, 65, 69, 72, 76] },
  Bbmaj7: { pad: [46, 53, 57, 62], root: 34, tones: [62, 65, 69, 70, 74] },
  C6sus: { pad: [48, 55, 57, 62], root: 36, tones: [60, 62, 67, 69, 72] },
  Am7: { pad: [45, 52, 55, 60], root: 33, tones: [64, 67, 69, 72, 76] },
  Gm9: { pad: [43, 50, 53, 57], root: 31, tones: [62, 65, 67, 69, 74] },
  Bbmaj9: { pad: [46, 50, 57, 60], root: 34, tones: [60, 62, 65, 69, 70] },
  Csus4: { pad: [48, 53, 55, 60], root: 36, tones: [60, 65, 67, 72] },
};

const PROGRESSIONS: (keyof typeof C)[][] = [
  ['Fmaj7', 'Dm9', 'Bbmaj7', 'C6sus'],
  ['Fmaj7', 'Am7', 'Bbmaj9', 'Csus4'],
  ['Dm9', 'Bbmaj7', 'Fmaj7', 'C6sus'],
  ['Bbmaj9', 'Am7', 'Gm9', 'Csus4'],
];

/** F major pentatonic plus the gentle extras (E, B♭), F4 to D6. */
const SCALE = [65, 67, 69, 70, 72, 74, 76, 77, 79, 81, 82, 84, 86];

/* ------------------------------------------------------------ engine */

const BEAT = 60 / 64;
const BEATS_PER_CHORD = 8;

class Engine {
  private ctx: AudioContext;
  private master: GainNode;
  private music: GainNode;
  private padBus: BiquadFilterNode;
  private rainBus: GainNode;
  private rainLevel: GainNode;
  private timer = 0;
  private nextBeat = 0;
  private beat = 0;
  private progression: (keyof typeof C)[] = PROGRESSIONS[0]!;
  private chord: Chord = C.Fmaj7!;
  private last = 72;
  private rainOn = false;
  private noise: AudioBuffer;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'playback' });
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp);

    // A soft room: a little reverb made from decaying noise.
    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(3.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.42;
    reverb.connect(wet).connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0.9;
    const dry = ctx.createGain();
    dry.gain.value = 0.72;
    // Felt over the hammers: no harsh highs anywhere.
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 3800;
    this.music.connect(soften);
    soften.connect(dry).connect(this.master);
    soften.connect(reverb);

    // The pad breathes: its brightness drifts slowly.
    this.padBus = ctx.createBiquadFilter();
    this.padBus.type = 'lowpass';
    this.padBus.frequency.value = 820;
    this.padBus.Q.value = 0.4;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 260;
    lfo.connect(lfoDepth).connect(this.padBus.frequency);
    lfo.start();
    this.padBus.connect(this.music);

    this.noise = this.noiseBuffer(3);
    this.rainLevel = ctx.createGain();
    this.rainLevel.gain.value = 0;
    this.rainBus = ctx.createGain();
    this.rainBus.gain.value = 1;
    this.rainBus.connect(this.rainLevel);
    this.rainLevel.connect(this.master);
    this.rainLevel.connect(reverb);
    this.startRainBed();
  }

  private impulse(seconds: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.8;
    }
    return buf;
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(2, Math.floor(rate * seconds), rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      // Pinkish noise (gentler than white): a running filter over white.
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
      }
    }
    return buf;
  }

  /** Steady rain on the glass: filtered noise, always running, faded in and out. */
  private startRainBed(): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1300;
    band.Q.value = 0.5;
    const level = ctx.createGain();
    level.gain.value = 0.5;
    src.connect(band).connect(level).connect(this.rainBus);
    const low = ctx.createBufferSource();
    low.buffer = this.noise;
    low.loop = true;
    low.playbackRate.value = 0.6;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 380;
    const lowLevel = ctx.createGain();
    lowLevel.gain.value = 0.35;
    low.connect(lowpass).connect(lowLevel).connect(this.rainBus);
    src.start();
    low.start(0, 1.3);
  }

  setVolume(v: number): void {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.9, now, 0.25);
  }

  setRain(on: boolean): void {
    this.rainOn = on;
    const now = this.ctx.currentTime;
    this.rainLevel.gain.cancelScheduledValues(now);
    this.rainLevel.gain.setTargetAtTime(on ? 0.55 : 0, now, 1.2);
  }

  async start(volume: number, rain: boolean): Promise<void> {
    await this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(volume * 0.9, now + 2.5);
    this.setRain(rain);
    this.progression = PROGRESSIONS[Math.floor(Math.random() * PROGRESSIONS.length)]!;
    this.beat = 0;
    this.nextBeat = now + 0.15;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 200);
    this.tick();
  }

  stop(): void {
    window.clearInterval(this.timer);
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 1.2);
    window.setTimeout(() => {
      if (!useRadio.getState().playing) void this.ctx.suspend();
    }, 1400);
  }

  /** Schedules what's coming (further ahead when the tab is hidden and timers slow down). */
  private tick(): void {
    const ahead = document.hidden ? 3.2 : 0.8;
    while (this.nextBeat < this.ctx.currentTime + ahead) {
      this.playBeat(this.beat, this.nextBeat);
      this.nextBeat += BEAT;
      this.beat++;
    }
  }

  private playBeat(i: number, t: number): void {
    const inChord = i % BEATS_PER_CHORD;
    if (inChord === 0) {
      const n = Math.floor(i / BEATS_PER_CHORD);
      if (n > 0 && n % 8 === 0) this.progression = PROGRESSIONS[Math.floor(Math.random() * PROGRESSIONS.length)]!;
      this.chord = C[this.progression[n % this.progression.length]!]!;
      this.pad(t, this.chord.pad, BEATS_PER_CHORD * BEAT);
      this.piano(t, this.chord.root + 12, 0.42, -0.15, 1.6);
    }
    if (this.rainOn) this.droplets(t);
    // The melody: mostly steps, often resting, leaning on the chord.
    const rest = inChord === 0 ? 0.15 : inChord % 2 === 1 ? 0.62 : 0.42;
    if (Math.random() < rest) return;
    const near = SCALE.filter((m) => Math.abs(m - this.last) <= 5 && m !== this.last);
    const weighted = near.flatMap((m) => (this.chord.tones.includes(m) ? [m, m, m] : [m]));
    const note = weighted[Math.floor(Math.random() * weighted.length)] ?? this.chord.tones[0]!;
    this.last = note;
    const jitter = (Math.random() - 0.5) * 0.03;
    const vel = 0.32 + Math.random() * 0.3 + (inChord === 0 ? 0.12 : 0);
    this.piano(t + jitter, note, vel, (Math.random() - 0.5) * 0.5, 1);
    // Now and then, a little grace note just before the beat.
    if (Math.random() < 0.12) {
      const grace = SCALE[Math.max(0, SCALE.indexOf(note) - 1)] ?? note;
      this.piano(t + jitter - BEAT * 0.5, grace, vel * 0.6, (Math.random() - 0.5) * 0.5, 1);
    }
  }

  /** A felt piano: a few sine partials, a soft attack, a long gentle decay. */
  private piano(at: number, midi: number, vel: number, pan: number, lengthen: number): void {
    const ctx = this.ctx;
    // A grace note just before the very first beat would land in the past.
    const t = Math.max(at, ctx.currentTime + 0.005);
    const f = midiHz(midi);
    const out = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    const felt = ctx.createBiquadFilter();
    felt.type = 'lowpass';
    felt.frequency.setValueAtTime(Math.min(5000, f * 7), t);
    felt.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2), t + 1.2);
    out.connect(felt).connect(panner).connect(this.music);
    const decay = (1.8 + 3.4 * Math.max(0, 1 - (f - 110) / 1000)) * lengthen;
    const partials: [number, number][] = [
      [1, 1],
      [2, 0.28],
      [3, 0.09],
      [4.01, 0.035],
    ];
    for (const [ratio, amp] of partials) {
      const osc = ctx.createOscillator();
      osc.frequency.value = f * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(amp * vel * 0.42, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay / ratio ** 0.5);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + decay + 0.2);
    }
  }

  /** Warm, slow chords under everything. */
  private pad(t: number, notes: number[], length: number): void {
    const ctx = this.ctx;
    for (const m of notes) {
      for (const detune of [-7, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = midiHz(m);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.03, t + 2.6);
        g.gain.setValueAtTime(0.03, t + length - 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + length + 2.8);
        osc.connect(g).connect(this.padBus);
        osc.start(t);
        osc.stop(t + length + 3);
      }
    }
  }

  /** Drops tapping the window: tiny, bright, here and there. */
  private droplets(t: number): void {
    const ctx = this.ctx;
    const count = 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < count; k++) {
      const at = t + Math.random() * BEAT;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 2400 + Math.random() * 4200;
      band.Q.value = 9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.5, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 1.6 - 0.8;
      src.connect(band).connect(g).connect(p).connect(this.rainBus);
      src.start(at, Math.random() * 2, 0.08);
    }
  }
}

let engine: Engine | null = null;

/** Switches the music on or off (call from a click or tap). */
export async function setPlaying(on: boolean): Promise<void> {
  const st = useRadio.getState();
  st.set({ playing: on });
  if (on) {
    engine ??= new Engine();
    await engine.start(st.volume, st.station === 'rain');
  } else {
    engine?.stop();
  }
}

export function tuneTo(station: Station): void {
  useRadio.getState().set({ station });
  engine?.setRain(station === 'rain');
}

export function setVolume(volume: number): void {
  useRadio.getState().set({ volume });
  if (useRadio.getState().playing) engine?.setVolume(volume);
}

/** Leaving the desk (signing out, locking): quiet at once. */
export function silence(): void {
  if (useRadio.getState().playing) void setPlaying(false);
}
