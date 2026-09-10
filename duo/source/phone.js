import * as THREE from 'three';
import { createScreenMaterial } from './screen-material.js';
import { createScreenBlur } from './screen-blur.js';

// Centimetres, from Apple's September 2026 technical specifications.
export const W = 8.23, H = 11.78, D = .52;

function outline(x0, x1, y0, y1, rl, rr) {
  const s = new THREE.Shape();
  s.moveTo(x0 + rl, y0); s.lineTo(x1 - rr, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + rr); s.lineTo(x1, y1 - rr);
  s.quadraticCurveTo(x1, y1, x1 - rr, y1); s.lineTo(x0 + rl, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - rl); s.lineTo(x0, y0 + rl);
  s.quadraticCurveTo(x0, y0, x0 + rl, y0);
  return s;
}

function solid(shape, depth, radius, material) {
  const g = new THREE.ExtrudeGeometry(shape, {depth: depth - 2 * radius, bevelEnabled:true, bevelThickness:radius, bevelSize:radius, bevelSegments:4, steps:1, curveSegments:20});
  g.translate(0,0,radius-depth);
  const m = new THREE.Mesh(g, material); m.castShadow=true; m.receiveShadow=true;
  return m;
}

function plane(shape, material, uvBounds) {
  const g = new THREE.ShapeGeometry(shape, 32);
  if (uvBounds) {
    const p = g.attributes.position, uv = g.attributes.uv;
    for(let i=0;i<p.count;i++) uv.setXY(i,(p.getX(i)-uvBounds[0])/uvBounds[2],(p.getY(i)-uvBounds[1])/uvBounds[3]);
  }
  return new THREE.Mesh(g, material);
}

function disk(radius, depth, material, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,depth,48),material);
  m.rotation.x = Math.PI / 2; m.position.set(x,y,z); parent.add(m); return m;
}

function makeScreen(image, outer, overlay) {
  const c=document.createElement('canvas'); c.width=outer?1000:2048; c.height=outer?1455:1441;
  const ctx=c.getContext('2d',{alpha:false});
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  tex.anisotropy=4;tex.generateMipmaps=true;
  let last=-100;
  function draw(){
    if(last!==-100)return;last=1;
    const w=c.width,h=c.height;
    ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
    ctx.save();ctx.translate(w*.05,h*.05);ctx.scale(.9,.9);
    ctx.drawImage(image,0,0,w,h);
    if(outer){ctx.drawImage(overlay,0,0,w,h);}
    else{
      // Original Apple alpha artwork preserves the custom San Francisco
      // clock numerals, proportions, and glass shading on every platform.
      ctx.drawImage(overlay,0,0,w,h);
    }
    ctx.restore();
    tex.needsUpdate=true;
  }
  draw();return {tex,draw};
}

export async function createPhone(renderer) {
  const loadImage = src => new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Screen image could not load'));im.src=src;});
  const [innerImage,outerImage,innerOverlay,outerOverlay] = await Promise.all([loadImage('./assets/inner-light.webp'),loadImage('./assets/outer-light.webp'),loadImage('./assets/lockscreen-inner.avif'),loadImage('./assets/lockscreen-outer.avif')]);
  const inner = makeScreen(innerImage,false,innerOverlay), outer = makeScreen(outerImage,true,outerOverlay);
  inner.tex.anisotropy=outer.tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const innerBlur=createScreenBlur(renderer,inner.tex);
  const outerBlur=createScreenBlur(renderer,outer.tex,true);
  const titanium = new THREE.MeshPhysicalMaterial({color:0x82878b,metalness:1,roughness:.19,clearcoat:.65,clearcoatRoughness:.12});
  const trim = new THREE.MeshStandardMaterial({color:0x12151b,metalness:.6,roughness:.24});
  const glass = new THREE.MeshPhysicalMaterial({color:0x080a10,roughness:.19,metalness:.1,clearcoat:1,clearcoatRoughness:.1});
  const back = new THREE.MeshPhysicalMaterial({color:0x1b2029,roughness:.42,metalness:.24,clearcoat:.7,clearcoatRoughness:.36});
  const black = new THREE.MeshStandardMaterial({color:0x030509,roughness:.30,metalness:.2});
  const screenMaterials=[];
  const screenMat = (tex,isOuter=false) => {const image=isOuter?outerBlur.texture:innerBlur.texture;const mat=createScreenMaterial(image,isOuter);screenMaterials.push(mat);return mat;};
  const reflective = new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.045,roughness:.22,metalness:.25,clearcoat:1,depthWrite:false});
  const phone=new THREE.Group(), left=new THREE.Group(), right=new THREE.Group();
  phone.add(left,right);
  for(const [group,sign] of [[left,-1],[right,1]]) {
    const x0=sign<0?-W:.027, x1=sign<0?-.027:W;
    const rl=sign<0?.83:.08, rr=sign<0?.08:.83;
    const body=solid(outline(x0+.055,x1-.055,-H/2+.055,H/2-.055,rl-.04,rr-.04),D,.055,titanium);
    body.position.z=-.045; group.add(body);
    const border=solid(outline(x0+.03,x1-.03,-H/2+.06,H/2-.06,rl,rr),.025,.009,trim);
    border.position.z=-.028;group.add(border);
    // Both display edges meet at the rotation axis, with no inset or rounded
    // hinge corners. A single continuous UV field hides the physical joint.
    const faceShape=outline(sign<0?-W+.18:0,sign<0?0:W-.18,-H/2+.20,H/2-.20,sign<0?.69:0,sign<0?0:.69);
    const display=plane(faceShape,screenMat(inner.tex),[-W+.18,-H/2+.20,2*(W-.18),H-.40]);
    group.add(display);
    const backPlate=plane(outline(x0+.13,x1-.13,-H/2+.13,H/2-.13,rl-.08,rr-.08),back);
    backPlate.position.z=-D-.054;backPlate.material.side=THREE.DoubleSide;group.add(backPlate);
    // Fine antenna breaks in the metal band.
    for(const y of [-H/2+1.40,H/2-1.40]) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(.022,.055,.38),new THREE.MeshStandardMaterial({color:0x444953,roughness:.8}));
      a.position.set(sign*(W+.001),y,-D/2-.045);group.add(a);
    }
  }
  const cover=new THREE.Group();cover.position.set(-W/2,0,-D-.065);cover.rotation.y=Math.PI;left.add(cover);
  const coverBorder=plane(outline(-W/2+.09,W/2-.09,-H/2+.11,H/2-.11,.75,.75),glass);
  cover.add(coverBorder);
  const coverShape=outline(-W/2+.21,W/2-.21,-H/2+.23,H/2-.23,.66,.66);
  const coverDisplay=plane(coverShape,screenMat(outer.tex,true),[-W/2+.21,-H/2+.23,W-.42,H-.46]);coverDisplay.position.z=.012;cover.add(coverDisplay);
  const coverSheen=plane(coverShape,reflective);coverSheen.position.z=.017;cover.add(coverSheen);
  disk(.26,.018,black,W/2-.80,H/2-.80,.033,cover);
  const optic=new THREE.MeshPhysicalMaterial({color:0x071224,roughness:.13,metalness:.65,clearcoat:1});
  disk(.135,.023,optic,W/2-.80,H/2-.80,.046,cover);
  // Rear camera plateau: two horizontal 48MP modules and flash.
  const cameraGroup=new THREE.Group();cameraGroup.position.set(W/2,0,-D-.069);cameraGroup.rotation.y=Math.PI;right.add(cameraGroup);
  const plateau=solid(outline(-W/2+.22,W/2-.22,H/2-2.43,H/2-.24,.51,.51),.16,.06,back);
  plateau.position.z=.16;cameraGroup.add(plateau);
  for(const x of [-W/2+1.40,-W/2+3.34]) {
    disk(.81,.21,trim,x,H/2-1.34,.22,cameraGroup);
    disk(.715,.065,titanium,x,H/2-1.34,.35,cameraGroup);
    disk(.66,.07,black,x,H/2-1.34,.39,cameraGroup);
    disk(.49,.075,optic,x,H/2-1.34,.43,cameraGroup);
    disk(.30,.08,new THREE.MeshPhysicalMaterial({color:0x060a12,metalness:.6,roughness:.1,clearcoat:1}),x,H/2-1.34,.45,cameraGroup);
    disk(.10,.006,new THREE.MeshBasicMaterial({color:0x445274}),x-.14,H/2-1.17,.495,cameraGroup);
  }
  disk(.26,.09,new THREE.MeshStandardMaterial({color:0xeae5d6,roughness:.27}),W/2-1.25,H/2-1.12,.26,cameraGroup);
  disk(.065,.02,black,W/2-1.25,H/2-1.81,.28,cameraGroup);
  // Side button, volume controls, USB-C port and drilled speaker openings.
  for(const [y,h] of [[2.45,1.0],[.7,.60],[-.1,.60]]) {
    const button=solid(outline(-.045,.045,-h/2,h/2,.04,.04),.23,.013,titanium);
    button.rotation.y=Math.PI/2;button.position.set(W+.055,y,-.29);right.add(button);
  }
  const port=plane(outline(-.52,.52,-.095,.095,.085,.085),black);port.rotation.x=Math.PI/2;port.position.set(W/2,-H/2-.008,-.30);right.add(port);
  for(const x of [W/2-1.22,W/2-1.45,W/2-1.68,W/2+1.22,W/2+1.45,W/2+1.68]) {
    const hole=new THREE.Mesh(new THREE.CircleGeometry(.06,12),black);hole.rotation.x=Math.PI/2;hole.position.set(x,-H/2-.008,-.30);right.add(hole);
  }
  // Segmented hinge cover sits behind the flexible display and retracts on opening.
  const hinge=new THREE.Group();phone.add(hinge);
  const hingeMat=new THREE.MeshStandardMaterial({color:0x626870,metalness:.88,roughness:.32});
  for(let i=0;i<5;i++) {
    const m=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,H/5-.022,32),hingeMat);
    m.position.set(0,-H/2+(i+.5)*H/5,-.26);hinge.add(m);
  }
  let progress=.65;
  function setFold(p) {
    progress=THREE.MathUtils.clamp(p,0,1);
    left.rotation.y=(1-progress)*Math.PI;
    // Keep the changing silhouette centred without interfering with user orbit.
    const minX=Math.min(0,-W*Math.cos(left.rotation.y));
    phone.position.x=-(W+minX)/2;
    phone.position.z=-W*Math.sin(left.rotation.y)*.16;
    hinge.visible=progress<.995;
    inner.draw(progress);
    innerBlur.update(progress);outerBlur.update(progress);
    for(const mat of screenMaterials)mat.uniforms.progress.value=progress;
  }
  setFold(progress);
  function updateProjection(){for(const mat of screenMaterials)mat.uniforms.phoneInverse.value.copy(phone.matrixWorld).invert();}
  return {phone,left,right,setFold,updateProjection,get progress(){return progress;}};
}
