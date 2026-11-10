import * as THREE from 'three';
import { createAtmosphereMesh } from './EarthAtmosphere';
import { createOrbitGroup } from './EarthOrbit';
import { createSatelliteGroup } from './Satellite';
import { createLeafParticles } from './LeafParticles';

export interface EarthSceneConfig {
  container: HTMLDivElement;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  speed?: number;
  showSatellite?: boolean;
  showAtmosphere?: boolean;
  interactive?: boolean;
  quality?: 'high' | 'medium' | 'low';
}

export function initEarthScene(config: EarthSceneConfig): {
  destroy: () => void;
  resize: () => void;
} {
  const {
    container,
    speed = 0.5,
    showSatellite = true,
    showAtmosphere = true,
    interactive = true,
    quality = 'high',
  } = config;

  const width = container.clientWidth || 360;
  const height = container.clientHeight || 360;

  // 1. WebGL Renderer Setup
  const renderer = new THREE.WebGLRenderer({
    antialias: quality !== 'low',
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // 2. Camera Setup with Frustum Sizing (Guarantees Zero Clipping at all angles)
  const fovDegrees = 38;
  const tanHalfFov = Math.tan((fovDegrees * Math.PI) / 360); // tan(19°) ≈ 0.34433
  const targetRequiredSpan = 3.00; // a (2.45) + wingspan (0.20) + safety padding (0.35)
  const maxSatelliteForwardZ = 0.87;

  const initialAspect = width / height;
  const initialReqZVertical = targetRequiredSpan / tanHalfFov + maxSatelliteForwardZ; // ≈ 9.58 -> rounded to 9.80
  const initialReqZHorizontal = targetRequiredSpan / (tanHalfFov * initialAspect) + maxSatelliteForwardZ;
  const initialCamZ = Math.max(initialReqZVertical, initialReqZHorizontal, 9.80);

  const camera = new THREE.PerspectiveCamera(fovDegrees, initialAspect, 0.1, 100);
  camera.position.set(0, 0, initialCamZ);

  const scene = new THREE.Scene();

  // 3. Natural Multi-Point Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);

  // Main Sun light (illuminates Earth and solar array faces)
  const sunLight = new THREE.DirectionalLight(0xf4fdf0, 2.4);
  sunLight.position.set(5.5, 4.0, 5.0);
  scene.add(sunLight);

  // Emerald bounce light from earth oceans
  const bounceLight = new THREE.DirectionalLight(0x76b93f, 1.8);
  bounceLight.position.set(-5.0, -3.0, 3.0);
  scene.add(bounceLight);

  // Golden rim backlight
  const rimLight = new THREE.DirectionalLight(0xd4af37, 1.6);
  rimLight.position.set(-4.0, 3.5, -5.0);
  scene.add(rimLight);

  // 4. Root Earth Group for interactive tilt
  const earthRootGroup = new THREE.Group();
  scene.add(earthRootGroup);

  // 4a. Liquid Earth Inner Sphere
  // Radius calibrated so orbital trajectory (min 2.22, max 2.45) provides
  // generous, guaranteed clearance from Earth (1.62) and atmosphere (1.75).
  const earthRadius = 1.62;
  const segments = quality === 'high' ? 64 : 48;
  const coreGeo = new THREE.SphereGeometry(earthRadius, segments, segments);

  // Rich physical liquid glass material with emerald depth
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#073D2B'),
    emissive: new THREE.Color('#0E4A35'),
    emissiveIntensity: 0.45,
    roughness: 0.16,
    metalness: 0.12,
    transmission: 0.42,
    ior: 1.34,
    transparent: true,
    opacity: 0.94,
    reflectivity: 0.6,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  earthRootGroup.add(coreMesh);

  // 4b. Continents & Terrestrial Relief Dots
  const dotCount = quality === 'high' ? 1600 : 900;
  const dotPositions = new Float32Array(dotCount * 3);
  const dotColors = new Float32Array(dotCount * 3);

  const emeraldGreen = new THREE.Color('#76B93F');
  const leafGreen = new THREE.Color('#9BD85A');
  const darkEmerald = new THREE.Color('#145C3D');

  for (let i = 0; i < dotCount; i++) {
    const phi = Math.acos(-1 + (2 * i) / dotCount);
    const theta = Math.sqrt(dotCount * Math.PI) * phi;

    // Procedural radial displacement for terrestrial relief
    const relief = Math.sin(phi * 4.0 + theta * 3.0) * 0.02;
    const r = earthRadius + 0.015 + Math.max(0, relief);

    dotPositions[i * 3] = r * Math.cos(theta) * Math.sin(phi);
    dotPositions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
    dotPositions[i * 3 + 2] = r * Math.cos(phi);

    const randVal = Math.random();
    const c = randVal > 0.5 ? emeraldGreen : randVal > 0.2 ? leafGreen : darkEmerald;
    dotColors[i * 3] = c.r;
    dotColors[i * 3 + 1] = c.g;
    dotColors[i * 3 + 2] = c.b;
  }

  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3));
  dotGeo.setAttribute('color', new THREE.BufferAttribute(dotColors, 3));

  const dotMat = new THREE.PointsMaterial({
    size: quality === 'high' ? 0.055 : 0.065,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
  });
  const dotPoints = new THREE.Points(dotGeo, dotMat);
  earthRootGroup.add(dotPoints);

  // 4c. Translucent Atmospheric Shell (Radius 1.75)
  let atmosphereMesh: THREE.Mesh | null = null;
  if (showAtmosphere) {
    atmosphereMesh = createAtmosphereMesh({
      radius: earthRadius,
      color: '#76B93F',
      glowIntensity: 1.15,
    });
    scene.add(atmosphereMesh);
  }

  // 4d. Orbital Ribbons (Coordinated with Camera-Facing Satellite Orbit)
  const orbit = createOrbitGroup({
    radiusX: 2.45,
    radiusY: 2.22,
    inPlaneTilt: 0.45,
    zOffset: 0.55,
    zAmp: 0.32,
    color: '#76B93F',
    glowColor: '#9BD85A',
  });
  scene.add(orbit.group);

  // 4e. Leaf-Inspired Organic Floating Micro-Particles
  const particles = createLeafParticles({
    count: quality === 'high' ? 85 : 45,
    radiusMin: 1.9,
    radiusMax: 2.6,
  });
  scene.add(particles.mesh);

  // 4f. NASA Satellite with 100% Guaranteed 360-Degree Foreground Visibility
  let satellite: ReturnType<typeof createSatelliteGroup> | null = null;
  if (showSatellite) {
    satellite = createSatelliteGroup({
      orbitRadiusX: 2.45,
      orbitRadiusY: 2.22,
      speed: 0.52 * speed,
      inPlaneTilt: 0.45,
      zOffset: 0.55,
      zAmp: 0.32,
    });
    scene.add(satellite.group);
  }

  // 5. Interactive Mouse Parallax Tracking
  let targetRotationX = 0;
  let targetRotationY = 0;

  const onPointerMove = (e: MouseEvent) => {
    if (!interactive) return;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    targetRotationY = x * 0.25;
    targetRotationX = y * 0.25;
  };

  if (interactive) {
    container.addEventListener('mousemove', onPointerMove);
  }

  // 6. Responsive Resize Handler (Guarantees zero clipping across all screen sizes)
  const resize = () => {
    if (!container) return;
    const w = container.clientWidth || 360;
    const h = container.clientHeight || 360;
    const aspect = w / h;
    camera.aspect = aspect;

    // Dynamically adjust distance so satellite orbit NEVER clips on tall/narrow screens
    const reqZVertical = targetRequiredSpan / tanHalfFov + maxSatelliteForwardZ;
    const reqZHorizontal = targetRequiredSpan / (tanHalfFov * aspect) + maxSatelliteForwardZ;
    camera.position.z = Math.max(reqZVertical, reqZHorizontal, 9.80);

    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  // 7. Visibility Change Handler (Pause rendering when tab inactive)
  let isTabActive = !document.hidden;
  const onVisibilityChange = () => {
    isTabActive = !document.hidden;
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // 8. Animation Loop (Modern THREE.Timer replacing deprecated THREE.Clock)
  let reqId: number;
  const timer = typeof (THREE as any).Timer !== 'undefined'
    ? new (THREE as any).Timer()
    : null;
  const fallbackStartTime = performance.now();

  const animate = (timestamp?: number) => {
    reqId = requestAnimationFrame(animate);

    if (!isTabActive) return;

    let elapsed: number;
    if (timer) {
      timer.update(timestamp);
      elapsed = timer.getElapsed();
    } else {
      elapsed = (performance.now() - fallbackStartTime) * 0.001;
    }

    // Smooth Earth axial rotation
    const rotSpeed = 0.12 * speed;
    earthRootGroup.rotation.y = elapsed * rotSpeed;
    dotPoints.rotation.y = elapsed * rotSpeed;

    // Smooth parallax lerping
    earthRootGroup.rotation.x += (targetRotationX - earthRootGroup.rotation.x) * 0.05;
    earthRootGroup.rotation.z += (-targetRotationY - earthRootGroup.rotation.z) * 0.05;

    // Atmospheric pulse
    if (atmosphereMesh) {
      atmosphereMesh.rotation.y = elapsed * (rotSpeed * 0.8);
    }

    // Update orbit ribbons & leaf particles
    orbit.update(elapsed * speed);
    particles.update(elapsed * speed);

    // Update satellite continuous 100% visible orbit around Earth perimeter
    if (satellite) {
      satellite.update(elapsed);
    }

    renderer.render(scene, camera);
  };

  animate();

  // 9. Resource Cleanup and Disposal
  const destroy = () => {
    cancelAnimationFrame(reqId);
    if (timer && typeof timer.dispose === 'function') {
      timer.dispose();
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);

    if (interactive) {
      container.removeEventListener('mousemove', onPointerMove);
    }

    renderer.dispose();
    coreGeo.dispose();
    coreMat.dispose();
    dotGeo.dispose();
    dotMat.dispose();
    orbit.dispose();
    particles.dispose();
    if (satellite) {
      satellite.dispose();
    }
    if (atmosphereMesh) {
      atmosphereMesh.geometry.dispose();
      (atmosphereMesh.material as THREE.Material).dispose();
    }
    container.innerHTML = '';
  };

  return { destroy, resize };
}
