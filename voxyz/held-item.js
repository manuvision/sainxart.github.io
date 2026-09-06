import * as THREE from './vendor/three.module.js';

const ITEM_IDS=[1,3,5,7,10];
const clamp=THREE.MathUtils.clamp;

// The view model keeps its own self-occlusion, but occupies the nearest half
// percent of the existing depth buffer. Walls cannot cut through the prop and
// the post-process depth still masks sun shafts behind it. Never clear depth.
function viewMaterial(material) {
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      gl_Position.z=((gl_Position.z/gl_Position.w+1.0)*.005-1.0)*gl_Position.w;
    `);
  };
  material.customProgramCacheKey=()=> 'voxyz-held-depth-v1';
  return material;
}

function textureField(kind) {
  const tile=32,width=tile*4,height=tile,data=new Uint8Array(width*height*4);
  const hash=(x,y)=>{let h=Math.imul(x+23,374761393)^Math.imul(y+41,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const face=Math.floor(x/tile),u=x%tile,v=y;
    const grain=hash(Math.floor(u/2),Math.floor(v/2))-.5;
    let rgb,shade=1+grain*.10;
    if(kind==='meadow') {
      const turf=face===1||(face===0&&v>21+Math.floor(hash(Math.floor(u/4),2)*4));
      rgb=turf?[101,130,60]:[117,83,51];
      shade=1+grain*(turf?.19:.16)+(hash(u,v)-.5)*.035;
    } else if(kind==='stone') {
      rgb=[130,139,126];
      shade=1+grain*.18+(hash(Math.floor(u/7),Math.floor(v/6))-.5)*.12;
    } else if(kind==='wood') {
      rgb=face===0?[104,78,48]:[153,119,74];
      if(face===0)shade=1+(hash(Math.floor(u/3),Math.floor(v/14))-.5)*.28+grain*.055;
      else {const r=Math.hypot(u-14.5,v-16.5);shade=1+Math.sin(r*1.6+grain*.5)*.065+grain*.045;}
    } else if(kind==='water') {
      rgb=[49,124,133];
      const ripples=Math.sin(u*.42+Math.sin(v*.34))*.5+Math.sin(v*.53-u*.14)*.5;
      shade=1+ripples*.13+grain*.035;
    } else {rgb=[102,74,45];shade=1+grain*.08;}
    const i=(y*width+x)*4;
    for(let channel=0;channel<3;channel++)data[i+channel]=Math.round(clamp(rgb[channel]*shade,0,255));
    data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

function boxGeometry(x,y,z) {
  const geometry=new THREE.BoxGeometry(x,y,z),uv=geometry.attributes.uv;
  // One material/draw for all six sides: atlas tiles 0=side, 1=top, 2=end.
  for(let i=0;i<uv.count;i++) {
    const face=Math.floor(i/4),tile=face===2?1:face===3?2:0;
    uv.setXY(i,(tile+(1+uv.getX(i)*30)/32)/4,(1+uv.getY(i)*30)/32);
  }
  return geometry;
}

export class HeldItem {
  constructor(worldScene) {
    this.worldScene=worldScene;this.scene=new THREE.Scene();this.scene.name='First-person held item';
    this.camera=new THREE.PerspectiveCamera(66,1,.08,260);
    this.root=new THREE.Group();this.root.name='Selected block at screen edge';this.scene.add(this.root);
    this.materials=new Set();this.geometries=new Set();this.textures=new Set();this.models=new Map();
    this.time={value:0};this.ready=false;this.visible=false;this.disposed=false;this.warmVersion=0;
    this.selected=1;this.walkPhase=0;this.moveBlend=0;this.swingTime=1;this.swingAmount=0;this.selectionDip=0;
    this.inverseCamera=new THREE.Quaternion();this.lightOffset=new THREE.Vector3();this.sunView=new THREE.Vector3();
    this.layoutMatrix=new THREE.Matrix4();this.layoutRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.045,0,.035));
    this.layoutScale=new THREE.Vector3();this.layoutPoint=new THREE.Vector3();this.layoutOrigin=new THREE.Vector3(0,0,-.9);
    this.layoutKey='';this.edgePosition=0;
    this.root.visible=false;

    // Both light layouts are permanent. A held torch changes intensity and
    // position only, so selecting it cannot rebuild the world's shaders.
    this.worldLight=new THREE.PointLight(0xffbd75,0,9,1.8);
    this.worldLight.name='Held torch illumination';worldScene.add(this.worldLight);
    this.itemLight=new THREE.PointLight(0xffb666,0,2.5,2);
    this.scene.add(this.itemLight);
    this.hemi=new THREE.HemisphereLight(0xe6ebd6,0x665641,.9);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xffe8c0,2.5);this.sun.position.set(-3,4,2);this.scene.add(this.sun,this.sun.target);

    const leather=this._mat('leather');
    const meadow=this._mat('meadow'),stone=this._mat('stone'),wood=this._mat('wood'),water=this._mat('water');
    const previous=water.onBeforeCompile;
    water.onBeforeCompile=shader=>{
      previous(shader);shader.uniforms.uHeldTime=this.time;
      shader.fragmentShader='uniform float uHeldTime;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
        vec2 heldWaterUv=vMapUv+vec2(sin(vMapUv.y*29.0+uHeldTime*.65)*.0025,sin(vMapUv.x*23.0-uHeldTime*.43)*.006);
        diffuseColor*=texture2D(map,heldWaterUv);
      `);
    };
    water.customProgramCacheKey=()=> 'voxyz-held-water-depth-v1';
    water.roughness=.78;
    for(const [id,material] of [[1,meadow],[3,stone],[5,wood],[7,water]]) {
      const group=new THREE.Group();group.name=`Held block ${id}`;group.visible=id===this.selected;
      const cube=this._box(group,material,[.265,.265,.265],[0,.111,-.054]);cube.rotation.set(.04,-.48,.025);
      if(id===1) {
        const leaf=this._plain(0x789446);
        for(const [x,z,h] of [[-.055,-.077,.030],[.055,-.060,.042],[.035,.040,.025]])
          this._box(group,leaf,[.015,h,.016],[x,.25+h/2,z-.055]);
      }
      this.models.set(id,group);this.root.add(group);
    }
    const torch=new THREE.Group();torch.name='Held wooden torch';torch.visible=false;
    const shaft=this._box(torch,wood,[.066,.37,.066],[0,.080,-.025]);shaft.rotation.y=.18;
    this._box(torch,leather,[.083,.040,.082],[0,.198,-.025]);
    this._box(torch,this._plain(0x423628),[.094,.050,.087],[0,.263,-.025]);
    const amber=this._emissive(0xffad45,2.6),core=this._emissive(0xffe3a1,3.3);
    this.flame=new THREE.Group();this.flame.position.set(0,.286,-.025);torch.add(this.flame);
    this._box(this.flame,amber,[.092,.107,.083],[0,.045,0]);
    this._box(this.flame,core,[.048,.085,.050],[-.006,.028,.019]);
    this._box(this.flame,amber,[.042,.080,.045],[.018,.123,-.008]);
    this.models.set(10,torch);this.root.add(torch);
    this.root.updateMatrixWorld(true);
    for(const group of this.models.values())group.userData.bounds=new THREE.Box3().setFromObject(group);
  }

  _mat(kind) {
    const texture=textureField(kind);this.textures.add(texture);
    const material=viewMaterial(new THREE.MeshStandardMaterial({map:texture,roughness:.97,metalness:0}));
    this.materials.add(material);return material;
  }
  _plain(color) {
    const material=viewMaterial(new THREE.MeshStandardMaterial({color,roughness:1,metalness:0}));
    this.materials.add(material);return material;
  }
  _emissive(color,intensity) {
    const material=viewMaterial(new THREE.MeshBasicMaterial({color}));material.color.multiplyScalar(intensity);
    this.materials.add(material);return material;
  }
  _box(parent,material,size,position) {
    const geometry=boxGeometry(...size);this.geometries.add(geometry);
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);parent.add(mesh);return mesh;
  }

  select(id) {
    if(!this.models.has(id)||this.disposed)return false;
    if(this.selected===id)return true;
    this.models.get(this.selected).visible=false;this.models.get(id).visible=true;
    this.selected=id;this.selectionDip=.022;
    if(id!==10){this.worldLight.intensity=0;this.itemLight.intensity=0;}
    return true;
  }

  swing() {if(!this.disposed)this.swingTime=0;}

  _alignToEdge(scale,halfX) {
    const key=`${this.selected}:${scale}:${this.camera.projectionMatrix.elements[0]}`;
    if(key===this.layoutKey)return;
    this.layoutKey=key;
    const bounds=this.models.get(this.selected).userData.bounds,projected=[];
    this.layoutScale.setScalar(scale);this.layoutMatrix.compose(this.layoutOrigin,this.layoutRotation,this.layoutScale);
    // The cube and narrow torch have different silhouettes. Project their
    // bounds, then place roughly two thirds of either silhouette inside the
    // viewport. This keeps every selection anchored to the screen edge.
    const projectionX=this.camera.projectionMatrix.elements[0];
    for(let i=0;i<8;i++) {
      this.layoutPoint.set(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z).applyMatrix4(this.layoutMatrix);
      const slope=projectionX/-this.layoutPoint.z;
      projected.push([slope,this.layoutPoint.x*slope]);
    }
    let low=0,high=halfX*1.8;
    for(let step=0;step<14;step++) {
      const x=(low+high)*.5;let left=Infinity,right=-Infinity;
      for(const [slope,offset] of projected){const edge=x*slope+offset;left=Math.min(left,edge);right=Math.max(right,edge);}
      if(left*.35+right*.65<1)low=x;else high=x;
    }
    this.edgePosition=(low+high)*.5;
  }

  update(dt,time,{camera,daylight=1,moving=false,visible=true,mobile=false,underwater=false,sunDirection}={}) {
    if(this.disposed||!camera)return;
    dt=clamp(Number.isFinite(dt)?dt:0,0,.1);this.time.value=time;
    this.visible=!!visible;this.root.visible=this.visible;
    this.camera.fov=camera.fov;this.camera.aspect=camera.aspect;this.camera.near=camera.near;this.camera.far=camera.far;
    this.camera.projectionMatrix.copy(camera.projectionMatrix);
    this.camera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    this.inverseCamera.copy(camera.quaternion).invert();
    if(sunDirection)this.sunView.copy(sunDirection).applyQuaternion(this.inverseCamera);
    else this.sunView.set(-.55,.48,.42).normalize().applyQuaternion(this.inverseCamera);
    this.sun.position.copy(this.sunView).multiplyScalar(4);
    const day=clamp(daylight,0,1);
    this.sun.intensity=.08+day*2.55;this.hemi.intensity=.17+day*.76;
    this.hemi.color.set(underwater?0x85bbc4:0xe6ebd6);

    this.walkPhase+=dt*(moving?9:1.5);
    this.moveBlend=THREE.MathUtils.damp(this.moveBlend,moving?1:0,9,dt);
    this.swingTime=Math.min(1,this.swingTime+dt/.29);
    this.swingAmount=THREE.MathUtils.damp(this.swingAmount,Math.sin(this.swingTime*Math.PI),23,dt);
    this.selectionDip=THREE.MathUtils.damp(this.selectionDip,0,17,dt);
    const distance=.9,halfY=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*distance;
    const aspect=camera.aspect,scale=mobile?.46:.74;
    this._alignToEdge(scale,halfY*aspect);
    const bobX=Math.sin(this.walkPhase)*.009*this.moveBlend;
    const bobY=Math.cos(this.walkPhase*2)*.006*this.moveBlend+Math.sin(time*.8)*.0015;
    this.root.scale.setScalar(scale);
    this.root.position.set(
      this.edgePosition+bobX-this.swingAmount*.085*scale,
      halfY*(mobile?-.30:-.68)+bobY-this.selectionDip+this.swingAmount*.02*scale,
      -distance-this.swingAmount*.12*scale,
    );
    this.root.rotation.set(-.045-this.swingAmount*.47,0,.035-Math.sin(this.walkPhase)*.012*this.moveBlend-this.swingAmount*.19);
    const torch=this.visible&&this.selected===10;
    const flicker=1+Math.sin(time*7.3)*.025+Math.sin(time*11.8+.7)*.017;
    this.flame.scale.y=flicker;
    this.root.updateMatrixWorld(true);
    this.flame.getWorldPosition(this.itemLight.position);
    this.itemLight.position.z+=.045;
    this.itemLight.intensity=torch?(underwater?.018:.055)*flicker:0;
    this.lightOffset.set(.16,-.12,-.30).applyQuaternion(camera.quaternion);
    this.worldLight.position.copy(camera.position).add(this.lightOffset);
    this.worldLight.intensity=torch?(underwater?1.2:5.0)*flicker:0;
  }

  async warm(renderer,target) {
    const version=++this.warmVersion;this.ready=false;
    const previous=renderer.getRenderTarget();let pending;
    try {
      renderer.setRenderTarget(target);
      // Three's compile traverses hidden meshes too: all five selections and
      // the flame finish compiling against their final fixed light layout.
      pending=renderer.compileAsync(this.scene,this.camera);
    } finally {renderer.setRenderTarget(previous);}
    await pending;
    if(version===this.warmVersion&&!this.disposed)this.ready=true;
  }

  render(renderer,target) {
    if(!this.visible||!this.ready||this.disposed)return;
    const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
    try {
      renderer.autoClear=false;renderer.setRenderTarget(target);
      renderer.render(this.scene,this.camera);
    } finally {renderer.setRenderTarget(previous);renderer.autoClear=autoClear;}
  }

  get diagnostics() {
    let meshes=0;this.root.traverseVisible(object=>{if(object.isMesh)meshes++;});
    return {selected:this.selected,visible:this.visible,ready:this.ready,meshes,torch:this.worldLight.intensity>0};
  }

  dispose() {
    if(this.disposed)return;
    this.disposed=true;this.visible=false;this.ready=false;this.warmVersion++;
    this.worldLight.intensity=0;this.worldScene.remove(this.worldLight);
    for(const geometry of this.geometries)geometry.dispose();
    for(const material of this.materials)material.dispose();
    for(const texture of this.textures)texture.dispose();
    this.scene.clear();this.models.clear();
  }
}

export {ITEM_IDS};
