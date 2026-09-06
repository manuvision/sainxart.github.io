// Small, self-contained soundscape. AudioContext is created only by start(),
// which the title screen calls from a real click/tap to satisfy autoplay rules.
export class AmbientAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.started = false;
    this.muted = false;
    this.disposed = false;
    this.sources = [];
    this.elapsed = 0;
    this.nextBird = 1.2;
    this.nextBubble = 1.8;
    this.stepClock = 0;
    this.lastEffect = new Map();
    this.state = { daylight: 1, underwater: false, biome: 'meadow', moving: false, inWater: false };
  }

  get enabled() { return this.started && !this.muted; }

  async start() {
    if (this.disposed) return false;
    if (!this.context) {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return false;
      this.context = new AudioContext();
      const ctx = this.context;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : .62;
      this.lowpass = ctx.createBiquadFilter();
      this.lowpass.type = 'lowpass';
      this.lowpass.frequency.value = 12500;
      this.master.connect(this.lowpass);
      this.lowpass.connect(ctx.destination);
      this.noise = this._noiseBuffer(7);
      this.wind = this._noiseLoop('lowpass', 650, .036, -.28);
      this.water = this._noiseLoop('bandpass', 1250, .026, .30);
      this.water.filter.Q.value = .32;
      this.leaves = this._noiseLoop('bandpass', 3300, .008, -.55);
      this.leaves.filter.Q.value = .20;
      this.insects = this._noiseLoop('bandpass', 5400, .001, .42);
      this.insects.filter.Q.value = 1.6;
    }
    try {
      if (this.context.state === 'suspended') await this.context.resume();
      this.started = this.context.state === 'running';
      return this.started;
    } catch {
      this.started = false;
      return false;
    }
  }

  _noiseBuffer(seconds) {
    const ctx = this.context;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let low = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        low = (low + white * .045) / 1.045;
        data[i] = low * 2.7 + white * .09;
      }
      // Ease the seam so no repeating click calls attention to the loop.
      const seam = Math.floor(ctx.sampleRate * .035);
      for (let i = 0; i < seam; i++) {
        const blend = i / seam;
        data[i] = data[i] * blend + data[length - seam + i] * (1 - blend);
      }
    }
    return buffer;
  }

  _panner(value) {
    const panner = this.context.createStereoPanner();
    panner.pan.value = value;
    return panner;
  }

  _noiseLoop(type, frequency, volume, pan) {
    const ctx = this.context;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    source.playbackRate.value = .8 + Math.random() * .35;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const panner = this._panner(pan);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.master);
    source.start(0, Math.random() * 5);
    this.sources.push(source);
    return { source, filter, gain, panner };
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : .62, this.context.currentTime, .10);
  }

  _chirp(night = false) {
    const ctx = this.context;
    const start = ctx.currentTime + .02;
    const pan = Math.random() * 1.6 - .8;
    const count = night ? 2 : 2 + Math.floor(Math.random() * 3);
    const base = night ? 430 + Math.random() * 90 : 1700 + Math.random() * 1150;
    for (let i = 0; i < count; i++) {
      const at = start + i * (night ? .38 : .14 + Math.random() * .06);
      const duration = night ? .25 : .085 + Math.random() * .065;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      const panner = this._panner(pan);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(base * (night ? 1 : .86 + Math.random() * .22), at);
      oscillator.frequency.exponentialRampToValueAtTime(base * (night ? .9 : 1.30), at + duration * .35);
      oscillator.frequency.exponentialRampToValueAtTime(base * (night ? .88 : .89), at + duration);
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(night ? .014 : .015 + Math.random() * .010, at + .018);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
      oscillator.connect(envelope);
      envelope.connect(panner);
      panner.connect(this.master);
      oscillator.start(at);
      oscillator.stop(at + duration + .04);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); panner.disconnect(); };
    }
  }

  _bubble() {
    const ctx = this.context;
    const at = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = this._panner(Math.random() * 1.4 - .7);
    oscillator.frequency.setValueAtTime(360 + Math.random() * 500, at);
    oscillator.frequency.exponentialRampToValueAtTime(100 + Math.random() * 130, at + .08);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.linearRampToValueAtTime(.007, at + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, at + .11);
    oscillator.connect(gain); gain.connect(panner); panner.connect(this.master);
    oscillator.start(at); oscillator.stop(at + .13);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); panner.disconnect(); };
  }

  update(dt, state = {}) {
    Object.assign(this.state, state);
    if (!this.started || this.disposed || !this.context || this.context.state !== 'running') return;
    dt = Math.min(Math.max(dt, 0), .1);
    this.elapsed += dt;
    const { daylight, underwater, biome, moving, inWater } = this.state;
    const night = 1 - Math.max(0, Math.min(1, daylight));
    const now = this.context.currentTime;
    const gust = .8 + Math.sin(this.elapsed * .13) * .14 + Math.sin(this.elapsed * .37) * .08;
    this.lowpass.frequency.setTargetAtTime(underwater ? 580 : 12500, now, .3);
    this.wind.gain.gain.setTargetAtTime((biome === 'desert' || biome === 'ice' ? .06 : .036) * gust * (underwater ? .45 : 1), now, .5);
    this.water.gain.gain.setTargetAtTime(underwater ? .16 : inWater ? .10 : biome === 'desert' ? .008 : .028, now, .6);
    this.leaves.gain.gain.setTargetAtTime((biome === 'jungle' ? .024 : biome === 'desert' || biome === 'ice' ? .002 : .012) * gust, now, .8);
    this.insects.gain.gain.setTargetAtTime((biome === 'ice' ? 0 : .0015 + night * .011) * (.8 + Math.sin(this.elapsed * 3.1) * .2), now, .1);
    this.nextBird -= dt;
    if (this.nextBird <= 0 && !this.muted) {
      if (!underwater && biome !== 'ice' && biome !== 'desert') this._chirp(night > .72);
      this.nextBird = (night > .72 ? 10 : 4) + Math.random() * 7;
    }
    this.nextBubble -= dt;
    if (this.nextBubble <= 0 && !this.muted) {
      if (inWater || underwater) this._bubble();
      this.nextBubble = .5 + Math.random() * 2;
    }
    if (moving && !underwater) {
      this.stepClock += dt;
      if (this.stepClock > .43) { this.effect('step'); this.stepClock = 0; }
    } else this.stepClock = .25;
  }

  effect(kind) {
    if (!this.enabled || !this.context || this.disposed) return;
    const ctx = this.context;
    const at = ctx.currentTime;
    if (at - (this.lastEffect.get(kind) ?? -Infinity) < .065) return;
    this.lastEffect.set(kind, at);
    const settings = {
      break: [.13, 880, .19, .65],
      place: [.085, 370, .15, .55],
      jump: [.15, 520, .055, .8],
      step: [this.state.inWater ? .15 : .075, this.state.inWater ? 1800 : 530, this.state.inWater ? .10 : .06, .7],
    }[kind];
    if (!settings) return;
    const [duration, frequency, volume, playback] = settings;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = playback + Math.random() * .17;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(frequency * 1.6, at);
    filter.frequency.exponentialRampToValueAtTime(frequency * .6, at + duration);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.linearRampToValueAtTime(volume, at + .006);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.master);
    source.start(at, Math.random() * 4); source.stop(at + duration + .02);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const source of this.sources) { try { source.stop(); source.disconnect(); } catch {} }
    this.sources.length = 0;
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.started = false;
  }
}

export default AmbientAudio;
