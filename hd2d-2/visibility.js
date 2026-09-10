import * as T from 'three';
// Only solid scenery writes this depth buffer. Herbs and the sprite never reveal
// themselves through their own overlapping polygons or through each other.
export function createVisibility(renderer,scene,camera){
 const target=new T.WebGLRenderTarget(1,1,{depthTexture:new T.DepthTexture(1,1)});
 const size=new T.Vector2(1,1),depthOnly=new T.MeshBasicMaterial({colorWrite:false,side:T.DoubleSide});
 function material(color,opacity,alpha=false){const m=new T.MeshBasicMaterial({color,opacity,transparent:true,depthTest:false,depthWrite:false,side:T.DoubleSide,fog:false,toneMapped:false,...(alpha?{alphaTest:.5}:{})});
 m.onBeforeCompile=s=>{s.uniforms.sceneryDepth={value:target.depthTexture};s.uniforms.visibilitySize={value:size};s.fragmentShader='uniform sampler2D sceneryDepth;uniform vec2 visibilitySize;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(gl_FragCoord.z <= texture2D(sceneryDepth,gl_FragCoord.xy/visibilitySize).x + .000005) discard;');if(alpha)s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#ifdef USE_MAP\n diffuseColor.a *= texture2D(map,vMapUv).a;\n#endif');};return m;}
 function resize(w,h){size.set(w,h);target.setSize(w,h);}
 function render(){const mask=camera.layers.mask,override=scene.overrideMaterial,shadows=renderer.shadowMap.autoUpdate;camera.layers.set(1);scene.overrideMaterial=depthOnly;renderer.shadowMap.autoUpdate=false;renderer.setRenderTarget(target);renderer.render(scene,camera);camera.layers.mask=mask;scene.overrideMaterial=override;renderer.shadowMap.autoUpdate=shadows;}
 return {material,resize,render};
}
