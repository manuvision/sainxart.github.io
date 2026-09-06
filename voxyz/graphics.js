import * as THREE from './vendor/three.module.js';
import { BLOCK, CHUNK_SIZE, WORLD_HEIGHT, indexOf } from './terrain.js';

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
      this.data[offset]=y+.16+.7*((chunk.levels[index]||8)/8);
      this.data[offset+1]=bottom;this.data[offset+2]=1;this.data[offset+3]=1;
      return;
    }
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
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.12;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate=false;
    this.scene=new THREE.Scene();
    this.scene.fog=new THREE.FogExp2(0xaac6b5,.014);
    this.camera=new THREE.PerspectiveCamera(66,1,.08,260);
    this.time={value:0}; this.day={value:1};
    this.wetColumns=new WaterColumnMask(mobile?48:64,mobile?128:192);
    this.streamingFog=0;this.frameDt=1/60;this.lastTime=0;
    this.waterFrustum=new THREE.Frustum();this.viewProjection=new THREE.Matrix4();
    this.mirrorDirection=new THREE.Vector3();this.mirrorTarget=new THREE.Vector3();
    this.mirrorPlane=new THREE.Plane();this.mirrorNormal=new THREE.Vector3(0,1,0);
    this.clipPlane=new THREE.Vector4();this.clipCorner=new THREE.Vector4();
    this.waterVisible=false;this.waterPasses=0;this.reflectionReady=false;
    this.terrainMaterial=new THREE.MeshLambertMaterial({vertexColors:true});
    this.terrainMaterial.onBeforeCompile=shader=>{
      shader.uniforms.uVoxTime=this.time;shader.uniforms.uVoxDay=this.day;
      shader.uniforms.uWetColumns={value:this.wetColumns.texture};
      shader.uniforms.uWetOrigin={value:this.wetColumns.origin};
      shader.uniforms.uWetSize={value:this.wetColumns.size};
      shader.vertexShader='varying vec3 vVoxWorld; varying vec3 vVoxNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvVoxWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vVoxNormal=normalize(mat3(modelMatrix)*normal);');
      shader.fragmentShader='varying vec3 vVoxWorld;varying vec3 vVoxNormal;uniform float uVoxTime,uVoxDay,uWetSize;uniform sampler2D uWetColumns;uniform vec2 uWetOrigin;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec3 grainCell=floor(vVoxWorld*7.0);
        float grain=fract(sin(dot(grainCell,vec3(12.9898,78.233,39.425)))*43758.5453);
        diffuseColor.rgb*=.965+grain*.07;
        vec3 wetPoint=vVoxWorld+vVoxNormal*.035;
        vec2 wetUV=(wetPoint.xz-uWetOrigin)/uWetSize;
        vec3 wet=texture2D(uWetColumns,clamp(wetUV,vec2(0.0),vec2(1.0))).rgb;
        float wetDepth=wet.r-wetPoint.y;
        if(wet.b>.5&&wetDepth>0.0&&wetDepth<6.0&&wetPoint.y>=wet.g&&all(greaterThan(wetUV,vec2(0.0)))&&all(lessThan(wetUV,vec2(1.0)))){
          vec2 p=vVoxWorld.xz*2.5;
          float a=sin(p.x+sin(p.y*1.4+uVoxTime*.8))+sin(p.y+sin(p.x*1.2-uVoxTime*.7));
          float c=pow(1.0-abs(sin(a*2.8+uVoxTime*.4)),12.0);
          float wetEdge=min(min(wetUV.x,wetUV.y),min(1.0-wetUV.x,1.0-wetUV.y))*uWetSize;
          diffuseColor.rgb+=vec3(.13,.23,.16)*c*uVoxDay*exp(-wetDepth*.3)*smoothstep(0.0,4.0,wetEdge)*(1.0-smoothstep(5.0,6.0,wetDepth));
        }`);
    };
    this.fill=new THREE.HemisphereLight(0xc5dfd1,0x555333,1.65);this.scene.add(this.fill);
    this.sun=new THREE.DirectionalLight(0xffe4b2,3.2);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
    Object.assign(this.sun.shadow.camera,{left:-42,right:42,top:42,bottom:-42,near:1,far:180});
    this.sun.shadow.bias=-.00035;this.sun.shadow.normalBias=.06;this.sun.shadow.radius=2;
    this.scene.add(this.sun,this.sun.target);
    this.sunDirection=new THREE.Vector3(-.65,.64,-.35).normalize();
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(230,24,12),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uDay:this.day,uSun:{value:this.sunDirection}},vertexShader:`varying vec3 vDir; void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`varying vec3 vDir;uniform float uDay;uniform vec3 uSun;void main(){vec3 d=normalize(vDir);float h=max(0.0,d.y);vec3 top=mix(vec3(.013,.029,.075),vec3(.37,.65,.70),uDay);vec3 horizon=mix(vec3(.043,.079,.13),vec3(.83,.84,.65),uDay);vec3 col=mix(horizon,top,pow(h,.48));float sun=max(0.0,dot(d,uSun));col+=vec3(1.,.69,.31)*pow(sun,36.)*.33*uDay;col+=vec3(1.,.86,.58)*smoothstep(.9987,.9993,sun)*uDay*2.;float stars=step(.9989,fract(sin(dot(floor(d*550.),vec3(12.98,78.23,33.719)))*43758.5453));col+=stars*pow(1.-uDay,3.)*smoothstep(.05,.3,h);gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')}));
    this.sky.frustumCulled=false;this.scene.add(this.sky);
    this.refraction=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
    this.refraction.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    this.reflection=new THREE.WebGLRenderTarget(mobile?256:512,mobile?256:512,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
    this.mirrorCamera=this.camera.clone();this.reflectionMatrix=new THREE.Matrix4();
    this.waterMaterial=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,uniforms:{uTime:this.time,uDay:this.day,tScene:{value:this.refraction.texture},tDepth:{value:this.refraction.depthTexture},tReflection:{value:this.reflection.texture},uReflectionMatrix:{value:this.reflectionMatrix},uResolution:{value:new THREE.Vector2()},uNear:{value:.08},uFar:{value:260},uUnder:{value:0},uReflect:{value:1},uSun:{value:this.sunDirection}},vertexShader:`
      varying vec3 vWorld;varying vec3 vNormal;varying vec4 vReflect;uniform float uTime;uniform mat4 uReflectionMatrix;
      void main(){vec3 p=position;vec4 wp=modelMatrix*vec4(p,1.);vWorld=wp.xyz;vNormal=normal;vReflect=uReflectionMatrix*wp;gl_Position=projectionMatrix*viewMatrix*wp;}
    `,fragmentShader:`
      uniform sampler2D tScene,tDepth,tReflection;uniform float uTime,uDay,uNear,uFar,uUnder,uReflect;uniform vec2 uResolution;uniform vec3 uSun;varying vec3 vWorld,vNormal;varying vec4 vReflect;
      float viewDepth(float d){return (uNear*uFar)/((uFar-uNear)*d-uFar);}
      void main(){
        vec2 p=vWorld.xz;float t=uTime*.65;
        vec2 ripple=vec2(sin(p.x*4.4+p.y*2.3+t)+sin(p.y*8.1-t*1.5)*.4,cos(p.y*4.2-p.x*2.1+t*.9)+sin(p.x*7.7+t)*.4);
        vec3 n=normalize(vec3(ripple.x*.065,1.,ripple.y*.065));if(abs(vNormal.y)<.5)n=normalize(vNormal+vec3(ripple.x*.07,0.,ripple.y*.07));
        vec3 eye=normalize(cameraPosition-vWorld);float facing=abs(dot(n,eye));float fresnel=.045+.76*pow(1.-facing,4.);
        vec2 uv=gl_FragCoord.xy/uResolution;
        float floorZ=viewDepth(texture2D(tDepth,uv).x);float waterZ=viewDepth(gl_FragCoord.z);float depth=max(.0,waterZ-floorZ);
        vec2 distort=ripple*.001*min(depth,2.5);vec3 transmitted=texture2D(tScene,clamp(uv+distort,vec2(.002),vec2(.998))).rgb;
        vec3 tint=mix(vec3(.045,.20,.145),vec3(.009,.048,.062),clamp(depth*.1,0.,1.))*mix(.22,1.,uDay);
        transmitted=mix(transmitted,tint,1.-exp(-depth*.38));
        vec2 ruv=vReflect.xy/vReflect.w+ripple*.002;vec3 reflected=texture2D(tReflection,clamp(ruv,vec2(.001),vec2(.999))).rgb*.67;
        reflected=mix(vec3(.28,.49,.50)*mix(.15,1.,uDay),reflected,uReflect);
        vec3 col=mix(transmitted,reflected,fresnel*(1.-uUnder*.45));
        float spec=pow(max(0.,dot(reflect(-uSun,n),eye)),240.);col+=vec3(1.,.86,.56)*spec*1.2*uDay;
        float foam=(1.-smoothstep(.02,.35,depth))*(.4+.6*sin(p.x*9.+p.y*7.+t));col+=vec3(.43,.57,.41)*foam*.20*uDay;
        if(uUnder>.5){col=mix(col,vec3(.04,.29,.31),.17);col+=vec3(.13,.29,.23)*pow(facing,6.)*uDay;}
        float fog=1.-exp(-length(cameraPosition-vWorld)*.013);col=mix(col,mix(vec3(.03,.07,.12),vec3(.57,.71,.61),uDay),fog*.6);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
    this.rays=new THREE.Group();this.scene.add(this.rays);
    const rayMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{uDay:this.day},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float uDay;void main(){float a=pow(sin(vUv.x*3.14159),2.)*pow(sin(vUv.y*3.14159),1.5);gl_FragColor=vec4(.88,.83,.54,a*.045*uDay);}'});
    for(let i=0;i<7;i++){const r=new THREE.Mesh(new THREE.PlaneGeometry(1.4+i*.3,25),rayMat);r.position.set(-18+i*8,24,-18-i%3*8);r.rotation.z=-.45;r.rotation.y=.3;this.rays.add(r);}
    this.resize();window.addEventListener('resize',()=>this.resize());
  }
  resize(){const w=innerWidth,h=innerHeight;this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.mobile?1.5:1.5)*this.scale);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();const size=this.renderer.getDrawingBufferSize(new THREE.Vector2());this.waterMaterial?.uniforms.uResolution.value.copy(size);this.refraction.setSize(Math.max(1,Math.round(size.x*.65)),Math.max(1,Math.round(size.y*.65)));}
  setQuality(quality){this.quality=quality;this.scale=quality==='low'?.7:quality==='high'?1:this.mobile?.85:1;this.renderer.shadowMap.enabled=quality!=='low';this.waterMaterial.uniforms.uReflect.value=quality==='low'?0:1;this.resize();}
  update(time,daylight,position,underwater){
    this.frameDt=Math.max(1/240,Math.min(.1,time-this.lastTime));this.lastTime=time;
    this.time.value=time;this.day.value=daylight;this.sky.position.copy(position);
    this.sun.position.copy(position).addScaledVector(this.sunDirection,70);this.sun.target.position.copy(position);
    this.sun.intensity=.12+daylight*3.1;this.fill.intensity=.48+daylight*1.65;
    this.fill.color.setHex(daylight<.3?0x728daa:0xc2dcce);
    this.scene.fog.color.setHex(underwater?0x136463:0xa8c4b2).lerp(new THREE.Color(0x0d2237),1-daylight);
    this.scene.fog.density=underwater?.085:this.quality==='low'?.021:.0145;
    this.waterMaterial.uniforms.uUnder.value=underwater?1:0;
    this.rays.visible=daylight>.4&&!underwater;this.renderer.toneMappingExposure=1.02+daylight*.1;
  }
  _updateStreamingFog(world){
    const center=world.center||{x:Math.floor(this.camera.position.x/CHUNK_SIZE),z:Math.floor(this.camera.position.z/CHUNK_SIZE)};
    const radius=world.radius||4;let wanted=0,missing=0;
    for(let z=-radius;z<=radius;z++)for(let x=-radius;x<=radius;x++){
      if(x*x+z*z>(radius+.45)**2)continue;
      wanted++;if(!world.chunks.has(`${center.x+x},${center.z+z}`))missing++;
    }
    const target=.0022*missing/Math.max(1,wanted);
    const settle=target>this.streamingFog?.9:2.4;
    this.streamingFog+=(target-this.streamingFog)*(1-Math.exp(-this.frameDt/settle));
    if(this.waterMaterial.uniforms.uUnder.value<.5)this.scene.fog.density+=this.streamingFog;
  }
  _updateReflection(){
    const camera=this.camera,mirror=this.mirrorCamera;
    mirror.copy(camera);mirror.position.y=25.72-camera.position.y;
    camera.getWorldDirection(this.mirrorDirection);this.mirrorDirection.y*=-1;
    // Three's Water reflects the camera's rotated up vector as well as its
    // direction, preserving perspective when the viewer pitches the camera.
    mirror.up.set(0,1,0).applyQuaternion(camera.quaternion).reflect(this.mirrorNormal);
    mirror.lookAt(this.mirrorTarget.copy(mirror.position).add(this.mirrorDirection));mirror.updateMatrixWorld();
    this.reflectionMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1)
      .multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    // Clip below the pond after constructing the sampling matrix, following
    // examples/jsm/objects/Water.js. The small offset avoids surface seams.
    const plane=this.mirrorPlane.set(this.mirrorNormal,-12.82).applyMatrix4(mirror.matrixWorldInverse);
    const clip=this.clipPlane.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
    const p=mirror.projectionMatrix.elements;
    const q=this.clipCorner.set((Math.sign(clip.x)+p[8])/p[0],(Math.sign(clip.y)+p[9])/p[5],-1,(1+p[10])/p[14]);
    const denominator=clip.dot(q);
    if(Math.abs(denominator)<1e-6)return false;
    clip.multiplyScalar(2/denominator);p[2]=clip.x;p[6]=clip.y;p[10]=clip.z+1;p[14]=clip.w;
    mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
    this.renderer.setRenderTarget(this.reflection);this.renderer.render(this.scene,mirror);
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
      renderer.setRenderTarget(this.refraction);renderer.render(scene,camera);this.waterPasses++;
      if(this.quality!=='low'&&camera.position.y>12.9&&(!this.waterVisible||!this.reflectionReady||this.frame%5===1)){
        if(this._updateReflection())this.waterPasses++;
      }
      for(const mesh of water)mesh.visible=true;
    }
    this.waterVisible=visible;
    this.waterMaterial.uniforms.uReflect.value=this.quality!=='low'&&this.reflectionReady&&camera.position.y>12.9?1:0;
    renderer.setRenderTarget(null);renderer.render(scene,camera);
  }
}
