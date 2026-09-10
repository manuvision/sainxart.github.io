import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Apple's published viewer mesh is authored in centimetres: X is width,
// Z is height and Y is depth. No geometry scale or invented hinge is needed.
export const OFFICIAL_MODEL_URL = './assets/model/iphone-duo.gltf';
export const OFFICIAL_SCREEN_NAMES = Object.freeze({
  inner: 'skeleton_0_3_screenTexture_geo',
  outer: 'skeleton_0_7_outerDisplayScreenTexture_geo',
});

function meshBoundsInRoot(mesh, root, target = new THREE.Box3()) {
  target.makeEmpty();
  const local = new THREE.Vector3();
  const transform = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
  const count = mesh.geometry.attributes.position.count;
  for (let i = 0; i < count; i++) {
    mesh.getVertexPosition(i, local).applyMatrix4(transform);
    target.expandByPoint(local);
  }
  return target;
}

// Separate preparation from loading so the real rig can be checked without
// WebGL or image decoding. All screen materials are returned unchanged.
export function prepareOfficialModel(gltf, renderer) {
  const assetRoot = gltf.scene;
  const inner = assetRoot.getObjectByName(OFFICIAL_SCREEN_NAMES.inner);
  const outer = assetRoot.getObjectByName(OFFICIAL_SCREEN_NAMES.outer);
  const clip = THREE.AnimationClip.findByName(gltf.animations, 'Slider');
  if (!inner?.isSkinnedMesh || !outer?.isSkinnedMesh || !clip) {
    throw new Error('The official phone model is missing its display meshes or folding animation.');
  }

  const phone = new THREE.Group();
  phone.name = 'iPhone Duo — official geometry';
  const orientation = new THREE.Group();
  orientation.name = 'Official centimetres to display coordinates';
  orientation.rotation.x = Math.PI / 2;
  orientation.add(assetRoot);
  phone.add(orientation);

  const mixer = new THREE.AnimationMixer(assetRoot);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  action.paused = true;
  const skeletons = new Set();
  const skinnedMeshes = [];
  const boneBounds = new Map();
  const staticBounds = [];
  const materials = new Map();
  const textures = new Set();
  const bindPoint = new THREE.Vector3(), bonePoint = new THREE.Vector3();
  const boundsScratch = new THREE.Box3(), raycastWorldBounds = new THREE.Box3();
  const inverseMeshWorld = new THREE.Matrix4();
  const anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 1);
  assetRoot.traverse(object => {
    if (!object.isMesh) return;
    // Animated skin bounds are not the static bind-pose bounds.
    if (object.isSkinnedMesh) {
      object.frustumCulled = false;
      skinnedMeshes.push(object);
      skeletons.add(object.skeleton);
      const { position, skinIndex, skinWeight } = object.geometry.attributes;
      // A blended skin vertex is inside the union's convex hull. Enclosing
      // every contributing bone's local vertex box therefore conservatively
      // bounds the complete animated mesh using only 27 boxes per frame.
      for (let i = 0; i < position.count; i++) {
        bindPoint.fromBufferAttribute(position, i).applyMatrix4(object.bindMatrix);
        for (let lane = 0; lane < 4; lane++) {
          if (skinWeight.getComponent(i, lane) <= 0) continue;
          const joint = skinIndex.getComponent(i, lane);
          const bone = object.skeleton.bones[joint];
          let box = boneBounds.get(bone);
          if (!box) boneBounds.set(bone, box = new THREE.Box3());
          bonePoint.copy(bindPoint).applyMatrix4(object.skeleton.boneInverses[joint]);
          box.expandByPoint(bonePoint);
        }
      }
    } else {
      object.geometry.computeBoundingBox();
      staticBounds.push({ object, box: object.geometry.boundingBox.clone() });
    }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.set(material.name, material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) {
          textures.add(value);
          value.anisotropy = anisotropy;
        }
      }
    }
  });

  let progress = 1;
  function updateProjection() {
    phone.updateWorldMatrix(true, false);
    // SkinnedMesh.updateMatrixWorld also updates bindMatrixInverse. The
    // Object3D.updateWorldMatrix recursion alone skips that override.
    phone.updateMatrixWorld(true);
    for (const skeleton of skeletons) skeleton.update();
  }
  function setFold(p) {
    progress = THREE.MathUtils.clamp(p, 0, 1);
    // Verified from the actual skinned geometry: time 0 closed, time 2 flat.
    action.time = progress * clip.duration;
    mixer.update(0);
    updateProjection();
    refreshRaycastBounds();
  }

  setFold(1);
  const initialInnerBounds = meshBoundsInRoot(inner, phone);
  // Place the genuine flat inner surface at canonical Z=0.
  orientation.position.z = -(initialInnerBounds.min.z + initialInnerBounds.max.z) / 2;
  updateProjection();
  const innerBounds = meshBoundsInRoot(inner, phone);
  const openBounds = new THREE.Box3().setFromObject(phone, true);
  setFold(0);
  const outerBounds = meshBoundsInRoot(outer, phone);
  const closedBounds = new THREE.Box3().setFromObject(phone, true);
  const dimensions = {
    units: 'cm',
    innerSize: innerBounds.getSize(new THREE.Vector3()),
    outerSize: outerBounds.getSize(new THREE.Vector3()),
    outerCenter: outerBounds.getCenter(new THREE.Vector3()),
    innerBounds,
    outerBounds,
    openBounds,
    closedBounds,
    openSize: openBounds.getSize(new THREE.Vector3()),
    closedSize: closedBounds.getSize(new THREE.Vector3()),
  };

  function getScreenBounds(target = new THREE.Box3()) {
    updateProjection();
    return meshBoundsInRoot(inner, phone, target).union(meshBoundsInRoot(outer, phone));
  }
  function getBounds(target = new THREE.Box3()) {
    updateProjection();
    target.makeEmpty();
    for (const [bone, box] of boneBounds) {
      target.union(boundsScratch.copy(box).applyMatrix4(bone.matrixWorld));
    }
    for (const { object, box } of staticBounds) {
      target.union(boundsScratch.copy(box).applyMatrix4(object.matrixWorld));
    }
    return target;
  }
  function refreshRaycastBounds() {
    // Three caches SkinnedMesh raycast bounds. Refresh their broad phase from
    // the fast whole-rig envelope whenever the hinge changes; exact triangle
    // intersections still use the actual skinned vertices.
    getBounds(raycastWorldBounds);
    for (const mesh of skinnedMeshes) {
      inverseMeshWorld.copy(mesh.matrixWorld).invert();
      mesh.boundingBox ??= new THREE.Box3();
      mesh.boundingSphere ??= new THREE.Sphere();
      mesh.boundingBox.copy(raycastWorldBounds).applyMatrix4(inverseMeshWorld);
      mesh.boundingBox.getBoundingSphere(mesh.boundingSphere);
    }
  }

  const originalScreenMaterials = { inner: inner.material, outer: outer.material };
  setFold(.65);
  return {
    phone,
    scene: phone,
    gltfScene: assetRoot,
    orientation,
    // Inverting this group preserves the canonical centimetre transform in
    // surfaceWorld. Orbit/recentering should be outside or on this group.
    projectionRoot: phone,
    screenMeshes: { inner, outer },
    screenMeshList: [inner, outer],
    originalScreenMaterials,
    materials,
    textures,
    dimensions,
    screenDimensions: {
      inner: [dimensions.innerSize.x, dimensions.innerSize.y],
      outer: [dimensions.outerSize.x, dimensions.outerSize.y],
      outerCenter: [dimensions.outerCenter.x, dimensions.outerCenter.y],
    },
    // Both native UVs have V=0 at the top after canonical orientation.
    screenUV: { inner: { flipY: true }, outer: { flipY: true } },
    mixer,
    clip,
    action,
    setFold,
    updateProjection,
    getScreenBounds,
    getBounds,
    get progress() { return progress; },
  };
}

export async function loadOfficialModel(renderer) {
  const gltf = await new GLTFLoader().loadAsync(OFFICIAL_MODEL_URL);
  return prepareOfficialModel(gltf, renderer);
}
