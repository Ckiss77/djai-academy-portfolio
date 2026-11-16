import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const section = document.getElementById("particleStory");
const stage = document.getElementById("particleStoryStage");
const canvas = document.getElementById("particleCanvas");
const fallback = document.getElementById("particleFallback");
const controls = document.getElementById("particleControls");
const progressFill = document.getElementById("particleProgressFill");

if (!section || !stage || !canvas || !fallback || !controls || !progressFill) {
  // The particle stage is optional on pages that do not include the portfolio.
} else {
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stageDetails = [
    { name: "Signal", note: "A clear point of connection." },
    { name: "Momentum", note: "Ideas gather energy." },
    { name: "Network", note: "Possibilities connect across boundaries." },
    { name: "Identity", note: "The DJAI mark comes into focus." },
  ];
  const chapterCount = document.getElementById("particleChapterCount");
  const chapterName = document.getElementById("particleChapterName");
  const chapterNote = document.getElementById("particleChapterNote");
  const stepButtons = Array.from(controls.querySelectorAll("[data-particle-step]"));
  const scrollState = { morph: 0 };

  let renderer = null;
  let scene = null;
  let camera = null;
  let particleGroup = null;
  let particleGeometry = null;
  let particleMaterial = null;
  let animationFrame = 0;
  let isNearViewport = false;
  let activeChapter = -1;
  let resizeObserver = null;
  let intersectionObserver = null;
  let rendererReady = false;
  let rendererStarting = false;
  let failed = false;
  let logoImage = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastPixelRatio = 0;
  let media = null;

  const vertexShader = `
    precision highp float;
    uniform float uTime;
    uniform float uMorph;
    uniform float uPixelRatio;
    uniform vec2 uPointer;
    attribute vec3 aEnergy;
    attribute vec3 aGlobe;
    attribute vec3 aLogo;
    attribute float aSeed;
    attribute float aSize;
    varying vec3 vColor;
    varying float vAlpha;

    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(vec4(i, 0.0)).xyz;
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      float progress = clamp(uMorph, 0.0, 2.99999);
      vec3 basePosition;
      if (progress < 1.0) {
        basePosition = mix(position, aEnergy, smoothstep(0.0, 1.0, progress));
      } else if (progress < 2.0) {
        basePosition = mix(aEnergy, aGlobe, smoothstep(1.0, 2.0, progress));
      } else {
        basePosition = mix(aGlobe, aLogo, smoothstep(2.0, 3.0, progress));
      }

      float time = uTime * 0.22;
      vec3 flowPoint = basePosition * 1.25 + vec3(aSeed * 4.0, 0.0, 0.0);
      vec3 flow = vec3(
        snoise(flowPoint + vec3(time, aSeed, 0.0)),
        snoise(flowPoint + vec3(8.7, time * 0.82, aSeed)),
        snoise(flowPoint + vec3(aSeed, 3.4, time * 0.74))
      );
      float ambientAmount = mix(0.004, 0.02, smoothstep(0.05, 0.5, uMorph));
      vec3 positionWithFlow = basePosition + flow * ambientAmount;
      positionWithFlow.x += sin(time * 0.62 + aSeed * 18.0) * 0.005 + uPointer.x * basePosition.z * 0.045;
      positionWithFlow.y += cos(time * 0.51 + aSeed * 13.0) * 0.005 + uPointer.y * basePosition.z * 0.035;

      vec4 viewPosition = modelViewMatrix * vec4(positionWithFlow, 1.0);
      gl_Position = projectionMatrix * viewPosition;
      float depthScale = clamp(7.0 / -viewPosition.z, 0.62, 1.65);
      gl_PointSize = aSize * uPixelRatio * depthScale;

      vec3 coolBlue = vec3(0.27, 0.64, 1.0);
      vec3 iceWhite = vec3(0.9, 0.97, 1.0);
      vColor = mix(coolBlue, iceWhite, smoothstep(0.36, 0.94, aSeed));
      vAlpha = mix(0.58, 0.96, aSeed) * (0.9 + 0.1 * sin(uTime * 0.55 + aSeed * 14.0));
    }
  `;

  const fragmentShader = `
    precision highp float;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec2 point = gl_PointCoord - 0.5;
      float radius = length(point) * 2.0;
      float core = 1.0 - smoothstep(0.12, 0.72, radius);
      float halo = exp(-radius * 4.8) * (1.0 - smoothstep(0.25, 1.0, radius));
      float intensity = core * 1.08 + halo * 1.12;
      gl_FragColor = vec4(vColor * intensity, vAlpha * intensity);
    }
  `;

  function makeRandom(seed = 91731) {
    let state = seed >>> 0;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function inFinderPattern(x, y, left, top) {
    const dx = x - left;
    const dy = y - top;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
    return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
  }

  function createQrFormation(count, random) {
    const cells = [];
    const origin = 4;
    const qrSize = 33;
    const gridSize = 41;
    for (let y = 0; y < qrSize; y += 1) {
      for (let x = 0; x < qrSize; x += 1) {
        const gx = x + origin;
        const gy = y + origin;
        const finders = [
          inFinderPattern(x, y, 0, 0),
          inFinderPattern(x, y, qrSize - 7, 0),
          inFinderPattern(x, y, 0, qrSize - 7),
        ];
        let active = finders.find((value) => value !== null);
        if (active === undefined) {
          if (x === 6 || y === 6) active = (x + y) % 2 === 0;
          else {
            const hash = (x * 374761393 + y * 668265263 + x * y * 2246822519) >>> 0;
            active = ((Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0) % 100) > 50;
          }
        }
        if (active) cells.push([gx, gy]);
      }
    }

    const positions = new Float32Array(count * 3);
    const cellWidth = 3.42 / gridSize;
    const pointsPerCell = Math.ceil(count / cells.length);
    const columns = Math.ceil(Math.sqrt(pointsPerCell));
    const pointsPerRow = Math.ceil(pointsPerCell / columns);
    const subCellStep = 0.76 / columns;
    for (let index = 0; index < count; index += 1) {
      const cell = cells[Math.min(cells.length - 1, Math.floor(index / pointsPerCell))];
      const pointInCell = index % pointsPerCell;
      const column = pointInCell % columns;
      const row = Math.floor(pointInCell / columns) % pointsPerRow;
      const offset = index * 3;
      positions[offset] = (cell[0] - gridSize / 2 + (column - (columns - 1) / 2) * subCellStep + (random() - 0.5) * 0.025) * cellWidth;
      positions[offset + 1] = (gridSize / 2 - cell[1] - (row - (pointsPerRow - 1) / 2) * subCellStep + (random() - 0.5) * 0.025) * cellWidth;
      positions[offset + 2] = (random() - 0.5) * 0.16;
    }
    return positions;
  }

  function createEnergyFormation(count, random) {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      if (random() < 0.76) {
        const angle = random() * Math.PI * 2;
        const tube = random() * Math.PI * 2;
        const radius = 1.23 + 0.18 * Math.cos(tube);
        positions[offset] = Math.cos(angle) * radius;
        positions[offset + 1] = Math.sin(angle) * radius * 0.58;
        positions[offset + 2] = Math.sin(tube) * 0.24 + Math.sin(angle * 3.0 + tube) * 0.08;
      } else {
        const angle = random() * Math.PI * 2;
        const radius = 0.88 + random() * 0.95;
        const band = Math.floor(random() * 3) - 1;
        positions[offset] = Math.cos(angle) * radius;
        positions[offset + 1] = Math.sin(angle) * radius * 0.58;
        positions[offset + 2] = band * 0.24 + Math.sin(angle * 2.0) * 0.11;
      }
    }
    return positions;
  }

  function createGlobeFormation(count, random) {
    const positions = new Float32Array(count * 3);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      let x;
      let y;
      let z;
      if (index % 4 === 0) {
        const latitude = (Math.floor(random() * 13) - 6) * 0.22;
        const longitude = random() * Math.PI * 2;
        const radius = Math.cos(latitude);
        x = radius * Math.cos(longitude);
        y = Math.sin(latitude);
        z = radius * Math.sin(longitude);
      } else {
        y = 1 - (index / Math.max(1, count - 1)) * 2;
        const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
        const longitude = index * goldenAngle + (random() - 0.5) * 0.08;
        x = Math.cos(longitude) * ringRadius;
        z = Math.sin(longitude) * ringRadius;
      }
      const radius = 1.48 + (random() - 0.5) * 0.045;
      positions[offset] = x * radius;
      positions[offset + 1] = y * radius;
      positions[offset + 2] = z * radius;
    }
    return positions;
  }

  function createLogoFormation(count, random, sourceImage) {
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 320;
    sampleCanvas.height = 320;
    const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not read the DJAI mark image.");

    context.fillStyle = "#000";
    context.fillRect(0, 0, 320, 320);
    context.drawImage(sourceImage, 0, 0, 320, 320);
    const pixels = context.getImageData(0, 0, 320, 320).data;
    const candidates = [];
    for (let y = 0; y < 320; y += 1) {
      for (let x = 0; x < 320; x += 1) {
        const pixel = (y * 320 + x) * 4;
        const brightness = pixels[pixel] + pixels[pixel + 1] + pixels[pixel + 2];
        if (brightness > 170) candidates.push([x, y]);
      }
    }
    if (!candidates.length) throw new Error("The DJAI mark has no visible pixels to sample.");

    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const point = candidates[Math.floor(random() * candidates.length)];
      const offset = index * 3;
      positions[offset] = ((point[0] / 320) - 0.5) * 3.5;
      positions[offset + 1] = (0.5 - point[1] / 320) * 3.5;
      positions[offset + 2] = (random() - 0.5) * 0.16;
    }
    return positions;
  }

  function selectParticleCount(width) {
    const mobile = width <= 680;
    const tablet = width <= 980;
    const deviceMemory = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    let count = mobile ? 1900 : tablet ? 4300 : 8500;
    if (deviceMemory <= 4 || cores <= 4) count = Math.min(count, mobile ? 1400 : 4800);
    return count;
  }

  function updateChapter(progress) {
    const chapter = Math.min(3, Math.round(progress * 3));
    if (chapter !== activeChapter) {
      activeChapter = chapter;
      const detail = stageDetails[chapter];
      chapterCount.textContent = `0${chapter + 1} / 04`;
      chapterName.textContent = detail.name;
      chapterNote.textContent = detail.note;
      stepButtons.forEach((button, index) => {
        button.setAttribute("aria-pressed", String(index === chapter));
      });
    }
    progressFill.style.transform = `scaleX(${progress})`;
    canvas.dataset.progress = progress.toFixed(3);
    if (particleMaterial) particleMaterial.uniforms.uMorph.value = progress * 3;
  }

  function buildGeometry() {
    const width = stage.clientWidth;
    const count = selectParticleCount(width);
    const random = makeRandom(352710 + count);
    const qr = createQrFormation(count, random);
    const energy = createEnergyFormation(count, random);
    const globe = createGlobeFormation(count, random);
    const logo = createLogoFormation(count, random, logoImage);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      seeds[index] = random();
      sizes[index] = 1.8 + random() * 2.7;
    }

    particleGeometry?.dispose();
    particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(qr, 3));
    particleGeometry.setAttribute("aEnergy", new THREE.BufferAttribute(energy, 3));
    particleGeometry.setAttribute("aGlobe", new THREE.BufferAttribute(globe, 3));
    particleGeometry.setAttribute("aLogo", new THREE.BufferAttribute(logo, 3));
    particleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    particleGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    if (!particleMaterial) {
      particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uMorph: { value: scrollState.morph },
          uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, width <= 680 ? 1.2 : 1.5) },
          uPointer: { value: new THREE.Vector2(0, 0) },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    }

    if (particleGroup) {
      const oldPoints = particleGroup.children[0];
      if (oldPoints) particleGroup.remove(oldPoints);
    }
    const points = new THREE.Points(particleGeometry, particleMaterial);
    points.frustumCulled = false;
    particleGroup.add(points);
    canvas.dataset.particleCount = String(count);
    particleMaterial.uniforms.uMorph.value = scrollState.morph;
  }

  function resizeScene() {
    if (!renderer || !camera || !stage.clientWidth || !stage.clientHeight) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, width <= 680 ? 1.2 : 1.5);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (Math.abs(pixelRatio - lastPixelRatio) > 0.01) {
      renderer.setPixelRatio(pixelRatio);
      lastPixelRatio = pixelRatio;
      particleMaterial.uniforms.uPixelRatio.value = pixelRatio;
    }
    if (width !== lastWidth || height !== lastHeight) {
      renderer.setSize(width, height, false);
      lastWidth = width;
      lastHeight = height;
      const aspect = width / height;
      particleGroup.position.x = aspect > 1.7 ? 2.0 : aspect > 1.25 ? 1.35 : 0;
      particleGroup.position.y = aspect < 0.8 ? -1.45 : aspect < 1.15 ? -0.58 : 0;
      const formationScale = aspect < 0.8 ? 0.64 : aspect < 1.15 ? 0.78 : 1;
      particleGroup.scale.setScalar(formationScale);
      if (selectParticleCount(width) !== Number(canvas.dataset.particleCount)) buildGeometry();
    }
  }

  function showStaticFallback(reason = "static") {
    failed = reason === "error";
    section.dataset.renderer = "static";
    fallback.hidden = false;
    canvas.hidden = true;
    stopAnimation();
    disposeRenderer();
  }

  function disposeRenderer() {
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    particleGeometry?.dispose();
    particleGeometry = null;
    particleMaterial?.dispose();
    particleMaterial = null;
    particleGroup?.clear();
    particleGroup = null;
    scene = null;
    camera = null;
    rendererReady = false;
  }

  function renderFrame(now) {
    animationFrame = 0;
    if (!renderer || !rendererReady || !isNearViewport || document.hidden || reducedMotionQuery.matches) return;
    particleMaterial.uniforms.uTime.value = now * 0.001;
    particleGroup.rotation.y = Math.sin(now * 0.00008) * 0.018;
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(renderFrame);
  }

  function startAnimation() {
    if (!animationFrame && rendererReady && isNearViewport && !document.hidden && !reducedMotionQuery.matches) {
      animationFrame = window.requestAnimationFrame(renderFrame);
    }
  }

  function stopAnimation() {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  async function initializeRenderer() {
    if (rendererReady || rendererStarting || failed || reducedMotionQuery.matches || !isNearViewport) return;
    rendererStarting = true;
    try {
      logoImage = new Image();
      logoImage.src = new URL("assets/djai-circle.png", document.baseURI).href;
      await logoImage.decode();
      if (!isNearViewport || reducedMotionQuery.matches) return;
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
        depth: true,
        stencil: false,
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, stage.clientWidth <= 680 ? 1.2 : 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, stage.clientWidth / stage.clientHeight, 0.1, 60);
      camera.position.set(0, 0, 7.6);
      particleGroup = new THREE.Group();
      scene.add(particleGroup);
      buildGeometry();
      resizeScene();
      renderer.compile(scene, camera);
      rendererReady = true;
      section.dataset.renderer = "webgl";
      canvas.hidden = false;
      fallback.hidden = true;
      startAnimation();
    } catch (error) {
      console.warn("DJAI particle stage is using its static fallback.", error);
      showStaticFallback("error");
    } finally {
      rendererStarting = false;
    }
  }

  function updateVisibility(entries) {
    const entry = entries[0];
    isNearViewport = entry.isIntersecting;
    if (isNearViewport) initializeRenderer();
    if (isNearViewport && rendererReady) startAnimation();
    else stopAnimation();
  }

  function scrollToFormation(index) {
    const trigger = ScrollTrigger.getById("particle-story");
    if (!trigger) return;
    const progress = index / 3;
    const target = trigger.start + (trigger.end - trigger.start) * progress;
    window.scrollTo({ top: target, behavior: reducedMotionQuery.matches ? "auto" : "smooth" });
  }

  function createScrollMotion() {
    if (reducedMotionQuery.matches) {
      updateChapter(0);
      showStaticFallback("reduced-motion");
      return;
    }

    const context = gsap.matchMedia();
    context.add("(min-width: 981px)", () => {
      const tween = gsap.to(scrollState, {
        morph: 3,
        ease: "none",
        onUpdate: () => updateChapter(scrollState.morph / 3),
        scrollTrigger: {
          id: "particle-story",
          trigger: section,
          start: "top top",
          end: () => `+=${Math.round(window.innerHeight * 2.35)}`,
          pin: stage,
          scrub: 0.7,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: () => updateChapter(scrollState.morph / 3),
        },
      });
      return () => tween.kill();
    });

    context.add("(max-width: 980px)", () => {
      const tween = gsap.to(scrollState, {
        morph: 3,
        ease: "none",
        onUpdate: () => updateChapter(scrollState.morph / 3),
        scrollTrigger: {
          id: "particle-story",
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.45,
          invalidateOnRefresh: true,
          onRefresh: () => updateChapter(scrollState.morph / 3),
        },
      });
      return () => tween.kill();
    });

    media = context;
  }

  function onReducedMotionChange() {
    if (reducedMotionQuery.matches) {
      media?.revert();
      media = null;
      showStaticFallback("reduced-motion");
    }
    else {
      failed = false;
      section.dataset.renderer = "loading";
      canvas.hidden = false;
      fallback.hidden = false;
      createScrollMotion();
      initializeRenderer();
    }
  }

  stepButtons.forEach((button) => {
    button.addEventListener("click", () => scrollToFormation(Number(button.dataset.particleStep)));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAnimation();
    else startAnimation();
  });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    showStaticFallback("error");
  });
  reducedMotionQuery.addEventListener("change", onReducedMotionChange);

  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(resizeScene);
    resizeObserver.observe(stage);
  } else {
    window.addEventListener("resize", resizeScene);
  }
  intersectionObserver = new IntersectionObserver(updateVisibility, { rootMargin: "140px 0px" });
  intersectionObserver.observe(section);
  createScrollMotion();

  window.addEventListener("pagehide", () => {
    stopAnimation();
    intersectionObserver?.disconnect();
    resizeObserver?.disconnect();
    media?.revert();
    reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
    disposeRenderer();
  }, { once: true });
}
