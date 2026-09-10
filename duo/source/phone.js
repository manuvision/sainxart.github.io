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
  const g = new THREE.ExtrudeGeometry(shape, {depth: depth - 2 * radius, bevelEnabled:true, bevelThickness:radius, bevelSize:radius, bevelSegments:10, steps:1, curveSegments:32});
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
  // Apple's enclosure is mirror-polished titanium with a micro-blasted hinge.
  // A neutral metal and rounded edge section preserve sharp studio reflections.
  const titanium = new THREE.MeshPhysicalMaterial({color:0xd4d9df,metalness:1,roughness:.105,envMapIntensity:1.15,clearcoat:.4,clearcoatRoughness:.075});
  const trim = new THREE.MeshPhysicalMaterial({color:0x090b10,metalness:.42,roughness:.17,clearcoat:.6,clearcoatRoughness:.10});
  const glass = new THREE.MeshPhysicalMaterial({color:0x05070b,roughness:.12,metalness:.05,clearcoat:1,clearcoatRoughness:.07});
  const back = new THREE.MeshPhysicalMaterial({color:0x101722,roughness:.29,metalness:.12,clearcoat:.85,clearcoatRoughness:.18});
  const black = new THREE.MeshStandardMaterial({color:0x030509,roughness:.30,metalness:.2});
  const screenMaterials=[];
  const screenMat = (tex,isOuter=false) => {const image=isOuter?outerBlur.texture:innerBlur.texture;const mat=createScreenMaterial(image,isOuter);screenMaterials.push(mat);return mat;};
  const reflective = new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.045,roughness:.22,metalness:.25,clearcoat:1,depthWrite:false});
  const phone=new THREE.Group(), left=new THREE.Group(), right=new THREE.Group();
  phone.add(left,right);
  // The complete screen-to-back stack is 5.2 mm; decorative layers fit inside
  // that depth instead of being added to an already full-thickness extrusion.
  const shellFront=-.027, shellDepth=D-.045, shellBevel=.12;
  for(const [group,sign] of [[left,-1],[right,1]]) {
    const x0=sign<0?-W:.027, x1=sign<0?-.027:W;
    const rl=sign<0?.83:.08, rr=sign<0?.08:.83;
    const body=solid(outline(x0+shellBevel,x1-shellBevel,-H/2+shellBevel,H/2-shellBevel,Math.max(.025,rl-shellBevel),Math.max(.025,rr-shellBevel)),shellDepth,shellBevel,titanium);
    body.position.z=shellFront; group.add(body);
    // Join the black gasket exactly at the axis, with square hinge corners.
    // Beveling this inner edge leaves a bright notch above/below the display.
    const border=plane(outline(sign<0?x0+.047:0,sign<0?0:x1-.047,-H/2+.057,H/2-.057,sign<0?rl-.037:0,sign<0?0:rr-.037),trim);
    border.position.z=-.018;group.add(border);
    // Both display edges meet at the rotation axis, with no inset or rounded
    // hinge corners. A single continuous UV field hides the physical joint.
    const faceShape=outline(sign<0?-W+.18:0,sign<0?0:W-.18,-H/2+.20,H/2-.20,sign<0?.69:0,sign<0?0:.69);
    const display=plane(faceShape,screenMat(inner.tex),[-W+.18,-H/2+.20,2*(W-.18),H-.40]);
    group.add(display);
    const backPlate=plane(outline(x0+.125,x1-.125,-H/2+.125,H/2-.125,Math.max(.025,rl-.08),Math.max(.025,rr-.08)),back);
    backPlate.position.z=-D+.007;backPlate.material.side=THREE.DoubleSide;group.add(backPlate);
    // Fine antenna breaks in the metal band.
    for(const y of [-H/2+1.40,H/2-1.40]) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(.016,.038,.245),new THREE.MeshStandardMaterial({color:0x626977,roughness:.62}));
      a.position.set(sign*(W+.001),y,-D/2-.005);group.add(a);
    }
  }
  const cover=new THREE.Group();cover.position.set(-W/2,0,-D+.016);cover.rotation.y=Math.PI;left.add(cover);
  // The official outer display has almost square hinge-side (local left)
  // corners, with the continuous rounded perimeter on the opposite edge.
  const coverBorder=plane(outline(-W/2+.085,W/2-.085,-H/2+.10,H/2-.10,.06,.75),glass);
  cover.add(coverBorder);
  const coverScreenHeight=H-.46, coverScreenWidth=coverScreenHeight*1398/2034;
  const coverShape=outline(-coverScreenWidth/2,coverScreenWidth/2,-coverScreenHeight/2,coverScreenHeight/2,.035,.66);
  const coverDisplay=plane(coverShape,screenMat(outer.tex,true),[-coverScreenWidth/2,-coverScreenHeight/2,coverScreenWidth,coverScreenHeight]);coverDisplay.position.z=.012;cover.add(coverDisplay);
  const coverSheen=plane(coverShape,reflective);coverSheen.position.z=.017;cover.add(coverSheen);
  disk(.22,.006,black,W/2-.80,H/2-.80,.016,cover);
  const optic=new THREE.MeshPhysicalMaterial({color:0x071020,roughness:.07,metalness:.42,clearcoat:1,clearcoatRoughness:.035});
  disk(.11,.003,optic,W/2-.80,H/2-.80,.020,cover);
  // Rear camera plateau: two horizontal 48MP modules and flash.
  const cameraGroup=new THREE.Group();cameraGroup.position.set(W/2,0,-D+.006);cameraGroup.rotation.y=Math.PI;right.add(cameraGroup);
  const plateau=solid(outline(-W/2+.24,W/2-.24,H/2-2.40,H/2-.26,.47,.47),.145,.055,back);
  plateau.position.z=.145;cameraGroup.add(plateau);
  for(const x of [-W/2+1.40,-W/2+3.34]) {
    disk(.78,.13,trim,x,H/2-1.34,.175,cameraGroup);
    disk(.714,.055,titanium,x,H/2-1.34,.247,cameraGroup);
    disk(.665,.044,black,x,H/2-1.34,.283,cameraGroup);
    disk(.51,.032,optic,x,H/2-1.34,.310,cameraGroup);
    disk(.30,.025,new THREE.MeshPhysicalMaterial({color:0x050911,metalness:.4,roughness:.055,clearcoat:1,clearcoatRoughness:.025}),x,H/2-1.34,.322,cameraGroup);
    disk(.07,.003,new THREE.MeshBasicMaterial({color:0x7597ca,transparent:true,opacity:.34,depthWrite:false}),x-.14,H/2-1.17,.337,cameraGroup);
  }
  disk(.24,.026,new THREE.MeshStandardMaterial({color:0xeae5d6,roughness:.27}),W/2-1.25,H/2-1.12,.16,cameraGroup);
  disk(.055,.012,black,W/2-1.25,H/2-1.81,.16,cameraGroup);
  // Side button, volume controls, USB-C port and drilled speaker openings.
  for(const [y,h] of [[2.45,1.0],[.7,.60],[-.1,.60]]) {
    const button=solid(outline(-.045,.045,-h/2,h/2,.04,.04),.23,.013,titanium);
    button.rotation.y=Math.PI/2;button.position.set(W+.04,y,-.265);right.add(button);
  }
  const port=plane(outline(-.52,.52,-.085,.085,.08,.08),black);port.rotation.x=Math.PI/2;port.position.set(W/2,-H/2-.008,-.265);right.add(port);
  for(const x of [W/2-1.22,W/2-1.45,W/2-1.68,W/2+1.22,W/2+1.45,W/2+1.68]) {
    const hole=new THREE.Mesh(new THREE.CircleGeometry(.05,20),black);hole.rotation.x=Math.PI/2;hole.position.set(x,-H/2-.008,-.265);right.add(hole);
  }
  // Segmented hinge cover sits behind the flexible display and retracts on opening.
  const hinge=new THREE.Group();phone.add(hinge);
  const hingeMat=new THREE.MeshStandardMaterial({color:0x777d85,metalness:.92,roughness:.29});
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
