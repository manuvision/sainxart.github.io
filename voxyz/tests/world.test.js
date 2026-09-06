import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { Terrain, BLOCK, CHUNK_SIZE, WORLD_HEIGHT, PAD, WATER_LEVEL, indexOf, seedNumber } from '../terrain.js';
import { meshChunk } from '../mesher.js';
import { World, nextWaterLevel } from '../world.js';

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
  assert.equal(result.water.indices.length,5*6,'isolated water has top and four sides');
  let top=-Infinity;
  for(let i=1;i<result.water.positions.length;i+=3)top=Math.max(top,result.water.positions[i]);
  assert.ok(Math.abs(top-12.86)<1e-5);
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
  assert.equal(nextWaterLevel(0,3,0,block,level),7,'flow descends into the cell under a source');
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
  world.setBlock(200,51,200,BLOCK.WATER);
  for(let i=0;i<5;i++)world.tickWater(.11,{x:0,z:0});
  assert.equal(world.getBlock(201,51,200),BLOCK.AIR);
  assert.ok(world.sleepingWater.size>0);
  for(let i=0;i<10;i++)world.tickWater(.11,{x:200,z:200});
  assert.equal(world.getBlock(201,51,200),BLOCK.WATER);
  world.dispose();material.dispose();
});

test('saving restores edits by seed and reports unavailable or full storage honestly',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const storage=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}});
  const material=new THREE.MeshBasicMaterial();
  let first,restored,other;
  try {
    first=new World(new THREE.Scene(),material,material,'save-persistence');
    first.setBlock(-17,51,22,BLOCK.BRICK);
    assert.equal(first.save(),true);
    restored=new World(new THREE.Scene(),material,material,'save-persistence');
    assert.equal(restored.getBlock(-17,51,22),BLOCK.BRICK);
    other=new World(new THREE.Scene(),material,material,'another-world');
    assert.notEqual(other.getBlock(-17,51,22),BLOCK.BRICK);
    globalThis.localStorage.setItem=()=>{throw new Error('quota exceeded');};
    first.setBlock(-18,51,22,BLOCK.GLASS);
    assert.equal(first.save(),false);
    assert.equal(first.needsSave,true,'failed saves retain pending edits for retry');
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:undefined});
    assert.equal(first.save(),false);
  }finally {
    first?.dispose();restored?.dispose();other?.dispose();material.dispose();
    if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;
  }
});
