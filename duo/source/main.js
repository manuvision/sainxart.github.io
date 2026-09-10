import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPhone, W, H } from './phone.js';

const stage=document.getElementById('stage');
const slider=document.getElementById('fold');
const control=document.getElementById('fold-control');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=THREE.MathUtils.clamp;
let disposed=false;

async function start() {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  stage.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(31,1,.1,150);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const room=new RoomEnvironment();const environment=pmrem.fromScene(room,.04);
  scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff,0x929aad,2));
  const key=new THREE.DirectionalLight(0xffffff,3.3);key.position.set(-8,12,15);scene.add(key);
  const rim=new THREE.DirectionalLight(0xd9e7ff,2);rim.position.set(12,2,-8);scene.add(rim);
  const fill=new THREE.DirectionalLight(0xffffff,1.2);fill.position.set(-12,-3,4);scene.add(fill);
  const orbit=new THREE.Group();scene.add(orbit);
  const model=await createPhone(renderer);orbit.add(model.phone);
  // A faint photographic studio shadow anchors the floating product.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=256;
  const sc=shadowCanvas.getContext('2d');const grad=sc.createRadialGradient(128,128,3,128,128,128);
  grad.addColorStop(0,'rgba(55,65,85,.18)');grad.addColorStop(.38,'rgba(55,65,85,.09)');grad.addColorStop(1,'rgba(55,65,85,0)');sc.fillStyle=grad;sc.fillRect(0,0,256,256);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(19,3),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,toneMapped:false}));
  shadow.position.set(0,-H/2-1.40,-1.5);scene.add(shadow);
  let target=Number(slider.value)/1000,fold=target;
  let yaw=-.25,pitch=.07,targetYaw=yaw,targetPitch=pitch;
  let vx=0,vy=0,dragging=false,pointerId=null,lastX=0,lastY=0,lastMove=0;
  let raf=0,lastTime=performance.now(),introStart=performance.now(),interacted=false;
  let dirty=true;
  const bounds=new THREE.Box3();
  const projectedCorner=new THREE.Vector3();
  let cameraDistance=0;
  let sliderDown=false,thumbStretch=0,stretchSpeed=0,inputSpeed=0;
  let lastSliderValue=target,lastSliderTime=performance.now();
  const autoIntro=!reduced;
  if(autoIntro){fold=.12;target=.12;slider.value='120';}
  function resize() {
    const {width,height}=stage.getBoundingClientRect();
    renderer.setSize(width,height);camera.aspect=width/Math.max(1,height);
    const fov=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    // Fit the complete orbit envelope on phones, without shrinking the main subject on desktop.
    const horizontalFit=(2*W+.9)/(2*fov*camera.aspect*.94);
    const verticalFit=(H+1.0)/(2*fov*.90);
    cameraDistance=Math.max(horizontalFit,verticalFit)+2.0;
    camera.position.set(0,0,cameraDistance);
    camera.lookAt(0,0,0);camera.updateProjectionMatrix();
    dirty=true;wake();
  }
  function wake(){if(!raf&&!document.hidden&&!disposed){lastTime=performance.now();raf=requestAnimationFrame(frame);}}
  function updateSlider(p) {
    control.style.setProperty('--fold',String(p));
    slider.setAttribute('aria-valuetext',p<.005?'Closed':p>.995?'Fully open':`${Math.round(p*100)} percent open`);
  }
  function input(){
    interacted=true;target=Number(slider.value)/1000;
    const now=performance.now();inputSpeed=Math.min(3,Math.abs(target-lastSliderValue)/Math.max(.016,(now-lastSliderTime)/1000));
    lastSliderValue=target;lastSliderTime=now;
    updateSlider(target);dirty=true;wake();
  }
  slider.addEventListener('input',input);
  slider.addEventListener('pointerdown',()=>{interacted=true;sliderDown=true;control.dataset.pressed='true';lastSliderValue=target;lastSliderTime=performance.now();wake();});
  const releaseSlider=()=>{sliderDown=false;delete control.dataset.pressed;wake();};
  slider.addEventListener('pointerup',releaseSlider);slider.addEventListener('pointercancel',releaseSlider);slider.addEventListener('lostpointercapture',releaseSlider);
  stage.addEventListener('pointerdown',e=>{
    if(pointerId!==null || (e.pointerType==='mouse'&&e.button!==0))return;
    interacted=true;pointerId=e.pointerId;stage.setPointerCapture(pointerId);dragging=true;
    lastX=e.clientX;lastY=e.clientY;lastMove=performance.now();vx=vy=0;wake();
  });
  stage.addEventListener('pointermove',e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    const dt=Math.max(8,performance.now()-lastMove),dx=e.clientX-lastX,dy=e.clientY-lastY;
    const speed=4.6/Math.min(stage.clientWidth,stage.clientHeight);
    targetYaw+=dx*speed;targetPitch=clamp(targetPitch+dy*speed,-1.40,1.40);
    vx=clamp(dx*speed/dt*16,-.12,.12);vy=clamp(dy*speed/dt*16,-.10,.10);
    lastX=e.clientX;lastY=e.clientY;lastMove=performance.now();dirty=true;wake();
  });
  function end(e){if(e.pointerId!==pointerId)return;dragging=false;pointerId=null;if(performance.now()-lastMove>80||reduced)vx=vy=0;wake();}
  stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);stage.addEventListener('lostpointercapture',end);
  stage.addEventListener('keydown',e=>{
    const moves={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]};
    if(moves[e.key]){e.preventDefault();interacted=true;targetYaw+=moves[e.key][0];targetPitch=clamp(targetPitch+moves[e.key][1],-1.4,1.4);wake();}
    if(e.key.toLowerCase()==='r'){targetYaw=-.20;targetPitch=.055;vx=vy=0;wake();}
  });
  stage.addEventListener('dblclick',()=>{targetYaw=-.20;targetPitch=.055;vx=vy=0;interacted=true;wake();});
  function frame(now) {
    raf=0;if(disposed||document.hidden)return;
    const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
    const intro=autoIntro&&!interacted&&(now-introStart<2300);
    if(intro){const t=clamp((now-introStart-350)/1850,0,1);target=.12+.48*(t*t*(3-2*t));slider.value=String(Math.round(target*1000));updateSlider(target);}
    if(!dragging){targetYaw+=vx*dt*60;targetPitch=clamp(targetPitch+vy*dt*60,-1.4,1.4);vx*=Math.exp(-dt*7);vy*=Math.exp(-dt*7);}
    const ease=reduced?1:1-Math.exp(-dt*19);
    fold=THREE.MathUtils.lerp(fold,target,ease);
    if(Math.abs(fold-target)<.0001)fold=target;
    yaw=THREE.MathUtils.lerp(yaw,targetYaw,ease);pitch=THREE.MathUtils.lerp(pitch,targetPitch,ease);
    model.setFold(fold);orbit.rotation.set(pitch,yaw,0,'YXZ');
    orbit.updateMatrixWorld(true);
    model.updateProjection();
    bounds.setFromObject(model.phone);
    const fov=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    const width=Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x))*2;
    const height=Math.max(Math.abs(bounds.min.y),Math.abs(bounds.max.y))*2;
    const fit=Math.max(width/(2*fov*camera.aspect*.94),height/(2*fov*.85))+Math.max(0,bounds.max.z)+.6;
    cameraDistance=Math.max(fit,THREE.MathUtils.lerp(cameraDistance,fit,reduced?1:1-Math.exp(-dt*9)));
    camera.position.z=cameraDistance;
    camera.updateMatrixWorld();
    if(stage.clientWidth<=600){
      let phoneBottom=0;
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        projectedCorner.set(x,y,z).project(camera);
        phoneBottom=Math.max(phoneBottom,(1-projectedCorner.y)*.5*stage.clientHeight+stage.offsetTop);
      }
      const dockTop=clamp(phoneBottom+30,innerHeight*.52,innerHeight-100);
      document.documentElement.style.setProperty('--slider-top',`${dockTop}px`);
    }
    inputSpeed*=Math.exp(-dt*12);
    const desiredStretch=reduced?0:(sliderDown?.055:0)+Math.min(.17,inputSpeed*.09);
    stretchSpeed+=((desiredStretch-thumbStretch)*260-stretchSpeed*19)*dt;
    thumbStretch+=stretchSpeed*dt;
    if(reduced)thumbStretch=0;
    control.style.setProperty('--stretch',String(thumbStretch));
    shadow.scale.x=.63+fold*.37;shadow.material.opacity=1-Math.min(.55,Math.abs(pitch)*.3);
    renderer.render(scene,camera);dirty=false;
    const moving=intro||dragging||sliderDown||Math.abs(thumbStretch-desiredStretch)>.0001||Math.abs(stretchSpeed)>.0001||inputSpeed>.001||Math.abs(cameraDistance-fit)>.005||Math.abs(fold-target)>.0001||Math.abs(yaw-targetYaw)>.0001||Math.abs(pitch-targetPitch)>.0001||Math.abs(vx)+Math.abs(vy)>.0001;
    if(moving)raf=requestAnimationFrame(frame);
  }
  const observer=new ResizeObserver(resize);observer.observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{dirty=true;wake();}});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(raf);raf=0;showError('The 3D view was paused. Reload the page to continue.');});
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);raf=0;});
  window.addEventListener('pageshow',()=>wake());
  updateSlider(target);resize();
  document.body.classList.add('ready');document.getElementById('loading').setAttribute('aria-label','3D phone ready');
  // Read-only state is useful for regression checks without adding interface chrome.
  window.duo={getState:()=>({fold,target,yaw,pitch,dragging,width:stage.clientWidth,height:stage.clientHeight,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls})};
}

function showError(message) {
  document.body.classList.add('failed');
  const p=document.createElement('p');p.className='fallback-message';p.setAttribute('role','alert');p.textContent=message;stage.appendChild(p);
}
start().catch(error=>{console.error(error);showError('The 3D view could not load. Check your connection and reload the page.');});
