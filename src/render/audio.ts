// Procedurally-synthesised sound effects (WebAudio) — no audio assets needed,
// everything is original. Reacts to SimEvents; never decides outcomes.

export type SfxName =
  | "chop"
  | "clink"
  | "rustle"
  | "splash"
  | "sizzle"
  | "forge"
  | "anvil"
  | "hit"
  | "whiff"
  | "hurt"
  | "slain"
  | "died"
  | "chopMiss"
  | "item"
  | "level"
  | "deplete"
  | "respawn"
  | "reject"
  | "chest"
  | "eat"
  | "step";

export class Sfx {
  private ctx: AudioContext | null = null;
  enabled = true;

  /** Call from a user gesture to satisfy autoplay policies. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as Record<string, typeof AudioContext>).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private tone(
    freq: number,
    durS: number,
    type: OscillatorType,
    volume: number,
    slideTo?: number,
    delayS = 0,
  ): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delayS;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + durS);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + durS);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durS + 0.02);
  }

  private thud(durS: number, filterHz: number, volume: number): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const frames = Math.floor(this.ctx.sampleRate * durS);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterHz;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + durS);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(t0);
  }

  play(name: SfxName): void {
    if (!this.enabled || !this.ctx) return;
    switch (name) {
      case "chop":
        this.thud(0.09, 900, 0.5);
        this.tone(180, 0.08, "triangle", 0.25, 120);
        break;
      case "clink":
        this.thud(0.05, 2400, 0.3);
        this.tone(950, 0.09, "triangle", 0.2, 620);
        break;
      case "rustle":
        this.thud(0.14, 1400, 0.18);
        break;
      case "eat": // two quick munches and a satisfied swallow
        this.thud(0.06, 1600, 0.3);
        this.tone(330, 0.06, "triangle", 0.15, 260);
        this.tone(300, 0.06, "triangle", 0.15, 240, 0.09);
        this.tone(170, 0.1, "sine", 0.18, 110, 0.18);
        break;
      case "splash":
        this.thud(0.16, 1100, 0.35);
        this.tone(420, 0.12, "sine", 0.15, 180);
        break;
      case "sizzle":
        this.thud(0.3, 4200, 0.14);
        break;
      case "forge":
        this.thud(0.22, 480, 0.4);
        this.tone(95, 0.22, "sine", 0.25, 60);
        break;
      case "anvil":
        this.thud(0.05, 3000, 0.3);
        this.tone(1250, 0.18, "triangle", 0.22, 880);
        break;
      case "hit":
        this.thud(0.07, 1400, 0.45);
        this.tone(300, 0.08, "square", 0.12, 170);
        break;
      case "whiff":
        this.thud(0.05, 2600, 0.1);
        break;
      case "hurt":
        this.thud(0.1, 700, 0.4);
        this.tone(150, 0.14, "sawtooth", 0.15, 100);
        break;
      case "slain":
        this.thud(0.25, 600, 0.4);
        this.tone(220, 0.35, "triangle", 0.25, 70);
        break;
      case "died":
        this.tone(330, 0.6, "triangle", 0.3, 55);
        this.thud(0.4, 400, 0.4);
        break;
      case "chopMiss":
        this.thud(0.05, 1600, 0.12);
        break;
      case "item":
        this.tone(660, 0.09, "square", 0.12, 880);
        break;
      case "level":
        this.tone(523, 0.12, "triangle", 0.22);
        this.tone(659, 0.12, "triangle", 0.22, undefined, 0.11);
        this.tone(784, 0.2, "triangle", 0.22, undefined, 0.22);
        break;
      case "deplete":
        this.thud(0.3, 350, 0.5);
        this.tone(110, 0.25, "sine", 0.3, 60);
        break;
      case "respawn":
        this.tone(392, 0.12, "sine", 0.15, 587);
        break;
      case "reject":
        this.tone(220, 0.15, "sawtooth", 0.1, 160);
        break;
      case "chest":
        this.tone(240, 0.1, "triangle", 0.18, 320);
        break;
      case "step":
        this.thud(0.03, 700, 0.05);
        break;
    }
  }
}
