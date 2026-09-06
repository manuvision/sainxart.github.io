import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { Terrain, BLOCK, CHUNK_SIZE, WORLD_HEIGHT, PAD, WATER_LEVEL, indexOf, seedNumber } from '../terrain.js';
import { meshChunk } from '../mesher.js';
import { World, nextWaterLevel, waterSpreadMask, waterCellHeight, WATER_FALLING } from '../world.js';

test('same seed reproduces terrain and neighboring chunks agree at their halos',()=>{
  const a=new Terrain('fern-and-fable'),b=new Terrain('fern-and-fable');
  assert.equal(seedNumber('fern-and-fable'),a.seed);
  const left=a.generateChunk(-1,0),right=b.generateChunk(0,0);
  for(let z=0;z<CHUNK_SIZE;z++)for(let y=0;y<WORLD_HEIGHT;y++) {
    assert.equal(left.blocks[indexOf(16,y,z)],right.blocks[indexOf(0,y,z)],`right seam at ${y},${z}`);
    assert.equal(left.blocks[indexOf(15,y,z)],right.blocks[indexOf(-1,y,z)],`left seam at ${y},${z}`);
    assert.equal(left.blocks[indexOf(15,y,z)],a.sampleBlock(-1,y,z),`sample agrees at ${y},${z}`);
  }
  let different=0;
  const other=new Terrain('different-seed');
  for(let x=-80;x<80;x+=9)for(let z=-80;z<80;z+=9)different+=a.heightAt(x,z)!==other.heightAt(x,z);
  assert.ok(different>80,'new seeds change most distant terrain samples');
});

test('opening composition guarantees a dry spawn, pond, and four discoverable biomes',()=>{
  for(const seed of ['VOXYZ',0,1,42,999999]) {
    const t=new Terrain(seed);
    assert.equal(t.heightAt(12,22),15);
    assert.equal(t.biomeAt(12,22),'meadow');
    assert.equal(t.sampleBlock(0,WATER_LEVEL,-8),BLOCK.WATER);
    assert.notEqual(t.sampleBlock(12,16,22),BLOCK.WATER);
    assert.equal(t.biomeAt(300,0),'desert');
    assert.equal(t.biomeAt(-300,0),'jungle');
    assert.equal(t.biomeAt(0,-300),'ice');
  }
});

test('mesher hides shared block faces and maintains exact source surface elevation',()=>{
  const blocks=new Uint8Array(PAD*PAD*WORLD_HEIGHT),levels=new Uint8Array(blocks.length);
  blocks[indexOf(15,20,5)]=BLOCK.STONE;blocks[indexOf(16,20,5)]=BLOCK.STONE;
  blocks[indexOf(3,12,3)]=BLOCK.WATER;levels[indexOf(3,12,3)]=8;
  const result=meshChunk(blocks,levels,0,0);
  assert.equal(result.solid.indices.length,5*6,'chunk halo hides adjacent stone face');
  assert.equal(result.water.indices.length,6*6,'unsupported water has an exposed underside as well as top and sides');
  let top=-Infinity;
  for(let i=1;i<result.water.positions.length;i+=3)top=Math.max(top,result.water.positions[i]);
  assert.ok(Math.abs(top-12.875)<1e-5);
  assert.ok([...result.solid.colors].every(Number.isFinite));
  assert.ok(result.solid.indices.every(i=>i<result.solid.positions.length/3));
});

test('water falls first, spreads a finite seven blocks, and drains when its source disappears',()=>{
  const cells=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
  cells.set(key(0,1,0),8);
  const block=(x,y,z)=>y===0?BLOCK.STONE:cells.has(key(x,y,z))?BLOCK.WATER:BLOCK.AIR;
  const level=(x,y,z)=>cells.get(key(x,y,z))||0;
  const step=()=>{
    const next=new Map();
    for(let x=-9;x<=9;x++)for(let z=-9;z<=9;z++) {
      const l=nextWaterLevel(x,1,z,block,level);if(l)next.set(key(x,1,z),l);
    }
    cells.clear();for(const [k,v]of next)cells.set(k,v);
  };
  for(let i=0;i<12;i++)step();
  assert.equal(level(7,1,0),1);
  assert.equal(level(8,1,0),0);
  cells.delete(key(0,1,0));
  for(let i=0;i<20;i++)step();
  assert.equal(cells.size,0,'no self-sustaining cyclic flowing sources');
  cells.set(key(0,4,0),8);
  assert.equal(nextWaterLevel(0,3,0,block,level),WATER_FALLING,'flow descends as a full-height falling column');
  assert.equal(nextWaterLevel(1,4,0,block,level),0,'unsupported source falls before spreading');
});

test('edits cross chunk halos, survive regeneration, and reject stale worker geometry',()=>{
  const scene=new THREE.Scene(),material=new THREE.MeshBasicMaterial();
  const world=new World(scene,material,material,'boundary-test',{radius:2});
  function load(cx,cz,version=0) {
    const data=world.terrain.generateChunk(cx,cz,world._editsFor(cx,cz));
    world._accept({cx,cz,version,...data,...meshChunk(data.blocks,data.levels,cx,cz,world.seed)});
  }
  load(0,0);load(1,0);
  assert.equal(world.setBlock(15,40,4,BLOCK.BRICK),true);
  assert.equal(world.getBlock(15,40,4),BLOCK.BRICK);
  assert.equal(world.chunks.get('0,0').blocks[indexOf(15,40,4)],BLOCK.BRICK);
  assert.equal(world.chunks.get('1,0').blocks[indexOf(-1,40,4)],BLOCK.BRICK);
  assert.ok(world.dirty.has('0,0')&&world.dirty.has('1,0'));
  const regenerated=world.terrain.generateChunk(0,0,world._editsFor(0,0));
  assert.equal(regenerated.blocks[indexOf(15,40,4)],BLOCK.BRICK);
  const oldGeometry=world.chunks.get('0,0').mesh.geometry;
  load(0,0,0);
  assert.equal(world.chunks.get('0,0').mesh.geometry,oldGeometry,'stale pre-edit worker result was discarded');
  assert.equal(world.setBlock(15,-1,4,BLOCK.AIR),false);
  assert.equal(world.setBlock(15,40,4,99),false);
  world.dispose();material.dispose();
});

test('source placement and removal activate a bounded real world water update',()=>{
  const scene=new THREE.Scene(),material=new THREE.MeshBasicMaterial();
  const world=new World(scene,material,material,'fluid-test',{radius:1});
  for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)world.setBlock(x,30,z,BLOCK.STONE);
  world.setBlock(0,31,0,BLOCK.WATER);
  for(let i=0;i<20;i++)world.tickWater(.11,{x:0,z:0});
  assert.equal(world.getBlock(1,31,0),BLOCK.WATER);
  assert.equal(world.getWaterLevel(1,31,0),7);
  world.setBlock(0,31,0,BLOCK.AIR);
  for(let i=0;i<80;i++)world.tickWater(.11,{x:0,z:0});
  assert.equal(world.getBlock(0,31,0),BLOCK.AIR);
  assert.equal(world.getBlock(1,31,0),BLOCK.AIR);
  world.dispose();material.dispose();
});

test('distant water sleeps without losing its update and resumes when visited',()=>{
  const scene=new THREE.Scene(),material=new THREE.MeshBasicMaterial();
  const world=new World(scene,material,material,'water-wake',{radius:1});
  world.setBlock(200,50,200,BLOCK.STONE);
  world.setBlock(201,50,200,BLOCK.STONE);
  world.setBlock(199,51,200,BLOCK.STONE);
  world.setBlock(200,51,199,BLOCK.STONE);
  world.setBlock(200,51,201,BLOCK.STONE);
  world.setBlock(200,51,200,BLOCK.WATER);
  for(let i=0;i<5;i++)world.tickWater(.11,{x:0,z:0});
  assert.equal(world.getBlock(201,51,200),BLOCK.AIR);
  assert.ok(world.sleepingWater.size>0);
  for(let i=0;i<20;i++)world.tickWater(.25,{x:200,z:200});
  assert.equal(world.getBlock(201,51,200),BLOCK.WATER);
  world.dispose();material.dispose();
});

test('edits exist only in one World session; stale stored edits are ignored and storage is untouched',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),calls=[];
  const stale=JSON.stringify({edits:[[-17,51,22,BLOCK.BRICK,0]]});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:key=>{calls.push(['get',key]);return stale;},
    setItem:(...args)=>calls.push(['set',...args]),
    removeItem:key=>calls.push(['remove',key]),
  }});
  const material=new THREE.MeshBasicMaterial();
  let first,other;
  try {
    first=new World(new THREE.Scene(),material,material,'session-edits');
    assert.notEqual(first.getBlock(-17,51,22),BLOCK.BRICK,'a legacy save cannot leak into the new session');
    first.setBlock(-17,51,22,BLOCK.BRICK);
    assert.equal(first.getBlock(-17,51,22),BLOCK.BRICK);
    const regenerated=first.terrain.generateChunk(-2,1,first._editsFor(-2,1));
    assert.equal(regenerated.blocks[indexOf(15,51,6)],BLOCK.BRICK,'chunk regeneration retains edits in this session');
    assert.equal(first.save(),false,'compatibility method explicitly reports no disk save');
    other=new World(new THREE.Scene(),material,material,'session-edits');
    assert.notEqual(other.getBlock(-17,51,22),BLOCK.BRICK,'a fresh World with the same seed is pristine');
    first.dispose();other.dispose();
    assert.deepEqual(calls,[],'no localStorage reads, writes or deletions');
  }finally {
    material.dispose();
    if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;
  }
});

function fluidFixture(solid=(x,y)=>y<=0) {
  const cells=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
  const block=(x,y,z)=>solid(x,y,z)?BLOCK.STONE:cells.has(key(x,y,z))?BLOCK.WATER:BLOCK.AIR;
  const level=(x,y,z)=>cells.get(key(x,y,z))||0;
  const put=(x,y,z,l)=>cells.set(key(x,y,z),l);
  const step=()=>{
    const candidates=new Map(),cache=new Map();
    for(const [k]of cells) {
      const [x,y,z]=k.split(',').map(Number);
      for(const [dx,dy,dz]of [[0,0,0],[1,0,0],[-1,0,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
        const p=[x+dx,y+dy,z+dz];
        if(p[1]>0)candidates.set(key(...p),p);
      }
    }
    const next=new Map();
    for(const [k,p]of candidates){const l=nextWaterLevel(...p,block,level,cache);if(l)next.set(k,l);}
    cells.clear();for(const [k,v]of next)cells.set(k,v);
  };
  return {cells,key,block,level,put,step};
}

test('water height metadata distinguishes shallow, source, stacked and falling water',()=>{
  assert.equal(waterCellHeight(0),0);
  assert.equal(waterCellHeight(1),.125);
  assert.equal(waterCellHeight(4),.5);
  assert.equal(waterCellHeight(7),.875);
  assert.equal(waterCellHeight(8),.875);
  assert.equal(waterCellHeight(9),1);
  assert.equal(waterCellHeight(1,true),1);
});

test('downhill routing prefers the nearest reachable drop, follows ties and routes around walls',()=>{
  const f=fluidFixture((x,y,z)=>y<0||(y===0&&!(z===0&&(x===2||x===-4))));
  f.put(0,1,0,8);
  assert.equal(waterSpreadMask(0,1,0,f.block,f.level),1,'east drop is nearer than west, north or south');
  assert.equal(nextWaterLevel(1,1,0,f.block,f.level),7);
  assert.equal(nextWaterLevel(-1,1,0,f.block,f.level),0);
  assert.equal(nextWaterLevel(0,1,1,f.block,f.level),0);
  const tied=fluidFixture((x,y,z)=>y<0||(y===0&&!(z===0&&Math.abs(x)===2)));
  tied.put(0,1,0,8);
  assert.equal(waterSpreadMask(0,1,0,tied.block,tied.level),3,'equal opposite downhill paths both receive flow');
  const wall=fluidFixture((x,y,z)=>y<0||(y===0&&!(x===2&&z===0))||(y===1&&x===1&&z===0));
  wall.put(0,1,0,8);
  assert.equal(waterSpreadMask(0,1,0,wall.block,wall.level),12,'north and south routes bend around the obstructed direct path');
  assert.equal(nextWaterLevel(0,2,0,wall.block,wall.level),0,'no upward propagation');
});

test('falling columns never grow sideways in midair, restart finite flow on landing and drain completely',()=>{
  const f=fluidFixture();
  f.put(0,4,0,8);
  for(let i=0;i<15;i++)f.step();
  for(const y of [2,3]) {
    assert.equal(f.level(0,y,0),9);
    assert.equal(f.level(1,y,0),0,'falling water is not lateral support for the cell above');
  }
  assert.equal(f.level(0,1,0),9);
  assert.equal(f.level(7,1,0),1,'landing resets seven horizontal flow steps');
  assert.equal(f.level(8,1,0),0);
  assert.equal(f.level(1,4,0),0,'suspended source does not spread sideways over its falling column');
  assert.equal(f.level(0,5,0),0);
  f.cells.delete(f.key(0,4,0));
  for(let i=0;i<35;i++)f.step();
  assert.equal(f.cells.size,0,'the entire source-free waterfall and its spread recede');
});

test('horizontal water crosses a ledge once and falls instead of constructing an air bridge',()=>{
  const f=fluidFixture((x,y,z)=>y<=0||(y===4&&x<=0)||(y===5&&z!==0));
  f.put(0,5,0,8);
  for(let i=0;i<15;i++)f.step();
  assert.equal(f.level(1,5,0),7);
  assert.equal(f.level(2,5,0),0,'the unsupported lip cannot feed the next horizontal air cell');
  assert.equal(f.level(1,4,0),9);
  assert.equal(f.level(1,1,0),9);
});

test('merging streams never become new sources or leave a self-sustaining pool',()=>{
  const f=fluidFixture();f.put(-1,1,0,8);f.put(1,1,0,8);
  for(let i=0;i<10;i++)f.step();
  assert.equal(f.level(0,1,0),7);
  assert.equal([...f.cells.values()].filter(v=>v===8).length,2);
  f.cells.delete(f.key(-1,1,0));f.cells.delete(f.key(1,1,0));
  for(let i=0;i<25;i++)f.step();
  assert.equal(f.cells.size,0);
});

test('water geometry slopes between shared cell heights and supplies block categories per vertex',()=>{
  const blocks=new Uint8Array(PAD*PAD*WORLD_HEIGHT),levels=new Uint8Array(blocks.length);
  for(const [x,l]of [[1,8],[2,4],[3,1]]){blocks[indexOf(x,20,5)]=BLOCK.WATER;levels[indexOf(x,20,5)]=l;}
  blocks[indexOf(7,20,5)]=BLOCK.WATER;levels[indexOf(7,20,5)]=9;
  blocks[indexOf(10,20,5)]=BLOCK.WOOD;
  const {water,solid}=meshChunk(blocks,levels,0,0);
  const topAt=x=>{
    const values=[];
    for(let i=0;i<water.positions.length/3;i++)if(water.normals[i*3+1]>.5&&water.positions[i*3]===x&&water.positions[i*3+2]===5)values.push(water.positions[i*3+1]);
    return values;
  };
  assert.ok(topAt(2).every(y=>Math.abs(y-20.6875)<1e-6));
  assert.ok(topAt(3).every(y=>Math.abs(y-20.3125)<1e-6));
  assert.ok(topAt(4).every(y=>Math.abs(y-20.125)<1e-6));
  assert.deepEqual([...new Set(topAt(7))],[21],'falling cells render full height');
  assert.ok(water.normals.some((n,i)=>i%3===0&&n>0),'sloped tops provide sloped normals');
  assert.equal(water.blockTypes.length,water.positions.length/3);
  assert.equal(solid.blockTypes.length,solid.positions.length/3);
  assert.ok(water.blockTypes.every(id=>id===BLOCK.WATER));
  assert.ok(solid.blockTypes.every(id=>id===BLOCK.WOOD));
});

test('flowing water corner heights match across chunk boundaries',()=>{
  const create=cx=>{
    const blocks=new Uint8Array(PAD*PAD*WORLD_HEIGHT),levels=new Uint8Array(blocks.length);
    for(const [wx,l]of [[15,4],[16,2]]){const x=wx-cx*16;blocks[indexOf(x,20,5)]=BLOCK.WATER;levels[indexOf(x,20,5)]=l;}
    return meshChunk(blocks,levels,cx,0).water;
  };
  const seam=(mesh,cx)=>{
    const ys=[];
    for(let i=0;i<mesh.positions.length/3;i++)if(mesh.normals[i*3+1]>.5&&mesh.positions[i*3]+cx*16===16)ys.push(mesh.positions[i*3+1]);
    return [...new Set(ys)];
  };
  assert.deepEqual(seam(create(0),0),[20.375]);
  assert.deepEqual(seam(create(1),1),[20.375]);
});

test('digging a nearby drop reroutes an already settled World stream and blocking the feed drains it',()=>{
  const material=new THREE.MeshBasicMaterial(),world=new World(new THREE.Scene(),material,material,'reroute',{radius:1});
  world.terrain.sampleBlock=(x,y)=>y<=10?BLOCK.STONE:BLOCK.AIR;
  const settle=()=>{
    for(let i=0;i<250;i++) {
      world.tickWater(.25,{x:0,z:0});
      if(world.waterCursor===world.waterQueue.length)return;
    }
    assert.fail('local fluid work did not settle within its bounded update budget');
  };
  world.setBlock(0,11,0,BLOCK.WATER);settle();
  assert.equal(world.getWaterLevel(-1,11,0),7);
  assert.equal(world.getWaterLevel(7,11,0),1);
  assert.equal(world.getBlock(8,11,0),BLOCK.AIR);
  world.setBlock(2,10,0,BLOCK.AIR);settle();
  assert.equal(world.getWaterLevel(1,11,0),7);
  assert.equal(world.getBlock(-1,11,0),BLOCK.AIR,'new shorter downhill route withdraws the old westward flow');
  assert.equal(world.getWaterLevel(2,10,0),9);
  assert.equal(world.getBlock(3,11,0),BLOCK.AIR,'water does not continue across the unsupported lip');
  for(const [x,z]of [[1,0],[2,1],[2,-1],[3,0]])world.setBlock(x,11,z,BLOCK.STONE);settle();
  assert.equal(world.getBlock(2,10,0),BLOCK.AIR,'blocking the feed drains the old falling cell');
  world.dispose();material.dispose();
});

test('a falling tower merges into a pond without making a sheet above it, and source removal clears a chunk seam',()=>{
  const material=new THREE.MeshBasicMaterial(),world=new World(new THREE.Scene(),material,material,'pond-waterfall',{radius:2});
  const base=(x,y)=>y<=8?BLOCK.STONE:y<=12?BLOCK.WATER:BLOCK.AIR;
  world.terrain.sampleBlock=base;
  const load=(cx,cz)=>{
    const blocks=new Uint8Array(PAD*PAD*WORLD_HEIGHT),levels=new Uint8Array(blocks.length);
    for(let y=0;y<WORLD_HEIGHT;y++)for(let z=-1;z<=16;z++)for(let x=-1;x<=16;x++){
      const i=indexOf(x,y,z),id=base(cx*16+x,y,cz*16+z);blocks[i]=id;if(id===BLOCK.WATER)levels[i]=8;
    }
    world._accept({cx,cz,version:0,blocks,levels,...meshChunk(blocks,levels,cx,cz)});
  };
  load(0,0);load(1,0);
  world.setBlock(15,18,8,BLOCK.WATER);
  for(let i=0;i<60;i++)world.tickWater(.25,{x:15,z:8});
  for(let y=13;y<18;y++)assert.equal(world.getWaterLevel(15,y,8),9);
  assert.equal(world.getBlock(16,13,8),BLOCK.AIR,'falling water merges into the pond instead of spreading atop source water');
  assert.equal(world.getBlock(14,13,8),BLOCK.AIR);
  assert.equal(world.getWaterLevel(15,12,8),8,'pond sources stay intact');
  assert.equal(world.chunks.get('1,0').levels[indexOf(-1,15,8)],9,'falling metadata reaches adjacent chunk halos');
  world.setBlock(15,18,8,BLOCK.AIR);
  for(let i=0;i<90;i++)world.tickWater(.25,{x:15,z:8});
  for(let y=13;y<=18;y++)assert.equal(world.getBlock(15,y,8),BLOCK.AIR);
  assert.equal(world.chunks.get('1,0').blocks[indexOf(-1,15,8)],BLOCK.AIR,'source deletion clears neighboring mesh data');
  assert.equal(world.getWaterLevel(15,12,8),8);
  world.dispose();material.dispose();
});

test('long-running flat water settles, stays finite and releases transient cells after source removal',()=>{
  const material=new THREE.MeshBasicMaterial(),world=new World(new THREE.Scene(),material,material,'long-water',{radius:1});
  world.terrain.sampleBlock=(x,y)=>y<=29?BLOCK.STONE:BLOCK.AIR;
  world.setBlock(0,30,0,BLOCK.WATER);
  for(let i=0;i<500;i++)world.tickWater(.25,{x:0,z:0});
  assert.equal(world.fluidChanges.size,112,'one source has exactly the seven-step diamond on a flat plane');
  assert.equal(world.waterQueue.length-world.waterCursor,0,'a settled stream performs no recurring cell relaxation');
  world.setBlock(0,30,0,BLOCK.AIR);
  for(let i=0;i<300;i++)world.tickWater(.25,{x:0,z:0});
  assert.equal(world.fluidChanges.size,0,'drained cells do not leave an ever-growing transient AIR map');
  assert.equal(world.waterQueue.length-world.waterCursor,0);
  assert.equal(world.sleepingWater.size,0);
  world.dispose();material.dispose();
});
