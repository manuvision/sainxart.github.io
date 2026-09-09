/**
 * Quiet, nonfunctional symbolic sculptures for mò.
 * No external assets. Both objects are centred around the origin, facing +Z.
 * Pass the same THREE namespace used by the host scene.
 */
export function createSculptures(THREE) {
  const graphite = new THREE.MeshStandardMaterial({color: 0x34363a, metalness: .86, roughness: .29});
  const bevelMetal = new THREE.MeshStandardMaterial({color: 0x5d6167, metalness: .93, roughness: .24});
  const satin = new THREE.MeshStandardMaterial({color: 0x777d83, metalness: .94, roughness: .25});
  const chrome = new THREE.MeshStandardMaterial({color: 0xbfc6cd, metalness: .98, roughness: .17});
  const inset = new THREE.MeshStandardMaterial({color: 0x16191c, metalness: .5, roughness: .38});
  const gripMaterial = new THREE.MeshStandardMaterial({color: 0x202328, metalness: .17, roughness: .49});
  const rubber = new THREE.MeshStandardMaterial({color: 0x191b1f, metalness: .05, roughness: .64});
  const treadMaterial = new THREE.MeshStandardMaterial({color: 0x202227, metalness: .04, roughness: .56});

  function extrude(shape, depth, bevel = .025, segments = 4, material = graphite) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: bevel > 0, bevelSegments: segments,
      steps: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: 12,
    });
    geometry.translate(0, 0, -depth / 2);
    return new THREE.Mesh(geometry, material);
  }

  function roundedRect(x, y, width, height, radius) {
    const s = new THREE.Shape();
    s.moveTo(x + radius, y);
    s.lineTo(x + width - radius, y);
    s.quadraticCurveTo(x + width, y, x + width, y + radius);
    s.lineTo(x + width, y + height - radius);
    s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    s.lineTo(x + radius, y + height);
    s.quadraticCurveTo(x, y + height, x, y + height - radius);
    s.lineTo(x, y + radius);
    s.quadraticCurveTo(x, y, x + radius, y);
    s.closePath();
    return s;
  }

  function lathe(profile, material, radialSegments = 96) {
    const g = new THREE.LatheGeometry(profile.map(([radius, z]) => new THREE.Vector2(radius, z)), radialSegments);
    g.rotateX(Math.PI / 2);
    return new THREE.Mesh(g, material);
  }

  function axialCylinder(radius, depth, material, segments = 64) {
    const g = new THREE.CylinderGeometry(radius, radius, depth, segments);
    g.rotateX(Math.PI / 2);
    return new THREE.Mesh(g, material);
  }

  const gun = new THREE.Group();
  gun.name = 'Homicides — symbolic, nonfunctional sculpture';
  gun.userData.decorative = true;

  // A continuous rounded silhouette; all surfaces and the muzzle are sealed.
  const slide = extrude(roundedRect(-1.14, .29, 2.21, .36, .075), .32, .038, 5, [graphite, bevelMetal]);
  gun.add(slide);

  const frame = new THREE.Shape();
  frame.moveTo(-1.04, .24);
  frame.quadraticCurveTo(-1.10, .21, -1.06, .12);
  frame.lineTo(-.24, .09);
  frame.quadraticCurveTo(-.11, .04, -.04, -.05);
  frame.lineTo(.19, -.13);
  frame.quadraticCurveTo(.31, -.16, .40, -.32);
  frame.lineTo(.27, -.89);
  frame.quadraticCurveTo(.26, -.98, .39, -.99);
  frame.lineTo(.94, -.99);
  frame.quadraticCurveTo(1.02, -.99, .98, -.87);
  frame.lineTo(.83, -.22);
  frame.quadraticCurveTo(.79, .04, 1.02, .14);
  frame.lineTo(1.03, .24);
  frame.closePath();
  gun.add(extrude(frame, .27, .038, 5, [graphite, bevelMetal]));

  // A sculpted guard ring supplies the familiar silhouette, without a trigger.
  const guard = roundedRect(-.25, -.35, .86, .56, .16);
  const guardHole = new THREE.Path();
  guardHole.moveTo(-.075, -.24);
  guardHole.lineTo(.38, -.24);
  guardHole.quadraticCurveTo(.47, -.24, .47, -.135);
  guardHole.lineTo(.47, .055);
  guardHole.lineTo(-.10, .055);
  guardHole.lineTo(-.10, -.15);
  guardHole.quadraticCurveTo(-.10, -.24, -.075, -.24);
  guardHole.closePath();
  guard.holes.push(guardHole);
  gun.add(extrude(guard, .16, .025, 4, [graphite, bevelMetal]));

  const gripShape = new THREE.Shape();
  gripShape.moveTo(.49, -.21);
  gripShape.quadraticCurveTo(.52, -.17, .65, -.21);
  gripShape.lineTo(.84, -.80);
  gripShape.quadraticCurveTo(.86, -.87, .78, -.88);
  gripShape.lineTo(.44, -.88);
  gripShape.quadraticCurveTo(.38, -.88, .40, -.79);
  gripShape.lineTo(.49, -.21);
  for (const side of [-1, 1]) {
    const panel = extrude(gripShape, .012, .019, 4, gripMaterial);
    panel.position.z = side * .167;
    gun.add(panel);
  }

  // Shallow satin accents, rather than operational details or moving parts.
  const lineGeometry = new THREE.BoxGeometry(1.79, .009, .005);
  for (const side of [-1, 1]) {
    const line = new THREE.Mesh(lineGeometry, satin);
    line.position.set(-.035, .345, side * .198);
    gun.add(line);
  }
  const grooveGeometry = new THREE.BoxGeometry(.012, .193, .004);
  const grooves = new THREE.InstancedMesh(grooveGeometry, inset, 16);
  const placement = new THREE.Object3D();
  let grooveIndex = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      placement.position.set(.57 + i * .046, .484, side * .20);
      placement.rotation.set(0, 0, -.1);
      placement.updateMatrix();
      grooves.setMatrixAt(grooveIndex++, placement.matrix);
    }
  }
  gun.add(grooves);

  const gripLineGeometry = new THREE.BoxGeometry(.285, .006, .003);
  const gripLines = new THREE.InstancedMesh(gripLineGeometry, inset, 18);
  let gripIndex = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      placement.position.set(.605 + i * .003, -.38 - i * .045, side * .194);
      placement.rotation.set(0, 0, -.04);
      placement.updateMatrix();
      gripLines.setMatrixAt(gripIndex++, placement.matrix);
    }
  }
  gun.add(gripLines);
  const gripBase = extrude(roundedRect(.30, -1.02, .72, .07, .032), .31, .015, 3, satin);
  gun.add(gripBase);
  const sight = extrude(roundedRect(-.97, .675, .10, .045, .018), .11, .008, 2, graphite);
  gun.add(sight);
  // Centre the silhouette for predictable pointer rotation in the host scene.
  for (const child of gun.children) child.position.y += .14;

  const wheel = new THREE.Group();
  wheel.name = 'Road deaths — wheel sculpture';
  wheel.userData.decorative = true;

  // Rounded shoulder and sidewall, revolved as a single smooth rubber shell.
  wheel.add(lathe([
    [.735,-.205],[.747,-.235],[.78,-.256],[.83,-.268],
    [.895,-.263],[.946,-.244],[.985,-.213],[1.018,-.17],
    [1.038,-.12],[1.048,-.065],[1.052,0],[1.048,.065],
    [1.038,.12],[1.018,.17],[.985,.213],[.946,.244],
    [.895,.263],[.83,.268],[.78,.256],[.747,.235],[.735,.205],
    [.735,-.205],
  ], rubber, 112));

  // Tyre tread is one instanced draw call. Small breaks catch soft studio light.
  const treadGeometry = new THREE.BoxGeometry(.040, .008, .083);
  const treadCount = 76 * 4;
  const tread = new THREE.InstancedMesh(treadGeometry, treadMaterial, treadCount);
  let treadIndex = 0;
  const radialRotation = new THREE.Quaternion();
  const slantRotation = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const yAxis = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 76; i++) {
    for (let lane = 0; lane < 4; lane++) {
      const angle = (i + (lane % 2) * .45) / 76 * Math.PI * 2;
      const z = (lane - 1.5) * .077;
      const radius = Math.abs(z) > .09 ? 1.035 : 1.049;
      placement.position.set(-Math.sin(angle) * radius, Math.cos(angle) * radius, z);
      radialRotation.setFromAxisAngle(zAxis, angle);
      slantRotation.setFromAxisAngle(yAxis, lane < 2 ? -.36 : .36);
      placement.quaternion.copy(radialRotation).multiply(slantRotation);
      placement.updateMatrix();
      tread.setMatrixAt(treadIndex++, placement.matrix);
    }
  }
  wheel.add(tread);

  wheel.add(lathe([
    [.724,-.228],[.752,-.225],[.772,-.205],[.782,-.18],
    [.782,.18],[.772,.213],[.757,.237],[.731,.247],
    [.708,.238],[.700,.218],[.709,.194],[.713,.165],
    [.713,-.18],[.709,-.21],[.724,-.228],
  ], satin, 112));

  // Polished concentric bead highlights define the circular silhouette.
  for (const side of [-1, 1]) {
    const bead = new THREE.Mesh(new THREE.TorusGeometry(.745, .0105, 8, 112), chrome);
    bead.position.z = side * .237;
    wheel.add(bead);
    const sidewallRing = new THREE.Mesh(new THREE.TorusGeometry(.872, .0025, 5, 112), rubber);
    sidewallRing.position.z = side * .269;
    wheel.add(sidewallRing);
  }

  const dish = axialCylinder(.666, .024, inset, 96);
  dish.position.z = -.065;
  wheel.add(dish);
  const disc = axialCylinder(.565, .022, graphite, 96);
  disc.position.z = -.022;
  wheel.add(disc);

  // Five gently forked spokes with bevels, not flat rectangles.
  const spokeShape = new THREE.Shape();
  spokeShape.moveTo(-.073, .12);
  spokeShape.quadraticCurveTo(-.077, .31, -.102, .41);
  spokeShape.quadraticCurveTo(-.16, .54, -.218, .642);
  spokeShape.quadraticCurveTo(-.232, .68, -.196, .702);
  spokeShape.lineTo(-.143, .708);
  spokeShape.quadraticCurveTo(-.061, .593, 0, .493);
  spokeShape.quadraticCurveTo(.061, .593, .143, .708);
  spokeShape.lineTo(.196, .702);
  spokeShape.quadraticCurveTo(.232, .68, .218, .642);
  spokeShape.quadraticCurveTo(.16, .54, .102, .41);
  spokeShape.quadraticCurveTo(.077, .31, .073, .12);
  spokeShape.closePath();
  const spokeTemplate = extrude(spokeShape, .070, .018, 4, [satin, chrome]);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(spokeTemplate.geometry, spokeTemplate.material);
    spoke.rotation.z = i / 5 * Math.PI * 2;
    spoke.position.z = .147;
    wheel.add(spoke);
  }
  const hub = axialCylinder(.219, .103, satin);
  hub.position.z = .149;
  wheel.add(hub);
  const centreRing = new THREE.Mesh(new THREE.TorusGeometry(.139, .010, 8, 64), chrome);
  centreRing.position.z = .213;
  wheel.add(centreRing);
  const cap = axialCylinder(.128, .023, graphite);
  cap.position.z = .209;
  wheel.add(cap);
  const capInset = axialCylinder(.100, .004, satin);
  capInset.position.z = .224;
  wheel.add(capInset);
  const lugGeometry = new THREE.CylinderGeometry(.022, .022, .023, 12);
  lugGeometry.rotateX(Math.PI / 2);
  const lugs = new THREE.InstancedMesh(lugGeometry, chrome, 5);
  for (let i = 0; i < 5; i++) {
    const angle = (i + .5) / 5 * Math.PI * 2;
    placement.position.set(Math.sin(angle) * .178, Math.cos(angle) * .178, .210);
    placement.rotation.set(0, 0, angle);
    placement.updateMatrix();
    lugs.setMatrixAt(i, placement.matrix);
  }
  wheel.add(lugs);

  return {gun, wheel};
}
