const SOUND_KEY = "cairnloom-sound-v1";

export class SoundEngine {
  constructor() {
    this.enabled = localStorage.getItem(SOUND_KEY) !== "off";
    this.context = null;
    this.noise = null;
    this.ambientTimer = null;
    this.master = null;
  }

  ensure() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.context.destination);
      this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
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
      this.chime([430, 610], 0.07, 0.035);
      this.startAmbient();
    } else {
      window.clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  tone(frequency, duration, type = "sine", volume = 0.04, endFrequency = frequency, delay = 0) {
    if (!this.enabled) return;
    const context = this.ensure();
    if (!context || !this.master) return;
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.012, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  noiseHit(duration = 0.08, volume = 0.035, filterFrequency = 1000, delay = 0, filterType = "bandpass") {
    if (!this.enabled) return;
    const context = this.ensure();
    if (!context || !this.noise || !this.master) return;
    const now = context.currentTime + delay;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noise;
    filter.type = filterType;
    filter.frequency.value = filterFrequency;
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
    source.stop(now + duration);
  }

  chime(notes, spacing = 0.08, volume = 0.035) {
    notes.forEach((note, index) => this.tone(note, 0.2, "triangle", volume, note * 1.01, index * spacing));
  }

  play(name) {
    if (!this.enabled) return;
    switch (name) {
      case "paper":
        this.noiseHit(0.08, 0.03, 1800);
        this.tone(116, 0.07, "sine", 0.025, 78, 0.02);
        break;
      case "card":
        this.noiseHit(0.1, 0.04, 2200);
        this.tone(135, 0.09, "triangle", 0.035, 72, 0.025);
        break;
      case "build":
        this.noiseHit(0.07, 0.055, 740);
        this.tone(145, 0.08, "square", 0.026, 92);
        this.tone(320, 0.09, "triangle", 0.018, 390, 0.055);
        break;
      case "upgrade":
        this.noiseHit(0.06, 0.025, 2500);
        this.chime([380, 520, 710], 0.055, 0.028);
        break;
      case "sell":
        this.noiseHit(0.09, 0.025, 1700);
        this.tone(440, 0.14, "sine", 0.025, 260);
        break;
      case "arrow":
        this.noiseHit(0.035, 0.018, 2600);
        this.tone(510, 0.055, "triangle", 0.015, 230);
        break;
      case "mortar":
        this.tone(96, 0.16, "sine", 0.045, 48);
        this.noiseHit(0.14, 0.06, 480, 0.02);
        break;
      case "fire":
        this.noiseHit(0.18, 0.04, 680, 0, "lowpass");
        this.tone(190, 0.13, "sawtooth", 0.02, 85);
        break;
      case "frost":
        this.noiseHit(0.06, 0.02, 3700);
        this.tone(850, 0.16, "sine", 0.022, 1180);
        break;
      case "arc":
        [0, 0.035, 0.067].forEach((delay, index) => this.tone(720 - index * 110, 0.055, "square", 0.016, 1030 - index * 90, delay));
        break;
      case "hit":
        this.noiseHit(0.055, 0.035, 620);
        break;
      case "leak":
        this.tone(125, 0.27, "sawtooth", 0.04, 54);
        this.noiseHit(0.1, 0.03, 350);
        break;
      case "wave":
        this.chime([220, 330, 440], 0.085, 0.03);
        break;
      case "boss":
        this.tone(72, 0.6, "sawtooth", 0.05, 48);
        this.noiseHit(0.3, 0.04, 260);
        break;
      case "victory":
        this.chime([330, 440, 554, 660], 0.09, 0.035);
        break;
      case "defeat":
        this.tone(180, 0.7, "sawtooth", 0.035, 42);
        break;
      case "unlock":
        this.chime([440, 660, 880], 0.075, 0.033);
        this.noiseHit(0.11, 0.02, 2900, 0.12);
        break;
      default:
        this.tone(310, 0.05, "sine", 0.018, 360);
    }
  }

  startAmbient(inBattle = false) {
    window.clearTimeout(this.ambientTimer);
    const crackle = () => {
      if (!this.enabled) return;
      if (!document.hidden) {
        this.noiseHit(0.025 + Math.random() * 0.03, inBattle ? 0.003 : 0.006, 1100 + Math.random() * 1800);
      }
      this.ambientTimer = window.setTimeout(crackle, 1300 + Math.random() * 3100);
    };
    this.ambientTimer = window.setTimeout(crackle, 900);
  }
}
