import * as THREE from './vendor/three.module.js';
import { Graphics } from './graphics.js';
import { World, BLOCK, BLOCK_NAMES, BLOCK_COLORS, WATER_LEVEL } from './world.js';
import { Player } from './player.js';
import { Ecosystem } from './ecosystem.js';
import { AmbientAudio } from './audio.js';
import { voxelRaycast, overlapsPlayer } from './interaction.js';

const $=id=>document.getElementById(id);
const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<760;
document.body.classList.toggle('touch-device',mobile);
const storage={get(key,fallback){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,value);}catch{}}};
let seed=new URLSearchParams(location.search).get('seed')||storage.get('voxyz:last-seed','')||randomSeed();
let world,ecosystem,player,graphics,audio,started=false,paused=false,elapsed=0,readyAt=0,selected=0,target=null,timeMode=storage.get('voxyz:light','cycle'),soundOn=false,fatal=false,wasRising=false;
let quality=storage.get('voxyz:quality','auto'),last=performance.now(),fpsTime=0,fpsFrames=0,fps=60,slowWindows=0,toastTimer,saveTimer,lastAction=0;
const cameraDirection=new THREE.Vector3(),daylightState={value:1};
const slots=[{id:1,name:'Meadow',color:'#7f9e55'},{id:2,name:'Earth',color:'#896a4c'},{id:3,name:'Stone',color:'#85908a'},{id:5,name:'Timber',color:'#8e704b'},{id:6,name:'Leaves',color:'#517e53'},{id:4,name:'Sand',color:'#d8c491'},{id:11,name:'Terracotta',color:'#b47758'},{id:7,name:'Water',color:'#57a8ab'},{id:10,name:'Lantern',color:'#e7ac57'}];
const biomeNames={meadow:'WILLOW WILDS',jungle:'EMERALD CANOPY',desert:'AMBER REACH',ice:'FROSTFALL'};
const torchLights=[];let outline,debris,debrisLife=0;
const flameGeometry=new THREE.BoxGeometry(.17,.24,.17),flameMaterial=new THREE.MeshBasicMaterial({color:0xffdb81});
const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=32;const glowContext=glowCanvas.getContext('2d'),glowGradient=glowContext.createRadialGradient(16,16,0,16,16,16);glowGradient.addColorStop(0,'rgba(255,224,143,.7)');glowGradient.addColorStop(.25,'rgba(255,185,81,.3)');glowGradient.addColorStop(1,'rgba(255,142,35,0)');glowContext.fillStyle=glowGradient;glowContext.fillRect(0,0,32,32);const glowTexture=new THREE.CanvasTexture(glowCanvas),glowMaterial=new THREE.SpriteMaterial({map:glowTexture,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
function randomSeed(){const words=['willow','fern','moss','clover','honey','brook','juniper','birch'];const n=crypto.getRandomValues(new Uint32Array(2));return `${words[n[0]%words.length]}-${(n[1]%89999)+10000}`;}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800);}
function showError(error){console.error(error);$('error-message').textContent=error?.message?.includes('WebGL')?'This little wilderness needs WebGL 2. Try Chrome or Safari with hardware acceleration enabled.':'The world could not finish growing. Please reload to try again.';$('error-screen').hidden=false;}
function blockIcon(color,id){if(id===10)return `<svg viewBox="0 0 40 44" aria-hidden="true"><path d="M17 20h6v21h-6z" fill="#8a603f"/><path d="M12 10h16v17H12z" fill="#bc853a"/><path d="M16 7h8v16h-8z" fill="#ffdf92"/><path d="M18 3h4v15h-4z" fill="#fff4bb"/></svg>`;return `<svg viewBox="0 0 40 44" aria-hidden="true"><path d="M20 3 37 12 20 22 3 12Z" fill="${color}"/><path d="M3 12 20 22v19L3 31Z" fill="${color}"/><path d="m20 22 17-10v19L20 41Z" fill="${color}"/><path d="M3 12 20 22v19L3 31Z" fill="#000" opacity=".16"/><path d="m20 22 17-10v19L20 41Z" fill="#000" opacity=".3"/>${id===1?'<path d="M3 19 20 29v12L3 31Z" fill="#836b43"/><path d="m20 29 17-10v12L20 41Z" fill="#64543b"/>':''}</svg>`;}
function select(index){selected=(index+slots.length)%slots.length;if(player)player.selected=selected;$('selected-name').textContent=slots[selected].name;document.querySelectorAll('.slot').forEach((button,i)=>{button.classList.toggle('selected',i===selected);button.setAttribute('aria-pressed',String(i===selected));});}
function makeHotbar(){slots.forEach((slot,i)=>{const button=document.createElement('button');button.className='slot';button.title=`${i+1} · ${slot.name}`;button.setAttribute('aria-label',`${slot.name} block, slot ${i+1}`);button.innerHTML=`<kbd>${i+1}</kbd>${blockIcon(slot.color,slot.id)}`;button.addEventListener('pointerdown',event=>event.stopPropagation());button.addEventListener('click',()=>select(i));$('hotbar').append(button);});select(0);}
async function enableAudio(){if(!audio)return;try{const active=await audio.start();if(!active)return;audio.setMuted(false);soundOn=true;document.body.classList.add('sound-on');$('sound-button').setAttribute('aria-label','Mute ambient sound');$('sound-check').checked=true;}catch{toast('Tap the sound button to enable forest sounds.');}}
function toggleAudio(){if(!soundOn){enableAudio();return;}soundOn=false;audio.setMuted(true);document.body.classList.remove('sound-on');$('sound-button').setAttribute('aria-label','Enable ambient sound');$('sound-check').checked=false;}
function newWorld(nextSeed){
  world?.save();world?.dispose();ecosystem?.dispose();seed=nextSeed;storage.set('voxyz:last-seed',seed);$('seed-input').value=seed;
  world=new World(graphics.scene,graphics.terrainMaterial,graphics.waterMaterial,seed,{radius:mobile?3:4});
  ecosystem=new Ecosystem(graphics.scene,world,{mobile});if(player)player.world=world;
  readyAt=0;started=false;paused=false;$('title-screen').hidden=false;$('game-ui').hidden=true;$('pause-screen').hidden=true;document.body.classList.remove('playing');
  $('start-button').disabled=true;$('start-label').textContent='Growing your world';$('start-arrow').textContent='· · ·';$('loading-status').textContent='Planting a little wilderness…';
  graphics.camera.position.set(8,world.heightAt(8,14)+2.65,14);graphics.camera.lookAt(-4,14,-12);graphics.renderer.shadowMap.needsUpdate=true;
  for(const light of torchLights){graphics.scene.remove(light);light.dispose?.();}torchLights.length=0;
  for(const [x,y,z,id] of world.edits.values())if(id===10&&torchLights.length<6)addTorch(x,y,z);
  world.update(8,14,8);
}
function begin(){if(!world.ready)return;started=true;paused=false;document.body.classList.add('playing');$('title-screen').hidden=true;$('game-ui').hidden=false;$('pause-screen').hidden=true;
  const view=new THREE.Euler().setFromQuaternion(graphics.camera.quaternion,'YXZ');player.yaw=view.y;player.pitch=view.x;
  player.teleport(graphics.camera.position.x,graphics.camera.position.y-1.62,graphics.camera.position.z);
  player.enable();if(!audio.started)enableAudio();
  toast(mobile?'A little world of your own. Use the sticks to wander.':'A little world of your own. Press Esc to take a breather.');
}
function pause(){if(!started||paused)return;paused=true;player.disable();const saved=world.save();$('save-note').textContent=saved?'Your changes save on this device.':'Storage is unavailable. Keep this tab open to retain your edits.';$('pause-screen').hidden=false;}
function resume(){paused=false;$('pause-screen').hidden=true;player.enable();}
function returnToTitle(){player.disable();world.save();started=false;paused=false;newWorld(seed);}
function settings(){if(started&&!paused)pause();$('seed-input').value=seed;$('settings-dialog').showModal();}
function addTorch(x,y,z){const light=new THREE.PointLight(0xffad4e,12,13,1.8);light.position.set(x+.5,y+.7,z+.5);light.userData.key=`${x},${y},${z}`;const flame=new THREE.Mesh(flameGeometry,flameMaterial),glow=new THREE.Sprite(glowMaterial);glow.scale.set(1.1,1.3,1);light.add(flame,glow);graphics.scene.add(light);torchLights.push(light);if(torchLights.length>6)graphics.scene.remove(torchLights.shift());}
function action(kind){
  $('world').dataset.lastAction=JSON.stringify({kind,started,paused,target:target?.id,time:performance.now()});
  if(!started||paused||!target||performance.now()-lastAction<180)return;lastAction=performance.now();
  if(kind==='break'){
    if(target.y<=0){toast('The deep bedrock holds this world together.');return;}
    if(world.setBlock(target.x,target.y,target.z,0)){audio.effect('break');burst(target);const key=`${target.x},${target.y},${target.z}`;for(let i=torchLights.length-1;i>=0;i--)if(torchLights[i].userData.key===key){graphics.scene.remove(torchLights[i]);torchLights.splice(i,1);}}
  }else if(kind==='place'){
    const [x,y,z]=target.previous;if(overlapsPlayer(x,y,z,player.position)){toast('A little more room before placing that block.');return;}
    const id=slots[selected].id;if(world.getBlock(x,y,z)!==0&&world.getBlock(x,y,z)!==7)return;
    if(world.setBlock(x,y,z,id)){audio.effect('place');if(id===10)addTorch(x,y,z);}
  }
  graphics.renderer.shadowMap.needsUpdate=true;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{world.save();ecosystem.invalidate();},900);
}
function burst(hit){debris.position.set(hit.x+.5,hit.y+.5,hit.z+.5);debris.material.color.set(slots.find(s=>s.id===hit.id)?.color||'#a3b27e');debris.visible=true;debrisLife=.65;const dummy=new THREE.Object3D();for(let i=0;i<18;i++){dummy.position.set((Math.random()-.5)*.8,(Math.random()-.5)*.8,(Math.random()-.5)*.8);dummy.rotation.set(Math.random()*3,Math.random()*3,0);dummy.updateMatrix();debris.setMatrixAt(i,dummy.matrix);}debris.instanceMatrix.needsUpdate=true;}
function daylight(){if(timeMode==='night')return .07;if(timeMode==='dusk')return .42;if(timeMode==='day')return 1;return .08+.92*THREE.MathUtils.smoothstep(Math.sin(elapsed/160+.95),-.25,.65);}
function updateTarget(){graphics.camera.getWorldDirection(cameraDirection);target=voxelRaycast(world,graphics.camera.position,cameraDirection,7,slots[selected].id===7);outline.visible=!!target&&started&&!paused;if(target){outline.position.set(target.x+.5,target.y+.5,target.z+.5);$('target-name').textContent=BLOCK_NAMES[target.id]||slots.find(s=>s.id===target.id)?.name||'Wild block';}else $('target-name').textContent='';}
function animate(now){
  if(fatal)return;
  requestAnimationFrame(animate);if(document.hidden){last=now;return;}const rawDt=(now-last)/1000,dt=Math.min(.05,rawDt);last=now;elapsed+=dt;
  try{
    if(started&&!paused){player.update(dt);document.body.classList.toggle('submerged',player.underwater);const rising=player.velocity.y>2&&!player.inWater;if(rising&&!wasRising)audio.effect('jump');wasRising=rising;}else document.body.classList.remove('submerged');
    const position=started?player.position:graphics.camera.position;
    world.update(position.x,position.z,2.5);world.tickWater(dt,position);
    const light=daylight();daylightState.value=light;
    ecosystem.update(dt,elapsed,position,light);graphics.update(elapsed,light,graphics.camera.position,started&&player.underwater);
    audio.update(dt,{daylight:light,underwater:started&&player.underwater,biome:world.biomeAt(position.x,position.z),moving:started&&!paused&&player.moving,inWater:started&&player.inWater});
    if(started&&!paused)updateTarget();else outline.visible=false;
    if(debrisLife>0){debrisLife-=dt;debris.position.y+=dt*(debrisLife*5-2);debris.scale.setScalar(1+(.65-debrisLife)*1.8);debris.material.opacity=Math.min(1,debrisLife*3);if(debrisLife<=0)debris.visible=false;}
    torchLights.forEach((light,i)=>light.intensity=10+Math.sin(elapsed*9+i)*1.4);
    graphics.render(world);
    if(world.ready&&!readyAt)readyAt=now;
    if(readyAt&&now-readyAt>800&&$('start-button').disabled){$('start-button').disabled=false;$('start-label').textContent='Enter the wild';$('start-arrow').textContent='→';$('loading-status').textContent='No hurry. It’s your world.';}
    fpsFrames++;fpsTime+=rawDt;if(fpsTime>=1){fps=Math.round(fpsFrames/fpsTime);$('fps').textContent=`${fps} FPS`;fpsFrames=0;fpsTime=0;$('biome-name').textContent=biomeNames[world.biomeAt(position.x,position.z)];$('coordinates').textContent=`${Math.floor(position.x)} / ${Math.floor(position.y)} / ${Math.floor(position.z)}`;$('world').dataset.diagnostics=JSON.stringify({fps,scale:graphics.scale,chunks:world.stats.chunks,triangles:world.stats.triangles,queued:world.stats.queued,position:position.toArray(),daylight:light,underwater:player.underwater,edits:world.edits.size,target:target?{x:target.x,y:target.y,z:target.z,id:target.id}:null,renderer:graphics.renderer.info.render});
      if(quality==='auto'&&readyAt&&now-readyAt>5000){slowWindows=fps<54?slowWindows+1:0;if(slowWindows>=3&&graphics.scale>.55){graphics.scale=Math.max(.55,graphics.scale-.1);graphics.resize();slowWindows=0;}}
    }
  }catch(error){fatal=true;showError(error);}
}
try{
  graphics=new Graphics($('world'),mobile);graphics.setQuality(quality);audio=new AmbientAudio();
  outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006,1.006,1.006)),new THREE.LineBasicMaterial({color:0xfff4c4,transparent:true,opacity:.7}));outline.visible=false;graphics.scene.add(outline);
  debris=new THREE.InstancedMesh(new THREE.BoxGeometry(.13,.13,.13),new THREE.MeshLambertMaterial({color:0xaab37f,transparent:true}),18);debris.visible=false;debris.frustumCulled=false;graphics.scene.add(debris);
  newWorld(seed);player=new Player(graphics.camera,$('world'),world,{onAction:action,onSelect:select,onPause:pause});makeHotbar();
  $('start-button').addEventListener('click',begin);$('pause-button').addEventListener('click',pause);$('resume-button').addEventListener('click',resume);$('title-button').addEventListener('click',returnToTitle);$('world-settings').addEventListener('click',settings);$('pause-settings').addEventListener('click',settings);$('sound-button').addEventListener('click',toggleAudio);$('sound-check').addEventListener('change',toggleAudio);$('random-seed').addEventListener('click',()=>$('seed-input').value=randomSeed());
  $('time-select').value=timeMode;$('time-select').addEventListener('change',event=>{timeMode=event.target.value;storage.set('voxyz:light',timeMode);graphics.renderer.shadowMap.needsUpdate=true;});$('quality-select').value=quality;$('quality-select').addEventListener('change',event=>{quality=event.target.value;storage.set('voxyz:quality',quality);graphics.setQuality(quality);});
  $('grow-button').addEventListener('click',()=>{const next=$('seed-input').value.trim()||randomSeed();$('settings-dialog').close();if(next!==seed){player.disable();newWorld(next);const url=new URL(location.href);url.searchParams.set('seed',seed);history.replaceState({},'',url);}else toast('Your world settings are saved.');});
  window.addEventListener('pagehide',()=>world.save());window.addEventListener('blur',()=>{if(started&&!paused)pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){world.save();if(started&&!paused)pause();}});
  $('world').addEventListener('webglcontextlost',event=>{event.preventDefault();showError(new Error('WebGL context lost'));});
  for(const type of ['pointerdown','pointerup','click','contextmenu'])$('world').addEventListener(type,event=>{const events=JSON.parse($('world').dataset.inputEvents||'[]');events.push({type,button:event.button,enabled:player.enabled,paused,target:target?.id,at:performance.now()});$('world').dataset.inputEvents=JSON.stringify(events.slice(-8));});
  // A read-only inspectable surface helps verify performance and engine state.
  window.voxyz={get world(){return world;},get player(){return player;},get graphics(){return graphics;},get state(){return {seed,started,paused,fps,daylight:daylightState.value,selected,target,quality,scale:graphics.scale,stats:world.stats};}};
  requestAnimationFrame(animate);
}catch(error){showError(error);}
