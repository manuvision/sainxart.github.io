import * as THREE from './vendor/three.module.js';
import { BLOCK, CHUNK_SIZE, WORLD_HEIGHT, indexOf } from './terrain.js?v=3.6';
import { waterCellHeight } from './water.js?v=3.6';
import { createTerrainMaterial, createForestEnvironment } from './surface-material.js?v=3.6';
import { PostProcessing } from './post-processing.js?v=3.6';

// One texel per nearby terrain column: exposed surface, contiguous water bottom,
// and presence. Reading loaded arrays keeps this work independent of generation.
export class WaterColumnMask {
  constructor(size=64, budget=192) {
    this.size=size;this.budget=budget;this.origin=new THREE.Vector2(Infinity,Infinity);
    this.data=new Float32Array(size*size*4);this.scratch=new Float32Array(this.data.length);
    this.texture=new THREE.DataTexture(this.data,size,size,THREE.RGBAFormat,THREE.FloatType);
    this.texture.minFilter=this.texture.magFilter=THREE.NearestFilter;
    this.texture.generateMipmaps=false;this.texture.needsUpdate=true;
    this.queue=new Uint16Array(size*size);this.queued=new Uint8Array(size*size);
    this.order=Array.from({length:size*size},(_,i)=>i).sort((a,b)=>{
      const distance=i=>(i%size-size/2)**2+(Math.floor(i/size)-size/2)**2;
      return distance(a)-distance(b);
    });
    this.head=0;this.tail=0;this.count=0;this.seen=new Map();this.world=null;
  }
  _queue(i) {
    if(this.queued[i])return;
    this.queued[i]=1;this.queue[this.tail]=i;this.tail=(this.tail+1)%this.queue.length;this.count++;
  }
  _move(x,z,reset) {
    const size=this.size,dx=x-this.origin.x,dz=z-this.origin.y;
    this.scratch.fill(0);
    if(!reset&&Math.abs(dx)<size&&Math.abs(dz)<size) {
      const width=size-Math.abs(dx),sourceX=Math.max(0,dx),targetX=Math.max(0,-dx);
      for(let iz=Math.max(0,-dz);iz<Math.min(size,size-dz);iz++) {
        const from=((iz+dz)*size+sourceX)*4,to=(iz*size+targetX)*4;
        this.scratch.set(this.data.subarray(from,from+width*4),to);
      }
    }
    this.data.set(this.scratch);this.origin.set(x,z);this.seen.clear();
    this.head=0;this.tail=0;this.count=0;this.queued.fill(0);
    for(const i of this.order)this._queue(i);
    this.texture.needsUpdate=true;
  }
  _sample(world,i) {
    const x=this.origin.x+i%this.size,z=this.origin.y+Math.floor(i/this.size);
    const cx=Math.floor(x/CHUNK_SIZE),cz=Math.floor(z/CHUNK_SIZE),chunk=world.chunks.get(`${cx},${cz}`);
    const offset=i*4;this.data.fill(0,offset,offset+4);
    if(!chunk)return;
    const lx=x-cx*CHUNK_SIZE,lz=z-cz*CHUNK_SIZE;
    for(let y=WORLD_HEIGHT-1;y>=0;y--) {
      const index=indexOf(lx,y,lz);
      if(chunk.blocks[index]!==BLOCK.WATER)continue;
      const above=y+1<WORLD_HEIGHT?chunk.blocks[indexOf(lx,y+1,lz)]:BLOCK.AIR;
      // A sealed water column has no exposed surface to focus sunlight through.
      if(above!==BLOCK.AIR&&above!==BLOCK.GLASS&&above!==BLOCK.TORCH)return;
      let bottom=y;
      while(bottom>0&&chunk.blocks[indexOf(lx,bottom-1,lz)]===BLOCK.WATER)bottom--;
      this.data[offset]=y+waterCellHeight(chunk.levels[index]||8);
      this.data[offset+1]=bottom;this.data[offset+2]=1;this.data[offset+3]=1;
      return;
    }
  }
  surfaceAt(position) {
    const x=Math.floor(position.x)-this.origin.x,z=Math.floor(position.z)-this.origin.y;
    if(x<0||z<0||x>=this.size||z>=this.size||!Number.isFinite(x+z))return null;
    const i=(z*this.size+x)*4;
    return this.data[i+2]>.5&&position.y>=this.data[i+1]&&position.y<this.data[i]?this.data[i]:null;
  }
  proximityAt(position,radius=10) {
    if(!Number.isFinite(this.origin.x+this.origin.y+position.x+position.y+position.z)||radius<=0)return 0;
    const minX=Math.max(0,Math.floor(position.x-radius)-this.origin.x),maxX=Math.min(this.size-1,Math.floor(position.x+radius)-this.origin.x);
    const minZ=Math.max(0,Math.floor(position.z-radius)-this.origin.y),maxZ=Math.min(this.size-1,Math.floor(position.z+radius)-this.origin.y);
    let nearest=radius*radius;
    // Reuse the bounded loaded-column cache: sound must not generate terrain or
    // follow an invisible biome-wide water bed, and altitude attenuates it too.
    for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
      const i=(z*this.size+x)*4;if(this.data[i+2]<.5||position.y<this.data[i+1]-.75)continue;
      const wx=this.origin.x+x,wz=this.origin.y+z;
      const dx=Math.max(wx-position.x,0,position.x-wx-1),dz=Math.max(wz-position.z,0,position.z-wz-1);
      const dy=Math.max(this.data[i+1]-position.y,0,position.y-this.data[i]);
      nearest=Math.min(nearest,dx*dx+dy*dy+dz*dz);
    }
    return 1-THREE.MathUtils.smoothstep(Math.sqrt(nearest),1.25,radius);
  }
  update(world,position) {
    const size=this.size,x=Math.floor(position.x/8)*8-size/2,z=Math.floor(position.z/8)*8-size/2;
    const reset=world!==this.world;this.world=world;
    if(reset||x!==this.origin.x||z!==this.origin.y)this._move(x,z,reset);
    const minX=Math.floor(x/CHUNK_SIZE),maxX=Math.floor((x+size-1)/CHUNK_SIZE);
    const minZ=Math.floor(z/CHUNK_SIZE),maxZ=Math.floor((z+size-1)/CHUNK_SIZE);
    for(let cz=minZ;cz<=maxZ;cz++)for(let cx=minX;cx<=maxX;cx++) {
      const key=`${cx},${cz}`,chunk=world.chunks.get(key),revision=world.revisions?.get(key)||0,seen=this.seen.get(key);
      if(seen&&seen.chunk===chunk&&seen.revision===revision)continue;
      this.seen.set(key,{chunk,revision});
      for(let iz=Math.max(z,cz*CHUNK_SIZE);iz<Math.min(z+size,(cz+1)*CHUNK_SIZE);iz++)
        for(let ix=Math.max(x,cx*CHUNK_SIZE);ix<Math.min(x+size,(cx+1)*CHUNK_SIZE);ix++)this._queue((iz-z)*size+ix-x);
    }
    let sampled=0;
    while(this.count&&sampled<this.budget) {
      const i=this.queue[this.head];this.head=(this.head+1)%this.queue.length;this.count--;this.queued[i]=0;
      this._sample(world,i);sampled++;
    }
    if(sampled)this.texture.needsUpdate=true;
    return sampled;
  }
}

export class Graphics {
  constructor(canvas, mobile) {
    this.mobile=mobile; this.frame=0; this.scale=mobile?.85:1; this.quality='auto';
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    // Linear HDR throughout the scene and water passes; the final pass maps it once.
    this.renderer.toneMapping=THREE.NoToneMapping;
    this.renderer.toneMappingExposure=1;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate=false;
    this.scene=new THREE.Scene();
    // Gentle distance haze leaves the nearby material colors clear.
    this.scene.fog=new THREE.Fog(0xaac6b5,36,mobile?88:120);
    this.camera=new THREE.PerspectiveCamera(66,1,.08,260);
    this.time={value:0}; this.day={value:1};
    this.wetColumns=new WaterColumnMask(mobile?48:64,mobile?128:192);
    this.streamingFog=0;this.frameDt=1/60;this.lastTime=0;
    this.waterFrustum=new THREE.Frustum();this.viewProjection=new THREE.Matrix4();
    this.mirrorDirection=new THREE.Vector3();this.mirrorTarget=new THREE.Vector3();
    this.mirrorPlane=new THREE.Plane();this.mirrorNormal=new THREE.Vector3(0,1,0);
    this.clipPlane=new THREE.Vector4();this.clipCorner=new THREE.Vector4();
    this.waterVisible=false;this.waterPasses=0;this.reflectionReady=false;
    this.reflectionPosition=new THREE.Vector3(Infinity,Infinity,Infinity);this.reflectionRotation=new THREE.Quaternion();
    this.reflectionAspect=0;this.reflectionFov=0;this.reflectionUnder=false;this.reflectionClearColor=new THREE.Color();
    this.terrainMaterial=createTerrainMaterial({time:this.time,day:this.day,wetColumns:this.wetColumns});
    this.post=new PostProcessing(this.renderer,{mobile});
    if(this.post.hdr){this.environment=createForestEnvironment(this.renderer);this.scene.environment=this.environment.texture;}
    this.scene.environmentIntensity=.18;
    this.fill=new THREE.HemisphereLight(0xd2e0df,0xa39c83,1.65);this.scene.add(this.fill);
    this.sun=new THREE.DirectionalLight(0xffe1af,3.4);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
    Object.assign(this.sun.shadow.camera,{left:-42,right:42,top:42,bottom:-42,near:1,far:180});
    this.sun.shadow.bias=-.00035;this.sun.shadow.normalBias=.06;this.sun.shadow.radius=mobile?3:6;this.sun.shadow.intensity=.94;
    this.scene.add(this.sun,this.sun.target);
    this.sunDirection=new THREE.Vector3(-.55,.48,.42).normalize();
    this.shadowRight=new THREE.Vector3(this.sunDirection.z,0,-this.sunDirection.x).normalize();
    this.shadowUp=new THREE.Vector3().crossVectors(this.sunDirection,this.shadowRight);
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(230,24,12),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uDay:this.day,uSun:{value:this.sunDirection}},vertexShader:`varying vec3 vDir; void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`varying vec3 vDir;uniform float uDay;uniform vec3 uSun;void main(){vec3 d=normalize(vDir);float h=max(0.0,d.y);vec3 top=mix(vec3(.013,.029,.075),vec3(.055,.22,.35),uDay);vec3 horizon=mix(vec3(.043,.079,.13),vec3(.42,.58,.57),uDay);vec3 col=mix(horizon,top,pow(h,.48));float sun=max(0.0,dot(d,uSun));col+=vec3(1.,.69,.31)*pow(sun,36.)*.33*uDay;col+=vec3(1.,.86,.58)*smoothstep(.9987,.9993,sun)*uDay*2.;float stars=step(.9989,fract(sin(dot(floor(d*550.),vec3(12.98,78.23,33.719)))*43758.5453));col+=stars*pow(1.-uDay,3.)*smoothstep(.05,.3,h);gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')}));
    this.sky.frustumCulled=false;this.scene.add(this.sky);
    this.refraction=new THREE.WebGLRenderTarget(1,1,{type:this.post.hdr?THREE.HalfFloatType:THREE.UnsignedByteType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
    this.refraction.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    // Resolve subpixel canopy edges before water samples them. The final screen
    // FXAA cannot reconstruct detail already aliased inside a reflection texture.
    this.reflection=new THREE.WebGLRenderTarget(1,1,{type:this.post.hdr?THREE.HalfFloatType:THREE.UnsignedByteType,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:true});
    this.reflection.texture.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());
    this.refraction.texture.colorSpace=this.reflection.texture.colorSpace=THREE.LinearSRGBColorSpace;
    this.mirrorCamera=this.camera.clone();this.reflectionMatrix=new THREE.Matrix4();
    this.waterMaterial=new THREE.ShaderMaterial({transparent:true,fog:true,side:THREE.DoubleSide,uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),uTime:this.time,uDay:this.day,tScene:{value:this.refraction.texture},tDepth:{value:this.refraction.depthTexture},tReflection:{value:this.reflection.texture},uReflectionMatrix:{value:this.reflectionMatrix},uResolution:{value:new THREE.Vector2()},uNear:{value:.08},uFar:{value:260},uUnder:{value:0},uReflect:{value:1},uSun:{value:this.sunDirection},
      tSunShadow:{value:null},uSunShadowMatrix:{value:new THREE.Matrix4()},uSunShadowTexel:{value:new THREE.Vector2(1,1)},uSunShadowBias:{value:0},uSunShadowReady:{value:0}},vertexShader:`
      #include <fog_pars_vertex>
      varying vec3 vWorld;varying vec3 vNormal;varying vec4 vReflect;uniform float uTime;uniform mat4 uReflectionMatrix;
      void main(){vec3 p=position;vec4 wp=modelMatrix*vec4(p,1.);vWorld=wp.xyz;vNormal=normal;vReflect=uReflectionMatrix*wp;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }
    `,fragmentShader:`
      #include <fog_pars_fragment>
      #include <packing>
      uniform sampler2D tScene,tDepth,tReflection;uniform float uTime,uDay,uNear,uFar,uUnder,uReflect;uniform vec2 uResolution;uniform vec3 uSun;uniform mat4 uReflectionMatrix;varying vec3 vWorld,vNormal;varying vec4 vReflect;
      uniform sampler2D tSunShadow;uniform mat4 uSunShadowMatrix;uniform vec2 uSunShadowTexel;uniform float uSunShadowBias,uSunShadowReady;
      float viewDepth(float d){return (uNear*uFar)/((uFar-uNear)*d-uFar);}
      float sunVisibility(vec3 position){
        if(uSunShadowReady<.5)return 0.;
        vec4 light=uSunShadowMatrix*vec4(position,1.);vec3 p=light.xyz/light.w;
        float border=min(min(p.x,p.y),min(1.-p.x,1.-p.y));
        if(border<=0.||p.z<0.||p.z>1.)return 0.;
        float compare=p.z+uSunShadowBias;
        vec2 d=uSunShadowTexel;
        float visibility=step(compare,unpackRGBAToDepth(texture2D(tSunShadow,p.xy)))*.4;
        visibility+=step(compare,unpackRGBAToDepth(texture2D(tSunShadow,p.xy+vec2(d.x,d.y))))*.15;
        visibility+=step(compare,unpackRGBAToDepth(texture2D(tSunShadow,p.xy+vec2(-d.x,d.y))))*.15;
        visibility+=step(compare,unpackRGBAToDepth(texture2D(tSunShadow,p.xy+vec2(d.x,-d.y))))*.15;
        visibility+=step(compare,unpackRGBAToDepth(texture2D(tSunShadow,p.xy-d)))*.15;
        return visibility*smoothstep(0.,.025,border);
      }
      void main(){
        vec2 p=vWorld.xz;float t=uTime;
        // Two slow capillary scales: reflection stays readable instead of melting.
        vec2 ripple=vec2(sin(p.x*.78+p.y*.52+t*.64)+sin(p.y*2.6-t*.85)*.23,cos(p.y*.72-p.x*.47+t*.53)+sin(p.x*2.4+t*.73)*.23);
        bool surface=abs(vNormal.y)>.5;
        vec3 n=normalize(vNormal+vec3(ripple.x*.026,0.,ripple.y*.026));
        if(!surface)n=normalize(vNormal+vec3(ripple.x*.022,0.,ripple.y*.022));
        // Analytic capillary detail is anchored in world space. Filter it out
        // before its wavelength becomes subpixel; vertices never move.
        float detailFade=1.-smoothstep(.18,.65,length(fwidth(p)));
        vec2 capillary=vec2(dot(p,vec2(.85,.526))*4.+t*.42,dot(p,vec2(-.45,.893))*2.75-t*.31);
        if(surface&&uUnder<.5)n=normalize(n+vec3(cos(capillary.x),0.,cos(capillary.y))*.011*detailFade);
        vec3 eye=normalize(cameraPosition-vWorld);float facing=abs(dot(n,eye));
        // The underwater view favors a clear window at every angle. Reflection
        // is intentionally reserved for viewing the water from above.
        float fresnel=uUnder>.5?0.:.0204+.9796*pow(1.-facing,5.);
        vec2 uv=gl_FragCoord.xy/uResolution;
        float floorZ=viewDepth(texture2D(tDepth,uv).x);float waterZ=viewDepth(gl_FragCoord.z);float depth=max(.0,waterZ-floorZ);
        float depthEdge=max(abs(dFdx(floorZ)),abs(dFdy(floorZ)));
        float distortionScale=uUnder>.5?.0048:.00065;
        vec2 distort=ripple*distortionScale*min(depth,2.0)*(1.-smoothstep(.12,.6,depthEdge));
        vec2 refractedUV=clamp(uv+distort,vec2(.002),vec2(.998));
        // Don't pull foreground shore pixels into water at refracted silhouettes.
        float candidateDepth=viewDepth(texture2D(tDepth,refractedUV).x);
        refractedUV=mix(uv,refractedUV,smoothstep(0.,.10,waterZ-candidateDepth));
        vec3 transmitted=texture2D(tScene,refractedUV).rgb;
        float opticalDepth=uUnder>.5?min(length(cameraPosition-vWorld),12.):min(depth,surface?28.:3.5);
        vec3 extinction=uUnder>.5?vec3(.15,.065,.028):vec3(.52,.26,.20);
        vec3 absorption=exp(-extinction*opticalDepth);
        vec3 tint=vec3(.009,.061,.058)*mix(.18,1.,uDay);
        transmitted=transmitted*absorption+tint*(1.-absorption);
        float shallow=1.-smoothstep(.30,2.5,depth);
        if(surface&&uUnder<.5){
          // A thin layer still reads as blue-green water over bright ground.
          // Keep the underlying floor visible without a white shoreline overlay.
          vec3 shallowTint=vec3(.009,.078,.10)*mix(.18,1.,uDay);
          transmitted=mix(transmitted,shallowTint,.035+.135*shallow);
          float rippleBand=pow(.5+.5*sin(capillary.x+.24*sin(capillary.y)),5.);
          transmitted+=vec3(.004,.015,.018)*rippleBand*shallow*detailFade*uDay;
        }
        // Project a small world-space surface displacement through the same
        // mirror camera. Screen-aligned UV offsets used to swim as the view turned.
        vec4 rippledReflect=vReflect+(uReflectionMatrix[0]*ripple.x+uReflectionMatrix[2]*ripple.y)*.025;
        vec2 ruv=rippledReflect.xy/rippledReflect.w;
        vec3 reflected=texture2D(tReflection,clamp(ruv,vec2(.001),vec2(.999)),.4).rgb;
        vec3 reflectionDir=reflect(-eye,n);
        // These are linear radiance values, not display RGB. The previous pale
        // fallback washed out every shallow pool without a planar reflection.
        vec3 reflectedSky=mix(vec3(.10,.18,.18),vec3(.045,.14,.205),smoothstep(0.,.7,reflectionDir.y))*mix(.08,1.,uDay);
        // One planar pass belongs to the natural pond level. Other elevations
        // use the sky rather than displaying a physically misplaced reflection.
        float pondPlane=(1.-smoothstep(.025,.13,abs(vWorld.y-12.875)))*(surface?1.:0.);
        float reflectionEdge=min(min(ruv.x,ruv.y),min(1.-ruv.x,1.-ruv.y));
        float inReflection=smoothstep(0.,.018,reflectionEdge)*step(0.,vReflect.w);
        reflected=mix(reflectedSky,reflected*.82,uReflect*pondPlane*inReflection);
        vec3 col=mix(transmitted,reflected,fresnel);
        if(uUnder>.5){
          // A rippled blue interface remains visible without becoming a mirror.
          // The tint grows gently at grazing angles while scenery stays readable.
          float film=.12+.12*pow(1.-facing,2.);
          vec3 waterFilm=vec3(.018,.12,.20)*mix(.12,1.,uDay);
          col=mix(col*vec3(.92,.98,1.04),waterFilm,film);
          float rippleLight=pow(.5+.5*sin(p.x*.78+p.y*.52+t*.64),10.);
          col+=vec3(.008,.016,.025)*rippleLight*uDay;
        }
        float normalVariance=max(dot(dFdx(n),dFdx(n)),dot(dFdy(n),dFdy(n)));
        float specPower=340./(1.+340.*normalVariance);
        float spec=pow(max(0.,dot(reflect(-uSun,n),eye)),specPower)*(specPower/340.);
        // The sun disk in the real reflection is already occluded by geometry;
        // its procedural surface glint must obey the same canopy shadows.
        if(uUnder<.5&&spec>.0001)col+=vec3(1.,.84,.57)*spec*2.1*uDay*sunVisibility(vWorld);
        if(!surface){
          float streak=pow(.5+.5*sin((vWorld.x+vWorld.z)*23.+sin(vWorld.y*2.5+t*5.)),9.);
          vec3 streakTint=uUnder>.5?vec3(.24,.34,.30)*.16:vec3(.08,.19,.22)*.065;
          col+=streakTint*streak*mix(.2,1.,uDay);
        }
        gl_FragColor=vec4(col,1.);
        if(uUnder<.5){
          #include <fog_fragment>
        }
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
    this.resize();window.addEventListener('resize',()=>this.resize());
  }
  resize(){const w=innerWidth,h=innerHeight;this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.mobile?1.5:1.5)*this.scale);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();const size=this.renderer.getDrawingBufferSize(new THREE.Vector2());this.post.mobile=this.mobile;this.post.resize(size.x,size.y);this.waterMaterial?.uniforms.uResolution.value.copy(size);this.refraction.setSize(Math.max(1,Math.round(size.x*.65)),Math.max(1,Math.round(size.y*.65)));this._resizeReflection(size.x,size.y);}
  _resizeReflection(width,height){
    const ratio=Math.min(.5,(this.mobile?512:1024)/Math.max(width,height));
    const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
    const samples=Math.min(this.mobile?2:4,this.renderer.capabilities.maxSamples);
    if(this.reflection.width===w&&this.reflection.height===h&&this.reflection.samples===samples)return;
    this.reflection.dispose();this.reflection.samples=samples;this.reflection.setSize(w,h);
    // Resizing destroys the old image even when the camera pose is unchanged.
    this.reflectionReady=false;
  }
  setQuality(quality){this.quality=quality;this.post.setQuality(quality);this.scale=quality==='low'?.7:quality==='high'?1:this.mobile?.85:1;this.renderer.shadowMap.enabled=quality!=='low';this.waterMaterial.uniforms.uReflect.value=quality==='low'?0:1;this.resize();}
  update(time,daylight,position,underwater){
    this.frameDt=Math.max(1/240,Math.min(.1,time-this.lastTime));this.lastTime=time;
    this.time.value=time;this.day.value=daylight;this.sky.position.copy(position);
    // Snap in light space, so refreshing the map cannot shift a stationary
    // shadow by a fraction of a texel as the player walks.
    const texel=84/this.sun.shadow.mapSize.x,sx=position.dot(this.shadowRight),sy=position.dot(this.shadowUp);
    this.sun.target.position.copy(position).addScaledVector(this.shadowRight,Math.round(sx/texel)*texel-sx).addScaledVector(this.shadowUp,Math.round(sy/texel)*texel-sy);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDirection,70);
    this.sun.intensity=.10+daylight*3.2;this.fill.intensity=.16+daylight*.76;
    this.scene.environmentIntensity=.035+daylight*.195;
    this.fill.color.setHex(daylight<.3?0x728daa:0xd2e0df);
    this.scene.fog.color.setHex(underwater?0x136463:0xa3b5aa).lerp(new THREE.Color(0x0d2237),1-daylight);
    this.scene.fog.near=underwater?0:this.mobile?32:44;
    this.scene.fog.far=underwater?27:this.mobile?88:120;
    this.waterMaterial.uniforms.uUnder.value=underwater?1:0;
    this.post.exposure=1.0+daylight*.18;this.post.setUnderwater(underwater);this.post.setDaylight(daylight);
  }
  _updateStreamingFog(world){
    const center=world.center||{x:Math.floor(this.camera.position.x/CHUNK_SIZE),z:Math.floor(this.camera.position.z/CHUNK_SIZE)};
    const radius=world.radius||4;let wanted=0,missing=0;
    for(let z=-radius;z<=radius;z++)for(let x=-radius;x<=radius;x++){
      if(x*x+z*z>(radius+.45)**2)continue;
      wanted++;if(!world.chunks.has(`${center.x+x},${center.z+z}`))missing++;
    }
    const target=10*missing/Math.max(1,wanted);
    const settle=target>this.streamingFog?.9:2.4;
    this.streamingFog+=(target-this.streamingFog)*(1-Math.exp(-this.frameDt/settle));
    if(this.waterMaterial.uniforms.uUnder.value<.5)this.scene.fog.far-=this.streamingFog;
  }
  _updateWaterShadow(){
    const uniforms=this.waterMaterial.uniforms,shadow=this.sun.shadow,map=shadow?.map,type=this.renderer.shadowMap.type;
    uniforms.uSunShadowReady.value=0;uniforms.tSunShadow.value=null;
    if(!this.renderer.shadowMap.enabled||!this.sun.castShadow||!this.sun.visible||!map?.texture?.isTexture||
      !(map.width>0&&map.height>0)||!shadow.matrix.elements.every(Number.isFinite)||
      ![THREE.BasicShadowMap,THREE.PCFShadowMap,THREE.PCFSoftShadowMap].includes(type))return;
    // Snapshot the matrix paired with the last rendered map, not the current
    // moving light pose. The refraction pass has refreshed it when necessary.
    uniforms.tSunShadow.value=map.texture;uniforms.uSunShadowMatrix.value.copy(shadow.matrix);
    const radius=THREE.MathUtils.clamp(shadow.radius||1,1,3);
    uniforms.uSunShadowTexel.value.set(radius/map.width,radius/map.height);
    uniforms.uSunShadowBias.value=Number.isFinite(shadow.bias)?shadow.bias:0;
    uniforms.uSunShadowReady.value=1;
  }
  _updateReflection(){
    if(this.waterMaterial.uniforms.uUnder.value>.5)return false;
    const camera=this.camera,mirror=this.mirrorCamera;
    mirror.copy(camera);mirror.position.y=25.75-camera.position.y;
    camera.getWorldDirection(this.mirrorDirection);this.mirrorDirection.y*=-1;
    // Three's Water reflects the camera's rotated up vector as well as its
    // direction, preserving perspective when the viewer pitches the camera.
    mirror.up.set(0,1,0).applyQuaternion(camera.quaternion).reflect(this.mirrorNormal);
    mirror.lookAt(this.mirrorTarget.copy(mirror.position).add(this.mirrorDirection));mirror.updateMatrixWorld();
    this.reflectionMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1)
      .multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    // Clip below the pond after constructing the sampling matrix, following
    // examples/jsm/objects/Water.js. The small offset avoids surface seams.
    const bias=Math.min(.04,Math.abs(camera.position.y-12.875)*.5);
    const plane=this.mirrorPlane.setComponents(0,1,0,-12.875+bias).applyMatrix4(mirror.matrixWorldInverse);
    const clip=this.clipPlane.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
    const p=mirror.projectionMatrix.elements;
    const q=this.clipCorner.set((Math.sign(clip.x)+p[8])/p[0],(Math.sign(clip.y)+p[9])/p[5],-1,(1+p[10])/p[14]);
    const denominator=clip.dot(q);
    if(Math.abs(denominator)<1e-6)return false;
    clip.multiplyScalar(2/denominator);p[2]=clip.x;p[6]=clip.y;p[10]=clip.z+1;p[14]=clip.w;
    mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
    const skyVisible=this.sky.visible,clearAlpha=this.renderer.getClearAlpha();
    this.renderer.getClearColor(this.reflectionClearColor);
    try{
      this.renderer.setRenderTarget(this.reflection);this.renderer.render(this.scene,mirror);
    }finally{this.sky.visible=skyVisible;this.renderer.setClearColor(this.reflectionClearColor,clearAlpha);}
    this.reflectionUnder=false;
    this.reflectionPosition.copy(camera.position);this.reflectionRotation.copy(camera.quaternion);
    this.reflectionAspect=camera.aspect;this.reflectionFov=camera.fov;
    this.reflectionReady=true;return true;
  }
  render(world){
    const renderer=this.renderer,scene=this.scene,camera=this.camera;this.frame++;
    if(this.wetColumns.world!==world)this.reflectionReady=false;
    this.wetColumns.update(world,camera.position);this._updateStreamingFog(world);
    camera.updateMatrixWorld();
    this.waterFrustum.setFromProjectionMatrix(this.viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    const water=[];let visible=false;
    for(const chunk of world.chunks.values()){
      const mesh=chunk.waterMesh;
      if(!mesh?.visible||!mesh.geometry.attributes.position?.count||mesh.geometry.index?.count===0)continue;
      water.push(mesh);
      if(!visible){mesh.updateWorldMatrix(true,false);visible=this.waterFrustum.intersectsObject(mesh);}
    }
    if(this.frame%10===1)renderer.shadowMap.needsUpdate=true;
    this.waterPasses=0;
    if(visible){
      for(const mesh of water)mesh.visible=false;
      const fogNear=scene.fog.near,fogFar=scene.fog.far;
      try{
        // Above-water geometry is seen through only the camera-to-surface water
        // path. Applying underwater fog here as well would cloud the window twice.
        if(this.waterMaterial.uniforms.uUnder.value>.5){scene.fog.near=10000;scene.fog.far=20000;}
        renderer.setRenderTarget(this.refraction);renderer.render(scene,camera);this.waterPasses++;
      }finally{scene.fog.near=fogNear;scene.fog.far=fogFar;}
      const under=this.waterMaterial.uniforms.uUnder.value>.5;
      // Wind and wildlife move even between mouse events. A consistent visible
      // cadence avoids switching reflected motion between full rate and 1/8 rate.
      if(!under&&this.quality!=='low'&&Math.abs(camera.position.y-12.875)>.006){
        if(this._updateReflection())this.waterPasses++;
      }
      for(const mesh of water)mesh.visible=true;
    }
    this.waterVisible=visible;
    this.waterMaterial.uniforms.uReflect.value=this.waterMaterial.uniforms.uUnder.value<.5&&this.quality!=='low'&&this.reflectionReady?THREE.MathUtils.smoothstep(Math.abs(camera.position.y-12.875),.006,.035):0;
    this._updateWaterShadow();
    renderer.setRenderTarget(this.post.target);renderer.render(scene,camera);this.sceneStats={...renderer.info.render};
    // The view model writes only its near depth, preserving the world depth
    // elsewhere. It never enters either water capture, and participates in bloom.
    this.heldItem?.render(renderer,this.post.target);
    // Snapshot the shadow matrix only after rendering; its cached map and matrix
    // must describe the same light pose between scheduled shadow refreshes.
    this.post.setSun(camera,this.sun,this.sunDirection);
    this.post.setWaterSurface(this.wetColumns.surfaceAt(camera.position));
    this.post.render();
  }
}
