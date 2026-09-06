import * as THREE from './vendor/three.module.js';

// Single-scattering approximation using the actual directional-light shadow map.
// Sources: https://threejs.org/docs/pages/GodraysNode.html
// https://github.com/Ameobea/three-good-godrays (shadow marching and depth-aware reconstruction).
// The vendored r180 map is RGBA-packed depth; no extra shadow/geometry pass is needed.
const vertexShader=`varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`;
const marchShader=`
  #include <packing>
  varying vec2 vUv;
  uniform sampler2D tDepth,tShadow;
  uniform mat4 uProjectionInverse,uCameraWorld,uShadowMatrix;
  uniform vec3 uSunDirection,uSunColor;
  uniform float uRange,uDensity,uIntensity,uBias,uUnder,uWaterSurface;
  void main(){
    float rawDepth=texture2D(tDepth,vUv).r;
    vec4 view=uProjectionInverse*vec4(vUv*2.-1.,rawDepth*2.-1.,1.);
    view.xyz/=view.w;
    float sceneDepth=max(0.,-view.z);
    vec3 origin=uCameraWorld[3].xyz;
    vec3 ray=normalize((uCameraWorld*vec4(view.xyz,0.)).xyz);
    float distance=min(length(view.xyz),uRange);
    // Keep an underwater shaft inside water when looking through the exit surface.
    // Scene depth additionally stops against the floor, shore and water side faces.
    if(uUnder>.5&&ray.y>.00001)distance=min(distance,max(0.,(uWaterSurface-origin.y)/ray.y));
    float stepLength=distance/float(RAY_STEPS);
    // Fixed spatial staggering: no frame counter or animated noise to shimmer.
    float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
    vec4 shadowOrigin=uShadowMatrix*vec4(origin,1.);
    vec4 shadowStep=uShadowMatrix*vec4(ray*stepLength,0.);
    float litLength=0.;
    for(int i=0;i<RAY_STEPS;i++){
      vec4 shadow=shadowOrigin+shadowStep*(float(i)+.15+jitter*.7);
      vec3 p=shadow.xyz/shadow.w;
      float border=min(min(min(p.x,p.y),p.z),min(min(1.-p.x,1.-p.y),1.-p.z));
      // Unknown space outside the actual caster map contributes no invented light.
      if(border>0.){
        float blocker=unpackRGBAToDepth(texture2D(tShadow,p.xy));
        float visible=step(p.z+uBias,blocker);
        litLength+=visible*smoothstep(0.,.055,border)*stepLength;
      }
    }
    // A gentle forward phase response, evaluated against the real sun direction.
    float cosine=dot(ray,uSunDirection),g=mix(.42,.52,uUnder);
    float phase=(1.-g*g)/(12.5663706*pow(max(.001,1.+g*g-2.*g*cosine),1.5));
    float scattering=min(mix(.060,.042,uUnder),(1.-exp(-uDensity*litLength))*phase*uIntensity);
    gl_FragColor=vec4(uSunColor*scattering,sceneDepth);
  }
`;

const blurShader=`
  varying vec2 vUv;
  uniform sampler2D tInput;
  uniform vec2 uTexel;
  void main(){
    vec4 center=texture2D(tInput,vUv);
    vec3 color=vec3(0.);float weight=0.;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
      vec4 sampleColor=texture2D(tInput,vUv+vec2(float(x),float(y))*uTexel);
      float spatial=(x==0?2.:1.)*(y==0?2.:1.);
      float difference=abs(sampleColor.a-center.a)/max(1.,center.a);
      float w=spatial*exp(-difference*difference*180.);
      color+=sampleColor.rgb*w;weight+=w;
    }
    gl_FragColor=vec4(color/max(weight,.0001),center.a);
  }
`;

// Used by the existing final composite. Exact low-resolution texel centers keep
// depth/color paired; interpolating depth first would leak light around leaves.
export const sunRayCompositeShader=`
  uniform sampler2D tSunRays,tSunDepth;
  uniform vec2 uSunRaySize,uSunNearFar;
  uniform float uSunRayStrength;
  vec3 sunRayColor(){
    float raw=texture2D(tSunDepth,vUv).r;
    float depth=(uSunNearFar.x*uSunNearFar.y)/(uSunNearFar.y-raw*(uSunNearFar.y-uSunNearFar.x));
    vec2 pixel=vUv*uSunRaySize-.5,base=floor(pixel),fraction=fract(pixel);
    vec3 total=vec3(0.);float weight=0.;
    for(int y=0;y<2;y++)for(int x=0;x<2;x++){
      vec2 corner=vec2(float(x),float(y));
      vec4 sampleColor=texture2D(tSunRays,(base+corner+.5)/uSunRaySize);
      vec2 spatial=mix(1.-fraction,fraction,corner);
      float difference=abs(sampleColor.a-depth)/max(1.,depth);
      float w=spatial.x*spatial.y*exp(-difference*difference*220.);
      total+=sampleColor.rgb*w;weight+=w;
    }
    return weight>.0001?total/weight:vec3(0.);
  }
`;

export function sunRaySettings(mobile=false){return {steps:mobile?16:24,range:mobile?24:32,waterRange:mobile?12:16,divisor:4};}
const finiteMatrix=matrix=>matrix?.elements?.length===16&&matrix.elements.every(Number.isFinite);

export class SunRays {
  constructor(renderer,{mobile=false,hdr=true}={}){
    this.renderer=renderer;this.mobile=mobile;this.hdr=hdr;this.quality='auto';
    this.underwater=false;this.daylight=1;this.strength=1;this.density=.007;
    this.valid=false;this.disposed=false;this.width=1;this.height=1;this.drawn=false;
    this.waterSurface=NaN;this.cameraY=0;this.lightColor=new THREE.Color();
    this.waterTint=new THREE.Color(.35,.78,.90);
    this.nearFar=new THREE.Vector2(.08,260);
    const target=name=>{
      const result=new THREE.WebGLRenderTarget(1,1,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,
        format:THREE.RGBAFormat,colorSpace:THREE.LinearSRGBColorSpace,
        minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
      result.texture.name=name;return result;
    };
    this.raw=target('Voxyz sun scattering');this.filtered=target('Voxyz filtered sun scattering');
    const settings=sunRaySettings(mobile);
    this.march=new THREE.ShaderMaterial({name:'Voxyz sun shadow marching',vertexShader,fragmentShader:marchShader,
      defines:{RAY_STEPS:settings.steps},depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,
      uniforms:{tDepth:{value:null},tShadow:{value:null},uProjectionInverse:{value:new THREE.Matrix4()},
        uCameraWorld:{value:new THREE.Matrix4()},uShadowMatrix:{value:new THREE.Matrix4()},
        uSunDirection:{value:new THREE.Vector3()},uSunColor:{value:new THREE.Color()},
        uRange:{value:settings.range},uDensity:{value:this.density},uIntensity:{value:0},uBias:{value:0},
        uUnder:{value:0},uWaterSurface:{value:0}}});
    this.blur=new THREE.ShaderMaterial({name:'Voxyz sun depth-aware blur',vertexShader,fragmentShader:blurShader,
      depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,
      uniforms:{tInput:{value:this.raw.texture},uTexel:{value:new THREE.Vector2(1,1)}}});
  }
  get enabled(){return !this.disposed&&this.valid&&this.hdr&&this.quality!=='low'&&this.daylight>.22&&this.strength>0&&
    (!this.underwater||(Number.isFinite(this.waterSurface)&&this.waterSurface>this.cameraY));}
  setWaterSurface(surface){this.waterSurface=Number.isFinite(surface)?surface:NaN;}
  setSun(camera,sun,direction){
    this.valid=false;
    const shadow=sun?.shadow,texture=shadow?.map?.texture,type=this.renderer.shadowMap?.type;
    if(this.disposed||!camera?.isPerspectiveCamera||!sun?.isDirectionalLight||!sun.castShadow||!sun.visible||
      this.renderer.shadowMap?.enabled===false||!texture?.isTexture||
      (type!==undefined&&type!==THREE.BasicShadowMap&&type!==THREE.PCFShadowMap&&type!==THREE.PCFSoftShadowMap)||
      !finiteMatrix(shadow.matrix)||!finiteMatrix(camera.matrixWorld)||!finiteMatrix(camera.projectionMatrixInverse)||
      !(camera.near>0&&camera.far>camera.near&&Number.isFinite(camera.far))||
      !direction?.isVector3||![direction.x,direction.y,direction.z,sun.intensity].every(Number.isFinite)||direction.lengthSq()<1e-12)return;
    const u=this.march.uniforms;
    u.tShadow.value=texture;u.uShadowMatrix.value.copy(shadow.matrix);
    u.uCameraWorld.value.copy(camera.matrixWorld);u.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
    u.uSunDirection.value.copy(direction).normalize();this.lightColor.copy(sun.color);
    u.uIntensity.value=Math.max(0,sun.intensity);u.uBias.value=Number.isFinite(shadow.bias)?shadow.bias:0;
    this.nearFar.set(camera.near,camera.far);this.cameraY=camera.matrixWorld.elements[13];this.valid=true;
  }
  resize(width,height){
    if(this.disposed)return;
    this.width=Math.max(1,Math.round(Number.isFinite(width)?width:1));
    this.height=Math.max(1,Math.round(Number.isFinite(height)?height:1));
    const settings=sunRaySettings(this.mobile),active=this.hdr&&this.quality!=='low';
    const w=active?Math.ceil(this.width/settings.divisor):1,h=active?Math.ceil(this.height/settings.divisor):1;
    this.raw.setSize(w,h);this.filtered.setSize(w,h);this.blur.uniforms.uTexel.value.set(1/w,1/h);
    if(this.march.defines.RAY_STEPS!==settings.steps){this.march.defines.RAY_STEPS=settings.steps;this.march.needsUpdate=true;}
    this.march.uniforms.uRange.value=settings.range;this.drawn=false;
  }
  render(depthTexture,draw){
    this.drawn=false;
    if(!this.enabled||!depthTexture?.isTexture)return false;
    const settings=sunRaySettings(this.mobile);
    this.march.uniforms.tDepth.value=depthTexture;
    this.march.uniforms.uDensity.value=THREE.MathUtils.clamp(this.density*(this.underwater?3:1),.0001,.035);
    this.march.uniforms.uRange.value=this.underwater?settings.waterRange:settings.range;
    this.march.uniforms.uUnder.value=this.underwater?1:0;
    this.march.uniforms.uWaterSurface.value=this.underwater?this.waterSurface:0;
    this.march.uniforms.uSunColor.value.copy(this.lightColor);
    if(this.underwater)this.march.uniforms.uSunColor.value.multiply(this.waterTint);
    draw(this.march,this.raw);draw(this.blur,this.filtered);this.drawn=true;return true;
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.valid=false;
    this.raw.dispose();this.filtered.dispose();this.march.dispose();this.blur.dispose();
  }
}
