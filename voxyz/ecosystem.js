import * as THREE from './vendor/three.module.js';

// All small scenery shares a cube geometry and an instanced draw call. The next
// neighborhood is built a few cells at a time while the current one stays visible.
const WATER = 7;
const WATER_SURFACE = 12.86;
const TAU = Math.PI * 2;
const C = {
  grass: [0x6e9666, 0x7a9e67, 0x98af72, 0x507c58, 0x88aa78],
  jungle: [0x4b8059, 0x568e65, 0x69986c, 0x397252, 0x82a574],
  reed: [0x789a68, 0x8faa78, 0x6a8a61, 0x9baa74],
  tip: [0xd4c58a, 0xc2b77f, 0xe0d299],
  petals: [0xf4de9f, 0xf2eee0, 0xc7b3de, 0xeeb7a8],
  kelp: [0x3c795f, 0x4e8b69, 0x649b72, 0x427b67],
  canopy: [0x527e59, 0x638d63, 0x759972, 0x446f50, 0x88a47b, 0x5a8561],
  evergreen: [0x38624a, 0x467858, 0x608668, 0x73977a, 0x4d795a, 0x85a485],
};

function seedValue(value) {
  let h = 2166136261;
  for (const char of String(value ?? 'voxyz')) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

function rng(value) {
  let s = value >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hash(x, z, seed) {
  return (Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ seed) >>> 0;
}

// Compact colored voxel models keep an entire animal species in one draw call.
function voxelModel(parts) {
  const cube = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const source = cube.getAttribute('position');
  const normal = cube.getAttribute('normal');
  const positions = [], normals = [], colors = [], flutter = [];
  const color = new THREE.Color();
  for (const p of parts) {
    color.setHex(p[6]);
    for (let i = 0; i < source.count; i++) {
      positions.push(source.getX(i) * p[3] + p[0], source.getY(i) * p[4] + p[1], source.getZ(i) * p[5] + p[2]);
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      colors.push(color.r, color.g, color.b);
      flutter.push(p[7] || 0);
    }
  }
  cube.dispose();
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  result.setAttribute('flutter', new THREE.Float32BufferAttribute(flutter, 1));
  result.computeBoundingSphere();
  return result;
}

export class Ecosystem {
  constructor(scene, world, { mobile = false } = {}) {
    this.scene = scene;
    this.world = world;
    this.mobile = mobile;
    this.seed = seedValue(world.seed);
    this.group = new THREE.Group();
    this.group.name = 'Living ecosystem';
    this.scene.add(this.group);
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.windTime = { value: 0 };
    this.flyTime = { value: 0 };
    this.center = new THREE.Vector3(Infinity, 0, Infinity);
    this.pending = null;
    this.dirty = false;
    this.animals = { fish: [], bee: [], bird: [], sheep: [] };
    this.capacity = mobile ? 19000 : 56000;
    this.materials = [];
    this.geometries = [];
    this._setupFlora();
    this._setupAnimals();
    this._setupClouds();
    this._setupParticles();
    this.disposed = false;
  }

  _material(options = {}) {
    const material = new THREE.MeshLambertMaterial(options);
    this.materials.push(material);
    return material;
  }

  _setupFlora() {
    this.floraMaterial = this._material({ vertexColors: false });
    this.floraMaterial.onBeforeCompile = shader => {
      shader.uniforms.ecoWind = this.windTime;
      shader.vertexShader = 'attribute float ecoSway;\nuniform float ecoWind;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float phase = ecoWind * 1.35 + instanceMatrix[3].x * .31 + instanceMatrix[3].z * .24;
        float width = max(length(instanceMatrix[0].xyz), .035);
        transformed.x += sin(phase) * ecoSway * (position.y + .5) / width;
      `);
    };
    this.floraMaterial.customProgramCacheKey = () => 'voxyz-microflora-1';
    this.flora = [0, 1].map(() => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      geometry.setAttribute('ecoSway', new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1));
      this.geometries.push(geometry);
      const mesh = new THREE.InstancedMesh(geometry, this.floraMaterial, this.capacity);
      mesh.name = 'Instanced meadow, reeds, flowers and underwater garden';
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Explicit allocation permits updating instance colors before first render.
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    });
    this.activeFlora = 0;
    this.flora[1].visible = false;
  }

  _setupAnimals() {
    const specs = {
      fish: {
        count: this.mobile ? 20 : 42,
        parts: [
          [0, 0, 0, .15, .17, .43, 0xebd7ad],
          [0, .01, -.09, .164, .178, .17, 0xd98940],
          [0, .01, .14, .12, .13, .15, 0xf2e7ca],
          [0, 0, -.29, .24, .09, .13, 0xbf7441],
          [0, .10, -.05, .035, .09, .14, 0xc99258],
          [-.076, .035, .13, .022, .032, .032, 0x253f3b],
          [.076, .035, .13, .022, .032, .032, 0x253f3b],
          [-.13, -.03, .0, .13, .025, .12, 0xd5be83],
          [.13, -.03, .0, .13, .025, .12, 0xd5be83],
        ],
      },
      bee: {
        count: this.mobile ? 7 : 16,
        parts: [
          [0, 0, 0, .13, .12, .23, 0xe8bd53],
          [0, 0, -.025, .135, .125, .06, 0x5d5140],
          [0, 0, .11, .1, .1, .06, 0x51493b],
          [-.095, .085, -.015, .14, .026, .14, 0xe6f0dc, 1],
          [.095, .085, -.015, .14, .026, .14, 0xe6f0dc, 1],
        ],
      },
      bird: {
        count: this.mobile ? 8 : 16,
        parts: [
          [0, 0, 0, .18, .2, .38, 0x596c69],
          [0, -.055, .06, .16, .11, .22, 0xd4d5bd],
          [0, .075, .2, .16, .15, .17, 0x5b716d],
          [0, .04, .31, .065, .05, .11, 0xbdad77],
          [-.3, .025, -.035, .55, .05, .22, 0x718782, 1],
          [.3, .025, -.035, .55, .05, .22, 0x718782, 1],
          [0, .025, -.27, .22, .055, .23, 0x596c69],
        ],
      },
      sheep: {
        count: this.mobile ? 3 : 7,
        parts: [
          [0, .62, 0, .68, .62, .95, 0xe5e1c7],
          [0, .95, -.02, .54, .12, .76, 0xefe9d0],
          [-.35, .6, -.11, .14, .40, .65, 0xd3d0b7],
          [.35, .6, -.11, .14, .40, .65, 0xeae3c9],
          [0, .74, .57, .39, .42, .35, 0xa5a38e],
          [0, .93, .54, .44, .17, .35, 0xeae5ce],
          [-.27, .86, .53, .2, .1, .17, 0xbab5a0],
          [.27, .86, .53, .2, .1, .17, 0xbab5a0],
          [-.12, .79, .754, .065, .058, .025, 0x3f5048],
          [.12, .79, .754, .065, .058, .025, 0x3f5048],
          [-.22, .19, -.30, .15, .36, .16, 0x756f5d],
          [.22, .19, -.30, .15, .36, .16, 0x756f5d],
          [-.22, .19, .30, .15, .36, .16, 0x756f5d],
          [.22, .19, .30, .15, .36, .16, 0x756f5d],
          [0, .65, -.55, .17, .18, .22, 0xeee5ca],
        ],
      },
    };
    this.entityMeshes = {};
    for (const [kind, spec] of Object.entries(specs)) {
      const geometry = voxelModel(spec.parts);
      this.geometries.push(geometry);
      const material = this._material({ vertexColors: true });
      if (kind === 'bee' || kind === 'bird') {
        const rate = kind === 'bee' ? 38 : 9;
        material.onBeforeCompile = shader => {
          shader.uniforms.ecoFlight = this.flyTime;
          shader.vertexShader = 'attribute float flutter;\nuniform float ecoFlight;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
            #include <begin_vertex>
            transformed.y += flutter * abs(position.x) * sin(ecoFlight * ${rate.toFixed(1)} + instanceMatrix[3].x * .3) * .9;
          `);
        };
        material.customProgramCacheKey = () => `voxyz-flight-${kind}`;
      }
      const mesh = new THREE.InstancedMesh(geometry, material, spec.count);
      mesh.name = `Living ${kind}`;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = kind === 'sheep' && !this.mobile;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.entityMeshes[kind] = mesh;
    }
  }

  _setupClouds() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    this.geometries.push(geometry);
    const material = this._material({ color: 0xfff5db, transparent: true, opacity: .88, depthWrite: false });
    this.clouds = new THREE.InstancedMesh(geometry, material, this.mobile ? 70 : 130);
    this.clouds.name = 'Slow drifting cloud archipelago';
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = 1;
    this.cloudParts = [];
    const random = rng(this.seed ^ 0xabc762);
    for (let i = 0; i < (this.mobile ? 8 : 13); i++) {
      const x = (random() - .5) * 280;
      const z = (random() - .5) * 280;
      const y = 51 + random() * 15;
      const count = 6 + Math.floor(random() * 4);
      for (let j = 0; j < count; j++) {
        this.cloudParts.push({ x: x + (random() - .5) * 19, z: z + (random() - .5) * 9, y: y + Math.floor(random() * 3) * 1.3,
          sx: 6 + random() * 9, sy: 1.6 + random() * 3.4, sz: 5 + random() * 7 });
      }
    }
    this.clouds.count = Math.min(this.cloudParts.length, this.clouds.instanceMatrix.count);
    this.group.add(this.clouds);
  }

  _setupParticles() {
    const count = this.mobile ? 75 : 160;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.particleSeeds = [];
    const random = rng(this.seed ^ 0x58a7b31);
    for (let i = 0; i < count; i++) {
      this.particleSeeds.push([random(), random(), random(), random(), random()]);
      this.color.setHex(i % 3 === 0 ? 0xffed9b : 0xcdeca0);
      colors[i * 3] = this.color.r;
      colors[i * 3 + 1] = this.color.g;
      colors[i * 3 + 2] = this.color.b;
    }
    this.geometries.push(geometry);
    this.particleMaterial = new THREE.PointsMaterial({ size: .07, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending });
    this.materials.push(this.particleMaterial);
    this.particles = new THREE.Points(geometry, this.particleMaterial);
    this.particles.name = 'Pollen, drifting dust and fireflies';
    this.particles.frustumCulled = false;
    this.group.add(this.particles);
    this.fireflyLight = new THREE.PointLight(0xd6ef84, 0, 6, 2);
    this.group.add(this.fireflyLight);
  }

  _block(x, y, z) {
    return this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  }

  _box(x, y, z, sx, sy, sz, color, sway = 0, rotation = 0) {
    const pending = this.pending;
    if (!pending || pending.count >= this.capacity) return;
    const i = pending.count++;
    this.dummy.position.set(x, y, z);
    this.dummy.scale.set(sx, sy, sz);
    this.dummy.rotation.set(0, rotation, 0);
    this.dummy.updateMatrix();
    pending.mesh.setMatrixAt(i, this.dummy.matrix);
    pending.mesh.setColorAt(i, this.color.setHex(color));
    pending.mesh.geometry.getAttribute('ecoSway').array[i] = sway;
  }

  _flower(x, ground, z, random, jungle = false) {
    const height = jungle ? .9 + random() * .6 : .3 + random() * .25;
    const width = jungle ? .20 : .075;
    const y = ground + height;
    const petal = C.petals[Math.floor(random() * C.petals.length)];
    this._box(x, ground + height / 2, z, .045, height, .045, 0x527c52);
    this._box(x - width, y, z, width * 1.6, .065, width, petal);
    this._box(x + width, y, z, width * 1.6, .065, width, petal);
    this._box(x, y, z - width, width, .065, width * 1.6, petal);
    this._box(x, y, z + width, width, .065, width * 1.6, petal);
    this._box(x, y + .05, z, width, .07, width, 0xe3b65d);
    this._box(x + .1, ground + height * .5, z, .23, .055, .1, 0x65915b, .015, .4);
  }

  _lily(x, z, random) {
    const size = .35 + random() * .6;
    const y = WATER_SURFACE + .035;
    const green = random() > .5 ? 0x668d58 : 0x79a366;
    // Crossed rectangles give the pads stepped, scalloped outlines.
    this._box(x, y, z, size, .045, size * .55, green);
    this._box(x - size * .09, y + .005, z, size * .62, .055, size * .92, green);
    this._box(x - size * .15, y + .008, z + size * .31, size * .62, .046, size * .38, green);
    this._box(x + size * .08, y + .039, z, size * .30, .012, .025, 0x91ae76);
    if (random() < .23) {
      const petal = random() < .75 ? 0xf4edcb : 0xe5bdb6;
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        this._box(x + Math.cos(a) * .08, y + .09, z + Math.sin(a) * .08, .12, .07, .12, petal);
      }
      this._box(x, y + .155, z, .08, .075, .08, 0xead395);
    }
  }

  _canopy(tree) {
    if (!tree || tree.biome === 'desert') return;
    const random = rng(hash(tree.x, tree.z, this.seed ^ 0x47213ca));
    const palette = tree.conifer ? C.evergreen : tree.biome === 'jungle' ? C.jungle : C.canopy;
    const near = Math.hypot(tree.x - this.pending.x, tree.z - this.pending.z) < 24;
    const samples = this.mobile ? 56 : near ? 170 : 104;
    // Sample the outside of actual leaf voxels. Small clusters break up large
    // canopy planes without replacing their editable, collidable world blocks.
    for (let i = 0; i < samples; i++) {
      if (this.pending.count >= this.capacity - 24) return;
      let x = tree.x, y = tree.y, z = tree.z;
      let nx = 0, ny = 0, nz = 0;
      let found = false;
      const span = tree.conifer ? 5 : 7;
      const isLeaf = id => id === 6 || id === 13;
      if (random() < .24) {
        x += Math.round((random() + random() - 1) * span);
        z += Math.round((random() + random() - 1) * span);
        ny = random() < .78 ? 1 : -1;
        const from = ny > 0 ? tree.h + 3 : 1;
        const to = ny > 0 ? 1 : tree.h + 3;
        for (let dy = from; ny > 0 ? dy >= to : dy <= to; dy -= ny) {
          y = tree.y + dy;
          if (isLeaf(this.world.terrain.treeBlock(tree, x, y, z))) { found = true; break; }
        }
      } else {
        const side = random() < .5 ? -1 : 1;
        const along = Math.round((random() + random() - 1) * span);
        y += tree.conifer ? 2 + Math.floor(random() * tree.h) : tree.h - 7 + Math.floor(random() * 9);
        if (random() < .5) { z += along; nx = side; }
        else { x += along; nz = side; }
        for (let out = 8; out >= -8; out--) {
          if (nx) x = tree.x + out * side;
          else z = tree.z + out * side;
          if (isLeaf(this.world.terrain.treeBlock(tree, x, y, z))) { found = true; break; }
        }
      }
      if (!found) continue;
      const support = this._block(x, y, z);
      if (support !== 6 && support !== 13) continue;
      if (this._block(x + nx, y + ny, z + nz) !== 0) continue;
      const u = (random() - .5) * .70, v = (random() - .5) * .70;
      const clusters = 3 + Math.floor(random() * 3);
      for (let leaf = 0; leaf < clusters; leaf++) {
        const size = .14 + random() * .23;
        const out = .50 + random() * .20;
        const du = u + (random() - .5) * .42;
        const dv = v + (random() - .5) * .42;
        const bx = x + .5 + nx * out + (nx ? 0 : du);
        const by = y + .5 + ny * out + (ny ? 0 : dv);
        const bz = z + .5 + nz * out + (nz ? 0 : nx ? du : dv);
        const tint = tree.biome === 'ice' && ny > 0 && random() < .45 ? 0xcadbc9 : palette[Math.floor(random() * palette.length)];
        this._box(bx, by, bz, size, size * (.65 + random() * .40), size * (.80 + random() * .30), tint, .012);
      }
    }
  }

  _cell(cx, cz) {
    const random = rng(hash(cx, cz, this.seed));
    const cellSize = 12;
    const subdivisions = this.mobile ? 10 : 15;
    const stride = cellSize / subdivisions;
    const pending = this.pending;
    for (let ix = 0; ix < subdivisions; ix++) {
      for (let iz = 0; iz < subdivisions; iz++) {
        if (pending.count >= this.capacity - 24) return;
        const x = cx * cellSize + (ix + random()) * stride;
        const z = cz * cellSize + (iz + random()) * stride;
        const radius = Math.hypot(x - pending.x, z - pending.z);
        if (radius > (this.mobile ? 29 : 42) || (radius > 23 && random() < .45)) continue;
        const height = this.world.heightAt(Math.floor(x), Math.floor(z));
        const ground = height + 1;
        const biome = this.world.biomeAt(Math.floor(x), Math.floor(z));
        const above = this._block(x, ground, z);
        if (above === WATER && height < 12) {
          if (pending.water.length < 100 && random() < .16) pending.water.push({ x, z, y: ground });
          // Patchy shallow-water colonies leave the middle of the pond open.
          const patch = Math.sin(x * .39 + this.seed % 13) + Math.cos(z * .47 - this.seed % 17);
          const lilyChance = height >= 10 ? (patch > -.05 ? .25 : .028) : .006;
          if (random() < lilyChance && this._block(x, 12, z) === WATER) this._lily(x, z, random);
          if (random() < .58) {
            const stems = 2 + Math.floor(random() * 4);
            for (let s = 0; s < stems; s++) {
              const h = Math.min(WATER_SURFACE - ground - .20, .3 + random() * .7);
              if (h <= .12) continue;
              const bx = x + (random() - .5) * .5;
              const bz = z + (random() - .5) * .5;
              const leaf = C.kelp[Math.floor(random() * C.kelp.length)];
              this._box(bx, ground + h / 2, bz, .10 + random() * .09, h, .10, leaf, .025);
              if (random() < .4) this._box(bx + .08, ground + h * .55, bz, .26, .11, .15, leaf, .01);
            }
          }
          continue;
        }
        // heightAt describes the seeded column; the live block check honors edits.
        const support = this._block(x, height, z);
        if (above !== 0 || height < 12 || support === 0 || support === WATER) continue;
        if (biome === 'ice') {
          if (random() < .045) {
            this._box(x, ground + .15, z, .18, .3, .17, 0xbdd4d0);
            this._box(x + .15, ground + .10, z + .1, .13, .2, .13, 0xcee1da);
          }
          continue;
        }
        if (biome === 'desert') {
          if (random() < .014) {
            const h = .8 + random() * 1.2;
            this._box(x, ground + h / 2, z, .25, h, .27, 0x79946c);
            this._box(x + .30, ground + h * .45, z, .40, .2, .23, 0x839c72);
            this._box(x + .45, ground + h * .65, z, .18, h * .45, .22, 0x839c72);
            if (random() < .55) this._box(x, ground + h + .06, z, .18, .12, .18, 0xdfb0a3);
          } else if (random() < .10) {
            for (let s = 0; s < 3; s++) this._box(x + (random() - .5) * .2, ground + .15, z + (random() - .5) * .2, .04, .30, .045, 0xabaa7b, .04);
          }
          continue;
        }
        const jungle = biome === 'jungle';
        const shoreline = height <= 14 && (
          this.world.heightAt(Math.floor(x + 2), Math.floor(z)) < 12 ||
          this.world.heightAt(Math.floor(x - 2), Math.floor(z)) < 12 ||
          this.world.heightAt(Math.floor(x), Math.floor(z + 2)) < 12 ||
          this.world.heightAt(Math.floor(x), Math.floor(z - 2)) < 12
        );
        const palette = shoreline ? C.reed : jungle ? C.jungle : C.grass;
        const stems = shoreline ? 5 : jungle ? 4 : 3;
        for (let s = 0; s < stems; s++) {
          const bx = x + (random() - .5) * stride * .9;
          const bz = z + (random() - .5) * stride * .9;
          const h = shoreline ? .50 + random() * .95 : (jungle ? .34 : .18) + random() * .42;
          const width = shoreline ? .075 + random() * .04 : .055 + random() * .07;
          const leaf = palette[Math.floor(random() * palette.length)];
          this._box(bx, ground + h / 2, bz, width, h, width, leaf, .035 + h * .025);
          if (shoreline && random() < .75) this._box(bx, ground + h + .04, bz, width * 1.13, .12 + random() * .10, width * 1.13, C.tip[Math.floor(random() * C.tip.length)], .025);
          else if (jungle && s === 0) this._box(bx, ground + h * .7, bz, .35, .09, .17, leaf, .02, random() * TAU);
        }
        if (random() < (jungle ? .055 : .085)) {
          this._flower(x, ground, z, random, jungle);
          if (pending.flowers.length < 100) pending.flowers.push({ x, z, y: ground + (jungle ? 1.3 : .6) });
        }
        if (!jungle && radius < 30 && random() < .03 && pending.meadow.length < 60) pending.meadow.push({ x, z, y: ground });
      }
    }
    // A tree belongs to exactly one detail cell, even when its crown overlaps.
    if (this.world.terrain?.tree) {
      for (let tx = Math.floor(cx * cellSize / 8); tx <= Math.floor((cx + 1) * cellSize / 8); tx++) {
        for (let tz = Math.floor(cz * cellSize / 8); tz <= Math.floor((cz + 1) * cellSize / 8); tz++) {
          const tree = this.world.terrain.tree(tx, tz);
          if (!tree || tree.x < cx * cellSize || tree.x >= (cx + 1) * cellSize || tree.z < cz * cellSize || tree.z >= (cz + 1) * cellSize) continue;
          if (Math.hypot(tree.x - pending.x, tree.z - pending.z) < (this.mobile ? 30 : 43)) this._canopy(tree);
        }
      }
    }
  }

  _beginRebuild(position) {
    this.dirty = false;
    const cx = Math.floor(position.x / 12), cz = Math.floor(position.z / 12);
    const radius = this.mobile ? 2 : 3;
    const cells = [];
    for (let x = -radius; x <= radius; x++) for (let z = -radius; z <= radius; z++) cells.push([cx + x, cz + z, x * x + z * z]);
    cells.sort((a, b) => a[2] - b[2]);
    const mesh = this.flora[1 - this.activeFlora];
    mesh.visible = false;
    mesh.count = 0;
    this.pending = { x: position.x, z: position.z, mesh, cells, next: 0, count: 0, water: [], flowers: [], meadow: [] };
  }

  _advanceRebuild() {
    const pending = this.pending;
    if (!pending) return;
    const budget = this.mobile ? 1 : 2;
    for (let step = 0; step < budget && pending.next < pending.cells.length; step++) {
      const [x, z] = pending.cells[pending.next++];
      this._cell(x, z);
    }
    if (pending.next < pending.cells.length && pending.count < this.capacity - 24) return;
    pending.mesh.count = pending.count;
    pending.mesh.instanceMatrix.needsUpdate = true;
    pending.mesh.instanceColor.needsUpdate = true;
    pending.mesh.geometry.getAttribute('ecoSway').needsUpdate = true;
    pending.mesh.visible = true;
    this.flora[this.activeFlora].visible = false;
    this.activeFlora = 1 - this.activeFlora;
    this.center.set(pending.x, 0, pending.z);
    this._populateAnimals(pending);
    this.pending = null;
  }

  _populateAnimals(pending) {
    const random = rng(hash(Math.floor(pending.x / 12), Math.floor(pending.z / 12), this.seed ^ 0x6184da));
    for (const [kind, mesh] of Object.entries(this.entityMeshes)) {
      const anchors = kind === 'fish' ? pending.water : kind === 'bee' ? pending.flowers : pending.meadow;
      const list = this.animals[kind];
      list.length = 0;
      for (let i = 0; i < mesh.instanceMatrix.count; i++) {
        if (kind !== 'bird' && anchors.length === 0) break;
        const anchor = kind === 'bird' ? { x: pending.x + (random() - .5) * 70, z: pending.z + (random() - .5) * 70, y: 28 + random() * 13 } : anchors[Math.floor(random() * anchors.length)];
        const y = kind === 'fish' ? Math.min(WATER_SURFACE - .6, anchor.y + .3 + random() * Math.max(.1, WATER_SURFACE - anchor.y - 1)) : anchor.y;
        list.push({ x: anchor.x, y, z: anchor.z, phase: random() * TAU, speed: .14 + random() * .21, radius: kind === 'bird' ? 8 + random() * 16 : kind === 'sheep' ? .7 + random() : .35 + random() * 1.1, size: kind === 'fish' ? .7 + random() * .9 : kind === 'sheep' ? .8 + random() * .25 : .8 + random() * .4 });
      }
      mesh.count = list.length;
    }
  }

  _updateAnimals(time) {
    for (const [kind, mesh] of Object.entries(this.entityMeshes)) {
      this.animals[kind].forEach((animal, i) => {
        const a = time * animal.speed + animal.phase;
        let x = animal.x + Math.cos(a) * animal.radius;
        let z = animal.z + Math.sin(a) * animal.radius;
        let y = animal.y;
        if (kind === 'fish') {
          y += Math.sin(a * 2.5) * .13;
          if (this._block(x, y, z) !== WATER) { x = animal.x; z = animal.z; }
        } else if (kind === 'bee') {
          y += Math.sin(time * 3.4 + animal.phase) * .14 + .10;
        } else if (kind === 'bird') {
          y += Math.sin(a * 2) * 1.4;
        } else {
          // A grazing sheep only steps onto a dry, almost level neighboring block.
          const floor = this.world.heightAt(Math.floor(x), Math.floor(z)) + 1;
          if (floor < 14 || Math.abs(floor - animal.y) > 1.01 || this._block(x, floor, z) !== 0) { x = animal.x; z = animal.z; }
          else y = floor;
          y += Math.max(0, Math.sin(time * 2 + animal.phase)) * .018;
        }
        this.dummy.position.set(x, y, z);
        this.dummy.rotation.set(0, -a, kind === 'bird' ? Math.sin(a) * .14 : 0);
        this.dummy.scale.setScalar(animal.size);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  update(dt, time, playerPosition, daylight = 1) {
    if (this.disposed || !playerPosition) return;
    time = Number.isFinite(time) ? time : 0;
    this.windTime.value = time;
    this.flyTime.value = time;
    if (!this.pending && (this.dirty || Math.hypot(playerPosition.x - this.center.x, playerPosition.z - this.center.z) > 13)) this._beginRebuild(playerPosition);
    this._advanceRebuild();
    this._updateAnimals(time);
    const cloudDrift = time * .28;
    for (let i = 0; i < this.clouds.count; i++) {
      const cloud = this.cloudParts[i];
      const x = ((cloud.x + cloudDrift - playerPosition.x + 420) % 280 + 280) % 280 - 140 + playerPosition.x;
      const z = ((cloud.z - playerPosition.z + 420) % 280 + 280) % 280 - 140 + playerPosition.z;
      this.dummy.position.set(x, cloud.y, z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(cloud.sx, cloud.sy, cloud.sz);
      this.dummy.updateMatrix();
      this.clouds.setMatrixAt(i, this.dummy.matrix);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    const night = 1 - THREE.MathUtils.smoothstep(daylight, .08, .6);
    const positions = this.particles.geometry.getAttribute('position');
    const belowGround = playerPosition.y < this.world.heightAt(Math.floor(playerPosition.x), Math.floor(playerPosition.z));
    for (let i = 0; i < this.particleSeeds.length; i++) {
      const p = this.particleSeeds[i];
      const x = playerPosition.x + ((p[0] * 36 + time * .025 - playerPosition.x + 180) % 36 + 36) % 36 - 18 + Math.sin(time * (.17 + p[3] * .1) + p[4] * TAU) * 1.1;
      const z = playerPosition.z + ((p[1] * 36 - playerPosition.z + 180) % 36 + 36) % 36 - 18 + Math.cos(time * .19 + p[3] * TAU) * .8;
      const y = belowGround ? playerPosition.y + (p[2] - .5) * 6 : playerPosition.y - 1 + p[2] * 5 + Math.sin(time * .35 + p[4] * TAU) * .7;
      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
    this.particleMaterial.size = belowGround ? .035 : .048 + night * .045;
    this.particleMaterial.opacity = belowGround ? .22 : .27 + night * .55;
    this.fireflyLight.intensity = night * (.22 + Math.sin(time * 2.2) * .06);
    this.fireflyLight.position.set(playerPosition.x + Math.sin(time * .25) * 2, playerPosition.y + .4, playerPosition.z + Math.cos(time * .25) * 2);
  }

  // Rebuild fine scenery after terrain editing so grass never hangs in the air.
  invalidate() {
    this.dirty = true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.group);
    for (const mesh of this.flora) mesh.dispose();
    for (const mesh of Object.values(this.entityMeshes)) mesh.dispose();
    this.clouds.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.pending = null;
  }
}

export default Ecosystem;
