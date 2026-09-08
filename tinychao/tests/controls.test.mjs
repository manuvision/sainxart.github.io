import test from 'node:test';
import assert from 'node:assert/strict';
import { ButtonHolds } from '../controls.js';

function clock() {
  let now = 0, next = 0; const jobs = new Map();
  return {
    setTimeout(fn, delay) { const id = ++next; jobs.set(id, { at: now + delay, fn }); return id; },
    clearTimeout(id) { jobs.delete(id); },
    tick(duration) { const end = now + duration; while (true) { const due = [...jobs].filter(([, v]) => v.at <= end).sort((a,b) => a[1].at-b[1].at)[0]; if (!due) break; now = due[1].at; jobs.delete(due[0]); due[1].fn(); } now = end; },
    get pending() { return jobs.size; },
  };
}
function setup() { const time = clock(), sent = [], states = []; const holds = new ButtonHolds({ clock: time, send: key => sent.push(key), changed: (key, down) => states.push([key, down]) }); return { time, sent, states, holds }; }

test('rapid taps and a reused pointer never leave an orphaned repeating timer', () => {
  const { time, sent, holds } = setup();
  for (let i=0;i<20;i++) { holds.start('pointer:1', 'a'); time.tick(20); holds.stop('pointer:1'); }
  assert.equal(sent.length, 20); time.tick(10000); assert.equal(sent.length, 20);
  holds.start('pointer:1', 'left'); time.tick(200); holds.start('pointer:1', 'right'); time.tick(301);
  assert.deepEqual(sent.slice(-3), ['left', 'right', 'right']);
  holds.clear(); time.tick(10000); assert.equal(time.pending, 0);
});

test('releasing one finger preserves another held button and clearing releases everything', () => {
  const { time, sent, states, holds } = setup();
  holds.start('pointer:1', 'a'); holds.start('pointer:2', 'a'); holds.start('key:ArrowLeft', 'left', 'keyboard');
  holds.stop('pointer:1'); assert.equal(holds.hasKey('a'), true);
  assert.deepEqual(states, [['a', true], ['left', true]]);
  holds.stopGroup('pointer'); assert.equal(holds.hasKey('a'), false); assert.equal(holds.hasKey('left'), true);
  holds.clear(); const count = sent.length; time.tick(10000);
  assert.equal(sent.length, count); assert.equal(time.pending, 0); assert.deepEqual(states.at(-1), ['left', false]);
});

test('mode changes during button dispatch and lost focus cancel scheduled repeats', () => {
  const time = clock(); let visible = true, count = 0, holds;
  holds = new ButtonHolds({ clock: time, canRepeat: () => visible, send: () => { count++; if (count===1) holds.clear(); } });
  holds.start('pointer:1', 'a'); time.tick(1000); assert.equal(count, 1); assert.equal(time.pending, 0);
  holds.start('pointer:1', 'up'); visible = false; time.tick(5000);
  assert.equal(count, 2); assert.equal(holds.held.size, 0); assert.equal(time.pending, 0);
});
