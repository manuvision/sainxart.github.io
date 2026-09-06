import { BLOCK } from './terrain.js?v=3.6';

export const WATER_SOURCE = 8;
export const WATER_FALLING = 9;
export const WATER_TICK_SECONDS = .25;
export const WATER_DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1]];

// One shared rendering/collision contract. Source and strongest horizontal
// water are 7/8 high; descending columns and stacked cells fill the voxel.
export function waterCellHeight(level, aboveWater = false) {
  if (!(level > 0)) return 0;
  if (aboveWater || level === WATER_FALLING) return 1;
  return Math.min(level, 7) / 8;
}

const canContain = id => id === BLOCK.AIR || id === BLOCK.WATER;
const keyOf = (x,y,z) => `${x},${y},${z}`;
function supported(x,y,z,getBlock,getLevel) {
  const below = getBlock(x,y-1,z);
  // A lake source can feed its shoreline, but a stream landing in a lake
  // merges downward instead of inventing a sheet of water above the pond.
  return !canContain(below) || (below === BLOCK.WATER && getLevel(x,y-1,z) === WATER_SOURCE && getLevel(x,y,z) === WATER_SOURCE);
}

/**
 * A bounded downhill search, following the Java fluid spread model documented
 * at https://minecraft.wiki/w/Water#Spreading and implemented by FlowingFluid:
 * https://github.com/PaperMC/Paper/blob/main/paper-server/patches/sources/net/minecraft/world/level/material/FlowingFluid.java.patch
 * Prefer every tied nearest drop within four steps of a neighboring cell.
 * An unsupported cell falls before it can spread sideways; no air bridges.
 */
export function waterSpreadMask(x,y,z,getBlock,getLevel,cache) {
  const key=keyOf(x,y,z);
  if(cache?.has(key))return cache.get(key);
  if(!supported(x,y,z,getBlock,getLevel)){cache?.set(key,0);return 0;}
  const passable=(px,pz)=>canContain(getBlock(px,y,pz))&&!(getBlock(px,y,pz)===BLOCK.WATER&&getLevel(px,y,pz)===WATER_SOURCE);
  const costs=[];
  let best=Infinity;
  for(let direction=0;direction<4;direction++) {
    const [dx,dz]=WATER_DIRECTIONS[direction],nx=x+dx,nz=z+dz;
    if(!passable(nx,nz)){costs.push(null);continue;}
    let cost=Infinity;
    const queue=[[nx,nz,0]],seen=new Set([`${x},${z}`,`${nx},${nz}`]);
    for(let cursor=0;cursor<queue.length;cursor++) {
      const [px,pz,distance]=queue[cursor];
      if(!supported(px,y,pz,getBlock,getLevel)){cost=distance;break;}
      if(distance>=4)continue;
      for(const [sx,sz] of WATER_DIRECTIONS) {
        const tx=px+sx,tz=pz+sz,nextKey=`${tx},${tz}`;
        if(seen.has(nextKey)||!passable(tx,tz))continue;
        seen.add(nextKey);queue.push([tx,tz,distance+1]);
      }
    }
    costs.push(cost);best=Math.min(best,cost);
  }
  let mask=0;
  for(let i=0;i<4;i++)if(costs[i]!==null&&costs[i]===best)mask|=1<<i;
  cache?.set(key,mask);return mask;
}

/**
 * Pull-based relaxation. Horizontal levels always strictly decrease, and
 * falling cells require water above, so no source-free cycle can sustain itself.
 * Sources are only generated terrain or explicit player placements; neighboring
 * streams never multiply into new sources.
 */
export function nextWaterLevel(x,y,z,getBlock,getLevel,spreadCache) {
  const id=getBlock(x,y,z);
  if(!canContain(id))return 0;
  if(id===BLOCK.WATER&&getLevel(x,y,z)===WATER_SOURCE)return WATER_SOURCE;
  if(getBlock(x,y+1,z)===BLOCK.WATER)return WATER_FALLING;
  let result=0;
  for(let direction=0;direction<4;direction++) {
    const [dx,dz]=WATER_DIRECTIONS[direction],nx=x+dx,nz=z+dz;
    if(getBlock(nx,y,nz)!==BLOCK.WATER)continue;
    const upstream=getLevel(nx,y,nz),strength=upstream===WATER_FALLING?8:upstream;
    if(strength-1<=result)continue;
    // Paired directions are opposites, so this is the neighbor's outgoing side.
    if(waterSpreadMask(nx,y,nz,getBlock,getLevel,spreadCache)&(1<<(direction^1)))result=strength-1;
  }
  return Math.max(0,Math.min(7,result));
}
