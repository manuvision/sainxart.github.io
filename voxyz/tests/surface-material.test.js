import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { attachWaterCaustics, createTerrainMaterial } from '../surface-material.js';
import { Ecosystem } from '../ecosystem.js';

function lighting() {
  return {
    time:{value:0},day:{value:1},
    wetColumns:{texture:new THREE.DataTexture(new Float32Array(16*16*4),16,16,THREE.RGBAFormat,THREE.FloatType),origin:new THREE.Vector2(-8,-8),size:16},
  };
}
function compile(material,kind='standard') {
  const shader={uniforms:{},vertexShader:THREE.ShaderLib[kind].vertexShader,fragmentShader:THREE.ShaderLib[kind].fragmentShader};
  material.onBeforeCompile(shader);
  return shader;
}

test('terrain, foliage and fish share one caustic phase and live water-column resources',()=>{
  const waterLighting=lighting(),terrain=createTerrainMaterial(waterLighting);
  const eco=new Ecosystem(new THREE.Scene(),{seed:'caustic-test'},{waterLighting});
  try {
    const shaders=[compile(terrain),compile(eco.floraMaterial),compile(eco.entityMeshes.fish.material,'lambert')];
    const pattern=shader=>shader.fragmentShader.match(/vec2 p=worldPoint\.xz\*2\.15;[\s\S]*?float edge=/)[0];
    for(const shader of shaders) {
      assert.equal(pattern(shader),pattern(shaders[0]),'every surface uses the same world coordinates and moving line function');
      assert.equal(shader.uniforms.uWaterTime,waterLighting.time);
      assert.equal(shader.uniforms.uWaterDay,waterLighting.day);
      assert.equal(shader.uniforms.uWaterColumns.value,waterLighting.wetColumns.texture);
      assert.equal(shader.uniforms.uWaterOrigin.value,waterLighting.wetColumns.origin);
      assert.equal((shader.fragmentShader.match(/vec2 waterCausticLight\(/g)||[]).length,1);
    }
    waterLighting.time.value=28;
    waterLighting.wetColumns.origin.set(8,16);
    for(const shader of shaders) {
      assert.equal(shader.uniforms.uWaterTime.value,28,'animated light advances without rebuilding a material');
      assert.deepEqual(shader.uniforms.uWaterOrigin.value.toArray(),[8,16],'streaming changes are visible to every receiver');
    }
  } finally { terrain.dispose();eco.dispose();waterLighting.wetColumns.texture.dispose(); }
});

test('caustic receiver contract excludes night, dry space, sealed columns and disconnected deeper pools',()=>{
  const waterLighting=lighting(),material=attachWaterCaustics(new THREE.MeshLambertMaterial(),waterLighting);
  try {
    const source=compile(material,'lambert').fragmentShader;
    const sample=source.indexOf('texture2D(uWaterColumns,wetUV)'),pattern=source.indexOf('vec2 p=worldPoint.xz');
    assert.ok(source.indexOf('if(daylight<=0.0)return vec2(wetness,0.0)')<pattern,'night preserves wet surfaces while skipping caustic pattern work');
    assert.match(source,/smoothstep\(\.12,\.70,uWaterDay\)/,'the game’s .07 night level has no emissive caustics');
    assert.ok(source.indexOf('any(lessThanEqual(wetUV')<sample,'outside columns cannot repeat edge water');
    for(const gate of ['wet.b<.5','wetDepth<=0.0','wetDepth>=7.0','wetPoint.y<wet.g']) {
      assert.ok(source.indexOf(gate)>sample&&source.indexOf(gate)<pattern,`${gate} rejects ineligible fragments before moving pattern work`);
    }
    assert.match(source,/smoothstep\(0\.0,\.08,wetDepth\)/,'caustics fade across the waterline rather than lighting dry tips');
    assert.match(source,/totalEmissiveRadiance\+=vec3\(\.24,\.40,\.36\)\*waterLight.y/,'only the narrow caustic lines add pale aqua light');
  } finally { material.dispose();waterLighting.wetColumns.texture.dispose(); }
});

test('caustic wrapping preserves rooted bending, alpha coverage and animal flight callbacks',()=>{
  const waterLighting=lighting(),eco=new Ecosystem(new THREE.Scene(),{seed:'caustic-test'},{waterLighting});
  try {
    const flora=compile(eco.floraMaterial),fish=compile(eco.entityMeshes.fish.material,'lambert'),bird=compile(eco.entityMeshes.bird.material,'lambert');
    assert.equal(flora.uniforms.ecoBendBody,eco.bendBody);
    assert.equal(flora.uniforms.ecoBendTrail,eco.bendTrail);
    assert.match(flora.vertexShader,/if \(ecoBend.x > \.5/);
    for(const shader of [flora,fish]) {
      assert.match(shader.fragmentShader,/diffuseColor\.a \*= vEcoCoverage/);
      assert.match(shader.fragmentShader,/getAlphaHashThreshold\(vPosition\)/);
      assert.match(shader.vertexShader,/waterWorldPosition=instanceMatrix\*waterWorldPosition/,'caustics follow the complete instance transform');
      assert.match(shader.vertexShader,/waterWorldPosition=vec4\(transformed,1\.0\)/,'caustics sample the final swayed/bent position');
      assert.match(shader.vertexShader,/inverseTransformDirection\(transformedNormal,viewMatrix\)/,'nonuniformly scaled blade normals stay correct');
    }
    assert.equal(bird.uniforms.ecoFlight,eco.flyTime);
    assert.match(bird.vertexShader,/transformed.y \+= flutter/);
    assert.equal(bird.uniforms.uWaterColumns,undefined,'flying animals pay no caustic sampling cost');
  } finally { eco.dispose();waterLighting.wetColumns.texture.dispose(); }
});
