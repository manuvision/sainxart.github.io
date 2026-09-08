import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { ButtonHolds } from './controls.js';

const clamp=THREE.MathUtils.clamp;
export class SPConsole {
  constructor(container,screen,onInput,onReady,controls){
    this.container=container;this.screen=screen;this.onInput=onInput;this.onReady=onReady;
    this.pressedKeys=new Set();this.controls=controls||new ButtonHolds({send:key=>this.onInput(key),changed:(key,down)=>this.press(key,down),canRepeat:()=>!document.hidden});
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0x000000,0);
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    container.append(this.renderer.domElement);
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(32,1,.1,100);
    const pmrem=new THREE.PMREMGenerator(this.renderer);const room=new RoomEnvironment();this.env=pmrem.fromScene(room,.04);this.scene.environment=this.env.texture;this.scene.environmentIntensity=.8;room.dispose();pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xf4fbff,0x343c43,.9));
    const key=new THREE.DirectionalLight(0xffffff,2.3);key.position.set(-3,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=6;key.shadow.camera.bottom=-5;key.shadow.radius=5;key.shadow.normalBias=.025;this.scene.add(key);
    const rim=new THREE.DirectionalLight(0xc3e5ff,1.7);rim.position.set(5,2,-4);this.scene.add(rim);
    this.root=new THREE.Group();this.scene.add(this.root);this.targets=[];this.buttons=new Map();
    this.materials={shell:new THREE.MeshPhysicalMaterial({color:0x91969b,metalness:.32,roughness:.37,clearcoat:.4,clearcoatRoughness:.33}),edge:new THREE.MeshStandardMaterial({color:0x7e848b,metalness:.35,roughness:.42}),seam:new THREE.MeshStandardMaterial({color:0x41454c,roughness:.6}),bezel:new THREE.MeshStandardMaterial({color:0x0c0e14,roughness:.82,metalness:0}),rubber:new THREE.MeshStandardMaterial({color:0x3d4149,roughness:.76}),button:new THREE.MeshPhysicalMaterial({color:0x373b43,metalness:.1,roughness:.56}),silver:new THREE.MeshStandardMaterial({color:0x7c838a,metalness:.4,roughness:.44})};
    this.build();
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:0x53636a,opacity:.16}));floor.rotation.x=-Math.PI/2;floor.position.y=-.46;floor.receiveShadow=true;this.scene.add(floor);
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.targetRotation={x:0,y:0,z:0};this.startTime=performance.now();this.ready=false;this.openAngle=-2.35;
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.resize();this.bind();this.lastTime=performance.now();this.frame=this.frame.bind(this);this.frameBound=true;this.raf=requestAnimationFrame(this.frame);
  }
  mesh(geo,mat,parent,pos){const m=new THREE.Mesh(geo,mat);if(pos)m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
  box(w,h,d,r,mat,parent,pos){return this.mesh(new RoundedBoxGeometry(w,h,d,3,r),mat,parent,pos)}
  cylinder(radius,height,mat,parent,pos){return this.mesh(new THREE.CylinderGeometry(radius,radius,height,40),mat,parent,pos)}
  label(text,w,d,parent,pos,{color='#d8d9ed',size=38,rotation=-Math.PI/2}={}){
    const c=document.createElement('canvas');c.width=Math.max(96,Math.ceil(text.length*size*.76+20));c.height=96;const x=c.getContext('2d');x.font=`600 ${size}px Arial, sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillStyle=color;x.fillText(text,c.width/2,48);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const plane=this.mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}),parent,pos);plane.rotation.x=rotation;plane.castShadow=false;return plane;
  }
  build(){
    const m=this.materials,root=this.root;
    this.box(3.54,.31,3.14,.18,m.edge,root,[0,-.205,0]);
    this.box(3.55,.055,3.15,.18,m.seam,root,[0,-.058,0]);
    this.box(3.55,.18,3.15,.18,m.shell,root,[0,.025,0]);
    // Two subtle molded panels and the cartridge / link connector on the front edge.
    this.box(2.62,.095,.04,.01,m.seam,root,[0,-.19,1.575]);
    this.box(.55,.045,.046,.01,m.rubber,root,[0,-.17,1.598]);
    for(const x of [-1.66,1.66]){const shoulder=this.box(.43,.18,.48,.07,m.silver,root,[x,.075,-1.13]);this.targets.push(shoulder);shoulder.userData.key=x<0?'l':'r';this.buttons.set(shoulder.userData.key,shoulder);this.label(x<0?'L':'R',.19,.15,shoulder,[0,.097,0],{size:60,color:'#38404a'})}
    // SP's characteristic three-barrel hinge, with narrow seams between segments.
    for(const [x,w] of [[-1.37,.68],[0,2.02],[1.37,.68]]){const barrel=this.mesh(new THREE.CylinderGeometry(.19,.19,w,48),m.shell,root,[x,.13,-1.37]);barrel.rotation.z=Math.PI/2}
    for(const x of [-1.02,1.02]){const seam=this.mesh(new THREE.CylinderGeometry(.194,.194,.023,48),m.seam,root,[x,.13,-1.37]);seam.rotation.z=Math.PI/2}
    this.hinge=new THREE.Group();this.hinge.position.set(0,.13,-1.37);root.add(this.hinge);
    this.box(3.55,.24,3.1,.19,m.shell,this.hinge,[0,.12,1.52]);
    this.box(3.43,.025,2.98,.17,m.edge,this.hinge,[0,-.006,1.52]);
    this.box(3.14,.045,2.56,.12,m.bezel,this.hinge,[0,-.034,1.63]);
    this.box(2.84,.02,1.925,.035,m.seam,this.hinge,[0,-.063,1.74]);
    this.screenTexture=new THREE.CanvasTexture(this.screen.canvas);this.screenTexture.colorSpace=THREE.SRGBColorSpace;this.screenTexture.magFilter=THREE.NearestFilter;this.screenTexture.minFilter=THREE.NearestFilter;this.screenTexture.generateMipmaps=false;
    this.display=this.mesh(new THREE.PlaneGeometry(2.76,1.84),new THREE.MeshBasicMaterial({map:this.screenTexture,toneMapped:false}),this.hinge,[0,-.079,1.74]);this.display.rotation.x=Math.PI/2;this.display.castShadow=false;this.display.userData.screen=true;this.targets.push(this.display);
    this.label('Manu.Vision',1.55,.285,this.hinge,[0,-.064,.52],{size:60,rotation:Math.PI/2,color:'#d6dce3'});
    this.label('Manu.Vision',1.65,.36,this.hinge,[0,.247,1.52],{size:49,color:'#70787f'});
    for(const x of [-1.56,1.56])for(const z of [.23,2.81])this.box(.15,.026,.09,.02,m.rubber,this.hinge,[x,-.02,z]);
    // The D-pad is an extruded cross, with independent directional hit regions.
    this.cylinder(.635,.018,m.edge,root,[-.96,.124,-.24]);
    const shape=new THREE.Shape();const points=[[-.18,.53],[.18,.53],[.18,.18],[.53,.18],[.53,-.18],[.18,-.18],[.18,-.53],[-.18,-.53],[-.18,-.18],[-.53,-.18],[-.53,.18],[-.18,.18]];points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const cross=this.mesh(new THREE.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.022}),m.button,root,[-.96,.137,-.24]);cross.rotation.x=-Math.PI/2;this.dpad=cross;
    this.cylinder(.12,.006,m.rubber,root,[-.96,.239,-.24]);
    for(const [key,x,z,angle] of [['up',-.96,-.61,0],['down',-.96,.13,Math.PI],['left',-1.33,-.24,Math.PI/2],['right',-.59,-.24,-Math.PI/2]]){
      const hit=this.box(.35,.07,.35,.015,new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),root,[x,.25,z]);hit.userData.key=key;this.targets.push(hit);this.buttons.set(key,cross);
      // Geometry keeps the molded arrows monochrome on platforms with emoji fonts.
      const arrow=new THREE.Shape();arrow.moveTo(0,.054);arrow.lineTo(-.054,-.036);arrow.lineTo(.054,-.036);arrow.closePath();
      const geometry=new THREE.ShapeGeometry(arrow);geometry.rotateZ(angle);
      const mark=this.mesh(geometry,new THREE.MeshBasicMaterial({color:0x9393a3,side:THREE.DoubleSide}),root,[x,.252,z]);mark.rotation.x=-Math.PI/2;mark.castShadow=false;
    }
    for(const [key,x,z] of [['b',.77,.05],['a',1.28,-.48]]){
      this.cylinder(.314,.019,m.edge,root,[x,.121,z]);
      const button=this.cylinder(.26,.1,m.button,root,[x,.18,z]);button.userData.key=key;this.targets.push(button);this.buttons.set(key,button);
      this.label(key.toUpperCase(),.25,.22,button,[0,.052,0],{size:64,color:'#c5c3d4'});
    }
    // Brightness key and the iconic round SELECT / START keys.
    this.cylinder(.15,.016,m.edge,root,[0,.125,-.89]);const brightness=this.cylinder(.105,.025,m.silver,root,[0,.147,-.89]);brightness.userData.key='screen';this.targets.push(brightness);this.label('☼',.17,.15,root,[0,.165,-.89],{size:55,color:'#333341'});
    for(const [key,x,label] of [['select',-.32,'SELECT'],['start',.32,'START']]){this.cylinder(.142,.016,m.edge,root,[x,.123,1.03]);const b=this.cylinder(.11,.027,m.button,root,[x,.143,1.03]);b.userData.key=key;this.targets.push(b);this.buttons.set(key,b);this.label(label,.47,.1,root,[x,.125,1.30],{size:33,color:'#434a53'})}
    // Speaker grille drilled into the lower shell.
    for(let row=0;row<4;row++)for(let col=0;col<5;col++){
      if((row===0||row===3)&&(col===0||col===4))continue;
      this.cylinder(.025,.009,m.seam,root,[(col-2)*.12,.122,.36+row*.12]);
    }
    const ledMat=new THREE.MeshBasicMaterial({color:0xcaf590,toneMapped:false});this.box(.047,.065,.14,.017,ledMat,root,[1.78,-.013,-.82]);
    this.label('POWER',.40,.09,root,[1.38,.125,-.96],{size:30,color:'#444c53'});
    for(const x of [-1.5,1.5])for(const z of [-1.08,1.3]){this.cylinder(.055,.006,m.silver,root,[x,-.363,z])}
  }
  resize(){
    const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;
    this.renderer.setSize(w,h);this.camera.aspect=w/h;
    const mobile=w<901;
    this.camera.position.set(0,6.8,10.2);this.camera.lookAt(0,1,0);
    const vertical=mobile?5.35:5.15;const distance=this.camera.position.distanceTo(new THREE.Vector3(0,1,0));
    this.camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(vertical/2/distance));
    if(mobile){const horizontal=4.35;const requiredVertical=horizontal/(w/h);this.camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.max(vertical,requiredVertical)/2/distance))}
    this.camera.updateProjectionMatrix();this.root.position.x=0;this.wake();
  }
  hit(event){const rect=this.container.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);return this.raycaster.intersectObjects(this.targets,false)[0]}
  bind(){
    const el=this.container;this.held=new Map();this.captured=new Set();this.eventAbort=new AbortController();
    const on=(target,type,handler)=>target.addEventListener(type,handler,{signal:this.eventAbort.signal});
    on(el,'pointerdown',e=>{
      if(e.button!==0||document.hidden||document.querySelector('dialog[open]'))return;
      e.preventDefault();this.releasePointer(e,true);
      el.focus({preventScroll:true});const hit=this.ready?this.hit(e):null;
      try{el.setPointerCapture(e.pointerId);this.captured.add(e.pointerId)}catch{}
      if(hit?.object.userData.key){
        const key=hit.object.userData.key;this.held.set(e.pointerId,{key});
        this.controls.start(`pointer:${e.pointerId}`,key);
      }else if(!this.drag){this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,hit}}
    });
    on(el,'pointermove',e=>{
      if(e.buttons===0){this.releasePointer(e,true);const hit=this.ready?this.hit(e):null;el.style.cursor=hit?'pointer':'grab';return}
      if(this.drag?.id===e.pointerId){const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;
        if(Math.hypot(dx,dy)>9){this.drag.moved=true;el.classList.add('dragging');this.targetRotation.y=clamp(dx*.005,-.62,.62);this.targetRotation.x=clamp(dy*.003,-.22,.22);this.targetRotation.z=clamp(-dx*.0012,-.10,.10);this.wake()}
      }else if(!this.held.size){const hit=this.ready?this.hit(e):null;el.style.cursor=hit?'pointer':'grab'}
    });
    on(el,'pointerup',e=>this.releasePointer(e));
    on(el,'pointercancel',e=>this.releasePointer(e,true));
    on(el,'lostpointercapture',e=>this.releasePointer(e,true));
    on(window,'blur',()=>this.cancelInteraction());
    on(window,'pagehide',()=>this.cancelInteraction());
    on(document,'visibilitychange',()=>{if(document.hidden)this.cancelInteraction();else{this.lastTime=performance.now();if(!this.raf)this.raf=requestAnimationFrame(this.frame)}});
    on(this.renderer.domElement,'webglcontextlost',e=>{e.preventDefault();this.cancelInteraction();this.onInput('fallback')});
  }
  releasePointer(event,cancel=false){
    const id=event.pointerId,el=this.container;
    if(this.held.has(id)){this.held.delete(id);this.controls.stop(`pointer:${id}`)}
    const drag=this.drag?.id===id?this.drag:null;
    if(drag){this.drag=null;this.targetRotation={x:0,y:0,z:0};el.classList.remove('dragging');this.wake()}
    this.captured.delete(id);
    try{if(el.hasPointerCapture(id))el.releasePointerCapture(id)}catch{}
    // Clear drag/capture before dispatch: screen input may switch modes immediately.
    if(drag&&!cancel&&!drag.moved&&drag.hit?.object.userData.screen){this.onInput('touch',{x:drag.hit.uv.x*this.screen.canvas.width,y:(1-drag.hit.uv.y)*this.screen.canvas.height})}
  }
  cancelInteraction(){
    for(const id of new Set([...this.held.keys(),...this.captured,this.drag?.id].filter(id=>id!==undefined)))this.releasePointer({pointerId:id},true);
    this.drag=null;this.targetRotation={x:0,y:0,z:0};this.container.classList.remove('dragging');this.wake();
  }
  destroy(){
    this.cancelInteraction();this.disposed=true;this.eventAbort?.abort();cancelAnimationFrame(this.raf);this.raf=0;this.resizeObserver.disconnect();this.renderer.dispose();
  }
  wake(){if(this.disposed)return;if(!this.raf&&this.frameBound&&!this.inFrame){this.lastTime=performance.now();this.raf=requestAnimationFrame(this.frame)}}
  press(key,down){
    if(down)this.pressedKeys.add(key);else this.pressedKeys.delete(key);
    const b=this.buttons.get(key);if(b){
      if(b.userData.baseY===undefined)b.userData.baseY=b.position.y;
      const pressed=[...this.pressedKeys].some(k=>this.buttons.get(k)===b);
      b.position.y=b.userData.baseY-(pressed?.025:0);this.wake();
    }
  }
  replay(){this.startTime=performance.now();this.ready=false;this.screen.boot=true;this.screen.draw();this.targetRotation={x:0,y:0,z:0};this.wake()}
  frame(now){
    this.raf=0;if(this.disposed||document.hidden)return;this.inFrame=true;
    const dt=clamp((now-this.lastTime)/1000,0,.05);this.lastTime=now;
    const elapsed=(now-this.startTime)/1000;
    const t=this.reduced?1:clamp((elapsed-.35)/1.65,0,1);const ease=1-Math.pow(1-t,3);
    this.hinge.rotation.x=this.openAngle*ease;
    const blend=1-Math.exp(-dt*8);
    this.root.rotation.x=THREE.MathUtils.lerp(this.root.rotation.x,this.reduced?0:this.targetRotation.x,blend);
    this.root.rotation.y=THREE.MathUtils.lerp(this.root.rotation.y,this.reduced?0:this.targetRotation.y-.065,blend);
    this.root.rotation.z=THREE.MathUtils.lerp(this.root.rotation.z,this.reduced?0:this.targetRotation.z-.014,blend);
    if(t===1&&!this.ready){this.ready=true;this.screen.boot=false;this.screen.draw();this.onReady?.()}
    this.renderer.render(this.scene,this.camera);
    const moving=Math.abs(this.root.rotation.x-(this.reduced?0:this.targetRotation.x))+Math.abs(this.root.rotation.y-(this.reduced?0:this.targetRotation.y-.065))+Math.abs(this.root.rotation.z-(this.reduced?0:this.targetRotation.z-.014))>.0001;
    this.inFrame=false;
    if(!this.ready||moving||this.drag?.moved)this.raf=requestAnimationFrame(this.frame);
  }
  updateScreen(){if(this.screenTexture){this.screenTexture.needsUpdate=true;this.wake()}}
}
