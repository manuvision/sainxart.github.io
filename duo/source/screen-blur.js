import * as THREE from 'three';

// Defocus the image before it is projected onto the two moving display leaves.
// Two mip-filtered passes reproduce the very wide, soft falloff of the reference.
export function createScreenBlur(renderer, source, isOuter=false) {
  const width=source.image.width,height=source.image.height;
  const options={depthBuffer:false,stencilBuffer:false,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter};
  const a=new THREE.WebGLRenderTarget(width,height,options);
  const b=new THREE.WebGLRenderTarget(width,height,options);
  const material=new THREE.ShaderMaterial({
    depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{image:{value:source},wipe:{value:0},edge:{value:isOuter?0:1},start:{value:isOuter?0:.45},end:{value:isOuter?.9:1}},
    vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`
      uniform sampler2D image;uniform float wipe,edge,start,end;varying vec2 v;
      // Cubic B-spline reconstruction at each mip keeps large blur footprints smooth.
      vec4 weights(float t){float q=1.-t;return vec4(q*q*q,3.*t*t*t-6.*t*t+4.,-3.*t*t*t+3.*t*t+3.*t+1.,t*t*t)/6.;}
      vec3 cubicMip(vec2 uv,float level){
        vec2 size=vec2(textureSize(image,int(level)));
        vec2 p=uv*size-.5,f=fract(p),base=floor(p);
        vec4 wx=weights(f.x),wy=weights(f.y);
        vec2 gx=vec2(wx.x+wx.y,wx.z+wx.w),gy=vec2(wy.x+wy.y,wy.z+wy.w);
        vec2 x=base.x+vec2(-1.+wx.y/gx.x,1.+wx.w/gx.y)+.5;
        vec2 y=base.y+vec2(-1.+wy.y/gy.x,1.+wy.w/gy.y)+.5;
        return textureLod(image,vec2(x.x,y.x)/size,level).rgb*gx.x*gy.x
          +textureLod(image,vec2(x.y,y.x)/size,level).rgb*gx.y*gy.x
          +textureLod(image,vec2(x.x,y.y)/size,level).rgb*gx.x*gy.y
          +textureLod(image,vec2(x.y,y.y)/size,level).rgb*gx.y*gy.y;
      }
      void main(){
        float area=clamp((abs(v.x-edge)-start)/(end-start)*wipe*2.5,0.,1.)/.75;
        float maxLevel=floor(log2(float(max(textureSize(image,0).x,textureSize(image,0).y))));
        float lod=min(area*8.,maxLevel);
        vec3 c=area<.001?textureLod(image,v,0.).rgb:mix(cubicMip(v,floor(lod)),cubicMip(v,min(ceil(lod),maxLevel)),fract(lod));
        float shade=(1.-smoothstep(.9,1.3,area))*(1.-smoothstep(.9,1.,abs(v.y-.5)*2.));
        gl_FragColor=vec4(c*shade,1.);
      }
    `
  });
  const scene=new THREE.Scene();scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
  const camera=new THREE.Camera();let last=-1;
  return {texture:b.texture,prepare:()=>renderer.compileAsync(scene,camera),update(p){
    if(Math.abs(p-last)<.0001)return;last=p;
    material.uniforms.wipe.value=isOuter?Math.min(p,1-p):1-p;
    const previous=renderer.getRenderTarget();
    material.uniforms.image.value=source;renderer.setRenderTarget(a);renderer.render(scene,camera);
    material.uniforms.image.value=a.texture;renderer.setRenderTarget(b);renderer.render(scene,camera);
    renderer.setRenderTarget(previous);
  }};
}
