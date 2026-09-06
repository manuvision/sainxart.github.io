import test from 'node:test';
import assert from 'node:assert/strict';
import { AmbientAudio, soundscapeMix } from '../audio.js';

class Param {
  constructor(value = 1) { this.value = value; this.events = []; }
  event(type, value, time, constant) { this.events.push({ type, value, time, constant }); return this; }
  setValueAtTime(value, time) { return this.event('set', value, time); }
  linearRampToValueAtTime(value, time) { return this.event('linear', value, time); }
  exponentialRampToValueAtTime(value, time) { assert.ok(value > 0); return this.event('exponential', value, time); }
  setTargetAtTime(value, time, constant) { return this.event('target', value, time, constant); }
  cancelAndHoldAtTime(time) { return this.event('hold', undefined, time); }
  cancelScheduledValues(time) { return this.event('cancel', undefined, time); }
}

class AudioNode {
  constructor(kind) {
    this.kind = kind; this.connections = []; this.disconnected = false;
    this.gain = new Param(); this.frequency = new Param(); this.pan = new Param(0);
    this.playbackRate = new Param(); this.Q = new Param(); this.loop = false;
    this.starts = []; this.stops = [];
  }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.disconnected = true; }
  start(time = 0) { this.starts.push(time); }
  stop(time = 0) { this.stops.push(time); }
}

class Context {
  constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 4000; this.nodes = []; this.destination = {}; }
  node(kind) { const node = new AudioNode(kind); this.nodes.push(node); return node; }
  createGain() { return this.node('gain'); }
  createBiquadFilter() { return this.node('filter'); }
  createStereoPanner() { return this.node('panner'); }
  createBufferSource() { return this.node('buffer'); }
  createOscillator() { return this.node('oscillator'); }
  createBuffer(channels, length) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData(channel) { return data[channel]; } };
  }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
  advance(seconds) {
    this.currentTime += seconds;
    for (const node of this.nodes) {
      if (!node.ended && node.stops.length && node.stops.at(-1) <= this.currentTime) {
        node.ended = true; node.onended?.();
      }
    }
  }
}

async function fixture(t) {
  const audio = new AmbientAudio();
  await audio.start();
  t.after(() => audio.dispose());
  return audio;
}

// Node does not provide WebAudio. Restore this one test seam after each test.
const nativeAudioContext = globalThis.AudioContext;
globalThis.AudioContext = Context;
test.after(() => { if (nativeAudioContext === undefined) delete globalThis.AudioContext; else globalThis.AudioContext = nativeAudioContext; });

function advance(audio, seconds, state = {}) {
  for (let t = 0; t < seconds; t += .1) { audio.context.advance(.1); audio.update(.1, state); }
}

test('daylight and habitat select birds or night wildlife with a gradual dusk crossfade', () => {
  assert.deepEqual(soundscapeMix(1), { bird: 1, cricket: 0, frog: 0 });
  assert.deepEqual(soundscapeMix(.07), { bird: 0, cricket: 1, frog: 1 });
  const dusk = soundscapeMix(.42);
  assert.ok(dusk.bird > 0 && dusk.bird < .1);
  assert.ok(dusk.cricket > .2 && dusk.cricket < .6);
  assert.deepEqual(soundscapeMix(.07, 'desert'), { bird: 0, cricket: .38, frog: 0 });
  assert.deepEqual(soundscapeMix(.07, 'ice'), { bird: 0, cricket: 0, frog: 0 });
  assert.deepEqual(soundscapeMix(.07, 'jungle', true), { bird: 0, cricket: 0, frog: 0 });
});

test('dry land has no continuous water, wind or noise sources', async t => {
  const audio = await fixture(t);
  assert.equal(audio.context.nodes.filter(n => n.kind === 'buffer' || n.kind === 'oscillator').length, 0);
  advance(audio, 30, { daylight: 1 });
  assert.ok(audio.calls.bird >= 2);
  assert.equal(audio.calls.cricket, 0); assert.equal(audio.calls.frog, 0);
  assert.equal(audio.context.nodes.filter(n => n.kind === 'buffer' || n.loop).length, 0);
});

test('night schedules quiet cricket pulses and occasional frogs without any bird calls', async t => {
  const audio = await fixture(t);
  advance(audio, 35, { daylight: .07 });
  assert.equal(audio.calls.bird, 0);
  assert.ok(audio.calls.cricket >= 6);
  assert.ok(audio.calls.frog >= 2);
  assert.ok(audio.calls.cricket > audio.calls.frog);
  for (const node of audio.context.nodes.filter(n => n.kind === 'gain')) {
    const peaks = node.gain.events.filter(e => e.type === 'linear');
    assert.ok(peaks.every(e => e.value <= .014), 'night calls stay quieter than the daytime birds');
  }
});

test('changing to night cancels pending bird notes with a short click-free release', async t => {
  const audio = await fixture(t);
  audio.nextBird = 0; audio.update(.1, { daylight: 1 });
  const birds = Array.from(audio.voices);
  assert.ok(birds.length >= 2 && birds.every(v => v.kind === 'bird'));
  assert.ok(birds.every(v => v.envelope.gain.value === 0), 'future notes begin silent, including when cancelled before starting');
  audio.update(0, { daylight: .07 });
  assert.equal(audio.ambienceTargets.bird, 0);
  for (const voice of birds) {
    assert.ok(voice.envelope.gain.events.some(e => e.type === 'hold'));
    assert.deepEqual(voice.envelope.gain.events.at(-1), { type: 'linear', value: 0, time: .08, constant: undefined });
    assert.equal(voice.source.stops.at(-1), .09);
  }
  const birdCount = audio.calls.bird;
  advance(audio, 20, { daylight: .07 });
  assert.equal(audio.calls.bird, birdCount);
  assert.ok(birds.every(v => v.source.disconnected && v.nodes.every(n => n.disconnected)));
});

test('wildlife is made of short enveloped voices that disconnect when finished', async t => {
  const audio = await fixture(t);
  audio.nextBird = 99; audio.nextCricket = 0; audio.nextFrog = 0;
  audio.update(.1, { daylight: .07 });
  const voices = Array.from(audio.voices);
  assert.deepEqual(voices.map(v => v.kind).sort(), ['cricket', 'frog']);
  for (const voice of voices) {
    assert.ok(voice.source.stops.at(-1) < 1);
    assert.equal(voice.envelope.gain.events.at(-1).value, 0);
  }
  audio.context.advance(1);
  assert.equal(audio.voices.size, 0);
  assert.ok(voices.every(v => v.source.disconnected && v.nodes.every(n => n.disconnected)));
});

test('mute still fades the master and suppresses new ambience and interaction voices', async t => {
  const audio = await fixture(t);
  audio.effect('place');
  assert.equal(audio.voices.size, 1);
  audio.effect('place'); assert.equal(audio.voices.size, 1, 'interaction rate limit is preserved');
  audio.setMuted(true);
  assert.equal(audio.master.gain.events.at(-1).value, 0);
  const calls = { ...audio.calls };
  advance(audio, 30, { daylight: .07, moving: true, inWater: true });
  audio.effect('break');
  assert.deepEqual(audio.calls, calls); assert.equal(audio.voices.size, 0);
  audio.setMuted(false);
  assert.equal(audio.master.gain.events.at(-1).value, .62);
  audio.effect('break'); assert.equal(audio.voices.size, 1);
});

test('being beside, inside or below water never creates water, wind or bubble ambience', async t => {
  const audio = await fixture(t);
  advance(audio, 15, { daylight: 1, waterProximity: 1 });
  advance(audio, 15, { inWater: true });
  assert.ok(audio.calls.bird >= 2, 'forest wildlife still plays beside water');
  assert.equal(audio.context.nodes.filter(n => n.kind === 'buffer' || n.loop).length, 0);
  assert.ok(Array.from(audio.voices).every(v => v.kind === 'bird'));
  const calls = { ...audio.calls };
  advance(audio, 30, { underwater: true });
  assert.deepEqual(audio.calls, calls, 'submersion suppresses wildlife rather than adding water sounds');
  assert.equal(audio.voices.size, 0);
  assert.equal(audio.context.nodes.filter(n => n.kind === 'buffer' || n.loop).length, 0);
  assert.equal(audio.lowpass.frequency.events.at(-1).value, 580);
  advance(audio, 26, { underwater: false, daylight: .07 });
  assert.equal(audio.calls.bird, calls.bird);
  assert.ok(audio.calls.cricket > 0 && audio.calls.frog > 0, 'night wildlife resumes after surfacing');
  assert.ok(Array.from(audio.voices).every(v => v.kind === 'cricket' || v.kind === 'frog'));
});

test('walking is silent both on land and in water, while deliberate interaction effects remain', async t => {
  const audio = await fixture(t);
  audio.nextBird = audio.nextCricket = audio.nextFrog = 99;
  advance(audio, 3, { moving: true });
  audio.effect('step');
  assert.equal(audio.voices.size, 0);
  assert.equal(audio.context.nodes.filter(n => n.kind === 'buffer').length, 0);
  advance(audio, 3, { moving: true, inWater: true });
  audio.effect('step');
  assert.equal(audio.voices.size, 0);
  assert.equal(audio.context.nodes.filter(n => n.kind === 'buffer').length, 0);
  audio.effect('jump'); audio.effect('place'); audio.effect('break');
  assert.deepEqual(Array.from(audio.voices, v => v.kind).sort(), ['break', 'jump', 'place']);
});

test('disposing audio stops queued voices, disconnects their nodes and prevents restart', async t => {
  const audio = await fixture(t);
  audio.nextBird = 0; audio.update(.1, { daylight: 1 });
  audio.effect('jump');
  const voices = Array.from(audio.voices);
  assert.ok(voices.length > 0);
  await audio.dispose();
  assert.equal(audio.context.state, 'closed'); assert.equal(audio.voices.size, 0);
  assert.ok(voices.every(v => v.source.disconnected && v.nodes.every(n => n.disconnected)));
  assert.equal(await audio.start(), false);
  assert.equal(audio.diagnostics.enabled, false);
});
