const NOTES = {
  click: [[620, 0.035]], select: [[880, 0.035]], confirm: [[660, 0.055], [990, 0.075]],
  back: [[660, 0.045], [440, 0.05]], error: [[185, 0.08], [165, 0.1]],
  egg: [[440, 0.07], [550, 0.07], [660, 0.11]],
  hatch: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.2]],
  happy: [[784, 0.07], [988, 0.07], [1175, 0.1]],
  eat: [[330, 0.055], [220, 0.055], [440, 0.06], [660, 0.08]],
  clean: [[1200, 0.035], [800, 0.035], [1400, 0.035], [1000, 0.035], [1600, 0.06]],
  heal: [[523, 0.07], [659, 0.07], [784, 0.07], [1047, 0.14]],
  sleep: [[659, 0.12], [523, 0.13], [392, 0.19]],
  evolve: [[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.09], [1319, 0.22]],
  start: [[440, 0.07], [440, 0.07], [880, 0.12]],
  move: [[300, 0.025]], coin: [[1319, 0.05], [1760, 0.07]],
  miss: [[220, 0.07], [146, 0.12]],
  win: [[659, 0.07], [784, 0.07], [1047, 0.1], [1319, 0.16]],
  gameover: [[440, 0.1], [392, 0.1], [330, 0.16]],
  tone0: [[392, 0.22]], tone1: [[523.25, 0.22]], tone2: [[659.25, 0.22]],
};

/** Original synthesized one-bit-style sounds. No assets or autoplay. */
export class PocketAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.voices = new Set();
  }

  async unlock() {
    try {
      if (!this.context) {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContext) return false;
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.12;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      return this.context.state === 'running';
    } catch { return false; }
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.context && this.master) {
      try { this.master.gain.setTargetAtTime(this.muted ? 0 : 0.12, this.context.currentTime, 0.015); } catch { /* Closed context. */ }
    }
  }

  play(name = 'click') {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const sequence = NOTES[name] || NOTES.click;
    let start = this.context.currentTime + 0.008;
    try {
      // Repeated physical-button tapping cannot create unlimited voices.
      if (this.voices.size > 28) return;
      for (const [frequency, duration] of sequence) {
        const oscillator = this.context.createOscillator();
        const envelope = this.context.createGain();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, start);
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(0.45, start + 0.004);
        envelope.gain.setValueAtTime(0.45, start + Math.max(0.006, duration - 0.018));
        envelope.gain.linearRampToValueAtTime(0, start + duration);
        oscillator.connect(envelope);
        envelope.connect(this.master);
        this.voices.add(oscillator);
        oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
        oscillator.start(start);
        oscillator.stop(start + duration + 0.01);
        start += duration + 0.018;
      }
    } catch { /* Browsers may suspend or close audio while going to background. */ }
  }
}
