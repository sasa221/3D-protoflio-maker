/**
 * HyperEngine.js - Ultra 3D 60 FPS Scene Engine
 * Three.js powered: Particles, Shaders, Camera, Interactivity
 */

import * as THREE from 'three';
import { gsap } from 'gsap';
import { THEME_SCENE_CONFIG, getThemeSceneConfig } from './ThemeSceneConfig.js';

export class HyperEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.startTime = Date.now();
    this.mouse = new THREE.Vector2();
    this.mouseTarget = new THREE.Vector2();
    this.animFrame = null;
    this.currentTheme = null;
    this.objects = { particles: null, core: null, rings: [], floatingMeshes: [], radar: null };
    this.uniforms = {};
    this.isRunning = false;
    this.contextLost = false;
    this._resizeHandler = this._onResize.bind(this);
    this._mouseMoveHandler = this._onMouseMove.bind(this);
    this._contextLostHandler = (e) => {
      e.preventDefault();
      this.contextLost = true;
      console.warn('[HyperEngine] WebGL context lost. Rendering paused.');
    };
    this._contextRestoredHandler = () => {
      this.contextLost = false;
      if (this.currentTheme) this.applyTheme(this.currentTheme);
      console.log('[HyperEngine] WebGL context restored.');
    };
  }

  static isWebGLSupported() {
    try {
      const canvas = document.createElement('canvas');
      return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  init(theme) {
    try {
      this._setup();
      this.applyTheme(theme);
      this._bindEvents();
      this._startLoop();
      this.isRunning = true;
    } catch (err) {
      console.warn('[HyperEngine] 3D initialization fallback:', err.message);
      this.isRunning = false;
    }
  }

  _setup() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.0015);

    // Camera State Vectors for Cinematic SceneDirector
    this.baseCameraPos = new THREE.Vector3(0, 0, 80);
    this.targetCameraPos = new THREE.Vector3(0, 0, 80);
    this.baseCameraTarget = new THREE.Vector3(0, 0, 0);
    this.targetCameraTarget = new THREE.Vector3(0, 0, 0);
    this.targetFov = 60;
    this.targetSceneRotY = 0;
    this.targetCoreScale = 1;
    this.parallaxStrength = 8;

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, this._aspect(), 0.1, 2000);
    this.camera.position.set(0, 0, 80);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    if (this.canvas && this.canvas.addEventListener) {
      this.canvas.addEventListener('webglcontextlost', this._contextLostHandler, false);
      this.canvas.addEventListener('webglcontextrestored', this._contextRestoredHandler, false);
    }
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    this._clearScene();

    // Background color
    this.scene.background = new THREE.Color(theme.bgColor);
    this.scene.fog = new THREE.FogExp2(theme.bgColor, 0.002);

    // Build theme-specific scene
    switch (theme.id) {
      case 'code':      this._buildCodeMatrix(theme); break;
      case 'hacker':    this._buildCyberCommand(theme); break;
      case 'data':      this._buildDataGalaxy(theme); break;
      case 'blueprint': this._buildBlueprint(theme); break;
      case 'creative':  this._buildLiquidPrism(theme); break;
      case 'media':     this._buildAperture(theme); break;
      case 'health':    this._buildDNA(theme); break;
      case 'marketing': this._buildGrowth(theme); break;
      case 'finance':   this._buildDataGalaxy(theme); break;  // golden charts
      case 'education': this._buildCosmic(theme); break;       // knowledge nebula
      case 'legal':     this._buildBlueprint(theme); break;    // structured grids
      default:          this._buildCosmic(theme);
    }

    // Universal: ambient + point lights
    this._addLights(theme);
  }

  // ──────────────────────────────────────────
  // THEME BUILDERS
  // ──────────────────────────────────────────

  _buildCodeMatrix(theme) {
    // Falling code rain particles
    this._createParticleField(theme, 3000, 'cube');
    // Floating terminal screens
    this._createFloatingPanels(theme, 6, 'terminal');
    // Central rotating cube core
    this._createGeometricCore(theme, 'octahedron');
    // Neon grid floor
    this._createNeonGrid(theme);
  }

  _buildCyberCommand(theme) {
    // Hex shield particles
    this._createParticleField(theme, 2500, 'hex');
    // Rotating radar ring
    this._createRadar(theme);
    // Central core
    this._createGeometricCore(theme, 'icosahedron');
    // Data stream lines
    this._createDataStreams(theme, 30);
  }

  _buildDataGalaxy(theme) {
    // Dense star particles
    this._createParticleField(theme, 4000, 'sphere');
    // 3D bar chart
    this._createBarChart(theme);
    // Orbital rings
    this._createOrbitalRings(theme, 3);
    this._createGeometricCore(theme, 'sphere');
  }

  _buildBlueprint(theme) {
    // Wireframe particles
    this._createParticleField(theme, 2000, 'point');
    // Blueprint grid
    this._createBlueprintGrid(theme);
    // Wireframe structures
    this._createWireframeStructures(theme);
    this._createGeometricCore(theme, 'box');
  }

  _buildLiquidPrism(theme) {
    // Dense colorful particles
    this._createRainbowParticles(theme, 3500);
    // Glass prisms
    this._createGlassPrisms(theme, 8);
    // Morphing blob core
    this._createMorphCore(theme);
  }

  _buildAperture(theme) {
    // Ring particles
    this._createParticleField(theme, 2800, 'ring');
    // Aperture blades
    this._createApertureBlades(theme);
    // Lens flare rings
    this._createOrbitalRings(theme, 5);
    this._createGeometricCore(theme, 'torus');
  }

  _buildDNA(theme) {
    // Bio particles
    this._createParticleField(theme, 2500, 'sphere');
    // DNA double helix
    this._createDNAHelix(theme);
    // Cell core
    this._createGeometricCore(theme, 'sphere');
  }

  _buildGrowth(theme) {
    // Arrow-like upward particles
    this._createParticleField(theme, 3200, 'sphere');
    // Rising bars
    this._createBarChart(theme, true);
    // Energy burst
    this._createOrbitalRings(theme, 4);
    this._createGeometricCore(theme, 'dodecahedron');
  }

  _buildCosmic(theme) {
    // Galaxy particles
    this._createGalaxyParticles(theme, 5000);
    // Glass orbs
    this._createGlassPrisms(theme, 5);
    // Morphing core
    this._createMorphCore(theme);
    // Orbital rings
    this._createOrbitalRings(theme, 3);
  }

  // ──────────────────────────────────────────
  // COMPONENT BUILDERS
  // ──────────────────────────────────────────

  _createParticleField(theme, count, shape) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const c1 = new THREE.Color(theme.primaryColor);
    const c2 = new THREE.Color(theme.secondaryColor);
    const c3 = new THREE.Color(theme.accentColor);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = 50 + Math.random() * 150;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3]     = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      const c = Math.random() < 0.5 ? c1 : (Math.random() < 0.5 ? c2 : c3);
      colors[i3]     = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;

      sizes[i] = Math.random() * 2.5 + 0.5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      vertexColors: false,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 30 * this.renderer.getPixelRatio() }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 aColor;
        varying vec3 vColor;
        uniform float uTime;
        uniform float uSize;
        void main() {
          vColor = aColor;
          vec3 pos = position;
          float wave = sin(uTime * 0.5 + pos.x * 0.02 + pos.y * 0.02) * 2.0;
          pos.y += wave;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (uSize / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = distance(gl_PointCoord, vec2(0.5));
          if (d > 0.5) discard;
          float alpha = 1.0 - (d * 2.0);
          alpha = pow(alpha, 1.5);
          gl_FragColor = vec4(vColor, alpha * 0.85);
        }
      `
    });

    this.uniforms.particles = mat.uniforms;
    const mesh = new THREE.Points(geo, mat);
    this.scene.add(mesh);
    this.objects.particles = mesh;
  }

  _createGalaxyParticles(theme, count) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c1 = new THREE.Color(theme.primaryColor);
    const c2 = new THREE.Color(theme.secondaryColor);

    const arms = 3;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const armAngle = (i % arms) * (Math.PI * 2 / arms);
      const radius = Math.random() * 120;
      const spin = radius * 0.008;
      const angle = armAngle + spin;
      const scatter = (Math.random() - 0.5) * radius * 0.5;

      positions[i3]     = Math.cos(angle) * radius + scatter;
      positions[i3 + 1] = (Math.random() - 0.5) * 20;
      positions[i3 + 2] = Math.sin(angle) * radius + scatter;

      const t = radius / 120;
      const c = c1.clone().lerp(c2, t);
      colors[i3]     = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    const mesh = new THREE.Points(geo, mat);
    this.scene.add(mesh);
    this.objects.particles = mesh;
  }

  _createGeometricCore(theme, shape) {
    let geo;
    const size = 8;
    switch (shape) {
      case 'octahedron':    geo = new THREE.OctahedronGeometry(size, 2); break;
      case 'icosahedron':   geo = new THREE.IcosahedronGeometry(size, 1); break;
      case 'sphere':        geo = new THREE.SphereGeometry(size, 32, 32); break;
      case 'box':           geo = new THREE.BoxGeometry(size, size, size, 4, 4, 4); break;
      case 'torus':         geo = new THREE.TorusGeometry(size, 2, 16, 100); break;
      case 'dodecahedron':  geo = new THREE.DodecahedronGeometry(size, 0); break;
      default:              geo = new THREE.IcosahedronGeometry(size, 2);
    }

    // Wireframe glow
    const wireMat = new THREE.MeshBasicMaterial({
      color: theme.primaryColor,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    const wireCore = new THREE.Mesh(geo, wireMat);
    this.scene.add(wireCore);

    // Solid inner with shader glow
    const innerGeo = geo.clone();
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(theme.primaryColor) },
        uColor2: { value: new THREE.Color(theme.secondaryColor) }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float uTime;
        void main() {
          vNormal = normal;
          vPosition = position;
          vec3 pos = position;
          float noise = sin(pos.x * 0.5 + uTime) * cos(pos.y * 0.5 + uTime) * 1.5;
          pos += normal * noise;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform vec3 uColor;
        uniform vec3 uColor2;
        uniform float uTime;
        void main() {
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0,0,1))), 2.0);
          vec3 col = mix(uColor, uColor2, fresnel);
          gl_FragColor = vec4(col, fresnel * 0.7);
        }
      `
    });

    const innerMesh = new THREE.Mesh(innerGeo, mat);
    this.scene.add(innerMesh);

    this.objects.core = { wireCore, innerMesh, mat };
    this.uniforms.core = mat.uniforms;
  }

  _createOrbitalRings(theme, count) {
    for (let i = 0; i < count; i++) {
      const radius = 15 + i * 8;
      const geo = new THREE.TorusGeometry(radius, 0.15, 8, 120);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? theme.primaryColor : theme.accentColor,
        transparent: true,
        opacity: 0.6 - i * 0.1,
        blending: THREE.AdditiveBlending
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = (Math.PI / 4) * (i + 1);
      ring.rotation.y = (Math.PI / 6) * i;
      ring.userData.speed = (0.3 + i * 0.15) * (i % 2 === 0 ? 1 : -1);
      this.scene.add(ring);
      this.objects.rings.push(ring);
    }
  }

  _createRadar(theme) {
    // Radar circle
    const geo = new THREE.RingGeometry(0, 40, 64);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(theme.primaryColor) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uColor;
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float angle = atan(center.y, center.x);
          float sweep = mod(angle - uTime * 2.0, 6.28318);
          float beam = max(0.0, 1.0 - sweep / 1.0);
          float ring1 = abs(dist - 0.3) < 0.005 ? 0.5 : 0.0;
          float ring2 = abs(dist - 0.5) < 0.005 ? 0.4 : 0.0;
          float glow = beam * max(0.0, 0.5 - dist) * 2.0;
          float alpha = glow + ring1 + ring2;
          gl_FragColor = vec4(uColor, alpha * 0.8);
        }
      `
    });

    const radar = new THREE.Mesh(geo, mat);
    radar.rotation.x = -Math.PI / 2;
    radar.position.y = -20;
    this.scene.add(radar);
    this.objects.radar = { mesh: radar, mat, uniforms: mat.uniforms };
    this.uniforms.radar = mat.uniforms;
  }

  _createNeonGrid(theme) {
    const size = 200;
    const divisions = 20;
    const grid = new THREE.GridHelper(size, divisions,
      new THREE.Color(theme.primaryColor).multiplyScalar(0.3),
      new THREE.Color(theme.primaryColor).multiplyScalar(0.1)
    );
    grid.position.y = -30;
    grid.material.transparent = true;
    grid.material.opacity = 0.4;
    this.scene.add(grid);
  }

  _createBlueprintGrid(theme) {
    const size = 200;
    const geo = new THREE.PlaneGeometry(size, size, 30, 30);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      wireframe: true,
      uniforms: {
        uColor: { value: new THREE.Color(theme.primaryColor) },
        uTime: { value: 0 }
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.z += sin(pos.x * 0.05 + uTime) * cos(pos.y * 0.05 + uTime) * 3.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 uColor;
        void main() {
          gl_FragColor = vec4(uColor, 0.3);
        }
      `
    });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -30;
    this.scene.add(plane);
    this.uniforms.blueprint = mat.uniforms;
    this.objects.floatingMeshes.push(plane);
  }

  _createDataStreams(theme, count) {
    for (let i = 0; i < count; i++) {
      const points = [];
      const start = new THREE.Vector3(
        (Math.random() - 0.5) * 120,
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 120
      );
      for (let j = 0; j < 10; j++) {
        points.push(start.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          -j * 5,
          (Math.random() - 0.5) * 20
        )));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: i % 2 === 0 ? theme.primaryColor : theme.secondaryColor,
        transparent: true,
        opacity: 0.4 + Math.random() * 0.4,
        blending: THREE.AdditiveBlending
      });
      const line = new THREE.Line(geo, mat);
      line.userData.speed = 0.5 + Math.random() * 1.5;
      line.userData.origin = start.clone();
      this.scene.add(line);
      this.objects.floatingMeshes.push(line);
    }
  }

  _createBarChart(theme, golden = false) {
    const barCount = 8;
    for (let i = 0; i < barCount; i++) {
      const height = 5 + Math.random() * 30;
      const geo = new THREE.BoxGeometry(3, height, 3);
      const mat = new THREE.MeshBasicMaterial({
        color: golden ? theme.accentColor : theme.primaryColor,
        wireframe: true,
        transparent: true,
        opacity: 0.7
      });
      const bar = new THREE.Mesh(geo, mat);
      bar.position.set(-barCount * 2.5 + i * 5, height / 2 - 20, -10 + Math.random() * 20);
      bar.userData.targetHeight = height;
      bar.userData.speed = 0.3 + Math.random() * 0.5;
      this.scene.add(bar);
      this.objects.floatingMeshes.push(bar);
    }
  }

  _createFloatingPanels(theme, count, type) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.PlaneGeometry(12, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: theme.primaryColor,
        wireframe: true,
        transparent: true,
        opacity: 0.2 + Math.random() * 0.3
      });
      const panel = new THREE.Mesh(geo, mat);
      const angle = (i / count) * Math.PI * 2;
      panel.position.set(
        Math.cos(angle) * 35,
        (Math.random() - 0.5) * 30,
        Math.sin(angle) * 35
      );
      panel.lookAt(0, 0, 0);
      panel.userData.floatSpeed = 0.2 + Math.random() * 0.5;
      panel.userData.floatOffset = Math.random() * Math.PI * 2;
      this.scene.add(panel);
      this.objects.floatingMeshes.push(panel);
    }
  }

  _createGlassPrisms(theme, count) {
    const shapes = [
      new THREE.TetrahedronGeometry(5),
      new THREE.OctahedronGeometry(5),
      new THREE.DodecahedronGeometry(4)
    ];
    for (let i = 0; i < count; i++) {
      const geo = shapes[i % shapes.length];
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? theme.primaryColor : theme.accentColor,
        wireframe: true,
        transparent: true,
        opacity: 0.5
      });
      const mesh = new THREE.Mesh(geo.clone(), mat);
      const angle = (i / count) * Math.PI * 2;
      mesh.position.set(
        Math.cos(angle) * (20 + Math.random() * 20),
        (Math.random() - 0.5) * 30,
        Math.sin(angle) * (20 + Math.random() * 20)
      );
      mesh.userData.rotSpeed = { x: Math.random() * 0.01, y: Math.random() * 0.015, z: Math.random() * 0.008 };
      mesh.userData.floatOffset = Math.random() * Math.PI * 2;
      this.scene.add(mesh);
      this.objects.floatingMeshes.push(mesh);
    }
  }

  _createRainbowParticles(theme, count) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 300;
      positions[i3 + 1] = (Math.random() - 0.5) * 200;
      positions[i3 + 2] = (Math.random() - 0.5) * 200;

      const hue = (i / count) * 360;
      const c = new THREE.Color().setHSL(hue / 360, 1, 0.6);
      colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 1.2, vertexColors: true, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    const mesh = new THREE.Points(geo, mat);
    this.scene.add(mesh);
    this.objects.particles = mesh;
  }

  _createMorphCore(theme) {
    const geo = new THREE.SphereGeometry(10, 64, 64);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(theme.primaryColor) },
        uColor2: { value: new THREE.Color(theme.accentColor) }
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying float vDisp;
        void main() {
          vNormal = normal;
          vec3 pos = position;
          float disp = sin(pos.x * 0.3 + uTime * 1.5) * sin(pos.y * 0.3 + uTime) * sin(pos.z * 0.3 + uTime * 0.7) * 3.0;
          vDisp = disp;
          pos += normal * disp;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying float vDisp;
        uniform vec3 uColor;
        uniform vec3 uColor2;
        uniform float uTime;
        void main() {
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0,0,1))), 2.5);
          float t = (vDisp + 3.0) / 6.0;
          vec3 col = mix(uColor, uColor2, t);
          gl_FragColor = vec4(col, fresnel * 0.9);
        }
      `
    });
    const core = new THREE.Mesh(geo, mat);
    this.scene.add(core);
    this.objects.core = { innerMesh: core, wireCore: core, mat };
    this.uniforms.core = mat.uniforms;
  }

  _createDNAHelix(theme) {
    const strand1Points = [];
    const strand2Points = [];
    const rungs = [];
    const helixHeight = 80;
    const helixRadius = 8;
    const turns = 5;
    const stepsPerTurn = 20;
    const totalSteps = turns * stepsPerTurn;

    for (let i = 0; i < totalSteps; i++) {
      const t = i / totalSteps;
      const angle = t * turns * Math.PI * 2;
      const y = t * helixHeight - helixHeight / 2;

      const x1 = Math.cos(angle) * helixRadius;
      const z1 = Math.sin(angle) * helixRadius;
      const x2 = Math.cos(angle + Math.PI) * helixRadius;
      const z2 = Math.sin(angle + Math.PI) * helixRadius;

      strand1Points.push(new THREE.Vector3(x1, y, z1));
      strand2Points.push(new THREE.Vector3(x2, y, z2));

      if (i % 3 === 0) {
        const rungGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x1, y, z1),
          new THREE.Vector3(x2, y, z2)
        ]);
        const rungMat = new THREE.LineBasicMaterial({
          color: theme.accentColor,
          transparent: true, opacity: 0.4,
          blending: THREE.AdditiveBlending
        });
        const rung = new THREE.Line(rungGeo, rungMat);
        this.scene.add(rung);
      }
    }

    const curve1 = new THREE.CatmullRomCurve3(strand1Points);
    const curve2 = new THREE.CatmullRomCurve3(strand2Points);

    const tubeMat1 = new THREE.TubeGeometry(curve1, 200, 0.3, 8, false);
    const tubeMat2 = new THREE.TubeGeometry(curve2, 200, 0.3, 8, false);

    const m1 = new THREE.MeshBasicMaterial({ color: theme.primaryColor, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    const m2 = new THREE.MeshBasicMaterial({ color: theme.secondaryColor, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });

    const t1 = new THREE.Mesh(tubeMat1, m1);
    const t2 = new THREE.Mesh(tubeMat2, m2);
    t1.userData.rotSpeed = { y: 0.005 };
    t2.userData.rotSpeed = { y: 0.005 };

    this.scene.add(t1, t2);
    this.objects.floatingMeshes.push(t1, t2);
  }

  _createApertureBlades(theme) {
    const bladeCount = 8;
    for (let i = 0; i < bladeCount; i++) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(2, 8);
      shape.lineTo(-2, 8);
      shape.closePath();
      const geo = new THREE.ShapeGeometry(shape);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? theme.primaryColor : theme.accentColor,
        transparent: true, opacity: 0.3, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const blade = new THREE.Mesh(geo, mat);
      blade.rotation.z = (i / bladeCount) * Math.PI * 2;
      blade.userData.baseAngle = (i / bladeCount) * Math.PI * 2;
      blade.userData.rotSpeed = 0.008;
      this.scene.add(blade);
      this.objects.floatingMeshes.push(blade);
    }
  }

  _createWireframeStructures(theme) {
    const geos = [
      new THREE.BoxGeometry(10, 10, 10),
      new THREE.BoxGeometry(15, 15, 15),
      new THREE.BoxGeometry(8, 20, 8)
    ];
    geos.forEach((geo, i) => {
      const mat = new THREE.MeshBasicMaterial({
        color: theme.primaryColor, wireframe: true,
        transparent: true, opacity: 0.3
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-30 + i * 30, -15, -20);
      mesh.userData.rotSpeed = { x: 0.003, y: 0.005 };
      this.scene.add(mesh);
      this.objects.floatingMeshes.push(mesh);
    });
  }

  _addLights(theme) {
    const ambient = new THREE.AmbientLight(0xffffff, 0.1);
    this.scene.add(ambient);

    const point1 = new THREE.PointLight(theme.primaryColor, 2, 200);
    point1.position.set(50, 50, 50);
    this.scene.add(point1);

    const point2 = new THREE.PointLight(theme.secondaryColor, 1.5, 150);
    point2.position.set(-50, -30, -50);
    this.scene.add(point2);

    const point3 = new THREE.PointLight(theme.accentColor, 1, 100);
    point3.position.set(0, 60, 0);
    this.scene.add(point3);

    this.objects.lights = [ambient, point1, point2, point3];
  }

  // ──────────────────────────────────────────
  // ANIMATION LOOP
  // ──────────────────────────────────────────

  _startLoop() {
    const loop = () => {
      this.animFrame = requestAnimationFrame(loop);
      this._tick();
    };
    loop();
  }

  setCameraState(state = {}) {
    if (state.position) {
      this.targetCameraPos.set(state.position.x, state.position.y, state.position.z);
    }
    if (state.target) {
      this.targetCameraTarget.set(state.target.x, state.target.y, state.target.z);
    }
    if (state.fov !== undefined) {
      this.targetFov = state.fov;
    }
    if (state.sceneRotationY !== undefined) {
      this.targetSceneRotY = state.sceneRotationY;
    }
    if (state.coreScale !== undefined) {
      this.targetCoreScale = state.coreScale;
    }
    if (state.parallaxStrength !== undefined) {
      this.parallaxStrength = state.parallaxStrength;
    }
  }

  _tick() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const delta = 0.016;

    // Check reduced motion
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lerpFactor = reducedMotion ? 0.02 : 0.06;

    // Smooth mouse follow
    this.mouse.x += (this.mouseTarget.x - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouseTarget.y - this.mouse.y) * 0.05;

    // Interpolate base camera position & target from SceneDirector
    if (this.baseCameraPos && this.targetCameraPos) {
      this.baseCameraPos.lerp(this.targetCameraPos, lerpFactor);
    }
    if (this.baseCameraTarget && this.targetCameraTarget) {
      this.baseCameraTarget.lerp(this.targetCameraTarget, lerpFactor);
    }

    // FOV Interpolation
    if (this.camera && this.targetFov && Math.abs(this.camera.fov - this.targetFov) > 0.05) {
      this.camera.fov += (this.targetFov - this.camera.fov) * lerpFactor;
      this.camera.updateProjectionMatrix();
    }

    // Combined Camera Position = Base Camera (Scroll-driven) + Subtle Mouse Parallax
    const pStr = reducedMotion ? 2 : (this.parallaxStrength || 8);
    const parallaxX = this.mouse.x * pStr;
    const parallaxY = -this.mouse.y * (pStr * 0.75);

    if (this.camera && this.baseCameraPos) {
      this.camera.position.x = this.baseCameraPos.x + parallaxX;
      this.camera.position.y = this.baseCameraPos.y + parallaxY;
      this.camera.position.z = this.baseCameraPos.z;

      if (this.baseCameraTarget) {
        this.camera.lookAt(this.baseCameraTarget.x, this.baseCameraTarget.y, this.baseCameraTarget.z);
      }
    }

    // Scene Rotation & Core Scale Interpolation
    if (this.scene && this.targetSceneRotY !== undefined) {
      this.scene.rotation.y += (this.targetSceneRotY - this.scene.rotation.y) * lerpFactor;
    }
    if (this.objects.core && this.objects.core.wireCore && this.targetCoreScale !== undefined) {
      const curS = this.objects.core.wireCore.scale.x;
      const ns = curS + (this.targetCoreScale - curS) * lerpFactor;
      this.objects.core.wireCore.scale.set(ns, ns, ns);
    }

    // Update particle uniforms
    if (this.uniforms.particles) {
      this.uniforms.particles.uTime.value = elapsed;
    }
    if (this.uniforms.core) {
      this.uniforms.core.uTime.value = elapsed;
    }
    if (this.uniforms.radar) {
      this.uniforms.radar.uTime.value = elapsed;
    }
    if (this.uniforms.blueprint) {
      this.uniforms.blueprint.uTime.value = elapsed;
    }

    // Rotate particles
    if (this.objects.particles) {
      this.objects.particles.rotation.y = elapsed * 0.03;
      this.objects.particles.rotation.x = elapsed * 0.01;
    }

    // Rotate core
    if (this.objects.core) {
      if (this.objects.core.wireCore) {
        this.objects.core.wireCore.rotation.y = elapsed * 0.4;
        this.objects.core.wireCore.rotation.x = elapsed * 0.25;
      }
      if (this.objects.core.innerMesh !== this.objects.core.wireCore) {
        this.objects.core.innerMesh.rotation.y = -elapsed * 0.3;
        this.objects.core.innerMesh.rotation.x = elapsed * 0.2;
      }
    }

    // Rotate rings
    this.objects.rings.forEach(ring => {
      ring.rotation.z += ring.userData.speed * 0.01;
      ring.rotation.x += ring.userData.speed * 0.005;
    });

    // Animate floating meshes
    this.objects.floatingMeshes.forEach((mesh, i) => {
      if (mesh.userData.rotSpeed) {
        if (mesh.userData.rotSpeed.x) mesh.rotation.x += mesh.userData.rotSpeed.x;
        if (mesh.userData.rotSpeed.y) mesh.rotation.y += mesh.userData.rotSpeed.y;
        if (mesh.userData.rotSpeed.z) mesh.rotation.z += mesh.userData.rotSpeed.z;
      }
      if (mesh.userData.floatOffset !== undefined) {
        mesh.position.y += Math.sin(elapsed * (mesh.userData.floatSpeed || 0.5) + mesh.userData.floatOffset) * 0.02;
      }
      // Aperture blade rotation
      if (mesh.userData.baseAngle !== undefined) {
        mesh.rotation.z = mesh.userData.baseAngle + elapsed * 0.3;
      }
      // DNA strand
      if (mesh.userData.rotSpeed && mesh.userData.rotSpeed.y) {
        mesh.rotation.y += mesh.userData.rotSpeed.y;
      }
    });

    if (!this.contextLost && this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _clearScene() {
    while (this.scene && this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
    this.objects = { particles: null, core: null, rings: [], floatingMeshes: [], radar: null };
    this.uniforms = {};
  }

  // ──────────────────────────────────────────
  // CAMERA CONTROL
  // ──────────────────────────────────────────

  flyTo(section) {
    const positions = {
      hero:     { x: 0,   y: 0,   z: 85 },
      about:    { x: -35, y: 18,  z: 65 },
      projects: { x: 40,  y: -12, z: 55 },
      skills:   { x: -10, y: 32,  z: 58 },
      certs:    { x: 22,  y: 24,  z: 62 },
      contact:  { x: 0,   y: -25, z: 90 }
    };
    const target = positions[section] || positions.hero;
    this.setCameraState({ position: target, target: { x: 0, y: 0, z: 0 } });
  }

  zoomIn() {
    gsap.to(this.camera.position, { z: 50, duration: 1.5, ease: 'power2.inOut' });
  }

  zoomOut() {
    gsap.to(this.camera.position, { z: 80, duration: 1.5, ease: 'power2.inOut' });
  }

  explode() {
    if (!this.objects.particles) return;
    gsap.to(this.objects.particles.rotation, {
      y: this.objects.particles.rotation.y + Math.PI * 2,
      duration: 1.5,
      ease: 'power4.out'
    });
    gsap.to(this.objects.particles.scale, {
      x: 1.3, y: 1.3, z: 1.3,
      duration: 0.5,
      yoyo: true, repeat: 1,
      ease: 'power2.out'
    });
  }

  // ──────────────────────────────────────────
  // EVENTS & UTILITIES
  // ──────────────────────────────────────────

  _bindEvents() {
    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('mousemove', this._mouseMoveHandler);
  }

  _onResize() {
    if (!this.renderer || !this.camera) return;
    const vp = document.getElementById('virtual-viewport');
    const w = vp ? (vp.clientWidth || 1440) : (this.canvas.clientWidth || window.innerWidth);
    const h = vp ? (vp.clientHeight || 900) : (this.canvas.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _onMouseMove(e) {
    this.mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouseTarget.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  _aspect() {
    const vp = document.getElementById('virtual-viewport');
    if (vp && vp.clientWidth && vp.clientHeight) {
      return vp.clientWidth / vp.clientHeight;
    }
    return (this.canvas.clientWidth || 1440) / (this.canvas.clientHeight || 900);
  }

  destroy() {
    cancelAnimationFrame(this.animFrame);
    window.removeEventListener('resize', this._resizeHandler);
    window.removeEventListener('mousemove', this._mouseMoveHandler);
    if (this.canvas && this.canvas.removeEventListener) {
      this.canvas.removeEventListener('webglcontextlost', this._contextLostHandler);
      this.canvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler);
    }
    this._clearScene();
    this.renderer?.dispose();
    this.isRunning = false;
  }
}
