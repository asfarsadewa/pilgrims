export interface MusicRequest {
  /** Stable identifier; switching to the same name does not restart playback. */
  name: string;
  url: string;
  volume: number;
}

/**
 * Sparse procedural audio using the Web Audio API. No asset files, no library.
 * All sounds are generated on demand; the context is created on first gesture.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientNodes: Array<OscillatorNode> = [];
  private music = new Map<
    string,
    { el: HTMLAudioElement; gain: GainNode; source: MediaElementAudioSourceNode }
  >();
  private currentRequest: MusicRequest | null = null;
  private lastApplied: string | null = null;
  private musicVolume = 1;
  muted = false;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.ensureMusic();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
    this.applyMusic(this.currentRequest, 1.4);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Crossfade to a streaming BGM track. If the audio context is not unlocked
   * yet the request is remembered and started on the first user gesture.
   */
  playMusic(request: MusicRequest, fade = 2.5): void {
    this.currentRequest = request;
    this.applyMusic(request, fade);
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = volume;
    if (this.currentRequest) this.applyMusic(this.currentRequest, 0.6);
  }

  private ensureMusic(): void {
    if (this.currentRequest && this.lastApplied !== this.currentRequest.name) {
      this.applyMusic(this.currentRequest, 1.2);
      return;
    }
    if (this.currentRequest) {
      const entry = this.music.get(this.currentRequest.name);
      if (entry && entry.el.paused) void entry.el.play().catch(() => undefined);
    }
  }

  private applyMusic(request: MusicRequest | null, fade: number): void {
    if (!this.ctx || !this.master || !request) return;
    const now = this.ctx.currentTime;

    // Fade out every other track.
    for (const [name, entry] of this.music) {
      if (name === request.name) continue;
      if (entry.el.paused && entry.gain.gain.value < 0.001) continue;
      entry.gain.gain.cancelScheduledValues(now);
      entry.gain.gain.setValueAtTime(Math.max(entry.gain.gain.value, 0.0001), now);
      entry.gain.gain.linearRampToValueAtTime(0.0001, now + fade);
      const el = entry.el;
      window.setTimeout(() => {
        if (this.currentRequest?.name !== name) el.pause();
      }, fade * 1000 + 150);
    }

    let entry = this.music.get(request.name);
    if (!entry) {
      const el = new Audio();
      el.src = request.url;
      el.loop = true;
      el.preload = "auto";
      const source = this.ctx.createMediaElementSource(el);
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      source.connect(gain);
      gain.connect(this.master);
      entry = { el, gain, source };
      this.music.set(request.name, entry);
    }

    this.lastApplied = request.name;
    const target = Math.max(0.0001, request.volume * this.musicVolume);
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setValueAtTime(Math.max(entry.gain.gain.value, 0.0001), now);
    entry.gain.gain.linearRampToValueAtTime(target, now + fade);
    const play = entry.el.play();
    if (play && typeof play.catch === "function") play.catch(() => undefined);
  }

  private startAmbient(): void {
    if (!this.ctx || !this.master) return;
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.022;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    filter.Q.value = 0.6;
    this.ambientGain.connect(filter);
    filter.connect(this.master);

    for (const [freq, detune] of [
      [55, -6],
      [82.5, 5],
      [110, 0],
    ]) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.33;
      osc.connect(gain);
      gain.connect(this.ambientGain);
      osc.start();
      this.ambientNodes.push(osc);
    }

    // Slow breathing LFO on the ambient bed.
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    if (this.ambientGain) lfoGain.connect(this.ambientGain.gain);
    lfo.start();
    this.ambientNodes.push(lfo);
  }

  private tone(options: {
    freq: number;
    duration: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
    slideTo?: number;
  }): void {
    if (!this.ctx || !this.master || this.muted) return;
    const {
      freq,
      duration,
      type = "sine",
      gain = 0.2,
      delay = 0,
      slideTo,
    } = options;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, slideTo),
        start + duration,
      );
    }
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private noise(duration: number, gain: number, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const start = this.ctx.currentTime + delay;
    const samples = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, samples, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 420;
    const env = this.ctx.createGain();
    env.gain.value = gain;
    source.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    source.start(start);
  }

  shrineMove(): void {
    this.tone({ freq: 220, duration: 0.18, type: "triangle", gain: 0.18, slideTo: 320 });
  }

  pilgrimStep(): void {
    this.noise(0.08, 0.05);
    this.tone({ freq: 140, duration: 0.07, type: "sine", gain: 0.06 });
  }

  blocked(): void {
    this.tone({ freq: 110, duration: 0.12, type: "square", gain: 0.07, slideTo: 70 });
  }

  fall(): void {
    this.tone({ freq: 320, duration: 0.5, type: "sawtooth", gain: 0.12, slideTo: 55 });
  }

  exit(): void {
    this.tone({ freq: 660, duration: 0.35, type: "sine", gain: 0.14 });
    this.tone({ freq: 990, duration: 0.4, type: "sine", gain: 0.08, delay: 0.06 });
  }

  solve(): void {
    for (const [freq, delay] of [
      [523.25, 0],
      [659.25, 0.12],
      [783.99, 0.24],
      [1046.5, 0.4],
    ]) {
      this.tone({ freq, duration: 1.1, type: "sine", gain: 0.16, delay });
    }
  }

  undo(): void {
    this.tone({ freq: 330, duration: 0.16, type: "sine", gain: 0.12, slideTo: 220 });
  }

  levelStart(): void {
    this.tone({ freq: 196, duration: 0.7, type: "sine", gain: 0.1 });
    this.tone({ freq: 294, duration: 0.7, type: "sine", gain: 0.06, delay: 0.08 });
  }
}
