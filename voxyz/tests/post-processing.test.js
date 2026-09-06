import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { PostProcessing } from '../post-processing.js';

function renderer({hdr=true,width=1280,height=720}={}){
  return {
    extensions:{has:name=>hdr&&name==='EXT_color_buffer_float'},capabilities:{maxTextureSize:8192},
    autoClear:true,toneMapping:THREE.ACESFilmicToneMapping,xr:{enabled:true},scissor:true,current:null,draws:[],
    getDrawingBufferSize:target=>target.set(width,height),getRenderTarget(){return this.current;},
    setRenderTarget(target){this.current=target;},getScissorTest(){return this.scissor;},setScissorTest(value){this.scissor=value;},
    render(scene){
      const material=scene.children[0].material;
      this.draws.push({target:this.current,material,inputs:Object.values(material.uniforms).map(u=>u.value).filter(v=>v?.isTexture)});
      if(this.failAt===this.draws.length)throw new Error('simulated render failure');
    }
  };
}

test('the scene target retains HDR linear color and a matching depth texture through resizing',()=>{
  const gpu=renderer(),post=new PostProcessing(gpu);
  assert.equal(post.hdr,true);assert.equal(post.target.texture.type,THREE.HalfFloatType);
  assert.equal(post.target.texture.colorSpace,THREE.LinearSRGBColorSpace);
  assert.equal(post.target.depthBuffer,true);assert.ok(post.target.depthTexture.isDepthTexture);
  post.resize(1920,1080);
  assert.deepEqual([post.target.width,post.target.height],[1920,1080]);
  assert.deepEqual([post.target.depthTexture.image.width,post.target.depthTexture.image.height],[1920,1080]);
  assert.deepEqual(post.composite.uniforms.uTexel.value.toArray(),[1/1920,1/1080]);
  assert.deepEqual([post.bloomA.width,post.bloomA.height],[480,270]);
  post.dispose();
});

test('mobile and low settings reduce bloom allocation while preserving the scene resolution',()=>{
  const post=new PostProcessing(renderer({width:1080,height:1920}),{mobile:true});
  assert.deepEqual([post.bloomA.width,post.bloomA.height],[135,240]);
  post.setQuality('high');assert.deepEqual([post.bloomA.width,post.bloomA.height],[270,480]);
  post.setQuality('low');assert.deepEqual([post.bloomA.width,post.bloomA.height],[1,1]);
  assert.deepEqual([post.target.width,post.target.height],[1080,1920]);
  post.resize(0,NaN);assert.deepEqual([post.target.width,post.target.height],[1,1]);
  post.renderer.capabilities.maxTextureSize=512;post.resize(2000,1000);
  assert.deepEqual([post.target.width,post.target.height],[512,256]);post.dispose();
});

test('bloom never reads its output attachment and the final pass presents to the canvas',()=>{
  const gpu=renderer(),post=new PostProcessing(gpu);gpu.current=post.target;
  post.render();assert.equal(post.lastPassCount,4);
  assert.deepEqual(gpu.draws.map(draw=>draw.target),[post.bloomA,post.bloomB,post.bloomA,null]);
  for(const draw of gpu.draws)if(draw.target)assert.ok(!draw.inputs.includes(draw.target.texture),'sampling the active color attachment would create a feedback loop');
  assert.equal(gpu.draws.at(-1).material,post.composite);assert.equal(post.composite.toneMapped,false);
  assert.equal(post.geometry.attributes.position.count,3);
  assert.equal(gpu.current,post.target);assert.equal(gpu.autoClear,true);assert.equal(gpu.scissor,true);
  assert.equal(gpu.toneMapping,THREE.ACESFilmicToneMapping);assert.equal(gpu.xr.enabled,true);post.dispose();
});

test('low quality and unavailable HDR still present antialiasing and grading without bloom passes',()=>{
  for(const hdr of [true,false]){
    const gpu=renderer({hdr}),post=new PostProcessing(gpu);if(hdr)post.setQuality('low');
    post.render();assert.equal(post.lastPassCount,1);assert.equal(gpu.draws[0].material,post.composite);
    assert.equal(post.composite.uniforms.uStrength.value,0);assert.equal(post.bloomEnabled,false);
    if(!hdr)assert.equal(post.target.texture.type,THREE.UnsignedByteType);
    post.dispose();
  }
});

test('exposure is applied in the final pass and underwater bloom is attenuated',()=>{
  const post=new PostProcessing(renderer());post.exposure=1.3;post.render();
  const dryBloom=post.composite.uniforms.uStrength.value,dryVignette=post.composite.uniforms.uVignette.value;
  assert.equal(post.composite.uniforms.uExposure.value,1.3);
  post.setUnderwater(true);post.render();
  assert.ok(post.composite.uniforms.uStrength.value<dryBloom);
  assert.ok(post.composite.uniforms.uVignette.value<dryVignette);
  assert.equal(post.composite.uniforms.uUnderwater.value,1);post.dispose();
});

test('renderer state is restored if an intermediate pass fails',()=>{
  const gpu=renderer(),post=new PostProcessing(gpu),previous={name:'previous target'};
  gpu.current=previous;gpu.failAt=2;
  assert.throws(()=>post.render(),/simulated render failure/);
  assert.equal(gpu.current,previous);assert.equal(gpu.autoClear,true);assert.equal(gpu.scissor,true);
  assert.equal(gpu.toneMapping,THREE.ACESFilmicToneMapping);assert.equal(gpu.xr.enabled,true);post.dispose();
});

test('disposal releases all owned render targets, materials and geometry once',()=>{
  const post=new PostProcessing(renderer()),resources=[post.target,post.bloomA,post.bloomB,post.prefilter,post.blur,post.composite,post.geometry];
  let count=0;for(const resource of resources)resource.addEventListener('dispose',()=>count++);
  post.dispose();post.dispose();assert.equal(count,resources.length);assert.equal(post.scene.children.length,0);
  const before=post.renderer.draws.length;post.render();assert.equal(post.renderer.draws.length,before);
});

test('real sun rays add two bounded passes before final linear compositing and never sample an active attachment',()=>{
  const gpu=renderer(),post=new PostProcessing(gpu),camera=new THREE.PerspectiveCamera(66,16/9,.08,260);
  camera.position.set(8,15,14);camera.updateMatrixWorld();
  const sun=new THREE.DirectionalLight(0xffe1af,3.3);sun.castShadow=true;
  sun.shadow.map=new THREE.WebGLRenderTarget(64,64);sun.shadow.updateMatrices(sun);
  post.setSun(camera,sun,new THREE.Vector3(-.55,.48,.42));gpu.current=post.target;
  post.render();assert.equal(post.lastPassCount,6);
  assert.deepEqual(gpu.draws.map(draw=>draw.target),[post.sunRays.raw,post.sunRays.filtered,post.bloomA,post.bloomB,post.bloomA,null]);
  for(const draw of gpu.draws)if(draw.target)assert.ok(!draw.inputs.includes(draw.target.texture));
  assert.ok(post.composite.uniforms.uSunRayStrength.value>0);
  assert.deepEqual(post.composite.uniforms.uSunRaySize.value.toArray(),[320,180]);
  const dryStrength=post.composite.uniforms.uSunRayStrength.value;
  camera.position.y=12.5;camera.updateMatrixWorld();post.setSun(camera,sun,new THREE.Vector3(-.55,.48,.42));
  post.setUnderwater(true);post.render();assert.equal(post.lastPassCount,4);
  assert.equal(post.composite.uniforms.uSunRayStrength.value,0);
  post.setWaterSurface(12.875);post.render();assert.equal(post.lastPassCount,6);
  assert.ok(post.composite.uniforms.uSunRayStrength.value<dryStrength);
  post.setQuality('low');post.render();assert.equal(post.lastPassCount,1);
  assert.equal(post.composite.uniforms.uSunRayStrength.value,0);
  post.dispose();sun.shadow.map.dispose();
});
