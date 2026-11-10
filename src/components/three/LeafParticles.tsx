import * as THREE from 'three';

export interface LeafParticleOptions {
  count?: number;
  radiusMin?: number;
  radiusMax?: number;
}

/**
 * Creates small leaf-inspired organic micro-particles floating gracefully
 * around the Field Shift Liquid Earth.
 */
export function createLeafParticles(options: LeafParticleOptions = {}): {
  mesh: THREE.Points;
  update: (elapsed: number) => void;
  dispose: () => void;
} {
  const { count = 120, radiusMin = 2.4, radiusMax = 3.6 } = options;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);

  const emerald = new THREE.Color('#76B93F');
  const leafGold = new THREE.Color('#D8EC78');
  const forestGreen = new THREE.Color('#145C3D');

  for (let i = 0; i < count; i++) {
    // Distribute around a spherical shell
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const r = radiusMin + Math.random() * (radiusMax - radiusMin);

    positions[i * 3] = r * Math.cos(theta) * Math.sin(phi);
    positions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
    positions[i * 3 + 2] = r * Math.cos(phi);

    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.2 + Math.random() * 0.4;

    const randColor = Math.random();
    const c = randColor > 0.6 ? emerald : randColor > 0.3 ? leafGold : forestGreen;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.08,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const mesh = new THREE.Points(geometry, material);

  const initialPositions = new Float32Array(positions);

  const update = (elapsed: number) => {
    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const initX = initialPositions[idx];
      const initY = initialPositions[idx + 1];
      const initZ = initialPositions[idx + 2];
      const phase = phases[i];
      const spd = speeds[i];

      // Subtle float wave
      posArray[idx] = initX + Math.sin(elapsed * spd + phase) * 0.08;
      posArray[idx + 1] = initY + Math.cos(elapsed * spd + phase) * 0.08;
      posArray[idx + 2] = initZ + Math.sin(elapsed * spd * 0.7 + phase) * 0.06;
    }

    posAttr.needsUpdate = true;
    mesh.rotation.y = elapsed * 0.08;
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
  };

  return { mesh, update, dispose };
}
