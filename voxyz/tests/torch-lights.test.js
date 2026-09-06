import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {TorchLights} from '../torch-lights.js';

function fixture(){
  const scene=new THREE.Scene(),rig=new TorchLights(scene,{flameGeometry:new THREE.BoxGeometry(),flameMaterial:new THREE.MeshBasicMaterial(),glowMaterial:new THREE.SpriteMaterial()});
  const lights=()=>{const list=[];scene.traverseVisible(o=>{if(o.isPointLight)list.push(o);});return list;};
  return {scene,rig,lights};
}

test('placing, removing and resetting torches preserve the renderer light identities and count',()=>{
  const {rig,lights}=fixture(),original=lights();
  assert.equal(original.length,6);assert.ok(original.every(l=>l.intensity===0));
  for(let i=0;i<14;i++){rig.add(i,4,3);assert.deepEqual(lights(),original);}
  assert.equal(rig.active.length,6);assert.equal(rig.active[0].key,'8,4,3');
  rig.remove(10,4,3);assert.equal(rig.active.length,5);assert.deepEqual(lights(),original);
  rig.clear();assert.equal(rig.active.length,0);assert.deepEqual(lights(),original);
  assert.ok(original.every(l=>l.intensity===0));assert.ok(rig.pool.every(s=>!s.visuals.visible));
});

test('duplicate placements reuse a slot and flicker only affects active lamps',()=>{
  const {rig}=fixture();rig.add(2,5,8);rig.add(2,5,8);
  assert.equal(rig.active.length,1);rig.update(2);
  assert.ok(rig.active[0].light.intensity>4.4&&rig.active[0].light.intensity<5.2);
  assert.ok(rig.active[0].light.position.distanceTo(new THREE.Vector3(2.5,5.94,8.5))<1e-10);
  assert.ok(rig.pool.filter(s=>s.key===null).every(s=>s.light.intensity===0&&!s.visuals.visible));
});

test('flame and glow shaders finish warming before the rig becomes ready',async()=>{
  const {rig,scene}=fixture(),camera=new THREE.PerspectiveCamera();let release;
  const linearTarget={name:'linear HDR target'},previous={name:'original target'};let current=previous;
  const warming=rig.warm({getRenderTarget(){return current;},setRenderTarget(value){current=value;},compileAsync(object,view,target){
    assert.equal(object,rig.pool[0].visuals);assert.equal(view,camera);assert.equal(target,scene);assert.equal(current,linearTarget);
    return new Promise(resolve=>{release=resolve;});
  }},camera,linearTarget);
  assert.equal(current,previous,'restore the renderer while asynchronous compilation completes');
  assert.equal(rig.ready,false);release();await warming;assert.equal(rig.ready,true);
});
