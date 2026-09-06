export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 80;
export const PAD = CHUNK_SIZE + 2;
export const WATER_LEVEL = 12;
export const BLOCK = Object.freeze({ AIR:0, GRASS:1, DIRT:2, STONE:3, SAND:4, WOOD:5, LEAVES:6, WATER:7, SNOW:8, CACTUS:9, TORCH:10, BRICK:11, GLASS:12, JUNGLE_LEAVES:13, ICE:14 });
export const BLOCK_NAMES = ['Air','Meadow','Earth','Stone','Sand','Oak','Leaves','Water','Snow','Cactus','Lantern','Clay brick','Glass','Jungle leaves','Ice'];
export const BLOCK_COLORS = ['#000000','#82ad5f','#a17a58','#89968b','#e8d19e','#866544','#709b4c','#57c7c8','#e5eee1','#719458','#ffc55d','#b97459','#c2e3d9','#4e9152','#aacfd3'];
export const palette = BLOCK_COLORS;
export const names = BLOCK_NAMES;
export const indexOf = (x,y,z) => (y * PAD + z + 1) * PAD + x + 1;
export const isSolid = id => id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.TORCH;
export function seedNumber(value) {
  if (typeof value === 'number') return value >>> 0;
  let h=2166136261;
  for (const c of String(value)) h=Math.imul(h^c.charCodeAt(0),16777619);
  return h >>> 0;
}
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
export function hash2(x,z,seed=0) {
  let h = Math.imul(x,374761393) ^ Math.imul(z,668265263) ^ seed;
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967295;
}
export function noise2(x,z,seed=0) {
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
  const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  return mix(mix(hash2(ix,iz,seed),hash2(ix+1,iz,seed),u),mix(hash2(ix,iz+1,seed),hash2(ix+1,iz+1,seed),u),v)*2-1;
}

/** Coordinate-only generation gives identical chunk halos regardless of creation order. */
export class Terrain {
  constructor(seed) { this.seed=seedNumber(seed); this.columns=new Map(); }
  biomeAt(x,z) {
    if (Math.hypot(x,z)<95) return 'meadow';
    const n=noise2(x/100,z/100,this.seed+917)*45;
    if(x+n>90) return 'desert';
    if(z+n<-100) return 'ice';
    if(x+n<-85 || z+n>130) return 'jungle';
    return 'meadow';
  }
  heightAt(x,z) { return this.column(x,z).height; }
  column(x,z) {
    x=Math.floor(x);z=Math.floor(z);
    const key=x+','+z;
    if(this.columns.has(key))return this.columns.get(key);
    const seed=this.seed;
    const distance=Math.hypot(x,z+8);
    const broad=noise2(x/43,z/43,seed+13);
    let height=15 + broad*5 + noise2(x/16,z/16,seed+33)*1.7;
    const mountain= Math.max(0,1-Math.abs(noise2(x/68,z/68,seed+17)))* Math.max(0,noise2(x/110+8,z/110-7,seed+51)+.25);
    height+=smooth(35,115,distance)*mountain*34;
    // The opening valley is an authored composition, with every detail varied by seed.
    const peak=(cx,cz,rx,rz,h)=>Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2))*h;
    height+=peak(-53,-61,23,23,18)+peak(51,-70,24,25,22)+peak(-8,-103,29,27,25);
    const pondDistance=Math.sqrt((x/20)**2+((z+8)/22)**2);
    const pondFloor=8+pondDistance*4.5+noise2(x/7,z/7,seed+5)*.5;
    height=mix(height,pondFloor,1-smooth(.85,1.45,pondDistance));
    // A dry, rising forest ring encloses the opening water instead of spilling
    // into distant flat marsh. The northward river cuts through it below.
    const forestRing=smooth(1.03,1.28,pondDistance)*(1-smooth(48,78,distance));
    height=mix(height,Math.max(height,16+noise2(x/19,z/19,seed+884)*2),forestRing);
    const riverX=5*Math.sin(z/27)+noise2(z/90,1,seed+63)*3;
    const riverDistance=Math.abs(x-riverX);
    const riverMask=(1-smooth(3,8,riverDistance))*smooth(-20,-45,z);
    height=mix(height,9.2+riverDistance*.28,riverMask);
    const biome=this.biomeAt(x,z);
    if(biome==='desert') height+=Math.max(0,noise2(x/25,z/25,seed+41))*5;
    const spawn=Math.hypot((x-12)/1.2,z-22);
    if(spawn<7)height=mix(height,15,1-smooth(3,7,spawn));
    height=clamp(Math.floor(height),3,WORLD_HEIGHT-17);
    const column={height,biome,wet:height<WATER_LEVEL};
    if(this.columns.size>120000)this.columns.clear();
    this.columns.set(key,column);
    return column;
  }
  terrainBlock(x,y,z) {
    if(y<0)return BLOCK.STONE;
    if(y>=WORLD_HEIGHT)return BLOCK.AIR;
    const {height,biome}=this.column(x,z);
    if(y>height)return y<=WATER_LEVEL?BLOCK.WATER:BLOCK.AIR;
    if(y<height-4 && y>2) {
      // Smooth, winding cave pockets. Keep the shallow lake floor sealed.
      const caveA=noise2(x/18+y*.067,z/18-y*.053,this.seed+777);
      const caveB=noise2(x/21-y*.081,z/22+y*.051,this.seed+213);
      if(Math.abs(caveA)<.075 && Math.abs(caveB)<.2 && (height>18||y<6))return BLOCK.AIR;
    }
    if(y===height) {
      if(height<=WATER_LEVEL+1||biome==='desert')return BLOCK.SAND;
      if(biome==='ice'||height>45)return BLOCK.SNOW;
      return BLOCK.GRASS;
    }
    if(y>height-3)return height<=WATER_LEVEL+1||biome==='desert'?BLOCK.SAND:BLOCK.DIRT;
    return BLOCK.STONE;
  }
  tree(cellX,cellZ) {
    const seed=this.seed, density=hash2(cellX,cellZ,seed+218);
    const x=cellX*8+Math.floor(hash2(cellX,cellZ,seed+287)*6)+1;
    const z=cellZ*8+Math.floor(hash2(cellX,cellZ,seed+481)*6)+1;
    const {height,biome}=this.column(x,z);
    const threshold=biome==='jungle'?.87:biome==='desert'?.18:biome==='ice'?.7:.8;
    if(density>threshold||height<=WATER_LEVEL+1||height>47)return null;
    if(Math.hypot(x-12,z-22)<4.5)return null;
    // Keep the near bank and central view toward the pond legible.
    if(Math.abs(x-(z+8)*.4)<3.8&&z>7&&z<27)return null;
    const conifer=biome==='ice'||(biome==='meadow'&&hash2(cellX,cellZ,seed+772)<.38);
    const tall=biome==='desert'?4+Math.floor(density*12):biome==='jungle'?17+Math.floor(density*7):conifer?13+Math.floor(density*10):13+Math.floor(density*11);
    return {x,z,y:height+1,h:tall,biome,density,conifer,lean:hash2(cellX,cellZ,seed+567)>.5?1:-1};
  }
  treeBlock(tree,x,y,z) {
    const dx=x-tree.x,dz=z-tree.z,dy=y-tree.y;
    if(dy<0)return BLOCK.AIR;
    if(tree.biome==='desert') {
      // Most desert plants are cactus; rare skeletal trees have angular branches.
      if(tree.density<.105) {
        if(dx===0&&dz===0&&dy<tree.h)return BLOCK.CACTUS;
        if(dz===0&&Math.abs(dx)===1&&dy===2)return BLOCK.CACTUS;
        if(dz===0&&dx===1&&dy===3)return BLOCK.CACTUS;
      } else {
        if(dx===0&&dz===0&&dy<tree.h)return BLOCK.WOOD;
        if(dz===0&&Math.abs(dx)<=3&&dy===tree.h-2)return BLOCK.WOOD;
        if(Math.abs(dx)===3&&dz===0&&dy===tree.h-1)return BLOCK.WOOD;
      }
      return BLOCK.AIR;
    }
    if(dx===0&&dz===0&&dy<tree.h)return BLOCK.WOOD;
    if(tree.conifer) {
      if(dy<2||dy>tree.h+1)return BLOCK.AIR;
      const taper=(tree.h+1-dy)/(tree.h-1);
      const r=Math.min(5,Math.max(0,Math.floor(taper*4.8+(dy%3===0?.45:0))));
      if(Math.abs(dx)<=r&&Math.abs(dz)<=r&&Math.abs(dx)+Math.abs(dz)<=r*1.65+.5) {
        return (tree.biome==='ice'&&dy%3===0&&Math.abs(dx)+Math.abs(dz)>r)?BLOCK.SNOW:BLOCK.LEAVES;
      }
      return BLOCK.AIR;
    }
    const jungle=tree.biome==='jungle';
    // Overlapping tiered crowns give tall broadleaf trees an irregular silhouette.
    // The lower branches remain visible beneath their smaller side crowns.
    const leaf=jungle?BLOCK.JUNGLE_LEAVES:BLOCK.LEAVES;
    const clusters=[
      [0,tree.h-1,0,jungle?5:4],
      [tree.lean*3,tree.h-5,1,3],
      [-tree.lean*2,tree.h-3,-2,3],
    ];
    if(dy===tree.h-6&&dz===1&&dx*tree.lean>=0&&dx*tree.lean<=3)return BLOCK.WOOD;
    for(const [ox,cy,oz,radius] of clusters) {
      const delta=dy-cy;
      if(delta<-2||delta>2)continue;
      const layerRadius=radius-(delta===2?2:delta===1?1:delta===-2?1:0);
      const ax=Math.abs(dx-ox),az=Math.abs(dz-oz);
      if(ax<=layerRadius&&az<=layerRadius&&ax+az<=layerRadius*1.65+.2) {
        if(ax===layerRadius&&az===layerRadius&&hash2(x+y,z,this.seed+713)>.5)continue;
        return leaf;
      }
    }
    return BLOCK.AIR;
  }
  sampleBlock(x,y,z) {
    x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);
    let id=this.terrainBlock(x,y,z);
    if(id!==BLOCK.AIR)return id;
    for(let cz=Math.floor((z-7)/8);cz<=Math.floor((z+7)/8);cz++) {
      for(let cx=Math.floor((x-7)/8);cx<=Math.floor((x+7)/8);cx++) {
        const tree=this.tree(cx,cz);
        if(!tree)continue;
        const treeId=this.treeBlock(tree,x,y,z);
        if(treeId===BLOCK.WOOD||id===BLOCK.AIR)id=treeId;
      }
    }
    return id;
  }
  generateChunk(cx,cz,edits=[]) {
    const blocks=new Uint8Array(PAD*PAD*WORLD_HEIGHT), levels=new Uint8Array(blocks.length);
    const startX=cx*CHUNK_SIZE,startZ=cz*CHUNK_SIZE;
    for(let z=-1;z<=CHUNK_SIZE;z++)for(let x=-1;x<=CHUNK_SIZE;x++) {
      const wx=startX+x,wz=startZ+z, column=this.column(wx,wz);
      for(let y=0;y<=Math.max(column.height,WATER_LEVEL);y++) {
        const id=this.terrainBlock(wx,y,wz),i=indexOf(x,y,z);
        blocks[i]=id;
        if(id===BLOCK.WATER)levels[i]=8;
      }
    }
    for(let tz=Math.floor((startZ-8)/8);tz<=Math.floor((startZ+CHUNK_SIZE+7)/8);tz++) {
      for(let tx=Math.floor((startX-8)/8);tx<=Math.floor((startX+CHUNK_SIZE+7)/8);tx++) {
        const tree=this.tree(tx,tz);
        if(!tree)continue;
        for(let z=Math.max(-1,tree.z-startZ-6);z<=Math.min(CHUNK_SIZE,tree.z-startZ+6);z++) {
          for(let x=Math.max(-1,tree.x-startX-6);x<=Math.min(CHUNK_SIZE,tree.x-startX+6);x++) {
            for(let y=tree.y;y<Math.min(WORLD_HEIGHT,tree.y+tree.h+3);y++) {
              const id=this.treeBlock(tree,startX+x,y,startZ+z),i=indexOf(x,y,z);
              if(id&&(blocks[i]===BLOCK.AIR||id===BLOCK.WOOD))blocks[i]=id;
            }
          }
        }
      }
    }
    for(const [x,y,z,id,level] of edits) {
      const lx=x-startX,lz=z-startZ;
      if(lx>=-1&&lx<=CHUNK_SIZE&&lz>=-1&&lz<=CHUNK_SIZE&&y>=0&&y<WORLD_HEIGHT) {
        const i=indexOf(lx,y,lz);blocks[i]=id;levels[i]=id===BLOCK.WATER?(level??8):0;
      }
    }
    return {blocks,levels};
  }
}
