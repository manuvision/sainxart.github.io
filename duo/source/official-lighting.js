import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import precomputedLighting from '../assets/lighting/linear-exr-manifest.json' with { type: 'json' };

const BASE = './assets/lighting/';

export function supportsPrecomputedLighting() {
  return typeof globalThis.DecompressionStream === 'function';
}

// Export the same source selection used by the loader so startup preloading can
// count exactly the files that will be consumed on this browser.
export function getLightingRadianceFiles() {
  return precomputedLighting.files.map(file => supportsPrecomputedLighting() ? file.file : file.sourceFile);
}

async function loadPrecomputedRadiance(definition, url, yieldToMain) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Studio lighting: HTTP ${response.status}`);
  const packed = await response.arrayBuffer();
  await yieldToMain();
  // Ordinarily these .gz assets are delivered as files. Also tolerate a server
  // which already decoded their gzip Content-Encoding before fetch sees them.
  const signature = new Uint8Array(packed, 0, Math.min(2, packed.byteLength));
  const decoded = signature[0] === 0x1f && signature[1] === 0x8b
    ? await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    : packed;
  if (decoded.byteLength !== definition.rawBytes) throw new Error('Studio lighting texture has an invalid byte length.');
  const texture = new THREE.DataTexture(new Uint16Array(decoded), definition.width, definition.height, THREE.RGBAFormat, THREE.HalfFloatType);
  // Match EXRLoader.load exactly. PMREM sees the same half-float radiance, with
  // no resampling, tone mapping, exposure changes, or extra precision loss.
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function applyRigState(root, state) {
  const materials = new Map();
  root.traverse(object => {
    if (object.material) for (const material of [].concat(object.material)) materials.set(material.name, material);
    const values = state[object.name];
    if (!values) return;
    for (const property of ['position', 'rotation', 'scale']) {
      for (const axis of ['x', 'y', 'z']) {
        const value = values[property + axis.toUpperCase()];
        if (typeof value === 'number') object[property][axis] = value;
      }
    }
  });
  for (const [name, material] of materials) {
    const values = state[name];
    if (!values) continue;
    for (const property of ['color', 'emissive']) {
      for (const channel of ['r', 'g', 'b']) {
        const value = values[property + channel.toUpperCase()];
        if (typeof value === 'number') material[property][channel] = value;
      }
    }
    for (const property of ['emissiveIntensity', 'metalness', 'opacity', 'roughness']) {
      if (typeof values[property] === 'number') material[property] = values[property];
    }
    material.needsUpdate = true;
  }
  root.updateMatrixWorld(true);
}

function disposeRig(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [].concat(object.material || [])) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

function applyMaterialChunks(material, definition, textures) {
  const chunks = definition?.chunks || {};
  if (chunks.AoMap) {
    material.aoMap = textures.get(chunks.AoMap.aoMap) || null;
    material.aoMapIntensity = chunks.AoMap.aoMapIntensity;
  }
  const materialProperties = new Set(['blending', 'blendSrc', 'blendDst', 'blendEquation', 'blendSrcAlpha', 'blendDstAlpha', 'blendEquationAlpha', 'premultipliedAlpha', 'opacity', 'transparent', 'toneMapped']);
  for (const chunkName of ['BlendMode', 'Transparency', 'ToneMap']) {
    for (const [property, value] of Object.entries(chunks[chunkName] || {})) {
      if (materialProperties.has(property)) material[property] = typeof material[property] === 'number' ? Number(value) : value;
    }
  }
  const exposure = chunks.Exposure?.enableExposure !== false ? (chunks.Exposure?.exposure || 0) : 0;
  const detail = chunks.DetailChunk;
  const detailTexture = detail?.DetailRoughMetalEnabled && textures.get(detail.DetailRoughMetalMap);
  if (detailTexture) {
    detailTexture.wrapS = detailTexture.wrapT = THREE.RepeatWrapping;
    detailTexture.needsUpdate = true;
  }
  // These are the exact shader operations used by Apple's Exposure and
  // DetailChunk modules, inserted at the same physical-material stages.
  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey.bind(material);
  const originalKey = previousCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer);
    shader.uniforms.officialExposure = { value: exposure };
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float officialExposure;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb *= exp2(officialExposure);\n#include <tonemapping_fragment>');
    if (detailTexture && Number(detail.DetailRoughBlendMode) === 3) {
      shader.uniforms.officialDetailMap = { value: detailTexture };
      shader.uniforms.officialDetailRepeat = { value: new THREE.Vector2(...detail.DetailRoughMetalRepeat) };
      shader.uniforms.officialDetailRoughness = { value: detail.DetailRoughnessIntensity };
      shader.uniforms.officialDetailMetalness = { value: detail.DetailMetalnessIntensity };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n#ifndef USE_UV1\nattribute vec2 uv1;\n#endif\nvarying vec2 vOfficialDetailUv;');
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvOfficialDetailUv = vec2(1.0 - uv1.x, uv1.y);');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vOfficialDetailUv;\nuniform sampler2D officialDetailMap;\nuniform vec2 officialDetailRepeat;\nuniform float officialDetailRoughness;\nuniform float officialDetailMetalness;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        vec4 officialDetail = texture2D(officialDetailMap, vOfficialDetailUv * officialDetailRepeat);
        roughnessFactor = clamp(mix(roughnessFactor, officialDetail.g, officialDetail.a * officialDetailRoughness), 0.0, 1.0);`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = clamp(mix(metalnessFactor, officialDetail.b, officialDetail.a * officialDetailMetalness), 0.0, 1.0);`);
    }
  };
  material.customProgramCacheKey = () => `${originalKey}|official-lighting-v2|${Boolean(detailTexture)}`;
  material.userData.officialExposure = exposure;
}

/**
 * Apple's public viewer uses three emissive-card environments plus two EXRs.
 * Use Apple's full studio EXR for free rotation. Editorial light cards illuminate
 * selected viewing angles and require the original camera choreography.
 * They remain available as an explicit option for fixed landing-state views.
 * The raw GLTF is Z-up; Apple's scene wrapper is Ry(PI) * Rx(PI/2).
 * Our phone wrapper is Rx(PI/2), so the authored light field turns by Ry(-PI).
 */
export async function loadOfficialLighting(renderer, {
  baseUrl = BASE,
  canonicalRotation = new THREE.Euler(Math.PI / 2, 0, 0),
  useEditorialRigs = false,
  assets = {},
  onPhase = () => {},
  yieldToMain = async () => {},
} = {}) {
  const assetUrl = path => assets.url ? assets.url(path) : path;
  onPhase('lighting-assets', { completed: 0 });
  await yieldToMain();
  const response = await fetch(assetUrl(baseUrl + 'lighting-config.json'));
  if (!response.ok) throw new Error(`Official lighting configuration: HTTP ${response.status}`);
  const config = await response.json();
  const gltfLoader = new GLTFLoader(assets.manager), textureLoader = new THREE.TextureLoader(assets.manager);
  const usePrecomputed = supportsPrecomputedLighting();
  const precomputedBySource = new Map(precomputedLighting.files.map(file => [file.sourceFile, file]));
  const loadRadiance = async () => {
    if (usePrecomputed) {
      return Promise.all(config.exrs.map(async source => {
        const definition = precomputedBySource.get(source.file);
        if (!definition) throw new Error(`Missing precomputed lighting: ${source.file}`);
        return loadPrecomputedRadiance(definition, assetUrl(baseUrl + definition.file), yieldToMain);
      }));
    }
    // Legacy fallback is only initialized where native gzip decoding is absent.
    const exrLoader = new EXRLoader(assets.manager);
    return Promise.all(config.exrs.map(exr => exrLoader.loadAsync(assetUrl(baseUrl + exr.file))));
  };
  const [rigs, exrs, materialTextures] = await Promise.all([
    Promise.all((useEditorialRigs ? config.rigs : []).map(rig => gltfLoader.loadAsync(baseUrl + rig.file))),
    loadRadiance(),
    Promise.all((config.textures || []).map(async definition => {
      const texture = await textureLoader.loadAsync(baseUrl + definition.file);
      texture.flipY = definition.properties?.flipY ?? false;
      texture.channel = definition.properties?.channel ?? 0;
      texture.colorSpace = THREE.NoColorSpace;
      texture.needsUpdate = true;
      return [definition.id, texture];
    })),
  ]);
  onPhase('lighting-decoded', { completed: exrs.length, total: config.exrs.length, precomputed: usePrecomputed });
  await yieldToMain();
  const textures = new Map(materialTextures);
  const authorRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, Math.PI, 0, 'YXZ'));
  const relativeRotation = new THREE.Quaternion().setFromEuler(canonicalRotation).multiply(authorRotation.invert());
  const rotate = values => new THREE.Euler().setFromQuaternion(relativeRotation.clone().multiply(
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...values))
  ));
  const layers = new Map(), targets = [];
  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    for (let i = 0; i < rigs.length; i++) {
      const root = rigs[i].scene;
      applyRigState(root, config.rigs[i].state);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0);
      scene.add(root);
      // Same capture planes as Apple's EnvironmentInterpolation renderer.
      const target = pmrem.fromScene(scene, 0, 3, 2000, { size: 256 });
      targets.push(target);
      layers.set(config.rigs[i].layer, { texture: target.texture, rotation: rotate([0, 0, 0]), intensity: 1 });
      disposeRig(root);
      await yieldToMain();
    }
    for (let i = 0; i < exrs.length; i++) {
      const texture = exrs[i], definition = config.exrs[i];
      onPhase('lighting-pmrem', { completed: i, total: exrs.length });
      await yieldToMain();
      // EXRLoader preserves floating-point radiance. This is linear data, not sRGB.
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.LinearSRGBColorSpace;
      texture.flipY = false;
      const target = pmrem.fromEquirectangular(texture);
      targets.push(target);
      layers.set(definition.layer, { texture: target.texture, rotation: rotate(definition.rotation), intensity: definition.intensity });
      texture.dispose();
      await yieldToMain();
    }
    onPhase('lighting-ready', { completed: exrs.length, total: exrs.length });
  } catch (error) {
    targets.forEach(target => target.dispose());
    rigs.forEach(gltf => disposeRig(gltf.scene));
    exrs.forEach(texture => texture.dispose());
    textures.forEach(texture => texture.dispose());
    throw error;
  } finally {
    pmrem.dispose();
  }
  return {
    environment: (layers.get(0) || layers.get(5)).texture,
    meta: {
      source: config.source,
      state: useEditorialRigs ? config.state : 'Free rotation studio',
      exactAssets: true,
      layers: [...layers.keys()],
      limitations: [useEditorialRigs
        ? 'Fixed PT_SliderLanding light state; Apple changes and crossfades its rigs with camera angle and folding state.'
        : 'Uses the original studio EXR and general materials for arbitrary rotation; does not reproduce Apple’s editorial camera-specific light transitions.'],
    },
    applyToModel(phone) {
      const visited = new Set();
      phone.traverse(object => {
        for (const material of [].concat(object.material || [])) {
          if (visited.has(material) || material.isShaderMaterial) continue;
          visited.add(material);
          const definitions = useEditorialRigs ? config.editorialMaterials : config.materials;
          const definition = definitions[material.name];
          const effectiveLayer = useEditorialRigs ? (definition?.layer ?? 0) : (definition?.layer === 4 ? 4 : 5);
          const layer = layers.get(effectiveLayer) || layers.get(5);
          material.envMap = layer.texture;
          material.envMapIntensity = layer.intensity;
          if (material.envMapRotation) material.envMapRotation.copy(layer.rotation);
          if (!material.userData.officialChunksApplied) {
            applyMaterialChunks(material, definition, textures);
            material.userData.officialChunksApplied = true;
          }
          material.userData.officialEnvironmentLayer = definition?.layer ?? 0;
          material.userData.appliedEnvironmentLayer = effectiveLayer;
          material.needsUpdate = true;
        }
      });
      return { materials: visited.size, layers: [...layers.keys()] };
    },
    dispose() {
      targets.forEach(target => target.dispose());
      textures.forEach(texture => texture.dispose());
    },
  };
}
