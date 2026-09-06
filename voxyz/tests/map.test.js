import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscoveryGrid, ExplorationMap, MAP_CELL_SIZE, MAP_REVEAL_RADIUS } from '../exploration-map.js';

test('discovery stays inside the visit radius and includes all quadrants',()=>{
  const state=new DiscoveryGrid(),added=state.reveal(0,0,55);
  assert.ok(added.length>450);assert.equal(added.length,state.count);
  for(const [x,z] of added){
    assert.ok(state.has(x,z));
    for(const dx of [0,1])for(const dz of [0,1])assert.ok(Math.hypot((x+dx)*MAP_CELL_SIZE,(z+dz)*MAP_CELL_SIZE)<=55);
  }
  assert.ok(state.has(-1,-1)&&state.has(0,0)&&state.has(-1,0)&&state.has(0,-1));
  assert.equal(state.has(15,0),false);
});

test('overlapping visits are stable and teleporting does not reveal a connecting trail',()=>{
  const state=new DiscoveryGrid();state.reveal(-20,-20);
  const original=state.count;assert.deepEqual(state.reveal(-20,-20),[]);assert.equal(state.count,original);
  state.reveal(240,-20);assert.ok(state.has(60,-5));assert.equal(state.has(30,-5),false);
  const previous=state.count;state.reveal(243,-20);assert.ok(state.count>previous);
});

test('discovery roundtrips negative and positive tile coordinates without losing cells',()=>{
  const state=new DiscoveryGrid();state.reveal(-260,-180);state.reveal(360,90);
  const encoded=JSON.stringify(state.serialize()),restored=DiscoveryGrid.deserialize(JSON.parse(encoded));
  assert.equal(restored.count,state.count);assert.deepEqual(restored.serialize(),state.serialize());
  assert.deepEqual(restored.reveal(-260,-180),[]);assert.deepEqual(restored.reveal(360,90),[]);
  assert.ok(encoded.length<state.count*3,'bitsets are substantially smaller than coordinate lists');
});

test('invalid saved data and duplicate tiles cannot create phantom discovery',()=>{
  assert.equal(DiscoveryGrid.deserialize(null).count,0);
  assert.equal(DiscoveryGrid.deserialize({version:2,cellSize:4,tiles:[]}).count,0);
  const value={version:1,cellSize:4,tiles:[[0,0,'01'+'00'.repeat(31)],[0,0,'ff'.repeat(32)],[NaN,0,'ff'.repeat(32)],[1,0,'invalid']]};
  const restored=DiscoveryGrid.deserialize(value);assert.equal(restored.count,1);assert.ok(restored.has(0,0));assert.equal(restored.has(1,0),false);
});

test('exploration persists independently for each seed',()=>{
  const previous=globalThis.localStorage,storage=new Map();
  globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  try{
    const first=new ExplorationMap({seed:123});first.update({x:140,z:-120},.5,.2);first.dispose();
    const restored=new ExplorationMap({seed:123}),different=new ExplorationMap({seed:124});
    assert.ok(restored.discovery.has(35,-30));assert.equal(different.discovery.has(35,-30),false);
    restored.dispose();different.dispose();
  }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});

function canvas(width=168,height=168){
  const gradient={addColorStop(){}};
  const context=new Proxy({createRadialGradient:()=>gradient},{get(target,key){return key in target?target[key]:(()=>{});},set(target,key,value){target[key]=value;return true;}});
  const result={width:0,height:0,ownerDocument:{createElement:()=>canvas()},getContext:()=>context,getBoundingClientRect:()=>({width,height}),setAttribute(){}};
  return result;
}

test('terrain sampling is bounded, cached, and restricted to discovered cells',()=>{
  const calls=[],world={seed:777,terrain:{column(x,z){calls.push([x,z]);return {height:17,biome:'meadow',wet:false};}}};
  const map=new ExplorationMap(world,{miniCanvas:canvas()});
  let frames=0;
  do{
    const before=calls.length;map.update({x:0,z:0},0,1/60);
    assert.ok(calls.length-before<=192,'no more than 96 terrain cells plus their known shading neighbors per update');
    assert.ok(++frames<200,'the expanded survey finishes sampling within a bounded number of updates');
  }while(map.pending.length);
  assert.ok(calls.length>=map.discovery.count);assert.ok(map.discovery.count>2800);
  for(const [x,z] of calls)assert.ok(map.discovery.has(Math.floor(x/MAP_CELL_SIZE),Math.floor(z/MAP_CELL_SIZE)),'undiscovered terrain must never be sampled');
  const cached=calls.length;
  for(let frame=0;frame<15;frame++)map.update({x:0,z:0},.2,1/60);
  assert.equal(calls.length,cached);map.dispose();
});

test('the game surveys 128 blocks while preserving unexplored space beyond that radius',()=>{
  const map=new ExplorationMap({seed:991});map.update({x:0,z:0},0,1/60);
  assert.equal(MAP_REVEAL_RADIUS,128);
  assert.ok(map.discovery.has(30,0),'terrain around x=122 is surveyed beyond the desktop fog horizon');
  assert.ok(map.discovery.has(0,-31),'the expanded survey reaches all compass directions');
  assert.equal(map.discovery.has(32,0),false,'terrain outside 128 blocks stays undiscovered');
  assert.equal(map.discovery.has(25,25),false,'a square bounding box must not reveal distant corners');
  map.dispose();
});

test('full-map edge tiles survive cache pruning in wide and tall layouts, then release on close',()=>{
  for(const [width,height,x,z,key] of [[700,220,1000,0,'15,0'],[220,700,0,1000,'0,15']]){
    const full=canvas(width,height),dialog={open:true};full.closest=()=>dialog;
    const world={seed:width,terrain:{column:()=>({height:17,biome:'meadow',wet:false})}};
    const map=new ExplorationMap(world,{fullCanvas:full});
    map.discovery.reveal(x,z);map.update({x:0,z:0},0,1/60);map.drawFull();
    const edgeTile=map.tiles.get(key);assert.ok(edgeTile,'previously explored terrain at the viewport edge is queued');
    for(let second=0;second<11;second++)map.update({x:0,z:0},0,1);
    assert.equal(map.tiles.get(key),edgeTile,'a visible tile must retain its canvas across a prune interval');
    dialog.open=false;
    for(let second=0;second<11;second++)map.update({x:0,z:0},0,1);
    assert.equal(map.tiles.has(key),false,'closing the large map restores the normal cache bound');
    map.dispose();
  }
});

test('discarded map jobs remain subject to the per-update work budget',()=>{
  const map=new ExplorationMap({seed:992});
  map.pending=Array.from({length:10000},()=>({tile:{key:'evicted'},index:0}));
  const sampled=map._processSamples(96);
  assert.equal(sampled,0);assert.ok(map.pendingCursor>0&&map.pendingCursor<=96);
  assert.ok(map.pending.length-map.pendingCursor>=9904,'a stale queue must not drain in a single frame');
  map.dispose();
});
