import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { Ecosystem, grassSpring } from '../ecosystem.js';
import { Terrain } from '../terrain.js';

function makeWorld() {
  const edits = new Map();
  const tree = { x: 4, z: 4, y: 16, h: 8, conifer: false, biome: 'meadow' };
  const terrain = {
    tree: (x, z) => x === 0 && z === 0 ? tree : null,
    treeBlock: (t, x, y, z) => {
      if (x === t.x && z === t.z && y >= t.y && y < t.y + t.h) return 5;
      return Math.abs(x - t.x) <= 2 && Math.abs(z - t.z) <= 2 && y >= 20 && y <= 24 ? 6 : 0;
    },
  };
  const world = {
    seed: 'spatial-stability', terrain, edits,
    heightAt: (x, z) => x >= 10 && x <= 34 && z >= -16 && z <= 16 ? 10 : 15,
    biomeAt: () => 'meadow',
    getBlock(x, y, z) {
      const key = `${x},${y},${z}`;
      if (edits.has(key)) return edits.get(key);
      const h = this.heightAt(x, z);
      if (y <= h) return h < 12 ? 4 : 1;
      if (h < 12 && y <= 12) return 7;
      return terrain.treeBlock(tree, x, y, z);
    },
  };
  return world;
}

function captureBuild(eco, position) {
  const cells = new Map();
  const generateCell = eco._cell;
  eco._cell = function(x, z) {
    const begin = this.pending.count;
    generateCell.call(this, x, z);
    const end = this.pending.count;
    const mesh = this.pending.mesh;
    cells.set(`${x}:${z}`, {
      matrix: mesh.instanceMatrix.array.slice(begin * 16, end * 16),
      color: mesh.instanceColor.array.slice(begin * 3, end * 3),
      sway: mesh.geometry.getAttribute('ecoSway').array.slice(begin, end),
      range: mesh.geometry.getAttribute('ecoRange').array.slice(begin, end),
    });
  };
  eco._beginRebuild(position);
  for (let frame = 0; eco.pending && frame < 200; frame++) eco._advanceRebuild();
  eco._cell = generateCell;
  assert.equal(eco.pending, null, 'staged build should finish');
  return cells;
}

function boxes(capture) {
  const result = [];
  for (let i = 0; i < capture.matrix.length / 16; i++) {
    const matrix = Array.from(capture.matrix.slice(i * 16, i * 16 + 16));
    result.push({ x: matrix[12], y: matrix[13], z: matrix[14], key: JSON.stringify([...matrix, ...capture.color.slice(i * 3, i * 3 + 3), capture.sway[i], capture.range?.[i]]) });
  }
  return result;
}

test('visible scenery retains exact geometry, colors, wind and distance tiers across a rebuild boundary', () => {
  const eco = new Ecosystem(new THREE.Scene(), makeWorld());
  try {
    const first = captureBuild(eco, new THREE.Vector3(0, 17, 0));
    const moved = captureBuild(eco, new THREE.Vector3(17, 17, 0));
    const destination = new Set([...moved.values()].flatMap(capture => boxes(capture).map(box => box.key)));
    const shared = [...first.values()].flatMap(boxes).filter(box => Math.hypot(box.x, box.z) < 20 && Math.hypot(box.x - 17, box.z) < 20);
    assert.ok(shared.length > 1000);
    for (const box of shared) assert.ok(destination.has(box.key), 'visible detail moved or changed its distance tier when the viewer moved');
    assert.ok(boxes(first.get('1:0')).some(box => box.y > 12.86 && box.y < 13.1), 'the comparison includes lily pads');
    assert.ok(boxes(first.get('0:0')).some(box => box.y > 20), 'the comparison includes canopy detail');
    const returned = captureBuild(eco, new THREE.Vector3(0, 17, 0));
    assert.deepEqual(returned, first, 'returning to a clearing must restore the identical plants');
  } finally { eco.dispose(); }
});

test('removing one ground block does not reroll the rest of its scenery cell', () => {
  const world = makeWorld();
  const eco = new Ecosystem(new THREE.Scene(), world);
  try {
    const position = new THREE.Vector3(0, 17, 0);
    const before = captureBuild(eco, position);
    world.edits.set('-4,15,-3', 0);
    eco.invalidate();
    const after = captureBuild(eco, position);
    const remaining = new Set(boxes(after.get('-1:-1')).map(box => box.key));
    const distant = boxes(before.get('-1:-1')).filter(box => Math.hypot(box.x + 3.5, box.z + 2.5) > 2);
    assert.ok(distant.length > 100);
    for (const box of distant) assert.ok(remaining.has(box.key), 'an unrelated plant moved after an edit');
    for (const [key, capture] of before) if (key !== '-1:-1') assert.deepEqual(after.get(key), capture);
  } finally { eco.dispose(); }
});

test('removing a leaf keeps the other independently seeded canopy clusters in place', () => {
  const world = makeWorld();
  const eco = new Ecosystem(new THREE.Scene(), world);
  const captureCanopy = () => {
    eco._beginRebuild(new THREE.Vector3(4, 17, 4));
    eco.pending.limit = eco.capacity;
    eco._canopy(world.terrain.tree(0, 0));
    const { mesh, count } = eco.pending;
    return boxes({ matrix: mesh.instanceMatrix.array.slice(0, count * 16), color: mesh.instanceColor.array.slice(0, count * 3), sway: mesh.geometry.getAttribute('ecoSway').array.slice(0, count) });
  };
  try {
    const before = captureCanopy();
    world.edits.set('6,22,4', 0);
    const after = new Set(captureCanopy().map(box => box.key));
    const unaffected = before.filter(box => Math.hypot(box.x - 6.5, box.y - 22.5, box.z - 4.5) > 2.1);
    assert.ok(unaffected.length > 100);
    for (const box of unaffected) assert.ok(after.has(box.key), 'another canopy cluster was rerolled');
  } finally { eco.dispose(); }
});

test('creatures keep their identities and motion state through traversal and scenery invalidation', () => {
  const eco = new Ecosystem(new THREE.Scene(), makeWorld());
  try {
    const position = new THREE.Vector3(12, 17, 0);
    captureBuild(eco, position);
    eco._updateAnimals(100, 1 / 60);
    const original = Object.fromEntries(Object.entries(eco.animals).map(([kind, list]) => [kind, list.map(animal => ({ animal, id: animal.id, phase: animal.phase, position: animal.current.clone() }))]));
    for (const kind of ['fish', 'bee', 'bird', 'sheep']) assert.ok(original[kind].length > 0);
    captureBuild(eco, new THREE.Vector3(27, 17, 0));
    eco._updateAnimals(100, 0);
    eco.invalidate();
    captureBuild(eco, new THREE.Vector3(27, 17, 0));
    eco._updateAnimals(100, 0);
    for (const [kind, animals] of Object.entries(original)) {
      for (const previous of animals) {
        const retained = eco.animals[kind].find(animal => animal.id === previous.id);
        assert.equal(retained, previous.animal, `${kind} respawned on a scenery rebuild`);
        assert.equal(retained.phase, previous.phase);
        assert.deepEqual(retained.current, previous.position);
      }
    }
  } finally { eco.dispose(); }
});

test('fish pause at an obstructed route instead of snapping to their habitat origin', () => {
  const world = makeWorld();
  const eco = new Ecosystem(new THREE.Scene(), world);
  try {
    captureBuild(eco, new THREE.Vector3(12, 17, 0));
    eco._updateAnimals(100, 1 / 60);
    const fish = eco.animals.fish[0];
    const before = fish.current.clone();
    const original = world.getBlock.bind(world);
    world.getBlock = (x, y, z) => y >= 11 && y <= 12 ? 1 : original(x, y, z);
    eco._updateAnimals(101, 1 / 60);
    assert.deepEqual(fish.current, before);
  } finally { eco.dispose(); }
});

test('desktop and mobile detail stay bounded and jumping does not lift the particle layer', () => {
  for (const mobile of [false, true]) {
    const scene = new THREE.Scene();
    const eco = new Ecosystem(scene, makeWorld(), { mobile });
    try {
      captureBuild(eco, new THREE.Vector3(0, 17, 0));
      const count = eco.flora[eco.activeFlora].count;
      assert.ok(count > 1000 && count <= eco.capacity);
      eco.update(0, 25, new THREE.Vector3(0, 17, 0), .2);
      const before = eco.particles.geometry.getAttribute('position').array.slice();
      eco.update(0, 25, new THREE.Vector3(0, 19, 0), .2);
      assert.deepEqual(eco.particles.geometry.getAttribute('position').array, before);
      assert.equal(scene.children.length, 1);
    } finally { eco.dispose(); }
    assert.equal(scene.children.length, 0);
  }
});

test('fireflies spawn and recycle at floating height, fading alpha instead of climbing from the ground', () => {
  let height = 15;
  const world = { ...makeWorld(), heightAt: () => height };
  const eco = new Ecosystem(new THREE.Scene(), world);
  const viewer = new THREE.Vector3(0, 100, 0);
  try {
    eco._updateParticles(10, viewer, 0);
    const positions = eco.particles.geometry.getAttribute('position');
    const opacity = eco.particles.geometry.getAttribute('particleOpacity');
    const initialY = Array.from({ length: positions.count }, (_, i) => positions.getY(i));
    const anchors = eco.particleGround.map(particle => particle.y);
    const size = eco.particleMaterial.size;
    assert.ok(initialY.every(y => y > 16.2 && y < 20.8), 'first positions are already above the landscape');
    assert.ok([...opacity.array].every(value => value === 0), 'new particles start transparent');
    assert.equal(eco.fireflyLight.intensity, 0, 'invisible particles do not emit a premature point light');

    height = 45;
    eco._updateParticles(10.3, viewer, 0);
    assert.deepEqual(eco.particleGround.map(particle => particle.y), anchors, 'terrain changes do not pull an existing firefly upward');
    assert.ok(initialY.every((y, i) => Math.abs(positions.getY(i) - y) < .04), 'only gentle hover motion changes the height');
    assert.ok([...opacity.array].some(value => value > .03 && value < .4), 'appearance progresses through partial opacity');
    assert.equal(eco.particleMaterial.size, size, 'fade-in does not scale up the point sprite');

    viewer.x = 36;
    eco._updateParticles(10.3, viewer, 0);
    const recycledY = Array.from({ length: positions.count }, (_, i) => positions.getY(i));
    assert.ok([...opacity.array].every(value => value === 0), 'wrapped particles are invisible at their new locations');
    recycledY.forEach((y, i) => assert.ok(Math.abs(y - initialY[i] - 30) < .04, 'a new hillside sets the complete floating height immediately'));
    eco._updateParticles(10.6, viewer, 0);
    assert.ok(recycledY.every((y, i) => Math.abs(positions.getY(i) - y) < .04), 'a recycled firefly never travels vertically from its old patch');
    assert.ok([...opacity.array].some(value => value > .03), 'recycled particles softly become visible');
    assert.equal(eco.particleMaterial.size, size);

    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.points.vertexShader, fragmentShader: THREE.ShaderLib.points.fragmentShader };
    eco.particleMaterial.onBeforeCompile(shader);
    assert.match(shader.vertexShader, /vParticleOpacity = particleOpacity/);
    assert.match(shader.fragmentShader, /diffuseColor\.a \*= vParticleOpacity/);
  } finally { eco.dispose(); }
});

test('particles fade out before recycling at the viewing boundary without moving with the camera', () => {
  const world = { ...makeWorld(), heightAt: () => 15 };
  const eco = new Ecosystem(new THREE.Scene(), world);
  const viewer = new THREE.Vector3(0, 100, 0);
  try {
    eco._updateParticles(0, viewer, 1);
    eco._updateParticles(2, viewer, 1);
    const positions = eco.particles.geometry.getAttribute('position');
    const opacity = eco.particles.geometry.getAttribute('particleOpacity');
    const candidate = Array.from({ length: positions.count }, (_, i) => i).find(i => positions.getX(i) > 10 && positions.getX(i) < 12 && Math.abs(positions.getZ(i)) < 10);
    assert.notEqual(candidate, undefined, 'the seeded sample includes a particle near the fade band');
    const x = positions.getX(candidate), y = positions.getY(candidate), z = positions.getZ(candidate);
    assert.equal(opacity.getX(candidate), 1);
    viewer.x = -3;
    eco._updateParticles(2, viewer, 1);
    assert.ok(opacity.getX(candidate) > 0 && opacity.getX(candidate) < 1, 'moving away fades an existing particle');
    assert.deepEqual([positions.getX(candidate), positions.getY(candidate), positions.getZ(candidate)], [x, y, z]);
    viewer.x = -6;
    eco._updateParticles(2, viewer, 1);
    assert.equal(opacity.getX(candidate), 0, 'the particle vanishes before its 18-block wrapping edge');
    assert.deepEqual([positions.getX(candidate), positions.getY(candidate), positions.getZ(candidate)], [x, y, z]);
  } finally { eco.dispose(); }
});

test('range tiers have an invisible generation buffer and crossing a cell starts a staged refresh', () => {
  for (const mobile of [false, true]) {
    const eco = new Ecosystem(new THREE.Scene(), makeWorld(), { mobile });
    try {
      captureBuild(eco, new THREE.Vector3(15.9, 17, 0));
      eco.update(0, 20, new THREE.Vector3(16.1, 17, 0), 1);
      assert.ok(eco.pending, 'a crossed cell should begin refreshing immediately');
      const oldCellEdge = (eco.cellRadius + 1) * eco.cellSize;
      assert.ok(oldCellEdge - 16.1 > eco.detailRadius + 5, 'the old batch must still cover the complete invisible fade edge');
      const frames = Math.ceil((eco.cellRadius * 2 + 1) ** 2 / eco.buildCellsPerFrame);
      assert.ok(eco.detailBuffer > 3 + 6.5 * frames / 60, 'the buffer covers sprint travel through the staged rebuild at the target frame rate');
      const ranges = eco.flora[eco.activeFlora].geometry.getAttribute('ecoRange').array;
      for (let i = 0; i < eco.flora[eco.activeFlora].count; i++) assert.ok(ranges[i] === eco.detailRadius || ranges[i] === eco.nearDetailRadius);
    } finally { eco.dispose(); }
  }
});

test('the seeded opening retains foreground richness within the existing instance budgets', t => {
  const terrain = new Terrain('voxyz');
  const world = { seed: terrain.seed, terrain, heightAt: (x, z) => terrain.heightAt(x, z), biomeAt: (x, z) => terrain.biomeAt(x, z), getBlock: (x, y, z) => terrain.sampleBlock(x, y, z) };
  for (const mobile of [false, true]) {
    const eco = new Ecosystem(new THREE.Scene(), world, { mobile });
    try {
      captureBuild(eco, new THREE.Vector3(12, 17, 22));
      const mesh = eco.flora[eco.activeFlora];
      let near = 0, ground = 0;
      for (let i = 0; i < mesh.count; i++) {
        const x = mesh.instanceMatrix.array[i * 16 + 12], y = mesh.instanceMatrix.array[i * 16 + 13], z = mesh.instanceMatrix.array[i * 16 + 14];
        if (Math.hypot(x - 12, z - 22) >= 12) continue;
        near++;
        if (y < world.heightAt(Math.floor(x), Math.floor(z)) + 3) ground++;
      }
      // Soil-only roots leave the sandy shore bare while preserving the dense
      // foreground: 2,391 desktop / 1,086 mobile ground details within 12 m.
      assert.ok(near >= (mobile ? 1700 : 4000), 'buffering must not thin out the foreground');
      assert.ok(ground >= (mobile ? 1050 : 2300), 'retain rich soil-rooted grass, reeds and flowers');
      assert.ok(mesh.count <= eco.capacity);
      t.diagnostic(JSON.stringify({ mobile, total: mesh.count, within12m: near, nearGround: ground }));
    } finally { eco.dispose(); }
  }
});

test('dense jungle keeps every shared visible sample across three- and six-meter moves', t => {
  for (const seed of ['voxyz', 'moss-71304']) {
    const terrain = new Terrain(seed);
    const world = { seed: terrain.seed, terrain, heightAt: (x, z) => terrain.heightAt(x, z), biomeAt: (x, z) => terrain.biomeAt(x, z), getBlock: (x, y, z) => terrain.sampleBlock(x, y, z) };
    const eco = new Ecosystem(new THREE.Scene(), world);
    try {
      assert.equal(world.biomeAt(-140, 130), 'jungle');
      const before = captureBuild(eco, new THREE.Vector3(-140, 30, 130));
      const original = [...before.values()].flatMap(boxes);
      for (const movedBy of [3, 6]) {
        const after = captureBuild(eco, new THREE.Vector3(-140 + movedBy, 30, 130));
        const present = new Set([...after.values()].flatMap(boxes).map(box => box.key));
        const visible = original.filter(box => {
          const range = JSON.parse(box.key).at(-1);
          return Math.hypot(box.x + 140, box.z - 130) < range - 2 && Math.hypot(box.x + 140 - movedBy, box.z - 130) < range - 2;
        });
        const missing = visible.filter(box => !present.has(box.key));
        t.diagnostic(JSON.stringify({ seed, movedBy, visible: visible.length, missing: missing.length, total: eco.flora[eco.activeFlora].count }));
        assert.equal(missing.length, 0, `${seed}: visible samples were displaced by buffer entries after moving ${movedBy} m`);
      }
    } finally { eco.dispose(); }
  }
});

test('detail fades change alpha coverage while keeping plants and animals at their authored size', () => {
  const eco = new Ecosystem(new THREE.Scene(), makeWorld());
  try {
    captureBuild(eco, new THREE.Vector3(12, 17, 0));
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    eco.floraMaterial.onBeforeCompile(shader);
    assert.equal(eco.floraMaterial.alphaHash, true);
    assert.equal(eco.floraMaterial.transparent, false);
    assert.match(shader.fragmentShader, /diffuseColor\.a \*= vEcoCoverage/);
    assert.match(shader.fragmentShader, /getAlphaHashThreshold\(vPosition\)/);
    assert.doesNotMatch(shader.vertexShader, /detailScale|transformed\.xz \*=|mix\(-\.5, transformed\.y/);
    const geometry = eco.flora[eco.activeFlora].instanceMatrix.array.slice();
    eco._updateBend(1, new THREE.Vector3(12, 16, 0));
    eco.viewer.value.set(40, 17, 0);
    assert.deepEqual(eco.flora[eco.activeFlora].instanceMatrix.array, geometry);
    eco._updateAnimals(10, 1 / 60);
    const fish = eco.animals.fish[0], matrix = new THREE.Matrix4();
    eco.entityMeshes.fish.getMatrixAt(0, matrix);
    const before = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    matrix.decompose(before, rotation, scale);
    eco.viewer.value.set(1000, 17, 0);
    eco._updateAnimals(10, 0);
    eco.entityMeshes.fish.getMatrixAt(0, matrix);
    const farScale = new THREE.Vector3();
    matrix.decompose(before, rotation, farScale);
    assert.deepEqual(farScale, scale);
    assert.ok(Math.abs(farScale.x - fish.size) < .00001);
  } finally { eco.dispose(); }
});

test('grass contact has a rooted bend mask while flowers, lily pads and canopy keep rigid shapes', () => {
  const eco = new Ecosystem(new THREE.Scene(), makeWorld());
  try {
    captureBuild(eco, new THREE.Vector3(0, 17, 0));
    const mesh = eco.flora[eco.activeFlora], contact = mesh.geometry.getAttribute('ecoBend');
    let blades = 0;
    for (let i = 0; i < mesh.count; i++) {
      if (contact.getX(i) < .5) continue;
      blades++;
      assert.ok(contact.getZ(i) > .15);
      assert.ok(contact.getY(i) >= 13);
    }
    assert.ok(blades > 1000, 'grass blades should carry the contact attributes');
    for (const kind of ['flower', 'lily', 'canopy']) {
      eco._beginRebuild(new THREE.Vector3(4, 17, 4));
      if (kind === 'flower') eco._flower(0, 16, 0, () => .5);
      else if (kind === 'lily') eco._lily(12, 0, () => .5);
      else eco._canopy(eco.world.terrain.tree(0, 0));
      assert.ok(eco.pending.count > 0);
      const mask = eco.pending.mesh.geometry.getAttribute('ecoBend');
      for (let i = 0; i < eco.pending.count; i++) assert.equal(mask.getX(i), 0, `${kind} must not receive a whole-body grass bend`);
    }
  } finally { eco.dispose(); }
});

test('grass and reeds root only in live dirt or turf, including clump offsets across material boundaries', () => {
  const surfaces = [1, 2, 4, 3, 8, 5, 7]; // Turf, dirt, sand, stone, snow, wood, water.
  for (const biome of ['meadow', 'jungle', 'desert']) {
    const world = {
      seed: 'grass-substrates', terrain: {},
      heightAt: x => x < -1 ? 10 : 13,
      biomeAt: () => biome,
      getBlock(x, y, z) {
        const height = this.heightAt(x, z);
        if (y < height) return 3;
        if (y === height) return surfaces[((x % surfaces.length) + surfaces.length) % surfaces.length];
        return 0;
      },
    };
    const eco = new Ecosystem(new THREE.Scene(), world);
    try {
      eco._beginRebuild(new THREE.Vector3(8, 15, 8));
      eco._cell(0, 0);
      const { mesh, count } = eco.pending;
      const contact = mesh.geometry.getAttribute('ecoBend');
      let grass = 0, reeds = 0;
      for (let i = 0; i < count; i++) {
        if (contact.getX(i) < .5) continue;
        grass++;
        const x = Math.floor(mesh.instanceMatrix.array[i * 16 + 12]);
        const z = Math.floor(mesh.instanceMatrix.array[i * 16 + 14]);
        const ground = contact.getY(i);
        const support = world.getBlock(x, ground - 1, z);
        assert.ok(support === 1 || support === 2, `${biome}: blade root grew on block ${support}`);
        assert.equal(world.getBlock(x, ground, z), 0, 'the root has exposed air above it');
        if (contact.getZ(i) > .8) reeds++;
      }
      assert.ok(grass > 0, `${biome}: soil still supports grass`);
      if (biome === 'meadow') assert.ok(reeds > 0, 'the same root check covers tall shoreline reeds');
      if (biome !== 'desert') {
        const previousBlock = world.getBlock.bind(world);
        world.getBlock = (x, y, z) => y === world.heightAt(x, z) ? 4 : previousBlock(x, y, z);
        eco._beginRebuild(new THREE.Vector3(8, 15, 8));
        eco._cell(0, 0);
        assert.equal(eco.pending.count, 0, 'replacing live soil with sand removes plants without changing the seed or height field');
      }
    } finally { eco.dispose(); }
  }
});

test('bare desert sand keeps cactus while losing terrestrial grass', () => {
  const world = {
    seed: 'grass-substrates', terrain: {}, heightAt: () => 15, biomeAt: () => 'desert',
    getBlock: (x, y) => y <= 15 ? 4 : 0,
  };
  const eco = new Ecosystem(new THREE.Scene(), world);
  try {
    eco._beginRebuild(new THREE.Vector3(8, 17, 8));
    eco._cell(0, 0);
    const { mesh, count } = eco.pending;
    assert.ok(count > 0, 'cacti remain on their native sandy substrate');
    const contact = mesh.geometry.getAttribute('ecoBend');
    for (let i = 0; i < count; i++) {
      assert.equal(contact.getX(i), 0, 'no grass blades survive on sand');
      assert.ok(mesh.instanceMatrix.array[i * 16] >= .17, 'remaining plants are substantial cactus parts, not thin tufts');
    }
  } finally { eco.dispose(); }
});

test('a departing footstep leaves a damped spring recoil which settles completely', () => {
  const eco = new Ecosystem(new THREE.Scene(), makeWorld());
  try {
    eco._updateBend(0, new THREE.Vector3(0, 16, 0));
    assert.equal(eco.bendWeights.value[0], 1);
    eco._updateBend(.1, new THREE.Vector3(3, 16, 0));
    assert.equal(eco.bendTrail.value[0].x, 0, 'the old pressure stays anchored to the footstep');
    assert.equal(eco.bendBody.value.x, 3);
    eco._updateBend(.25, new THREE.Vector3(3, 16, 0));
    assert.ok(eco.bendWeights.value[0] < 0, 'the old blades gently recoil after the player leaves');
    eco._updateBend(2, new THREE.Vector3(3, 16, 0));
    assert.ok([...eco.bendWeights.value].every(value => value === 0));
    assert.equal(grassSpring(-1), 0);
  } finally { eco.dispose(); }
});
