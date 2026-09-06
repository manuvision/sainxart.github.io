import { WATER_LEVEL } from './terrain.js?v=3.5';

export const MAP_CELL_SIZE=4;
export const MAP_REVEAL_RADIUS=128;
const TILE_CELLS=16,TILE_BLOCKS=TILE_CELLS*MAP_CELL_SIZE;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const keyOf=(x,z)=>`${x},${z}`;

/** Compact, coordinate-stable discovery. Coordinates passed to has() are cells. */
export class DiscoveryGrid {
  constructor(){this.tiles=new Map();this.count=0;}
  has(x,z){
    const tx=Math.floor(x/TILE_CELLS),tz=Math.floor(z/TILE_CELLS);
    const tile=this.tiles.get(keyOf(tx,tz)),i=(z-tz*TILE_CELLS)*TILE_CELLS+x-tx*TILE_CELLS;
    return !!(tile&&(tile[i>>3]&(1<<(i&7))));
  }
  reveal(x,z,radius=55){
    if(![x,z,radius].every(Number.isFinite)||radius<=0)return [];
    const added=[],safeRadius=Math.max(0,radius-MAP_CELL_SIZE*Math.SQRT1_2);
    const minX=Math.floor((x-radius)/MAP_CELL_SIZE),maxX=Math.floor((x+radius)/MAP_CELL_SIZE);
    const minZ=Math.floor((z-radius)/MAP_CELL_SIZE),maxZ=Math.floor((z+radius)/MAP_CELL_SIZE);
    for(let cz=minZ;cz<=maxZ;cz++)for(let cx=minX;cx<=maxX;cx++){
      if(((cx+.5)*MAP_CELL_SIZE-x)**2+((cz+.5)*MAP_CELL_SIZE-z)**2>safeRadius**2||this.has(cx,cz))continue;
      const tx=Math.floor(cx/TILE_CELLS),tz=Math.floor(cz/TILE_CELLS),key=keyOf(tx,tz);
      let tile=this.tiles.get(key);if(!tile){tile=new Uint8Array(32);this.tiles.set(key,tile);}
      const i=(cz-tz*TILE_CELLS)*TILE_CELLS+cx-tx*TILE_CELLS;
      tile[i>>3]|=1<<(i&7);this.count++;added.push([cx,cz]);
    }
    return added;
  }
  serialize(){
    return {version:1,cellSize:MAP_CELL_SIZE,tiles:Array.from(this.tiles,([key,bytes])=>[
      ...key.split(',').map(Number),Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('')
    ])};
  }
  static deserialize(value){
    const state=new DiscoveryGrid();
    if(!value||value.version!==1||value.cellSize!==MAP_CELL_SIZE||!Array.isArray(value.tiles))return state;
    for(const entry of value.tiles.slice(0,32768)){
      if(!Array.isArray(entry)||entry.length!==3)continue;
      const [x,z,hex]=entry;
      if(!Number.isSafeInteger(x)||!Number.isSafeInteger(z)||Math.abs(x)>1e8||Math.abs(z)>1e8||typeof hex!=='string'||!/^[\da-f]{64}$/i.test(hex))continue;
      const key=keyOf(x,z);if(state.tiles.has(key))continue;
      const bytes=new Uint8Array(32);
      for(let i=0;i<32;i++){
        let bits=bytes[i]=parseInt(hex.slice(i*2,i*2+2),16);
        while(bits){state.count+=bits&1;bits>>=1;}
      }
      state.tiles.set(key,bytes);
    }
    return state;
  }
}

/** North-up maps. Seed terrain is sampled only for discovered cells, never fog. */
export class ExplorationMap {
  constructor(world,{miniCanvas,fullCanvas}={}){
    this.world=world;this.miniCanvas=miniCanvas;this.fullCanvas=fullCanvas;
    // Exploration belongs to this play session, just like block edits.
    this.discovery=new DiscoveryGrid();
    this.position={x:0,z:0};this.yaw=0;this.initialized=false;this.disposed=false;
    this.tiles=new Map();this.pending=[];this.pendingCursor=0;
    this.drawClock=0;this.revealClock=0;this.pruneClock=0;
    this.lastReveal={x:Infinity,z:Infinity};
  }
  _canvas(width,height){
    const document=this.miniCanvas?.ownerDocument||this.fullCanvas?.ownerDocument||globalThis.document;
    const canvas=document?.createElement('canvas')||(typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):null);
    if(canvas){canvas.width=width;canvas.height=height;}return canvas;
  }
  _tile(tx,tz){
    const key=keyOf(tx,tz);let tile=this.tiles.get(key);
    if(tile)return tile;
    const discovered=this.discovery.tiles.get(key);if(!discovered)return null;
    const canvas=this._canvas(TILE_CELLS,TILE_CELLS),ctx=canvas?.getContext('2d');if(!ctx)return null;
    tile={key,tx,tz,canvas,ctx,state:new Uint8Array(TILE_CELLS*TILE_CELLS)};this.tiles.set(key,tile);
    for(let i=0;i<TILE_CELLS*TILE_CELLS;i++)if(discovered[i>>3]&(1<<(i&7)))this._queue(tile,i);
    return tile;
  }
  _queue(tile,index){
    if(tile.state[index])return;tile.state[index]=1;this.pending.push({tile,index});
  }
  _queueView(radiusX,radiusZ=radiusX){
    const x=this.position.x,z=this.position.z,tiles=[];
    for(let tz=Math.floor((z-radiusZ)/TILE_BLOCKS);tz<=Math.floor((z+radiusZ)/TILE_BLOCKS);tz++)
      for(let tx=Math.floor((x-radiusX)/TILE_BLOCKS);tx<=Math.floor((x+radiusX)/TILE_BLOCKS);tx++)
        if(this.discovery.tiles.has(keyOf(tx,tz)))tiles.push({tx,tz,d:(tx*TILE_BLOCKS-x)**2+(tz*TILE_BLOCKS-z)**2});
    tiles.sort((a,b)=>a.d-b.d);for(const tile of tiles)this._tile(tile.tx,tile.tz);
  }
  _color(cx,cz){
    const x=cx*MAP_CELL_SIZE+MAP_CELL_SIZE/2,z=cz*MAP_CELL_SIZE+MAP_CELL_SIZE/2;
    const terrain=this.world.terrain;
    const column=terrain?.column?terrain.column(x,z):{height:this.world.heightAt(x,z),biome:this.world.biomeAt(x,z)};
    const height=column.height,wet=column.wet??height<WATER_LEVEL;
    const palette={meadow:[119,151,103],jungle:[65,119,87],desert:[190,168,111],ice:[178,202,197]};
    let color=palette[column.biome]||palette.meadow;
    let shade=1;
    if(wet){
      const depth=clamp((WATER_LEVEL-height)/9,0,1);
      color=[69-depth*31,132-depth*38,144-depth*29];
      shade=.97+.03*Math.sin(cx*.9+cz*.6);
    }else{
      const near=this.discovery.has(cx-1,cz-1)
        ?(terrain?.column?terrain.column(x-MAP_CELL_SIZE,z-MAP_CELL_SIZE).height:this.world.heightAt(x-MAP_CELL_SIZE,z-MAP_CELL_SIZE))
        :height;
      shade=clamp(.95+(near-height)*.028+(height-18)*.002,.72,1.19);
      if(height>36){const rock=clamp((height-36)/28,0,.55);color=color.map((c,i)=>c*(1-rock)+[154,158,141][i]*rock);}
      if(height%6===0)shade*=.93;
    }
    return `rgb(${color.map(c=>Math.round(clamp(c*shade,0,255))).join(',')})`;
  }
  _processSamples(limit=96){
    const start=globalThis.performance?.now()??Date.now();let sampled=0,processed=0;
    while(this.pendingCursor<this.pending.length&&processed<limit){
      const {tile,index}=this.pending[this.pendingCursor++];processed++;
      if(this.tiles.get(tile.key)===tile){
        const lx=index%TILE_CELLS,lz=Math.floor(index/TILE_CELLS);
        tile.ctx.fillStyle=this._color(tile.tx*TILE_CELLS+lx,tile.tz*TILE_CELLS+lz);
        tile.ctx.fillRect(lx,lz,1,1);tile.state[index]=2;sampled++;
      }
      // Evicted jobs still consume time, so include them in both work limits.
      if(processed%16===0&&(globalThis.performance?.now()??Date.now())-start>1.5)break;
    }
    if(this.pendingCursor===this.pending.length){this.pending.length=0;this.pendingCursor=0;}
    else if(this.pendingCursor>4096){this.pending=this.pending.slice(this.pendingCursor);this.pendingCursor=0;}
    return sampled;
  }
  _isFullOpen(){
    if(!this.fullCanvas)return false;
    const dialog=this.fullCanvas.closest?.('dialog');return dialog?dialog.open:!!this.fullCanvas.getClientRects?.().length;
  }
  _fullExtents(){
    const bounds=this.fullCanvas?.getBoundingClientRect?.();
    const width=Math.max(1,Math.round(bounds?.width||560)),height=Math.max(1,Math.round(bounds?.height||560));
    const scale=Math.max(1,Math.min(width,height)/2-3)/400;
    return {x:width/(2*scale),z:height/(2*scale)};
  }
  _queueFullView(){
    const extent=this._fullExtents();this._queueView(extent.x+TILE_BLOCKS,extent.z+TILE_BLOCKS);
  }
  _retentionRadius(){
    if(!this._isFullOpen())return 850;
    const extent=this._fullExtents();
    // Keep the entire rectangular viewport and queued edge tiles, including its
    // corners. A fixed radius evicted visible tiles on wide or tall displays.
    return Math.max(850,Math.hypot(extent.x+TILE_BLOCKS*1.5,extent.z+TILE_BLOCKS*1.5));
  }
  update(position,yaw,dt=1/60){
    if(this.disposed||!position||![position.x,position.z].every(Number.isFinite))return;
    this.position.x=position.x;this.position.z=position.z;if(Number.isFinite(yaw))this.yaw=yaw;
    dt=clamp(Number.isFinite(dt)?dt:0,0,1);
    this.drawClock+=dt;this.revealClock+=dt;this.pruneClock+=dt;
    if(!this.initialized||this.revealClock>=.2){
      this.revealClock=0;
      if(!this.initialized||Math.hypot(position.x-this.lastReveal.x,position.z-this.lastReveal.z)>=2){
        const added=this.discovery.reveal(position.x,position.z,MAP_REVEAL_RADIUS);
        for(const [cx,cz] of added){
          const tx=Math.floor(cx/TILE_CELLS),tz=Math.floor(cz/TILE_CELLS),tile=this._tile(tx,tz);
          if(tile)this._queue(tile,(cz-tz*TILE_CELLS)*TILE_CELLS+cx-tx*TILE_CELLS);
        }
        this.lastReveal={x:position.x,z:position.z};
      }
    }
    const draw=!this.initialized||this.drawClock>=.16;
    if(draw){if(this._isFullOpen())this._queueFullView();else this._queueView(200);}
    this._processSamples();
    if(draw){
      this.drawClock=0;this._paint(this.miniCanvas,180,true);
      if(this._isFullOpen())this._paint(this.fullCanvas,400,false);
    }
    this.initialized=true;
    if(this.pruneClock>=10){
      this.pruneClock=0;const retention=this._retentionRadius();
      for(const [key,tile] of this.tiles)if(Math.hypot((tile.tx+.5)*TILE_BLOCKS-position.x,(tile.tz+.5)*TILE_BLOCKS-position.z)>retention)this.tiles.delete(key);
    }
  }
  _paint(canvas,radius,circular){
    const ctx=canvas?.getContext('2d');if(!ctx)return;
    const bounds=canvas.getBoundingClientRect?.(),fallback=circular?168:560;
    const width=Math.max(1,Math.round(bounds?.width||canvas.clientWidth||fallback));
    const height=Math.max(1,Math.round(bounds?.height||canvas.clientHeight||fallback));
    const dpr=Math.min(globalThis.devicePixelRatio||1,2);
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const midX=width/2,midY=height/2,edge=Math.min(width,height)/2-3,scale=edge/radius;
    ctx.save();
    if(circular){ctx.beginPath();ctx.arc(midX,midY,edge,0,Math.PI*2);ctx.clip();}
    ctx.fillStyle='#122423';ctx.fillRect(0,0,width,height);
    // Decorative fog uses no terrain samples and reveals no undiscovered shape.
    ctx.fillStyle='rgba(180,204,178,.05)';
    const driftX=((this.position.x*scale)%18+18)%18,driftZ=((this.position.z*scale)%18+18)%18;
    for(let y=-18;y<height+18;y+=18)for(let x=-18;x<width+18;x+=18)ctx.fillRect(x-driftX,y-driftZ,1,1);
    ctx.imageSmoothingEnabled=false;
    for(const tile of this.tiles.values()){
      const x=midX+(tile.tx*TILE_BLOCKS-this.position.x)*scale,z=midY+(tile.tz*TILE_BLOCKS-this.position.z)*scale,s=TILE_BLOCKS*scale;
      if(x+s<0||z+s<0||x>width||z>height)continue;
      ctx.drawImage(tile.canvas,x,z,s,s);
    }
    // A restrained surveying grid, with the player kept at the exact center.
    ctx.strokeStyle='rgba(226,233,196,.075)';ctx.lineWidth=1;ctx.beginPath();
    const spacing=circular?100:200;
    for(let x=Math.floor((this.position.x-width/scale/2)/spacing)*spacing;x<this.position.x+width/scale/2;x+=spacing){const px=midX+(x-this.position.x)*scale;ctx.moveTo(px,0);ctx.lineTo(px,height);}
    for(let z=Math.floor((this.position.z-height/scale/2)/spacing)*spacing;z<this.position.z+height/scale/2;z+=spacing){const py=midY+(z-this.position.z)*scale;ctx.moveTo(0,py);ctx.lineTo(width,py);}
    ctx.stroke();
    const vignette=ctx.createRadialGradient(midX,midY,edge*.25,midX,midY,edge);
    vignette.addColorStop(0,'rgba(3,15,16,0)');vignette.addColorStop(1,circular?'rgba(3,15,16,.4)':'rgba(3,15,16,.23)');
    ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
    ctx.save();ctx.translate(midX,midY);
    ctx.strokeStyle='rgba(255,239,184,.3)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,circular?11:15,0,Math.PI*2);ctx.stroke();
    ctx.rotate(-this.yaw);const marker=circular?6.5:9;
    ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=5;ctx.fillStyle='#fff2c5';ctx.strokeStyle='#24342b';ctx.lineWidth=1.4;
    ctx.beginPath();ctx.moveTo(0,-marker);ctx.lineTo(marker*.66,marker*.72);ctx.lineTo(0,marker*.36);ctx.lineTo(-marker*.66,marker*.72);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${circular?9:12}px ui-monospace,monospace`;ctx.fillStyle='#e7e5c7';
    ctx.shadowColor='#0b1719';ctx.shadowBlur=4;
    ctx.fillText('N',midX,circular?14:21);
    if(!circular){
      ctx.fillStyle='rgba(214,220,190,.65)';ctx.fillText('W',20,midY);ctx.fillText('E',width-20,midY);ctx.fillText('S',midX,height-20);
      ctx.textAlign='left';ctx.font='10px ui-monospace,monospace';ctx.fillText('EXPLORED TERRAIN',18,22);
      ctx.fillStyle='rgba(196,213,194,.55)';ctx.fillText(`X ${Math.round(this.position.x)}  /  Z ${Math.round(this.position.z)}`,18,height-23);
    }
    ctx.shadowBlur=0;ctx.font=`${circular?7:9}px ui-monospace,monospace`;ctx.fillStyle='rgba(225,227,197,.75)';
    if(circular){ctx.textAlign='center';ctx.fillText('180 BLOCKS',midX,height-15);}
    else{
      const length=100*scale,x=width-length-21,y=height-23;
      ctx.strokeStyle='rgba(225,227,197,.7)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-4);ctx.lineTo(x,y);ctx.lineTo(x+length,y);ctx.lineTo(x+length,y-4);ctx.stroke();
      ctx.textAlign='center';ctx.fillText('100 BLOCKS',x+length/2,y-12);
    }
    ctx.restore();
    if(circular){
      ctx.strokeStyle='rgba(217,220,171,.5)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(midX,midY,edge+.5,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='rgba(6,18,17,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(midX,midY,edge-2,0,Math.PI*2);ctx.stroke();
    }
    canvas.setAttribute?.('aria-label',circular?'Exploration minimap. North is up. Open the larger map.':'Explored terrain map. Dark areas are undiscovered.');
  }
  drawFull(){
    if(this.disposed)return;this._queueFullView();this._processSamples(128);this._paint(this.fullCanvas,400,false);
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    this.tiles.clear();this.pending.length=0;
  }
}

export default ExplorationMap;
