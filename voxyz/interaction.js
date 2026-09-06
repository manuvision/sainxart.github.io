// Amanatides–Woo grid traversal: selection is independent of rendered chunk meshes.
export function voxelRaycast(world,origin,direction,maxDistance=7,includeWater=false){
  const cell=[Math.floor(origin.x),Math.floor(origin.y),Math.floor(origin.z)],o=[origin.x,origin.y,origin.z],d=[direction.x,direction.y,direction.z];
  const step=d.map(v=>v<0?-1:1),delta=d.map(v=>v===0?Infinity:Math.abs(1/v));
  const next=d.map((v,a)=>v===0?Infinity:((cell[a]+(v>0?1:0))-o[a])/v);
  let distance=0,previous=[...cell],normal=[0,0,0];
  while(distance<=maxDistance){const id=world.getBlock(...cell);if(id!==0&&(includeWater||id!==7))return {x:cell[0],y:cell[1],z:cell[2],id,previous,normal,distance};previous=[...cell];let a=next[0]<next[1]?0:1;if(next[2]<next[a])a=2;distance=next[a];if(!Number.isFinite(distance))break;cell[a]+=step[a];next[a]+=delta[a];normal=[0,0,0];normal[a]=-step[a];}
  return null;
}
export function overlapsPlayer(x,y,z,feet,width=.58,height=1.8){return x<feet.x+width/2&&x+1>feet.x-width/2&&y<feet.y+height&&y+1>feet.y&&z<feet.z+width/2&&z+1>feet.z-width/2;}
