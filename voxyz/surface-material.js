import * as THREE from './vendor/three.module.js';

// Terrain, swaying kelp and swimming fish sample the same world-space light field.
// The column mask limits this to exposed, contiguous water; dry fragments perform
// one inexpensive lookup and skip the moving line pattern entirely.
export function attachWaterCaustics(material, {time,day,wetColumns}) {
  const previous=material.onBeforeCompile,programKey=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer) {
    previous.call(this,shader,renderer);
    Object.assign(shader.uniforms,{
      uWaterTime:time,uWaterDay:day,uWaterColumns:{value:wetColumns.texture},
      uWaterOrigin:{value:wetColumns.origin},uWaterSize:{value:wetColumns.size},
    });
    shader.vertexShader='varying vec3 vWaterWorld,vWaterNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec4 waterWorldPosition=vec4(transformed,1.0);
      #ifdef USE_BATCHING
        waterWorldPosition=batchingMatrix*waterWorldPosition;
      #endif
      #ifdef USE_INSTANCING
        waterWorldPosition=instanceMatrix*waterWorldPosition;
      #endif
      vWaterWorld=(modelMatrix*waterWorldPosition).xyz;
      vWaterNormal=normalize(inverseTransformDirection(transformedNormal,viewMatrix));
    `);
    shader.fragmentShader=`
      varying vec3 vWaterWorld,vWaterNormal;
      uniform float uWaterTime,uWaterDay,uWaterSize;
      uniform sampler2D uWaterColumns;uniform vec2 uWaterOrigin;
      vec2 waterCausticLight(vec3 worldPoint,vec3 worldNormal) {
        float daylight=smoothstep(.12,.70,uWaterDay);
        vec3 wetPoint=worldPoint+worldNormal*.035;
        vec2 wetUV=(wetPoint.xz-uWaterOrigin)/uWaterSize;
        if(any(lessThanEqual(wetUV,vec2(0.0)))||any(greaterThanEqual(wetUV,vec2(1.0))))return vec2(0.0);
        vec3 wet=texture2D(uWaterColumns,wetUV).rgb;
        float wetDepth=wet.r-wetPoint.y;
        if(wet.b<.5||wetDepth<=0.0||wetDepth>=7.0||wetPoint.y<wet.g)return vec2(0.0);
        float wetness=smoothstep(0.0,.25,wetDepth);
        if(daylight<=0.0)return vec2(wetness,0.0);
        vec2 p=worldPoint.xz*2.15;
        float a=sin(p.x+sin(p.y*1.4+uWaterTime*.65))+sin(p.y+sin(p.x*1.2-uWaterTime*.57));
        float b=sin(p.y*.87+sin(p.x*1.55-uWaterTime*.42))+sin(p.x*.92+sin(p.y*1.35+uWaterTime*.55));
        float caustic=pow(1.0-abs(sin(a*2.8+uWaterTime*.24)),15.0)*.65+pow(1.0-abs(sin(b*2.5)),18.0)*.35;
        float edge=min(min(wetUV.x,wetUV.y),min(1.0-wetUV.x,1.0-wetUV.y))*uWaterSize;
        float surfaceFade=smoothstep(0.0,.08,wetDepth);
        float light=caustic*daylight*exp(-wetDepth*.24)*smoothstep(0.0,4.0,edge)*(1.0-smoothstep(6.0,7.0,wetDepth))*surfaceFade;
        return vec2(wetness,light);
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 waterLight=waterCausticLight(vWaterWorld,normalize(vWaterNormal));
      float isWet=waterLight.x;
      diffuseColor.rgb*=1.0-isWet*.09;
      totalEmissiveRadiance+=vec3(.24,.40,.36)*waterLight.y;
    `);
  };
  material.customProgramCacheKey=()=>`${programKey}|shared-water-caustics-v1`;
  material.needsUpdate=true;
  return material;
}

// A small, seamless material field shared by every chunk. It is generated once,
// sampled in world space, and mipmapped so texture never crawls with the camera.
export function createSurfaceTexture() {
  const size=128,data=new Uint8Array(size*size*4);
  const hash=(x,y)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  const noise=(x,y,period,periodY=period)=>{
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
    const sample=(a,b)=>hash((a%period+period)%period,(b%periodY+periodY)%periodY);
    return (sample(ix,iy)*(1-u)+sample(ix+1,iy)*u)*(1-v)+(sample(ix,iy+1)*(1-u)+sample(ix+1,iy+1)*u)*v;
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const i=(y*size+x)*4,u=x/size,v=y/size;
    const broad=noise(u*8,v*8,8),fine=noise(u*32,v*32,32),grain=hash(x,y);
    const fibers=noise(u*48,v*4,48,4),split=Math.pow(Math.max(0,Math.sin(u*Math.PI*32+broad*2)),10);
    data[i]=Math.round((broad*.62+fine*.27+grain*.11)*255);
    data[i+1]=Math.round(Math.max(0,Math.min(1,.25+fibers*.65-split*.16))*255);
    data[i+2]=Math.round((fine*.8+grain*.2)*255);
    data[i+3]=Math.round(grain*255);
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

export function createForestEnvironment(renderer) {
  const width=128,height=64,data=new Float32Array(width*height*4);
  const zenith=new THREE.Color('#c0dce3'),horizon=new THREE.Color('#f5e1bb'),ground=new THREE.Color('#879280'),color=new THREE.Color();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const elevation=-Math.cos(y/(height-1)*Math.PI);
    color.copy(horizon).lerp(elevation>0?zenith:ground,Math.pow(Math.abs(elevation),.48));
    const i=(y*width+x)*4;data[i]=color.r;data[i+1]=color.g;data[i+2]=color.b;data[i+3]=1;
  }
  const source=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);
  source.mapping=THREE.EquirectangularReflectionMapping;source.colorSpace=THREE.LinearSRGBColorSpace;source.needsUpdate=true;
  const generator=new THREE.PMREMGenerator(renderer),environment=generator.fromEquirectangular(source);
  source.dispose();generator.dispose();return environment;
}

export function createTerrainMaterial({time,day,wetColumns}) {
  const field=createSurfaceTexture();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:0});
  material.onBeforeCompile=shader=>{
    shader.uniforms.uSurfaceField={value:field};
    shader.vertexShader='attribute float blockType; varying float vBlockType;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvBlockType=blockType;');
    shader.fragmentShader=`varying float vBlockType;uniform sampler2D uSurfaceField;\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 face=abs(vWaterNormal);
      vec2 surfaceUV=face.y>.5?vWaterWorld.xz:(face.x>.5?vWaterWorld.zy:vWaterWorld.xy);
      vec4 field=texture2D(uSurfaceField,surfaceUV);
      float materialGrain=(field.r-.5)*.24+(field.a-.5)*.055;
      float relief=(field.r-.5)*.045;
      bool leaf=(vBlockType>5.5&&vBlockType<6.5)||(vBlockType>12.5&&vBlockType<13.5);
      bool wood=vBlockType>4.5&&vBlockType<5.5;
      bool torch=vBlockType>9.5&&vBlockType<10.5;
      if(vBlockType>.5&&vBlockType<1.5){
        if(face.y<.5){
          float turf=smoothstep(.71+field.r*.13,.83+field.r*.08,fract(vWaterWorld.y));
          diffuseColor.rgb=mix(vec3(.265,.173,.102)*(.82+field.r*.34),diffuseColor.rgb,turf);
        }
        materialGrain=(field.r-.5)*.36;relief*=.6;
      }else if(wood||torch){
        float bark=field.g;
        if(wood&&face.y>.5){vec2 ring=fract(surfaceUV)-.5;float phase=length(ring)*76.+field.r*3.;bark=.45+.2*sin(phase)*(1.-smoothstep(.6,2.5,fwidth(phase)));}
        materialGrain=(bark-.5)*(torch?.16:.28);
        relief=(bark-.5)*(torch?.004:.014);
        // The amber torch palette belongs to its flame. Its separate wooden
        // post uses a dry brown albedo while retaining baked vertex shading.
        if(torch)diffuseColor.rgb=vec3(.32,.14,.05)*diffuseColor.r;
        else diffuseColor.rgb*=mix(vec3(1.0),vec3(1.04,1.0,.95),field.r*.25);
      }else if(vBlockType>2.5&&vBlockType<3.5){
        materialGrain=(field.r-.5)*.42+(field.b-.5)*.12;relief*=1.8;
        diffuseColor.rgb*=mix(vec3(.94,.97,1.02),vec3(1.07,1.035,.95),field.r);
      }else if(vBlockType>3.5&&vBlockType<4.5){
        materialGrain=(field.r-.5)*.13+(field.a-.5)*.10;relief*=.28;
      }else if(leaf){
        vec2 leafCell=floor(surfaceUV*7.0);
        float leafRandom=fract(sin(dot(leafCell,vec2(127.1,311.7)))*43758.5453);
        vec2 leafUV=fract(surfaceUV*7.0)-vec2(.36+.28*leafRandom,.64-.28*leafRandom);
        float leafDistance=length(leafUV*vec2(.76+leafRandom*.26,1.2-leafRandom*.24));
        float leafPlate=1.-smoothstep(.30,.49,leafDistance);
        float leafDetail=1.-smoothstep(.16,.55,max(fwidth(surfaceUV.x),fwidth(surfaceUV.y))*7.0);
        materialGrain=(field.r-.5)*.26+(field.b-.5)*.08+(leafPlate-.48)*.18*leafDetail;
        relief=(leafPlate-.5)*.012*leafDetail+(field.r-.5)*.01;
        diffuseColor.rgb*=mix(vec3(.84,.94,.90),vec3(1.12,1.06,.92),field.r);
      }else if(vBlockType>7.5&&vBlockType<8.5){materialGrain*=.25;relief*=.3;}
      diffuseColor.rgb*=1.0+materialGrain;

    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(roughnessFactor,.65,isWet);
      if(wood||torch)roughnessFactor=mix(.99,.90,isWet);
      if(vBlockType>13.5&&vBlockType<14.5)roughnessFactor=.24;
      if(leaf)roughnessFactor=.84;
    `);
    // Derivative bump is bounded and fades at a distance through the mip chain.
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
      vec3 rx=cross(dy,normal),ry=cross(normal,dx);
      float determinant=dot(dx,rx);
      vec3 gradient=sign(determinant)*(dFdx(relief)*rx+dFdy(relief)*ry);
      normal=normalize(abs(determinant)*normal-gradient);
    `);
  };
  material.customProgramCacheKey=()=> 'voxyz-surface-v3';
  attachWaterCaustics(material,{time,day,wetColumns});
  material.addEventListener('dispose',()=>field.dispose());
  return material;
}
