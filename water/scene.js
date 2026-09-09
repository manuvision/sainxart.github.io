import * as THREE from './vendor/three.module.min.js';
import { sphereFillHeight } from './model.js';

export function createWaterScene(container, { fraction, paused: initialPaused }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x080b10, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 30);
  camera.position.set(0, .28, 6.6);
  camera.lookAt(0, -.04, 0);
  const uniforms = {
    uTime: { value: 0 }, uFill: { value: sphereFillHeight(fraction) },
    uPointer: { value: new THREE.Vector2() },
  };
  const geometry = new THREE.SphereGeometry(1.44, 112, 80);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vPosition;
      varying vec3 vNormal;
      void main(){
        vPosition = position;
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uFill;
      uniform vec2 uPointer;
      varying vec3 vPosition;
      varying vec3 vNormal;
      const float R = 1.44;
      float waves(vec3 p){
        float t=uTime*.23;
        return sin(p.x*7.+p.z*4.+t*1.3)*.36
          + sin(p.y*9.-p.x*3.-t)*.27
          + sin(p.z*12.+p.y*7.+t*.7)*.16
          + sin(p.x*18.+p.z*14.-t*1.9)*.07;
      }
      vec3 rippleNormal(vec3 p,vec3 n,float amplitude){
        float e=.025;
        vec3 grad=vec3(waves(p+vec3(e,0,0))-waves(p-vec3(e,0,0)),waves(p+vec3(0,e,0))-waves(p-vec3(0,e,0)),waves(p+vec3(0,0,e))-waves(p-vec3(0,0,e)))/(2.*e);
        return normalize(n+(grad-n*dot(grad,n))*amplitude);
      }
      vec3 studio(vec3 d){
        vec3 col=vec3(.021,.033,.046);
        float broad=pow(max(dot(d,normalize(vec3(-.65,1.,1.))),0.),18.);
        col+=vec3(.63,.78,.85)*broad*1.3;
        float ribbon=exp(-pow((d.x+.49+d.y*.2)/.058,2.))*smoothstep(-.5,.15,d.y)*smoothstep(-.4,.4,d.z);
        col+=vec3(.9,.98,1.)*ribbon*3.2;
        float right=exp(-pow((d.x-.64+d.y*.12)/.034,2.))*smoothstep(-.35,.3,d.z);
        col+=vec3(.62,.9,1.)*right*2.5;
        float top=pow(max(dot(d,normalize(vec3(.3,1.,.2))),0.),55.);
        col+=vec3(.91,.96,1.)*top*2.;
        float bottom=pow(max(dot(d,normalize(vec3(-.1,-.8,.4))),0.),6.);
        col+=vec3(.035,.19,.24)*bottom;
        return col;
      }
      void main(){
        vec3 p=vPosition/R;
        vec3 viewDir=normalize(cameraPosition-vPosition);
        float nearWater=1.-smoothstep(.02,.19,abs(p.y-uFill));
        vec3 n=rippleNormal(p,normalize(vNormal),.026+nearWater*.036);
        vec3 ray=refract(-viewDir,n,1./1.333);
        float travel=max(0.,-2.*dot(p,ray));
        vec3 exitP=p+ray*travel;
        float waterLength=0.;
        float surfaceHit=-1.;
        if(abs(ray.y)>.0001){
          surfaceHit=(uFill-p.y)/ray.y;
          if(ray.y<0.) waterLength=max(0.,travel-max(0.,surfaceHit));
          else waterLength=max(0.,min(travel,surfaceHit));
        }else if(p.y<uFill) waterLength=travel;
        waterLength=clamp(waterLength,0.,travel);
        float submerged=1.-smoothstep(uFill-.008,uFill+.008,p.y);
        vec3 exitNormal=rippleNormal(exitP,normalize(exitP),.055);
        vec3 outRay=refract(ray,-exitNormal,1.333);
        if(length(outRay)<.01) outRay=reflect(ray,-exitNormal);
        vec3 behind=studio(outRay)*.34;
        vec3 reflection=studio(reflect(-viewDir,n));
        float fresnel=.025+.975*pow(1.-max(dot(n,viewDir),0.),4.);
        vec3 absorption=exp(-waterLength*vec3(1.65,.42,.28));
        vec3 waterColor=vec3(.045,.28,.34);
        vec3 color=behind*absorption+waterColor*(1.-absorption)*.68;
        if(surfaceHit>0. && surfaceHit<travel){
          vec3 surfaceP=p+ray*surfaceHit;
          vec3 wn=rippleNormal(surfaceP,vec3(0,1,0),.026);
          vec3 sref=studio(reflect(ray,wn));
          float sf=pow(1.-abs(dot(ray,wn)),3.);
          color=mix(color,sref*.6+vec3(.035,.16,.19),.26+sf*.42);
          float rings=sin(length(surfaceP.xz)*29.-uTime*1.2+sin(surfaceP.x*10.)*.6);
          color+=vec3(.11,.25,.28)*pow(max(rings,0.),16.)*.12;
        }
        // Refracted caustic filaments drift through the water, independent of volume.
        float caustic=sin(p.x*10.+sin(p.z*9.+uTime*.27)*2.+p.y*13.-uTime*.21);
        caustic=pow(abs(caustic),22.);
        color+=vec3(.11,.37,.43)*caustic*submerged*.18;
        float line=exp(-abs(p.y-uFill+waves(p)*.004)*210.);
        color+=vec3(.38,.75,.78)*line*.65;
        color=mix(color,reflection,fresnel*.84+.07);
        float edge=pow(1.-max(dot(normalize(vNormal),viewDir),0.),7.);
        color+=vec3(.22,.43,.52)*edge*.28;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);
  // Thin orbital marks ground the vessel without competing with the volume.
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x85b4c3, transparent: true, opacity: .1 });
  const rings=[];
  [1.6,1.82,2.03].forEach((radius,i)=>{
    const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.0018,3,160),ringMaterial.clone());
    ring.rotation.x=Math.PI/2;
    ring.position.y=-1.67-i*.009;
    ring.material.opacity=.12-i*.03;
    scene.add(ring); rings.push(ring);
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.7,5.7),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uTime:uniforms.uTime},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uTime;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=exp(-r*r*7.)*.07;float ring=exp(-pow((r-.45)*27.,2.))*.015;gl_FragColor=vec4(.21,.67,.79,(a+ring)*(1.+.1*sin(uTime*.5)));}`
  }));
  glow.rotation.x=-Math.PI/2;glow.position.y=-1.68;scene.add(glow);
  const particlePositions=new Float32Array(60*3);
  for(let i=0;i<60;i++){
    // Seeded positions keep reloads quiet and deterministic.
    const a=i*2.399963;const r=1.7+(Math.sin(i*12.9898)*.5+.5)*.55;
    particlePositions[i*3]=Math.cos(a)*r;
    particlePositions[i*3+1]=Math.sin(i*7.231)*1.5;
    particlePositions[i*3+2]=Math.sin(a)*r*.6-.5;
  }
  const particlesGeometry=new THREE.BufferGeometry();
  particlesGeometry.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
  const particles=new THREE.Points(particlesGeometry,new THREE.PointsMaterial({color:0x8fbfcb,size:.009,transparent:true,opacity:.3,depthWrite:false}));
  scene.add(particles);
  const pointer=new THREE.Vector2();
  const onPointer=event=>{const box=container.getBoundingClientRect();pointer.set((event.clientX-box.left)/box.width-.5,(event.clientY-box.top)/box.height-.5);};
  const resetPointer=()=>pointer.set(0,0);
  container.addEventListener('pointermove',onPointer,{passive:true});
  container.addEventListener('pointerleave',resetPointer);
  let paused=initialPaused,disposed=false,time=0,last=performance.now(),raf=0;
  function resize(){
    const {width,height}=container.getBoundingClientRect();
    if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;
    camera.position.z=camera.aspect<1?7.4:6.6;camera.updateProjectionMatrix();
    renderer.render(scene,camera);
  }
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  function draw(now){
    if(disposed)return;
    const dt=Math.min((now-last)/1000,.05);last=now;
    if(!paused&&!document.hidden){
      time+=dt;uniforms.uTime.value=time;
      uniforms.uPointer.value.lerp(pointer,.025);
      camera.position.x+=(pointer.x*.22-camera.position.x)*.025;
      camera.position.y+=(.28-pointer.y*.12-camera.position.y)*.025;
      camera.lookAt(0,-.04,0);
      particles.rotation.y=time*.015;
      renderer.render(scene,camera);
    }
    raf=requestAnimationFrame(draw);
  }
  renderer.domElement.addEventListener('webglcontextlost',event=>{
    event.preventDefault();paused=true;
    document.getElementById('graphics-status').hidden=false;
  });
  renderer.domElement.addEventListener('webglcontextrestored',()=>{
    document.getElementById('graphics-status').hidden=true;resize();
    paused=document.getElementById('toggle-motion').getAttribute('aria-pressed')==='true';
  });
  raf=requestAnimationFrame(draw);
  return {
    setFill(f){uniforms.uFill.value=sphereFillHeight(f);},
    setPaused(value){paused=value;last=performance.now();if(paused)renderer.render(scene,camera);},
    dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();container.removeEventListener('pointermove',onPointer);container.removeEventListener('pointerleave',resetPointer);scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});renderer.dispose();renderer.domElement.remove();}
  };
}
