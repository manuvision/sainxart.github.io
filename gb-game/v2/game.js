const DIRECTIONS={up:[0,-1,'north'],down:[0,1,'south'],left:[-1,0,'west'],right:[1,0,'east']};
const TILE=16,FOOT_OFFSET=13;
let TOWN,ROOMS,DOORS=[],SIGNS=[];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
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
 constructor(canvas,onChange){
  this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.ctx.imageSmoothingEnabled=false;
  this.onChange=onChange;this.player={x:184,y:189,dir:'south'};this.room='town';this.held=new Map();this.walking=false;this.walkTime=0;this.step=null;
  this.paused=false;this.dialog=null;this.clock=0;this.toastUntil=4;this.ready=false;this.visited=new Set();this.sound=new PocketSound();this.transition=0;this.warp=null;
 }
 async load(){
  const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Unable to load '+src));im.src=src;});
  const asset=name=>new URL('./assets/'+name,import.meta.url).href;
  const loadJSON=async name=>{const r=await fetch(asset(name));if(!r.ok)throw new Error('Missing '+name);return r.json();};
  [this.mapImage,this.sprites,this.atlas,this.world]=await Promise.all([loadImage(asset('town-atlas.png')),loadImage(asset('raccoon-master.png')),loadJSON('raccoon-master.json'),loadJSON('world.json')]);
  TOWN=this.world.town;ROOMS=this.world.rooms;DOORS=this.world.doors;SIGNS=this.world.signs;[this.player.x,this.player.y]=this.world.spawn;
  this.ready=true;this.notify();this.draw();
 }
 get map(){return this.room==='town'?TOWN:ROOMS[this.room];}
 notify(){this.onChange?.({location:this.map.name,visited:this.visited.size,paused:this.paused,sound:this.sound.enabled,prompt:this.prompt(),dialog:this.dialog});}
 press(action,id){
  if(this.warp||this.transition>0)return;
  if(this.held.has(id))return;
  this.held.set(id,action);
  if(action==='a')this.interact();
  if(action==='b'&&this.dialog){this.dialog=null;this.notify();}
  if(action==='start'){this.paused=!this.paused;this.notify();this.sound.tone(440,.1);}
  if(action==='select'){this.sound.toggle();this.notify();}
 }
 release(id){this.held.delete(id);}
 clear(){this.held.clear();this.walking=false;}
 prompt(){
  if(this.dialog)return 'A / B · CLOSE';if(this.paused)return 'START · RESUME';
  if(this.room!=='town')return distance(this.player,{x:this.map.exit[0],y:this.map.exit[1]})<23?'WALK DOWN · GO OUTSIDE':'EXPLORE THE ROOM';
  if(DOORS.some(d=>distance(this.player,d)<22))return 'WALK UP · ENTER';
  if(SIGNS.some(s=>distance(this.player,s)<23))return 'A · READ SIGN';
  return 'TAKE THE LONG WAY';
 }
 interact(){
  if(!this.ready||this.step)return;
  if(this.dialog){this.dialog=null;this.notify();return;}
  if(this.paused){this.paused=false;this.notify();return;}
  this.sound.tone(660,.16,.025,'triangle');
  if(this.room!=='town'){
   const room=this.map;
   if(distance(this.player,{x:room.exit[0],y:room.exit[1]})<25){this.beginWarp({id:'town',x:room.outside[0],y:room.outside[1],dir:'south'});return;}
   this.message(room.noteTitle,room.note);return;
  }
  const door=DOORS.find(d=>distance(this.player,d)<22);
  if(door){const room=ROOMS[door.id];this.beginWarp({id:door.id,x:room.spawn[0],y:room.spawn[1],dir:'north'});return;}
  const sign=SIGNS.find(s=>distance(this.player,s)<23);
  if(sign){this.message(sign.title,sign.text);return;}
  if(this.player.x>268){this.message('FOLLOW THE RIVER','Cool water, warm wood, and a bridge between neighbors. The jungle has a rhythm of its own.');return;}
  this.message('A LITTLE ADVENTURE','Follow the sandy paths. Cross the bridge. Visit the home, the canoe workshop, and the river keepers.');
 }
 message(title,text){this.dialog={title,text};this.walking=false;this.notify();}
 beginWarp(destination){this.warp={...destination,elapsed:0};this.step=null;this.clear();}
 changeRoom(id,x,y,dir){this.room=id;Object.assign(this.player,{x,y,dir});this.step=null;this.warp=null;this.walkTime=0;this.walking=false;this.transition=.12;this.toastUntil=this.clock+2.3;this.clear();this.notify();}
 canStand(x,y){
  const [left,top,right,bottom]=this.map.bounds;
  // Reserve the complete map tile, with the sprite's feet three pixels above its bottom.
  const x0=x-TILE/2,y0=y-FOOT_OFFSET,x1=x0+TILE,y1=y0+TILE;
  if(x0<left||x1>right||y0<top||y1>bottom)return false;
  return !this.map.solids.some(([rx,ry,w,h])=>x1>rx&&x0<rx+w&&y1>ry&&y0<ry+h);
 }
 doorway(x,y,direction){
  if(this.room==='town'&&direction==='up'){
   const door=DOORS.find(d=>d.x===x&&d.y===y);
   if(door){const room=ROOMS[door.id];return {id:door.id,x:room.spawn[0],y:room.spawn[1],dir:'north'};}
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
   const actions=[...this.held.values()];const direction=actions.filter(a=>DIRECTIONS[a]).at(-1);
   if(direction&&!this.step){
    const [dx,dy,face]=DIRECTIONS[direction];this.player.dir=face;
    const x=this.player.x+dx*TILE,y=this.player.y+dy*TILE,warp=this.doorway(x,y,direction);
    if(warp)this.beginWarp(warp);
    else if(this.canStand(x,y))this.step={fromX:this.player.x,fromY:this.player.y,toX:x,toY:y,progress:0};
   }
   // Key release finishes the current tile; turns begin only at a tile boundary.
   if(this.step){
    const s=this.step,speed=actions.includes('b')?76:48;s.progress=Math.min(1,s.progress+speed*dt/TILE);
    this.player.x=s.fromX+(s.toX-s.fromX)*s.progress;this.player.y=s.fromY+(s.toY-s.fromY)*s.progress;
    this.walking=true;this.walkTime+=dt*(actions.includes('b')?1.5:1);
    if(s.progress===1)this.step=null;
   }
  }
  if(!this.walking)this.walkTime=0;
  if(this.prompt()!==previousPrompt)this.notify();
  this.draw();
 }
 draw(){
  const c=this.ctx;c.imageSmoothingEnabled=false;c.fillStyle='#203a39';c.fillRect(0,0,240,160);
  if(!this.ready)return;
  const [sx,sy,w,h]=this.map.source;
  const cameraX=Math.round(w<240?(w-240)/2:clamp(this.player.x-120,0,w-240));
  const cameraY=Math.round(h<160?(h-160)/2:clamp(this.player.y-85,0,h-160));
  c.drawImage(this.mapImage,sx,sy,w,h,-cameraX,-cameraY,w,h);
  // Object bases and the raccoon's feet share one depth order. Canopies can overhang paths.
  const objects=this.room==='town'?this.map.objects:[];
  const drawObject=o=>{const [x,y,w,h]=this.world.assets[o.asset];c.drawImage(this.mapImage,x,y,w,h,o.x-cameraX,o.y-cameraY,w,h);};
  for(const o of objects)if(o.depth<=this.player.y)drawObject(o);
  const px=Math.round(this.player.x-cameraX),py=Math.round(this.player.y-cameraY);
  c.fillStyle='#223d4430';c.beginPath();c.ellipse(px,py-1,5,2,0,0,Math.PI*2);c.fill();
  const dir=this.player.dir==='west'?'east':this.player.dir;
  const offset={south:0,east:1,north:2}[dir];
  const index=this.walking?3+offset*4+Math.floor(this.walkTime/.16)%4:offset;
  const f=this.atlas.frames[index].frame;
  c.save();c.translate(px,py);if(this.player.dir==='west')c.scale(-1,1);c.drawImage(this.sprites,f.x,f.y,16,32,-8,-32,16,32);c.restore();
  for(const o of objects)if(o.depth>this.player.y)drawObject(o);
  if(this.clock<this.toastUntil&&!this.dialog){
   const name=this.map.name.toUpperCase();c.font='bold 8px monospace';const width=Math.min(224,c.measureText(name).width+18);
   c.fillStyle='#f6f1da';c.fillRect(6,6,width,18);c.fillStyle='#273d3a';c.fillRect(6,22,width,2);c.fillText(name,14,18);
  }
  if(this.dialog)this.drawDialog();
  if(this.paused){c.fillStyle='#112a2bce';c.fillRect(0,0,240,160);c.fillStyle='#e7edcf';c.textAlign='center';c.font='bold 13px monospace';c.fillText('TAKE A BREATHER',120,70);c.font='8px monospace';c.fillText('Press START to wander on',120,90);c.textAlign='left';}
  const fade=this.warp?this.warp.elapsed/.12:this.transition/.12;
  if(fade>0){c.fillStyle=`rgba(0,0,0,${Math.min(1,fade)})`;c.fillRect(0,0,240,160);}
 }
 drawDialog(){
  const c=this.ctx;c.fillStyle='#263b3c';c.fillRect(4,94,232,62);c.fillStyle='#f7f1dd';c.fillRect(6,96,228,58);c.strokeStyle='#9aa990';c.strokeRect(9.5,99.5,221,51);
  c.fillStyle='#304d46';c.font='bold 7px monospace';c.fillText(this.dialog.title,15,111);
  c.font='8px monospace';c.fillStyle='#263b3c';const words=this.dialog.text.split(' '),lines=[];let line='';
  for(const word of words){const next=line?line+' '+word:word;if(c.measureText(next).width>207){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
  lines.slice(0,3).forEach((l,i)=>c.fillText(l,15,123+i*10));c.fillStyle='#728878';c.fillRect(222,143,3,3);
 }
 getSnapshot(){return {ready:this.ready,room:this.room,player:{...this.player},tile:{x:Math.floor(this.player.x/TILE),y:Math.floor(this.player.y/TILE),size:TILE},movingTo:this.step?{x:this.step.toX,y:this.step.toY}:null,warping:!!this.warp,walking:this.walking,paused:this.paused,dialog:this.dialog,visited:[...this.visited],sound:this.sound.enabled,prompt:this.prompt()};}
}
