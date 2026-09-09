import * as THREE from '../vendor/three.module.min.js';
import {PocketGame} from './game.js?v=tideleaf-redraw-20260909';

const stage=document.querySelector('#stage');
const screenCanvas=document.createElement('canvas');screenCanvas.width=240;screenCanvas.height=160;
const game=new PocketGame(screenCanvas,state=>{
 document.querySelector('#announcement').textContent=state.dialog?state.dialog.title+'. '+state.dialog.text:state.location+'. '+state.prompt;
});
let started=false,revealComplete=false;
const startButton=document.querySelector('#screen-start');
function startGame(){
 if(started||!revealComplete)return;
 clear();started=true;startButton.hidden=true;game.draw();game.notify();
 document.querySelector('[data-control=start]').setAttribute('aria-label','Start — pause or resume');
 stage.focus({preventScroll:true});
}
// A native 5×7 bitmap alphabet keeps the opening text on the LCD's actual pixel grid.
function drawStartScreen(){
 const glyphs={P:['11110','10001','10001','11110','10000','10000','10000'],R:['11110','10001','10001','11110','10100','10010','10001'],E:['11111','10000','10000','11110','10000','10000','11111'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],A:['01110','10001','10001','11111','10001','10001','10001']};
 const c=screenCanvas.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,240,160);c.fillStyle='#f3f1df';
 [...'PRESS START'].forEach((letter,i)=>glyphs[letter]?.forEach((row,y)=>[...row].forEach((pixel,x)=>{if(pixel==='1')c.fillRect(55+i*12+x*2,73+y*2,2,2);})));
}
startButton.addEventListener('click',startGame);
const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',KeyA:'a',KeyZ:'a',Space:'a',KeyB:'b',KeyX:'b',Enter:'start',KeyM:'select'};
const heldVisual=new Map(),releaseTimers=new Map();
function press(action,id){
 if(!started){if(action==='start')startGame();return;}
 clearTimeout(releaseTimers.get(id));releaseTimers.delete(id);game.release(id);game.press(action,id);heldVisual.set(id,action);
}
function release(id){clearTimeout(releaseTimers.get(id));releaseTimers.delete(id);game.release(id);heldVisual.delete(id);}
function releaseAfter(id,ms){clearTimeout(releaseTimers.get(id));releaseTimers.set(id,setTimeout(()=>release(id),ms));}
function clear(){for(const timer of releaseTimers.values())clearTimeout(timer);releaseTimers.clear();game.clear();heldVisual.clear();}
function pulse(action){const id='pulse-'+action;press(action,id);releaseAfter(id,140);}
window.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.metaKey||event.altKey)return;
 if(event.target.closest?.('.studio-link'))return;
 if(event.target.closest?.('.hardware-button')&&(event.code==='Space'||event.code==='Enter'))return;
 const action=keys[event.code];if(!action)return;
 event.preventDefault();if(!event.repeat)press(action,'key-'+event.code);
});
window.addEventListener('keyup',event=>release('key-'+event.code));
window.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});

function roundedShape(w,h,r){
 const s=new THREE.Shape(),x=-w/2,y=-h/2;
 s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
 s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
 s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
function initHandheld(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(0,0,23.7);
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 renderer.domElement.setAttribute('aria-hidden','true');stage.prepend(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xf1faed,0x244236,1.6));
 const key=new THREE.DirectionalLight(0xfff2da,3.1);key.position.set(-5,9,12);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-12;key.shadow.camera.right=12;key.shadow.camera.top=12;key.shadow.camera.bottom=-12;key.shadow.normalBias=.03;key.shadow.radius=4;scene.add(key);
 const rim=new THREE.DirectionalLight(0x9de1ce,2.5);rim.position.set(7,1,-2);scene.add(rim);
 const fill=new THREE.DirectionalLight(0xbecaff,.7);fill.position.set(-4,-5,8);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.14}));floor.position.z=-2;floor.receiveShadow=true;scene.add(floor);
 const body=new THREE.Group();body.rotation.y=Math.PI;scene.add(body);
 const plastic=new THREE.MeshStandardMaterial({color:0xd2d0bd,roughness:.47,metalness:.025});
 const backPlastic=new THREE.MeshStandardMaterial({color:0xa6a795,roughness:.7});
 const rubber=new THREE.MeshStandardMaterial({color:0x151c22,roughness:.74});
 const purple=new THREE.MeshStandardMaterial({color:0x922a52,roughness:.37,metalness:.03});
 function solid(w,h,r,depth,material,x=0,y=0,z=0,bevel=.05){
  const geometry=new THREE.ExtrudeGeometry(roundedShape(w,h,r),{depth,bevelEnabled:bevel>0,bevelSegments:3,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:12});
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=false;body.add(mesh);return mesh;
 }
 solid(7.14,11.35,.66,.64,backPlastic,0,0,-.54,.11);
 solid(7.2,11.35,.65,.13,plastic,0,0,.13,.12);
 // Rear cartridge recess, battery door, grip ridges, and recessed screws for the reveal.
 const seam=new THREE.MeshStandardMaterial({color:0x697467,roughness:.85});
 solid(5.95,3.65,.2,.018,seam,0,3.25,-.68,.015);
 solid(5.7,3.39,.15,.018,backPlastic,0,3.25,-.71,.02);
 solid(5.95,4.08,.22,.018,seam,0,-2.55,-.68,.018);
 solid(5.76,3.87,.18,.018,backPlastic,0,-2.55,-.72,.02);
 for(let i=0;i<5;i++)solid(1.1,.035,.014,.008,seam,0,-1.1-i*.12,-.753,.003);
 for(const [x,y] of [[-2.93,4.65],[2.93,4.65],[-2.93,-4.74],[2.93,-4.74]]){
  const screw=new THREE.Mesh(new THREE.CircleGeometry(.11,16),rubber);screw.position.set(x,y,-.68);screw.rotation.y=Math.PI;body.add(screw);
  solid(.11,.022,.008,.008,backPlastic,x,y,-.692,.002);
 }
 // The narrow shell seam, top rail, and recessed gray display bezel.
 solid(7.2,.025,.012,.025,backPlastic,0,4.94,.275,.006);
 solid(6.44,4.66,.3,.09,new THREE.MeshStandardMaterial({color:0x1e2832,roughness:.43}),0,2.53,.36,.08);
 solid(5.05,3.44,.045,.014,rubber,.13,2.55,.491,.02);
 const texture=new THREE.CanvasTexture(screenCanvas);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
 // A single unlit display plane: no glass overlay, depth interference, or scan lines.
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(4.88,3.2533),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,depthTest:false,depthWrite:false}));
 screen.position.set(.13,2.55,.56);screen.renderOrder=10;body.add(screen);
 function label(text,x,y,w,h,color='#31395a',font='bold 32px Arial',z=.41){
  const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*h/w);const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';
  const fontSize=parseInt(font.match(/(\d+)px/)[1]);ctx.scale(c.width/(w*100),c.height/(h*100));ctx.font=font.replace(fontSize+'px',Math.round(h*70)+'px');ctx.fillText(text,w*50,h*50);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false}));m.position.set(x,y,z);body.add(m);return m;
 }
 // Geometry keeps these symbols identical on phones with emoji-enabled fonts.
 function arrow(direction,x,y,w,h,color,z){
  const shape=new THREE.Shape();shape.moveTo(0,h/2);shape.lineTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.closePath();
  const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color,toneMapped:false,depthWrite:false}));
  mesh.rotation.z={up:0,left:Math.PI/2,down:Math.PI,right:-Math.PI/2}[direction];mesh.position.set(x,y,z);body.add(mesh);
 }
 label('DOT MATRIX WITH STEREO SOUND',.48,4.47,3.7,.15,'#d1d5d0','500 32px Arial',.55);
 solid(.78,.026,.01,.002,new THREE.MeshBasicMaterial({color:0x977687}),-2.38,4.46,.55,.002);
 solid(.78,.026,.01,.002,new THREE.MeshBasicMaterial({color:0x657a94}),-2.38,4.40,.55,.002);
 const led=new THREE.Mesh(new THREE.SphereGeometry(.061,16,12),new THREE.MeshBasicMaterial({color:0xeb734f}));led.position.set(-2.82,3.2,.516);body.add(led);
 label('BATTERY',-2.82,2.91,.49,.105,'#c8ccce','500 32px Arial',.55);
 label('MANU VISION',-.08,-.19,2.95,.39,'#303b62','italic bold 32px Arial',.412);
 label('TM',1.04,-.11,.22,.12,'#303b62','bold 32px Arial',.412);
 label('PHONES',0,-5.10,.75,.14,'#686f6b','bold 32px Arial',.412);
 label('OFF · ON',-1.9,5.25,.95,.14,'#6e786e','bold 32px Arial',.412);
 arrow('left',-2.27,5.25,.065,.065,'#6e786e',.412);
 arrow('right',-1.53,5.25,.065,.065,'#6e786e',.412);
 solid(.6,.12,.025,.32,rubber,-2.0,5.64,-.11,.01);
 // Rubber D-pad, built from discrete clickable arms around a shared center.
 solid(2.23,2.23,1.1,.025,new THREE.MeshStandardMaterial({color:0xb5b6a5,roughness:.9}),-1.92,-1.6,.35,.04);
 const buttonMeshes={};const buttonPositions={};
 const definitions=[['up',0,.64,.72,.72],['down',0,-.64,.72,.72],['left',-.64,0,.72,.72],['right',.64,0,.72,.72]];
 for(const [name,x,y,w,h] of definitions){const m=solid(w,h,.055,.18,rubber,-1.92+x,-1.6+y,.44,.035);buttonMeshes[name]=m;buttonPositions[name]={x:m.position.x,y:m.position.y,z:.66,w:.86,h:.86};}
 solid(.75,.75,.055,.18,rubber,-1.92,-1.6,.44,.025);
 const center=new THREE.Mesh(new THREE.CircleGeometry(.23,32),new THREE.MeshStandardMaterial({color:0x111820,roughness:.6}));center.position.set(-1.92,-1.6,.655);body.add(center);
 for(const name of ['up','down','left','right']){const p=buttonPositions[name];arrow(name,p.x,p.y,.14,.12,'#343d43',.665);}
 solid(2.25,1.17,.58,.02,new THREE.MeshStandardMaterial({color:0xbdbfae,roughness:.8}),1.9,-1.64,.35,.04).rotation.z=.48;
 for(const [name,x,y] of [['b',1.32,-1.98],['a',2.48,-1.35]]){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(.43,.46,.24,64),purple);m.rotation.x=Math.PI/2;m.position.set(x,y,.53);m.castShadow=true;m.receiveShadow=true;body.add(m);buttonMeshes[name]=m;buttonPositions[name]={x,y,z:.71,w:1.08,h:1.08};
  label(name.toUpperCase(),x+.14,y-.69,.36,.28,'#343d65','bold 32px Arial',.414);
 }
 for(const [name,x] of [['select',-.57],['start',.63]]){
  const m=solid(.85,.24,.12,.1,new THREE.MeshStandardMaterial({color:0x667477,roughness:.75}),x,-3.5,.4,.025);m.rotation.z=.32;buttonMeshes[name]=m;buttonPositions[name]={x,y:-3.5,z:.58,w:1.02,h:.5};
  label(name.toUpperCase(),x+.09,-3.96,.89,.17,'#4e5d6d','bold 32px Arial',.42).rotation.z=.32;
 }
 for(let i=0;i<6;i++){const slot=solid(.085,1.23,.04,.012,new THREE.MeshStandardMaterial({color:0x62716a,roughness:.9}),1.44+i*.29,-4.35+i*.065,.395,.008);slot.rotation.z=.44;}
 const buttonLayer=document.querySelector('#button-targets');const domButtons={};
 const brandLink=document.createElement('a');brandLink.id='brand-link';brandLink.className='hardware-button';brandLink.href='https://manu.vision';brandLink.setAttribute('aria-label','MANU VISION — home');brandLink.title='Visit manu.vision';brandLink.textContent='MANU VISION';brandLink.hidden=true;buttonLayer.append(brandLink);
 let brandTouch=null,brandTapCancelled=false;
 brandLink.addEventListener('pointerdown',e=>{brandTouch={x:e.clientX,y:e.clientY};brandTapCancelled=false;});
 stage.addEventListener('pointermove',e=>{if(brandTouch&&Math.hypot(e.clientX-brandTouch.x,e.clientY-brandTouch.y)>8)brandTapCancelled=true;},{capture:true});
 stage.addEventListener('pointercancel',()=>{brandTapCancelled=true;brandTouch=null;},{capture:true});
 brandLink.addEventListener('click',e=>{if(e.detail!==0&&brandTapCancelled)e.preventDefault();brandTouch=null;});
 const touches=new Map();let pinching=false,pinchStart=null,drag=null;
 const actionLabels={up:'Move up',down:'Move down',left:'Move left',right:'Move right',a:'A — interact or roll',b:'B — attack or dismiss',start:'Start — begin playing',select:'Select — toggle sound'};
 for(const [action,pos] of Object.entries(buttonPositions)){
  const b=document.createElement('button');b.className='hardware-button';b.dataset.control=action;b.setAttribute('aria-label',actionLabels[action]);b.setAttribute('aria-pressed','false');b.title=actionLabels[action];b.textContent=actionLabels[action];buttonLayer.append(b);domButtons[action]=b;
  b.addEventListener('pointerdown',e=>{if(pinching||e.button!==0)return;e.preventDefault();b.setPointerCapture(e.pointerId);press(action,'pointer-'+e.pointerId);b.dataset.down=performance.now();});
  const end=e=>{const remaining=Math.max(0,110-(performance.now()-Number(b.dataset.down||0)));releaseAfter('pointer-'+e.pointerId,remaining);};
  b.addEventListener('pointerup',end);b.addEventListener('pointercancel',e=>release('pointer-'+e.pointerId));b.addEventListener('lostpointercapture',e=>{if(e.buttons)release('pointer-'+e.pointerId);});
  b.addEventListener('click',e=>{if(e.detail===0)pulse(action);});
 }
 let width=0,height=0,fitDistance=22,zoom=1,targetZoom=1;
 const pan={x:0,y:0};const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const screenFocus=new THREE.Vector3(.13,2.55,.56);
 const introStarted=performance.now(),introDuration=reduced.matches?0:1900;
 const tilt={x:0,y:0};
 function stopDrag(){drag=null;tilt.x=tilt.y=0;stage.dataset.dragging='false';}
 const raycaster=new THREE.Raycaster();
 function overBody(e){
  const rect=stage.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/width*2-1,1-(e.clientY-rect.top)/height*2),camera);
  return raycaster.intersectObject(body,true).length>0;
 }
 function setZoom(value,immediate=false){targetZoom=clamp(value,.8,4);if(immediate||reduced.matches)zoom=targetZoom;}
 function resetView(){setZoom(1);pan.x=pan.y=0;stopDrag();}
 function resize(){
  width=stage.clientWidth;height=stage.clientHeight;renderer.setSize(width,height);camera.aspect=width/height;
  const halfFov=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  fitDistance=Math.max(12.6,8.4/camera.aspect)/(2*halfFov)+.6;
  camera.position.z=fitDistance;camera.updateProjectionMatrix();
 }
 // Wheel scroll and trackpad pinch (Ctrl+wheel) both zoom the handheld toward its LCD.
 stage.addEventListener('wheel',e=>{
  e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?height:1;
  setZoom(targetZoom*Math.exp(-e.deltaY*unit*(e.ctrlKey?.008:.0015)));
 },{passive:false});
 stage.addEventListener('dblclick',e=>{if(!e.target.closest?.('.hardware-button')){e.preventDefault();resetView();}});
 window.addEventListener('keydown',e=>{if(e.code==='Digit0'||e.code==='Numpad0'){e.preventDefault();resetView();}});
 function touchPair(){
  const [a,b]=[...touches.values()];return {distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),x:(a.x+b.x)/2,y:(a.y+b.y)/2};
 }
 stage.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch')touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(touches.size>=2){
   brandTapCancelled=true;
   pinching=true;stopDrag();clear();e.preventDefault();e.stopPropagation();
   for(const id of touches.keys())stage.setPointerCapture(id);
   pinchStart={...touchPair(),zoom,panX:pan.x,panY:pan.y};
   return;
  }
  if(!pinching&&revealComplete&&e.button===0&&!e.target.closest?.('.hardware-button')&&overBody(e)){
   clear();drag={id:e.pointerId,x:e.clientX,y:e.clientY,tiltX:body.rotation.x,tiltY:body.rotation.y};
   stage.setPointerCapture(e.pointerId);stage.dataset.dragging='true';e.preventDefault();
  }
 },{capture:true,passive:false});
 stage.addEventListener('pointermove',e=>{
  if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(drag?.id===e.pointerId&&!pinching){
   const sensitivity=3/Math.min(width,height);
   tilt.x=clamp(drag.tiltX+(e.clientY-drag.y)*sensitivity,-.65,.65);
   tilt.y=clamp(drag.tiltY+(e.clientX-drag.x)*sensitivity,-1.15,1.15);
   e.preventDefault();return;
  }
  if(!pinching)return;e.preventDefault();e.stopPropagation();
  if(touches.size<2||!pinchStart)return;
  const pair=touchPair();setZoom(pinchStart.zoom*pair.distance/pinchStart.distance,true);
  const unitsPerPixel=2*fitDistance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/(height*zoom);
  pan.x=clamp(pinchStart.panX-(pair.x-pinchStart.x)*unitsPerPixel,-3,3);
  pan.y=clamp(pinchStart.panY+(pair.y-pinchStart.y)*unitsPerPixel,-3,3);
 },{capture:true,passive:false});
 function endTouch(e){
  if(drag?.id===e.pointerId)stopDrag();
  if(!touches.has(e.pointerId))return;touches.delete(e.pointerId);
  if(pinching){e.preventDefault();e.stopPropagation();release('pointer-'+e.pointerId);if(touches.size<2)pinchStart=null;if(touches.size===0)pinching=false;}
 }
 stage.addEventListener('pointerup',endTouch,{capture:true,passive:false});
 stage.addEventListener('pointercancel',endTouch,{capture:true,passive:false});
 stage.addEventListener('lostpointercapture',e=>{if(drag?.id===e.pointerId)stopDrag();});
 function cancelGestures(){stopDrag();touches.clear();pinching=false;pinchStart=null;}
 window.addEventListener('blur',cancelGestures);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGestures();});
 // Safari trackpads expose gesture events instead of Ctrl+wheel.
 let gestureZoom=1;
 stage.addEventListener('gesturestart',e=>{e.preventDefault();gestureZoom=zoom;},{passive:false});
 stage.addEventListener('gesturechange',e=>{e.preventDefault();if(touches.size<2)setZoom(gestureZoom*e.scale,true);},{passive:false});
 stage.addEventListener('gestureend',e=>e.preventDefault(),{passive:false});
 new ResizeObserver(resize).observe(stage);resize();
 function project(x,y,z){const p=new THREE.Vector3(x,y,z);body.localToWorld(p);p.project(camera);return {x:(p.x*.5+.5)*width,y:(-.5*p.y+.5)*height};}
 const baseZ=Object.fromEntries(Object.entries(buttonMeshes).map(([name,m])=>[name,m.position.z]));
 const projected={};
 function render(now,dt){
  if(!revealComplete){
   const t=introDuration?clamp((now-introStarted-180)/introDuration,0,1):1;
   const eased=t*t*t*(t*(t*6-15)+10);
   body.rotation.set(0,Math.PI*(1-eased),0);
   if(t===1){revealComplete=true;document.querySelector('#announcement').textContent='Press Start to play. Drag the Game Boy to rotate it.';}
  }else{
   const blend=reduced.matches?1:1-Math.exp(-dt*(drag?22:12));
   for(const axis of ['x','y']){body.rotation[axis]+=(tilt[axis]-body.rotation[axis])*blend;if(Math.abs(body.rotation[axis]-tilt[axis])<.0001)body.rotation[axis]=tilt[axis];}
  }
  zoom+=(targetZoom-zoom)*.2;if(Math.abs(targetZoom-zoom)<.0001)zoom=targetZoom;
  const focus=clamp((zoom-1)/1.1,0,1);
  camera.position.set(screenFocus.x*focus+pan.x,screenFocus.y*focus+pan.y,fitDistance);
  camera.zoom=zoom;camera.updateProjectionMatrix();
  const actions=[...heldVisual.values()];
  for(const [action,m] of Object.entries(buttonMeshes)){m.position.z+=(baseZ[action]-(actions.includes(action)?.08:0)-m.position.z)*.35;domButtons[action].setAttribute('aria-pressed',String(actions.includes(action)));}
  texture.needsUpdate=true;renderer.render(scene,camera);
  const interactive=revealComplete&&!drag&&!pinching&&Math.abs(body.rotation.x)<.02&&Math.abs(body.rotation.y)<.02;
  for(const [action,p] of Object.entries(buttonPositions)){
   const center=project(p.x,p.y,p.z),edge=project(p.x+p.w/2,p.y+p.h/2,p.z);const b=domButtons[action];
   b.style.left=center.x+'px';b.style.top=center.y+'px';b.style.width=Math.max(24,2*Math.abs(edge.x-center.x))+'px';b.style.height=Math.max(24,2*Math.abs(edge.y-center.y))+'px';
   b.style.visibility=!interactive||center.x<0||center.x>width||center.y<0||center.y>height?'hidden':'visible';projected[action]=center;
  }
  const brandCenter=project(-.02,-.19,.412),brandEdge=project(1.25,.12,.412);
  brandLink.hidden=!interactive||brandCenter.x<0||brandCenter.x>width||brandCenter.y<0||brandCenter.y>height;
  brandLink.style.left=brandCenter.x+'px';brandLink.style.top=brandCenter.y+'px';brandLink.style.width=2*Math.abs(brandEdge.x-brandCenter.x)+'px';brandLink.style.height=Math.max(44,2*Math.abs(brandEdge.y-brandCenter.y))+'px';
  startButton.hidden=started||!interactive;
  if(!startButton.hidden){
   const center=project(.13,2.55,.56),edge=project(1.68,2.98,.56);
   startButton.style.left=center.x+'px';startButton.style.top=center.y+'px';startButton.style.width=2*Math.abs(edge.x-center.x)+'px';startButton.style.height=2*Math.abs(edge.y-center.y)+'px';
  }
 }
 return {render,projected,renderer,view:()=>({zoom,targetZoom,pan:{...pan},width,height,pinching,dragging:!!drag,rotation:{x:body.rotation.x,y:body.rotation.y,z:body.rotation.z},revealComplete,started,screenCenter:project(.13,2.55,.56),screenCorners:[[-2.31,4.17665],[2.57,4.17665],[2.57,.92335],[-2.31,.92335]].map(([x,y])=>project(x,y,.56))})};
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
try{
 await game.load();
 drawStartScreen();
 const handheld=initHandheld();
 document.querySelector('#loading').remove();
 let last=performance.now();
 function frame(now){const dt=Math.min((now-last)/1000,.035);last=now;if(started)game.update(dt);handheld.render(now,dt);requestAnimationFrame(frame);}
 requestAnimationFrame(frame);
 // Read-only diagnostics support deterministic browser verification.
 window.pocket={snapshot:()=>game.getSnapshot(),controls:()=>structuredClone(handheld.projected),screen:()=>screenCanvas.toDataURL(),isWalkable:(x,y)=>game.canStand(x,y),view:handheld.view};
 document.documentElement.dataset.ready='true';
}catch(error){
 console.error(error);document.querySelector('#loading').innerHTML='<div class="error">The cartridge could not start.<br>Please refresh with WebGL enabled.</div>';
}
