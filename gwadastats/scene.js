import * as THREE from '../water/vendor/three.module.min.js';
import { createGuadeloupeMap } from '../dlo/map.js?v=5';
import { PROFILE, RADIUS, radiusAtHeight, BottleVolume, SurfaceWaves, springStep } from '../dlo/liquid.js?v=2';

import { createSculptures } from './sculptures.js?v=1';

export function createWaterScene(container, {fraction, paused: initiallyPaused, onWaterline}) {
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio,1.75),2));
  renderer.transmissionResolutionScale=.5;
  renderer.setClearColor(0x08090b,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.95;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(28,1,.1,40);
  camera.position.set(0,1.85,8.25);camera.lookAt(0,.08,0);

  // A real reflected studio environment: broad softboxes, narrow edge lights, dark cards.
  const studio=new THREE.Scene();studio.background=new THREE.Color('#44464a');
  function panel(color,intensity,w,h,x,y,z){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide}));
    m.position.set(x,y,z);m.lookAt(0,0,0);studio.add(m);
  }
  panel('#ffffff',6,1.5,6,-3.5,2,3);
  panel('#ffffff',5,.9,6,3,1,2);
  panel('#ffffff',1.5,3,2,0,5,-1);
  panel('#ffffff',1.8,2,4,0,1,-4);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(studio,.035);
  scene.environment=environment.texture;
  scene.add(new THREE.HemisphereLight(0xffffff,0x16181c,.35));
  const key=new THREE.DirectionalLight(0xffffff,.6);key.position.set(-3,5,4);scene.add(key);
  const rim=new THREE.DirectionalLight(0xffffff,1);rim.position.set(4,2,-2);scene.add(rim);

  const archipelago=createGuadeloupeMap(THREE);
  archipelago.position.set(0,.15,-1.35);
  archipelago.rotation.set(.10,-.16,-.025);
  archipelago.scale.setScalar(.82);
  scene.add(archipelago);
  const {gun,wheel}=createSculptures(THREE);
  gun.scale.setScalar(.67);gun.position.set(-1.55,.08,0);gun.rotation.set(.02,-.25,-.10);
  wheel.scale.setScalar(.72);wheel.position.set(1.58,.05,0);wheel.rotation.set(.04,-.26,0);
  scene.add(gun,wheel);
  let sculptureTime=0,activeObject='bottle',gunTurn=0,wheelTurn=0;
  const bottle=new THREE.Group();scene.add(bottle);
  const waves=new SurfaceWaves(48),volume=new BottleVolume(64);
  const waveTexture=new THREE.DataTexture(waves.h,waves.size,waves.size,THREE.RedFormat,THREE.FloatType);
  waveTexture.minFilter=waveTexture.magFilter=THREE.NearestFilter;waveTexture.needsUpdate=true;
  const uniforms={uWaves:{value:waveTexture},uLevel:{value:0},uSlope:{value:new THREE.Vector2()},uWaveAmount:{value:1},uCameraLocal:{value:new THREE.Vector3()},uBottleRotation:{value:new THREE.Matrix3()}};
  const waterGLSL=`
    uniform sampler2D uWaves;
    uniform float uLevel;
    uniform vec2 uSlope;
    uniform float uWaveAmount;
    varying vec3 vBottlePosition;
    float sampleWave(vec2 p){
      vec2 st=clamp((p/0.66+1.)*.5,0.,1.)*47.;
      vec2 b=floor(st),f=fract(st);
      float a=texture2D(uWaves,(b+vec2(.5,.5))/48.).r;
      float c=texture2D(uWaves,(min(b+vec2(1.,0.),vec2(47.))+vec2(.5))/48.).r;
      float d=texture2D(uWaves,(min(b+vec2(0.,1.),vec2(47.))+vec2(.5))/48.).r;
      float e=texture2D(uWaves,(min(b+vec2(1.,1.),vec2(47.))+vec2(.5))/48.).r;
      return mix(mix(a,c,f.x),mix(d,e,f.x),f.y)*uWaveAmount;
    }
    float waterHeight(vec2 p){return uLevel-dot(uSlope,p)+sampleWave(p);}
  `;
  const radiusGLSL='float bottleRadius(float y){if(y< -1.60 || y>1.66)return 0.;'+PROFILE.slice(1).map(([y,r],i)=>{
    const [prevY,prevR]=PROFILE[i];
    return 'if(y<='+y.toFixed(5)+')return mix('+prevR.toFixed(5)+','+r.toFixed(5)+',(y-('+prevY.toFixed(5)+'))/'+(y-prevY).toFixed(5)+');';
  }).join('')+'return .23;}\n';
  // Dielectric optics cross both interfaces; no screen-space black refraction buffer.
  const opticsGLSL=`
    uniform vec3 uCameraLocal;
    uniform mat3 uBottleRotation;
    varying vec3 vLocalNormal;
    vec3 studioLight(vec3 d){
      d=normalize(uBottleRotation*d);
      float sky=.10+.16*smoothstep(-.7,.9,d.y);
      vec3 radiance=vec3(sky);
      radiance+=vec3(2.4)*pow(max(dot(d,normalize(vec3(-.8,.4,.55))),0.),38.);
      radiance+=vec3(1.4)*pow(max(dot(d,normalize(vec3(.9,.65,-.25))),0.),28.);
      radiance+=vec3(.7)*pow(max(dot(d,normalize(vec3(0.,1.,.2))),0.),24.);
      radiance+=vec3(4.)*pow(max(dot(d,normalize(vec3(-.7,.5,-1.))),0.),18.);
      radiance+=vec3(1.8)*pow(max(dot(d,normalize(vec3(.7,.1,-1.))),0.),14.);
      return radiance;
    }
    float liquidDistance(vec3 p){
      float side=length(p.xz)-bottleRadius(clamp(p.y,-1.6,1.66));
      return max(side,max(-1.6-p.y,p.y-(uLevel-dot(uSlope,p.xz))));
    }
    vec3 exitNormal(vec3 p){
      float e=.003;
      return normalize(vec3(
        liquidDistance(p+vec3(e,0.,0.))-liquidDistance(p-vec3(e,0.,0.)),
        liquidDistance(p+vec3(0.,e,0.))-liquidDistance(p-vec3(0.,e,0.)),
        liquidDistance(p+vec3(0.,0.,e))-liquidDistance(p-vec3(0.,0.,e))));
    }
  `;
  function liquidMaterial(isSurface=false){
    return new THREE.ShaderMaterial({
      uniforms,transparent:true,depthWrite:false,side:isSurface?THREE.DoubleSide:THREE.FrontSide,
      vertexShader:waterGLSL+`
        varying vec3 vLocalNormal;
        void main(){
          vec3 p=position;
          vLocalNormal=normal;
          `+(isSurface?`
            p.y=waterHeight(p.xz);
            float e=.012;
            vLocalNormal=normalize(vec3(
              -(waterHeight(p.xz+vec2(e,0.))-waterHeight(p.xz-vec2(e,0.)))/(2.*e),
              1.,-(waterHeight(p.xz+vec2(0.,e))-waterHeight(p.xz-vec2(0.,e)))/(2.*e)));
          `:'')+`
          vBottlePosition=p;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
      fragmentShader:waterGLSL+radiusGLSL+opticsGLSL+`
        void main(){
          `+(isSurface?`
            if(length(vBottlePosition.xz)>bottleRadius(vBottlePosition.y)||vBottlePosition.y< -1.60||vBottlePosition.y>1.66)discard;
          `:`if(vBottlePosition.y>waterHeight(vBottlePosition.xz))discard;`)+`
          vec3 incoming=normalize(vBottlePosition-uCameraLocal);
          vec3 N=normalize(vLocalNormal);
          if(dot(incoming,N)>0.)N=-N;
          float facing=max(dot(-incoming,N),0.);
          float fresnel=.02037+.97963*pow(1.-facing,5.);
          vec3 reflected=studioLight(reflect(incoming,N));
          vec3 direction=refract(incoming,N,1./1.333);
          vec3 point=vBottlePosition+direction*.012;
          float travel=0.;
          for(int j=0;j<38;j++){
            float stepLength=clamp(-liquidDistance(point),.018,.16);
            point+=direction*stepLength;travel+=stepLength;
            if(liquidDistance(point)>0.)break;
          }
          vec3 outNormal=exitNormal(point);
          vec3 outgoing=refract(direction,-outNormal,1.333);
          bool totalInternal=dot(outgoing,outgoing)<.001;
          if(totalInternal)outgoing=reflect(direction,-outNormal);
          vec3 transmitted=studioLight(outgoing);
          // Low optical density, neutral absorption, no opaque diffuse layer.
          vec3 through=mix(vec3(.025),transmitted,.44)*exp(-travel*.018);
          if(totalInternal)through=mix(through,studioLight(outgoing),.28);
          vec3 color=mix(through,reflected,fresnel);
          float rim=pow(1.-facing,3.);
          float alpha=clamp(${isSurface?'.32':'.18'}+fresnel*.65+rim*.08,.18,.94);
          gl_FragColor=vec4(color,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
  }
  const innerPoints=[new THREE.Vector2(0,-1.60),...PROFILE.map(([y,r])=>new THREE.Vector2(r,y)),new THREE.Vector2(0,1.66)];
  const innerGeometry=new THREE.LatheGeometry(innerPoints,192);
  const waterBody=new THREE.Mesh(innerGeometry,liquidMaterial());waterBody.renderOrder=2;bottle.add(waterBody);
  const surfaceGeometry=new THREE.PlaneGeometry(RADIUS*2,RADIUS*2,96,96);surfaceGeometry.rotateX(-Math.PI/2);
  const surface=new THREE.Mesh(surfaceGeometry,liquidMaterial(true));surface.renderOrder=3;surface.frustumCulled=false;bottle.add(surface);

  // Thin clear PET, with modeled grip bands and stronger reflections at grazing angles.
  const outerPoints=[new THREE.Vector2(0,-1.634),new THREE.Vector2(.49,-1.634)];
  for(let i=0;i<=360;i++){
    const y=-1.60+i/360*3.26;
    let r=radiusAtHeight(y)+.025;
    if(y>-.9&&y<1.46){
      const smoothRadius=(radiusAtHeight(y-.06)+2*radiusAtHeight(y-.03)+3*radiusAtHeight(y)+2*radiusAtHeight(y+.03)+radiusAtHeight(y+.06))/9;
      r=Math.max(radiusAtHeight(y)+.012,smoothRadius+.032);
    }
    if(y> -1.35&&y<.48){
      for(const band of [-1.16,-.89,-.62,-.35])r-=.016*Math.exp(-(((y-band)/.028)**2));
    }
    outerPoints.push(new THREE.Vector2(r,y));
  }
  outerPoints.push(new THREE.Vector2(0,1.66));
  const bodyGeometry=new THREE.LatheGeometry(outerPoints,192);
  // Thin PET contributes reflected light without an opaque diffuse coat.
  const plastic=new THREE.MeshPhysicalMaterial({color:0x000000,roughness:.035,metalness:0,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false,clearcoat:1,clearcoatRoughness:.025,envMapIntensity:2,side:THREE.FrontSide});
  const shell=new THREE.Mesh(bodyGeometry,plastic);shell.renderOrder=5;bottle.add(shell);
  const backPlastic=plastic.clone();backPlastic.side=THREE.BackSide;backPlastic.opacity=.15;
  const backShell=new THREE.Mesh(bodyGeometry,backPlastic);backShell.renderOrder=1;bottle.add(backShell);
  const collarMat=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.08,metalness:0,transparent:true,opacity:.28,depthWrite:false,clearcoat:1,envMapIntensity:1.4});
  for(const y of [1.49,1.55,1.61]){
    const collar=new THREE.Mesh(new THREE.TorusGeometry(.26,.016,10,96),collarMat);
    collar.rotation.x=Math.PI/2;collar.position.y=y;collar.renderOrder=6;bottle.add(collar);
  }
  const capGeometry=new THREE.LatheGeometry([
    new THREE.Vector2(0,1.64),new THREE.Vector2(.248,1.64),new THREE.Vector2(.27,1.66),
    new THREE.Vector2(.274,1.69),new THREE.Vector2(.274,1.86),new THREE.Vector2(.264,1.89),
    new THREE.Vector2(.235,1.901),new THREE.Vector2(0,1.901),
  ],384);
  const capPosition=capGeometry.attributes.position;
  for(let i=0;i<capPosition.count;i++){
    const x=capPosition.getX(i),y=capPosition.getY(i),z=capPosition.getZ(i),r=Math.hypot(x,z);
    if(r>.26&&y>1.67&&y<1.88){const scale=(r+.004*Math.cos(Math.atan2(z,x)*64))/r;capPosition.setX(i,x*scale);capPosition.setZ(i,z*scale);}
  }
  capGeometry.computeVertexNormals();
  const cap=new THREE.Mesh(capGeometry,new THREE.MeshPhysicalMaterial({color:0x25272b,roughness:.22,metalness:0,clearcoat:1,clearcoatRoughness:.16,envMapIntensity:1.4}));
  bottle.add(cap);
  const seal=new THREE.Mesh(new THREE.TorusGeometry(.259,.019,12,96),new THREE.MeshPhysicalMaterial({color:0x303236,roughness:.25,clearcoat:1}));
  seal.rotation.x=Math.PI/2;seal.position.y=1.62;bottle.add(seal);

  // Measurement marks are attached to the bottle, so turning it reveals its depth.
  const markMaterial=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.18,depthWrite:false});
  for(const share of [.25,.5,.75]){
    const y=volume.solve(share);
    const radius=radiusAtHeight(y)+.028;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.002,4,64,Math.PI*.19),markMaterial);
    ring.rotation.x=Math.PI/2;ring.rotation.z=-Math.PI*.095;ring.position.y=y;ring.renderOrder=7;bottle.add(ring);
  }
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(4.5,4.5),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 vUv;void main(){float d=length((vUv-.5)*2.);float a=exp(-d*d*10.)*.4;gl_FragColor=vec4(0.,0.,0.,a);}',
  }));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=-1.72;scene.add(shadow);

  let paused=initiallyPaused,disposed=false,frame=0,lastDraw=performance.now();
  let fill=fraction,yaw=-.28,pitch=.05,roll=-.08,targetYaw=yaw,targetPitch=pitch;
  let slopeX=.12,slopeZ=.03,velocityX=0,velocityZ=0;
  let spin=0,tiltSpeed=0,dragging=false,pointerId=null,previousX=0,previousY=0,lastPointer=0;
  const inverse=new THREE.Quaternion(),normal=new THREE.Vector3(),projected=new THREE.Vector3();
  const picker=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const onDown=e=>{
    if(e.button!==undefined&&e.button!==0)return;
    const rect=container.getBoundingClientRect();
    pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    picker.setFromCamera(pointer,camera);
    const hit=picker.intersectObjects([gun,wheel,bottle],true)[0];
    if(!hit)return;
    let selected=hit.object;while(selected.parent&&![gun,wheel,bottle].includes(selected))selected=selected.parent;
    activeObject=selected===gun?'gun':selected===wheel?'wheel':'bottle';
    dragging=true;pointerId=e.pointerId;previousX=e.clientX;previousY=e.clientY;lastPointer=performance.now();spin=0;tiltSpeed=0;
    container.setPointerCapture(e.pointerId);container.focus({preventScroll:true});
  };
  const onMove=e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    const now=performance.now(),dt=Math.max(.012,(now-lastPointer)/1000),dx=e.clientX-previousX,dy=e.clientY-previousY;
    if(activeObject==='gun'){gunTurn+=dx*.009;previousX=e.clientX;previousY=e.clientY;lastPointer=now;return;}
    if(activeObject==='wheel'){wheelTurn+=dx*.009;previousX=e.clientX;previousY=e.clientY;lastPointer=now;return;}
    targetYaw+=dx*.008;targetPitch=THREE.MathUtils.clamp(targetPitch+dy*.007,-.72,.72);
    spin=THREE.MathUtils.clamp(dx*.006/dt,-3,3);tiltSpeed=THREE.MathUtils.clamp(dy*.004/dt,-2,2);
    velocityX+=THREE.MathUtils.clamp(-dx*.015,-.32,.32);
    velocityZ+=THREE.MathUtils.clamp(dy*.012,-.3,.3);
    if(!paused)waves.impulse(Math.sin(targetYaw)*.35,Math.cos(targetYaw)*.3,Math.min(.6,Math.hypot(dx,dy)*.012));
    previousX=e.clientX;previousY=e.clientY;lastPointer=now;
  };
  const onUp=e=>{
    if(e.pointerId!==pointerId)return;
    dragging=false;if(container.hasPointerCapture(e.pointerId))container.releasePointerCapture(e.pointerId);
    pointerId=null;
  };
  const onCancel=()=>{if(pointerId===null)return;dragging=false;pointerId=null;spin=0;tiltSpeed=0;};
  const onKey=e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','r','R'].includes(e.key))return;
    e.preventDefault();
    if(e.key==='ArrowLeft'){targetYaw-=.24;velocityX-=.5;}
    if(e.key==='ArrowRight'){targetYaw+=.24;velocityX+=.5;}
    if(e.key==='ArrowUp'){targetPitch=Math.max(-.72,targetPitch-.16);velocityZ-=.5;}
    if(e.key==='ArrowDown'){targetPitch=Math.min(.72,targetPitch+.16);velocityZ+=.5;}
    if(e.key.toLowerCase()==='r'){gunTurn=wheelTurn=0;targetYaw=-.28;targetPitch=.05;spin=0;tiltSpeed=0;waves.clear();}
  };
  for(const [name,handler] of Object.entries({pointerdown:onDown,pointermove:onMove,pointerup:onUp,pointercancel:onCancel,lostpointercapture:onCancel,keydown:onKey}))container.addEventListener(name,handler);

  function update(dt){
    if(!paused)sculptureTime+=dt;
    gun.rotation.y=-.25+gunTurn+Math.sin(sculptureTime*.35)*.12;
    gun.rotation.z=-.10+Math.sin(sculptureTime*.45)*.025;
    wheel.rotation.y=-.26+wheelTurn+Math.sin(sculptureTime*.33)*.12;
    wheel.rotation.z=sculptureTime*.075;
    if(!paused){
      if(!dragging){targetYaw+=spin*dt;spin*=Math.exp(-4*dt);tiltSpeed*=Math.exp(-5*dt);}
      [slopeX,velocityX]=springStep(slopeX,velocityX,0,dt);
      [slopeZ,velocityZ]=springStep(slopeZ,velocityZ,0,dt);
      slopeX=THREE.MathUtils.clamp(slopeX,-.35,.35);slopeZ=THREE.MathUtils.clamp(slopeZ,-.35,.35);
      waves.stepForward(dt,true);waveTexture.needsUpdate=true;
    }
    const smooth=paused?1:1-Math.exp(-14*dt);
    yaw+=(targetYaw-yaw)*smooth;pitch+=(targetPitch-pitch)*smooth;
    const wantedRoll=-.06+(dragging?THREE.MathUtils.clamp(spin*.035,-.15,.15):0);
    roll+=(wantedRoll-roll)*smooth;
    bottle.rotation.set(pitch,yaw,roll,'YXZ');
    bottle.position.y=.035+Math.abs(pitch)*.17+Math.abs(roll)*.12;
    bottle.updateMatrixWorld();
    uniforms.uCameraLocal.value.copy(camera.position);bottle.worldToLocal(uniforms.uCameraLocal.value);
    uniforms.uBottleRotation.value.setFromMatrix4(bottle.matrixWorld);
    inverse.copy(bottle.quaternion).invert();
    normal.set(-slopeX,1,-slopeZ).normalize().applyQuaternion(inverse);
    const ny=Math.max(.30,normal.y);
    uniforms.uSlope.value.set(normal.x/ny,normal.z/ny);
    const offset=volume.solve(fill,normal.x/ny,normal.z/ny,waves);
    uniforms.uLevel.value=offset;
    waterBody.visible=surface.visible=fill>.000015;
    projected.set(.4,offset,0).applyMatrix4(bottle.matrixWorld).project(camera);
    const rect=container.getBoundingClientRect(),parent=container.parentElement.getBoundingClientRect();
    onWaterline?.(THREE.MathUtils.clamp((rect.top-parent.top+(1-projected.y)*.5*rect.height-14)/parent.height,.12,.76));
    container.dataset.volumeFraction=volume.fraction.toFixed(6);
    container.dataset.rotation=yaw.toFixed(3)+','+pitch.toFixed(3);
    container.dataset.waveAmplitude=waves.h.reduce((max,x)=>Math.max(max,Math.abs(x)),0).toFixed(5);
  }
  function resize(){
    const {width,height}=container.getBoundingClientRect();if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;
    const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    camera.position.set(0,1.3,Math.max(5.45/(2*tangent*camera.aspect),4.05/(2*tangent)));
    camera.lookAt(0,.08,0);
    const mapViewWidth=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*(camera.position.z-archipelago.position.z)*camera.aspect;
    archipelago.scale.setScalar(Math.min(.76,mapViewWidth*.82/5.01));
    camera.updateProjectionMatrix();update(1/60);renderer.render(scene,camera);
  }
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  function draw(now){
    if(disposed)return;
    const dt=Math.min((now-lastDraw)/1000,.5);
    if(!document.hidden&&now-lastDraw>1000/60-1){update(dt);renderer.render(scene,camera);lastDraw=now;}
    frame=requestAnimationFrame(draw);
  }
  if(!paused){waves.impulse(.18,0,.7);waves.impulse(-.18,0,-.4);}
  frame=requestAnimationFrame(draw);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('graphics-status').hidden=false;paused=true;});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{document.getElementById('graphics-status').hidden=true;paused=matchMedia('(prefers-reduced-motion: reduce)').matches;resize();});
  return {
    setFill(value){fill=THREE.MathUtils.clamp(value,0,1);},
    setPaused(value){paused=value;if(value){waves.clear();slopeX=slopeZ=velocityX=velocityZ=0;spin=0;waveTexture.needsUpdate=true;}},
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();for(const [name,handler] of Object.entries({pointerdown:onDown,pointermove:onMove,pointerup:onUp,pointercancel:onCancel,lostpointercapture:onCancel,keydown:onKey}))container.removeEventListener(name,handler);const geometries=new Set(),materials=new Set();for(const root of [scene,studio])root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());environment.dispose();pmrem.dispose();waveTexture.dispose();renderer.dispose();renderer.domElement.remove();},
  };
}

