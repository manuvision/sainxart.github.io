import test from 'node:test';
import assert from 'node:assert/strict';
import {voxelRaycast,overlapsPlayer} from '../interaction.js';
test('selection traverses negative cells and returns adjacent placement cell',()=>{const world={getBlock:(x,y,z)=>x===-3&&y===2&&z===0?3:0};const hit=voxelRaycast(world,{x:.5,y:2.5,z:.5},{x:-1,y:0,z:0});assert.equal(hit.x,-3);assert.deepEqual(hit.previous,[-2,2,0]);assert.deepEqual(hit.normal,[1,0,0]);});
test('reach is bounded and water can be selected explicitly',()=>{const world={getBlock:(x)=>x===2?7:x===8?3:0};assert.equal(voxelRaycast(world,{x:0,y:0,z:0},{x:1,y:0,z:0},7),null);assert.equal(voxelRaycast(world,{x:0,y:0,z:0},{x:1,y:0,z:0},7,true).id,7);});
test('placement cannot intersect player head or feet',()=>{const p={x:.5,y:1,z:.5};assert.ok(overlapsPlayer(0,1,0,p));assert.ok(overlapsPlayer(0,2,0,p));assert.ok(!overlapsPlayer(0,0,0,p));assert.ok(!overlapsPlayer(1,1,0,p));});
