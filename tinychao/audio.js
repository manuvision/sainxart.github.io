import { SEQUENCES } from './assets/audio-sequences.js';
// Original Tiny Chao Garden note sequences, played with local handheld-style instruments.
// No audio network requests, recordings, or audio before the first gesture.
const NOTES = {
  C3: 130.81, D3: 146.83, E3: 164.81, G3: 196, A3: 220,
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880,
  C6: 1046.5, D6: 1174.66, E6: 1318.51,
};

const ALIASES = {
  click: 'select', confirm: 'select', start: 'select', menu: 'select',
  cancel: 'back', close: 'back', cursor: 'move', navigate: 'move',
  egg: 'egg', hatchling: 'hatch', love: 'pet', happy: 'pet',
  eat: 'feed', food: 'feed', purchase: 'buy', shop: 'buy',
  ring: 'coin', collect: 'coin', reward: 'coin', wrong: 'error',
  fail: 'lose', success: 'win', victory: 'win', correct: 'match',
  flip: 'move', bounce: 'jump', catch: 'coin', damage: 'hit',
  rest: 'sleep', wake: 'pet', tap: 'pet', crack: 'hit', game:'select', chao:'pet',
};

const ORIGINAL_EFFECTS = {
  move:'se_msgbox_select',select:'se_confirm',back:'se_msgbox',
  egg:'se_chao_walk',hatch:'se_hatch',pet:'se_speech_bubble',
  feed:'se_gauge_expands',buy:'se_confirm',levelup:'se_gauge_lvl_up',
  sleep:'se_snore',play:'se_toy_trumpet',trumpet:'se_toy_trumpet',lose:'se_minigame_lost',
};

export class GardenAudio {
  constructor() {
    this.enabled = true;
    this.musicEnabled = true;
    this.context = null;
    this._unlocked = false;
    this._suspended = false;
    this._timer = null;
    this._nextNote = 0;
    this._step = 0;
    this._voices = new Set();
    this._lastPlayed = Object.create(null);
    this._unlocking = null;
    this.scene='garden';this._musicIndex=0;
  }

  async unlock() {
    if (this._unlocking) return this._unlocking;
    this._unlocking = this._unlock();
    try { return await this._unlocking; }
    finally { this._unlocking = null; }
  }

  async _unlock() {
    try {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return false;
      if (!this.context || this.context.state === 'closed') this._createContext(AudioContextClass);
      this._unlocked = true;
      if(this._suspended)return false;
      // These operations begin in the gesture's synchronous call stack, as iOS requires.
      const resume = this.context.resume();
      const buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.master);
      source.onended = () => source.disconnect();
      source.start();
      await resume;
      this._startMusic();
      return this.context.state === 'running';
    } catch (_) {
      // Autoplay policy, audio interruption, and unavailable hardware are recoverable.
      return false;
    }
  }

  _createContext(AudioContextClass) {
    this._stopMusic();
    this.context = new AudioContextClass({ latencyHint: 'interactive' });
    const ctx = this.context;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.65 : 0;
    this.effects = ctx.createGain();
    this.effects.gain.value = 0.62;
    this.music = ctx.createGain();
    this.music.gain.value = 0.15;
    const softener = ctx.createBiquadFilter();
    softener.type = 'lowpass';
    softener.frequency.value = 4300;
    softener.Q.value = 0.3;
    this.effects.connect(softener);
    this.music.connect(softener);
    softener.connect(this.master);
    this.master.connect(ctx.destination);

    // A narrow pulse is characteristic of handheld chips; fewer harmonics keep it soft.
    const real = new Float32Array(25);
    const imag = new Float32Array(25);
    for (let harmonic = 1; harmonic < real.length; harmonic++) {
      real[harmonic] = Math.sin(2 * Math.PI * harmonic * 0.25) / (Math.PI * harmonic);
      imag[harmonic] = (1 - Math.cos(2 * Math.PI * harmonic * 0.25)) / (Math.PI * harmonic);
    }
    this._pulse = ctx.createPeriodicWave(real, imag);
    const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const samples = noise.getChannelData(0);
    // Sample-and-hold noise gives the effects a low-bit texture.
    let held = 0;
    for (let index = 0; index < samples.length; index++) {
      if (index % 5 === 0) held = Math.random() * 2 - 1;
      samples[index] = held;
    }
    this._noiseBuffer = noise;
    ctx.onstatechange = () => {
      if (ctx !== this.context) return;
      if (ctx.state === 'running') this._startMusic();
      else this._stopMusic();
    };
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.context && this.master && this.context.state !== 'closed') {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.enabled ? 0.65 : 0, now, 0.015);
    }
    if (this.enabled) this._startMusic();
    else this._stopMusic();
  }

  setMusic(enabled) {
    this.musicEnabled = Boolean(enabled);
    if (this.musicEnabled) this._startMusic();
    else this._stopMusic();
  }

  suspend() {
    this._suspended = true;
    this._stopMusic();
    this._stopVoices();
    if (this.context && this.context.state === 'running') {
      try { this.context.suspend().catch(() => {}); } catch (_) { /* Audio may close during navigation. */ }
    }
  }

  async resume() {
    this._suspended = false;
    if (!this._unlocked || !this.context || this.context.state === 'closed') return false;
    try {
      await this.context.resume();
      this._startMusic();
      return this.context.state === 'running';
    } catch (_) { return false; }
  }

  play(name) {
    name = ALIASES[name] || name;
    if(!this.enabled||!this._unlocked||this._suspended||!this.context)return;
    if(this.context.state!=='running'){this.context.resume().then(()=>{if(this.context?.state==='running')this.play(name);}).catch(()=>{});return;}
    const now = this.context.currentTime;
    // Touch/keyboard repeat should never produce an uncontrolled pileup.
    const cooldown = name === 'move' ? 0.045 : name === 'pet' ? 0.1 : 0.025;
    if (now - (this._lastPlayed[name] ?? -Infinity) < cooldown) return;
    this._lastPlayed[name] = now;
    const original=SEQUENCES[ORIGINAL_EFFECTS[name]];
    if(original){for(const note of original.notes)this._sequenceNote(note,now+note[0],this.effects);return;}
    const tone = (frequency, offset = 0, duration = 0.09, volume = 0.17, type = 'pulse', end) => {
      this._tone(frequency, now + offset, duration, volume, type, this.effects, end);
    };
    const arpeggio = (notes, spacing = 0.075, duration = 0.1, volume = 0.15) => {
      notes.forEach((note, index) => tone(NOTES[note] || note, index * spacing, duration, volume));
    };

    switch (name) {
      case 'move': tone(620, 0, 0.028, 0.08, 'triangle', 760); break;
      case 'select': arpeggio(['E5', 'A5'], 0.055, 0.075, 0.13); break;
      case 'back': arpeggio(['E5', 'C5'], 0.05, 0.065, 0.1); break;
      case 'hatch':
        this._noise(now, 0.11, 0.065, 1600);
        this._noise(now + 0.16, 0.11, 0.075, 2100);
        ['C5', 'E5', 'G5', 'C6', 'E6', 'C6'].forEach((note, index) => {
          tone(NOTES[note], 0.29 + index * 0.1, index === 5 ? 0.4 : 0.13, 0.17);
        });
        tone(NOTES.C4, 0.3, 0.75, 0.16, 'triangle');
        break;
      case 'pet':
        tone(690, 0, 0.09, 0.14, 'sine', 940);
        tone(840, 0.1, 0.13, 0.12, 'triangle', 1190);
        break;
      case 'feed':
        tone(240, 0, 0.06, 0.16, 'triangle', 170);
        tone(310, 0.11, 0.07, 0.15, 'triangle', 220);
        tone(NOTES.E5, 0.23, 0.11, 0.1);
        tone(NOTES.G5, 0.31, 0.16, 0.1);
        break;
      case 'buy': arpeggio(['C5', 'E5', 'G5', 'C6'], 0.055, 0.12); break;
      case 'coin':
        tone(1318.5, 0, 0.035, 0.1);
        tone(1760, 0.035, 0.15, 0.085);
        break;
      case 'error':
        tone(175, 0, 0.075, 0.13, 'triangle', 125);
        tone(175, 0.095, 0.09, 0.12, 'triangle', 110);
        break;
      case 'match': arpeggio(['E5', 'G5', 'C6'], 0.065, 0.13); break;
      case 'win':
        arpeggio(['C5', 'E5', 'G5', 'C6', 'G5', 'A5', 'C6'], 0.11, 0.18);
        tone(NOTES.C4, 0.66, 0.52, 0.13, 'triangle');
        tone(NOTES.E5, 0.66, 0.48, 0.07, 'triangle');
        break;
      case 'lose': arpeggio(['E5', 'D5', 'C5', 'A4'], 0.12, 0.18, 0.11); break;
      case 'jump': tone(260, 0, 0.13, 0.14, 'pulse', 780); break;
      case 'shoot': tone(940, 0, 0.08, 0.11, 'pulse', 290); break;
      case 'hit':
        this._noise(now, 0.075, 0.095, 1300);
        tone(160, 0, 0.075, 0.11, 'triangle', 65);
        break;
      case 'sleep': arpeggio(['G5', 'E5', 'C5'], 0.18, 0.27, 0.065); break;
      default: tone(NOTES.E5, 0, 0.055, 0.08, 'triangle');
    }
  }

  setScene(mode) {
    const next=['memory','janken','memoryIntro','jankenIntro','games','pause','result'].includes(mode)?'minigame':'garden';
    if(next===this.scene)return;this.scene=next;this._stopMusic();this._startMusic();
  }

  _sequenceNote(note,time,destination){
    const [,duration,pitch,velocity,program,,bends]=note;
    const music=destination===this.music, volume=velocity*(music?.24:.2);
    if(program===127){
      if(pitch===36)this._tone(74,time,Math.min(.16,duration),volume*.65,'sine',destination,42);
      else this._noise(time,Math.min(.12,duration),volume*.25,pitch>=42?4500:1600,destination);
      return;
    }
    const type=program===72||program===65?'sine':[9,10,42,101,3].includes(program)?'triangle':'pulse';
    this._tone(440*Math.pow(2,(pitch-69)/12),time,Math.max(.018,duration),volume,type,destination,undefined,bends);
  }

  _tone(frequency, time, duration, volume, type, destination, endFrequency, bends) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this._voices.size >= 64) return;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    const isMusic = destination === this.music;
    if (type === 'pulse') oscillator.setPeriodicWave(this._pulse);
    else oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    if(bends)for(const [offset,cents] of bends){if(offset<=duration)oscillator.detune.linearRampToValueAtTime(cents,time+offset);}
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.linearRampToValueAtTime(volume, time + 0.005);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * 0.55), time + duration * 0.55);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    const voice = { source: oscillator, envelope, music: isMusic };
    this._voices.add(voice);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      this._voices.delete(voice);
    };
    oscillator.start(time);
    oscillator.stop(time + duration + 0.015);
  }

  _noise(time, duration, volume, frequency, destination = this.effects) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this._voices.size >= 64) return;
    const source = ctx.createBufferSource();
    source.buffer = this._noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.linearRampToValueAtTime(volume, time + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(destination);
    const voice = { source, envelope, music: destination === this.music };
    this._voices.add(voice);
    source.onended = () => {
      source.disconnect(); filter.disconnect(); envelope.disconnect();
      this._voices.delete(voice);
    };
    source.start(time);
    source.stop(time + duration + 0.01);
  }

  _startMusic() {
    if(this._timer!==null||!this.enabled||!this.musicEnabled||!this._unlocked||this._suspended||this.context?.state!=='running')return;
    const sequence=SEQUENCES[this.scene==='minigame'?'mus_minigame':'mus_garden'];
    if(!sequence?.notes.length)return;
    this._musicOrigin=this.context.currentTime+.07;this._musicIndex=0;
    const loopIndex=Math.max(0,sequence.notes.findIndex(note=>note[0]>=sequence.loopStart));
    const schedule=()=>{
      if(this.context?.state!=='running'||this._suspended||!this.enabled||!this.musicEnabled){this._stopMusic();return;}
      const now=this.context.currentTime;
      if(this._musicOrigin+sequence.notes[this._musicIndex][0]<now-1){this._musicOrigin=now+.04;this._musicIndex=0;}
      let scheduled=0;
      while(scheduled++<128){
        const note=sequence.notes[this._musicIndex],at=this._musicOrigin+note[0];
        if(at>now+.2)break;
        this._sequenceNote(note,Math.max(now+.002,at),this.music);
        this._musicIndex++;
        if(this._musicIndex>=sequence.notes.length){this._musicIndex=loopIndex;this._musicOrigin+=sequence.duration-sequence.loopStart;}
      }
    };
    this._timer=globalThis.setInterval(schedule,75);schedule();
  }

  _stopMusic() {
    if (this._timer !== null) globalThis.clearInterval(this._timer);
    this._timer = null;
    this._stopVoices(true);
  }

  _stopVoices(musicOnly = false) {
    const now = this.context?.currentTime || 0;
    for (const voice of this._voices) {
      if (musicOnly && !voice.music) continue;
      try {
        voice.envelope.gain.cancelScheduledValues(now);
        voice.envelope.gain.setTargetAtTime(0.0001, now, 0.008);
        voice.source.stop(now + 0.035);
      } catch (_) { /* Already-ended sources need no additional cleanup. */ }
    }
  }
}

export default GardenAudio;
