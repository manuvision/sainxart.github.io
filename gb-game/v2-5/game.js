const DIRECTIONS={up:[0,-1,'north'],down:[0,1,'south'],left:[-1,0,'west'],right:[1,0,'east']};
const TILE=16,FOOT_OFFSET=13;
const FACING={north:'up',south:'down',west:'left',east:'right'};
const SAVE_KEY='manu.vision:gb-game:v2-5:inventory';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

class PocketSound{
 constructor(){this.enabled=false;this.ctx=null;this.nextNote=0;this.note=0;}
 toggle(){this.enabled=!this.enabled;if(this.enabled){this.ctx??=new AudioContext();this.ctx.resume();this.nextNote=0;}return this.enabled;}
 tone(frequency,duration=.12,volume=.018,type='sine'){
  if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;
  const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=frequency;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g).connect(this.ctx.destination);o.start(t);o.stop(t+duration+.02);
 }
 update(time,paused){if(!this.enabled||paused||time<this.nextNote)return;const notes=[261.63,329.63,392,523.25,440,392,329.63,293.66];this.tone(notes[this.note++%notes.length],.8,.012,'triangle');this.nextNote=time+.85;}
}

export class PocketGame{
 constructor(canvas,onChange,options={}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.ctx.imageSmoothingEnabled=false;
  this.onChange=onChange;this.player={x:184,y:189,dir:'south'};this.room='town';this.held=new Map();this.walking=false;this.walkTime=0;this.step=null;
  this.paused=false;this.dialog=null;this.clock=0;this.toastUntil=4;this.ready=false;this.visited=new Set();this.sound=new PocketSound();this.transition=0;this.warp=null;
  this.motion=null;this.pendingAction=null;this.equipped=false;this.pickups=new Set();this.clips={};this.storage=null;
  try{this.storage=Object.hasOwn(options,'storage')?options.storage:globalThis.localStorage;const saved=JSON.parse(this.storage?.getItem(SAVE_KEY)??'null');if(saved?.machete===true){this.equipped=true;this.pickups.add('machete');}}catch{}
 }
 async load(){
  const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Unable to load '+src));im.src=src;});
  const asset=name=>new URL('./assets/'+name+'?v=v2-5-20260909',import.meta.url).href;
  const loadJSON=async name=>{const r=await fetch(asset(name));if(!r.ok)throw new Error('Missing '+name);return r.json();};
  [this.mapImage,this.sprites,this.atlas,this.world,this.equippedImage,this.equippedAtlas,this.rollImage,this.rollAtlas,this.itemImage]=await Promise.all([loadImage(asset('town-atlas.png')),loadImage(asset('raccoon-master.png')),loadJSON('raccoon-master.json'),loadJSON('world.json'),loadImage(asset('raccoon-machete.png')),loadJSON('raccoon-machete.json'),loadImage(asset('raccoon-roll.png')),loadJSON('raccoon-roll.json'),loadImage(asset('machete-item.png'))]);
  for(const direction of Object.keys(FACING))for(const kind of ['idle','walk','attack','roll'])this.clips[kind+'_'+direction]=(kind==='roll'?this.rollAtlas:this.equippedAtlas).frames.filter(f=>f.filename.startsWith(kind+'_'+direction+'_'));
  [this.player.x,this.player.y]=this.world.spawn;
  this.ready=true;this.notify();this.draw();
 }
 get map(){return this.room==='town'?this.world.town:this.world.rooms[this.room];}
 notify(){this.onChange?.({location:this.map.name,visited:this.visited.size,paused:this.paused,sound:this.sound.enabled,prompt:this.prompt(),dialog:this.dialog,equipped:this.equipped});}
 press(action,id){
  if(!this.ready||this.warp||this.transition>0)return;
  if(this.held.has(id))return;
  this.held.set(id,action);
  if(action==='start'){this.paused=!this.paused;this.pendingAction=null;this.held.clear();this.held.set(id,action);this.walking=false;this.notify();this.sound.tone(440,.1);return;}
  if(action==='select'){this.sound.toggle();this.notify();}
  if(action==='a'||action==='b'){
   if(this.dialog){this.dialog=null;this.notify();return;}
   if(this.paused||this.motion)return;
   if(this.step){this.pendingAction=action;return;}
   const facing=[...this.held.values()].filter(a=>DIRECTIONS[a]).at(-1);if(facing)this.player.dir=DIRECTIONS[facing][2];
   this.performAction(action);
  }
 }
 release(id){this.held.delete(id);}
 clear(){this.held.clear();this.pendingAction=null;this.walking=false;}
 frontTile(){const [dx,dy]=DIRECTIONS[FACING[this.player.dir]];return [Math.round((this.player.x-8)/TILE)+dx,Math.round((this.player.y-FOOT_OFFSET)/TILE)+dy];}
 interactionAhead(){
  if(!this.ready||this.step||this.motion)return null;
  const [col,row]=this.frontTile(),x=col*TILE+8,y=row*TILE+FOOT_OFFSET;
  const item=(this.world.interactables??[]).find(o=>o.room===this.room&&!this.pickups.has(o.id)&&(o.tiles??[o.tile]).some(t=>t&&t[0]===col&&t[1]===row));
  if(item)return item;
  if(this.room==='town'){
   const sign=(this.world.signs??[]).find(o=>o.x===x&&o.y===y);if(sign)return {...sign,type:'note'};
  }
  const destination=this.doorway(x,y,FACING[this.player.dir]);return destination?{type:'door',destination}:null;
 }
 prompt(){
  if(this.dialog)return 'A / B · CLOSE';if(this.paused)return 'START · RESUME';
  const target=this.interactionAhead();
  if(target?.type==='machete')return 'A · EQUIP MACHETE';
  if(target?.type==='note')return 'A · READ';
  if(target?.type==='door')return 'A · '+(target.destination.id==='town'?'EXIT':'ENTER');
  return this.equipped?'A · ROLL   B · ATTACK':'A · ROLL';
 }
 interact(){return this.performAction('a');}
 performAction(action){
  if(!this.ready||this.paused||this.dialog||this.step||this.motion||this.warp||this.transition>0)return;
  if(action==='a'){
   const target=this.interactionAhead();
   if(target){
    this.sound.tone(660,.16,.025,'triangle');
    if(target.type==='door'){this.beginWarp(target.destination);return;}
    if(target.type==='machete'){
     this.equipped=true;this.pickups.add(target.id);try{this.storage?.setItem(SAVE_KEY,JSON.stringify({machete:true}));}catch{}
     this.message('MACHETE EQUIPPED','B swings. A rolls, or interacts with something directly ahead. Your machete is saved.');return;
    }
    this.message(target.title??target.name??'RIVER VILLAGE',target.text??'');return;
   }
   this.startRoll();
  }else if(action==='b'){
   if(!this.equipped){this.message('THE BOATWRIGHT\'S MACHETE','A machete is waiting in the canoe workshop. Face it and press A to equip it.');return;}
   this.startMotion('attack',this.player.x,this.player.y);
   this.sound.tone(190,.12,.02,'triangle');
  }
 }
 startRoll(){
  const direction=FACING[this.player.dir],[dx,dy]=DIRECTIONS[direction];let x=this.player.x,y=this.player.y;
  // Check every complete traversed tile before committing to the roll.
  for(let n=1;n<=2;n++){const tx=this.player.x+dx*TILE*n,ty=this.player.y+dy*TILE*n;if(this.doorway(tx,ty,direction)||!this.canStand(tx,ty))break;x=tx;y=ty;}
  if(x===this.player.x&&y===this.player.y){this.sound.tone(90,.06,.01);return;}
  this.startMotion('roll',x,y);this.sound.tone(250,.12,.012,'triangle');
 }
 startMotion(kind,x,y){
  const frames=this.clips[kind+'_'+this.player.dir];
  this.motion={kind,dir:this.player.dir,elapsed:0,duration:frames.reduce((sum,f)=>sum+f.duration,0)/1000,from:{x:this.player.x,y:this.player.y},to:{x,y},frame:0,active:false};
  this.pendingAction=null;this.walking=false;this.walkTime=0;this.notify();
 }
 advanceMotion(dt){
  const m=this.motion,frames=this.clips[m.kind+'_'+m.dir];m.elapsed=Math.min(m.duration,m.elapsed+dt);
  let elapsed=m.elapsed*1000,index=0;while(index<frames.length-1&&elapsed>=frames[index].duration){elapsed-=frames[index].duration;index++;}
  m.frame=index;m.active=!!frames[index].active;
  if(m.kind==='roll'){
   const start=frames[index].rootMotion.progress,end=frames[Math.min(index+1,frames.length-1)].rootMotion.progress;
   const progress=start+(end-start)*Math.min(1,elapsed/frames[index].duration);
   this.player.x=m.from.x+(m.to.x-m.from.x)*progress;this.player.y=m.from.y+(m.to.y-m.from.y)*progress;
  }
  if(m.elapsed>=m.duration){Object.assign(this.player,m.to);this.motion=null;this.walkTime=0;this.notify();}
 }
 message(title,text){this.dialog={title,text};this.walking=false;this.notify();}
 beginWarp(destination){this.warp={...destination,elapsed:0};this.step=null;this.motion=null;this.clear();}
 changeRoom(id,x,y,dir){this.room=id;Object.assign(this.player,{x,y,dir});this.step=null;this.motion=null;this.warp=null;this.walkTime=0;this.walking=false;this.transition=.12;this.toastUntil=this.clock+2.3;this.clear();this.notify();}
 canStand(x,y){
  const [left,top,right,bottom]=this.map.bounds;
  // Reserve the complete map tile, with the sprite's feet three pixels above its bottom.
  const x0=x-TILE/2,y0=y-FOOT_OFFSET,x1=x0+TILE,y1=y0+TILE;
  if(x0<left||x1>right||y0<top||y1>bottom)return false;
  if(this.map.solids.some(([rx,ry,w,h])=>x1>rx&&x0<rx+w&&y1>ry&&y0<ry+h))return false;
  return !(this.world.interactables??[]).some(o=>o.room===this.room&&o.type==='machete'&&!this.pickups.has(o.id)&&x1>o.tile[0]*TILE&&x0<(o.tile[0]+1)*TILE&&y1>o.tile[1]*TILE&&y0<(o.tile[1]+1)*TILE);
 }
 doorway(x,y,direction){
  if(this.room==='town'&&direction==='up'){
   const door=this.world.doors.find(d=>d.x===x&&d.y===y);
   if(door){const room=this.world.rooms[door.id];return {id:door.id,x:room.spawn[0],y:room.spawn[1],dir:'north'};}
  }else if(this.room!=='town'&&direction==='down'&&x===this.map.exit[0]&&y===this.map.exit[1]){
   return {id:'town',x:this.map.outside[0],y:this.map.outside[1],dir:'south'};
  }
  return null;
 }
 update(dt){
  if(!this.ready)return;
  this.clock+=dt;this.transition=Math.max(0,this.transition-dt);this.sound.update(this.clock,this.paused);
  if(this.warp){
   this.warp.elapsed+=dt;
   if(this.warp.elapsed>=.12){const w=this.warp;if(w.id!=='town')this.visited.add(w.id);this.changeRoom(w.id,w.x,w.y,w.dir);}
   this.draw();return;
  }
  const previousPrompt=this.prompt();this.walking=false;
  if(!this.paused&&!this.dialog&&this.transition===0){
   if(this.motion){this.advanceMotion(dt);this.draw();return;}
   if(this.pendingAction&&!this.step){const action=this.pendingAction;this.pendingAction=null;this.performAction(action);this.draw();return;}
   const actions=[...this.held.values()];const direction=actions.filter(a=>DIRECTIONS[a]).at(-1);
   if(direction&&!this.step){
    const [dx,dy,face]=DIRECTIONS[direction];this.player.dir=face;
    const x=this.player.x+dx*TILE,y=this.player.y+dy*TILE,warp=this.doorway(x,y,direction);
    if(warp)this.beginWarp(warp);
    else if(this.canStand(x,y))this.step={fromX:this.player.x,fromY:this.player.y,toX:x,toY:y,progress:0};
   }
   // Key release finishes the current tile; turns begin only at a tile boundary.
   if(this.step){
    const s=this.step,speed=48;s.progress=Math.min(1,s.progress+speed*dt/TILE);
    this.player.x=s.fromX+(s.toX-s.fromX)*s.progress;this.player.y=s.fromY+(s.toY-s.fromY)*s.progress;
    this.walking=true;this.walkTime+=dt;
    if(s.progress===1)this.step=null;
   }
  }
  if(!this.walking)this.walkTime=0;
  if(this.prompt()!==previousPrompt)this.notify();
  this.draw();
 }
 draw(){
  const c=this.ctx;c.imageSmoothingEnabled=false;c.fillStyle='#292b3d';c.fillRect(0,0,240,160);
  if(!this.ready)return;
  const [sx,sy,w,h]=this.map.source;
  const cameraX=Math.round(w<240?(w-240)/2:clamp(this.player.x-120,0,w-240));
  const cameraY=Math.round(h<160?(h-160)/2:clamp(this.player.y-(this.world.cameraOffsetY??85),0,h-160));
  c.drawImage(this.mapImage,sx,sy,w,h,-cameraX,-cameraY,w,h);
  // Object bases and the raccoon's feet share one depth order. Canopies can overhang paths.
  const objects=this.map.objects??[];
  const drawObject=o=>{const [x,y,w,h]=this.world.assets[o.asset];c.drawImage(this.mapImage,x,y,w,h,o.x-cameraX,o.y-cameraY,w,h);};
  for(const o of objects)if(o.depth<=this.player.y)drawObject(o);
  this.drawPickups(cameraX,cameraY,false);
  const px=Math.round(this.player.x-cameraX),py=Math.round(this.player.y-cameraY);
  c.fillStyle='#223d4430';c.beginPath();c.ellipse(px,py-1,5,2,0,0,Math.PI*2);c.fill();
  const pose=this.spritePose(),f=pose.frame.frame,pivot=pose.frame.pivot??{x:8,y:32};
  c.save();c.translate(px-(pose.mirrored?1:0),py);if(pose.mirrored)c.scale(-1,1);c.drawImage(pose.image,f.x,f.y,f.w,f.h,-pivot.x,-pivot.y,f.w,f.h);c.restore();
  this.drawPickups(cameraX,cameraY,true);
  for(const o of objects)if(o.depth>this.player.y)drawObject(o);
  if(this.clock<this.toastUntil&&!this.dialog){
   const name=this.map.name.toUpperCase();c.font='bold 8px monospace';const width=Math.min(224,c.measureText(name).width+18);
   c.fillStyle='#f6f1da';c.fillRect(6,6,width,18);c.fillStyle='#273d3a';c.fillRect(6,22,width,2);c.fillText(name,14,18);
  }
  if(this.dialog)this.drawDialog();
  else if(!this.paused&&this.clock>=this.toastUntil){c.font='bold 7px monospace';const text=this.prompt();const width=Math.ceil(c.measureText(text).width)+12;c.fillStyle='#1e2635dd';c.fillRect(240-width,147,width,13);c.fillStyle='#eee6d5';c.fillText(text,246-width,156);}
  if(this.paused){c.fillStyle='#112a2bce';c.fillRect(0,0,240,160);c.fillStyle='#e7edcf';c.textAlign='center';c.font='bold 13px monospace';c.fillText('TAKE A BREATHER',120,70);c.font='8px monospace';c.fillText('Press START to wander on',120,90);c.textAlign='left';}
  const fade=this.warp?this.warp.elapsed/.12:this.transition/.12;
  if(fade>0){c.fillStyle=`rgba(0,0,0,${Math.min(1,fade)})`;c.fillRect(0,0,240,160);}
 }
 spritePose(){
  if(this.motion){const m=this.motion;return {sheet:m.kind==='roll'?'raccoon-roll':'raccoon-machete',image:m.kind==='roll'?this.rollImage:this.equippedImage,tag:m.kind+'_'+m.dir,index:m.frame,frame:this.clips[m.kind+'_'+m.dir][m.frame],mirrored:false};}
  if(this.equipped){const kind=this.walking?'walk':'idle',index=this.walking?Math.floor(this.walkTime/.16)%4:0,tag=kind+'_'+this.player.dir;return {sheet:'raccoon-machete',image:this.equippedImage,tag,index,frame:this.clips[tag][index],mirrored:false};}
  const offset={south:0,east:1,north:2,west:1}[this.player.dir],index=this.walking?3+offset*4+Math.floor(this.walkTime/.16)%4:offset;
  return {sheet:'raccoon-master',image:this.sprites,tag:(this.walking?'walk_':'idle_')+this.player.dir,index,frame:this.atlas.frames[index],mirrored:this.player.dir==='west'};
 }
 drawPickups(cameraX,cameraY,foreground){
  const c=this.ctx;
  for(const item of this.world.interactables??[]){
   if(item.room!==this.room||item.type!=='machete'||this.pickups.has(item.id))continue;
   if((item.tile[1]*TILE+FOOT_OFFSET>this.player.y)!==foreground)continue;
   const x=item.tile[0]*TILE-cameraX,y=item.tile[1]*TILE-cameraY;
   // A raised tray keeps the loose blade distinct from an approaching character.
   const [tx,ty,tw,th]=this.world.assets.pickup_tray;
   c.drawImage(this.mapImage,tx,ty,tw,th,x,y-9,tw,th);
   c.drawImage(this.itemImage,x,y-9);
   if(Math.floor(this.clock*2)%2===0){c.fillStyle='#eee6d5';c.fillRect(x+17,y-7,1,3);c.fillRect(x+16,y-6,3,1);}
  }
 }
 drawDialog(){
  const c=this.ctx;c.fillStyle='#263b3c';c.fillRect(4,94,232,62);c.fillStyle='#f7f1dd';c.fillRect(6,96,228,58);c.strokeStyle='#9aa990';c.strokeRect(9.5,99.5,221,51);
  c.fillStyle='#304d46';c.font='bold 7px monospace';c.fillText(this.dialog.title,15,111);
  c.font='8px monospace';c.fillStyle='#263b3c';const words=this.dialog.text.split(' '),lines=[];let line='';
  for(const word of words){const next=line?line+' '+word:word;if(c.measureText(next).width>207){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
  lines.slice(0,3).forEach((l,i)=>c.fillText(l,15,123+i*10));c.fillStyle='#728878';c.fillRect(222,143,3,3);
 }
 getSnapshot(){const pose=this.ready?this.spritePose():null;return {ready:this.ready,room:this.room,player:{...this.player},tile:{x:Math.floor(this.player.x/TILE),y:Math.floor(this.player.y/TILE),size:TILE},movingTo:this.step?{x:this.step.toX,y:this.step.toY}:null,action:this.motion?structuredClone(this.motion):null,pendingAction:this.pendingAction,equipped:this.equipped,pickups:[...this.pickups],sprite:pose?{sheet:pose.sheet,tag:pose.tag,frame:pose.index,source:pose.frame.frame,mirrored:pose.mirrored}:null,warping:!!this.warp,walking:this.walking,paused:this.paused,dialog:this.dialog,visited:[...this.visited],sound:this.sound.enabled,prompt:this.prompt()};}
}
