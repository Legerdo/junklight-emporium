// Web Audio로 합성한 효과음과 절차적 음악. 외부 음원 파일을 쓰지 않는다.
import type { Material } from '../core/types';

type Tone = { f: number; t?: number; d: number; type?: OscillatorType; v?: number; slide?: number };
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];

export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfx!: GainNode;
  music!: GainNode;
  private noiseBuf!: AudioBuffer;
  private last = new Map<string, number>();
  private vols = { master: 0.8, sfx: 0.8, music: 0.5 };
  private musicTimer = 0;
  private step = 0;
  layers = 0;
  site = 'alley';
  private nextNoteT = 0;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(comp);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.connect(this.master);
    const len = ctx.sampleRate * 1;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.nextNoteT = ctx.currentTime + 0.1;
  }

  setVolumes(master: number, sfx: number, music: number) {
    this.vols = { master, sfx, music };
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vols.master;
    this.sfx.gain.value = this.vols.sfx * 0.9;
    this.music.gain.value = this.vols.music * 0.35;
  }

  private gate(key: string, gap: number) {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    const l = this.last.get(key) ?? -1;
    if (now - l < gap) return false;
    this.last.set(key, now);
    return true;
  }

  private tone(o: Tone, dest?: AudioNode) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (o.t ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f * o.slide), t + o.d);
    const v = o.v ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    osc.connect(g);
    g.connect(dest ?? this.sfx);
    osc.start(t);
    osc.stop(t + o.d + 0.02);
  }

  private noise(d: number, filter: BiquadFilterType, freq: number, v: number, t0 = 0, q = 1, sweep?: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + t0;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + d);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + d + 0.02);
  }

  // ---------- 효과음 ----------
  whoosh() {
    if (!this.gate('whoosh', 0.05)) return;
    this.noise(0.12, 'bandpass', 900, 0.12, 0, 1.2, 3);
  }
  impact(tool: string, hits: number) {
    if (!this.gate('impact', 0.03)) return;
    const heavy = tool === 'crowbar' || tool === 'star';
    this.tone({ f: heavy ? 110 : 150, d: 0.16, type: 'sine', v: 0.45, slide: 0.4 });
    this.noise(0.08, 'lowpass', 1200, hits ? 0.35 : 0.15);
    if (tool === 'fork') {
      this.tone({ f: 880, d: 1.1, type: 'sine', v: 0.18 });
      this.tone({ f: 1760, d: 0.7, type: 'sine', v: 0.06 });
    }
    if (tool === 'magnet') this.tone({ f: 220, d: 0.4, type: 'sawtooth', v: 0.05, slide: 2 });
    if (tool === 'key') for (let i = 0; i < 4; i++) this.tone({ f: 2400, t: i * 0.05, d: 0.03, type: 'square', v: 0.04 });
    if (tool === 'star') this.tone({ f: 660, d: 0.5, type: 'triangle', v: 0.12, slide: 1.5 });
  }
  hit(mat: Material) {
    if (!this.gate('hit' + mat, 0.035)) return;
    switch (mat) {
      case 'wood':
        this.tone({ f: 260 + Math.random() * 60, d: 0.07, type: 'triangle', v: 0.2, slide: 0.7 });
        break;
      case 'glass':
        this.tone({ f: 2200 + Math.random() * 800, d: 0.12, v: 0.08 });
        break;
      case 'metal':
        this.tone({ f: 620 + Math.random() * 200, d: 0.2, type: 'square', v: 0.05 });
        this.tone({ f: 1480, d: 0.15, v: 0.05 });
        break;
      case 'cloth':
        this.noise(0.08, 'lowpass', 600, 0.15);
        break;
      case 'clock':
        this.tone({ f: 1800, d: 0.03, type: 'square', v: 0.06 });
        break;
      case 'star':
        this.tone({ f: 1320, d: 0.25, type: 'triangle', v: 0.08 });
        break;
    }
  }
  breakSnd(mat: Material, shiny: boolean) {
    if (!this.gate('break' + mat, 0.04)) return;
    switch (mat) {
      case 'wood':
        this.noise(0.18, 'bandpass', 700, 0.4, 0, 0.8);
        this.tone({ f: 140, d: 0.12, type: 'triangle', v: 0.25, slide: 0.5 });
        break;
      case 'glass':
        this.noise(0.25, 'highpass', 3000, 0.25);
        for (let i = 0; i < 4; i++) this.tone({ f: 2000 + Math.random() * 2500, t: i * 0.03, d: 0.15, v: 0.06 });
        break;
      case 'metal':
        this.tone({ f: 330, d: 0.35, type: 'square', v: 0.06, slide: 0.8 });
        this.tone({ f: 990, d: 0.3, v: 0.08 });
        this.noise(0.1, 'bandpass', 2500, 0.2);
        break;
      case 'cloth':
        this.noise(0.25, 'lowpass', 900, 0.3, 0, 1, 0.3);
        break;
      case 'clock':
        break; // 폭발음으로 대신
      case 'star':
        this.tone({ f: 990, d: 0.5, type: 'triangle', v: 0.12 });
        this.tone({ f: 1485, t: 0.05, d: 0.5, type: 'triangle', v: 0.08 });
        break;
    }
    if (shiny) {
      this.tone({ f: 1568, d: 0.3, type: 'triangle', v: 0.12 });
      this.tone({ f: 2093, t: 0.08, d: 0.4, type: 'triangle', v: 0.12 });
    }
  }
  coin(combo: number) {
    if (!this.gate('coin', 0.028)) return;
    const n = PENTA[Math.min(PENTA.length - 1, Math.floor(combo / 2))];
    const f = 660 * Math.pow(2, n / 12);
    this.tone({ f, d: 0.09, type: 'square', v: 0.035 });
    this.tone({ f: f * 1.5, t: 0.04, d: 0.12, type: 'triangle', v: 0.05 });
  }
  spark() {
    if (!this.gate('spark', 0.04)) return;
    this.noise(0.09, 'bandpass', 4000, 0.25, 0, 3);
    this.tone({ f: 1200 + Math.random() * 600, d: 0.06, type: 'sawtooth', v: 0.04, slide: 0.5 });
  }
  blast(big: boolean) {
    if (!this.gate('blast', 0.05)) return;
    this.noise(big ? 0.7 : 0.45, 'lowpass', 900, 0.7, 0, 0.7, 0.2);
    this.tone({ f: 90, d: 0.45, type: 'sine', v: 0.5, slide: 0.35 });
  }
  pulse() {
    if (!this.gate('pulse', 0.06)) return;
    this.tone({ f: 523, d: 0.6, type: 'sine', v: 0.15, slide: 2 });
    this.tone({ f: 784, t: 0.04, d: 0.6, type: 'triangle', v: 0.08, slide: 1.5 });
  }
  dust() {
    if (!this.gate('dust', 0.08)) return;
    this.noise(0.3, 'lowpass', 500, 0.2);
  }
  ignite() {
    if (!this.gate('ignite', 0.08)) return;
    this.noise(0.35, 'bandpass', 1400, 0.25, 0, 0.6, 0.5);
  }
  crackle() {
    if (!this.gate('crackle', 0.11)) return;
    this.noise(0.03, 'highpass', 2500, 0.15, Math.random() * 0.05);
  }
  tick() {
    if (!this.gate('tick', 0.09)) return;
    this.tone({ f: 2600, d: 0.025, type: 'square', v: 0.05 });
  }
  resonance() {
    if (!this.gate('res', 0.15)) return;
    this.tone({ f: 1046, d: 1.4, v: 0.14 });
    this.tone({ f: 1568, d: 1.2, v: 0.08 });
    this.tone({ f: 2093, t: 0.02, d: 0.9, v: 0.05 });
  }
  land() {
    if (!this.gate('land', 0.06)) return;
    this.tone({ f: 90 + Math.random() * 40, d: 0.08, type: 'sine', v: 0.18, slide: 0.6 });
  }
  cart() {
    this.ensure();
    if (!this.ctx) return;
    this.noise(0.9, 'lowpass', 300, 0.3, 0, 1);
    this.tone({ f: 1318, t: 0.0, d: 0.5, type: 'triangle', v: 0.12 });
    this.tone({ f: 1760, t: 0.12, d: 0.6, type: 'triangle', v: 0.1 });
  }
  pour() {
    if (!this.gate('pour', 0.3)) return;
    this.noise(0.5, 'bandpass', 500, 0.25, 0, 0.8);
  }
  thump() {
    if (!this.gate('thump', 0.05)) return;
    this.tone({ f: 70, d: 0.2, type: 'sine', v: 0.4, slide: 0.5 });
    this.tone({ f: 400, d: 0.05, type: 'square', v: 0.04 });
  }
  bell() {
    [0, 0.01].forEach((t, i) => this.tone({ f: i ? 1245 : 830, t, d: 1.6, type: 'sine', v: 0.14 }));
  }
  curio(isNew: boolean) {
    this.ensure();
    if (!this.ctx) return;
    const notes = isNew ? [0, 4, 7, 12, 16] : [0, 7];
    notes.forEach((n, i) => this.tone({ f: 523 * Math.pow(2, n / 12), t: i * 0.08, d: 0.5, type: 'triangle', v: 0.14 }));
  }
  request() {
    [0, 5, 9, 12].forEach((n, i) => this.tone({ f: 587 * Math.pow(2, n / 12), t: i * 0.07, d: 0.4, type: 'square', v: 0.04 }));
  }
  lamp() {
    [0, 4, 7, 11, 14].forEach((n, i) => this.tone({ f: 392 * Math.pow(2, n / 12), t: i * 0.12, d: 1.8, type: 'triangle', v: 0.12 }));
  }
  heartHit(weak: boolean) {
    if (!this.gate('heart', 0.07)) return;
    this.tone({ f: weak ? 196 : 147, d: 0.5, type: 'triangle', v: weak ? 0.2 : 0.1 });
    if (weak) this.tone({ f: 784, d: 0.3, v: 0.06 });
  }
  heartPhase() {
    this.blast(true);
    [0, 3, 7, 10].forEach((n, i) => this.tone({ f: 220 * Math.pow(2, n / 12), t: 0.2 + i * 0.1, d: 1.5, type: 'sawtooth', v: 0.04 }));
  }
  ending() {
    [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone({ f: 262 * Math.pow(2, n / 12), t: i * 0.22, d: 3, type: 'triangle', v: 0.12 }));
  }
  click() {
    this.ensure();
    if (!this.ctx || !this.gate('click', 0.03)) return;
    this.tone({ f: 1400, d: 0.03, type: 'square', v: 0.03 });
  }
  deny() {
    this.ensure();
    if (!this.ctx || !this.gate('deny', 0.1)) return;
    this.tone({ f: 180, d: 0.12, type: 'square', v: 0.05, slide: 0.8 });
  }
  buy() {
    this.ensure();
    if (!this.ctx) return;
    this.tone({ f: 988, d: 0.08, type: 'square', v: 0.05 });
    this.tone({ f: 1318, t: 0.07, d: 0.2, type: 'square', v: 0.05 });
  }

  // ---------- 음악: 등불이 켜질수록 층이 늘어난다 ----------
  updateMusic() {
    const ctx = this.ctx;
    if (!ctx || this.vols.music <= 0.001) return;
    const KEYS: Record<string, number> = { alley: 0, docks: -3, greenhouse: 2, attic: -5, crater: 5 };
    const BPM: Record<string, number> = { alley: 78, docks: 84, greenhouse: 90, attic: 96, crater: 72 };
    const beat = 60 / (BPM[this.site] ?? 80) / 2;
    const root = 220 * Math.pow(2, (KEYS[this.site] ?? 0) / 12);
    const prog = [
      [0, 4, 7],
      [-3, 0, 4],
      [-7, -3, 0],
      [-5, -1, 2],
    ];
    while (this.nextNoteT < ctx.currentTime + 0.3) {
      const t = this.nextNoteT - ctx.currentTime;
      const bar = Math.floor(this.step / 8) % 4;
      const chord = prog[bar];
      const i = this.step % 8;
      const hz = (n: number) => root * Math.pow(2, n / 12);
      if (i === 0) {
        this.tone({ f: hz(chord[0] - 12), t, d: beat * 7, type: 'sine', v: 0.22 }, this.music);
        if (this.layers >= 2) chord.forEach((n) => this.tone({ f: hz(n), t, d: beat * 7.5, type: 'sine', v: 0.035 }, this.music));
      }
      if (i % 2 === 0 || this.layers >= 3) {
        const n = chord[(i >> (this.layers >= 3 ? 0 : 1)) % 3] + (i >= 4 ? 12 : 0);
        this.tone({ f: hz(n), t, d: beat * 1.6, type: 'triangle', v: 0.06 }, this.music);
      }
      if (this.layers >= 1 && (i === 3 || i === 6) && (this.step * 7) % 5 < 3) {
        const m = PENTA[(this.step * 3 + bar) % 8] + 12;
        this.tone({ f: hz(m), t, d: beat * 2.5, type: 'sine', v: 0.05 }, this.music);
      }
      if (this.layers >= 4 && i % 4 === 2) this.noiseTick(t);
      this.step++;
      this.nextNoteT += beat;
    }
    void this.musicTimer;
  }
  private noiseTick(t0: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + t0;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.03, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f);
    f.connect(g);
    g.connect(this.music);
    src.start(t);
    src.stop(t + 0.06);
  }
}

export const audio = new Audio();
