import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenAudio} from '../audio.js';
import {SEQUENCES} from '../assets/audio-sequences.js';

test('original MIDI sequences contain bounded, ordered notes and playable loops',()=>{
  for(const [name,sequence] of Object.entries(SEQUENCES)){
    assert.ok(sequence.duration>0&&sequence.duration<180,name);
    assert.ok(sequence.loopStart>=0&&sequence.loopStart<sequence.duration);
    let previous=-1;
    for(const row of sequence.notes){
      assert.ok(row[0]>=previous&&row[0]>=0);previous=row[0];
      assert.ok(row[1]>0&&row[0]+row[1]<=sequence.duration+.001);
      assert.ok(row[2]>=0&&row[2]<=127&&row[3]>=0&&row[3]<=1);
      for(const [time,cents] of row[6]||[])assert.ok(time>=0&&time<=row[1]+.001&&Number.isFinite(cents));
    }
  }
  assert.ok(SEQUENCES.mus_garden.notes.length>700);
  assert.ok(SEQUENCES.mus_minigame.notes.length>1200);
});

test('effects stay silent before activation and egg taps use the short original effect',()=>{
  const a=new GardenAudio(),voices=[];a.setMusic(false);
  a._tone=(...args)=>voices.push(args);a._noise=(...args)=>voices.push(args);
  a.play('hatch');assert.equal(voices.length,0);
  a._unlocked=true;a.context={state:'running',currentTime:1};a.effects={};a.music={};
  a.play('egg');assert.equal(voices.length,1);assert.ok(voices[0][2]<.2);
  voices.length=0;a.play('hatch');assert.equal(voices.length,SEQUENCES.se_hatch.notes.length);
  assert.ok(voices.some(v=>v[2]>1),'Hatch retains original rising note');
  voices.length=0;a.enabled=false;a.play('buy');assert.equal(voices.length,0);
});

test('scene changes choose the original minigame theme and preserve mute preference',()=>{
  const a=new GardenAudio();a.setMusic(false);a.setScene('memory');assert.equal(a.scene,'minigame');
  a.setScene('pause');assert.equal(a.scene,'minigame');a.setScene('garden');assert.equal(a.scene,'garden');assert.equal(a._timer,null);
});
