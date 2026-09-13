// ===== محرك صوت اصطناعي بالكامل (WebAudio) — بدون ملفات خارجية =====

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private step = 0;
  muted = false;

  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  unlock() {
    this.ensure();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.5, slideTo?: number, delay = 0) {
    this.ensure();
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol = 0.4, lowpass = 1200, delay = 0) {
    this.ensure();
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  click() { this.tone(660, 0.08, 'square', 0.15); }
  shoot(kind = 0) {
    const base = [520, 420, 700, 300, 880, 240, 980][kind % 7] ?? 520;
    this.tone(base, 0.12, 'sawtooth', 0.22, base * 0.4);
    this.noise(0.06, 0.12, 3000);
  }
  enemyShoot() { this.tone(220, 0.25, 'sawtooth', 0.15, 90); }
  hit() { this.noise(0.1, 0.3, 1800); this.tone(180, 0.1, 'square', 0.2, 90); }
  kill() {
    this.noise(0.25, 0.35, 2400);
    this.tone(500, 0.3, 'sawtooth', 0.25, 60);
    this.tone(900, 0.2, 'sine', 0.2, 1400, 0.03);
  }
  hurt() {
    this.tone(160, 0.3, 'sawtooth', 0.4, 60);
    this.noise(0.2, 0.3, 900);
  }
  jump() { this.tone(300, 0.16, 'sine', 0.25, 640); }
  land() { this.noise(0.07, 0.15, 700); }
  pickup() { this.tone(880, 0.12, 'sine', 0.3); this.tone(1320, 0.16, 'sine', 0.3, undefined, 0.08); }
  heart() { this.tone(520, 0.14, 'triangle', 0.35); this.tone(780, 0.2, 'triangle', 0.35, undefined, 0.1); }
  chest() {
    [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.3, undefined, i * 0.09));
    this.noise(0.5, 0.1, 4000, 0.1);
  }
  win() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.32, undefined, i * 0.11));
  }
  lose() {
    [400, 340, 280, 200, 140].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.25, f * 0.85, i * 0.16));
  }
  warning() { this.tone(440, 0.15, 'square', 0.2); this.tone(440, 0.15, 'square', 0.2, undefined, 0.2); }
  bossRoar() {
    this.tone(90, 0.8, 'sawtooth', 0.4, 45);
    this.noise(0.7, 0.3, 500);
  }

  // موسيقى خلفية إجرائية هادئة تتغير مع العالم
  startMusic(worldIdx: number) {
    this.ensure();
    this.stopMusic();
    if (!this.ctx || !this.musicGain || this.muted) return;
    const scales = [
      [262, 294, 330, 392, 440, 392, 330, 294], // مرج
      [294, 330, 370, 440, 494, 440, 370, 330], // غروب
      [220, 262, 277, 330, 370, 330, 277, 262], // نيون
      [196, 220, 247, 294, 330, 294, 247, 220], // بركان
      [330, 370, 415, 494, 554, 494, 415, 370], // سماء
      [247, 294, 311, 370, 415, 370, 311, 294], // كون
    ];
    const scale = scales[worldIdx % scales.length];
    this.step = 0;
    const tick = () => {
      if (!this.ctx || !this.musicGain || this.muted) return;
      const note = scale[this.step % scale.length];
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.step % 4 === 0 ? 'triangle' : 'sine';
      osc.frequency.value = note * (this.step % 16 >= 8 ? 0.5 : 1);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      osc.connect(gain).connect(this.musicGain);
      osc.start(t0);
      osc.stop(t0 + 0.6);
      this.step++;
    };
    tick();
    this.musicTimer = window.setInterval(tick, 320);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const gameAudio = new GameAudio();
