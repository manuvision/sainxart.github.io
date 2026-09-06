import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { Graphics, WaterColumnMask } from '../graphics.js';
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
  assert.ok(Math.abs(source[0]-7.875)<1e-5);assert.equal(source[1],4);assert.equal(source[2],1);
  assert.ok(Math.abs(flow[0]-16.125)<1e-5);assert.equal(flow[1],16);assert.equal(flow[2],1);
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
  assert.ok(Math.abs(read(mask,8,8)[0]-12.25)<1e-5);
  put(world,8,12,8,BLOCK.AIR,0);settle(mask,world);
  assert.deepEqual(read(mask,8,8),[0,0,0]);
});

test('falling-water caustic columns are full height and refresh when their flow kind changes',()=>{
  const world=worldWithChunk(),mask=new WaterColumnMask(16,32);
  put(world,8,11,8,BLOCK.WATER,9);put(world,8,12,8,BLOCK.WATER,9);
  put(world,9,12,8,BLOCK.WATER,8);
  settle(mask,world);
  assert.deepEqual(read(mask,8,8),[13,11,1], 'falling level nine fills the exposed top voxel');
  assert.deepEqual(read(mask,9,8),[12.875,12,1], 'neighboring sources remain seven eighths high');
  put(world,8,12,8,BLOCK.WATER,8);settle(mask,world);
  assert.deepEqual(read(mask,8,8),[12.875,11,1], 'the same cached column lowers when falling water becomes a source');
  put(world,8,12,8,BLOCK.WATER,3);settle(mask,world);
  assert.deepEqual(read(mask,8,8),[12.375,11,1], 'horizontal flow uses its exact eighth-block height');
  put(world,8,12,8,BLOCK.AIR,0);settle(mask,world);
  assert.deepEqual(read(mask,8,8),[12,11,1], 'removing the top cell exposes the full-height falling cell below');
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
  assert.ok(Math.abs(read(mask,8,8)[0]-18.875)<1e-5);
  settle(mask,worldWithChunk());assert.deepEqual(read(mask,8,8),[0,0,0]);
});

const pondY=12.875;
function reflectionFixture(under,distance,{renderError,skyVisible=true}={}) {
  const graphics=Object.create(Graphics.prototype);
  graphics.camera=new THREE.PerspectiveCamera(66,16/9,.08,260);
  graphics.camera.position.set(3,pondY+(under?-distance:distance),5);
  graphics.camera.lookAt(3,pondY,-10);graphics.camera.updateMatrixWorld();
  graphics.mirrorCamera=graphics.camera.clone();
  graphics.mirrorDirection=new THREE.Vector3();graphics.mirrorTarget=new THREE.Vector3();
  graphics.mirrorPlane=new THREE.Plane();graphics.mirrorNormal=new THREE.Vector3(0,1,0);
  graphics.clipPlane=new THREE.Vector4();graphics.clipCorner=new THREE.Vector4();
  graphics.reflectionMatrix=new THREE.Matrix4();graphics.reflection={name:'reflection target'};
  graphics.reflectionClearColor=new THREE.Color();
  graphics.reflectionPosition=new THREE.Vector3(Infinity,Infinity,Infinity);
  graphics.reflectionRotation=new THREE.Quaternion();graphics.reflectionReady=false;
  graphics.reflectionUnder=!under;graphics.reflectionAspect=0;graphics.reflectionFov=0;
  graphics.waterMaterial={uniforms:{uUnder:{value:under?1:0}}};graphics.day={value:.7};
  graphics.scene=new THREE.Scene();graphics.scene.fog=new THREE.Fog(0x136463,0,27);
  graphics.sky=new THREE.Object3D();graphics.sky.visible=skyVisible;graphics.scene.add(graphics.sky);
  const originalColor=new THREE.Color(.37,.24,.19),clearColor=originalColor.clone();
  let clearAlpha=.42,target=null;
  const draws=[];
  graphics.renderer={
    getClearColor(out){return out.copy(clearColor);},getClearAlpha(){return clearAlpha;},
    setClearColor(color,alpha=clearAlpha){clearColor.set(color);clearAlpha=alpha;},
    getRenderTarget(){return target;},setRenderTarget(value){target=value;},
    render(scene,camera){
      draws.push({scene,camera,target,skyVisible:graphics.sky.visible,color:clearColor.clone(),alpha:clearAlpha});
      if(renderError)throw renderError;
    }
  };
  return {graphics,draws,originalColor,clearColor,get clearAlpha(){return clearAlpha;}};
}

for(const under of [false])for(const distance of [1.5,.007]) {
  test(`${under?'underwater':'above-water'} reflection clips the correct half-space at ${distance} blocks from the surface`,()=>{
    const fixture=reflectionFixture(under,distance),{graphics,draws}=fixture;
    const cameraPosition=graphics.camera.position.clone(),cameraRotation=graphics.camera.quaternion.clone();
    const direction=graphics.camera.getWorldDirection(new THREE.Vector3());
    assert.equal(graphics._updateReflection(),true);
    assert.equal(draws.length,1);assert.equal(draws[0].target,graphics.reflection);
    assert.equal(draws[0].camera,graphics.mirrorCamera);
    assert.ok(Math.abs(graphics.mirrorCamera.position.y-(2*pondY-cameraPosition.y))<1e-10);
    assert.equal(graphics.mirrorCamera.position.x,cameraPosition.x);
    assert.equal(graphics.mirrorCamera.position.z,cameraPosition.z);
    const reflectedDirection=graphics.mirrorCamera.getWorldDirection(new THREE.Vector3());
    assert.ok(reflectedDirection.distanceTo(new THREE.Vector3(direction.x,-direction.y,direction.z))<1e-10);
    assert.deepEqual(graphics.camera.position,cameraPosition,'reflection does not move the player camera');
    assert.deepEqual(graphics.camera.quaternion.toArray(),cameraRotation.toArray(),'reflection does not rotate the player camera');

    const projection=graphics.mirrorCamera.projectionMatrix,view=graphics.mirrorCamera.matrixWorldInverse;
    for(const matrix of [projection,graphics.mirrorCamera.projectionMatrixInverse,graphics.reflectionMatrix]) {
      assert.ok(matrix.elements.every(Number.isFinite),'all projection coefficients remain finite near the surface');
    }
    const identity=projection.clone().multiply(graphics.mirrorCamera.projectionMatrixInverse);
    identity.elements.forEach((value,i)=>assert.ok(Math.abs(value-(i%5===0?1:0))<1e-8));
    const nearDistance=y=>{
      const point=new THREE.Vector4(3,y,-10,1).applyMatrix4(view).applyMatrix4(projection);
      assert.ok(point.w>0,'sample is in front of the reflected camera');
      return point.z+point.w; // WebGL near-plane condition: z >= -w.
    };
    assert.ok(nearDistance(pondY+(under?-1:1))>0,'geometry on the reflected side survives clipping');
    assert.ok(nearDistance(pondY+(under?1:-1))<0,'geometry across the interface is clipped');
    const worldPlane=graphics.mirrorPlane.clone().applyMatrix4(graphics.mirrorCamera.matrixWorld);
    assert.ok(worldPlane.normal.distanceTo(new THREE.Vector3(0,under?-1:1,0))<1e-10);
    assert.ok(worldPlane.distanceToPoint(graphics.mirrorCamera.position)<0,
      'the near clip stays in front of the mirror camera even inside the old .04-block bias');

    assert.equal(draws[0].skyVisible,!under);
    if(under)assert.ok(Math.max(draws[0].color.r,draws[0].color.g,draws[0].color.b)<.15,
      'missing underwater reflection pixels clear to dark water instead of a bright sky');
    else assert.deepEqual(draws[0].color,fixture.originalColor);
    assert.equal(graphics.sky.visible,true);assert.deepEqual(fixture.clearColor,fixture.originalColor);
    assert.equal(fixture.clearAlpha,.42);
    assert.equal(graphics.reflectionReady,true);assert.equal(graphics.reflectionUnder,under);
    assert.deepEqual(graphics.reflectionPosition,cameraPosition);
    assert.deepEqual(graphics.reflectionRotation.toArray(),cameraRotation.toArray());
  });
}

test('above-water reflection restores sky and renderer clear state when rendering throws',()=>{
  for(const skyVisible of [true,false]) {
    const renderError=new Error('simulated render failure');
    const fixture=reflectionFixture(false,.007,{renderError,skyVisible});
    assert.throws(()=>fixture.graphics._updateReflection(),error=>error===renderError);
    assert.equal(fixture.draws[0].skyVisible,skyVisible);
    assert.equal(fixture.graphics.sky.visible,skyVisible);
    assert.deepEqual(fixture.clearColor,fixture.originalColor);
    assert.equal(fixture.clearAlpha,.42);
    assert.equal(fixture.graphics.reflectionReady,false,'a failed pass is not published as a ready reflection');
  }
});

// Keep this at the render boundary: an underwater camera must neither replace
// the above-water cache nor spend a scene pass reflecting the pond floor.
test('underwater views skip the reflection pass and preserve the above-water cache',()=>{
  const {graphics,draws}=reflectionFixture(true,.25);
  graphics.reflectionReady=true;graphics.reflectionUnder=false;
  const cached=graphics.reflectionPosition.clone();
  assert.equal(graphics._updateReflection(),false);
  assert.equal(draws.length,0);assert.equal(graphics.reflectionReady,true);
  assert.deepEqual(graphics.reflectionPosition,cached);
  assert.equal(graphics.reflectionUnder,false);
});

test('underwater light-shaft bounds follow the current exposed water column',()=>{
  const world=worldWithChunk(),mask=new WaterColumnMask(16,32);
  put(world,8,10,8);put(world,8,11,8);put(world,8,12,8,BLOCK.WATER,3);
  assert.equal(mask.surfaceAt({x:8.5,y:11,z:8.5}),null,'unsampled columns cannot enable rays');
  settle(mask,world);
  assert.equal(mask.surfaceAt({x:8.5,y:11,z:8.5}),12.375);
  assert.equal(mask.surfaceAt({x:8.5,y:9.9,z:8.5}),null,'dry space below a pool stays dry');
  assert.equal(mask.surfaceAt({x:8.5,y:12.375,z:8.5}),null,'air above the interface is excluded');
  assert.equal(mask.surfaceAt({x:80,y:11,z:8.5}),null,'outside cached coverage is unknown');
  put(world,8,13,8,BLOCK.STONE);settle(mask,world);
  assert.equal(mask.surfaceAt({x:8.5,y:11,z:8.5}),null,'a sealed pool cannot receive direct sunlight');
});

function waterShadowFixture(){
  const graphics=Object.create(Graphics.prototype);
  graphics.sun=new THREE.DirectionalLight();graphics.sun.castShadow=true;
  graphics.sun.shadow.map=new THREE.WebGLRenderTarget(2048,1024);
  graphics.sun.shadow.matrix.makeTranslation(.2,.3,.4);
  graphics.sun.shadow.radius=6;graphics.sun.shadow.bias=-.00035;
  graphics.renderer={shadowMap:{enabled:true,type:THREE.PCFShadowMap}};
  graphics.waterMaterial={uniforms:{tSunShadow:{value:null},uSunShadowReady:{value:0},
    uSunShadowMatrix:{value:new THREE.Matrix4()},uSunShadowTexel:{value:new THREE.Vector2()},uSunShadowBias:{value:0}}};
  return graphics;
}

test('water glints use the packed caster map and its cached matrix without refreshing shadows',()=>{
  const graphics=waterShadowFixture(),uniforms=graphics.waterMaterial.uniforms;
  graphics._updateWaterShadow();
  assert.equal(uniforms.uSunShadowReady.value,1);
  assert.equal(uniforms.tSunShadow.value,graphics.sun.shadow.map.texture);
  assert.deepEqual(uniforms.uSunShadowMatrix.value.elements,graphics.sun.shadow.matrix.elements);
  assert.deepEqual(uniforms.uSunShadowTexel.value.toArray(),[3/2048,3/1024],'the soft kernel remains bounded even with broad terrain shadows');
  assert.equal(uniforms.uSunShadowBias.value,-.00035);
  const snapshot=uniforms.uSunShadowMatrix.value.clone();
  graphics.sun.position.set(100,80,90);graphics.sun.shadow.matrix.elements[12]+=1;
  assert.deepEqual(uniforms.uSunShadowMatrix.value.elements,snapshot.elements,'a light pose change cannot alter the paired sample matrix mid-draw');
  graphics._updateWaterShadow();assert.equal(uniforms.uSunShadowMatrix.value.elements[12],1.2);
  graphics.sun.shadow.map.dispose();
});

test('water glints reject unavailable or unsupported shadow maps instead of inventing unoccluded sunlight',()=>{
  const graphics=waterShadowFixture(),uniforms=graphics.waterMaterial.uniforms,map=graphics.sun.shadow.map;
  const changes=[
    ()=>{graphics.renderer.shadowMap.enabled=false;},
    ()=>{graphics.renderer.shadowMap.type=THREE.VSMShadowMap;},
    ()=>{graphics.sun.shadow.map=null;},
    ()=>{graphics.sun.shadow.matrix.elements[0]=NaN;}
  ];
  for(const invalidate of changes){
    graphics.renderer.shadowMap.enabled=true;graphics.renderer.shadowMap.type=THREE.PCFShadowMap;
    graphics.sun.shadow.map=map;graphics.sun.shadow.matrix.identity();
    graphics._updateWaterShadow();assert.equal(uniforms.uSunShadowReady.value,1);
    invalidate();graphics._updateWaterShadow();
    assert.equal(uniforms.uSunShadowReady.value,0);assert.equal(uniforms.tSunShadow.value,null);
  }
  map.dispose();
});
