import * as THREE from './vendor/three.module.js';
import { SunRays, sunRayCompositeShader } from './sun-rays.js?v=3.6';

// Linear scene values survive until this final output pass. ACES and the sRGB
// transfer function come from the vendored Three.js shaders (vendor/THREE-LICENSE.txt).
// Sources: https://threejs.org/manual/en/color-management.html
// https://github.com/mrdoob/three.js/blob/master/examples/jsm/shaders/OutputShader.js
// https://threejs.org/docs/pages/UnrealBloomPass.html
// FXAA principle: https://github.com/mrdoob/three.js/blob/master/examples/jsm/shaders/FXAAShader.js
const vertexShader=`
  varying vec2 vUv;
  void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.0,1.0);}
`;

const prefilterShader=`
  uniform sampler2D tScene;
  uniform vec2 uFootprint;
  uniform float uThreshold,uKnee;
  varying vec2 vUv;
  vec3 highlight(vec2 uv){
    vec3 color=max(texture2D(tScene,uv).rgb,vec3(0.0));
    float brightness=dot(color,vec3(.2126,.7152,.0722));
    float soft=clamp(brightness-uThreshold+uKnee,0.0,2.0*uKnee);
    soft=soft*soft/(4.0*uKnee+.0001);
    float contribution=max(brightness-uThreshold,soft)/max(brightness,.0001);
    // Keep intense pinpoints finite without putting a halo around ordinary foliage.
    return min(color*contribution,vec3(16.0));
  }
  void main(){
    vec2 d=uFootprint;
    vec3 color=highlight(vUv)*.2;
    color+=highlight(vUv+vec2(-d.x,-d.y))*.2;
    color+=highlight(vUv+vec2(d.x,-d.y))*.2;
    color+=highlight(vUv+vec2(-d.x,d.y))*.2;
    color+=highlight(vUv+vec2(d.x,d.y))*.2;
    gl_FragColor=vec4(color,1.0);
  }
`;

const blurShader=`
  uniform sampler2D tInput;
  uniform vec2 uStep;
  varying vec2 vUv;
  void main(){
    // Bilinear pairing: five texture fetches reproduce a normalized nine-tap Gaussian.
    vec3 color=texture2D(tInput,vUv).rgb*.2270270270;
    color+=(texture2D(tInput,vUv+uStep*1.3846153846).rgb+texture2D(tInput,vUv-uStep*1.3846153846).rgb)*.3162162162;
    color+=(texture2D(tInput,vUv+uStep*3.2307692308).rgb+texture2D(tInput,vUv-uStep*3.2307692308).rgb)*.0702702703;
    gl_FragColor=vec4(color,1.0);
  }
`;

const compositeShader=`
  uniform sampler2D tScene,tBloom;
  uniform vec2 uTexel;
  uniform float uStrength,uSaturation,uVignette,uUnderwater;
  varying vec2 vUv;
  ${sunRayCompositeShader}
  #define toneMappingExposure uExposure
  #include <tonemapping_pars_fragment>
  #undef toneMappingExposure
  float perceptualLuma(vec3 color){
    float l=max(0.0,dot(color,vec3(.2126,.7152,.0722)));
    return sqrt(l/(1.0+l));
  }
  vec3 antialias(){
    vec3 center=texture2D(tScene,vUv).rgb;
    float m=perceptualLuma(center);
    float nw=perceptualLuma(texture2D(tScene,vUv+uTexel*vec2(-1.0,-1.0)).rgb);
    float ne=perceptualLuma(texture2D(tScene,vUv+uTexel*vec2(1.0,-1.0)).rgb);
    float sw=perceptualLuma(texture2D(tScene,vUv+uTexel*vec2(-1.0,1.0)).rgb);
    float se=perceptualLuma(texture2D(tScene,vUv+uTexel*vec2(1.0,1.0)).rgb);
    float minimum=min(m,min(min(nw,ne),min(sw,se)));
    float maximum=max(m,max(max(nw,ne),max(sw,se)));
    // Avoid blurring low-contrast leaf texture and calm water.
    if(maximum-minimum<max(.025,maximum*.16))return center;
    vec2 direction=vec2(sw+se-nw-ne,nw+sw-ne-se);
    float damping=max((nw+ne+sw+se)*.03125,.0078125);
    direction=clamp(direction/(min(abs(direction.x),abs(direction.y))+damping),vec2(-4.0),vec2(4.0))*uTexel;
    vec3 inner=(texture2D(tScene,vUv-direction/6.0).rgb+texture2D(tScene,vUv+direction/6.0).rgb)*.5;
    vec3 outer=inner*.5+(texture2D(tScene,vUv-direction*.5).rgb+texture2D(tScene,vUv+direction*.5).rgb)*.25;
    float outerLuma=perceptualLuma(outer);
    return mix(center,(outerLuma<minimum||outerLuma>maximum)?inner:outer,.8);
  }
  void main(){
    vec3 color=max(antialias(),vec3(0.0));
    if(uStrength>0.0)color+=texture2D(tBloom,vUv).rgb*uStrength;
    if(uSunRayStrength>0.0)color+=sunRayColor()*uSunRayStrength;
    float light=dot(color,vec3(.2126,.7152,.0722))*uExposure;
    vec3 balance=mix(vec3(.997,1.0,1.012),vec3(1.015,1.003,.982),smoothstep(.15,1.8,light));
    color*=mix(balance,vec3(1.0),uUnderwater*.6);
    color=ACESFilmicToneMapping(color);
    float gray=dot(color,vec3(.2126,.7152,.0722));
    color=max(mix(vec3(gray),color,uSaturation),vec3(0.0));
    vec2 p=vUv-.5;
    color*=1.0-uVignette*smoothstep(.12,.8,dot(p,p)*2.0);
    // Explicit conversion occurs exactly once; no tonemapping/colorspace chunks follow.
    color=sRGBTransferOETF(vec4(color,1.0)).rgb;
    float noise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
    color+=(noise-.5)/255.0;
    gl_FragColor=vec4(clamp(color,0.0,1.0),1.0);
  }
`;

function material(name,fragmentShader,uniforms){
  return new THREE.ShaderMaterial({name,vertexShader,fragmentShader,uniforms,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false});
}

/**
 * Render scene/water with NoToneMapping into .target, then call render(). Target
 * textures are linear; renderer.outputColorSpace may remain SRGBColorSpace.
 * resize() takes drawing-buffer pixels, including the renderer's adaptive DPR.
 * HTML controls are outside this pipeline. Low quality retains FXAA and ACES.
 */
export class PostProcessing {
  constructor(renderer,{mobile=false}={}){
    this.renderer=renderer;this.mobile=mobile;this.quality='auto';this.disposed=false;
    this.exposure=1;this.strength=.16;this.threshold=1.35;this.softKnee=.45;
    this.saturation=1.035;this.vignette=.055;this.underwater=false;this.daylight=1;
    this.width=1;this.height=1;this.lastPassCount=0;
    this.hdr=!!(renderer.extensions?.has('EXT_color_buffer_float')||renderer.extensions?.has('EXT_color_buffer_half_float'));
    this.sunRays=new SunRays(renderer,{mobile,hdr:this.hdr});
    const type=this.hdr?THREE.HalfFloatType:THREE.UnsignedByteType;
    const target=(name,depth=false)=>{
      const result=new THREE.WebGLRenderTarget(1,1,{type,format:THREE.RGBAFormat,colorSpace:THREE.LinearSRGBColorSpace,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:depth,stencilBuffer:false,generateMipmaps:false,samples:0});
      result.texture.name=name;return result;
    };
    this.target=target('Voxyz linear scene',true);
    this.target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    this.target.depthTexture.name='Voxyz scene depth';
    this.bloomA=target('Voxyz bloom A');this.bloomB=target('Voxyz bloom B');
    this.prefilter=material('Voxyz bloom extraction',prefilterShader,{tScene:{value:this.target.texture},uFootprint:{value:new THREE.Vector2()},uThreshold:{value:this.threshold},uKnee:{value:this.softKnee}});
    this.blur=material('Voxyz bloom blur',blurShader,{tInput:{value:this.bloomA.texture},uStep:{value:new THREE.Vector2()}});
    this.composite=material('Voxyz ACES and FXAA',compositeShader,{tScene:{value:this.target.texture},tBloom:{value:this.bloomA.texture},uTexel:{value:new THREE.Vector2(1,1)},uExposure:{value:1},uStrength:{value:0},uSaturation:{value:this.saturation},uVignette:{value:this.vignette},uUnderwater:{value:0},
      tSunRays:{value:this.sunRays.filtered.texture},tSunDepth:{value:this.target.depthTexture},uSunRaySize:{value:new THREE.Vector2(1,1)},uSunNearFar:{value:this.sunRays.nearFar},uSunRayStrength:{value:0}});
    this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    this.mesh=new THREE.Mesh(this.geometry,this.composite);this.mesh.frustumCulled=false;
    this.scene=new THREE.Scene();this.scene.add(this.mesh);this.camera=new THREE.Camera();
    const size=renderer.getDrawingBufferSize(new THREE.Vector2());this.resize(size.x,size.y);
  }
  get bloomEnabled(){return this.hdr&&this.quality!=='low'&&this.strength>0;}
  resize(width,height){
    if(this.disposed)return;
    width=Number.isFinite(width)?Math.max(1,Math.round(width)):1;
    height=Number.isFinite(height)?Math.max(1,Math.round(height)):1;
    const maximum=this.renderer.capabilities?.maxTextureSize||8192,fit=Math.min(1,maximum/width,maximum/height);
    this.width=Math.max(1,Math.floor(width*fit));this.height=Math.max(1,Math.floor(height*fit));
    this.target.setSize(this.width,this.height);
    this.target.depthTexture.image.width=this.width;this.target.depthTexture.image.height=this.height;
    const divisor=this.mobile&&this.quality!=='high'?8:4;
    const bw=this.quality==='low'?1:Math.max(1,Math.ceil(this.width/divisor));
    const bh=this.quality==='low'?1:Math.max(1,Math.ceil(this.height/divisor));
    this.bloomA.setSize(bw,bh);this.bloomB.setSize(bw,bh);
    this.prefilter.uniforms.uFootprint.value.set(.25/bw,.25/bh);
    this.composite.uniforms.uTexel.value.set(1/this.width,1/this.height);
    this.sunRays.mobile=this.mobile;this.sunRays.quality=this.quality;this.sunRays.resize(this.width,this.height);
    this.composite.uniforms.uSunRaySize.value.set(this.sunRays.filtered.width,this.sunRays.filtered.height);
  }
  setQuality(mode){
    this.quality=['auto','high','low'].includes(mode)?mode:'auto';this.resize(this.width,this.height);
  }
  setUnderwater(value){this.underwater=!!value;}
  setDaylight(value){if(Number.isFinite(value))this.daylight=THREE.MathUtils.clamp(value,0,1);}
  // Call after the scene render, when Three has published the matching shadow map/matrix.
  setSun(camera,sun,direction){this.sunRays.setSun(camera,sun,direction);}
  setWaterSurface(surface){this.sunRays.setWaterSurface(surface);}
  _draw(pass,target){
    this.mesh.material=pass;this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);this.lastPassCount++;
  }
  render(){
    if(this.disposed)return;
    const renderer=this.renderer,previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
    const scissor=renderer.getScissorTest(),toneMapping=renderer.toneMapping,xr=renderer.xr?.enabled;
    this.lastPassCount=0;
    renderer.autoClear=false;renderer.setScissorTest(false);renderer.toneMapping=THREE.NoToneMapping;
    if(renderer.xr)renderer.xr.enabled=false;
    try{
      this.sunRays.underwater=this.underwater;this.sunRays.daylight=this.daylight;
      this.sunRays.render(this.target.depthTexture,(pass,target)=>this._draw(pass,target));
      this.prefilter.uniforms.uThreshold.value=Math.max(.01,this.threshold);
      this.prefilter.uniforms.uKnee.value=Math.max(.001,this.softKnee);
      if(this.bloomEnabled){
        this._draw(this.prefilter,this.bloomA);
        this.blur.uniforms.tInput.value=this.bloomA.texture;
        this.blur.uniforms.uStep.value.set(1/this.bloomA.width,0);this._draw(this.blur,this.bloomB);
        this.blur.uniforms.tInput.value=this.bloomB.texture;
        this.blur.uniforms.uStep.value.set(0,1/this.bloomA.height);this._draw(this.blur,this.bloomA);
      }
      const uniforms=this.composite.uniforms;
      uniforms.uExposure.value=Math.max(.01,this.exposure);
      uniforms.uStrength.value=this.bloomEnabled?this.strength*(this.underwater?.35:1)*(1.1-this.daylight*.1):0;
      uniforms.uSaturation.value=this.saturation;uniforms.uVignette.value=this.vignette*(this.underwater?.3:1);
      uniforms.uUnderwater.value=this.underwater?1:0;
      uniforms.uSunRayStrength.value=this.sunRays.drawn?this.sunRays.strength*(this.underwater?.65:1)*THREE.MathUtils.smoothstep(this.daylight,.22,.5):0;
      this._draw(this.composite,null);
    }finally{
      renderer.autoClear=autoClear;renderer.toneMapping=toneMapping;
      if(renderer.xr)renderer.xr.enabled=xr;
      renderer.setRenderTarget(previous);renderer.setScissorTest(scissor);
    }
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    this.scene.remove(this.mesh);this.geometry.dispose();
    this.prefilter.dispose();this.blur.dispose();this.composite.dispose();
    // RenderTarget disposal releases its attached depth texture when initialized.
    this.target.dispose();this.bloomA.dispose();this.bloomB.dispose();
    this.sunRays.dispose();
  }
}

export default PostProcessing;
