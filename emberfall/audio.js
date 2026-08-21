const SOUND_KEY = "emberfall-sound-v1";

export class SoundEngine {
  constructor() {
    this.enabled = localStorage.getItem(SOUND_KEY) === "on";
    this.context = null;
    this.noise = null;
    this.ambientTimer = null;
  }

  ensure() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      this.context = new Context();
      const length = this.context.sampleRate;
      this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
      const channel = this.noise.getChannelData(0);
      for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
    }
    if (this.context.state === "suspended") this.context.resume();
    return this.context;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
    if (enabled) {
      this.ensure();
      this.tone(520, 0.06, "sine", 0.035, 660);
      this.startAmbient();
    } else {
      window.clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  tone(frequency, duration, type = "sine", volume = 0.05, endFrequency = frequency, delay = 0) {
    if (!this.enabled) return;
    const context = this.ensure();
    if (!context) return;
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.012, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  noiseHit(duration = 0.08, volume = 0.04, filterFrequency = 1000, delay = 0) {
    if (!this.enabled) return;
    const context = this.ensure();
    if (!context || !this.noise) return;
    const now = context.currentTime + delay;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noise;
    filter.type = "bandpass";
    filter.frequency.value = filterFrequency;
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(now);
    source.stop(now + duration);
  }

  play(name) {
    if (!this.enabled) return;
    switch (name) {
      case "paper":
        this.noiseHit(0.075, 0.035, 1700);
        this.tone(110, 0.07, "sine", 0.035, 80, 0.025);
        break;
      case "card":
        this.noiseHit(0.09, 0.042, 2100);
        this.tone(130, 0.08, "triangle", 0.045, 72, 0.03);
        break;
      case "move":
        this.noiseHit(0.12, 0.026, 950);
        this.tone(260, 0.09, "sine", 0.02, 340);
        break;
      case "mana":
        this.tone(420, 0.13, "sine", 0.04, 720);
        this.tone(630, 0.11, "sine", 0.025, 910, 0.04);
        break;
      case "fire":
        this.noiseHit(0.2, 0.055, 620);
        this.tone(190, 0.17, "sawtooth", 0.025, 95);
        break;
      case "hit":
        this.noiseHit(0.07, 0.075, 520);
        this.tone(105, 0.11, "square", 0.04, 47);
        break;
      case "block":
        this.noiseHit(0.05, 0.045, 2500);
        this.tone(360, 0.1, "triangle", 0.035, 210);
        break;
      case "miss":
        this.noiseHit(0.13, 0.026, 2600);
        this.tone(520, 0.09, "sine", 0.018, 310);
        break;
      case "enemy":
        this.tone(94, 0.22, "sawtooth", 0.035, 62);
        this.noiseHit(0.12, 0.027, 380);
        break;
      case "victory":
        [330, 440, 554, 660].forEach((frequency, index) => this.tone(frequency, 0.28, "triangle", 0.038, frequency * 1.02, index * 0.1));
        break;
      case "defeat":
        this.tone(190, 0.5, "sawtooth", 0.032, 55);
        break;
      case "unlock":
        [440, 660, 880].forEach((frequency, index) => this.tone(frequency, 0.18, "sine", 0.033, frequency * 1.08, index * 0.075));
        this.noiseHit(0.1, 0.018, 2800, 0.13);
        break;
      default:
        this.tone(300, 0.05, "sine", 0.02, 340);
    }
  }

  startAmbient(isCombat = false) {
    window.clearTimeout(this.ambientTimer);
    const crackle = () => {
      if (!this.enabled) return;
      if (!document.hidden && !isCombat) this.noiseHit(0.035, 0.006 + Math.random() * 0.006, 1200 + Math.random() * 1300);
      this.ambientTimer = window.setTimeout(crackle, 1800 + Math.random() * 3400);
    };
    this.ambientTimer = window.setTimeout(crackle, 1400);
  }
}
