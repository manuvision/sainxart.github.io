// Small, self-contained soundscape. AudioContext is created only by start(),
// which the title screen calls from a real click/tap to satisfy autoplay rules.
const smoothstep = (low, high, value) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

export function soundscapeMix(daylight, biome = 'meadow', underwater = false) {
  if (underwater || biome === 'ice') return { bird: 0, cricket: 0, frog: 0 };
  const day = smoothstep(.38, .72, daylight);
  const night = 1 - smoothstep(.20, .58, daylight);
  return {
    bird: biome === 'desert' ? 0 : day,
    cricket: night * (biome === 'desert' ? .38 : 1),
    frog: biome === 'desert' ? 0 : night,
  };
}

export class AmbientAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.started = false;
    this.muted = false;
    this.disposed = false;
    this.voices = new Set();
    this.nextBird = 1.2;
    this.nextCricket = .45;
    this.nextFrog = 4.5;
    this.ambienceTargets = { bird: 0, cricket: 0, frog: 0 };
    this.calls = { bird: 0, cricket: 0, frog: 0 };
    this.lastEffect = new Map();
    this.state = { daylight: 1, underwater: false, biome: 'meadow' };
  }

  get enabled() { return this.started && !this.muted; }
  get diagnostics() {
    return { started: this.started, enabled: this.enabled, mix: { ...this.ambienceTargets }, calls: { ...this.calls }, activeVoices: this.voices.size };
  }

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
      // Separate wildlife buses crossfade at dusk/dawn. No water or wind beds:
      // the forest remains quiet between birds, crickets and frog calls.
      this.ambience = {};
      for (const kind of ['bird', 'cricket', 'frog']) {
        const bus = ctx.createGain();
        bus.gain.value = 0;
        bus.connect(this.master);
        this.ambience[kind] = bus;
      }
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

  _track(source, nodes, kind, envelope) {
    const voice = { source, nodes, kind, envelope, fading: false };
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect();
      for (const node of nodes) node.disconnect();
      this.voices.delete(voice);
    };
  }

  _updateAmbience() {
    const { daylight, biome, underwater } = this.state;
    const next = soundscapeMix(daylight, biome, underwater);
    const at = this.context.currentTime;
    for (const kind of ['bird', 'cricket', 'frog']) {
      if (Math.abs(next[kind] - this.ambienceTargets[kind]) > .002 || next[kind] === 0 && this.ambienceTargets[kind] !== 0) {
        this.ambience[kind].gain.setTargetAtTime(next[kind], at, .8);
        // Cancel calls already queued when a time setting/biome changes. A
        // short release avoids a click and prevents birds lingering at night.
        if (next[kind] === 0) {
          for (const voice of this.voices) {
            if (voice.kind !== kind || voice.fading) continue;
            voice.fading = true;
            const gain = voice.envelope.gain;
            if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(at);
            else { gain.cancelScheduledValues(at); gain.setValueAtTime(gain.value, at); }
            gain.linearRampToValueAtTime(0, at + .08);
            voice.source.stop(at + .09);
          }
        }
        this.ambienceTargets[kind] = next[kind];
      }
    }
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : .62, this.context.currentTime, .10);
  }

  _chirp() {
    const ctx = this.context;
    const start = ctx.currentTime + .02;
    const pan = Math.random() * 1.6 - .8;
    const count = 2 + Math.floor(Math.random() * 3);
    const base = 1700 + Math.random() * 1150;
    this.calls.bird++;
    for (let i = 0; i < count; i++) {
      const at = start + i * (.14 + Math.random() * .06);
      const duration = .085 + Math.random() * .065;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      envelope.gain.value = 0;
      const panner = this._panner(pan);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(base * (.86 + Math.random() * .22), at);
      oscillator.frequency.exponentialRampToValueAtTime(base * 1.30, at + duration * .35);
      oscillator.frequency.exponentialRampToValueAtTime(base * .89, at + duration);
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(.015 + Math.random() * .010, at + .018);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
      oscillator.connect(envelope);
      envelope.connect(panner);
      panner.connect(this.ambience.bird);
      this._track(oscillator, [envelope, panner], 'bird', envelope);
      oscillator.start(at);
      oscillator.stop(at + duration + .04);
    }
  }

  _cricket() {
    const ctx = this.context;
    const at = ctx.currentTime + .02;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    envelope.gain.value = 0;
    const panner = this._panner(Math.random() * 1.7 - .85);
    const frequency = 4100 + Math.random() * 950;
    const count = 3 + Math.floor(Math.random() * 3);
    const spacing = .09 + Math.random() * .025;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, at);
    envelope.gain.setValueAtTime(0, at);
    for (let i = 0; i < count; i++) {
      const pulse = at + i * spacing;
      oscillator.frequency.setValueAtTime(frequency, pulse);
      oscillator.frequency.linearRampToValueAtTime(frequency * 1.018, pulse + .022);
      oscillator.frequency.linearRampToValueAtTime(frequency, pulse + .047);
      envelope.gain.setValueAtTime(0, pulse);
      envelope.gain.linearRampToValueAtTime(.005 + Math.random() * .004, pulse + .009);
      envelope.gain.exponentialRampToValueAtTime(.0001, pulse + .047);
      envelope.gain.linearRampToValueAtTime(0, pulse + .06);
    }
    oscillator.connect(envelope); envelope.connect(panner); panner.connect(this.ambience.cricket);
    this._track(oscillator, [envelope, panner], 'cricket', envelope);
    this.calls.cricket++;
    oscillator.start(at); oscillator.stop(at + (count - 1) * spacing + .08);
  }

  _frog() {
    const ctx = this.context;
    const at = ctx.currentTime + .02;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    envelope.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    const panner = this._panner(Math.random() * 1.5 - .75);
    const base = 170 + Math.random() * 85;
    oscillator.type = 'triangle';
    filter.type = 'lowpass'; filter.frequency.value = 950;
    envelope.gain.setValueAtTime(0, at);
    const calls = Math.random() < .45 ? 2 : 1;
    for (let i = 0; i < calls; i++) {
      const croak = at + i * .48;
      oscillator.frequency.setValueAtTime(base * 1.25, croak);
      oscillator.frequency.exponentialRampToValueAtTime(base * .8, croak + .28);
      // A quiet, throaty pulse train instead of the old low bird whistle.
      for (let pulse = 0; pulse < 9; pulse++) {
        const time = croak + pulse * .03;
        const body = Math.sin((pulse + 1) / 10 * Math.PI);
        envelope.gain.setValueAtTime(0, time);
        envelope.gain.linearRampToValueAtTime(.014 * body, time + .005);
        envelope.gain.exponentialRampToValueAtTime(.0001, time + .025);
        envelope.gain.linearRampToValueAtTime(0, time + .029);
      }
    }
    oscillator.connect(filter); filter.connect(envelope); envelope.connect(panner); panner.connect(this.ambience.frog);
    this._track(oscillator, [filter, envelope, panner], 'frog', envelope);
    this.calls.frog++;
    oscillator.start(at); oscillator.stop(at + (calls - 1) * .48 + .31);
  }

  update(dt, state = {}) {
    Object.assign(this.state, state);
    if (!this.started || this.disposed || !this.context || this.context.state !== 'running') return;
    dt = Math.min(Math.max(dt, 0), .1);
    const { underwater } = this.state;
    const now = this.context.currentTime;
    this.lowpass.frequency.setTargetAtTime(underwater ? 580 : 12500, now, .3);
    this._updateAmbience();
    this.nextBird -= dt;
    if (this.nextBird <= 0 && !this.muted) {
      if (this.ambienceTargets.bird > .01) this._chirp();
      this.nextBird = 4.5 + Math.random() * 7;
    }
    this.nextCricket -= dt;
    if (this.nextCricket <= 0 && !this.muted) {
      if (this.ambienceTargets.cricket > .01) this._cricket();
      this.nextCricket = 2.6 + Math.random() * 2.7;
    }
    this.nextFrog -= dt;
    if (this.nextFrog <= 0 && !this.muted) {
      if (this.ambienceTargets.frog > .01) this._frog();
      this.nextFrog = 11 + Math.random() * 13;
    }
  }

  effect(kind) {
    if (!this.enabled || !this.context || this.disposed) return;
    const settings = {
      break: [.13, 880, .19, .65],
      place: [.085, 370, .15, .55],
      jump: [.15, 520, .055, .8],
    }[kind];
    if (!settings) return;
    const ctx = this.context;
    const at = ctx.currentTime;
    if (at - (this.lastEffect.get(kind) ?? -Infinity) < .065) return;
    this.lastEffect.set(kind, at);
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
    this._track(source, [filter, envelope], kind, envelope);
    source.start(at, Math.random() * 4); source.stop(at + duration + .02);
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const voice of this.voices) {
      try { voice.source.stop(); } catch {}
      voice.source.disconnect();
      for (const node of voice.nodes) node.disconnect();
    }
    this.voices.clear();
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.started = false;
  }
}

export default AmbientAudio;
