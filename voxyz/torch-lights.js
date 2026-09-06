import * as THREE from './vendor/three.module.js';

// Keep the light count fixed: changing NUM_POINT_LIGHTS recompiles every lit
// material. Placement only updates existing uniforms and prewarmed visuals.
export class TorchLights {
  constructor(scene,{flameGeometry,flameMaterial,glowMaterial,capacity=6}) {
    this.scene=scene;this.active=[];this.ready=false;this.warmVersion=0;
    this.pool=Array.from({length:capacity},()=>{
      const light=new THREE.PointLight(0xffbe79,0,11,1.5);
      const visuals=new THREE.Group();visuals.visible=false;
      const flame=new THREE.Mesh(flameGeometry,flameMaterial),glow=new THREE.Sprite(glowMaterial);
      flame.position.y=glow.position.y=-.17;glow.scale.set(1.0,1.2,1);
      visuals.add(flame,glow);light.add(visuals);scene.add(light);
      return {light,visuals,key:null};
    });
  }
  async warm(renderer,camera,target) {
    const version=++this.warmVersion;this.ready=false;
    // compile traverses hidden meshes, using the final scene's light layout.
    // Match the linear scene target, otherwise the first real draw would compile
    // another output-color-space variant and reintroduce the placement hitch.
    const previous=renderer.getRenderTarget();let warming;
    try {
      renderer.setRenderTarget(target);
      warming=renderer.compileAsync(this.pool[0].visuals,camera,this.scene);
    } finally {renderer.setRenderTarget(previous);}
    await warming;
    if(version===this.warmVersion)this.ready=true;
  }
  add(x,y,z) {
    const key=`${x},${y},${z}`;
    if(this.active.some(slot=>slot.key===key))return;
    const slot=this.pool.find(slot=>slot.key===null)||this.active.shift();
    slot.key=key;slot.light.position.set(x+.5,y+.94,z+.5);
    slot.light.intensity=4.8;slot.visuals.visible=true;this.active.push(slot);
  }
  remove(x,y,z) {
    const key=`${x},${y},${z}`,index=this.active.findIndex(slot=>slot.key===key);
    if(index<0)return;
    const [slot]=this.active.splice(index,1);
    slot.key=null;slot.light.intensity=0;slot.visuals.visible=false;
  }
  clear() {
    for(const slot of this.pool){slot.key=null;slot.light.intensity=0;slot.visuals.visible=false;}
    this.active.length=0;
  }
  update(time) {
    for(let i=0;i<this.active.length;i++)this.active[i].light.intensity=4.8+Math.sin(time*8+i)*.35;
  }
}
