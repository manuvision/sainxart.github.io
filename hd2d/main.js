import * as THREE from 'three';

const $=s=>document.querySelector(s), canvas=$('#world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const scene=new THREE.Scene();scene.background=new THREE.Color('#111c22');scene.fog=new THREE.FogExp2('#15212a',.019);
const camera=new THREE.PerspectiveCamera(37,1,.1,80);let zoom=1;
const clock=new THREE.Clock(), colliders=[], interactables=[], flames=[], lamps=[];
let seed=84;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const oak=mat('#795233'),darkwood=mat('#34251c'),trim=mat('#513522'),brass=mat('#b89a5e',.35,.65),cream=mat('#c4b399'),stone=mat('#736e63'),teal=mat('#255257'),ink=mat('#182323'),pages=mat('#cabc98');
// Analytic grain: materials remain resolution-independent 3D surfaces, not enlarged tiles.
for(const m of [oak,darkwood,trim]){m.onBeforeCompile=s=>{s.vertexShader='varying vec3 vGrain;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGrain=(modelMatrix*vec4(position,1.0)).xyz;');s.fragmentShader='varying vec3 vGrain;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float grain=sin(vGrain.z*112.0+sin(vGrain.x*4.0+vGrain.y*3.0)*3.0+sin(vGrain.x*19.0)*.4);
float fine=sin(vGrain.z*387.0+vGrain.x*8.0);
diffuseColor.rgb*=.93+.06*grain+.025*fine;`);};m.customProgramCacheKey=()=> 'wood-v1';}
for(const m of [cream,stone]){m.onBeforeCompile=s=>{s.vertexShader='varying vec3 vSurface;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurface=(modelMatrix*vec4(position,1.0)).xyz;');s.fragmentShader='varying vec3 vSurface;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float fleck=fract(sin(dot(floor(vSurface*170.),vec3(12.9898,78.233,45.164)))*43758.5453);
float clouds=sin(vSurface.x*9.+sin(vSurface.y*6.))*sin(vSurface.z*12.+vSurface.y*11.);
diffuseColor.rgb*=.94+fleck*.075+clouds*.028;`);};m.customProgramCacheKey=()=> 'plaster-v1';}
function mesh(geo,m,x=0,y=0,z=0,parent=scene){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(x,y,z,w,h,d,m,parent=scene){return mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent)}
function cyl(x,y,z,r,h,m,r2=r,parent=scene){return mesh(new THREE.CylinderGeometry(r,r2,h,16),m,x,y,z,parent)}
function sphere(x,y,z,r,m,parent=scene){return mesh(new THREE.SphereGeometry(r,16,10),m,x,y,z,parent)}
function torus(x,y,z,r,t,m,parent=scene){return mesh(new THREE.TorusGeometry(r,t,7,28),m,x,y,z,parent)}
function solid(x,z,w,d,name){colliders.push({x,z,w,d,name});}
function inspect(x,z,r,name,text,action){interactables.push({x,z,r,name,text,action});}
function leg(x,z,h,parent=scene){cyl(x,h/2,z,.055,h,trim,.078,parent);sphere(x,h*.62,z,.075,trim,parent);cyl(x,.09,z,.09,.12,trim,.09,parent);}
function vase(x,y,z,scale=1,parent=scene){const pts=[[.0,0],[.17,0],[.23,.08],[.28,.28],[.24,.43],[.13,.52],[.12,.64],[.15,.66]].map(([a,b])=>new THREE.Vector2(a*scale,b*scale));const v=mesh(new THREE.LatheGeometry(pts,24),teal,x,y,z,parent);for(let yy of [.08,.48,.62]){const t=torus(x,y+yy*scale,z,(yy===.08?.22:yy===.48?.18:.135)*scale,.012*scale,brass,parent);t.rotation.x=Math.PI/2;}return v;}
function plant(x,z,s=1){vase(x,.06,z,s);const leafmat=mat('#526d39');leafmat.side=THREE.DoubleSide;for(let i=0;i<10;i++){const a=i*2.4,len=(.7+random()*.5)*s;const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(x,.65*s,z),new THREE.Vector3(x+Math.cos(a)*.22*s,1.7*s,z+Math.sin(a)*.22*s),new THREE.Vector3(x+Math.cos(a)*.7*s,(.85+random()*.5)*s,z+Math.sin(a)*.7*s));const ps=[],uv=[],idx=[];for(let j=0;j<=12;j++){let t=j/12,p=curve.getPoint(t),width=Math.sin(t*Math.PI)*.075*s;ps.push(p.x+Math.sin(a)*width,p.y,p.z-Math.cos(a)*width,p.x-Math.sin(a)*width,p.y,p.z+Math.cos(a)*width);uv.push(0,t,1,t);if(j<12){let k=j*2;idx.push(k,k+1,k+2,k+1,k+3,k+2)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();mesh(g,leafmat);mesh(new THREE.TubeGeometry(curve,12,.009,4,false),leafmat);}
solid(x,z,.55*s,.55*s,'plant');}

// Timber shell, open on the camera side. Window openings are real holes in the wall.
box(0,-.2,0,12,.4,9.8,darkwood);for(let row=0;row<20;row++){let z=-4.65+row*.48;for(let j=0;j<4;j++){let x=-6+j*3+(row%2)*1.5,w=2.985;if(x<-6)continue;if(x+w>6)w=6-x;box(x+w/2,-.015,z,w,.08,.465,mat(new THREE.Color('#765b40').multiplyScalar(.83+random()*.28),.68));}}
for(let row=1;row<20;row+=2)box(-5.257,-.015,-4.65+row*.48,1.485,.08,.465,oak);
for(const o of scene.children){if(o.isMesh&&o.position.y===-.015){o.material.onBeforeCompile=oak.onBeforeCompile;o.material.customProgramCacheKey=oak.customProgramCacheKey;}}
box(0,2.4,-4.9,12,4.8,.25,cream); // cutouts below replace opaque window wall segments with recessed light apertures
// Windows sit forward of the wall; their illuminated inset gives the cutaway interior depth.
for(const x of [-3.25,2.7]){
box(x,2.9,-4.72,2.03,2.95,.2,darkwood);const glass=mat('#b1d7dd',.22);glass.emissive=new THREE.Color('#b9e0ee');glass.emissiveIntensity=2.4;
box(x,2.92,-4.56,1.77,2.65,.055,glass);for(const dx of [-.96,0,.96])box(x+dx,2.9,-4.43,.075,2.91,.16,oak);for(const yy of [1.45,2.32,3.21,4.35])box(x,yy,-4.43,2.02,.085,.16,oak);
box(x,1.42,-4.32,2.23,.16,.55,trim);box(x,4.44,-4.46,2.24,.16,.3,trim);
const sun=new THREE.SpotLight('#c5e4f5',65,14,.4,.45,1.4);sun.position.set(x,3.7,-4.2);sun.target.position.set(x-1.1,0,.4);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;
}
for(let x=-5.7;x<=6;x+=1.42){box(x,.6,-4.69,1.36,1.2,.1,teal);box(x,.6,-4.6,1.18,.96,.025,trim);box(x,.6,-4.57,1.07,.85,.025,teal);}
for(const y of [.12,1.24,1.31,4.73])box(0,y,-4.53,12,y===4.73?.22:.055,.22,trim);
for(const x of [-5.9,5.9]){box(x,2.32,-1.2,.22,4.65,7.5,cream);box(x,.66,-1.2,.27,1.3,7.5,teal);box(x,1.32,-1.2,.32,.09,7.5,trim);for(let z=-4.6;z<3;z+=1.65)box(x-.03,.64,z,.35,1.1,.07,trim);box(x,4.66,-1.2,.38,.26,7.5,trim);}
for(let x of [-5.7,-.3,5.7]){box(x,2.35,-4.42,.25,4.7,.3,trim);box(x,.18,-4.4,.4,.3,.4,oak);box(x,4.45,-4.4,.44,.25,.4,oak);}
// A low foreground threshold and a few beams frame the room without concealing the player.
box(0,.1,4.72,12,.2,.22,trim);box(-5.82,1.8,3.1,.3,3.6,.3,trim);box(5.82,1.8,3.1,.3,3.6,.3,trim);

// Woven rug: small repeating stitches, border braids and a compass medallion.
const rugmat=mat('#234d53',.99);rugmat.onBeforeCompile=s=>{s.vertexShader='varying vec2 vRug;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRug=uv;');s.fragmentShader='varying vec2 vRug;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 p=(vRug-.5)*vec2(7.6,6.4);vec2 edge=vec2(3.8,3.2)-abs(p);float e=min(edge.x,edge.y);
float border=step(.13,e)*(1.-step(.155,e))+step(.37,e)*(1.-step(.395,e));
float braid=(1.-smoothstep(.014,.045,abs(sin((p.x+p.y)*17.0))))*step(.19,e)*(1.-step(.32,e));
float r=length(p);float a=atan(p.y,p.x);float compass=1.-smoothstep(.018,.04,abs(r-(.6+.18*cos(a*8.0))));
float ring=1.-smoothstep(.014,.03,abs(r-1.04));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.48,.34,.16),clamp(border+braid*.65+compass*.8+ring*.6,0.,1.));
diffuseColor.rgb*=.94+.06*sin(vRug.x*2400.)*sin(vRug.y*2100.);`);};
const rug=mesh(new THREE.PlaneGeometry(7.6,6.4),rugmat,0,.044,.55);rug.rotation.x=-Math.PI/2;for(let i=0;i<85;i++){box(-3.7+i*.088,.043,-2.72,.035,.009,.15,pages);box(-3.7+i*.088,.043,3.82,.035,.009,.15,pages);}

// The writer's desk: drawers, turned legs, paper, books and candle light.
function book(x,y,z,w=.25,h=.36,d=.18,color='#54676a',flat=false){const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);box(0,h/2,0,w,h,d,pages,g);const cover=mat(color);for(const xx of [-w/2,w/2])box(xx,h/2,0,.025,h+.025,d+.04,cover,g);box(0,h/2,d/2,w+.04,h+.03,.035,cover,g);for(const yy of [.08,h-.07])box(0,yy,d/2+.02,w,.016,.008,brass,g);if(flat)g.rotation.z=Math.PI/2;return g;}
box(-.35,1.1,-2.85,2.6,.14,1.03,oak);box(-.35,1.015,-2.85,2.72,.055,1.13,trim);for(const x of [-1.43,.73])for(const z of [-3.22,-2.48])leg(x,z,1.05);for(let x of [-1.12,-.35,.42]){box(x,.87,-2.38,.69,.23,.15,trim);box(x,.87,-2.29,.57,.15,.035,oak);sphere(x,.87,-2.25,.035,brass);}
solid(-.35,-2.85,2.7,1.12,'writing desk');const paper=box(-.25,1.183,-2.73,.7,.012,.48,pages);paper.rotation.y=-.13;for(let i=0;i<6;i++)box(-.29,1.191,-2.91+i*.052,.42-random()*.13,.003,.007,trim);
book(-1.05,1.25,-2.84,.16,.43,.32,'#834c3d',true);book(-1.04,1.4,-2.88,.12,.4,.3,'#36565c',true);cyl(.15,1.24,-3,.08,.13,ink);const quill=mesh(new THREE.ConeGeometry(.024,.36,5),pages,.15,1.45,-3);quill.rotation.z=-.3;
inspect(-.35,-2.25,1.35,'The unfinished letter',"Welcome to my HD2D demo of the adventures of Tikoon!\n\nThe full game isn't ready yet. Follow @manu.vision on Instagram to follow the progress.\n\n— Manuel Sainsily");

const fireUniform={value:0};
function candle(x,y,z,scale=1){cyl(x,y+.045*scale,z,.13*scale,.06*scale,brass);cyl(x,y+.18*scale,z,.035*scale,.27*scale,brass);cyl(x,y+.34*scale,z,.09*scale,.045*scale,brass);cyl(x,y+.47*scale,z,.055*scale,.23*scale,pages);const f=sphere(x,y+.64*scale,z,.056*scale,new THREE.MeshBasicMaterial({color:'#ffe2a1'}));f.scale.set(.65,1.8,.65);flames.push(f);const l=new THREE.PointLight('#ffb45f',2.3*scale,4.2,1.4);l.position.set(x,y+.65*scale,z);scene.add(l);lamps.push({l,base:l.intensity});}
candle(.61,1.18,-2.95,.75);

// Hearth made of staggered masonry around a genuinely open firebox.
box(-4.65,.12,-2.5,2.13,.22,1.35,stone);box(-4.65,1.55,-3.04,1.85,2.8,.5,stone);box(-4.65,.75,-2.74,1.15,1.25,.035,ink);
for(let row=0;row<4;row++)for(const x of [-5.38,-3.91])box(x,.3+row*.32,-2.58,.38,.3,.75,mat(new THREE.Color('#8c8572').multiplyScalar(.8+random()*.3)));
for(let i=0;i<5;i++)box(-5.37+i*.36,1.51,-2.57,.34,.34,.75,stone);
box(-4.65,1.75,-2.6,2.04,.19,1,trim);box(-4.65,1.65,-2.65,1.88,.06,.92,brass);
for(let i=0;i<4;i++){const log=cyl(-4.96+i*.2,.3,-2.46,.105,.8,darkwood);log.rotation.z=Math.PI/2;log.rotation.y=(i%2-.5)*.45;}
const fireMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:fireUniform},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float time;void main(){vec2 p=vUv;float sway=sin(p.y*12.-time*6.)*.045*p.y;float w=(1.-p.y)*.42;float edge=1.-smoothstep(w*.5,w,abs(p.x-.5+sway));float a=edge*smoothstep(0.,.12,p.y)*(1.-smoothstep(.7,1.,p.y));vec3 c=mix(vec3(1.,.19,.015),vec3(1.,.88,.3),edge*(1.-p.y));gl_FragColor=vec4(c*2.2,a);}`});
for(let i=0;i<5;i++){let f=mesh(new THREE.PlaneGeometry(.42,.65+random()*.3),fireMat,-5.04+i*.2,.65,-2.32+random()*.12);f.castShadow=false;}
const firelight=new THREE.PointLight('#ff9a45',22,9,1.6);firelight.position.set(-4.6,.9,-1.9);scene.add(firelight);lamps.push({l:firelight,base:22});solid(-4.65,-2.6,2.05,1.4,'hearth');candle(-5.27,1.86,-2.65,.8);vase(-4.12,1.85,-2.78,.48);
inspect(-4.65,-1.72,1.1,'The hearth','Warm stone. Cedar smoke. For a moment, there is nowhere else you need to be.');

// Bookcase and a cabinet, with objects built at the same furniture scale.
box(4.75,1.45,-3.7,1.8,2.9,.55,trim);box(4.75,1.48,-3.39,1.58,2.64,.025,ink);for(let y of [.17,.89,1.62,2.35,2.91])box(4.75,y,-3.35,1.96,.11,.8,oak);for(let x of [3.83,5.67])box(x,1.5,-3.33,.14,2.95,.77,oak);
for(let row=0;row<3;row++)for(let i=0;i<7;i++){const g=book(4.01+i*.22,.96+row*.72,-3.19,.14,.35+random()*.19,.3,['#715245','#546653','#355662','#a18355'][Math.floor(random()*4)]);if(i===6)g.rotation.z=-.1;}
for(let i=0;i<2;i++){box(4.3+i*.9,.51,-2.95,.81,.54,.1,trim);box(4.3+i*.9,.51,-2.88,.7,.43,.05,teal);sphere(4.58+i*.34,.55,-2.83,.035,brass);}
solid(4.75,-3.4,1.98,.9,'bookcase');inspect(4.6,-2.65,1.2,'A traveller’s collection','Tide charts, pressed leaves, and a guide to the constellations. Every spine carries a different journey.');
plant(3.22,-3.86,.95);plant(-5.03,.6,.9);

// Reading nook: upholstered armchair, turned tea table, cup and cushion.
const chair=new THREE.Group();chair.position.set(3.8,0,1.35);chair.rotation.y=-.26;scene.add(chair);
for(let x of [-.47,.47])for(let z of [-.39,.39])leg(x,z,.45,chair);
box(0,.54,0,1.2,.23,1.08,trim,chair);box(0,.7,.04,.96,.18,.86,teal,chair);box(0,1.1,-.47,1.15,1.1,.22,trim,chair);box(0,1.18,-.32,.95,.86,.16,teal,chair);for(let x of [-.61,.61]){box(x,.9,0,.14,.12,1.17,oak,chair);box(x,.73,.42,.09,.4,.09,trim,chair);}for(let y of [1.05,1.35])for(let x of [-.22,.22])sphere(x,y,-.22,.025,brass,chair);solid(3.8,1.35,1.5,1.5,'armchair');
cyl(2.22,.78,1.42,.52,.09,oak);cyl(2.22,.39,1.42,.075,.74,trim);for(let i=0;i<3;i++){const b=box(2.22,.09,1.42,.72,.06,.09,trim);b.rotation.y=i*Math.PI/3;}
cyl(2.2,.86,1.42,.13,.028,pages);cyl(2.2,.94,1.42,.079,.14,cream);const handle=torus(2.3,.95,1.42,.048,.015,cream);candle(2.3,.83,1.1,.5);solid(2.22,1.42,.92,.92,'tea table');inspect(2.2,.8,.9,'A cup of lemongrass','Still warm. Someone was expecting you.');
// A bench and travel satchel near the threshold.
box(-3.9,.62,2.45,2.1,.14,.66,oak);for(let x of [-4.75,-3.05])for(let z of [2.2,2.7])leg(x,z,.6);box(-4.18,.86,2.43,.6,.39,.37,trim);const strap=torus(-4.18,1.06,2.43,.21,.03,brass);strap.scale.y=.65;solid(-3.9,2.45,2.15,.7,'bench');inspect(-3.9,1.85,1,'The travel bag','Your machete is close at hand. Press B to swing it, or E to roll when there is nothing to examine.');

// Small hanging lamp, architectural details and an original nautical wall ornament.
const compass=torus(-.35,3.05,-4.24,.54,.035,brass);cyl(-.35,4.26,-.8,.016,1.02,brass);const lampRing=torus(-.35,3.77,-.8,.44,.035,brass);lampRing.rotation.x=Math.PI/2;for(let i=0;i<4;i++){const a=i*Math.PI/2;candle(-.35+Math.cos(a)*.4,3.63,-.8+Math.sin(a)*.4,.43);}
for(let i=0;i<8;i++){const n=box(-.35+Math.sin(i*Math.PI/4)*.35,3.05+Math.cos(i*Math.PI/4)*.35,-4.24,.025,.22,.03,brass);n.rotation.z=-i*Math.PI/4;}
scene.add(new THREE.HemisphereLight('#bbd2e2','#674329',1.15));const fill=new THREE.DirectionalLight('#e8d3ae',1.15);fill.position.set(0,6,8);scene.add(fill);
const key=new THREE.DirectionalLight('#cadfed',2);key.position.set(-3,7,-1);scene.add(key);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.1,far:25});key.shadow.normalBias=.035;
key.shadow.radius=4;
// Framed botanical specimen on the right wall, and draped linen at the windows.
const specimen=new THREE.Group();specimen.position.set(5.7,2.8,-.9);specimen.rotation.y=-Math.PI/2;scene.add(specimen);
box(0,0,0,1.5,1.7,.07,trim,specimen);box(0,0,.045,1.33,1.53,.025,pages,specimen);box(0,-.05,.066,.012,1.05,.012,teal,specimen);
for(let i=0;i<8;i++){const leaf=mesh(new THREE.SphereGeometry(.1,10,6),teal,(i%2?1:-1)*.13,-.45+i*.12,.071,specimen);leaf.scale.set(1.9,.6,.05);leaf.rotation.z=(i%2?1:-1)*.45;}
const linen=mat('#a6997f',1);linen.side=THREE.DoubleSide;
for(const x of [-3.25,2.7])for(const side of [-1,1]){const geo=new THREE.PlaneGeometry(.45,2.9,12,18);const a=geo.attributes.position;for(let i=0;i<a.count;i++){const xx=a.getX(i),yy=a.getY(i);a.setZ(i,Math.sin(xx*55)*.055);a.setX(i,xx+side*Math.sin((yy+1.45)/2.9*Math.PI)*.12);}geo.computeVertexNormals();mesh(geo,linen,x+side*1.14,2.91,-4.21);box(x+side*1.15,2.19,-4.13,.4,.04,.035,brass);}

// Transparent light shafts with soft cross-sections, and deliberately square pixel motes.
const beamMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){float a=pow(sin(vUv.x*3.14159),2.)*sin(vUv.y*3.14159)*.045;gl_FragColor=vec4(.65,.81,1.,a);}'});
for(const x of [-3.25,2.7])for(let i=0;i<3;i++){const a=new THREE.Vector3(x-.58+i*.55,3.95,-4.35),b=new THREE.Vector3(x-1.7+i*.7,.1,1.3);const mid=a.clone().add(b).multiplyScalar(.5),o=mesh(new THREE.PlaneGeometry(.5,a.distanceTo(b)),beamMat,...mid.toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),a.clone().sub(b).normalize());o.castShadow=false;}
const dustPositions=new Float32Array(135*3);for(let i=0;i<135;i++){dustPositions[i*3]=(random()-.5)*10;dustPositions[i*3+1]=.3+random()*4;dustPositions[i*3+2]=-4+random()*8;}
const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#e9d9b5',size:.025,sizeAttenuation:true,transparent:true,opacity:.6,depthWrite:false}));scene.add(dust);

// One mesh per actor, with the approved image pixels and authored pivots preserved.
const loader=new THREE.TextureLoader();const names=['raccoon-master','raccoon-machete','raccoon-roll'];const sheets={};
try{await Promise.all(names.map(async n=>{const [texture,data]=await Promise.all([loader.loadAsync('./assets/'+n+'.png'),fetch('./assets/'+n+'.json').then(r=>{if(!r.ok)throw Error(n);return r.json()})]);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;sheets[n]={texture,data};}));}catch(e){$('#loading').textContent='The sprites could not load. Please reload to try again.';throw e;}
const actorMat=new THREE.MeshStandardMaterial({map:sheets['raccoon-master'].texture,alphaTest:.5,roughness:1,side:THREE.DoubleSide});
const actor=mesh(new THREE.PlaneGeometry(1,1),actorMat,0,0,1.5);actor.castShadow=true;actor.receiveShadow=true;
actor.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:actorMat.map,alphaTest:.5,side:THREE.DoubleSide});
const player={x:0,z:.7,dir:'south',action:'idle',elapsed:0,walkTime:0};const pixel=.066,keys=new Set();let joystick={x:0,z:0},nearby=null,modal=false,collisions=0,rollVector={x:0,z:0};
const shadowMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){float a=(1.-smoothstep(.1,.5,length(vUv-.5)))*.38;gl_FragColor=vec4(.025,.018,.012,a);}'});
const shadow=mesh(new THREE.PlaneGeometry(1.02,.56),shadowMat);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
const dirs={south:[0,1],east:[1,0],north:[0,-1],west:[-1,0]};
const durations={attack:[80,60,40,50,70,80,100],roll:[60,60,70,60,70,70,60,90]};
let lastPose='';function pose(){let n='raccoon-master',f,mirror=false,index=0;if(player.action==='attack'||player.action==='roll'){n=player.action==='roll'?'raccoon-roll':'raccoon-machete';const frames=sheets[n].data.frames.filter(f=>f.filename.startsWith(player.action+'_'+player.dir+'_'));let elapsed=player.elapsed*1000;index=0;while(index<frames.length-1&&elapsed>=durations[player.action][index]){elapsed-=durations[player.action][index++];}f=frames[index];}else{const d={south:0,east:1,north:2,west:1}[player.dir];index=player.action==='walk'?3+d*4+Math.floor(player.walkTime/.16)%4:d;f=sheets[n].data.frames[index];mirror=player.dir==='west';}const id=n+index+player.dir;if(id===lastPose)return;lastPose=id;const r=f.frame,p=f.pivot||{x:8,y:32},t=sheets[n].texture,iw=t.image.width,ih=t.image.height;
t.repeat.set((mirror?-1:1)*r.w/iw,r.h/ih);t.offset.set((r.x+(mirror?r.w:0))/iw,1-(r.y+r.h)/ih);actorMat.map=t;actorMat.needsUpdate=true;actor.customDepthMaterial.map=t;actor.customDepthMaterial.needsUpdate=true;
const g=actor.geometry,ps=g.attributes.position;const left=-p.x*pixel,right=(r.w-p.x)*pixel,top=p.y*pixel,bottom=(p.y-r.h)*pixel;ps.setXYZ(0,left,top,0);ps.setXYZ(1,right,top,0);ps.setXYZ(2,left,bottom,0);ps.setXYZ(3,right,bottom,0);ps.needsUpdate=true;g.computeBoundingSphere();}
function blocked(x,z){return x<-5.45||x>5.45||z<-4.25||z>4.32||colliders.some(c=>Math.abs(x-c.x)<c.w/2+.23&&Math.abs(z-c.z)<c.d/2+.23);}
function move(dx,dz){if(!blocked(player.x+dx,player.z))player.x+=dx;else if(dx)collisions++;if(!blocked(player.x,player.z+dz))player.z+=dz;else if(dz)collisions++;}
function dismiss(){$('#dialog').hidden=true;modal=false;keys.clear();}
function action(kind){if(modal){dismiss();return;}if(!$('#help-panel').hidden||['attack','roll'].includes(player.action))return;if(kind==='interact'&&nearby){$('#dialog-label').textContent=nearby.name.toUpperCase();$('#dialog-text').textContent=nearby.text;$('#dialog').hidden=false;modal=true;keys.clear();return;}player.action=kind==='attack'?'attack':'roll';player.elapsed=0;const [x,z]=dirs[player.dir];rollVector={x,z};}
document.addEventListener('keydown',e=>{if(e.target.closest?.('button')&&['Space','Enter'].includes(e.code))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();if(e.repeat)return;keys.add(e.code);if(['KeyE','Space','Enter'].includes(e.code))action('interact');if(['KeyB','KeyX'].includes(e.code))action('attack');if(e.code==='Escape'){dismiss();$('#help-panel').hidden=true;}});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();joystick={x:0,z:0};});document.addEventListener('visibilitychange',()=>{keys.clear();joystick={x:0,z:0};});
$('#dismiss').onclick=dismiss;$('#prompt').onclick=()=>action('interact');$('#help').onclick=()=>{$('#help-panel').hidden=!$('#help-panel').hidden;keys.clear();};$('#close-help').onclick=()=>$('#help-panel').hidden=true;
// Secondary touches do not reliably produce clicks. Trigger each action on its own
// pointer-down, and reserve click for keyboard/assistive activation to avoid doubles.
for(const [selector,kind] of [['#interact','interact'],['#attack','attack']]){const button=$(selector);let pressedPointer=null;const release=e=>{if(e&&e.pointerId!==pressedPointer)return;pressedPointer=null;button.classList.remove('is-pressed');};button.onpointerdown=e=>{if(e.button!==0||pressedPointer!==null)return;e.preventDefault();pressedPointer=e.pointerId;button.setPointerCapture(e.pointerId);button.classList.add('is-pressed');action(kind);};button.onpointerup=button.onpointercancel=button.onlostpointercapture=release;window.addEventListener('blur',()=>release());button.onclick=e=>{if(e.detail===0)action(kind);};}
const stick=$('#stick');let stickPointer=null;function stickMove(e){const r=stick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/38,dz=(e.clientY-r.top-r.height/2)/38,l=Math.max(1,Math.hypot(dx,dz));joystick={x:dx/l,z:dz/l};$('#thumb').style.transform=`translate(${joystick.x*33}px,${joystick.z*33}px)`;}
stick.onpointerdown=e=>{if(stickPointer!==null)return;e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);stickMove(e);};stick.onpointermove=e=>{if(e.pointerId===stickPointer)stickMove(e)};function stickEnd(e){if(e.pointerId!==stickPointer)return;stickPointer=null;joystick={x:0,z:0};$('#thumb').style.transform='';}stick.onpointerup=stick.onpointercancel=stick.onlostpointercapture=stickEnd;
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom*Math.exp(e.deltaY*.0006),.7,1.3);},{passive:false});const touches=new Map();let pinch=0;canvas.onpointerdown=e=>{touches.set(e.pointerId,[e.clientX,e.clientY]);canvas.setPointerCapture(e.pointerId);if(touches.size===2){const [a,b]=[...touches.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);}};canvas.onpointermove=e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,[e.clientX,e.clientY]);if(touches.size===2){const [a,b]=[...touches.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch>0)zoom=THREE.MathUtils.clamp(zoom*pinch/d,.7,1.3);pinch=d;}};canvas.onpointerup=canvas.onpointercancel=e=>{touches.delete(e.pointerId);pinch=0;};

// Filmic tilt shift: a sharp band tracks the actor, with depth-aware foreground/background blur.
const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(1,1)});target.samples=2;
const postScene=new THREE.Scene(),postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const postMat=new THREE.ShaderMaterial({uniforms:{tColor:{value:target.texture},tDepth:{value:target.depthTexture},resolution:{value:new THREE.Vector2()},focus:{value:15},focusY:{value:.5},near:{value:.1},far:{value:80}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`varying vec2 vUv;uniform sampler2D tColor,tDepth;uniform vec2 resolution;uniform float focus,focusY,near,far;
float depth(vec2 uv){float d=texture2D(tDepth,uv).x;return 2.*near*far/(far+near-(d*2.-1.)*(far-near));}
void main(){vec3 c=texture2D(tColor,vUv).rgb;float dist=abs(depth(vUv)-focus);float band=smoothstep(.14,.43,abs(vUv.y-focusY));float blur=min(3.2,smoothstep(2.,7.,dist)*2.2+band*1.8);vec3 sum=c*2.;vec3 bloom=vec3(0.);for(int i=0;i<12;i++){float a=float(i)*2.399963;vec2 v=vec2(cos(a),sin(a));sum+=texture2D(tColor,vUv+v*blur/resolution).rgb;vec3 b=texture2D(tColor,vUv+v*5./resolution).rgb;bloom+=max(b-vec3(1.15),vec3(0.));}c=sum/14.+bloom*.024;float vig=1.-.3*smoothstep(.25,.77,length((vUv-.5)*vec2(1.,.88)));c*=vig;gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),postMat));
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();const size=renderer.getDrawingBufferSize(new THREE.Vector2());target.setSize(size.x,size.y);postMat.uniforms.resolution.value.copy(size);}
window.addEventListener('resize',resize);resize();$('#loading').classList.add('done');
let elapsed=0,frameCount=0;const projected=new THREE.Vector3();
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);elapsed+=dt;fireUniform.value=elapsed;
if(!modal&&$('#help-panel').hidden){if(['attack','roll'].includes(player.action)){player.elapsed+=dt;if(player.action==='roll'){const t=player.elapsed/.54;const speed=t>.12&&t<.75?5:0;move(rollVector.x*speed*dt,rollVector.z*speed*dt);}if(player.elapsed> (player.action==='roll'?.54:.48)){player.action='idle';player.elapsed=0;}}else{let x=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0)+joystick.x,z=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0)+joystick.z;const len=Math.hypot(x,z);if(len>.15){if(len>1){x/=len;z/=len;}player.dir=Math.abs(x)>Math.abs(z)?x>0?'east':'west':z>0?'south':'north';player.action='walk';player.walkTime+=dt;move(x*1.9*dt,z*1.9*dt);}else{player.action='idle';player.walkTime=0;}}}
pose();actor.position.set(player.x,.065,player.z);shadow.position.set(player.x,.052,player.z); // vertical billboard: feet remain on the floor
let aspect=innerWidth/innerHeight;const distance=aspect<.8?15.8:aspect<1.3?15:13.5;const followX=player.x*(aspect<.8?.66:.12),followZ=player.z*.14;camera.position.lerp(new THREE.Vector3(followX,8.2*zoom,distance*zoom+followZ),.08);camera.lookAt(followX,.9,followZ-.35);actor.rotation.y=Math.atan2(camera.position.x-player.x,camera.position.z-player.z);
for(let i=0;i<lamps.length;i++)lamps[i].l.intensity=lamps[i].base*(1+Math.sin(elapsed*6.2+i)*.035+Math.sin(elapsed*13+i)*.018);for(let i=0;i<flames.length;i++)flames[i].scale.y=1.6+Math.sin(elapsed*8+i)*.22;
for(let i=0;i<135;i++){dustPositions[i*3]+=(Math.sin(elapsed*.4+i)*.012)*dt;dustPositions[i*3+1]+=.028*dt;if(dustPositions[i*3+1]>4.3)dustPositions[i*3+1]=.2;}dustGeo.attributes.position.needsUpdate=true;
const [dx,dz]=dirs[player.dir];nearby=interactables.find(o=>{let vx=o.x-player.x,vz=o.z-player.z;return Math.hypot(vx,vz)<o.r&&(vx*dx+vz*dz)>-.05;})||null;$('#prompt').hidden=!nearby||modal||!$('#help-panel').hidden;if(nearby)$('#prompt').textContent=(matchMedia('(any-pointer: coarse), (max-width: 900px)').matches?'A':'E')+' · '+nearby.name;
projected.set(player.x,.7,player.z).project(camera);postMat.uniforms.focusY.value=projected.y*.5+.5;const cp=new THREE.Vector3(player.x,.7,player.z).applyMatrix4(camera.matrixWorldInverse);postMat.uniforms.focus.value=-cp.z;
renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCamera);frameCount++;
}
window.hd2d={snapshot:()=>({player:{...player},nearby:nearby?.name||null,modal,collisions,frameCount,zoom,lights:lamps.map(o=>({x:o.l.position.x,z:o.l.position.z,intensity:o.l.intensity})),spriteMaterial:actorMat.type,shadow:actor.castShadow,objects:scene.children.length,render:renderer.info.render,viewport:{width:innerWidth,height:innerHeight}})};animate();
