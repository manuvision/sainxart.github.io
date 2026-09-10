import {rules} from './combat.js';
import * as T from 'three';
import {anchors,setGroundPose,groundSprite} from './grounding.js';
// Each clone owns its texture transform: one animation must not change another's UVs.
export function createMobView(scene,camera,sheets,combat,village,shadowMaterial){
  const source=sheets['raccoon-machete'],frames=source.data.frames,attackDurations=[80,60,40,50,70,80,100];
  const views=combat.mobs.map(m=>{
    const texture=source.texture.clone();texture.needsUpdate=true;
    const material=new T.MeshStandardMaterial({map:texture,alphaTest:.5,roughness:1,side:T.DoubleSide});
    const actor=new T.Mesh(new T.PlaneGeometry(1,1),material);actor.castShadow=actor.receiveShadow=true;
    actor.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:texture,alphaTest:.5,side:T.DoubleSide});scene.add(actor);
    const shadow=new T.Mesh(new T.PlaneGeometry(1.02,.56),shadowMaterial.clone());shadow.rotation.x=-Math.PI/2;scene.add(shadow);
    const bar=document.createElement('div');bar.className='mob-health';bar.hidden=true;bar.setAttribute('role','progressbar');bar.setAttribute('aria-label','Enemy health');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',m.maxHP);bar.innerHTML='<i></i><span class="mob-energy">'+Array.from({length:m.maxEnergy},()=>'<b></b>').join('')+'</span>';document.querySelector('#mob-bars').append(bar);
    return {m,texture,material,actor,shadow,bar,last:''};
  });
  const orbs=new Map(),circle=new T.CircleGeometry(.11,16),ring=new T.RingGeometry(.14,.175,24);
  function update(){const time=combat.time;
    for(const v of views){const {m,actor,material,bar}=v;if(m.hp<=0){const fade=Math.max(0,1-(time-m.deadAt)/.45);bar.hidden=true;actor.castShadow=false;actor.visible=fade>0;v.shadow.visible=fade>0;if(fade>0){material.emissive.set(fade>.5?'#ff241a':'#000000');material.emissiveIntensity=fade>.5?1.2:0;material.transparent=true;material.opacity=fade;actor.position.y+=.003;}continue;}
      let f;if(m.action==='attack'){
        // Use the exact same authored frames and 115% playback as Tikoon, with no extra hold.
        let elapsed=m.elapsed*rules.enemyAttackPlayback*1000,index=0;
        while(index<6&&elapsed>=attackDurations[index])elapsed-=attackDurations[index++];
        f=frames.find(f=>f.filename===`attack_${m.dir}_${index}`);
      }else{const index=m.action==='walk'?Math.floor(m.walkTime/.16)%4:0;f=frames.find(f=>f.filename===`${m.action==='walk'?'walk':'idle'}_${m.dir}_${index}`);}
      if(v.last!==f.filename){v.last=f.filename;const r=f.frame,t=v.texture;t.repeat.set(r.w/t.image.width,r.h/t.image.height);t.offset.set(r.x/t.image.width,1-(r.y+r.h)/t.image.height);setGroundPose(actor,f,anchors['raccoon-machete'][f.filename],.066);}
      actor.position.set(m.x,village.groundHeight(m.x,m.z)+.008,m.z);groundSprite(actor,camera);v.shadow.position.set(m.x,village.groundHeight(m.x,m.z)+.004,m.z);
      const flashing=time<m.hurtUntil&&Math.floor((m.hurtUntil-time)*18)%2===0;material.emissive.set(flashing?'#ff241a':'#000000');material.emissiveIntensity=flashing?1.2:0;
      const p=new T.Vector3(m.x,actor.position.y+1.48,m.z).project(camera);
      bar.hidden=!(m.bar&&m.engaged)||p.z>1||Math.abs(p.x)>1.1||Math.abs(p.y)>1.1;
      if(!bar.hidden){bar.style.transform=`translate(${(p.x*.5+.5)*innerWidth}px,${(-p.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`;bar.firstElementChild.style.width=(m.hp/m.maxHP*100)+'%';bar.setAttribute('aria-valuenow',m.hp);bar.querySelectorAll('.mob-energy b').forEach((pip,i)=>pip.classList.toggle('filled',i<m.energy));}
    }
    for(const p of combat.drops){let v=orbs.get(p.id);if(!v){const g=new T.Group(),dot=new T.Mesh(circle,new T.MeshBasicMaterial({color:'#f63748',toneMapped:false,side:T.DoubleSide})),halo=new T.Mesh(ring,new T.MeshBasicMaterial({color:'#ff968b',transparent:true,opacity:.55,depthWrite:false,side:T.DoubleSide,toneMapped:false}));g.add(dot,halo);scene.add(g);v={g,halo};orbs.set(p.id,v);}
      v.g.position.set(p.x,village.groundHeight(p.x,p.z)+.23+Math.sin(time*4+p.id)*.035,p.z);v.g.quaternion.copy(camera.quaternion);v.halo.scale.setScalar(1+Math.sin(time*5+p.id)*.1);
    }
    for(const [id,v] of orbs)if(!combat.drops.some(p=>p.id===id)){scene.remove(v.g);v.g.children.forEach(o=>o.material.dispose());orbs.delete(id);}
  }
  return {update,snapshot:()=>views.map(v=>({id:v.m.id,frame:v.last,hitFlash:v.material.emissiveIntensity>0,barVisible:!v.bar.hidden,footY:v.actor.position.y,texture:v.texture.uuid}))};
}
