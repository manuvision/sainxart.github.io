import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {HeldItem,ITEM_IDS} from '../held-item.js';

function fixture() {
  const world=new THREE.Scene(),held=new HeldItem(world),camera=new THREE.PerspectiveCamera(66,16/9,.08,260);
  camera.position.set(12,16,-8);camera.rotation.set(.2,-.8,0,'YXZ');camera.updateMatrixWorld();
  const update=(options={})=>held.update(1/60,5,{camera,daylight:1,visible:true,...options});
  return {world,held,camera,update};
}
function visibleLights(scene) {const result=[];scene.traverseVisible(o=>{if(o.isLight)result.push(o);});return result;}

test('held models stay outside the world and reuse a permanent light and prebuilt resources',()=>{
  const {world,held,update}=fixture();
  try {
    assert.deepEqual(ITEM_IDS,[1,3,5,7,10]);
    assert.equal(world.children.length,1);assert.equal(world.children[0],held.worldLight);
    assert.ok(held.worldLight.isPointLight);assert.equal(held.worldLight.intensity,0);
    const worldLights=visibleLights(world),handLights=visibleLights(held.scene);
    const geometries=[...held.geometries],materials=[...held.materials],textures=[...held.textures];
    for(let i=0;i<25;i++) {
      const id=ITEM_IDS[i%ITEM_IDS.length];assert.equal(held.select(id),true);update();
      assert.equal(held.diagnostics.selected,id);
      assert.equal([...held.models.values()].filter(group=>group.visible).length,1);
      assert.ok(held.diagnostics.meshes>=5&&held.diagnostics.meshes<20,'one active prop plus hand stays within the draw budget');
      assert.deepEqual(visibleLights(world),worldLights);assert.deepEqual(visibleLights(held.scene),handLights);
      assert.deepEqual([...held.geometries],geometries);assert.deepEqual([...held.materials],materials);assert.deepEqual([...held.textures],textures);
    }
    const selected=held.selected;assert.equal(held.select(999),false);assert.equal(held.selected,selected);
  } finally {held.dispose();}
});

test('the view copies world projection while sunlight and torch illumination follow camera orientation',()=>{
  const {held,camera,update}=fixture();
  try {
    const sunDirection=new THREE.Vector3(-.55,.48,.42).normalize();held.select(10);update({sunDirection});
    assert.deepEqual(held.camera.projectionMatrix.elements,camera.projectionMatrix.elements);
    assert.deepEqual(held.camera.projectionMatrixInverse.elements,camera.projectionMatrixInverse.elements);
    assert.deepEqual(held.camera.position.toArray(),[0,0,0]);assert.deepEqual(held.camera.quaternion.toArray(),[0,0,0,1]);
    const direction=held.sun.position.clone().normalize().applyQuaternion(camera.quaternion);
    assert.ok(direction.distanceTo(sunDirection)<1e-9,'directional light is expressed in view coordinates');
    const offset=held.worldLight.position.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
    assert.ok(offset.distanceTo(new THREE.Vector3(.16,-.12,-.30))<1e-9);
    assert.ok(held.worldLight.intensity>4&&held.handLight.intensity>0);
    assert.ok(held.handLight.position.length()<2,'hand illumination belongs to the small view scene');
  } finally {held.dispose();}
});

test('leaving play or selecting another block switches held illumination off without removing lights',()=>{
  const {held,world,update}=fixture();
  try {
    held.select(10);update();assert.ok(held.worldLight.intensity>0);
    update({visible:false});assert.equal(held.root.visible,false);assert.equal(held.worldLight.intensity,0);assert.equal(held.handLight.intensity,0);
    update({visible:true,underwater:true});assert.ok(held.worldLight.intensity>0&&held.worldLight.intensity<2);
    held.select(3);assert.equal(held.worldLight.intensity,0);assert.equal(held.handLight.intensity,0);
    assert.equal(world.children[0],held.worldLight);assert.equal(world.children.length,1);
  } finally {held.dispose();}
});

test('all material variants compress depth and matte materials use generated mipmapped textures',()=>{
  const {held}=fixture();
  try {
    for(const material of held.materials) {
      const kind=material.isMeshBasicMaterial?'basic':'standard';
      const shader={uniforms:{},vertexShader:THREE.ShaderLib[kind].vertexShader,fragmentShader:THREE.ShaderLib[kind].fragmentShader};
      material.onBeforeCompile(shader);
      const project=shader.vertexShader.indexOf('#include <project_vertex>');
      const compressed=shader.vertexShader.indexOf('gl_Position.z=((gl_Position.z/gl_Position.w+1.0)*.005-1.0)*gl_Position.w');
      assert.ok(compressed>project,'every prop and flame preserves ordered self-occlusion in the nearest depth range');
      assert.equal(material.depthTest,true);assert.equal(material.depthWrite,true);
      if(material.isMeshStandardMaterial){assert.ok(material.roughness>=.75);assert.equal(material.metalness,0);}
    }
    for(const texture of held.textures) {
      assert.ok(texture.isDataTexture);assert.ok(texture.image.data instanceof Uint8Array);
      assert.equal(texture.colorSpace,THREE.SRGBColorSpace);assert.equal(texture.generateMipmaps,true);
      assert.equal(texture.minFilter,THREE.LinearMipmapLinearFilter);
    }
  } finally {held.dispose();}
});

test('prewarming includes every hidden selection with the HDR target and restores it before awaiting',async()=>{
  const {held}=fixture();let release;
  const original={name:'original'},target={name:'linear HDR'};let current=original;
  try {
    const warming=held.warm({getRenderTarget:()=>current,setRenderTarget:value=>{current=value;},compileAsync:(scene,camera)=>{
      assert.equal(current,target);assert.equal(scene,held.scene);assert.equal(camera,held.camera);
      const materials=new Set();scene.traverse(object=>{if(object.material)materials.add(object.material);});
      assert.deepEqual(materials,held.materials,'hidden block and flame materials are included in the compile traversal');
      return new Promise(resolve=>{release=resolve;});
    }},target);
    assert.equal(current,original);assert.equal(held.ready,false);release();await warming;assert.equal(held.ready,true);
  } finally {held.dispose();}
});

test('an obsolete prewarm cannot make a disposed view model ready',async()=>{
  const {held}=fixture();let release,current=null;
  const warming=held.warm({getRenderTarget:()=>current,setRenderTarget:value=>{current=value;},compileAsync:()=>new Promise(resolve=>{release=resolve;})},{});
  held.dispose();release();await warming;assert.equal(held.ready,false);
});

test('render overlays HDR without clearing world depth and restores state even on renderer failure',()=>{
  const {held,update}=fixture();const target={},original={};let current=original,renders=0,fail=false;
  const renderer={autoClear:true,getRenderTarget:()=>current,setRenderTarget:value=>{current=value;},clear(){assert.fail('held items must retain world color/depth');},clearDepth(){assert.fail('held items must retain world depth');},render(scene,camera){
    assert.equal(this.autoClear,false);assert.equal(current,target);assert.equal(scene,held.scene);assert.equal(camera,held.camera);renders++;
    if(fail)throw new Error('test render failure');
  }};
  try {
    held.render(renderer,target);assert.equal(renders,0,'title/unready view does not draw');
    held.ready=true;update();held.render(renderer,target);
    assert.equal(renders,1);assert.equal(current,original);assert.equal(renderer.autoClear,true);
    fail=true;assert.throws(()=>held.render(renderer,target),/test render failure/);
    assert.equal(current,original);assert.equal(renderer.autoClear,true);
    update({visible:false});held.render(renderer,target);assert.equal(renders,2);
  } finally {held.dispose();}
});

test('mobile composition keeps the selected block small and above the touch action area',()=>{
  const {held,camera,update}=fixture();
  try {
    for(const aspect of [390/844,700/390]) {
      camera.aspect=aspect;camera.updateProjectionMatrix();update({mobile:true});
      const block=held.models.get(1).children[0],bounds=new THREE.Box3().setFromObject(block);
      const min=bounds.min.clone().project(held.camera),max=bounds.max.clone().project(held.camera);
      assert.ok(min.x>.3&&max.x<1,'prop fits in the right edge without covering the center crosshair');
      assert.ok(min.y>-.15&&max.y<.5,'the prop stays above the mobile action buttons');
      assert.ok(max.x-min.x<.5&&max.y-min.y<.5,'the selected block remains a small foreground object');
      const sleeveEnd=new THREE.Vector3(0,-.31/2,0).applyMatrix4(held.forearm.matrixWorld).project(held.camera);
      assert.ok(sleeveEnd.x>1,'the mobile sleeve continues through the screen edge instead of floating in view');
    }
    camera.aspect=16/9;camera.updateProjectionMatrix();update({mobile:false});
    const sleeveEnd=new THREE.Vector3(0,-.31/2,0).applyMatrix4(held.forearm.matrixWorld).project(held.camera);
    assert.ok(sleeveEnd.y< -1,'desktop returns to its lower-edge first-person silhouette');
  } finally {held.dispose();}
});

test('disposal removes only the owned world light and releases every resource once',()=>{
  const {held,world}=fixture(),other=new THREE.PointLight();world.add(other);
  let disposals=0;const count=held.geometries.size+held.materials.size+held.textures.size;
  for(const resource of [...held.geometries,...held.materials,...held.textures])resource.addEventListener('dispose',()=>disposals++);
  held.dispose();held.dispose();assert.equal(disposals,count);assert.deepEqual(world.children,[other]);assert.equal(held.ready,false);
});
