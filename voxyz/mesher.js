import { BLOCK, BLOCK_COLORS, CHUNK_SIZE, WORLD_HEIGHT, indexOf, hash2, isSolid } from './terrain.js?v=3.4';
import { waterCellHeight } from './water.js?v=3.4';

const FACES=[
  {n:[1,0,0],u:[0,0,-1],v:[0,1,0],shade:.9},
  {n:[-1,0,0],u:[0,0,1],v:[0,1,0],shade:.82},
  {n:[0,1,0],u:[1,0,0],v:[0,0,-1],shade:1},
  {n:[0,-1,0],u:[1,0,0],v:[0,0,1],shade:.74},
  {n:[0,0,1],u:[1,0,0],v:[0,1,0],shade:.92},
  {n:[0,0,-1],u:[-1,0,0],v:[0,1,0],shade:.84},
];
const CORNERS=[[-1,-1],[1,-1],[1,1],[-1,1]];
const rgb=BLOCK_COLORS.map(hex=>[1,3,5].map(i=>{const s=parseInt(hex.slice(i,i+2),16)/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}));
const transparent=id=>id===BLOCK.AIR||id===BLOCK.WATER||id===BLOCK.GLASS||id===BLOCK.TORCH;
const empty=()=>({positions:[],normals:[],colors:[],indices:[],uvs:[],blockTypes:[]});
const pack=g=>({positions:new Float32Array(g.positions),normals:new Float32Array(g.normals),colors:new Float32Array(g.colors),indices:new Uint32Array(g.indices),uvs:new Float32Array(g.uvs),blockTypes:new Float32Array(g.blockTypes)});

/** Exposed faces are batched once per chunk. No per-voxel draw calls. */
export function meshChunk(blocks, levels, cx, cz, seed=0) {
  const solid=empty(),water=empty();
  const get=(x,y,z)=>y<0?BLOCK.STONE:y>=WORLD_HEIGHT?BLOCK.AIR:blocks[indexOf(x,y,z)]||0;
  const occ=(x,y,z)=>isSolid(get(x,y,z))&&get(x,y,z)!==BLOCK.GLASS?1:0;
  const cornerCache=new Map();
  const waterCorner=(cx,y,cz)=>{
    const key=(y*18+cz)*18+cx;
    if(cornerCache.has(key))return cornerCache.get(key);
    let total=0,count=0,height=0;
    for(let dz=-1;dz<=0;dz++)for(let dx=-1;dx<=0;dx++) {
      const x=cx+dx,z=cz+dz;
      if(get(x,y,z)!==BLOCK.WATER)continue;
      const h=waterCellHeight(levels[indexOf(x,y,z)]||8,get(x,y+1,z)===BLOCK.WATER);
      if(h===1){cornerCache.set(key,1);return 1;}
      total+=h;count++;
    }
    height=count?total/count:0;cornerCache.set(key,height);return height;
  };
  for(let y=0;y<WORLD_HEIGHT;y++)for(let z=0;z<CHUNK_SIZE;z++)for(let x=0;x<CHUNK_SIZE;x++) {
    const id=get(x,y,z);
    if(id===BLOCK.AIR)continue;
    const target=id===BLOCK.WATER?water:solid;
    const topNormal=[0,1,0];
    if(id===BLOCK.WATER) {
      const h00=waterCorner(x,y,z),h10=waterCorner(x+1,y,z),h01=waterCorner(x,y,z+1),h11=waterCorner(x+1,y,z+1);
      const nx=(h00+h01-h10-h11)*.5,nz=(h00+h10-h01-h11)*.5,len=Math.hypot(nx,1,nz);
      topNormal[0]=nx/len;topNormal[1]=1/len;topNormal[2]=nz/len;
    }
    const variation=.91+hash2(x+cx*16+y*17,z+cz*16,seed+id*913)*.15;
    for(let faceIndex=0;faceIndex<6;faceIndex++) {
      const {n,u,v,shade}=FACES[faceIndex];
      const neighbor=get(x+n[0],y+n[1],z+n[2]);
      if(id===BLOCK.WATER) {
        if(neighbor===BLOCK.WATER||!transparent(neighbor))continue;
      } else if(id===BLOCK.GLASS) {
        if(neighbor===BLOCK.GLASS||(!transparent(neighbor)&&neighbor!==BLOCK.LEAVES&&neighbor!==BLOCK.JUNGLE_LEAVES))continue;
      } else if(!transparent(neighbor))continue;
      const base=target.positions.length/3;
      const occlusions=[];
      for(const [su,sv] of CORNERS) {
        let px=x+.5+n[0]*.5+u[0]*su*.5+v[0]*sv*.5;
        let py=y+.5+n[1]*.5+u[1]*su*.5+v[1]*sv*.5;
        let pz=z+.5+n[2]*.5+u[2]*su*.5+v[2]*sv*.5;
        if(id===BLOCK.WATER&&py>y+.5)py=y+waterCorner(Math.round(px),y,Math.round(pz));
        // Torch geometry remains a targetable voxel, rendered as a small warm post.
        if(id===BLOCK.TORCH) {px=x+.5+(px-x-.5)*.19;pz=z+.5+(pz-z-.5)*.19;py=y+(py-y)*.7;}
        const s1=occ(x+n[0]+u[0]*su,y+n[1]+u[1]*su,z+n[2]+u[2]*su);
        const s2=occ(x+n[0]+v[0]*sv,y+n[1]+v[1]*sv,z+n[2]+v[2]*sv);
        const corner=occ(x+n[0]+u[0]*su+v[0]*sv,y+n[1]+u[1]*su+v[1]*sv,z+n[2]+u[2]*su+v[2]*sv);
        const ao=s1&&s2?0:3-s1-s2-corner;
        occlusions.push(ao);
        const light=id===BLOCK.WATER?1:shade*(.7+ao*.10)*variation;
        let color=rgb[id];
        if(id===BLOCK.GRASS&&faceIndex!==2) {
          // A narrow turf rim is suggested by the lush upper corners over warm soil.
          const dirt=rgb[BLOCK.DIRT],t=py>y+.9?.52:0;
          color=dirt.map((c,i)=>c*(1-t)+rgb[BLOCK.GRASS][i]*t);
        }
        if(id===BLOCK.WOOD&&faceIndex===2)color=[.39,.275,.14];
        if(id===BLOCK.LEAVES) {
          const forest=hash2(Math.floor((x+cx*16)/8),Math.floor((z+cz*16)/8),seed+981);
          const tint=forest>.66?[1.04,1.06,.92]:forest<.25?[.82,.91,.93]:[1,1,1];
          color=color.map((component,i)=>component*tint[i]);
        }
        target.positions.push(px,py,pz);
        target.normals.push(...(id===BLOCK.WATER&&faceIndex===2?topNormal:n));
        target.blockTypes.push(id);
        target.colors.push(color[0]*light,color[1]*light,color[2]*light);
        target.uvs.push((su+1)/2,(sv+1)/2);
      }
      if(occlusions[0]+occlusions[2]>occlusions[1]+occlusions[3])target.indices.push(base,base+1,base+3,base+1,base+2,base+3);
      else target.indices.push(base,base+1,base+2,base,base+2,base+3);
    }
  }
  return {solid:pack(solid),water:pack(water)};
}
