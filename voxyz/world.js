import * as THREE from './vendor/three.module.js';
import { Terrain, BLOCK, BLOCK_NAMES, BLOCK_COLORS, CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL, PAD, indexOf, seedNumber, isSolid } from './terrain.js';
import { meshChunk } from './mesher.js';
export { BLOCK, BLOCK_NAMES, BLOCK_COLORS, CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL, isSolid };
export const palette=BLOCK_COLORS;
export const names=BLOCK_NAMES;
const keyOf=(x,y,z)=>x+','+y+','+z;
const chunkKey=(x,z)=>x+','+z;
const neighbors=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const now=()=>globalThis.performance?.now()??Date.now();

/** Eight is a source; seven through one are finite, receding stream levels. */
export function nextWaterLevel(x,y,z,getBlock,getLevel) {
  const id=getBlock(x,y,z);
  if(id!==BLOCK.AIR&&id!==BLOCK.WATER)return 0;
  if(id===BLOCK.WATER&&getLevel(x,y,z)===8)return 8;
  if(getBlock(x,y+1,z)===BLOCK.WATER)return 7;
  let result=0;
  for(const [dx,,dz] of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]]) {
    if(getBlock(x+dx,y,z+dz)!==BLOCK.WATER)continue;
    const support=getBlock(x+dx,y-1,z+dz);
    if(support===BLOCK.AIR)continue; // An unsupported stream falls before spreading.
    result=Math.max(result,getLevel(x+dx,y,z+dz)-1);
  }
  return Math.max(0,result);
}

export class World {
  constructor(scene,terrainMaterial,waterMaterial,seed,{radius=4}={}) {
    this.scene=scene;this.terrainMaterial=terrainMaterial;this.waterMaterial=waterMaterial;
    this.seed=seedNumber(seed);this.seedLabel=String(seed);this.radius=radius;
    this.terrain=new Terrain(this.seed);this.chunks=new Map();this.edits=new Map();this.fluidChanges=new Map();
    this.revisions=new Map();this.pending=new Set();this.dirty=new Set();this.completed=[];this.workers=[];
    this.waterQueue=[];this.waterCursor=0;this.waterQueued=new Set();this.sleepingWater=new Map();this.waterClock=0;
    this.center={x:0,z:1};this.ready=false;this.disposed=false;this.requestId=0;this.needsSave=false;this.saveClock=0;
    this.stats={chunks:0,triangles:0,queued:0,waterCells:0,workers:0};
    this.storageKey='voxyz:world:v1:'+this.seed;
    try {
      const saved=JSON.parse(globalThis.localStorage?.getItem(this.storageKey)||'null');
      if(saved?.edits)for(const edit of saved.edits) {
        if(Array.isArray(edit)&&edit.length>=4&&edit.every(Number.isFinite)&&edit[1]>=0&&edit[1]<WORLD_HEIGHT&&edit[3]>=0&&edit[3]<=14)this.edits.set(keyOf(...edit),edit);
      }
    }catch{ /* Storage can be unavailable in private browsing or at quota. */ }
    if(typeof Worker!=='undefined') {
      const count=(globalThis.navigator?.hardwareConcurrency||4)>=4?2:1;
      for(let i=0;i<count;i++) {
        try {
          const worker=new Worker(new URL('./world-worker.js',import.meta.url),{type:'module'});
          const slot={worker,busy:false,task:null};
          worker.onmessage=({data})=>{
            slot.busy=false;
            if(data.error){this.pending.delete(slot.task?.key);if(slot.task)this.dirty.add(slot.task.key);}
            else this.completed.push(data);
            slot.task=null;
          };
          worker.onerror=()=>{ if(slot.task)this.pending.delete(slot.task.key);slot.busy=false;slot.failed=true;worker.terminate(); };
          this.workers.push(slot);
        } catch{break;}
      }
    }
    this.stats.workers=this.workers.length;
    for(const edit of this.edits.values())this._activateWater(edit[0],edit[1],edit[2]);
  }
  biomeAt(x,z){return this.terrain.biomeAt(x,z);}
  heightAt(x,z){return this.terrain.heightAt(Math.floor(x),Math.floor(z));}
  getBlock(x,y,z) {
    x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);
    if(y<0)return BLOCK.STONE;
    if(y>=WORLD_HEIGHT)return BLOCK.AIR;
    const key=keyOf(x,y,z),override=this.fluidChanges.get(key)||this.edits.get(key);
    if(override)return override[3];
    const cx=Math.floor(x/CHUNK_SIZE),cz=Math.floor(z/CHUNK_SIZE),chunk=this.chunks.get(chunkKey(cx,cz));
    return chunk?chunk.blocks[indexOf(x-cx*CHUNK_SIZE,y,z-cz*CHUNK_SIZE)]:this.terrain.sampleBlock(x,y,z);
  }
  getWaterLevel(x,y,z) {
    x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);
    if(y<0||y>=WORLD_HEIGHT)return 0;
    const key=keyOf(x,y,z),override=this.fluidChanges.get(key)||this.edits.get(key);
    if(override)return override[3]===BLOCK.WATER?(override[4]??8):0;
    const cx=Math.floor(x/CHUNK_SIZE),cz=Math.floor(z/CHUNK_SIZE),chunk=this.chunks.get(chunkKey(cx,cz));
    return chunk?chunk.levels[indexOf(x-cx*CHUNK_SIZE,y,z-cz*CHUNK_SIZE)]:(this.terrain.sampleBlock(x,y,z)===BLOCK.WATER?8:0);
  }
  setBlock(x,y,z,id) {
    if(![x,y,z,id].every(Number.isFinite))return false;
    x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);
    if(y<=0||y>=WORLD_HEIGHT||!Number.isInteger(id)||id<0||id>14)return false;
    if(this.getBlock(x,y,z)===id&&id!==BLOCK.WATER)return false;
    const key=keyOf(x,y,z),edit=[x,y,z,id,id===BLOCK.WATER?8:0];
    this.edits.set(key,edit);this.fluidChanges.delete(key);this.needsSave=true;
    this._applyCell(edit);this._activateWater(x,y,z);
    return true;
  }
  _applyCell([x,y,z,id,level]) {
    const cx=Math.floor(x/CHUNK_SIZE),cz=Math.floor(z/CHUNK_SIZE);
    // Update halos too: exposed faces and AO remain seamless after edits at borders.
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++) {
      const nx=cx+dx,nz=cz+dz,lx=x-nx*CHUNK_SIZE,lz=z-nz*CHUNK_SIZE;
      if(lx< -1||lx>CHUNK_SIZE||lz< -1||lz>CHUNK_SIZE)continue;
      const key=chunkKey(nx,nz),chunk=this.chunks.get(key);
      this.revisions.set(key,(this.revisions.get(key)||0)+1);
      if(chunk){const i=indexOf(lx,y,lz);chunk.blocks[i]=id;chunk.levels[i]=level||0;this.dirty.add(key);}
    }
  }
  _activateWater(x,y,z) {
    for(const [dx,dy,dz] of [[0,0,0],...neighbors]) {
      const ny=y+dy;
      if(ny<=0||ny>=WORLD_HEIGHT)continue;
      const key=keyOf(x+dx,ny,z+dz);
      if(!this.waterQueued.has(key)){this.waterQueued.add(key);this.waterQueue.push([x+dx,ny,z+dz,key]);}
    }
  }
  tickWater(dt,playerPosition={x:0,z:0}) {
    this.waterClock+=dt;this.saveClock+=dt;
    if(this.needsSave&&this.saveClock>2){this.save();this.saveClock=0;}
    if(this.waterClock<.105)return;
    this.waterClock=0;
    // Distant simulation sleeps in chunk buckets and resumes when revisited.
    // Dropping those entries would permanently freeze saved distant water edits.
    const pcx=Math.floor(playerPosition.x/CHUNK_SIZE),pcz=Math.floor(playerPosition.z/CHUNK_SIZE);
    for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++) {
      const bucketKey=chunkKey(pcx+dx,pcz+dz),bucket=this.sleepingWater.get(bucketKey);
      if(!bucket)continue;
      for(const [key,entry] of bucket) {
        if(Math.abs(entry[0]-playerPosition.x)>48||Math.abs(entry[2]-playerPosition.z)>48)continue;
        if(!this.waterQueued.has(key)){this.waterQueued.add(key);this.waterQueue.push(entry);}
        bucket.delete(key);
      }
      if(!bucket.size)this.sleepingWater.delete(bucketKey);
    }
    const count=Math.min(96,this.waterQueue.length-this.waterCursor),time=now();
    for(let i=0;i<count&&now()-time<2.5;i++) {
      const [x,y,z,key]=this.waterQueue[this.waterCursor++];this.waterQueued.delete(key);
      if(Math.abs(x-playerPosition.x)>48||Math.abs(z-playerPosition.z)>48) {
        const bucketKey=chunkKey(Math.floor(x/CHUNK_SIZE),Math.floor(z/CHUNK_SIZE));
        let bucket=this.sleepingWater.get(bucketKey);
        if(!bucket){bucket=new Map();this.sleepingWater.set(bucketKey,bucket);}
        bucket.set(key,[x,y,z,key]);continue;
      }
      const old=this.getBlock(x,y,z);
      if(old!==BLOCK.AIR&&old!==BLOCK.WATER)continue;
      const level=nextWaterLevel(x,y,z,this.getBlock.bind(this),this.getWaterLevel.bind(this));
      if((level===0&&old===BLOCK.AIR)||(old===BLOCK.WATER&&this.getWaterLevel(x,y,z)===level))continue;
      const edit=[x,y,z,level>0?BLOCK.WATER:BLOCK.AIR,level];
      this.fluidChanges.set(key,edit);this._applyCell(edit);this._activateWater(x,y,z);
    }
    if(this.waterCursor>2048||this.waterCursor===this.waterQueue.length){this.waterQueue=this.waterQueue.slice(this.waterCursor);this.waterCursor=0;}
    this.stats.waterCells=this.fluidChanges.size;
  }
  _editsFor(cx,cz) {
    const edits=[],x0=cx*CHUNK_SIZE-1,z0=cz*CHUNK_SIZE-1,x1=x0+PAD,z1=z0+PAD;
    for(const map of [this.edits,this.fluidChanges])for(const edit of map.values())if(edit[0]>=x0&&edit[0]<x1&&edit[2]>=z0&&edit[2]<z1)edits.push(edit);
    return edits;
  }
  _geometry(data) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));
    geometry.setAttribute('color',new THREE.BufferAttribute(data.colors,3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(data.uvs,2));
    geometry.setIndex(new THREE.BufferAttribute(data.indices,1));
    geometry.computeBoundingSphere();
    return geometry;
  }
  _accept(result) {
    const key=chunkKey(result.cx,result.cz);this.pending.delete(key);
    if(Math.hypot(result.cx-this.center.x,result.cz-this.center.z)>this.radius+2)return;
    if(result.version!==(this.revisions.get(key)||0)){if(this.chunks.has(key))this.dirty.add(key);return;}
    const previous=this.chunks.get(key);
    if(previous){this.scene.remove(previous.mesh,previous.waterMesh);previous.mesh.geometry.dispose();previous.waterMesh.geometry.dispose();this.stats.triangles-=previous.triangles;}
    const mesh=new THREE.Mesh(this._geometry(result.solid),this.terrainMaterial);
    mesh.position.set(result.cx*CHUNK_SIZE,0,result.cz*CHUNK_SIZE);mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.name='voxel terrain '+key;
    const waterMesh=new THREE.Mesh(this._geometry(result.water),this.waterMaterial);
    waterMesh.position.copy(mesh.position);waterMesh.renderOrder=2;waterMesh.name='voxel water '+key;waterMesh.receiveShadow=true;
    const triangles=(result.solid.indices.length+result.water.indices.length)/3;
    this.chunks.set(key,{cx:result.cx,cz:result.cz,blocks:result.blocks,levels:result.levels,mesh,waterMesh,triangles});
    this.scene.add(mesh,waterMesh);this.stats.triangles+=triangles;
  }
  update(x,z,budgetMs=3) {
    if(this.disposed)return;
    const start=now();this.center.x=Math.floor(x/CHUNK_SIZE);this.center.z=Math.floor(z/CHUNK_SIZE);
    while(this.completed.length&&now()-start<Math.max(1,budgetMs))this._accept(this.completed.shift());
    const candidates=[];
    for(let dz=-this.radius;dz<=this.radius;dz++)for(let dx=-this.radius;dx<=this.radius;dx++) {
      const distance=dx*dx+dz*dz;
      if(distance>(this.radius+.45)**2)continue;
      const cx=this.center.x+dx,cz=this.center.z+dz,key=chunkKey(cx,cz);
      if(!this.pending.has(key)&&(!this.chunks.has(key)||this.dirty.has(key)))candidates.push({cx,cz,key,distance,kind:this.chunks.has(key)?'mesh':'generate'});
    }
    candidates.sort((a,b)=>(a.kind==='mesh'?-20:0)+a.distance-((b.kind==='mesh'?-20:0)+b.distance));
    const slots=this.workers.filter(slot=>!slot.failed&&!slot.busy);
    const fallback=!this.workers.some(slot=>!slot.failed);
    for(let i=0;i<Math.min(candidates.length,fallback?1:slots.length);i++) {
      if(now()-start>budgetMs&&this.completed.length)break;
      const task=candidates[i],{cx,cz,key,kind}=task,chunk=this.chunks.get(key);
      const request={kind,cx,cz,requestId:++this.requestId,seed:this.seed,version:this.revisions.get(key)||0};
      if(kind==='generate')request.edits=this._editsFor(cx,cz);
      else {request.blocks=chunk.blocks.slice();request.levels=chunk.levels.slice();}
      this.pending.add(key);this.dirty.delete(key);
      if(fallback) {
        const generated=kind==='generate'?this.terrain.generateChunk(cx,cz,request.edits):{blocks:request.blocks,levels:request.levels};
        this.completed.push({...request,...generated,...meshChunk(generated.blocks,generated.levels,cx,cz,this.seed)});
      } else {
        const slot=slots[i];slot.busy=true;slot.task=task;
        slot.worker.postMessage(request,kind==='mesh'?[request.blocks.buffer,request.levels.buffer]:[]);
      }
    }
    for(const [key,chunk] of this.chunks) {
      if(Math.hypot(chunk.cx-this.center.x,chunk.cz-this.center.z)<=this.radius+2)continue;
      this.scene.remove(chunk.mesh,chunk.waterMesh);chunk.mesh.geometry.dispose();chunk.waterMesh.geometry.dispose();
      this.stats.triangles-=chunk.triangles;this.chunks.delete(key);this.dirty.delete(key);
    }
    if(!this.ready) {
      this.ready=true;
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(!this.chunks.has(chunkKey(this.center.x+dx,this.center.z+dz)))this.ready=false;
    }
    this.stats.chunks=this.chunks.size;this.stats.queued=this.pending.size+candidates.length;
  }
  save() {
    try {const storage=globalThis.localStorage;if(!storage)return false;storage.setItem(this.storageKey,JSON.stringify({version:1,seed:this.seedLabel,edits:[...this.edits.values()]}));this.needsSave=false;return true;}catch{return false;}
  }
  dispose() {
    this.save();this.disposed=true;
    for(const {worker} of this.workers)worker.terminate();
    for(const chunk of this.chunks.values()){this.scene.remove(chunk.mesh,chunk.waterMesh);chunk.mesh.geometry.dispose();chunk.waterMesh.geometry.dispose();}
    this.chunks.clear();this.completed.length=0;
  }
}
