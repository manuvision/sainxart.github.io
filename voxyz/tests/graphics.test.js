import test from 'node:test';
import assert from 'node:assert/strict';
import { WaterColumnMask } from '../graphics.js';
import { BLOCK, PAD, WORLD_HEIGHT, indexOf } from '../terrain.js';

const position={x:8,z:8};
function worldWithChunk() {
  const chunk={blocks:new Uint8Array(PAD*PAD*WORLD_HEIGHT),levels:new Uint8Array(PAD*PAD*WORLD_HEIGHT)};
  return {chunks:new Map([['0,0',chunk]]),revisions:new Map(),getBlock(){throw new Error('Mask must not trigger procedural sampling');}};
}
function put(world,x,y,z,id=BLOCK.WATER,level=8) {
  const chunk=world.chunks.get('0,0'),i=indexOf(x,y,z);chunk.blocks[i]=id;chunk.levels[i]=level;
  world.revisions.set('0,0',(world.revisions.get('0,0')||0)+1);
}
function settle(mask,world,at=position) {
  let frames=0;
  do {assert.ok(mask.update(world,at)<=mask.budget);assert.ok(++frames<1000);}while(mask.count);
}
function read(mask,x,z) {
  const i=((z-mask.origin.y)*mask.size+x-mask.origin.x)*4;
  return Array.from(mask.data.slice(i,i+3));
}

test('caustic columns use exposed source and shallow flow surfaces at their actual heights',()=>{
  const world=worldWithChunk(),mask=new WaterColumnMask(16,5);
  for(let y=4;y<=7;y++)put(world,8,y,8);
  put(world,9,16,8,BLOCK.WATER,1);
  settle(mask,world);
  const source=read(mask,8,8),flow=read(mask,9,8);
  assert.ok(Math.abs(source[0]-7.86)<1e-5);assert.equal(source[1],4);assert.equal(source[2],1);
  assert.ok(Math.abs(flow[0]-16.2475)<1e-5);assert.equal(flow[1],16);assert.equal(flow[2],1);
  assert.deepEqual(read(mask,7,8),[0,0,0]);
});

test('sealed water and dry space below a separate water column do not become wet',()=>{
  const world=worldWithChunk(),mask=new WaterColumnMask(16,64);
  put(world,8,12,8);put(world,8,13,8,BLOCK.STONE);
  put(world,9,12,8);put(world,9,11,8);put(world,9,9,8);
  settle(mask,world);
  assert.deepEqual(read(mask,8,8),[0,0,0]);
  const exposed=read(mask,9,8);assert.equal(exposed[1],11);
  assert.ok(9<exposed[1],'the lower disconnected pool is outside this surface’s wet range');
});

test('water edits refresh cached columns and removing water clears their mask',()=>{
  const world=worldWithChunk(),mask=new WaterColumnMask(16,32);
  put(world,8,12,8);settle(mask,world);
  put(world,8,12,8,BLOCK.WATER,2);settle(mask,world);
  assert.ok(Math.abs(read(mask,8,8)[0]-12.335)<1e-5);
  put(world,8,12,8,BLOCK.AIR,0);settle(mask,world);
  assert.deepEqual(read(mask,8,8),[0,0,0]);
});

test('moving the local window preserves overlapping water data while new columns stream in',()=>{
  const world=worldWithChunk(),mask=new WaterColumnMask(16,1);
  put(world,12,12,8);settle(mask,world);
  const previous=read(mask,12,8);
  mask.update(world,{x:16,z:8});
  assert.deepEqual(read(mask,12,8),previous);
  assert.ok(mask.count>0,'rescans stay spread over bounded frames');
  settle(mask,world,{x:16,z:8});
  assert.deepEqual(read(mask,12,8),previous);
});

test('chunk unload and world replacement clear stale caustics without terrain generation',()=>{
  const world=worldWithChunk(),mask=new WaterColumnMask(16,32);
  put(world,8,12,8);settle(mask,world);
  world.chunks.clear();settle(mask,world);
  assert.deepEqual(read(mask,8,8),[0,0,0]);
  const another=worldWithChunk();put(another,8,18,8);settle(mask,another);
  assert.ok(Math.abs(read(mask,8,8)[0]-18.86)<1e-5);
  settle(mask,worldWithChunk());assert.deepEqual(read(mask,8,8),[0,0,0]);
});
