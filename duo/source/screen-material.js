import * as THREE from 'three';

// The two displays act as windows onto one shared image plane while folding.
// Reprojecting a view ray produces the changing trapezoid and black wedges;
// defocus is applied to the source image before this projection, in screen-blur.js.
export function createScreenMaterial(texture, outer) {
  const material=new THREE.ShaderMaterial({
    toneMapped:false,
    uniforms:{
      screen:{value:texture},progress:{value:.6},
      outer:{value:outer?1:0},phoneInverse:{value:new THREE.Matrix4()}
    },
    vertexShader:`
      varying vec2 texUv;
      varying vec3 surfaceWorld;
      void main(){
        texUv=uv;
        vec4 world=modelMatrix*vec4(position,1.0);
        surfaceWorld=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }
    `,
    fragmentShader:`
      uniform sampler2D screen;
      uniform float progress;
      uniform float outer;
      uniform mat4 phoneInverse;
      varying vec2 texUv;
      varying vec3 surfaceWorld;
      void main(){
        vec3 surface=(phoneInverse*vec4(surfaceWorld,1.)).xyz;
        vec3 eye=(phoneInverse*vec4(cameraPosition,1.)).xyz;
        vec3 ray=surface-eye;
        float safeZ=abs(ray.z)<.01?.01:ray.z;
        float t=-eye.z/safeZ;
        vec3 hit=eye+ray*t;
        vec2 projected=vec2((hit.x+8.05)/16.10,(hit.y+5.69)/11.38);
        if(outer>.5)projected=vec2((hit.x-4.115)/7.81+.5,hit.y/11.32+.5);
        // The shared projection exists only during the handoff. At both endpoints
        // the cover display owns its full lock screen, even when viewed from behind.
        float through=outer>.5?1.-smoothstep(.45,1.,1.-min(progress,1.-progress)):(1.-smoothstep(.60,.99,progress));
        vec2 directUv=(texUv-.5)/1.12+.5;
        vec2 projectedUv=(projected-.5)/1.12+.5;
        // Interpolate the lookup, not two rendered images, so the clock never doubles.
        vec2 imageUv=mix(directUv,projectedUv,through);
        float inside=smoothstep(-.006,.003,imageUv.x)*(1.-smoothstep(.997,1.006,imageUv.x));
        inside*=smoothstep(-.006,.003,imageUv.y)*(1.-smoothstep(.997,1.006,imageUv.y));
        vec3 color=texture2D(screen,imageUv).rgb*inside;
        // The inner image retreats into a broad pocket of darkness on the left.
        // Use the projected image coordinates so the falloff belongs to the
        // shared image behind the glass, rather than drawing a stripe on the hinge.
        float cavity=smoothstep(0.,.55,1.-progress);
        float depthFalloff=1.-smoothstep(.05,.5,imageUv.x);
        float innerShadow=1.-cavity*depthFalloff;
        if(outer<.5)color*=innerShadow;
        float wipe=outer>.5?min(progress,1.-progress):1.-progress;
        float distanceToEdge=outer>.5?texUv.x:1.-texUv.x;
        float light=1.-clamp(smoothstep(outer>.5?0.:.5,1.,distanceToEdge)*wipe*1.5,0.,1.);
        if(outer<.5)light*=.25+.75*smoothstep(.10,.90,progress);
        gl_FragColor=vec4(color*light,1.);
        #include <colorspace_fragment>
      }
    `
  });
  return material;
}
