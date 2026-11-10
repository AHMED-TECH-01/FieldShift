import * as THREE from 'three';

export interface SatelliteOptions {
  orbitRadiusX?: number; // Semi-major axis (e.g. 2.45)
  orbitRadiusY?: number; // Semi-minor axis (e.g. 2.22)
  speed?: number;
  inPlaneTilt?: number;  // In-plane tilt angle alpha (e.g. 0.45 rad ≈ 26°)
  zOffset?: number;      // Camera-facing forward depth offset (e.g. 0.55)
  zAmp?: number;         // Depth wave amplitude (e.g. 0.32)
}

/**
 * Creates a high-fidelity NASA satellite model (SMAP / GPM inspired)
 * with a camera-facing, 100% visible 360-degree orbit.
 *
 * Guarantees:
 * 1. Z > 0 everywhere -> Satellite is always in the visible foreground, never occluded by Earth.
 * 2. Min screen radius (2.22) > Atmosphere radius (1.75) -> Never intersects Earth or atmosphere.
 * 3. Max screen radius (2.45) + wingspan < Frustum limit (3.08) -> Zero canvas edge clipping.
 */
export function createSatelliteGroup(options: SatelliteOptions = {}): {
  group: THREE.Group;
  update: (elapsed: number) => void;
  dispose: () => void;
  getPositionAtAngle: (theta: number) => THREE.Vector3;
} {
  const {
    orbitRadiusX = 2.45,
    orbitRadiusY = 2.22,
    speed = 0.52,
    inPlaneTilt = 0.45,
    zOffset = 0.55,
    zAmp = 0.32,
  } = options;

  const group = new THREE.Group();

  // Internal body group containing satellite mesh components
  const satBody = new THREE.Group();
  group.add(satBody);

  // 1. Satellite Core Cylinder Chassis (along local Z axis)
  const coreGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.26, 16);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xdfebec,
    metalness: 0.85,
    roughness: 0.22,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.rotation.x = Math.PI / 2;
  satBody.add(coreMesh);

  // 1b. Gold Thermal Foil Wrap Segment
  const foilGeo = new THREE.CylinderGeometry(0.079, 0.079, 0.11, 16);
  const foilMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, // Rich satellite gold foil
    metalness: 0.9,
    roughness: 0.28,
  });
  const foilMesh = new THREE.Mesh(foilGeo, foilMat);
  foilMesh.rotation.x = Math.PI / 2;
  satBody.add(foilMesh);

  // 2. Solar Arrays (Left and Right Photovoltaic Wings along local X)
  const panelGeo = new THREE.BoxGeometry(0.38, 0.14, 0.015);
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x0c2548, // Deep space photovoltaic blue
    roughness: 0.15,
    metalness: 0.8,
    emissive: 0x071b36,
    emissiveIntensity: 0.35,
  });

  const panelLeft = new THREE.Mesh(panelGeo, panelMat);
  panelLeft.position.x = -0.30;
  satBody.add(panelLeft);

  const panelRight = new THREE.Mesh(panelGeo, panelMat);
  panelRight.position.x = 0.30;
  satBody.add(panelRight);

  // Gold structural mounting trusses for solar panels
  const trussGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.14, 8);
  const trussMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9 });

  const trussLeft = new THREE.Mesh(trussGeo, trussMat);
  trussLeft.rotation.z = Math.PI / 2;
  trussLeft.position.x = -0.12;
  satBody.add(trussLeft);

  const trussRight = new THREE.Mesh(trussGeo, trussMat);
  trussRight.rotation.z = Math.PI / 2;
  trussRight.position.x = 0.12;
  satBody.add(trussRight);

  // 3. Parabolic Communications & Earth Radar Antenna Dish (pointing along local -Y toward Earth)
  const dishGeo = new THREE.ConeGeometry(0.08, 0.07, 16, 1, true);
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xf5f7fa,
    metalness: 0.8,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });
  const dishMesh = new THREE.Mesh(dishGeo, dishMat);
  dishMesh.rotation.z = Math.PI; // Opening faces downward (-Y) towards Earth
  dishMesh.position.y = -0.10;
  satBody.add(dishMesh);

  // Antenna Feed Horn Pin
  const hornGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6);
  const hornMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9 });
  const hornMesh = new THREE.Mesh(hornGeo, hornMat);
  hornMesh.position.y = -0.13;
  satBody.add(hornMesh);

  // 4. Subtle Earth Observation Microwave Beam (soft cone expanding towards Earth)
  const beamGeo = new THREE.ConeGeometry(0.20, 0.75, 16, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#76B93F'),
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.rotation.z = Math.PI; // Spreads downward towards Earth
  beamMesh.position.y = -0.48;
  satBody.add(beamMesh);

  const cosAlpha = Math.cos(inPlaneTilt);
  const sinAlpha = Math.sin(inPlaneTilt);

  /**
   * Evaluates the 3D position vector on the camera-facing elliptical orbit.
   */
  const getPositionAtAngle = (theta: number): THREE.Vector3 => {
    const u = orbitRadiusX * Math.cos(theta);
    const v = orbitRadiusY * Math.sin(theta);

    const x = u * cosAlpha - v * sinAlpha;
    const y = u * sinAlpha + v * cosAlpha;
    // Guaranteed foreground depth (always positive: 0.55 ± 0.32 -> [0.23, 0.87])
    const z = zOffset + Math.sin(theta) * zAmp;

    return new THREE.Vector3(x, y, z);
  };

  /**
   * Evaluates the velocity / tangent vector dP/dtheta analytically.
   */
  const getTangentAtAngle = (theta: number): THREE.Vector3 => {
    const du = -orbitRadiusX * Math.sin(theta);
    const dv = orbitRadiusY * Math.cos(theta);

    const dx = du * cosAlpha - dv * sinAlpha;
    const dy = du * sinAlpha + dv * cosAlpha;
    const dz = Math.cos(theta) * zAmp;

    return new THREE.Vector3(dx, dy, dz).normalize();
  };

  const rotMatrix = new THREE.Matrix4();
  const earthCenter = new THREE.Vector3(0, 0, 0);

  const update = (elapsed: number) => {
    const theta = elapsed * speed;

    // 1. Analytical Position along camera-facing ellipse
    const pos = getPositionAtAngle(theta);
    group.position.copy(pos);

    // 2. Analytical Tangent Vector (Flight Direction T along local +Z)
    const T = getTangentAtAngle(theta);

    // 3. Direction towards Earth center: r_down = -pos
    const rDown = earthCenter.clone().sub(pos).normalize();

    // 4. Gram-Schmidt Orthogonalization: N points directly to Earth
    const dotTR = rDown.dot(T);
    const N = rDown.clone().sub(T.clone().multiplyScalar(dotTR)).normalize();

    // 5. Binormal Vector B = T x N (solar panels align along local X)
    const B = new THREE.Vector3().crossVectors(T, N).normalize();

    // 6. Right-handed orthonormal frame:
    // Local X -> B  (solar arrays spread outward, catching sun light broadside to camera)
    // Local Y -> -N (sensors point towards -Y directly to Earth)
    // Local Z -> T  (satellite body cylinder aligned with forward flight vector)
    const negN = N.clone().negate();
    rotMatrix.makeBasis(B, negN, T);
    satBody.quaternion.setFromRotationMatrix(rotMatrix);

    // Subtle sensor telemetry pulse
    const pulse = 0.14 + Math.sin(elapsed * 3.5) * 0.05;
    beamMat.opacity = pulse;
  };

  const dispose = () => {
    coreGeo.dispose();
    coreMat.dispose();
    foilGeo.dispose();
    foilMat.dispose();
    panelGeo.dispose();
    panelMat.dispose();
    trussGeo.dispose();
    trussMat.dispose();
    dishGeo.dispose();
    dishMat.dispose();
    hornGeo.dispose();
    hornMat.dispose();
    beamGeo.dispose();
    beamMat.dispose();
  };

  return { group, update, dispose, getPositionAtAngle };
}
