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
    assert.deepEqual(held.root.children,[...held.models.values()],'the view contains only selectable props, with no arm, hand, thumb or cuff');
    assert.ok(held.worldLight.isPointLight);assert.equal(held.worldLight.intensity,0);
    const worldLights=visibleLights(world),viewLights=visibleLights(held.scene);
    const geometries=[...held.geometries],materials=[...held.materials],textures=[...held.textures];
    for(let i=0;i<25;i++) {
      const id=ITEM_IDS[i%ITEM_IDS.length];assert.equal(held.select(id),true);update();
      assert.equal(held.diagnostics.selected,id);
      assert.equal([...held.models.values()].filter(group=>group.visible).length,1);
      assert.ok(held.diagnostics.meshes>=1&&held.diagnostics.meshes<20,'one active prop stays within the draw budget');
      assert.deepEqual(visibleLights(world),worldLights);assert.deepEqual(visibleLights(held.scene),viewLights);
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
    assert.ok(held.worldLight.intensity>4&&held.itemLight.intensity>0);
    assert.ok(held.itemLight.position.length()<2,'prop illumination belongs to the small view scene');
  } finally {held.dispose();}
});

test('leaving play or selecting another block switches held illumination off without removing lights',()=>{
  const {held,world,update}=fixture();
  try {
    held.select(10);update();assert.ok(held.worldLight.intensity>0);
    update({visible:false});assert.equal(held.root.visible,false);assert.equal(held.worldLight.intensity,0);assert.equal(held.itemLight.intensity,0);
    update({visible:true,underwater:true});assert.ok(held.worldLight.intensity>0&&held.worldLight.intensity<2);
    held.select(3);assert.equal(held.worldLight.intensity,0);assert.equal(held.itemLight.intensity,0);
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

test('blocks and narrow torches peek through the right screen edge across mobile and desktop layouts',()=>{
  const {held,camera,update}=fixture();
  try {
    for(const [aspect,mobile] of [[390/844,true],[700/390,true],[16/9,false]])for(const id of [1,3,5,7,10]) {
      camera.aspect=aspect;camera.updateProjectionMatrix();held.select(id);update({mobile});
      const min=new THREE.Vector3(Infinity,Infinity,Infinity),max=new THREE.Vector3(-Infinity,-Infinity,-Infinity),point=new THREE.Vector3();
      held.models.get(id).traverseVisible(object=>{
        if(!object.isMesh)return;
        const positions=object.geometry.attributes.position;
        for(let i=0;i<positions.count;i++) {
          point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld).project(held.camera);min.min(point);max.max(point);
        }
      });
      assert.ok(min.x>.35&&max.x>1,`item ${id} stays at the right edge with part of its silhouette cropped`);
      const visibleFraction=(1-min.x)/(max.x-min.x);
      assert.ok(visibleFraction>.4&&visibleFraction<.85,`item ${id} remains visibly connected to the edge (${visibleFraction})`);
      if(mobile)assert.ok(min.y>-.6&&max.y<.25,'the prop remains in the lower right near the action controls');
    }
  } finally {held.dispose();}
});

test('disposal removes only the owned world light and releases every resource once',()=>{
  const {held,world}=fixture(),other=new THREE.PointLight();world.add(other);
  let disposals=0;const count=held.geometries.size+held.materials.size+held.textures.size;
  for(const resource of [...held.geometries,...held.materials,...held.textures])resource.addEventListener('dispose',()=>disposals++);
  held.dispose();held.dispose();assert.equal(disposals,count);assert.deepEqual(world.children,[other]);assert.equal(held.ready,false);
});
