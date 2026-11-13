import * as THREE from 'three';

export interface AtmosphereOptions {
  radius: number;
  color?: string;
  glowIntensity?: number;
  segments?: number;
}

/**
 * Creates a photorealistic atmospheric shell with custom Fresnel rim glow shader
 * and soft translucent scattering for the Field Shift Liquid Earth.
 */
export function createAtmosphereMesh(options: AtmosphereOptions): THREE.Mesh {
  const { radius, color = '#76B93F', glowIntensity = 1.2, segments = 64 } = options;

  const atmosphereGeometry = new THREE.SphereGeometry(radius * 1.08, segments, segments);

  // Custom GLSL Fresnel shader for natural atmospheric rim lighting
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform vec3 uColor;
    uniform float uIntensity;

    void main() {
      vec3 viewDir = normalize(-vPosition);
      // Fresnel term: maximum at the limb, soft falloff toward center
      float fresnel = 1.0 - max(dot(viewDir, vNormal), 0.0);
      float glow = pow(fresnel, 2.8) * uIntensity;

      // Soft emerald-gold atmospheric color gradient
      vec3 goldGlow = vec3(0.88, 0.95, 0.45);
      vec3 finalColor = mix(uColor, goldGlow, pow(fresnel, 4.0) * 0.4);

      gl_FragColor = vec4(finalColor, glow * 0.85);
    }
  `;

  const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: glowIntensity },
    },
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });

  return new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
}
