import {isForwardReach} from './combat.js';
import * as T from 'three';

export function createVillage(scene){
 let seed=733;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const colliders=[],interactables=[],herbs=[],debris=[];let cutCount=0;
 const mat=(color,roughness=.9,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const wood=mat('#765034'),bark=mat('#5c5034'),dark=mat('#394233'),sand=mat('#b9ad78'),stone=mat('#848576'),cream=mat('#cec095'),brass=mat('#aa8b42',.55,.35);
 const greens=['#405d35','#56743c','#648443','#769148'].map(c=>mat(c));greens.forEach(m=>m.side=T.DoubleSide);
 function mesh(g,m,x=0,y=0,z=0,parent=scene){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 const box=(x,y,z,w,h,d,m,parent)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,parent);
 const cylinder=(x,y,z,r,h,m,r2=r,parent)=>mesh(new T.CylinderGeometry(r,r2,h,10),m,x,y,z,parent);
 function segment(a,b,r,m,parent=scene){const v=new T.Vector3().subVectors(b,a),o=mesh(new T.CylinderGeometry(r*.78,r,v.length(),7),m,...a.clone().add(b).multiplyScalar(.5).toArray(),parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
 function solid(x,z,w,d,name){colliders.push({x,z,w,d,name});}
 function leaf(g,base,tip,width,m){const mid=base.clone().lerp(tip,.57);mid.y+=width*.7;const side=new T.Vector3(tip.z-base.z,0,base.x-tip.x).normalize().multiplyScalar(width);const a=mid.clone().add(side),b=mid.clone().sub(side);const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute([...base.toArray(),...a.toArray(),...tip.toArray(),...b.toArray(),...mid.toArray()],3));geom.setIndex([0,1,4,1,2,4,2,3,4,3,0,4]);geom.computeVertexNormals();return mesh(geom,m,0,0,0,g);}
 // A continuous terrain surface extends beyond the camera; no artificial island border.
 const terrain=mat('#687b43');terrain.onBeforeCompile=s=>{s.vertexShader='varying vec3 vLand;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLand=(modelMatrix*vec4(position,1.)).xyz;');s.fragmentShader='varying vec3 vLand;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float n=sin(vLand.x*1.1+sin(vLand.z*.6))*sin(vLand.z*1.4+vLand.x*.4);
float path=min(abs(vLand.z-.5),abs(vLand.x+2.7));
float clearing=length(vLand.xz-vec2(-2.,.5));
float trail=1.-smoothstep(.65,1.15,path+n*.16);trail=max(trail,(1.-smoothstep(1.9,2.6,clearing))*.9);
float bank=1.-smoothstep(1.35,1.8,abs(vLand.x-6.9));
float grain=fract(sin(dot(floor(vLand.xz*80.),vec2(12.9898,78.233)))*43758.5453);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.46,.36,.19),trail*.8);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.58,.49,.29),bank);diffuseColor.rgb*=.92+grain*.08+n*.04;`);};
 const ground=mesh(new T.PlaneGeometry(90,90),terrain,0,0,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
 // Stream with moving ripples, pebble banks and a bridge that meets both dry shores.
 const waterMat=new T.ShaderMaterial({uniforms:{time:{value:0}},transparent:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float time;void main(){float rip=sin(vUv.y*260.-time*1.7+sin(vUv.x*90.)*2.);float tiny=sin(vUv.y*700.+time*2.+vUv.x*55.);float bank=smoothstep(0.,.14,vUv.x)*smoothstep(0.,.14,1.-vUv.x);vec3 c=mix(vec3(.32,.48,.38),vec3(.11,.32,.34),bank);c+=pow(max(0.,rip),20.)*.09+max(0.,tiny)*.018;gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});const river=mesh(new T.PlaneGeometry(2.6,90),waterMat,6.9,.009,0);river.rotation.x=-Math.PI/2;river.castShadow=false;
 for(let side of [-1,1])for(let i=0;i<75;i++){let z=-24+i*.66;if(Math.abs(z-.5)<1.12)continue;const rock=mesh(new T.DodecahedronGeometry(.11+rnd()*.13,0),stone,6.9+side*(1.38+rnd()*.12),.035,z);rock.scale.set(1,.45,1.3);rock.rotation.y=rnd()*6;}
 for(let i=0;i<14;i++)box(5.07+i*.282,.055,.5,.27,.1,1.75,wood);
 for(let z of [-.48,1.48]){box(6.9,.25,z,4.1,.13,.14,bark);for(let x of [4.92,6.2,7.6,8.9]){cylinder(x,.44,z,.065,.9,wood);cylinder(x,.93,z,.085,.1,brass);}box(6.9,.82,z,4.1,.06,.06,wood);}
 solid(6.9,-.52,4.2,.12,'bridge rail');solid(6.9,1.52,4.2,.12,'bridge rail');
 // Two small stilt cottages, with individual clapboards, roof courses and open porches.
 function house(x,z,accent){const g=new T.Group();g.position.set(x,0,z);scene.add(g);const roof=mat(accent),wall=mat('#b7a77c');box(0,.2,0,3.6,.38,2.7,stone,g);box(0,1.3,0,3.3,2.15,2.45,wall,g);
 for(let y=.4;y<2.3;y+=.19)for(let side of [-1,1])box(0,y,side*1.235,3.28,.025,.025,wood,g);
 for(let xx of [-1.64,1.64])for(let zz of [-1.23,1.23])box(xx,1.3,zz,.13,2.3,.14,wood,g);
 const roofGeo=new T.BufferGeometry();roofGeo.setAttribute('position',new T.Float32BufferAttribute([-2,2.25,-1.65,2,2.25,-1.65,-2,3.32,0,2,3.32,0,-2,2.25,1.65,2,2.25,1.65],3));roofGeo.setIndex([0,2,1,1,2,3,2,4,3,3,4,5]);roofGeo.computeVertexNormals();roof.side=T.DoubleSide;mesh(roofGeo,roof,0,0,0,g);
 for(let zz=-1.65;zz<=1.65;zz+=.22)box(0,3.34-Math.abs(zz)*.648,zz,4.02,.045,.045,wood,g);
 for(let xx=-1.9;xx<2;xx+=.39){segment(new T.Vector3(xx,2.24,-1.67),new T.Vector3(xx,3.35,0),.014,roof,g);segment(new T.Vector3(xx,3.35,0),new T.Vector3(xx,2.24,1.67),.014,roof,g);}
 const door=box(0,1.02,1.25,.79,1.58,.035,dark,g);for(let i=0;i<4;i++){const plank=box(-.29+i*.19,1.01,1.28,.17,1.53,.025,wood,g);}mesh(new T.SphereGeometry(.035,8,6),brass,.25,1.0,1.34,g);
 for(let xx of [-1.08,1.08]){box(xx,1.45,1.27,.56,.68,.05,wood,g);const win=mat('#526d63');win.emissive=new T.Color('#776634');win.emissiveIntensity=.12;box(xx,1.46,1.31,.44,.55,.015,win,g);box(xx,1.45,1.33,.034,.57,.03,wood,g);box(xx,1.45,1.33,.46,.03,.03,wood,g);box(xx,1.08,1.34,.69,.085,.25,wood,g);}
 box(0,.11,1.75,2.9,.2,.86,wood,g);box(0,.045,2.22,1.2,.08,.45,stone,g);for(let xx of [-1.4,1.4]){cylinder(xx,1.1,2.08,.045,2.2,wood,.06,g);}const awning=box(0,2.12,1.8,3.12,.055,1.08,roof,g);awning.rotation.x=.14;
 solid(x,z,3.6,2.7,'cottage');interactables.push({x,z:z+2.3,r:1,name:'Tikoon’s village',text:'A quiet place between adventures. This outdoor demo is yours to explore.\n\nWalk through the herbs and press B to clear a path. A rolls when there is nothing nearby to examine.\n\nFollow @manu.vision on Instagram for the adventures of Tikoon. — Manuel Sainsily'});
 }
 house(-6,-5.6,'#826143');house(.7,-7.2,'#617264');
 // Broadleaf canopy clusters read as overlapping foliage, with connected trunks and roots.
 function tree(x,z,s=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);cylinder(0,1.25,0,.18,2.5,bark,.28,g);for(let i=0;i<4;i++){let a=i*1.57;segment(new T.Vector3(0,.45,0),new T.Vector3(Math.cos(a)*.47,.03,Math.sin(a)*.47),.09,bark,g);segment(new T.Vector3(0,1.55,0),new T.Vector3(Math.cos(a)*.58,2.5,Math.sin(a)*.58),.085,bark,g);}
 for(let i=0;i<7;i++){let a=i*2.4,r=i===0?0:.6;const crown=mesh(new T.IcosahedronGeometry(.98,1),greens[i%4],Math.cos(a)*r,2.7+(i===0?.4:rnd()*.3),Math.sin(a)*r,g);crown.scale.set(1,.68,1);crown.rotation.y=rnd()*6;}
 solid(x,z,.55*s,.55*s,'tree trunk');return g;}
 const trunks=[[-10,-7],[-10,-3],[-10,2],[-8,6],[-5,7.8],[0,8.5],[4,7.5],[10.5,7],[12,3],[12,-2],[10,-7],[4,-10],[-2,-11],[-7,-10]];for(const [x,z] of trunks)tree(x,z,.88+rnd()*.35);
 for(let i=0;i<38;i++){let x=-26+rnd()*52,z=-26+rnd()*52;if(Math.abs(x)<13&&Math.abs(z)<12||Math.abs(x-6.9)<2)continue;tree(x,z,1.1+rnd()*.6);}
 // Coconut palms have an unbroken curved trunk and fronds radiating from one crown.
 function palm(x,z){const g=new T.Group();g.position.set(x,0,z);scene.add(g);const crown=new T.Vector3(.3,3.5,0);const curve=new T.QuadraticBezierCurve3(new T.Vector3(),new T.Vector3(-.25,2,0),crown);mesh(new T.TubeGeometry(curve,14,.12,8,false),bark,0,0,0,g);for(let i=1;i<12;i++){let p=curve.getPoint(i/12);const ring=mesh(new T.TorusGeometry(.123,.016,4,10),wood,...p.toArray(),g);ring.rotation.x=Math.PI/2;}
 for(let i=0;i<8;i++){let a=i*Math.PI/4,tip=new T.Vector3(crown.x+Math.cos(a)*1.65,2.85+Math.sin(i)*.18,Math.sin(a)*1.65);const rib=new T.QuadraticBezierCurve3(crown,new T.Vector3(crown.x+Math.cos(a)*.7,4.13,Math.sin(a)*.7),tip);mesh(new T.TubeGeometry(rib,10,.025,4,false),greens[2],0,0,0,g);for(let k=1;k<9;k++){const t=k/10,p=rib.getPoint(t),width=Math.sin(t*Math.PI)*.43;for(let side of [-1,1]){const tip=p.clone().add(new T.Vector3(Math.sin(a)*width*side,-.18,-Math.cos(a)*width*side));leaf(g,p,tip,.10,greens[(i+k)%3]);}}}
 for(let i=0;i<3;i++)mesh(new T.SphereGeometry(.12,8,6),wood,.3+Math.cos(i*2)*.13,3.38,Math.sin(i*2)*.13,g);solid(x,z,.4,.4,'palm trunk');}
 palm(-8,-.8);palm(9.6,-3.2);palm(3.3,5.5);
 // Walk-through herb patches. Each plant has real front/back leaves for natural occlusion.
 const herbGeo=[];for(let variant=0;variant<3;variant++){const g=new T.Group();for(let i=0;i<7;i++){let a=i*2.4+variant,base=new T.Vector3((rnd()-.5)*.12,0,(rnd()-.5)*.12),tip=new T.Vector3(Math.cos(a)*(.15+rnd()*.12),.3+rnd()*.22,Math.sin(a)*(.15+rnd()*.12));leaf(g,base,tip,.045+rnd()*.028,greens[(i+variant)%4]);}herbGeo.push(g);}
 // Merge a clump's leaf geometry once; each animated herb draws as one mesh.
 const herbMaterial=mat('#ffffff');herbMaterial.vertexColors=true;herbMaterial.side=T.DoubleSide;
 for(let v=0;v<herbGeo.length;v++){const pos=[],colors=[];for(const o of herbGeo[v].children){const g=o.geometry.toNonIndexed(),p=g.attributes.position,c=o.material.color;pos.push(...p.array);for(let i=0;i<p.count;i++)colors.push(c.r,c.g,c.b);g.dispose();}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();herbGeo[v]=new T.Mesh(g,herbMaterial);herbGeo[v].castShadow=true;herbGeo[v].receiveShadow=true;}
 function herb(x,z){const g=herbGeo[Math.floor(rnd()*3)].clone();g.userData.dynamic=true;g.position.set(x,.012,z);g.rotation.y=rnd()*6;scene.add(g);herbs.push({id:herbs.length,x,z,g,cut:false,phase:rnd()*6});}
 // The first clump is directly south of spawn so the problematic swing is easy to try.
 const patches=[[-2,2,4,3],[-5.2,1.8,4,5],[1.1,2.2,5,5],[-7,-2.2,4,2],[2.7,-3.3,4,5],[10,2.8,4,5],[-4.4,5.3,4,2]];
 for(const [x,z,w,h] of patches)for(let row=0;row<h;row++)for(let col=0;col<w;col++){let xx=x+col*.48+(rnd()-.5)*.11,zz=z+row*.44+(rnd()-.5)*.11;if(!colliders.some(c=>Math.abs(xx-c.x)<c.w/2+.3&&Math.abs(zz-c.z)<c.d/2+.3))herb(xx,zz);}
 // A few stones, flowering shrubs and a village sign keep the walking lanes readable.
 for(let i=0;i<28;i++){let x=-10+rnd()*21,z=-8+rnd()*16;if(Math.abs(z-.5)<1.1||Math.abs(x+2.7)<1||Math.abs(x-6.9)<2||colliders.some(c=>Math.abs(x-c.x)<c.w/2+.6&&Math.abs(z-c.z)<c.d/2+.6))continue;let r=.15+rnd()*.2;const o=mesh(new T.DodecahedronGeometry(r,0),stone,x,r*.25,z);o.scale.y=.6;}
 cylinder(-3.8,.52,-1,.055,1,wood);box(-3.8,.95,-1,1.04,.55,.1,wood);const sign=box(-3.8,.95,-.94,.9,.4,.025,cream);interactables.push({x:-3.8,z:-.6,r:1,name:'The herb trail',text:'B · Cut the herbs in front of you.\nA · Roll through a gap.\n\nHerbs brush against your legs as you pass. Cut leaves scatter, leaving short stems behind. Refresh the page to grow them back.'});
 const glints=new Float32Array(110*3);for(let i=0;i<110;i++){glints[i*3]=-12+rnd()*24;glints[i*3+1]=.3+rnd()*3;glints[i*3+2]=-10+rnd()*20;}const dg=new T.BufferGeometry();dg.setAttribute('position',new T.BufferAttribute(glints,3));const dust=new T.Points(dg,new T.PointsMaterial({color:'#f7d995',size:.025,transparent:true,opacity:.65,depthWrite:false}));scene.add(dust);
 scene.background=new T.Color('#9aa58a');scene.fog=new T.FogExp2('#9aa58a',.016);scene.add(new T.HemisphereLight('#d4e1d3','#61623a',1.35));const sun=new T.DirectionalLight('#ffe1bc',2.5);sun.position.set(-5,11,5);scene.add(sun);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-17,right:17,top:17,bottom:-17,near:.1,far:40});sun.shadow.normalBias=.035;sun.shadow.radius=4;
 // Batch static scenery by material; individual herbs remain interactive.
 scene.updateMatrixWorld(true);const batches=new Map(),remove=[];scene.traverse(o=>{if(!o.isMesh||o.userData.dynamic)return;const key=o.material.uuid+o.castShadow;let batch=batches.get(key);if(!batch){batch={material:o.material,cast:o.castShadow,positions:[],normals:[],uvs:[]};batches.set(key,batch);}const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);batch.positions.push(...g.attributes.position.array);batch.normals.push(...g.attributes.normal.array);if(g.attributes.uv)batch.uvs.push(...g.attributes.uv.array);else for(let i=0;i<g.attributes.position.count;i++)batch.uvs.push(0,0);g.dispose();remove.push(o);});for(const o of remove)o.removeFromParent();for(const b of batches.values()){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.uvs,2));const o=new T.Mesh(g,b.material);o.castShadow=b.cast;o.receiveShadow=true;if(b.cast)o.layers.enable(1);scene.add(o);}
 function groundHeight(x,z){return x>=4.92&&x<=8.92&&z>-.4&&z<1.4?.105:0;}
 function blocked(x,z){if(x<-11.7||x>11.7||z<-9.4||z>8.4)return true;if(x>5.5&&x<8.3&&(z<-.18||z>1.18))return true;return colliders.some(c=>Math.abs(x-c.x)<c.w/2+.23&&Math.abs(z-c.z)<c.d/2+.23);}
 function cut(player){const cleared=[];for(const h of herbs){if(h.cut||!isForwardReach(player,h))continue;const n=Math.ceil(Math.hypot(h.x-player.x,h.z-player.z)/.15);let obstructed=false;for(let i=1;i<=n;i++)if(blocked(player.x+(h.x-player.x)*i/n,player.z+(h.z-player.z)*i/n)){obstructed=true;break;}if(obstructed)continue;h.cut=true;cleared.push({id:h.id,x:h.x,z:h.z});cutCount++;h.g.visible=false;const stub=herbGeo[0].clone();stub.scale.set(.65,.16,.65);stub.position.set(h.x,.012,h.z);scene.add(stub);for(let i=0;i<6;i++){const bit=mesh(new T.PlaneGeometry(.09,.055),greens[(i+1)%4],h.x,.2,h.z);bit.castShadow=false;debris.push({o:bit,v:new T.Vector3((rnd()-.5)*1.8,1.2+rnd(),(rnd()-.5)*1.8),age:0});}}return cleared;}
 function update(dt,t,player){waterMat.uniforms.time.value=t;for(const h of herbs){if(h.cut)continue;const near=Math.hypot(player.x-h.x,player.z-h.z)<.6;h.g.rotation.z=Math.sin(t*1.8+h.phase)*.035+(near?(h.x<player.x?-.16:.16):0);}
 for(let i=debris.length-1;i>=0;i--){const b=debris[i];b.age+=dt;b.v.y-=4*dt;b.o.position.addScaledVector(b.v,dt);b.o.rotation.x+=dt*7;b.o.rotation.z+=dt*4;b.o.scale.setScalar(Math.max(0,1-b.age/.55));if(b.age>.55){scene.remove(b.o);b.o.geometry.dispose();debris.splice(i,1);}}
 for(let i=0;i<110;i++){glints[i*3+1]+=.018*dt;if(glints[i*3+1]>3.5)glints[i*3+1]=.2;}dg.attributes.position.needsUpdate=true;
 }
 return {colliders,interactables,blocked,groundHeight,cut,update,snapshot:()=>({cut:cutCount,total:herbs.length,burst:debris.length,herbs:herbs.map(h=>({id:h.id,x:h.x,z:h.z,cut:h.cut})),bridge:{x:[4.92,8.92],z:[-.18,1.18]}})};
}
