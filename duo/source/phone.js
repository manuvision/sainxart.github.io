import * as THREE from 'three';
import { loadOfficialModel } from './official-model.js';
import { createScreenMaterial } from './screen-material.js';
import { createScreenBlur } from './screen-blur.js';

export const W=8.23,H=11.78,D=.52;

function loadImage(src){
  return new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);
    image.decoding='async';
    image.onerror=()=>reject(new Error('Screen artwork could not load'));
    image.src=src;
  });
}

function makeScreen(image,overlay,outer,maxScreenSize){
  const canvas=document.createElement('canvas');
  const nativeWidth=outer?1000:2048,nativeHeight=outer?1455:1432;
  const resolution=Math.min(1,maxScreenSize/Math.max(nativeWidth,nativeHeight));
  canvas.width=Math.round(nativeWidth*resolution);canvas.height=Math.round(nativeHeight*resolution);
  const context=canvas.getContext('2d',{alpha:false});
  const {width,height}=canvas;
  context.fillStyle='#000';context.fillRect(0,0,width,height);
  context.save();context.translate(width*.05,height*.05);context.scale(.9,.9);
  // Preserve the photograph's proportions and keep the raccoon centered in
  // both the portrait cover crop and the continuous landscape inner display.
  const scale=Math.max(width/image.width,height/image.height);
  const sourceWidth=width/scale,sourceHeight=height/scale;
  context.drawImage(image,(image.width-sourceWidth)/2,(image.height-sourceHeight)/2,sourceWidth,sourceHeight,0,0,width,height);
  context.drawImage(overlay,0,0,width,height);
  context.restore();
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=true;
  return texture;
}

export async function createPhone(renderer,{assets,initialFold=0,maxScreenSize=2048,yieldToMain=async()=>{},onPhase=()=>{}}={}){
  const url=path=>assets?.url(path)??path;
  const [rig,wallpaper,innerOverlay,outerOverlay]=await Promise.all([
    loadOfficialModel(renderer,assets?.manager),
    loadImage(url('./assets/wallpaper-raccoon.webp')),
    loadImage(url('./assets/lockscreen-inner.avif')),
    loadImage(url('./assets/lockscreen-outer.avif'))
  ]);
  onPhase('display');await yieldToMain();
  const innerTexture=makeScreen(wallpaper,innerOverlay,false,maxScreenSize);
  renderer.initTexture(innerTexture);await yieldToMain();
  const outerTexture=makeScreen(wallpaper,outerOverlay,true,maxScreenSize);
  renderer.initTexture(outerTexture);await yieldToMain();
  innerTexture.anisotropy=outerTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const innerBlur=createScreenBlur(renderer,innerTexture);
  const outerBlur=createScreenBlur(renderer,outerTexture,true);
  await Promise.all([innerBlur.prepare(),outerBlur.prepare()]);
  await yieldToMain();
  const options={flipY:true,innerSize:rig.screenDimensions.inner,outerSize:rig.screenDimensions.outer,outerCenter:rig.screenDimensions.outerCenter};
  const innerMaterial=createScreenMaterial(innerBlur.texture,false,options);
  const outerMaterial=createScreenMaterial(outerBlur.texture,true,options);
  rig.screenMeshes.inner.material=innerMaterial;
  rig.screenMeshes.outer.material=outerMaterial;
  const phone=rig.phone;
  let progress=initialFold;
  function setFold(value){
    progress=THREE.MathUtils.clamp(value,0,1);
    rig.setFold(progress);
    // Follow the changing silhouette while leaving the official hinge rig intact.
    const angle=(1-progress)*Math.PI;
    phone.position.x=-(W+Math.min(0,-W*Math.cos(angle)))/2;
    phone.position.z=-W*Math.sin(angle)*.16;
    innerBlur.update(progress);outerBlur.update(progress);
    innerMaterial.uniforms.progress.value=outerMaterial.uniforms.progress.value=progress;
  }
  function updateProjection(){
    innerMaterial.uniforms.phoneInverse.value.copy(rig.projectionRoot.matrixWorld).invert();
    outerMaterial.uniforms.phoneInverse.value.copy(rig.projectionRoot.matrixWorld).invert();
  }
  setFold(progress);
  return {phone,setFold,updateProjection,getBounds:rig.getBounds,screenSize:[innerTexture.image.width,innerTexture.image.height],get progress(){return progress;}};
}
