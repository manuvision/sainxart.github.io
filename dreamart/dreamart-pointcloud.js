(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const PHI = (1 + Math.sqrt(5)) / 2;
  const GOLDEN = TAU * (1 - 1 / PHI);
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PALETTES = {
    Monochrome: ['#e0e0e0','#c0c0c0','#a0a0a0','#808080','#606060','#404040','#242424'],
    Dusk:       ['#f0c080','#d87840','#b84858','#6a2888','#243080','#141850','#0c0c28'],
    Ember:      ['#f8d060','#f0a030','#e06018','#c03008','#881800','#4c0a00','#200400'],
    Forest:     ['#c0f0a0','#80c860','#409040','#206830','#0c5020','#063010','#021808'],
    Ocean:      ['#b0d8f8','#60a8e0','#2868c0','#084898','#043070','#011840','#000820'],
    Aurora:     ['#e8c8ff','#a060e8','#6020c0','#3008a8','#180470','#080128','#020014'],
    Sepia:      ['#f0e0b0','#d0a860','#b07040','#804028','#502010','#28100c','#140804'],
    'Neon City':['#d8ffc0','#60f060','#00c8b8','#0060f0','#8000e0','#40006c','#140020'],
    Rust:       ['#f0d890','#e09040','#c84820','#902018','#581008','#2c0804','#120200'],
    'Mint Ice': ['#c8f8e4','#78e4be','#30b890','#0a8868','#065848','#023020','#011010'],
    Candy:      ['#ffc8e8','#ff98cc','#ff50a0','#d01878','#800848','#3c0028','#180010'],
    'Gold Ink': ['#f8e898','#e8c050','#c89010','#906000','#583800','#2c1c00','#140a00'],
    'Moss Yellow': ['#dcf7a4','#b6dd68','#86b942','#5e8e2a','#386818','#1c3d0c','#071806'],
    'Moss True':   ['#b9f1a4','#78c86c','#3f9847','#236d31','#114a20','#082a12','#021006'],
    'Moss Teal':   ['#b7f3e2','#63d8bc','#1ea889','#0b7866','#075147','#033128','#011411'],
    'Powder Cyan': ['#d2f2ff','#90d4f2','#48aee0','#1b7db8','#0d5488','#052b54','#010a22'],
    'Slate Blue':  ['#b7dcff','#6aa9e7','#2e73c6','#164c99','#0c3170','#051b44','#01091f'],
    'Slate Indigo':['#c8cffd','#7183e5','#384fb8','#1d328a','#101f5a','#081033','#020514'],
  };

  const BANDS = [
    { min: 86, max: 100, label: 'Optimal', bucket: 'Aurora', shape: 'sphere', color: '#8B5CF6', palettes: ['Aurora', 'Aurora', 'Candy'], hueLabels: ['blue-violet', 'luminous violet', 'pink-magenta violet'] },
    { min: 71, max: 85, label: 'Good', bucket: 'Slate', shape: 'torus', color: '#3A78B8', palettes: ['Powder Cyan', 'Slate Blue', 'Slate Indigo'], hueLabels: ['powder cyan-blue', 'cinematic blue', 'slate indigo'] },
    { min: 56, max: 70, label: 'Moderate', bucket: 'Moss', shape: 'cylinder', color: '#4D7C5A', palettes: ['Moss Yellow', 'Moss True', 'Moss Teal'], hueLabels: ['yellow-green moss', 'moss green', 'blue-green teal'] },
    { min: 41, max: 55, label: 'Fair', bucket: 'Ochre', shape: 'cube', color: '#D4A853', palettes: ['Sepia', 'Gold Ink', 'Gold Ink'], hueLabels: ['deep ochre', 'warm amber', 'pale amber'] },
    { min: 0, max: 40, label: 'Poor', bucket: 'Ember', shape: 'pyramid', color: '#C8613A', palettes: ['Rust', 'Rust', 'Ember'], hueLabels: ['deep brown-red', 'rich rust', 'burnt orange-red'] },
  ];

  const MATERIALS = [
    { name: 'Ceramic', sizeMul: 0.98, alphaMul: 1, glowMul: 0.62, jitter: 0, swarm: 0 },
    { name: 'Metal', sizeMul: 0.95, alphaMul: 1.08, glowMul: 1.18, jitter: 0, swarm: 0 },
    { name: 'Wood', sizeMul: 1.12, alphaMul: 0.92, glowMul: 0.52, jitter: 0.28, swarm: 0 },
    { name: 'Polymer', sizeMul: 1.24, alphaMul: 0.9, glowMul: 0.76, jitter: 0.12, swarm: 0 },
    { name: 'Glass', sizeMul: 0.92, alphaMul: 1.04, glowMul: 1.02, jitter: 0, swarm: 0 },
  ];

  const makeSvg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`;
  const GLYPH_SVGS = {
    circle: makeSvg('<circle cx="12" cy="12" r="10" fill="currentColor"/>'),
    ring: makeSvg('<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="3"/>'),
    square: makeSvg('<rect x="2" y="2" width="20" height="20" fill="currentColor"/>'),
    'sq-out': makeSvg('<rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3"/>'),
    rounded: makeSvg('<rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor"/>'),
    'tri-up': makeSvg('<polygon points="12,2 22,22 2,22" fill="currentColor"/>'),
    'tri-dn': makeSvg('<polygon points="2,2 22,2 12,22" fill="currentColor"/>'),
    diamond: makeSvg('<polygon points="12,1 23,12 12,23 1,12" fill="currentColor"/>'),
    plus: makeSvg('<rect x="9" y="1" width="6" height="22" fill="currentColor"/><rect x="1" y="9" width="22" height="6" fill="currentColor"/>'),
    'x-mark': makeSvg('<path d="M3 3L21 21M21 3L3 21" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none"/>'),
    asterisk: makeSvg('<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>'),
    'star-4': makeSvg('<polygon points="12,2 14.2,9.8 22,12 14.2,14.2 12,22 9.8,14.2 2,12 9.8,9.8" fill="currentColor"/>'),
    'star-5': makeSvg('<polygon points="12,2 14.4,9.2 22,9.5 16.2,14.3 18.5,22 12,17.3 5.5,22 7.8,14.3 2,9.5 9.6,9.2" fill="currentColor"/>'),
    'dot-sm': makeSvg('<circle cx="12" cy="12" r="4" fill="currentColor"/>'),
    'dots-4': makeSvg('<circle cx="7" cy="7" r="3" fill="currentColor"/><circle cx="17" cy="7" r="3" fill="currentColor"/><circle cx="7" cy="17" r="3" fill="currentColor"/><circle cx="17" cy="17" r="3" fill="currentColor"/>'),
    heart: makeSvg('<path d="M12 20.5C11 19.5 2 14 2 7.5C2 4.5 4.5 2.5 7.5 2.5C9.5 2.5 11 3.5 12 5C13 3.5 14.5 2.5 16.5 2.5C19.5 2.5 22 4.5 22 7.5C22 14 13 19.5 12 20.5Z" fill="currentColor"/>'),
    leaf: makeSvg('<path d="M12 3C12 3 21 8 21 14C21 18.4 16.9 21.5 12 21.5C7.1 21.5 3 18.4 3 14C3 8 12 3 12 3Z" fill="currentColor"/>'),
  };
  // Match manu.vision/glyph.html's first Glyph Dither toggle state.
  const DEFAULT_GLYPH_SET = ['square','x-mark','sq-out','ring','asterisk','dots-4','dot-sm'];
  const GLYPH_IMAGES = {};
  Object.keys(GLYPH_SVGS).forEach(id => {
    const image = new Image();
    image.src = `data:image/svg+xml;base64,${btoa(GLYPH_SVGS[id])}`;
    GLYPH_IMAGES[id] = image;
  });

  const COUNT_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const SCALE_LEVELS = { 'compact in scale': 0.62, 'modest in scale': 0.78, 'calmly scaled': 0.95, 'broad and spacious': 1.16 };
  const CLUSTER_LEVELS = { 'closely clustered': 0.52, 'evenly gathered': 0.82, 'loosely spaced': 1.18 };
  const TILT_LEVELS = { 'mostly upright': 0.09, 'softly tilted': 0.30, 'rotated into a dreamier drift': 0.62 };
  const FLOAT_LEVELS = { 'hovering low': -1, 'held in calm suspension': 0, 'floating higher': 1 };
  const TONE_BY_HUE = {
    'blue-violet': 0, 'luminous violet': 1, 'pink-magenta violet': 2,
    'powder cyan-blue': 0, 'cinematic blue': 1, 'slate indigo': 2,
    'yellow-green moss': 0, 'moss green': 1, 'blue-green teal': 2,
    'deep ochre': 0, 'warm amber': 1, 'pale amber': 2,
    'deep brown-red': 0, 'rich rust': 1, 'burnt orange-red': 2,
  };
  const READING_RE = new RegExp(
    '^This night becomes (one|two|three|four|five) (.+?) ' +
    '(pyramids?|cubes?|cylinders?|spheres?|tor(?:us|uses)), ' +
    '(compact in scale|modest in scale|calmly scaled|broad and spacious) and ' +
    '(closely clustered|evenly gathered|loosely spaced)\\. ' +
    'REM leaves the forms (mostly upright|softly tilted|rotated into a dreamier drift), ' +
    'while recovery keeps them (hovering low|held in calm suspension|floating higher)\\.'
  );

  const SHAPE_DIMS = {
    torus: { R: 128, r: 52 },
    sphere: { R: 168 },
    cube: { a: 118 },
    cylinder: { R: 88, H: 226 },
    pyramid: { a: 252 },
  };

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function hashString(seed) {
    let hash = 2166136261;
    const text = String(seed == null ? '' : seed);
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededFraction(seed) {
    return hashString(seed) / 4294967295;
  }

  function mulberry32(a) {
    return function random() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(char => char + char).join('') : clean;
    const value = Number.parseInt(full, 16);
    if (Number.isNaN(value)) return { r: 255, g: 255, b: 255 };
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  function mixHex(hexA, hexB, amount) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    return `rgb(${Math.round(a.r + (b.r - a.r) * amount)},${Math.round(a.g + (b.g - a.g) * amount)},${Math.round(a.b + (b.b - a.b) * amount)})`;
  }

  function scoreBand(score) {
    const value = Number(score);
    if (!Number.isFinite(value)) return BANDS[2];
    return BANDS.find(band => value >= band.min && value <= band.max) || BANDS[2];
  }

  function bandTone(score) {
    const band = scoreBand(score);
    const position = clamp01((Number(score) - band.min) / Math.max(1, band.max - band.min));
    return position < 0.33 ? 0 : position < 0.66 ? 1 : 2;
  }

  function parseReading(reading) {
    const match = READING_RE.exec(String(reading || ''));
    if (!match) return null;
    const shapeWord = match[3].startsWith('torus') ? 'torus' : match[3].replace(/s$/, '');
    return {
      count: COUNT_WORDS[match[1]],
      hue: match[2],
      shape: shapeWord,
      scale: SCALE_LEVELS[match[4]],
      cluster: CLUSTER_LEVELS[match[5]],
      tilt: TILT_LEVELS[match[6]],
      float: FLOAT_LEVELS[match[7]],
    };
  }

  function specForItem(item) {
    const cacheKey = `${item.date || item.label || ''}:${item.sleepScore}:${item.reading || ''}`;
    if (item._pointcloudSpec && item._pointcloudSpecKey === cacheKey) return item._pointcloudSpec;
    const score = Number.isFinite(Number(item.sleepScore)) ? Number(item.sleepScore) : 62;
    const band = scoreBand(score);
    const seed = item.date || item.label || String(score);
    const parsed = parseReading(item.reading);
    let tone = bandTone(score);
    if (parsed && TONE_BY_HUE[parsed.hue] != null) tone = TONE_BY_HUE[parsed.hue];
    const spec = {
      seed,
      score,
      band,
      tone,
      shape: parsed ? parsed.shape : band.shape,
      count: parsed ? parsed.count : 1 + Math.floor(seededFraction(`${seed}:n`) * 5),
      scale: parsed ? parsed.scale : 0.78 + seededFraction(`${seed}:s`) * 0.35,
      cluster: parsed ? parsed.cluster : 0.6 + seededFraction(`${seed}:c`) * 0.55,
      tilt: parsed ? parsed.tilt : 0.1 + seededFraction(`${seed}:t`) * 0.4,
      float: parsed ? parsed.float : 0,
      material: MATERIALS[hashString(`${seed}:material`) % MATERIALS.length],
    };
    spec.paletteName = band.palettes[tone];
    spec.palette = PALETTES[spec.paletteName];
    spec.hueLabel = parsed ? parsed.hue : band.hueLabels[tone];
    item._pointcloudSpecKey = cacheKey;
    item._pointcloudSpec = spec;
    return spec;
  }

  function halton(index, base) {
    let factor = 1;
    let result = 0;
    while (index > 0) {
      factor /= base;
      result += factor * (index % base);
      index = Math.floor(index / base);
    }
    return result;
  }

  function hashUnit(index, salt = 0) {
    let hash = Math.imul((index + 1) ^ salt, 0x9E3779B1);
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85EBCA6B);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xC2B2AE35);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967295;
  }

  function generateParticles(shape, count) {
    const points = [];
    const dimensions = SHAPE_DIMS[shape] || SHAPE_DIMS.torus;
    if (shape === 'sphere') {
      for (let i = 0; i < count; i += 1) {
        const phi = Math.acos(2 * halton(i, 2) - 1);
        const theta = TAU * halton(i, 3);
        points.push({ x: dimensions.R * Math.sin(phi) * Math.cos(theta), y: dimensions.R * Math.cos(phi), z: dimensions.R * Math.sin(phi) * Math.sin(theta), f: i / count, phase: halton(i, 7) * TAU });
      }
    } else if (shape === 'torus') {
      for (let i = 0; i < count; i += 1) {
        const u = halton(i, 2) * TAU;
        const v = halton(i, 3) * TAU;
        points.push({ x: (dimensions.R + dimensions.r * Math.cos(v)) * Math.cos(u), y: dimensions.r * Math.sin(v), z: (dimensions.R + dimensions.r * Math.cos(v)) * Math.sin(u), f: i / count, phase: halton(i, 5) * TAU });
      }
    } else if (shape === 'cube') {
      const perFace = Math.floor(count / 6);
      const a = dimensions.a;
      const faces = [
        (u, v) => ({ x: u, y: v, z: a }), (u, v) => ({ x: u, y: v, z: -a }),
        (u, v) => ({ x: a, y: u, z: v }), (u, v) => ({ x: -a, y: u, z: v }),
        (u, v) => ({ x: u, y: a, z: v }), (u, v) => ({ x: u, y: -a, z: v }),
      ];
      faces.forEach((makeFace, faceIndex) => {
        for (let i = 0; i < perFace; i += 1) {
          const pointIndex = faceIndex * perFace + i;
          const u = (halton(i, 2) * 2 - 1) * a;
          const v = (halton(i, 3) * 2 - 1) * a;
          points.push({ ...makeFace(u, v), f: pointIndex / count, phase: halton(pointIndex, 5) * TAU });
        }
      });
    } else if (shape === 'cylinder') {
      const sideCount = Math.floor(count * 0.7);
      const capCount = Math.floor(count * 0.15);
      for (let i = 0; i < sideCount; i += 1) {
        const theta = i * GOLDEN;
        points.push({ x: dimensions.R * Math.cos(theta), y: (halton(i, 3) * 2 - 1) * (dimensions.H / 2), z: dimensions.R * Math.sin(theta), f: i / count, phase: halton(i, 5) * TAU });
      }
      for (let cap = 0; cap < 2; cap += 1) {
        for (let i = 0; i < capCount; i += 1) {
          const pointIndex = sideCount + cap * capCount + i;
          const radius = Math.sqrt(halton(i, 2)) * dimensions.R;
          const theta = (i + cap * 137) * GOLDEN;
          points.push({ x: radius * Math.cos(theta), y: cap === 0 ? dimensions.H / 2 : -dimensions.H / 2, z: radius * Math.sin(theta), f: pointIndex / count, phase: halton(pointIndex, 5) * TAU });
        }
      }
    } else {
      const a = dimensions.a;
      const baseRadius = a / Math.sqrt(3);
      const height = a * Math.sqrt(2 / 3);
      const apex = [0, -height, 0];
      const base = [
        [baseRadius, 0, 0],
        [baseRadius * Math.cos(2 * Math.PI / 3), 0, baseRadius * Math.sin(2 * Math.PI / 3)],
        [baseRadius * Math.cos(4 * Math.PI / 3), 0, baseRadius * Math.sin(4 * Math.PI / 3)],
      ];
      const faces = [[apex, base[0], base[1]], [apex, base[1], base[2]], [apex, base[2], base[0]], [base[0], base[2], base[1]]];
      const perFace = Math.floor(count / 4);
      faces.forEach((face, faceIndex) => {
        const [v0, v1, v2] = face;
        for (let i = 0; i < perFace; i += 1) {
          const pointIndex = faceIndex * perFace + i;
          const root = Math.sqrt(halton(i, 2));
          const u = 1 - root;
          const v = root * halton(i, 3);
          const w = root * (1 - halton(i, 3));
          points.push({ x: u * v0[0] + v * v1[0] + w * v2[0], y: u * v0[1] + v * v1[1] + w * v2[1], z: u * v0[2] + v * v1[2] + w * v2[2], f: pointIndex / count, phase: halton(pointIndex, 5) * TAU });
        }
      });
    }
    if (points.length) {
      let centerX = 0;
      let centerY = 0;
      let centerZ = 0;
      for (const point of points) {
        centerX += point.x;
        centerY += point.y;
        centerZ += point.z;
      }
      centerX /= points.length;
      centerY /= points.length;
      centerZ /= points.length;
      for (const point of points) {
        point.x -= centerX;
        point.y -= centerY;
        point.z -= centerZ;
      }
    }
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      point.colorSeed = hashUnit(index, 17);
      point.sizeSeed = hashUnit(index, 43);
      point.motionSeed = hashUnit(index, 91);
      point.motionSeedB = hashUnit(index, 137);
    }
    return points;
  }

  class DreamRenderer {
    constructor(canvas, { budget = 8000 } = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.pcCanvas = document.createElement('canvas');
      this.pctx = this.pcCanvas.getContext('2d');
      this.glyphCanvas = document.createElement('canvas');
      this.gctx = this.glyphCanvas.getContext('2d');
      this.bufCanvas = document.createElement('canvas');
      this.bctx = this.bufCanvas.getContext('2d', { willReadFrequently: true });
      this.budget = budget;
      this.rotX = 0.28;
      this.rotY = 0;
      this.velX = 0;
      this.velY = 0.0032;
      this.zoom = 1;
      this.dragging = false;
      this.spec = null;
      this.prims = [];
    }

    setItem(item) {
      this.setSpec(specForItem(item));
    }

    setSpec(spec) {
      this.spec = spec;
      const random = mulberry32(hashString(spec.seed));
      const primitiveCount = Math.max(1, Math.min(5, spec.count));
      const perPrimitive = Math.floor(this.budget / primitiveCount);
      const countScale = [1.24, 1.06, 0.96, 0.88, 0.8][primitiveCount - 1];
      const bobAmplitude = spec.float > 0 ? 17 : spec.float < 0 ? 7 : 11;
      this.bobAmp = bobAmplitude;
      const collisionFactor = 1.04 + Math.max(0, spec.cluster - 0.5) * 0.16;
      const startAngle = random() * TAU;
      const heroScales = {
        1: [1],
        2: [1.42, 0.82],
        3: [1.5, 0.84, 0.64],
        4: [1.48, 0.82, 0.64, 0.56],
        5: [1.45, 0.8, 0.62, 0.54, 0.48],
      };
      const layoutTemplates = {
        1: [[0, 0, 0]],
        2: [[-0.34, 0.12, 0.1], [0.46, -0.22, -0.22]],
        3: [[-0.28, 0.18, 0.16], [0.45, -0.2, -0.18], [0.08, -0.52, -0.38]],
        4: [[-0.24, 0.18, 0.18], [0.44, -0.2, -0.18], [-0.44, -0.36, -0.34], [0.18, -0.58, -0.5]],
        5: [[-0.22, 0.2, 0.2], [0.42, -0.2, -0.16], [-0.42, -0.34, -0.3], [0.14, -0.56, -0.46], [0.56, 0.14, -0.36]],
      };

      this.prims = [];
      for (let i = 0; i < primitiveCount; i += 1) {
        const points = generateParticles(spec.shape, perPrimitive);
        let maxNormSquared = 0;
        for (const point of points) {
          const distance = point.x * point.x + point.y * point.y + point.z * point.z;
          if (distance > maxNormSquared) maxNormSquared = distance;
        }
        const scale = spec.scale * countScale * heroScales[primitiveCount][i] * (0.94 + random() * 0.14);
        const torusFaceTilt = spec.shape === 'torus' ? Math.PI / 2 : 0;
        const torusAxisDrift = spec.shape === 'torus' ? (random() - 0.5) * 0.22 : 0;
        this.prims.push({
          pts: points,
          boundR: Math.sqrt(maxNormSquared) * scale * 1.09 + bobAmplitude + 6,
          ox: 0, oy: 0, oz: 0,
          scale,
          tiltX: torusFaceTilt + (random() - 0.5) * 2 * spec.tilt,
          tiltZ: torusAxisDrift + (random() - 0.5) * 2 * spec.tilt,
          spinSpeed: (0.12 + random() * 0.3) * (0.4 + spec.tilt) * (random() > 0.5 ? 1 : -1),
          spinPhase: random() * TAU,
          surfacePhase: random() * TAU,
          surfaceAmp: 0.86 + random() * 0.28,
          bobPhase: random() * TAU,
          bobSpeed: (1 + Math.floor(random() * 3)) * TAU / 15,
        });
      }

      if (primitiveCount > 1) {
        const template = layoutTemplates[primitiveCount];
        const averageRadius = this.prims.reduce((sum, primitive) => sum + primitive.boundR, 0) / primitiveCount;
        const clusterScale = averageRadius * (0.92 + spec.cluster * 0.28);
        for (let i = 0; i < primitiveCount; i += 1) {
          const primitive = this.prims[i];
          const base = template[i];
          const angle = startAngle + i * GOLDEN;
          const drift = averageRadius * 0.08;
          primitive.ox = base[0] * clusterScale + Math.cos(angle) * drift * (0.6 + random() * 0.6);
          primitive.oy = base[1] * clusterScale * 0.9 + (random() - 0.5) * averageRadius * 0.16;
          primitive.oz = base[2] * clusterScale * 0.95 + Math.sin(angle) * drift * (0.5 + random() * 0.5);
        }
        for (let pass = 0; pass < 28; pass += 1) {
          let moved = false;
          for (let i = 0; i < primitiveCount; i += 1) {
            for (let j = i + 1; j < primitiveCount; j += 1) {
              const a = this.prims[i];
              const b = this.prims[j];
              let dx = b.ox - a.ox;
              let dy = b.oy - a.oy;
              let dz = b.oz - a.oz;
              let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
              const minDistance = (a.boundR + b.boundR) * collisionFactor;
              if (distance >= minDistance) continue;
              if (distance < 0.0001) {
                const angle = random() * TAU;
                dx = Math.cos(angle);
                dy = random() - 0.5;
                dz = Math.sin(angle);
                distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
              }
              const push = (minDistance - distance) / 2 / distance;
              a.ox -= dx * push; a.oy -= dy * push; a.oz -= dz * push;
              b.ox += dx * push; b.oy += dy * push; b.oz += dz * push;
              moved = true;
            }
          }
          if (!moved) break;
        }
      }

      let centerX = 0;
      let centerY = 0;
      let centerZ = 0;
      for (const primitive of this.prims) {
        centerX += primitive.ox;
        centerY += primitive.oy;
        centerZ += primitive.oz;
      }
      centerX /= primitiveCount;
      centerY /= primitiveCount;
      centerZ /= primitiveCount;
      for (const primitive of this.prims) {
        primitive.ox -= centerX;
        primitive.oy -= centerY;
        primitive.oz -= centerZ;
      }

      const fitLimit = primitiveCount > 1 ? 450 : 340;
      let extent = 0;
      for (const primitive of this.prims) {
        const distance = Math.sqrt(primitive.ox * primitive.ox + primitive.oy * primitive.oy + primitive.oz * primitive.oz) + primitive.boundR;
        if (distance > extent) extent = distance;
      }
      if (extent > fitLimit) {
        const factor = fitLimit / extent;
        for (const primitive of this.prims) {
          primitive.ox *= factor;
          primitive.oy *= factor;
          primitive.oz *= factor;
          primitive.scale *= factor;
          primitive.boundR *= factor;
        }
      }

      this.glyphSet = DEFAULT_GLYPH_SET;
      this._tiles = null;
      this._tileCell = 0;
      this._t0 = null;
      this.waveOverrideE = null;
      this.waveOverrideParity = null;
      this.floatOffset = spec.float * -52;
      this.toneBias = (1 - (spec.tone == null ? 1 : spec.tone)) * 0.09;
      this.colors = spec.palette.map(hexToRgb);
      this.rotX = 0.24 + (random() - 0.5) * 0.2;
      this.rotY = random() * TAU;
      this.velY = 0.0032;
      this.velX = 0;
      const shapeZoom = spec.shape === 'sphere' ? 1.02 : spec.shape === 'torus' ? 1.2 : spec.shape === 'cylinder' ? 1.2 : 1.16;
      this.defaultZoom = primitiveCount > 1 ? 1.22 : shapeZoom;
      this.zoom = this.defaultZoom;
      this.compositionZoom = primitiveCount > 1 ? 1.38 : spec.shape === 'sphere' ? 1 : 1.12;
      this.dragging = false;
      this._swarm = null;
    }

    resetView() {
      this.rotX = 0.28;
      this.velX = 0;
      this.velY = 0.0032;
      this.zoom = this.defaultZoom || 1.08;
    }

    resize(cssWidth, cssHeight, dprCap = 2) {
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const width = Math.max(2, Math.round(cssWidth * dpr));
      const height = Math.max(2, Math.round(cssHeight * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
    }

    drawBackground(context, width, height) {
      context.globalAlpha = 1;
      context.fillStyle = mixHex(this.spec.palette[6], '#040409', 0.68);
      context.fillRect(0, 0, width, height);
      const aura = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.62);
      aura.addColorStop(0, mixHex(this.spec.palette[4], '#000000', 0.35));
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      context.globalAlpha = 0.5;
      context.fillStyle = aura;
      context.fillRect(0, 0, width, height);
      context.globalAlpha = 1;
    }

    render(timeMs) {
      const spec = this.spec;
      if (!spec) return;
      const width = this.canvas.width;
      const height = this.canvas.height;
      if (this.pcCanvas.width !== width || this.pcCanvas.height !== height) {
        this.pcCanvas.width = width;
        this.pcCanvas.height = height;
      }
      if (this.glyphCanvas.width !== width || this.glyphCanvas.height !== height) {
        this.glyphCanvas.width = width;
        this.glyphCanvas.height = height;
      }
      const context = this.pctx;
      const glyphContext = this.gctx;
      const time = timeMs * 0.001;
      const material = spec.material;
      if (!this.dragging) {
        this.rotY += this.velY + 0.0025;
        this.rotX += this.velX;
        this.velX *= 0.96;
        this.velY *= 0.96;
      }
      context.setTransform(1, 0, 0, 1, 0, 0);
      this.drawBackground(context, width, height);
      glyphContext.setTransform(1, 0, 0, 1, 0, 0);
      glyphContext.globalAlpha = 1;
      glyphContext.fillStyle = '#000000';
      glyphContext.fillRect(0, 0, width, height);

      const scaleBasis = Math.min(width, height) / 1080;
      const centerX = width / 2;
      const centerY = height / 2 + this.floatOffset * scaleBasis * this.zoom;
      const projectionScale = 1080 * 0.00162 * scaleBasis * this.zoom * (this.compositionZoom || 1);
      const perspectiveStrength = 0.00165;
      const cosX = Math.cos(this.rotX);
      const sinX = Math.sin(this.rotX);
      const cosY = Math.cos(this.rotY);
      const sinY = Math.sin(this.rotY);
      const renderPoints = this._renderBuffer || (this._renderBuffer = []);
      renderPoints.length = 0;

      for (const primitive of this.prims) {
        const points = primitive.pts;
        const pointCount = points.length;
        const spin = primitive.spinPhase + time * primitive.spinSpeed;
        const cosSpin = Math.cos(spin);
        const sinSpin = Math.sin(spin);
        const cosTiltX = Math.cos(primitive.tiltX);
        const sinTiltX = Math.sin(primitive.tiltX);
        const cosTiltZ = Math.cos(primitive.tiltZ);
        const sinTiltZ = Math.sin(primitive.tiltZ);
        const loopPhase = time * TAU / 15;
        const surfacePhase = loopPhase * 3 + primitive.surfacePhase;
        const bob = Math.sin(time * primitive.bobSpeed + primitive.bobPhase) * this.bobAmp;

        for (let index = 0; index < pointCount; index += 1) {
          const point = points[index];
          const breath = REDUCED_MOTION ? 0.5 : 0.5 + 0.5 * Math.sin(surfacePhase);
          const motionPhase = (point.motionSeed || 0) * TAU;
          const motionPhaseB = (point.motionSeedB || 0) * TAU;
          const radius = Math.max(1, Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z));
          const normalX = point.x / radius;
          const normalY = point.y / radius;
          const normalZ = point.z / radius;
          const normalizedRadius = radius / 230;
          const shellRipple = REDUCED_MOTION ? 0 : Math.sin(surfacePhase * 1.18 - normalizedRadius * 7.4 + motionPhase * 0.28);
          const innerRipple = REDUCED_MOTION ? 0 : Math.sin(surfacePhase * 1.52 - normalizedRadius * 10.2 + motionPhaseB * 0.36);
          const surfaceMotion = shellRipple;
          const crossMotion = innerRipple;
          const waveMotion = shellRipple * 0.72 + innerRipple * 0.28;
          let tangentAX = -normalZ;
          let tangentAY = 0;
          let tangentAZ = normalX;
          let tangentLen = Math.sqrt(tangentAX * tangentAX + tangentAZ * tangentAZ);
          if (tangentLen < 0.001) {
            tangentAX = 1;
            tangentAY = 0;
            tangentAZ = 0;
            tangentLen = 1;
          }
          tangentAX /= tangentLen;
          tangentAZ /= tangentLen;
          const tangentBX = normalY * tangentAZ - normalZ * tangentAY;
          const tangentBY = normalZ * tangentAX - normalX * tangentAZ;
          const tangentBZ = normalX * tangentAY - normalY * tangentAX;
          const pulseScale = primitive.scale * (1 + waveMotion * 0.014 + Math.sin(point.f * 14 + point.phase + surfacePhase) * 0.003 + (material.jitter ? Math.sin(point.phase * 13.7 + surfacePhase) * 0.0015 * material.jitter : 0));
          const currentPulse = 0.5 + 0.5 * Math.sin(surfacePhase * 0.74 + primitive.surfacePhase);
          const drift = (3.6 + material.jitter * 0.85) * (0.78 + currentPulse * 0.22) * primitive.surfaceAmp;
          const surfaceDrift = waveMotion * (3.4 + material.jitter * 0.4);
          const slideA = (surfaceMotion * 0.22 + waveMotion * 0.12) * drift;
          const slideB = (crossMotion * 0.18 - waveMotion * 0.08) * drift;
          const pointX = (point.x + normalX * surfaceDrift + tangentAX * slideA + tangentBX * slideB) * pulseScale;
          const pointY = (point.y + normalY * surfaceDrift + tangentAY * slideA + tangentBY * slideB) * pulseScale;
          const pointZ = (point.z + normalZ * surfaceDrift + tangentAZ * slideA + tangentBZ * slideB) * pulseScale;
          const spunX = pointX * cosSpin + pointZ * sinSpin;
          const spunZ = -pointX * sinSpin + pointZ * cosSpin;
          const tiltedY = pointY * cosTiltX - spunZ * sinTiltX;
          let localZ = pointY * sinTiltX + spunZ * cosTiltX;
          let localX = spunX * cosTiltZ - tiltedY * sinTiltZ;
          let localY = spunX * sinTiltZ + tiltedY * cosTiltZ;
          localX += primitive.ox;
          localY += primitive.oy + bob;
          localZ += primitive.oz;
          const rotatedX = localX * cosY + localZ * sinY;
          const rotatedZ = -localX * sinY + localZ * cosY;
          const rotatedY = localY * cosX - rotatedZ * sinX;
          const depthZ = localY * sinX + rotatedZ * cosX;
          const perspective = 1 / (1 + depthZ * perspectiveStrength);
          const screenX = centerX + rotatedX * projectionScale * perspective;
          const screenY = centerY + rotatedY * projectionScale * perspective;
          const depth = Math.max(0, Math.min(1, 0.5 - depthZ / 1200));
          const surfaceLift = 0.04 + 0.05 * Math.sin(normalizedRadius * 6.5 - surfacePhase + primitive.spinPhase);
          const glow = (surfaceLift + breath * 0.018 + Math.max(0, waveMotion) * 0.026) * Math.min(1, material.glowMul);
          const paletteBand = point.colorSeed == null ? hashUnit(index, 17) : point.colorSeed;
          const paletteSpread = 0.22 * Math.sin(motionPhaseB * 2.3 + primitive.spinPhase + surfacePhase * 0.16);
          const sizeSeed = point.sizeSeed == null ? hashUnit(index, 43) : point.sizeSeed;
          const localPulse = REDUCED_MOTION ? 0.5 : 0.5 + 0.5 * waveMotion;
          const sizeVariance = 0.72 + Math.pow(sizeSeed, 1.55) * 0.54;
          const pointSize = (1.38 + depth * 0.34 + glow * 0.2 + localPulse * 0.42) * sizeVariance * material.sizeMul * scaleBasis * this.zoom;
          const maxSize = (2.25 + scaleBasis * 0.7) * this.zoom;
          renderPoints.push({
            x: screenX,
            y: screenY,
            z: depthZ,
            b: clamp01(0.08 + depth * 0.035 + paletteBand * 0.68 + glow * 0.04 + paletteSpread),
            alpha: Math.min(0.86, (0.54 + depth * 0.05 + localPulse * 0.08 + glow * 0.03) * material.alphaMul),
            size: Math.max(0.8, Math.min(maxSize, pointSize)),
          });
        }
      }

      if (material.swarm && !REDUCED_MOTION) {
        const swarm = this._swarm || (this._swarm = Array.from({ length: material.swarm }, (_, index) => ({
          a: seededFraction(`${spec.seed}:sa${index}`) * TAU,
          r: 190 + seededFraction(`${spec.seed}:sr${index}`) * 210,
          yy: (seededFraction(`${spec.seed}:sy${index}`) - 0.5) * 380,
          sp: 0.05 + seededFraction(`${spec.seed}:ss${index}`) * 0.1,
          ph: seededFraction(`${spec.seed}:sp${index}`) * TAU,
        })));
        for (const particle of swarm) {
          const angle = particle.a + time * particle.sp;
          const localX = Math.cos(angle) * particle.r;
          const localZ = Math.sin(angle) * particle.r;
          const localY = particle.yy + Math.sin(time * 0.4 + particle.ph) * 26;
          const rotatedX = localX * cosY + localZ * sinY;
          const rotatedZ = -localX * sinY + localZ * cosY;
          const rotatedY = localY * cosX - rotatedZ * sinX;
          const depthZ = localY * sinX + rotatedZ * cosX;
          const perspective = 1 / (1 + depthZ * perspectiveStrength);
          renderPoints.push({ x: centerX + rotatedX * projectionScale * perspective, y: centerY + rotatedY * projectionScale * perspective, z: depthZ, b: 0.35, alpha: 0.35, size: Math.max(0.3, 0.8 * scaleBasis * this.zoom) });
        }
      }

      renderPoints.sort((a, b) => b.z - a.z);
      for (const point of renderPoints) {
        const colorIndex = 6 - Math.min(6, Math.floor(clamp01(point.b + (this.toneBias || 0)) * 6.999));
        const color = this.colors[colorIndex];
        context.globalAlpha = point.alpha;
        context.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
        context.beginPath();
        context.arc(point.x, point.y, point.size, 0, TAU);
        context.fill();
        glyphContext.globalAlpha = point.alpha;
        glyphContext.fillStyle = '#ffffff';
        glyphContext.beginPath();
        glyphContext.arc(point.x, point.y, Math.max(0.75, point.size * 0.74), 0, TAU);
        glyphContext.fill();
      }
      context.globalAlpha = 1;
      glyphContext.globalAlpha = 1;
      this.composite(timeMs);
    }

    composite(timeMs) {
      const context = this.ctx;
      const width = this.canvas.width;
      const height = this.canvas.height;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;
      context.drawImage(this.pcCanvas, 0, 0);

      let fraction;
      let parity;
      if (this.waveOverrideE != null) {
        parity = this.waveOverrideParity || 0;
        fraction = this.waveOverrideE;
      } else {
        if (this._t0 == null) this._t0 = timeMs;
        const elapsed = (timeMs - this._t0) * 0.001;
        const phase = (elapsed / 7.5) % 2;
        parity = phase < 1 ? 0 : 1;
        const local = phase - parity;
        fraction = 0.5 - 0.5 * Math.cos(local * Math.PI);
      }
      this.currentE = parity === 0 ? fraction : 1 - fraction;
      if (parity === 0 && fraction < 0.004) return;
      if (parity === 1 && fraction > 0.996) return;

      const isPortrait = height > width * 1.12;
      const targetCell = isPortrait ? 30 : 18;
      const maxColumns = isPortrait ? 42 : 82;
      const columns = Math.max(20, Math.min(maxColumns, Math.round(width / targetCell)));
      const cellWidth = width / columns;
      const rows = Math.max(1, Math.round(height / cellWidth));
      const cellHeight = height / rows;
      const tileSize = Math.ceil(cellWidth);
      if (!this._tiles || this._tileCell !== tileSize) this.buildTiles(tileSize);
      if (!this._tiles) return;

      const band = width * 0.12;
      const overshoot = (band / 2 + cellWidth) / width;
      const edgeProgress = fraction * (1 + 2 * overshoot) - overshoot;
      const edgeAt = () => width * edgeProgress;
      const smooth = value => value <= 0 ? 0 : value >= 1 ? 1 : value * value * (3 - 2 * value);

      this.bufCanvas.width = columns;
      this.bufCanvas.height = rows;
      this.bctx.drawImage(this.glyphCanvas, 0, 0, columns, rows);
      const pixels = this.bctx.getImageData(0, 0, columns, rows).data;
      const backgroundFill = mixHex(this.spec.palette[6], '#040409', 0.68);
      const maxEdge = width * edgeProgress + band / 2 + cellWidth;

      for (let row = 0; row < rows; row += 1) {
        const y = row * cellHeight;
        const rowEdge = edgeAt(y + cellHeight / 2);
        for (let column = 0; column < columns; column += 1) {
          const x = column * cellWidth;
          if (parity === 0 && x > maxEdge) break;
          const relative = (rowEdge - (x + cellWidth / 2)) / band;
          const blend = smooth((parity === 0 ? relative : -relative) + 0.5);
          if (blend < 0.02) continue;
          const pixelIndex = (row * columns + column) * 4;
          const brightness = (pixels[pixelIndex] + pixels[pixelIndex + 1] + pixels[pixelIndex + 2]) / 3;
          const lifted = Math.min(255, brightness * 1.18);
          const stateIndex = 6 - Math.min(6, Math.floor(Math.pow(lifted / 255, 0.78) * 7));
          context.globalAlpha = blend * 0.9;
          context.fillStyle = backgroundFill;
          context.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);
          context.globalAlpha = blend * Math.min(0.92, 0.34 + brightness / 255 * 0.76);
          const glyphScale = (isPortrait ? 0.72 : 0.64) + 0.16 * blend;
          const glyphWidth = cellWidth * glyphScale;
          const glyphHeight = cellHeight * glyphScale;
          context.drawImage(this._tiles[stateIndex], x + (cellWidth - glyphWidth) / 2, y + (cellHeight - glyphHeight) / 2, glyphWidth, glyphHeight);
        }
      }
      context.globalAlpha = 1;
    }

    buildTiles(cellSize) {
      const glyphSet = this.glyphSet || DEFAULT_GLYPH_SET;
      if (!glyphSet.every(id => GLYPH_IMAGES[id].complete && GLYPH_IMAGES[id].naturalWidth > 0)) return;
      this._tiles = glyphSet.map((id, index) => {
        const tile = document.createElement('canvas');
        tile.width = cellSize;
        tile.height = cellSize;
        const context = tile.getContext('2d');
        context.drawImage(GLYPH_IMAGES[id], 0, 0, cellSize, cellSize);
        context.globalCompositeOperation = 'source-in';
        context.fillStyle = this.spec.palette[index];
        context.fillRect(0, 0, cellSize, cellSize);
        return tile;
      });
      this._tileCell = cellSize;
    }
  }

  function attachInteraction(renderer, element) {
    let last = { x: 0, y: 0 };
    let pinchDistance = 0;
    let lastTap = 0;
    const begin = (x, y) => { renderer.dragging = true; last = { x, y }; };
    const move = (x, y) => {
      if (!renderer.dragging) return;
      const dx = x - last.x;
      const dy = y - last.y;
      last = { x, y };
      renderer.rotY += dx * 0.006;
      renderer.rotX += dy * 0.006;
      renderer.velY = dx * 0.0006;
      renderer.velX = dy * 0.0006;
    };
    const end = () => { renderer.dragging = false; };

    element.addEventListener('mousedown', event => {
      event.preventDefault();
      begin(event.clientX, event.clientY);
    });
    window.addEventListener('mousemove', event => move(event.clientX, event.clientY));
    window.addEventListener('mouseup', end);
    element.addEventListener('dblclick', () => renderer.resetView());
    element.addEventListener('wheel', event => {
      event.preventDefault();
      renderer.zoom *= event.deltaY < 0 ? 1.07 : 1 / 1.07;
      renderer.zoom = Math.max(0.4, Math.min(3.2, renderer.zoom));
    }, { passive: false });
    element.addEventListener('touchstart', event => {
      if (event.touches.length === 1) {
        const now = Date.now();
        if (now - lastTap < 320) renderer.resetView();
        lastTap = now;
        begin(event.touches[0].clientX, event.touches[0].clientY);
      } else if (event.touches.length === 2) {
        renderer.dragging = false;
        pinchDistance = Math.hypot(event.touches[1].clientX - event.touches[0].clientX, event.touches[1].clientY - event.touches[0].clientY);
      }
    }, { passive: true });
    element.addEventListener('touchmove', event => {
      event.preventDefault();
      if (event.touches.length === 1) {
        move(event.touches[0].clientX, event.touches[0].clientY);
      } else if (event.touches.length === 2) {
        const nextDistance = Math.hypot(event.touches[1].clientX - event.touches[0].clientX, event.touches[1].clientY - event.touches[0].clientY);
        if (pinchDistance > 0) renderer.zoom = Math.max(0.4, Math.min(3.2, renderer.zoom * nextDistance / pinchDistance));
        pinchDistance = nextDistance;
      }
    }, { passive: false });
    element.addEventListener('touchend', () => {
      renderer.dragging = false;
      pinchDistance = 0;
    });
  }

  function renderOpeningFrame(item, width, height, budget = 8000) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const renderer = new DreamRenderer(canvas, { budget });
    renderer.setItem(item);
    renderer.waveOverrideE = 0;
    renderer.render(0);
    return canvas;
  }

  window.DreamPointcloudEngine = {
    DreamRenderer,
    attachInteraction,
    renderOpeningFrame,
    specForItem,
  };
})();
