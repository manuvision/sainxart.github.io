import * as THREE from './vendor/three.module.js';

const PALETTES = {
  apricot: { shell: '#e1a06c', back: '#bd845b', button: '#718867', print: '#996d48' },
  sage: { shell: '#99b795', back: '#718c71', button: '#d9b681', print: '#587854' },
  lilac: { shell: '#ae99c4', back: '#867098', button: '#dfb683', print: '#78608f' },
};

function roundedRect(width, height, radius) {
  const s = new THREE.Shape(), x = -width / 2, y = -height / 2;
  s.moveTo(x + radius, y); s.lineTo(x + width - radius, y);
  s.quadraticCurveTo(x + width, y, x + width, y + radius);
  s.lineTo(x + width, y + height - radius);
  s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  s.lineTo(x + radius, y + height); s.quadraticCurveTo(x, y + height, x, y + height - radius);
  s.lineTo(x, y + radius); s.quadraticCurveTo(x, y, x + radius, y);
  return s;
}

function eggShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 2.43);
  s.bezierCurveTo(1.13, 2.43, 1.9, 1.0, 1.98, -.35);
  s.bezierCurveTo(2.1, -1.82, 1.26, -2.55, 0, -2.55);
  s.bezierCurveTo(-1.26, -2.55, -2.1, -1.82, -1.98, -.35);
  s.bezierCurveTo(-1.9, 1.0, -1.13, 2.43, 0, 2.43);
  return s;
}

function canvasTexture(canvas, pixel = false) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (pixel) { texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false; }
  return texture;
}

export class PocketDevice {
  constructor(stage, lcdCanvas) {
    this.stage = stage;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.pointer = { x: 0, y: 0 };
    this.buttons = {};
    this.pressedUntil = {};
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, .1, 50);
    this.camera.position.set(0, .1, 12.5);
    this.camera.lookAt(0, .05, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .95;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    stage.prepend(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight('#fff9e9', '#7e8272', 1.4));
    const key = new THREE.DirectionalLight('#fff7e3', 2.4); key.position.set(-3, 6, 9); this.scene.add(key);
    const fill = new THREE.DirectionalLight('#eef5ff', .6); fill.position.set(4, 1, 4); this.scene.add(fill);
    const rim = new THREE.DirectionalLight('#fff8e9', .8); rim.position.set(-3, 0, -4); this.scene.add(rim);
    // A small studio reflection map gives the molded plastic and metal real highlights.
    const envCanvas = document.createElement('canvas'); envCanvas.width = 512; envCanvas.height = 256;
    const e = envCanvas.getContext('2d'); const eg = e.createLinearGradient(0, 0, 0, 256);
    eg.addColorStop(0, '#eff1e9'); eg.addColorStop(.48, '#8f9487'); eg.addColorStop(1, '#444a3e');
    e.fillStyle = eg; e.fillRect(0, 0, 512, 256); e.fillStyle = '#fffef9'; e.fillRect(75, 20, 58, 142); e.fillStyle = '#e2e9ed'; e.fillRect(355, 25, 90, 100);
    const env = canvasTexture(envCanvas); env.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = pmrem.fromEquirectangular(env); this.scene.environment = this.envTarget.texture;
    env.dispose(); pmrem.dispose();

    this.group = new THREE.Group(); this.scene.add(this.group);
    this.shellMaterial = new THREE.MeshPhysicalMaterial({ color: PALETTES.apricot.shell, roughness: .34, metalness: .02, clearcoat: .55, clearcoatRoughness: .27, envMapIntensity: .4 });
    this.backMaterial = new THREE.MeshStandardMaterial({ color: PALETTES.apricot.back, roughness: .43 });
    this.buttonMaterial = new THREE.MeshPhysicalMaterial({ color: PALETTES.apricot.button, roughness: .38, clearcoat: .45, clearcoatRoughness: .35, envMapIntensity: .35 });
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(eggShape(), { steps: 1, depth: .38, bevelEnabled: true, bevelThickness: .22, bevelSize: .17, bevelSegments: 9, curveSegments: 64 }), this.shellMaterial);
    this.group.add(body);
    const back = new THREE.Mesh(new THREE.ExtrudeGeometry(eggShape(), { steps: 1, depth: .1, bevelEnabled: true, bevelThickness: .16, bevelSize: .165, bevelSegments: 6, curveSegments: 64 }), this.backMaterial);
    back.position.z = -.22; this.group.add(back);
    // Hairline between the two halves of the enclosure.
    const seam = new THREE.Line(new THREE.BufferGeometry().setFromPoints(eggShape().getPoints(140).map(v => new THREE.Vector3(v.x * 1.075, v.y * 1.059, -.09))), new THREE.LineBasicMaterial({ color: '#84674a', transparent: true, opacity: .23 }));
    this.group.add(seam);

    const bezelMat = new THREE.MeshStandardMaterial({ color: '#c4b28e', roughness: .68, metalness: .05 });
    const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(2.83, 2.66, .27), { depth: .055, bevelEnabled: true, bevelThickness: .075, bevelSize: .085, bevelSegments: 5, curveSegments: 20 }), bezelMat);
    bezel.position.set(0, .22, .61); this.group.add(bezel);
    const inner = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(2.54, 2.33, .13), 24), new THREE.MeshBasicMaterial({ color: '#586245' }));
    inner.position.set(0, .22, .748); this.group.add(inner);
    // Render LCD pixels into a 3x texture, leaving a hairline gap around every dot.
    this.lcdSource = lcdCanvas;
    this.dotCanvas = document.createElement('canvas'); this.dotCanvas.width = lcdCanvas.width * 3; this.dotCanvas.height = lcdCanvas.height * 3;
    this.dotContext = this.dotCanvas.getContext('2d');
    this.screenTexture = canvasTexture(this.dotCanvas, true);
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(2.40, 2.16), new THREE.MeshBasicMaterial({ map: this.screenTexture, toneMapped: false }));
    lcd.position.set(0, .23, .756); this.group.add(lcd);
    const glassCanvas = document.createElement('canvas'); glassCanvas.width = 256; glassCanvas.height = 256;
    const g = glassCanvas.getContext('2d'); const sheen = g.createLinearGradient(0, 0, 256, 256);
    sheen.addColorStop(0, '#ffffee22'); sheen.addColorStop(.4, '#ffffee00'); sheen.addColorStop(1, '#12220810'); g.fillStyle = sheen; g.fillRect(0, 0, 256, 256);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.40, 2.16), new THREE.MeshBasicMaterial({ map: canvasTexture(glassCanvas), transparent: true, depthWrite: false, toneMapped: false }));
    glass.position.set(0, .23, .759); this.group.add(glass);

    ['a', 'b', 'c'].forEach((key, i) => {
      const x = (i - 1) * .84, y = i === 1 ? -1.56 : -1.43;
      const socket = new THREE.Mesh(new THREE.SphereGeometry(.26, 36, 18), new THREE.MeshStandardMaterial({ color: '#9b7958', roughness: .7 }));
      socket.scale.z = .2; socket.position.set(x, y, .62); this.group.add(socket);
      const button = new THREE.Mesh(new THREE.SphereGeometry(.224, 40, 24), this.buttonMaterial);
      button.scale.z = .60; button.position.set(x, y, .72); this.group.add(button); this.buttons[key] = button;
    });

    this.printCanvas = document.createElement('canvas'); this.printCanvas.width = 768; this.printCanvas.height = 1024;
    this.printTexture = canvasTexture(this.printCanvas);
    const print = new THREE.Mesh(new THREE.PlaneGeometry(3.96, 5.28), new THREE.MeshBasicMaterial({ map: this.printTexture, transparent: true, depthWrite: false, toneMapped: false }));
    print.position.set(0, -.07, .616); this.group.add(print);
    this.drawPrint(PALETTES.apricot.print);
    // Tiny speaker perforations, sunk into the plastic.
    const speaker = new THREE.MeshStandardMaterial({ color: '#926e51', roughness: .9 });
    for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(.025, 12), speaker); hole.position.set((col - 2) * .1, -2.22 - row * .08, .605); this.group.add(hole);
    }
    const metal = new THREE.MeshStandardMaterial({ color: '#c0c3b7', metalness: .95, roughness: .21, envMapIntensity: 1.2 });
    const mount = new THREE.Mesh(new THREE.TorusGeometry(.13, .05, 14, 40), this.backMaterial); mount.position.set(1.02, 2.13, .06); this.group.add(mount);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.29, .037, 16, 60), metal); ring.position.set(1.23, 2.39, .02); ring.rotation.y = -.4; this.group.add(ring);
    const link = new THREE.Mesh(new THREE.TorusGeometry(.12, .026, 12, 32), metal); link.position.set(1.48, 2.57, .04); link.rotation.y = .8; this.group.add(link);
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
    const sc = shadowCanvas.getContext('2d'), sg = sc.createRadialGradient(64, 64, 4, 64, 64, 64);
    sg.addColorStop(0, '#51483146'); sg.addColorStop(.5, '#51483122'); sg.addColorStop(1, '#51483100'); sc.fillStyle = sg; sc.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 1.4), new THREE.MeshBasicMaterial({ map: canvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
    shadow.position.set(.18, -2.78, -1); this.scene.add(shadow);
    stage.addEventListener('pointermove', event => { const r = stage.getBoundingClientRect(); this.pointer.x = (event.clientX - r.left) / r.width * 2 - 1; this.pointer.y = (event.clientY - r.top) / r.height * 2 - 1; });
    stage.addEventListener('pointerleave', () => { this.pointer.x = 0; this.pointer.y = 0; });
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(stage); this.resize();
  }

  drawPrint(color) {
    const c = this.printCanvas.getContext('2d'); c.clearRect(0, 0, 768, 1024); c.fillStyle = color; c.textAlign = 'center';
    c.font = 'bold 53px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif'; c.fillText('tamagochi', 384, 150);
    c.globalAlpha = .70; c.font = '14px monospace'; c.fillText('L I T T L E   L I F E', 384, 177);
    c.globalAlpha = .85; c.font = 'bold 22px monospace';
    ['A', 'B', 'C'].forEach((label, i) => c.fillText(label, 384 + (i - 1) * 163, i === 1 ? 880 : 857));
    c.globalAlpha = 1; this.printTexture.needsUpdate = true;
  }

  setColor(name) { const palette = PALETTES[name] || PALETTES.apricot; this.shellMaterial.color.set(palette.shell); this.backMaterial.color.set(palette.back); this.buttonMaterial.color.set(palette.button); this.drawPrint(palette.print); }
  press(key) { this.pressedUntil[key] = performance.now() + 150; }
  resize() {
    const { width, height } = this.stage.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height); this.camera.aspect = width / height;
    const vertical = 6.35, horizontal = 4.8;
    this.camera.position.z = Math.max(vertical, horizontal / this.camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(16)));
    this.camera.updateProjectionMatrix(); this.width = width; this.height = height;
  }
  update(time) {
    if (!this.reducedMotion) {
      this.group.rotation.x += ((-.035 + this.pointer.y * .04) - this.group.rotation.x) * .07;
      this.group.rotation.y += ((-.13 + this.pointer.x * .14) - this.group.rotation.y) * .07;
      this.group.rotation.z = -.045 + Math.sin(time * .4) * .007;
      this.group.position.y = Math.sin(time * .8) * .027;
    } else { this.group.rotation.set(-.035, -.09, -.025); }
    const context = this.dotContext;
    context.imageSmoothingEnabled = false; context.drawImage(this.lcdSource, 0, 0, this.dotCanvas.width, this.dotCanvas.height);
    context.fillStyle = '#bdd08b'; context.globalAlpha = .16;
    for (let x = 0; x < this.dotCanvas.width; x += 3) context.fillRect(x, 0, 1, this.dotCanvas.height);
    for (let y = 0; y < this.dotCanvas.height; y += 3) context.fillRect(0, y, this.dotCanvas.width, 1);
    context.globalAlpha = 1; this.screenTexture.needsUpdate = true;
    for (const key of ['a', 'b', 'c']) this.buttons[key].position.z += (((this.pressedUntil[key] || 0) > performance.now() ? .65 : .72) - this.buttons[key].position.z) * .5;
    this.group.updateMatrixWorld(true);
    for (const key of ['a', 'b', 'c']) {
      const projected = this.buttons[key].getWorldPosition(new THREE.Vector3()).project(this.camera);
      const element = document.getElementById(`button-${key}`);
      element.style.left = `${(projected.x * .5 + .5) * this.width}px`; element.style.top = `${(-projected.y * .5 + .5) * this.height}px`;
      const size = Math.max(44, this.height * .081); element.style.width = `${size}px`; element.style.height = `${size}px`;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
