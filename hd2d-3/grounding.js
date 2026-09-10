// Anchors measured from native sprite alpha; machete uses the isolated Base_Body layer.
export const anchors={"raccoon-master":{"idle_south":31,"idle_east":31,"idle_north":31,"south_0":32,"south_1":31,"south_2":32,"south_3":31,"east_0":31,"east_1":31,"east_2":31,"east_3":31,"north_0":32,"north_1":31,"north_2":32,"north_3":31},"raccoon-machete":{"idle_south_0":31,"walk_south_0":32,"walk_south_1":31,"walk_south_2":32,"walk_south_3":31,"attack_south_0":30,"attack_south_1":32,"attack_south_2":33,"attack_south_3":33,"attack_south_4":32,"attack_south_5":31,"attack_south_6":31,"idle_east_0":31,"walk_east_0":31,"walk_east_1":31,"walk_east_2":31,"walk_east_3":31,"attack_east_0":31,"attack_east_1":31,"attack_east_2":31,"attack_east_3":32,"attack_east_4":32,"attack_east_5":31,"attack_east_6":31,"idle_north_0":31,"walk_north_0":32,"walk_north_1":31,"walk_north_2":32,"walk_north_3":31,"attack_north_0":32,"attack_north_1":32,"attack_north_2":31,"attack_north_3":31,"attack_north_4":32,"attack_north_5":31,"attack_north_6":31,"idle_west_0":31,"walk_west_0":31,"walk_west_1":31,"walk_west_2":31,"walk_west_3":31,"attack_west_0":31,"attack_west_1":31,"attack_west_2":31,"attack_west_3":32,"attack_west_4":32,"attack_west_5":31,"attack_west_6":31},"raccoon-roll":{"roll_south_0":31,"roll_south_1":31,"roll_south_2":31,"roll_south_3":31,"roll_south_4":31,"roll_south_5":31,"roll_south_6":31,"roll_south_7":31,"roll_east_0":31,"roll_east_1":31,"roll_east_2":31,"roll_east_3":31,"roll_east_4":31,"roll_east_5":31,"roll_east_6":31,"roll_east_7":31,"roll_north_0":31,"roll_north_1":31,"roll_north_2":31,"roll_north_3":31,"roll_north_4":31,"roll_north_5":31,"roll_north_6":31,"roll_north_7":31,"roll_west_0":31,"roll_west_1":31,"roll_west_2":31,"roll_west_3":31,"roll_west_4":31,"roll_west_5":31,"roll_west_6":31,"roll_west_7":31}};

import * as THREE from 'three';
export function setGroundPose(actor,frame,anchor,pixel){
 const r=frame.frame,p=frame.pivot||{x:8,y:32};
 if(actor.geometry.parameters.heightSegments!==r.h){actor.geometry.dispose();actor.geometry=new THREE.PlaneGeometry(1,1,1,r.h);}
 actor.userData.groundPose={r,p,anchor,pixel};
}
export function groundSprite(actor,camera){
 const data=actor.userData.groundPose;if(!data)return;
 const {r,p,anchor,pixel}=data,ps=actor.geometry.attributes.position;
 const distance=Math.hypot(camera.position.x-actor.position.x,camera.position.z-actor.position.z);
 const slope=distance/Math.max(.5,camera.position.y-actor.position.y);
 // Keep the upper body upright. Pixels below the soles lie across the floor,
 // preserving their projected size instead of clipping them underground.
 for(let row=0;row<=r.h;row++){const v=(anchor-row)*pixel,y=Math.max(0,v),z=Math.max(0,-v)*slope;ps.setXYZ(row*2,-p.x*pixel,y,z);ps.setXYZ(row*2+1,(r.w-p.x)*pixel,y,z);}
 ps.needsUpdate=true;actor.geometry.computeVertexNormals();actor.geometry.computeBoundingSphere();
 actor.rotation.y=Math.atan2(camera.position.x-actor.position.x,camera.position.z-actor.position.z);
}
