import test from 'node:test';
import assert from 'node:assert/strict';
import {TinyGarden,freshState,restoreState} from '../game.js';
import {EGGS,isEggUnlocked,rollEggStock} from '../eggs.js';
const storage=new Map(),ctx=new Proxy({}, {get:(t,k)=>t[k]||(()=>{}),set:(t,k,v)=>(t[k]=v,true)});
globalThis.document={createElement:()=>({setAttribute(){},getContext:()=>ctx})};
globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
function garden(){storage.clear();const g=new TinyGarden();g.state.hatched=true;g.state.rings=99999;return g;}
function advance(g,seconds){for(let i=0;i<Math.ceil(seconds/.1);i++)g.update(.1);}

test('rings alone cannot unlock or buy gated eggs, including a stale locked shop offer',()=>{
 const g=garden();assert.deepEqual(g.state.eggUnlocks,['normal','silver']);
 for(const egg of EGGS.slice(2)){g.state.eggStock=egg.id;assert.equal(g.buyEgg(),false,egg.id);assert.equal(g.state.rings,99999);assert.equal(g.state.collection[egg.id],undefined);}
 for(const random of [0,.1,.5,.999])assert.equal(rollEggStock(g.state.collection,g.state.eggWeights,()=>random,g.state.eggUnlocks),'silver');
 const old=g.exportSave();old.eggStock='onyx';assert.equal(restoreState(old).eggStock,'silver');
});

test('a real high scoring Memory clear unlocks its egg and puts it in the shop',()=>{
 const g=garden();g.startMemory();const m=g.memory;m.preview=0;m.shuffles=0;m.cards=Array.from({length:30},(_,i)=>i<14?Math.floor(i/2):null);
 for(let i=0;i<14;i++)g.flipCard(i);
 assert.equal(g.mode,'result');assert.equal(g.state.bestMemory,84);assert.ok(g.state.eggUnlocks.includes('ruby'));assert.equal(g.state.eggStock,'ruby');assert.equal(g.state.eggUnlocks.includes('sapphire'),false);
 const reload=new TinyGarden();assert.ok(reload.state.eggUnlocks.includes('ruby'));assert.equal(reload.state.bestMemory,84);
});

test('only visible unpaused gameplay time advances time-based egg milestones',()=>{
 const g=garden();g.state.played=599.5;g.enter('menu');advance(g,3);assert.equal(g.state.played,599.5);assert.equal(isEggUnlocked('gold',g.state),false);
 g.enter('garden');advance(g,1.1);assert.ok(g.state.eggUnlocks.includes('gold'));assert.equal(g.state.eggStock,'gold');
 g.startMemory();const before=g.state.played;advance(g,1);assert.ok(g.state.played>before+.9);g.input('start');const paused=g.state.played;advance(g,2);assert.equal(g.state.played,paused);
 const old=g.exportSave();old.lastSaved-=86400000;assert.equal(restoreState(old).played,old.played,'Time away grants no playtime');
});

test('rare combination gates require both game records and time, not just one strong stat',()=>{
 const g=garden();g.state.played=7200;g.state.bestMemory=90;g.state.bestJanken=29;assert.equal(isEggUnlocked('onyx',g.state),false);
 g.state.bestJanken=30;g.state.played=7199;assert.equal(isEggUnlocked('onyx',g.state),false);
 g.state.played=7200;g.state.bestMemory=89;assert.equal(isEggUnlocked('onyx',g.state),false);
 g.state.bestMemory=90;assert.equal(isEggUnlocked('onyx',g.state),true);g.save();const restored=new TinyGarden();assert.ok(restored.state.eggUnlocks.includes('onyx'));
});

test('care milestones include a saved friend’s skills and feeding the current Chao',()=>{
 const g=garden();g.state.collection.silver={...g.state.collection.normal,color:'silver',hatched:true,stats:{swim:{level:3,xp:0}}};g.state.totalFeeds=19;g.state.inventory.orange=1;
 assert.equal(isEggUnlocked('emerald',g.state),false);g.feed('orange');assert.ok(g.state.eggUnlocks.includes('emerald'));assert.equal(g.state.eggStock,'emerald');
});

test('already collected eggs and saved unlocks survive migration, switching and backup restore',()=>{
 const old=freshState();delete old.eggUnlocks;old.collection.onyx={...old.collection.normal,color:'onyx',hatched:true,name:'INK'};
 const g=garden();g.importSave(old);assert.ok(g.state.eggUnlocks.includes('onyx'));g.visitFriend(EGGS.findIndex(e=>e.id==='onyx'));assert.equal(g.state.name,'INK');
 const backup=g.exportSave();backup.eggUnlocks.push('not-an-egg');g.importSave(backup);assert.ok(g.state.eggUnlocks.includes('onyx'));assert.equal(g.state.eggUnlocks.includes('not-an-egg'),false);
});
