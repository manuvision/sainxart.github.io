import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { SunRays, sunRaySettings } from '../sun-rays.js';

function fixture({mobile=false,hdr=true}={}){
  const renderer={shadowMap:{enabled:true,type:THREE.PCFShadowMap}};
  const rays=new SunRays(renderer,{mobile,hdr});rays.resize(1280,720);
  const camera=new THREE.PerspectiveCamera(66,16/9,.08,260);
  camera.position.set(8,15,14);camera.lookAt(0,13,0);camera.updateMatrixWorld();
  const sun=new THREE.DirectionalLight(0xffe1af,3.3);sun.castShadow=true;
  sun.position.set(-35,50,30);sun.updateMatrixWorld();sun.target.updateMatrixWorld();
  sun.shadow.map=new THREE.WebGLRenderTarget(64,64);sun.shadow.updateMatrices(sun);
  const direction=sun.position.clone().normalize(),depth=new THREE.DepthTexture(1280,720);
  const draws=[];const draw=(material,target)=>draws.push({material,target});
  rays.setSun(camera,sun,direction);
  return {rays,renderer,camera,sun,direction,depth,draws,draw,
    dispose(){rays.dispose();sun.shadow.map.dispose();depth.dispose();}};
}

test('sun ray work and target allocation stay bounded for desktop, mobile and low quality',()=>{
  assert.deepEqual(sunRaySettings(false),{steps:24,range:32,waterRange:16,divisor:4});
  assert.deepEqual(sunRaySettings(true),{steps:16,range:24,waterRange:12,divisor:4});
  for(const mobile of [false,true]){
    const f=fixture({mobile});
    assert.deepEqual([f.rays.raw.width,f.rays.raw.height],[320,180]);
    assert.equal(f.rays.march.defines.RAY_STEPS,mobile?16:24);
    f.rays.resize(391,845);assert.deepEqual([f.rays.filtered.width,f.rays.filtered.height],[98,212]);
    f.rays.quality='low';f.rays.resize(391,845);
    assert.deepEqual([f.rays.raw.width,f.rays.raw.height],[1,1]);assert.equal(f.rays.enabled,false);
    f.dispose();
  }
});

test('rays snapshot the matching shadow matrix and camera without moving the light or refreshing shadows',()=>{
  const f=fixture(),u=f.rays.march.uniforms;
  assert.equal(f.rays.enabled,true);assert.equal(u.tShadow.value,f.sun.shadow.map.texture);
  assert.deepEqual(u.uShadowMatrix.value.elements,f.sun.shadow.matrix.elements);
  assert.deepEqual(u.uCameraWorld.value.elements,f.camera.matrixWorld.elements);
  const shadowSnapshot=u.uShadowMatrix.value.clone(),cameraSnapshot=u.uCameraWorld.value.clone();
  f.sun.shadow.matrix.elements[12]+=2;f.camera.position.x+=3;f.camera.updateMatrixWorld();
  assert.deepEqual(u.uShadowMatrix.value.elements,shadowSnapshot.elements,'a moving light cannot mismatch the cached map mid-pass');
  assert.deepEqual(u.uCameraWorld.value.elements,cameraSnapshot.elements);
  assert.equal(f.rays.render(f.depth,f.draw),true);
  assert.deepEqual(f.draws.map(draw=>draw.target),[f.rays.raw,f.rays.filtered]);
  for(const {material,target} of f.draws){
    const inputs=Object.values(material.uniforms).map(uniform=>uniform.value);
    assert.ok(!inputs.includes(target.texture),'a pass must never read its output attachment');
    assert.equal(material.toneMapped,false);
  }
  assert.equal(f.rays.march.uniforms.uRange.value,32);f.dispose();
});

test('invalid maps, night, disabled shadows and unsupported shadow encoding suppress all ray passes',()=>{
  const cases=[
    f=>{f.sun.shadow.map=null;f.rays.setSun(f.camera,f.sun,f.direction);},
    f=>{f.sun.shadow.matrix.elements[0]=NaN;f.rays.setSun(f.camera,f.sun,f.direction);},
    f=>{f.renderer.shadowMap.enabled=false;f.rays.setSun(f.camera,f.sun,f.direction);},
    f=>{f.renderer.shadowMap.type=THREE.VSMShadowMap;f.rays.setSun(f.camera,f.sun,f.direction);},
    f=>{f.rays.daylight=.2;},f=>{f.rays.strength=0;},f=>{f.rays.quality='low';}
  ];
  for(const change of cases){
    const f=fixture(),map=f.sun.shadow.map;change(f);
    assert.equal(f.rays.render(f.depth,f.draw),false);assert.equal(f.draws.length,0);assert.equal(f.rays.drawn,false);
    f.sun.shadow.map=map;f.dispose();
  }
  const f=fixture({hdr:false});assert.equal(f.rays.enabled,false);
  assert.deepEqual([f.rays.raw.width,f.rays.raw.height],[1,1]);f.dispose();
});

test('underwater rays require a known exit surface and use a shorter blue-tinted volume',()=>{
  for(const mobile of [false,true]){
    const f=fixture({mobile});f.camera.position.y=12.5;f.camera.updateMatrixWorld();
    f.rays.setSun(f.camera,f.sun,f.direction);f.rays.underwater=true;
    assert.equal(f.rays.render(f.depth,f.draw),false,'unknown water bounds must not haze the view through the surface');
    f.rays.setWaterSurface(12.4);assert.equal(f.rays.enabled,false,'a surface below the eye is not an underwater volume');
    f.rays.setWaterSurface(12.875);assert.equal(f.rays.render(f.depth,f.draw),true);
    const u=f.rays.march.uniforms;
    assert.equal(u.uWaterSurface.value,12.875);assert.equal(u.uUnder.value,1);
    assert.equal(u.uRange.value,mobile?12:16);
    assert.ok(u.uSunColor.value.r/f.sun.color.r<u.uSunColor.value.b/f.sun.color.b);
    const tint=u.uSunColor.value.clone();f.rays.render(f.depth,f.draw);
    assert.deepEqual(u.uSunColor.value,tint,'repeated underwater draws must not accumulate the tint');
    f.rays.underwater=false;f.rays.render(f.depth,f.draw);
    assert.equal(u.uRange.value,mobile?24:32);assert.deepEqual(u.uSunColor.value,f.sun.color);
    f.rays.setWaterSurface(null);assert.ok(Number.isNaN(f.rays.waterSurface));f.dispose();
  }
});

test('a failed ray pass does not publish stale output and disposal releases owned resources once',()=>{
  const f=fixture();
  assert.throws(()=>f.rays.render(f.depth,()=>{throw new Error('draw failed');}),/draw failed/);
  assert.equal(f.rays.drawn,false);
  const owned=[f.rays.raw,f.rays.filtered,f.rays.march,f.rays.blur];let count=0;
  for(const resource of owned)resource.addEventListener('dispose',()=>count++);
  f.rays.dispose();f.rays.dispose();assert.equal(count,owned.length);
  assert.equal(f.rays.render(f.depth,f.draw),false);f.dispose();
});
