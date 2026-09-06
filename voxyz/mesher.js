import { BLOCK, BLOCK_COLORS, CHUNK_SIZE, WORLD_HEIGHT, indexOf, hash2, isSolid } from './terrain.js';

const FACES=[
  {n:[1,0,0],u:[0,0,-1],v:[0,1,0],shade:.83},
  {n:[-1,0,0],u:[0,0,1],v:[0,1,0],shade:.70},
  {n:[0,1,0],u:[1,0,0],v:[0,0,-1],shade:1},
  {n:[0,-1,0],u:[1,0,0],v:[0,0,1],shade:.55},
  {n:[0,0,1],u:[1,0,0],v:[0,1,0],shade:.88},
  {n:[0,0,-1],u:[-1,0,0],v:[0,1,0],shade:.75},
];
const CORNERS=[[-1,-1],[1,-1],[1,1],[-1,1]];
const rgb=BLOCK_COLORS.map(hex=>[1,3,5].map(i=>{const s=parseInt(hex.slice(i,i+2),16)/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}));
const transparent=id=>id===BLOCK.AIR||id===BLOCK.WATER||id===BLOCK.GLASS||id===BLOCK.TORCH;
const empty=()=>({positions:[],normals:[],colors:[],indices:[],uvs:[]});
const pack=g=>({positions:new Float32Array(g.positions),normals:new Float32Array(g.normals),colors:new Float32Array(g.colors),indices:new Uint32Array(g.indices),uvs:new Float32Array(g.uvs)});

/** Exposed faces are batched once per chunk. No per-voxel draw calls. */
export function meshChunk(blocks, levels, cx, cz, seed=0) {
  const solid=empty(),water=empty();
  const get=(x,y,z)=>y<0?BLOCK.STONE:y>=WORLD_HEIGHT?BLOCK.AIR:blocks[indexOf(x,y,z)]||0;
  const occ=(x,y,z)=>isSolid(get(x,y,z))&&get(x,y,z)!==BLOCK.GLASS?1:0;
  for(let y=0;y<WORLD_HEIGHT;y++)for(let z=0;z<CHUNK_SIZE;z++)for(let x=0;x<CHUNK_SIZE;x++) {
    const id=get(x,y,z);
    if(id===BLOCK.AIR)continue;
    const target=id===BLOCK.WATER?water:solid;
    const waterLevel=levels[indexOf(x,y,z)]||8;
    const waterTop=get(x,y+1,z)===BLOCK.WATER?1:.16+.7*(waterLevel/8);
    const variation=.91+hash2(x+cx*16+y*17,z+cz*16,seed+id*913)*.15;
    for(let faceIndex=0;faceIndex<6;faceIndex++) {
      const {n,u,v,shade}=FACES[faceIndex];
      const neighbor=get(x+n[0],y+n[1],z+n[2]);
      if(id===BLOCK.WATER) {
        if(neighbor===BLOCK.WATER||!transparent(neighbor)||faceIndex===3)continue;
      } else if(id===BLOCK.GLASS) {
        if(neighbor===BLOCK.GLASS||(!transparent(neighbor)&&neighbor!==BLOCK.LEAVES&&neighbor!==BLOCK.JUNGLE_LEAVES))continue;
      } else if(!transparent(neighbor))continue;
      const base=target.positions.length/3;
      const occlusions=[];
      for(const [su,sv] of CORNERS) {
        let px=x+.5+n[0]*.5+u[0]*su*.5+v[0]*sv*.5;
        let py=y+.5+n[1]*.5+u[1]*su*.5+v[1]*sv*.5;
        let pz=z+.5+n[2]*.5+u[2]*su*.5+v[2]*sv*.5;
        if(id===BLOCK.WATER&&py>y+.5)py=y+waterTop;
        // Torch geometry remains a targetable voxel, rendered as a small warm post.
        if(id===BLOCK.TORCH) {px=x+.5+(px-x-.5)*.19;pz=z+.5+(pz-z-.5)*.19;py=y+(py-y)*.7;}
        const s1=occ(x+n[0]+u[0]*su,y+n[1]+u[1]*su,z+n[2]+u[2]*su);
        const s2=occ(x+n[0]+v[0]*sv,y+n[1]+v[1]*sv,z+n[2]+v[2]*sv);
        const corner=occ(x+n[0]+u[0]*su+v[0]*sv,y+n[1]+u[1]*su+v[1]*sv,z+n[2]+u[2]*su+v[2]*sv);
        const ao=s1&&s2?0:3-s1-s2-corner;
        occlusions.push(ao);
        const light=id===BLOCK.WATER?1:shade*(.57+ao*.143)*variation;
        let color=rgb[id];
        if(id===BLOCK.GRASS&&faceIndex!==2) {
          // A narrow turf rim is suggested by the lush upper corners over warm soil.
          const dirt=rgb[BLOCK.DIRT],t=py>y+.9?.52:0;
          color=dirt.map((c,i)=>c*(1-t)+rgb[BLOCK.GRASS][i]*t);
        }
        if(id===BLOCK.WOOD&&faceIndex===2)color=[.39,.275,.14];
        if(id===BLOCK.LEAVES) {
          const forest=hash2(Math.floor((x+cx*16)/8),Math.floor((z+cz*16)/8),seed+981);
          color=forest>.66?[.195,.325,.12]:forest<.25?[.115,.235,.085]:color;
        }
        target.positions.push(px,py,pz);
        target.normals.push(...n);
        target.colors.push(color[0]*light,color[1]*light,color[2]*light);
        target.uvs.push((su+1)/2,(sv+1)/2);
      }
      if(occlusions[0]+occlusions[2]>occlusions[1]+occlusions[3])target.indices.push(base,base+1,base+3,base+1,base+2,base+3);
      else target.indices.push(base,base+1,base+2,base,base+2,base+3);
    }
  }
  return {solid:pack(solid),water:pack(water)};
}
