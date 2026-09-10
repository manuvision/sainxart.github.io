// Combat is independent of rendering so every strike, cooldown and drop can be tested.
export const rules=Object.freeze({mobHP:5,energy:3,enemyEnergy:2,playerHP:6,playerReach:1.5,enemyReach:1.16,enemyAttackRange:1.13,enemyStopRange:1.08,damage:1,heal:1,dropChance:.05,
  aggro:4.5,loseInterest:6.5,homeRadius:2,leash:6,walk:1.05,chase:1.4,
  energyReaction:.12,attackCooldownMin:.52,attackCooldownMax:.80,enemyAttackPlayback:1.15,strike:.14/1.15,attackEnd:.48/1.15,invulnerability:.65,magnet:1.8});
export const spawns=[[2,3.1],[-6.6,3.9],[1.8,-3.2],[10.2,3],[-8.8,-2.4]];
const directions={south:[0,1],east:[1,0],north:[0,-1],west:[-1,0]};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const facing=(x,z)=>Math.abs(x)>Math.abs(z)?x>0?'east':'west':z>0?'south':'north';
export function isForwardReach(a,b,reach=rules.playerReach){const [x,z]=directions[a.dir];return Math.hypot(b.x-a.x,b.z-a.z)<=reach&&(b.x-a.x)*x+(b.z-a.z)*z>=0;}
export function createCombat({player,blocked,random=Math.random,homes=spawns}){
  let time=0,dropId=0;const drops=[],events=[];
  player.hp=rules.playerHP;player.maxHP=rules.playerHP;player.hurtUntil=0;player.energy=rules.energy;player.maxEnergy=rules.energy;let energyTime=0;
  const mobs=homes.map(([x,z],id)=>({id,x,z,home:{x,z},hp:rules.mobHP,maxHP:rules.mobHP,energy:rules.enemyEnergy,maxEnergy:rules.enemyEnergy,energyTime:0,dir:'south',state:'wander',
    engaged:false,bar:false,action:'idle',elapsed:0,walkTime:0,nextAttack:0,attackAt:0,
    attackHit:false,target:null,wait:random()*1.5,
    hurtUntil:0,lastSwing:-1,deadAt:null,attacks:0,damageTaken:0}));
  function clearLine(a,b){const n=Math.ceil(distance(a,b)/.15);for(let i=1;i<=n;i++)if(blocked(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;return true;}
  function inArc(a,b,reach,width){const [x,z]=directions[a.dir],dx=b.x-a.x,dz=b.z-a.z;return distance(a,b)<=reach&&dx*x+dz*z>=.05&&Math.abs(dx*z-dz*x)<=width&&clearLine(a,b);}
  function hitMobs(swing){if(player.hp<=0)return;for(const m of mobs){
    if(m.hp<=0||m.lastSwing===swing||!(isForwardReach(player,m)&&clearLine(player,m)))continue;
    m.lastSwing=swing;m.hp--;m.damageTaken++;m.bar=true;m.engaged=true;m.hurtUntil=time+.45;
    events.push({type:'mob-hit',id:m.id,time});
    if(m.hp===0){m.state='dead';m.action='idle';m.deadAt=time;m.engaged=false;events.push({type:'defeat',id:m.id,time});}
    else if(m.state!=='attack'){m.action='idle';m.state='chase';}
  }}
  function damagePlayer(){if(player.hp<=0||time<player.hurtUntil)return false;
    if(player.action==='roll'&&player.elapsed>=.06&&player.elapsed<=.4)return false;
    player.hp=Math.max(0,player.hp-rules.damage);player.hurtUntil=time+rules.invulnerability;
    events.push({type:'player-hit',hp:player.hp,time});return true;
  }
  function cutHerbs(cut){for(const h of cut)if(random()<rules.dropChance){drops.push({id:dropId++,x:h.x,z:h.z,born:time,magnetized:false});events.push({type:'drop',time});}}
  function step(m,tx,tz,speed,dt){let dx=tx-m.x,dz=tz-m.z,l=Math.hypot(dx,dz);if(l<.08)return false;
    const amount=Math.min(l,speed*dt),angle=Math.atan2(dz,dx);
    // Steer around trunks and other bodies instead of cutting through solid scenery.
    for(const turn of [0,.6,-.6,1.15,-1.15]){dx=Math.cos(angle+turn)*amount;dz=Math.sin(angle+turn)*amount;
      const next={x:m.x+dx,z:m.z+dz};if(distance(next,m.home)>rules.leash||blocked(next.x,next.z))continue;
      if(mobs.some(o=>o!==m&&o.hp>0&&distance(next,o)<.43))continue;
      if(player.hp>0&&distance(next,player)<.48)continue;
      m.x=next.x;m.z=next.z;m.dir=facing(dx,dz);m.action='walk';m.walkTime+=dt*speed/1.9;return true;
    }return false;
  }
  function wanderTarget(m){for(let i=0;i<12;i++){const a=random()*Math.PI*2,r=.35+random()*(rules.homeRadius-.35),p={x:m.home.x+Math.cos(a)*r,z:m.home.z+Math.sin(a)*r};if(!blocked(p.x,p.z)&&clearLine(m,p))return p;}return {...m.home};}
  function spendEnergy(){if(player.hp<=0||player.energy<1)return false;player.energy--;return true;}
  function update(dt){time+=dt;if(player.hp>0&&player.energy<player.maxEnergy){energyTime+=dt;while(energyTime>=1&&player.energy<player.maxEnergy){energyTime-=1;player.energy++;}}if(player.energy===player.maxEnergy)energyTime=0;
    for(const m of mobs){if(m.hp<=0)continue;if(m.energy<m.maxEnergy){m.energyTime+=dt;while(m.energyTime>=1&&m.energy<m.maxEnergy){m.energyTime-=1;m.energy++;if(m.energy===1)m.nextAttack=Math.max(m.nextAttack,time+random()*rules.energyReaction);}}if(m.energy===m.maxEnergy)m.energyTime=0;const d=distance(m,player),homeDistance=distance(m,m.home);
      if(player.hp<=0){m.state='return';m.engaged=false;m.bar=false;}
      if(m.state==='attack'&&player.hp>0){m.elapsed=time-m.attackAt;m.action='attack';
        if(!m.attackHit&&m.elapsed>=rules.strike){m.attackHit=true;if(inArc(m,player,rules.enemyReach,.85))damagePlayer();}
        if(m.elapsed<rules.attackEnd)continue;m.state='chase';m.action='idle';
      }
            if(m.state!=='return'&&player.hp>0&&d<rules.aggro&&clearLine(m,player)){m.engaged=true;if(m.damageTaken>0)m.bar=true;if(m.state==='wander')m.state='chase';}
      if(m.engaged&&(homeDistance>rules.leash-.25||d>rules.loseInterest)){m.state='return';m.engaged=false;m.bar=false;}
      m.action='idle';m.elapsed=0;
      if(m.state==='return'){if(homeDistance<.15){m.state='wander';m.wait=.6;m.target=null;}else step(m,m.home.x,m.home.z,rules.walk,dt);continue;}
      if(m.engaged){
        m.state='chase';
        if(d<=rules.enemyAttackRange&&m.energy>0&&time>=m.nextAttack&&clearLine(m,player)){m.dir=facing(player.x-m.x,player.z-m.z);m.state='attack';m.action='attack';m.attackAt=time;m.attackHit=false;m.elapsed=0;m.energy--;m.nextAttack=time+rules.attackCooldownMin+random()*(rules.attackCooldownMax-rules.attackCooldownMin);m.attacks++;events.push({type:'mob-attack',id:m.id,time});}
        else if(d>rules.enemyStopRange)step(m,player.x,player.z,rules.chase,dt);
        else m.dir=facing(player.x-m.x,player.z-m.z);
      }else{
        m.wait-=dt;if(m.wait>0)continue;if(!m.target)m.target=wanderTarget(m);
        if(distance(m,m.target)<.1){m.target=null;m.wait=.5+random()*1.8;}
        else if(!step(m,m.target.x,m.target.z,rules.walk,dt)){m.target=null;m.wait=.3+random()*.4;}
      }
    }
    for(let i=drops.length-1;i>=0;i--){const p=drops[i],d=distance(p,player);if(player.hp<=0||player.hp>=player.maxHP)continue;
      if(d<rules.magnet&&clearLine(p,player)){p.magnetized=true;const speed=2.2+Math.max(0,rules.magnet-d)*3,step=Math.min(d,speed*dt);if(d>0){p.x+=(player.x-p.x)/d*step;p.z+=(player.z-p.z)/d*step;}
        if(distance(p,player)<.25){const before=player.hp;player.hp=Math.min(player.maxHP,player.hp+rules.heal);events.push({type:'heal',amount:player.hp-before,time});drops.splice(i,1);}}
    }
    if(events.length>120)events.splice(0,events.length-120);
  }
  return {spendEnergy,mobs,drops,update,hitMobs,cutHerbs,get time(){return time;},snapshot:()=>({time,rules,mobs:mobs.map(m=>({...m,target:m.target&&{...m.target},home:{...m.home}})),drops:drops.map(d=>({...d})),events:events.map(e=>({...e}))})};
}
