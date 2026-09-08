import test from 'node:test';
import assert from 'node:assert/strict';
import { TinyGarden, freshState, restoreState, SAVE_KEY } from '../game.js';
import { EGGS, makeEggWeights, rollEggStock, snapshotChao } from '../eggs.js';
const memory = new Map();
const context = new Proxy({}, { get:(target,key)=>target[key]||(()=>{}), set:(target,key,value)=>{target[key]=value;return true;} });
globalThis.document={createElement:()=>({width:240,height:160,setAttribute(){},getContext:()=>context})};
globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
function garden(){memory.clear();return new TinyGarden();}
function hatch(game){for(let i=0;i<12;i++)game.pet();for(let i=0;i<18;i++)game.update(.1);assert.equal(game.state.hatched,true);}

test('an existing v3 garden migrates into Friends without changing its Chao or belongings',()=>{
 const old=freshState();delete old.color;delete old.collection;delete old.eggStock;delete old.eggWeights;delete old.eggRefreshAt;
 old.name='BUBBLES';old.hatched=true;old.rings=2345;old.stats.swim={level:9,xp:42};old.inventory.blue=3;old.toys=['duck'];old.lastSaved=Date.now();
 const restored=restoreState(old);assert.equal(restored.color,'normal');assert.equal(restored.name,'BUBBLES');assert.equal(restored.rings,2345);assert.deepEqual(restored.stats.swim,{level:9,xp:42});assert.equal(restored.inventory.blue,3);assert.deepEqual(restored.toys,['duck']);assert.equal(restored.collection.normal.name,'BUBBLES');
 restored.stats.swim.xp=80;assert.equal(restored.collection.normal.stats.swim.xp,42,'Snapshots do not alias live stats');
});

test('an egg purchase preserves the current Chao and enforces price and one waiting egg',()=>{
 const game=garden();assert.equal(game.buyEgg(),false);hatch(game);game.state.name='MOMO';game.state.stats.fly={level:7,xp:32};game.state.rings=499;
 assert.equal(game.buyEgg(),false);assert.equal(game.state.rings,499);game.state.rings=25000;
 assert.equal(game.buyEgg(),true);assert.equal(game.state.color,'normal');assert.equal(game.state.name,'MOMO');assert.equal(game.state.rings,24500);assert.equal(game.state.collection.silver.hatched,false);assert.equal(game.mode,'friends');
 game.state.eggUnlocks.push('onyx');game.state.eggStock='onyx';assert.equal(game.buyEgg(),false);assert.equal(game.state.rings,24500);assert.equal(game.state.collection.onyx,undefined);
});

test('hatching and switching rare friends retains independent names, stats and shared inventory through backup reload',()=>{
 const game=garden();hatch(game);game.state.name='MOMO';game.state.stats.swim={level:6,xp:77};game.state.inventory.pink=2;game.state.rings=25000;game.state.eggUnlocks.push('onyx');game.state.eggStock='onyx';
 assert.equal(game.buy('egg'),true);assert.equal(game.state.rings,5000);const onyx=EGGS.findIndex(e=>e.id==='onyx');assert.equal(game.visitFriend(onyx),true);assert.equal(game.state.color,'onyx');assert.equal(game.state.hatched,false);assert.equal(game.state.stats.swim.level,0);
 hatch(game);game.state.name='INK';game.feed('pink');assert.equal(game.state.inventory.pink,1);const onyxStats=structuredClone(game.state.stats);
 game.visitFriend(0);assert.equal(game.state.name,'MOMO');assert.deepEqual(game.state.stats.swim,{level:6,xp:77});assert.equal(game.state.inventory.pink,1);assert.equal(game.state.rings,5000);
 const exported=game.exportSave();const reloaded=new TinyGarden();reloaded.importSave(exported);reloaded.visitFriend(onyx);assert.equal(reloaded.state.name,'INK');assert.equal(reloaded.state.hatched,true);assert.deepEqual(reloaded.state.stats,onyxStats);assert.equal(reloaded.state.totalHatches,2);assert.ok(memory.get(SAVE_KEY));
});

test('the shop offers only unowned colors and retains its current offer and rarity assignment after reload',()=>{
 const game=garden();hatch(game);game.refreshEggStock();game.save();const offer=game.state.eggStock,weights=structuredClone(game.state.eggWeights);const restored=new TinyGarden();assert.equal(restored.state.eggStock,offer);assert.deepEqual(restored.state.eggWeights,weights);
 const collected=Object.fromEntries(EGGS.filter(e=>e.id!=='topaz').map(e=>[e.id,{}]));assert.equal(rollEggStock(collected,weights,()=>0,EGGS.map(e=>e.id)),'topaz');collected.topaz={};assert.equal(rollEggStock(collected,weights,Math.random,EGGS.map(e=>e.id)),null);
 const rare=Object.entries(makeEggWeights(()=>.3)).filter(([id])=>EGGS.find(e=>e.id===id).rarity==='RARE').map(([,weight])=>weight);assert.equal(rare.reduce((a,b)=>a+b,0),25);assert.deepEqual(rare.sort((a,b)=>a-b),[.125,2,5.125,5.125,12.625]);
});

test('completing a minigame restocks eggs; opening and quitting one does not reroll stock',()=>{
 const game=garden();hatch(game);game.state.eggRefreshAt=Date.now()+1000;game.startMemory();game.finishGame('memory',true);assert.ok(game.state.eggRefreshAt<Date.now()+2000);
 game.startMemory();game.finishGame('memory');assert.ok(game.state.eggRefreshAt>Date.now()+290000);
});

test('malformed collection entries are bounded and visiting the active friend never rolls progress back',()=>{
 const raw=freshState();raw.hatched=true;raw.collection.silver={...snapshotChao(raw),color:'silver',name:'<BAD>',stats:{swim:{level:999,xp:-4}}};raw.collection.fake={hatched:true};raw.collection.onyx={hatched:'yes'};
 const clean=restoreState(raw);assert.deepEqual(Object.keys(clean.collection).sort(),['normal','silver']);assert.equal(clean.collection.silver.name,'BAD');assert.deepEqual(clean.collection.silver.stats.swim,{level:99,xp:0});
 const game=garden();hatch(game);game.state.stats.run={level:3,xp:88};game.state.name='LIVE';game.visitFriend(0);assert.equal(game.state.name,'LIVE');assert.deepEqual(game.state.stats.run,{level:3,xp:88});
});


test('buying a rare egg through the shop selects that egg in Friends, including the last row',()=>{
 const game=garden();hatch(game);game.state.rings=25000;game.state.eggUnlocks.push('onyx');game.state.eggStock='onyx';game.enter('shop');game.selection=7;game.input('a');assert.equal(game.mode,'friends');assert.equal(game.selection,11);game.input('a');assert.equal(game.state.color,'onyx');assert.equal(game.state.collection.normal.hatched,true);
});
