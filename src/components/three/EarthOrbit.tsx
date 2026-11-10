import * as THREE from 'three';

export interface OrbitOptions {
  radiusX?: number; // a: semi-major axis (e.g. 2.45)
  radiusY?: number; // b: semi-minor axis (e.g. 2.22)
  inPlaneTilt?: number;  // alpha: ~26 degrees in-plane
  zOffset?: number;      // 0.55
  zAmp?: number;         // 0.32
  color?: string;
  glowColor?: string;
}

/**
 * Creates graceful glowing orbital ribbons and tracking nodes inspired by the Field Shift branding.
 * Aligned with the camera-facing satellite trajectory to guarantee continuous visibility.
 */
export function createOrbitGroup(options: OrbitOptions = {}): {
  group: THREE.Group;
  update: (elapsed: number) => void;
  dispose: () => void;
} {
  const {
    radiusX = 2.45,
    radiusY = 2.22,
    inPlaneTilt = 0.45,
    zOffset = 0.55,
    zAmp = 0.32,
    color = '#76B93F',
    glowColor = '#9BD85A',
  } = options;

  const group = new THREE.Group();

  const cosAlpha = Math.cos(inPlaneTilt);
  const sinAlpha = Math.sin(inPlaneTilt);

  // Helper to project parametric (u, v) into camera-facing orbit space
  const projectToOrbit = (theta: number, scale = 1.0): THREE.Vector3 => {
    const u = radiusX * scale * Math.cos(theta);
    const v = radiusY * scale * Math.sin(theta);

    const x = u * cosAlpha - v * sinAlpha;
    const y = u * sinAlpha + v * cosAlpha;
    const z = zOffset + Math.sin(theta) * zAmp;

    return new THREE.Vector3(x, y, z);
  };

  // 1. Primary Orbital Ribbon (Exact closed trajectory matching Satellite orbit)
  const segments = 128;
  const primaryCurvePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    primaryCurvePoints.push(projectToOrbit(theta));
  }

  const primaryCurve = new THREE.CatmullRomCurve3(primaryCurvePoints, true);
  const primaryGeo = new THREE.TubeGeometry(primaryCurve, 120, 0.012, 8, true);
  const primaryMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const primaryMesh = new THREE.Mesh(primaryGeo, primaryMat);
  group.add(primaryMesh);

  // 2. Secondary Delicate Swirl Ribbon (Leaf-curled orbital accent from Field Shift logo)
  const secondarySegments = 80;
  const secondaryCurvePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= secondarySegments; i++) {
    const t = i / secondarySegments;
    const theta = t * Math.PI * 1.7 - 0.4;
    const scale = 1.04 + Math.sin(t * Math.PI) * 0.08;
    const pt = projectToOrbit(theta, scale);
    pt.z += (t - 0.5) * 0.2; // Gentle depth accent
    secondaryCurvePoints.push(pt);
  }

  const secondaryCurve = new THREE.CatmullRomCurve3(secondaryCurvePoints, false);
  const secondaryGeo = new THREE.TubeGeometry(secondaryCurve, 80, 0.008, 6, false);
  const secondaryMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(glowColor),
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const secondaryMesh = new THREE.Mesh(secondaryGeo, secondaryMat);
  group.add(secondaryMesh);

  // 3. Orbital Tracking Nodes (sparkles along the primary orbital path)
  const nodeCount = 16;
  const nodeGeo = new THREE.SphereGeometry(0.025, 10, 10);
  const nodeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(glowColor),
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const nodeInstanced = new THREE.InstancedMesh(nodeGeo, nodeMat, nodeCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < nodeCount; i++) {
    const t = i / nodeCount;
    const pt = primaryCurve.getPoint(t);
    dummy.position.copy(pt);
    dummy.scale.setScalar(0.7 + Math.sin(i * 1.5) * 0.3);
    dummy.updateMatrix();
    nodeInstanced.setMatrixAt(i, dummy.matrix);
  }
  nodeInstanced.instanceMatrix.needsUpdate = true;
  group.add(nodeInstanced);

  const update = (elapsed: number) => {
    // Subtle pulsating glow along the orbital ribbon
    const pulse = 0.38 + Math.sin(elapsed * 1.5) * 0.08;
    primaryMat.opacity = pulse;
    secondaryMat.opacity = pulse * 0.7;

    // Shift tracking node scales in harmonic wave
    for (let i = 0; i < nodeCount; i++) {
      const t = i / nodeCount;
      const pt = primaryCurve.getPoint(t);
      dummy.position.copy(pt);
      const wave = Math.sin(elapsed * 2.0 + i * 0.8) * 0.25 + 0.85;
      dummy.scale.setScalar(wave);
      dummy.updateMatrix();
      nodeInstanced.setMatrixAt(i, dummy.matrix);
    }
    nodeInstanced.instanceMatrix.needsUpdate = true;
  };

  const dispose = () => {
    primaryGeo.dispose();
    primaryMat.dispose();
    secondaryGeo.dispose();
    secondaryMat.dispose();
    nodeGeo.dispose();
    nodeMat.dispose();
  };

  return { group, update, dispose };
}
