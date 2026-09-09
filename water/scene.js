import * as THREE from './vendor/three.module.min.js';
import { PROFILE, RADIUS, radiusAtHeight, BottleVolume, SurfaceWaves, springStep } from './liquid.js?v=2';

export function createWaterScene(container, {fraction, paused: initiallyPaused, onWaterline}) {
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
  renderer.transmissionResolutionScale=.5;
  renderer.setClearColor(0xf4f6f8,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.95;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(32,1,.1,40);
  camera.position.set(0,.45,8.25);camera.lookAt(0,.08,0);

  // A real reflected studio environment: broad softboxes, narrow edge lights, dark cards.
  const studio=new THREE.Scene();studio.background=new THREE.Color('#4b6272');
  function panel(color,intensity,w,h,x,y,z){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide}));
    m.position.set(x,y,z);m.lookAt(0,0,0);studio.add(m);
  }
  panel('#ffffff',4.5,3,6,-3.5,2,3);
  panel('#ffffff',3.5,1.2,6,3,1,2);
  panel('#dceeff',2,4,3,0,5,-1);
  panel('#ffffff',2,4,4,0,1,-4);
  panel('#203746',.35,1.8,5,-2,0,-1.8);
  panel('#243746',.25,.75,6,2,0,3.3);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(studio,.035);
  scene.environment=environment.texture;
  scene.add(new THREE.HemisphereLight(0xe9f8ff,0xb8c6d0,.8));
  const key=new THREE.DirectionalLight(0xffffff,1.5);key.position.set(-3,5,4);scene.add(key);
  const rim=new THREE.DirectionalLight(0xd5ecff,1);rim.position.set(4,2,-2);scene.add(rim);

  const bottle=new THREE.Group();scene.add(bottle);
  const waves=new SurfaceWaves(48),volume=new BottleVolume(64);
  const waveTexture=new THREE.DataTexture(waves.h,waves.size,waves.size,THREE.RedFormat,THREE.FloatType);
  waveTexture.minFilter=waveTexture.magFilter=THREE.NearestFilter;waveTexture.needsUpdate=true;
  const uniforms={uWaves:{value:waveTexture},uLevel:{value:0},uSlope:{value:new THREE.Vector2()},uWaveAmount:{value:1}};
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
  function liquidMaterial(surface=false){
    const mat=new THREE.MeshPhysicalMaterial({
      color:surface?0x87bfd6:0x66b8d6,roughness:surface?.035:.06,metalness:0,
      transmission:.86,thickness:1.15,ior:1.333,attenuationColor:new THREE.Color('#3180a3'),
      attenuationDistance:1.1,envMapIntensity:1,clearcoat:.3,clearcoatRoughness:.04,
      side:surface?THREE.DoubleSide:THREE.FrontSide,
    });
    mat.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=waterGLSL+shader.vertexShader;
      shader.fragmentShader=waterGLSL+radiusGLSL+shader.fragmentShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',surface?
        'vec3 transformed=vec3(position.x,waterHeight(position.xz),position.z);vBottlePosition=transformed;':
        '#include <begin_vertex>\nvBottlePosition=transformed;');
      if(surface)shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nfloat e=.015;objectNormal=normalize(vec3(-(waterHeight(position.xz+vec2(e,0.))-waterHeight(position.xz-vec2(e,0.)))/(2.*e),1.,-(waterHeight(position.xz+vec2(0.,e))-waterHeight(position.xz-vec2(0.,e)))/(2.*e)));');
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\n'+(surface?
          'if(length(vBottlePosition.xz)>bottleRadius(vBottlePosition.y)||vBottlePosition.y< -1.60||vBottlePosition.y>1.66)discard;':
          'if(vBottlePosition.y>waterHeight(vBottlePosition.xz))discard;'));
    };
    mat.customProgramCacheKey=()=>surface?'water-surface-v2':'water-volume-v2';
    return mat;
  }
  const innerPoints=[new THREE.Vector2(0,-1.60),...PROFILE.map(([y,r])=>new THREE.Vector2(r,y)),new THREE.Vector2(0,1.66)];
  const innerGeometry=new THREE.LatheGeometry(innerPoints,80);
  const waterBody=new THREE.Mesh(innerGeometry,liquidMaterial());bottle.add(waterBody);
  const surfaceGeometry=new THREE.PlaneGeometry(RADIUS*2,RADIUS*2,64,64);surfaceGeometry.rotateX(-Math.PI/2);
  const surface=new THREE.Mesh(surfaceGeometry,liquidMaterial(true));surface.frustumCulled=false;bottle.add(surface);

  // Thin clear PET, with modeled grip bands and stronger reflections at grazing angles.
  const outerPoints=[new THREE.Vector2(0,-1.634),new THREE.Vector2(.49,-1.634)];
  for(let i=0;i<=160;i++){
    const y=-1.60+i/160*3.26;
    let r=radiusAtHeight(y)+.025;
    if(y> -1.35&&y<.48){
      for(const band of [-1.16,-.89,-.62,-.35])r-=.016*Math.exp(-(((y-band)/.028)**2));
    }
    outerPoints.push(new THREE.Vector2(r,y));
  }
  outerPoints.push(new THREE.Vector2(0,1.66));
  const bodyGeometry=new THREE.LatheGeometry(outerPoints,96);
  const plastic=new THREE.MeshPhysicalMaterial({color:0x9aabb2,roughness:.045,metalness:.4,transparent:true,opacity:.20,depthWrite:false,clearcoat:1,clearcoatRoughness:.035,envMapIntensity:1,side:THREE.FrontSide});
  plastic.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
      'diffuseColor.a=.12+.76*pow(1.-abs(dot(normal,normalize(vViewPosition))),2.);\n#include <opaque_fragment>');
  };
  const shell=new THREE.Mesh(bodyGeometry,plastic);shell.renderOrder=5;bottle.add(shell);
  const backPlastic=plastic.clone();backPlastic.side=THREE.BackSide;backPlastic.opacity=.065;
  const backShell=new THREE.Mesh(bodyGeometry,backPlastic);backShell.renderOrder=4;bottle.add(backShell);
  const collarMat=new THREE.MeshPhysicalMaterial({color:0xd8e8ed,roughness:.10,metalness:.04,transparent:true,opacity:.6,depthWrite:false,clearcoat:1,envMapIntensity:1.7});
  for(const y of [1.49,1.55,1.61]){
    const collar=new THREE.Mesh(new THREE.TorusGeometry(.26,.016,10,96),collarMat);
    collar.rotation.x=Math.PI/2;collar.position.y=y;collar.renderOrder=6;bottle.add(collar);
  }
  const capGeometry=new THREE.LatheGeometry([
    new THREE.Vector2(0,1.64),new THREE.Vector2(.248,1.64),new THREE.Vector2(.27,1.66),
    new THREE.Vector2(.274,1.69),new THREE.Vector2(.274,1.86),new THREE.Vector2(.264,1.89),
    new THREE.Vector2(.235,1.901),new THREE.Vector2(0,1.901),
  ],192);
  const capPosition=capGeometry.attributes.position;
  for(let i=0;i<capPosition.count;i++){
    const x=capPosition.getX(i),y=capPosition.getY(i),z=capPosition.getZ(i),r=Math.hypot(x,z);
    if(r>.26&&y>1.67&&y<1.88){const scale=(r+.004*Math.cos(Math.atan2(z,x)*64))/r;capPosition.setX(i,x*scale);capPosition.setZ(i,z*scale);}
  }
  capGeometry.computeVertexNormals();
  const cap=new THREE.Mesh(capGeometry,new THREE.MeshPhysicalMaterial({color:0xf7fafb,roughness:.22,metalness:.02,clearcoat:1,clearcoatRoughness:.16,envMapIntensity:1.4}));
  bottle.add(cap);
  const seal=new THREE.Mesh(new THREE.TorusGeometry(.259,.019,12,96),new THREE.MeshPhysicalMaterial({color:0xf0f6f8,roughness:.25,clearcoat:1}));
  seal.rotation.x=Math.PI/2;seal.position.y=1.62;bottle.add(seal);

  // Measurement marks are attached to the bottle, so turning it reveals its depth.
  const markMaterial=new THREE.MeshBasicMaterial({color:0x7098aa,transparent:true,opacity:.36,depthWrite:false});
  for(const share of [.25,.5,.75]){
    const y=volume.solve(share);
    const radius=radiusAtHeight(y)+.028;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.002,4,64,Math.PI*.19),markMaterial);
    ring.rotation.x=Math.PI/2;ring.rotation.z=-Math.PI*.095;ring.position.y=y;ring.renderOrder=7;bottle.add(ring);
  }
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(4.5,4.5),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 vUv;void main(){float d=length((vUv-.5)*2.);float a=exp(-d*d*10.)*.16;gl_FragColor=vec4(.24,.35,.43,a);}',
  }));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=-1.72;scene.add(shadow);

  let paused=initiallyPaused,disposed=false,frame=0,lastDraw=performance.now();
  let fill=fraction,yaw=-.28,pitch=.05,roll=-.08,targetYaw=yaw,targetPitch=pitch;
  let slopeX=.12,slopeZ=.03,velocityX=0,velocityZ=0;
  let spin=0,tiltSpeed=0,dragging=false,pointerId=null,startX=0,startY=0,previousX=0,previousY=0,lastPointer=0,moved=0;
  const inverse=new THREE.Quaternion(),normal=new THREE.Vector3(),projected=new THREE.Vector3();
  const onDown=e=>{
    if(e.button!==undefined&&e.button!==0)return;
    dragging=true;pointerId=e.pointerId;startX=previousX=e.clientX;startY=previousY=e.clientY;lastPointer=performance.now();moved=0;spin=0;tiltSpeed=0;
    container.setPointerCapture(e.pointerId);container.focus({preventScroll:true});
  };
  const onMove=e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    const now=performance.now(),dt=Math.max(.012,(now-lastPointer)/1000),dx=e.clientX-previousX,dy=e.clientY-previousY;
    moved+=Math.abs(dx)+Math.abs(dy);
    targetYaw+=dx*.008;targetPitch=THREE.MathUtils.clamp(targetPitch+dy*.007,-.72,.72);
    spin=THREE.MathUtils.clamp(dx*.006/dt,-3,3);tiltSpeed=THREE.MathUtils.clamp(dy*.004/dt,-2,2);
    velocityX+=THREE.MathUtils.clamp(-dx*.015,-.32,.32);
    velocityZ+=THREE.MathUtils.clamp(dy*.012,-.3,.3);
    if(!paused)waves.impulse(Math.sin(targetYaw)*.35,Math.cos(targetYaw)*.3,Math.min(.6,Math.hypot(dx,dy)*.012));
    previousX=e.clientX;previousY=e.clientY;lastPointer=now;
  };
  function splash(){
    if(paused)return;
    waves.impulse(.22,-.12,2.5);waves.impulse(-.2,.14,-1.4);velocityX+=.7;velocityZ-=.35;
  }
  const onUp=e=>{
    if(e.pointerId!==pointerId)return;
    dragging=false;if(container.hasPointerCapture(e.pointerId))container.releasePointerCapture(e.pointerId);
    if(moved<7)splash();pointerId=null;
  };
  const onCancel=()=>{if(pointerId===null)return;dragging=false;pointerId=null;spin=0;tiltSpeed=0;};
  const onKey=e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','r','R'].includes(e.key))return;
    e.preventDefault();
    if(e.key==='ArrowLeft'){targetYaw-=.24;velocityX-=.5;}
    if(e.key==='ArrowRight'){targetYaw+=.24;velocityX+=.5;}
    if(e.key==='ArrowUp'){targetPitch=Math.max(-.72,targetPitch-.16);velocityZ-=.5;}
    if(e.key==='ArrowDown'){targetPitch=Math.min(.72,targetPitch+.16);velocityZ+=.5;}
    if(e.key===' ')splash();
    if(e.key.toLowerCase()==='r'){targetYaw=-.28;targetPitch=.05;spin=0;tiltSpeed=0;waves.clear();}
  };
  for(const [name,handler] of Object.entries({pointerdown:onDown,pointermove:onMove,pointerup:onUp,pointercancel:onCancel,lostpointercapture:onCancel,keydown:onKey}))container.addEventListener(name,handler);

  function update(dt){
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
    camera.position.z=camera.aspect<.8?9.3:8.25;
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
  renderer.domElement.addEventListener('webglcontextrestored',()=>{document.getElementById('graphics-status').hidden=true;paused=document.getElementById('toggle-motion').getAttribute('aria-pressed')==='true';resize();});
  return {
    setFill(value){fill=THREE.MathUtils.clamp(value,0,1);},
    setPaused(value){paused=value;if(value){waves.clear();slopeX=slopeZ=velocityX=velocityZ=0;spin=0;waveTexture.needsUpdate=true;}},
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();for(const [name,handler] of Object.entries({pointerdown:onDown,pointermove:onMove,pointerup:onUp,pointercancel:onCancel,lostpointercapture:onCancel,keydown:onKey}))container.removeEventListener(name,handler);scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});environment.dispose();pmrem.dispose();waveTexture.dispose();renderer.dispose();renderer.domElement.remove();},
  };
}

