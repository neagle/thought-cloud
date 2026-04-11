"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AudioAnalyzer } from "@/lib/audio/AudioAnalyzer";
import { PresetsPanel } from "@/components/PresetsPanel";
import type { Channel } from "@/types";

export type Controls = {
  masterIntensity: number;
  idleDrift: number;
  agitationGain: number;
  sparkThreshold: number;
  sparkBurstSize: number;
  haloStrength: number;
  coreStrength: number;
  coreHue: number;
  coreSize: number;
  coreElongation: number;
  bloomBias: number;
  rotationDrift: number;
  speechBias: number;
  flowSmoothing: number;
  cohesion: number;
  turbulence: number;
  saturation: number;
  baseHue: number;
  accentHue: number;
  highlightHue: number;
  hueDrift: number;
  speechColorBoost: number;
  sustainBackoff: number;
  fireflyChance: number;
  fireflyHold: number;
  fireflyFade: number;
};

interface Props {
  audioStarted: boolean;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  initialControls: Controls;
  audioAnalyzer: AudioAnalyzer | null;
  kioskMode: boolean;
  channel: Channel;
  externalControls?: Controls;
  transitionDuration?: number;
  onControlsChange?: (c: Controls) => void;
  onLoadPreset?: (data: Record<string, number>) => void;
}

type Spark = {
  life: number;
  decay: number;
  velocity: THREE.Vector3;
  base: THREE.Vector3;
};

type FireflyOverlay = {
  active: boolean;
  life: number;
  maxLife: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  drift: THREE.Vector3;
  flickerOffset: number;
  strength: number;
  hueOffset: number;
};

type FlowAnchor = {
  base: THREE.Vector3;
  current: THREE.Vector3;
  velocity: THREE.Vector3;
  axis: THREE.Vector3;
  phase: number;
  phase2: number;
  radius: number;
};

type MonitorSignalKey =
  | "level"
  | "presence"
  | "attack"
  | "brightness"
  | "speaking"
  | "response"
  | "adaptive"
  | "agitation";

const MONITOR_SERIES: Array<{
  key: MonitorSignalKey;
  label: string;
  color: string;
}> = [
  { key: "level", label: "Level", color: "#66d9ff" },
  { key: "presence", label: "Presence", color: "#66ffb5" },
  { key: "attack", label: "Attack", color: "#ff8ec7" },
  { key: "brightness", label: "Brightness", color: "#ffd56b" },
  { key: "speaking", label: "Speaking", color: "#b5a5ff" },
  { key: "response", label: "Response", color: "#ffffff" },
  { key: "adaptive", label: "Adaptive", color: "#8fffd0" },
  { key: "agitation", label: "Agitation", color: "#ff9f66" },
];

const MONITOR_HISTORY_LENGTH = 220;

function makeMonitorHistory(): Record<MonitorSignalKey, number[]> {
  const base = new Array(MONITOR_HISTORY_LENGTH).fill(0);
  return {
    level: [...base],
    presence: [...base],
    attack: [...base],
    brightness: [...base],
    speaking: [...base],
    response: [...base],
    adaptive: [...base],
    agitation: [...base],
  };
}

function pushMonitorSample(
  history: Record<MonitorSignalKey, number[]>,
  key: MonitorSignalKey,
  value: number,
) {
  const samples = history[key];
  samples.push(clamp(value, 0, 1));
  if (samples.length > MONITOR_HISTORY_LENGTH) {
    samples.shift();
  }
}

const rand = THREE.MathUtils.randFloatSpread;
const clamp = THREE.MathUtils.clamp;
const BASE_MAX_PARTICLE_RADIUS = 2.75;

function wrapHue(value: number) {
  return THREE.MathUtils.euclideanModulo(value, 1);
}

const COLOR_PRESETS = [
  {
    name: "Calm Indigo",
    values: {
      baseHue: 0.56,
      accentHue: 0.72,
      highlightHue: 0.1,
      hueDrift: 0.018,
      speechColorBoost: 1,
      fireflyChance: 0.08,
      fireflyHold: 0.14,
      fireflyFade: 0.64,
    },
  },
  {
    name: "Thoughtflare Violet",
    values: {
      baseHue: 0.63,
      accentHue: 0.8,
      highlightHue: 0.06,
      hueDrift: 0.024,
      speechColorBoost: 1.28,
      fireflyChance: 0.12,
      fireflyHold: 0.18,
      fireflyFade: 0.9,
    },
  },
  {
    name: "Warm Recognition",
    values: {
      baseHue: 0.53,
      accentHue: 0.68,
      highlightHue: 0.12,
      hueDrift: 0.021,
      speechColorBoost: 1.36,
      fireflyChance: 0.1,
      fireflyHold: 0.16,
      fireflyFade: 0.82,
    },
  },
  {
    name: "Volcanic + Blue",
    values: {
      baseHue: 0.03,
      accentHue: 0.61,
      highlightHue: 0.14,
      hueDrift: 0.015,
      speechColorBoost: 1.45,
      fireflyChance: 0.2,
      fireflyHold: 0.2,
      fireflyFade: 1.05,
    },
  },
] as const;

function makeSpriteTexture(inner: string, outer: string) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.28, inner);
  gradient.addColorStop(1, outer);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Dither: add gaussian noise to break up radial gradient banding.
  const imageData = ctx.getImageData(0, 0, size, size);
  const px = imageData.data;
  for (let i = 0; i < px.length; i += 4) {
    // Box-Muller gaussian noise, ~σ=4 (invisible at rest, eliminates banding)
    const u = Math.random() || 1e-10;
    const v = Math.random();
    const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * 4;
    px[i + 3] = Math.max(0, Math.min(255, px[i + 3] + g));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function randomUnitVector() {
  return new THREE.Vector3(rand(2), rand(2), rand(2)).normalize();
}

export function ThoughtOrbScene({
  audioStarted,
  panelOpen,
  setPanelOpen,
  initialControls,
  audioAnalyzer,
  kioskMode,
  channel,
  externalControls,
  transitionDuration = 0,
  onControlsChange,
  onLoadPreset,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<Controls>(initialControls);
  const controlsTransitionRef = useRef<{
    from: Record<string, number>;
    to: Record<string, number>;
    startMs: number;
    durationMs: number;
  } | null>(null);
  const audioRef = useRef<AudioAnalyzer | null>(audioAnalyzer);
  const monitorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const monitorHistoryRef =
    useRef<Record<MonitorSignalKey, number[]>>(makeMonitorHistory());
  const monitorSignalsRef = useRef<Record<MonitorSignalKey, number>>({
    level: 0,
    presence: 0,
    attack: 0,
    brightness: 0,
    speaking: 0,
    response: 0,
    adaptive: 0,
    agitation: 0,
  });
  const [error, setError] = useState<string | null>(null);
  void setError; // error surfaced via audioError in page.tsx; kept for potential future use
  const [monitorOpen, setMonitorOpen] = useState(true);
  const [, forceRender] = useState(0);
  const [, forceMonitorRender] = useState(0);

  useEffect(() => {
    audioRef.current = audioAnalyzer;
  }, [audioAnalyzer]);

  useEffect(() => {
    if (!externalControls) return;
    if (transitionDuration <= 0) {
      Object.assign(controlsRef.current, externalControls);
      controlsTransitionRef.current = null;
      forceRender((n) => n + 1);
      return;
    }
    const keys = Object.keys(externalControls) as (keyof Controls)[];
    const from: Record<string, number> = {};
    const to: Record<string, number> = {};
    for (const k of keys) {
      from[k] = controlsRef.current[k] as number;
      to[k] = externalControls[k] as number;
    }
    controlsTransitionRef.current = {
      from,
      to,
      startMs: performance.now(),
      durationMs: transitionDuration * 1000,
    };
  }, [externalControls, transitionDuration]);

  useEffect(() => {
    if (!monitorOpen) return;
    const interval = window.setInterval(() => {
      forceMonitorRender((n) => n + 1);
    }, 120);
    return () => window.clearInterval(interval);
  }, [monitorOpen]);

  useEffect(() => {
    if (!monitorOpen) return;
    const canvasEl = monitorCanvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext(
      "2d",
    ) as CanvasRenderingContext2D | null;
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    let frameId = 0;

    function draw() {
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(180,220,255,0.16)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i += 1) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const history = monitorHistoryRef.current;
      for (const series of MONITOR_SERIES) {
        const samples = history[series.key];
        if (samples.length < 2) continue;
        ctx.beginPath();
        ctx.strokeStyle = series.color;
        ctx.lineWidth = series.key === "response" ? 2.1 : 1.35;
        for (let i = 0; i < samples.length; i += 1) {
          const t = i / (samples.length - 1);
          const x = t * width;
          const y = height - samples[i] * (height - 2) - 1;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      frameId = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(frameId);
  }, [monitorOpen]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.z = 7.2;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const haloTexture = makeSpriteTexture(
      "rgba(210,248,255,1)",
      "rgba(158,240,255,0)",
    );

    const sparkTexture = makeSpriteTexture(
      "rgba(255,210,255,1)",
      "rgba(255,210,255,0)",
    );

    const fireflyTexture = makeSpriteTexture(
      "rgba(255,245,180,1)",
      "rgba(255,200,40,0)",
    );
    const fieldTexture = makeSpriteTexture(
      "rgba(220,248,255,1)",
      "rgba(140,220,255,0)",
    );

    const particleCount = 980;
    // const particleCount = 2980;
    // const particleCount = 80;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const seeds = new Float32Array(particleCount);
    const bases = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const radii = new Float32Array(particleCount);
    const fireflyLife = new Float32Array(particleCount);
    const fireflyIntensity = new Float32Array(particleCount);
    const fireflyBurstCount = 4;
    const fireflyBurstLife = new Float32Array(fireflyBurstCount);
    const fireflyBurstAnchor = new Uint8Array(fireflyBurstCount);
    const fireflyBurstStrength = new Float32Array(fireflyBurstCount);

    const flowAnchorCount = 18;
    const flowAnchors: FlowAnchor[] = [];
    const primaryAnchor = new Uint8Array(particleCount);
    const secondaryAnchor = new Uint8Array(particleCount);
    const anchorBlend = new Float32Array(particleCount);

    const colorA = new THREE.Color("#3645ff");
    const colorB = new THREE.Color("#54e0ff");
    const colorC = new THREE.Color("#b86fff");
    const mixed = new THREE.Color();
    const tempVecA = new THREE.Vector3();
    const tempVecB = new THREE.Vector3();
    const tempVecC = new THREE.Vector3();
    const tempVecD = new THREE.Vector3();

    for (let i = 0; i < flowAnchorCount; i += 1) {
      const base = randomUnitVector().multiplyScalar(
        0.45 + Math.random() * 1.05,
      );
      flowAnchors.push({
        base: base.clone(),
        current: base.clone(),
        velocity: new THREE.Vector3(),
        axis: randomUnitVector(),
        phase: Math.random() * Math.PI * 2,
        phase2: Math.random() * Math.PI * 2,
        radius: 0.85 + Math.random() * 0.7,
      });
    }

    for (let i = 0; i < particleCount; i += 1) {
      const r = Math.pow(Math.random(), 1.08) * 1.42;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      bases[i * 3] = x;
      bases[i * 3 + 1] = y;
      bases[i * 3 + 2] = z;
      radii[i] = r;
      seeds[i] = Math.random() * Math.PI * 2;

      mixed
        .copy(colorA)
        .lerp(colorB, Math.random())
        .lerp(colorC, Math.random() * 0.35);
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;

      let bestIndex = 0;
      let secondIndex = 1;
      let bestDistance = Infinity;
      let secondDistance = Infinity;
      tempVecA.set(x, y, z);
      for (let j = 0; j < flowAnchors.length; j += 1) {
        const distance = tempVecA.distanceToSquared(flowAnchors[j].base);
        if (distance < bestDistance) {
          secondDistance = bestDistance;
          secondIndex = bestIndex;
          bestDistance = distance;
          bestIndex = j;
        } else if (distance < secondDistance) {
          secondDistance = distance;
          secondIndex = j;
        }
      }

      primaryAnchor[i] = bestIndex;
      secondaryAnchor[i] = secondIndex;
      const invA = 1 / (bestDistance + 0.0001);
      const invB = 1 / (secondDistance + 0.0001);
      anchorBlend[i] = invA / (invA + invB);
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    particleGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3),
    );

    const particleMaterial = new THREE.PointsMaterial({
      map: fieldTexture,
      size: 0.22,
      transparent: true,
      opacity: 0.94,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    group.add(particles);

    const haloMaterial = new THREE.SpriteMaterial({
      map: haloTexture,
      color: new THREE.Color("#65dfff"),
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Sprite(haloMaterial);
    halo.scale.set(8.8, 8.8, 1);
    // scene.add(halo);

    const outerHaloMaterial = new THREE.SpriteMaterial({
      map: haloTexture,
      color: new THREE.Color("#7e68ff"),
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const outerHalo = new THREE.Sprite(outerHaloMaterial);
    outerHalo.scale.set(11.6, 11.6, 1);
    // scene.add(outerHalo);

    const bloomCoreMaterial = new THREE.SpriteMaterial({
      map: haloTexture,
      color: new THREE.Color("#b7f6ff"),
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const bloomCore = new THREE.Sprite(bloomCoreMaterial);
    bloomCore.scale.set(4.9, 4.9, 1);
    // scene.add(bloomCore);

    const coreMaterial = new THREE.SpriteMaterial({
      map: haloTexture,
      color: new THREE.Color("#c4f3ff"),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Sprite(coreMaterial);
    core.scale.set(3.2, 3.2, 1);
    scene.add(core);

    const sparkCount = 120;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkColors = new Float32Array(sparkCount * 3);
    const sparks: Spark[] = [];
    for (let i = 0; i < sparkCount; i += 1) {
      sparkColors[i * 3] = 1;
      sparkColors[i * 3 + 1] = 0.72;
      sparkColors[i * 3 + 2] = 1;
      sparks.push({
        life: 0,
        decay: 0.01,
        velocity: new THREE.Vector3(),
        base: new THREE.Vector3(),
      });
    }
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(sparkPositions, 3),
    );
    sparkGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(sparkColors, 3),
    );
    const sparkMaterial = new THREE.PointsMaterial({
      map: sparkTexture,
      size: 0.28,
      transparent: true,
      opacity: 1,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const sparkPoints = new THREE.Points(sparkGeometry, sparkMaterial);
    scene.add(sparkPoints);

    const fireflyOverlayCount = 120;
    const fireflyOverlayPositions = new Float32Array(fireflyOverlayCount * 3);
    const fireflyOverlayColors = new Float32Array(fireflyOverlayCount * 3);
    const fireflies: FireflyOverlay[] = [];

    for (let i = 0; i < fireflyOverlayCount; i += 1) {
      const ix = i * 3;
      fireflyOverlayPositions[ix] = 999;
      fireflyOverlayPositions[ix + 1] = 999;
      fireflyOverlayPositions[ix + 2] = 999;

      fireflyOverlayColors[ix] = 1;
      fireflyOverlayColors[ix + 1] = 0.92;
      fireflyOverlayColors[ix + 2] = 0.18;

      fireflies.push({
        active: false,
        life: 0,
        maxLife: 0,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        drift: new THREE.Vector3(),
        flickerOffset: Math.random() * Math.PI * 2,
        strength: 1,
        hueOffset: rand(0.06),
      });
    }

    const fireflyOverlayGeometry = new THREE.BufferGeometry();
    fireflyOverlayGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(fireflyOverlayPositions, 3),
    );
    fireflyOverlayGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(fireflyOverlayColors, 3),
    );

    const fireflyOverlayMaterial = new THREE.PointsMaterial({
      map: fireflyTexture,
      size: 1.22,
      transparent: true,
      opacity: 1,
      vertexColors: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const fireflyPoints = new THREE.Points(
      fireflyOverlayGeometry,
      fireflyOverlayMaterial,
    );
    scene.add(fireflyPoints);

    const ambientLight = new THREE.AmbientLight("#6aa7ff", 0.2);
    scene.add(ambientLight);

    const clock = new THREE.Clock();
    let frameId = 0;
    let sustainedAccumulator = 0;
    let previousResponseEnergy = 0;
    let previousNovelty = 0;
    let fireflyOverlayCooldown = 0;
    let fireflyBurstCooldown = 0;
    let fireflyEmissionBudget = 0;

    function activateFirefly(index: number, strength: number) {
      const controls = controlsRef.current;
      const ix = index * 3;
      fireflyLife[index] =
        controls.fireflyHold +
        controls.fireflyFade * (0.9 + Math.random() * 0.45);
      fireflyIntensity[index] = clamp(
        1.02 + strength * 0.55 + Math.random() * 0.28,
        0,
        1.6,
      );

      const px = positions[ix];
      const py = positions[ix + 1];
      const pz = positions[ix + 2];
      const invRadius = 1 / Math.max(0.001, Math.hypot(px, py, pz));
      const nx = px * invRadius;
      const ny = py * invRadius;
      const nz = pz * invRadius;
      const tx = -ny + rand(0.8) * 0.25;
      const ty = nx + rand(0.8) * 0.25;
      const tz = rand(0.8) * 0.28;
      const kick = (0.0024 + strength * 0.0038) * (0.7 + Math.random() * 0.7);

      velocities[ix] += (nx * 0.65 + tx * 0.35) * kick;
      velocities[ix + 1] += (ny * 0.65 + ty * 0.35) * kick;
      velocities[ix + 2] += (nz * 0.65 + tz * 0.35) * kick;
    }

    function spawnSparks(amount: number, intensity: number) {
      const usable = Math.min(amount, sparks.length);
      for (let i = 0; i < usable; i += 1) {
        const spark = sparks[i];
        if (spark.life > 0.05) continue;
        const origin = new THREE.Vector3(rand(1.3), rand(1.3), rand(1.3))
          .normalize()
          .multiplyScalar(0.6 + Math.random() * 0.9);
        spark.base.copy(origin);
        spark.velocity
          .copy(origin)
          .normalize()
          .multiplyScalar(0.012 + intensity * 0.03)
          .add(new THREE.Vector3(rand(0.008), rand(0.008), rand(0.008)));
        spark.life = 0.7 + Math.random() * 0.5;
        spark.decay = 0.012 + Math.random() * 0.016;
      }
    }

    function spawnOverlayFireflies(
      amount: number,
      strength: number,
      anchorIndex?: number,
    ) {
      let spawned = 0;

      for (let i = 0; i < fireflies.length && spawned < amount; i += 1) {
        const firefly = fireflies[i];
        if (firefly.active) continue;

        const origin =
          anchorIndex === undefined
            ? new THREE.Vector3(rand(1.2), rand(1.2), rand(1.2))
            : flowAnchors[anchorIndex].current
                .clone()
                .add(new THREE.Vector3(rand(0.8), rand(0.8), rand(0.8)));
        if (origin.lengthSq() < 0.001) {
          origin.set(0.3, 0.2, 0.1);
        }
        origin.normalize().multiplyScalar(0.75 + Math.random() * 1.35);

        const outward = origin.clone().normalize();
        const tangent = new THREE.Vector3(rand(0.8), rand(0.8), rand(0.8))
          .cross(outward)
          .normalize();

        firefly.active = true;
        const controls = controlsRef.current;
        firefly.life =
          0.75 +
          controls.fireflyHold +
          controls.fireflyFade * 1.3 +
          Math.random() * 1.1;
        firefly.maxLife = firefly.life;
        firefly.position.copy(origin);
        firefly.strength = clamp(1 + strength * 1.1, 1, 2.4);

        firefly.velocity
          .copy(outward)
          .multiplyScalar(0.012 + strength * 0.02)
          .addScaledVector(tangent, 0.007 + Math.random() * 0.01);

        firefly.drift.set(rand(0.0036), rand(0.0036), rand(0.0036));

        spawned += 1;
      }
    }

    function updateFlowAnchors(
      elapsed: number,
      agitation: number,
      speechEnergy: number,
      turbulence: number,
    ) {
      const fieldStrength =
        0.16 + agitation * 0.12 * turbulence + speechEnergy * 0.08;
      for (let i = 0; i < flowAnchors.length; i += 1) {
        const anchor = flowAnchors[i];
        const wobble = 0.04 + turbulence * 0.08 + speechEnergy * 0.05;
        anchor.current.set(
          anchor.base.x +
            Math.sin(elapsed * 0.08 + anchor.phase) * wobble +
            Math.cos(elapsed * 0.045 + anchor.phase2) * 0.04,
          anchor.base.y +
            Math.cos(elapsed * 0.075 + anchor.phase2) * wobble * 0.92 +
            Math.sin(elapsed * 0.04 + anchor.phase) * 0.03,
          anchor.base.z +
            Math.sin(elapsed * 0.06 + anchor.phase * 0.7) * wobble * 0.85,
        );

        tempVecA.copy(anchor.current).normalize();
        tempVecB.copy(anchor.axis).cross(tempVecA).normalize();
        if (tempVecB.lengthSq() < 0.0001) {
          tempVecB.set(0, 1, 0).cross(tempVecA).normalize();
        }
        tempVecC.copy(tempVecA).cross(tempVecB).normalize();

        anchor.velocity
          .copy(tempVecB)
          .multiplyScalar(
            Math.sin(elapsed * 0.11 + anchor.phase) * fieldStrength,
          )
          .addScaledVector(
            tempVecC,
            Math.cos(elapsed * 0.09 + anchor.phase2) * fieldStrength * 0.8,
          )
          .multiplyScalar(0.0065);
      }
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const delta = Math.min(clock.getDelta(), 0.033);

      // Lerp controls toward transition target if one is active
      const tr = controlsTransitionRef.current;
      if (tr) {
        const t = Math.min(1, (performance.now() - tr.startMs) / tr.durationMs);
        const eased = t * t * (3 - 2 * t); // smoothstep
        const c = controlsRef.current as unknown as Record<string, number>;
        for (const k in tr.from) {
          c[k] = tr.from[k] + (tr.to[k] - tr.from[k]) * eased;
        }
        if (t >= 1) controlsTransitionRef.current = null;
      }

      const controls = controlsRef.current;
      const signals = audioRef.current?.getSignals() ?? {
        level: 0,
        presence: 0,
        attack: 0,
        brightness: 0,
        speaking: 0,
      };

      const speechEnergy = clamp(signals.presence * controls.speechBias, 0, 1);
      const responseEnergy = clamp(
        Math.pow(speechEnergy, 0.72) * 1.15 +
          signals.attack * 0.62 +
          signals.level * 0.24,
        0,
        1,
      );

      const responseDelta = Math.abs(responseEnergy - previousResponseEnergy);
      previousResponseEnergy = responseEnergy;
      const novelty = clamp(signals.attack * 1.25 + responseDelta * 5.2, 0, 1);
      const noveltyRise = Math.max(0, novelty - previousNovelty);
      previousNovelty = novelty;
      const sustainedPortion = clamp(responseEnergy - novelty * 0.9, 0, 1);
      sustainedAccumulator = THREE.MathUtils.lerp(
        sustainedAccumulator,
        sustainedPortion,
        0.06 + controls.sustainBackoff * 0.22,
      );
      const adaptation = sustainedAccumulator * controls.sustainBackoff;
      const adaptiveResponse = clamp(
        responseEnergy * (1 - adaptation * 0.76) + novelty * 0.34,
        0,
        1,
      );

      fireflyOverlayCooldown = Math.max(0, fireflyOverlayCooldown - delta);

      const overlayTrigger =
        signals.attack > Math.max(0.02, controls.sparkThreshold * 0.72) ||
        novelty > 0.16 ||
        adaptiveResponse > 0.32 ||
        signals.speaking > 0.18;

      if (overlayTrigger && fireflyOverlayCooldown <= 0) {
        const amount =
          6 +
          Math.round(signals.attack * 16) +
          Math.round(adaptiveResponse * 8);

        const strength = clamp(
          signals.attack * 1.35 +
            adaptiveResponse * 0.95 +
            signals.speaking * 0.55,
          0.7,
          2.3,
        );

        spawnOverlayFireflies(amount, strength);

        fireflyOverlayCooldown =
          0.05 + (1 - clamp(signals.attack * 2 + novelty * 0.9, 0, 1)) * 0.08;
      }

      const agitation =
        controls.idleDrift +
        adaptiveResponse * controls.agitationGain +
        signals.attack * 1.2;
      const pulse = 1 + adaptiveResponse * 0.09 + signals.attack * 0.05;
      const haloPulse = 1 + adaptiveResponse * 0.16 + signals.brightness * 0.1;
      const thoughtBias = signals.speaking * 0.1 + signals.attack * 0.08;
      const damping = clamp(
        0.925 + controls.flowSmoothing * 0.055 - adaptiveResponse * 0.06,
        0.75 + controls.flowSmoothing * 0.09,
        0.985,
      );
      const fieldScale =
        (0.62 + controls.masterIntensity * 0.76) *
        (0.68 + agitation * 0.82 + adaptiveResponse * 0.42);
      const cohesionStrength =
        (0.0015 + controls.cohesion * 0.0024) *
        (1.35 - adaptiveResponse * 0.62);
      const centerBiasStrength =
        (0.00085 + controls.cohesion * 0.00085) *
        (1.2 - adaptiveResponse * 0.5);
      const centerBiasRadius = 1.55 + adaptiveResponse * 0.95;
      const shellBreathing = 1 + adaptiveResponse * 0.2 + signals.attack * 0.08;
      const sparkiness = 0.55 + adaptiveResponse * 0.85 + signals.attack * 0.4;
      const expansionKick = adaptiveResponse * 0.0018 + signals.attack * 0.0011;
      const dynamicMaxRadius =
        BASE_MAX_PARTICLE_RADIUS +
        adaptiveResponse * 1.45 +
        signals.attack * 0.7;

      monitorSignalsRef.current.level = signals.level;
      monitorSignalsRef.current.presence = signals.presence;
      monitorSignalsRef.current.attack = signals.attack;
      monitorSignalsRef.current.brightness = signals.brightness;
      monitorSignalsRef.current.speaking = signals.speaking;
      monitorSignalsRef.current.response = responseEnergy;
      monitorSignalsRef.current.adaptive = adaptiveResponse;
      monitorSignalsRef.current.agitation = clamp(agitation / 2.7, 0, 1);

      const monitorHistory = monitorHistoryRef.current;
      pushMonitorSample(monitorHistory, "level", signals.level);
      pushMonitorSample(monitorHistory, "presence", signals.presence);
      pushMonitorSample(monitorHistory, "attack", signals.attack);
      pushMonitorSample(monitorHistory, "brightness", signals.brightness);
      pushMonitorSample(monitorHistory, "speaking", signals.speaking);
      pushMonitorSample(monitorHistory, "response", responseEnergy);
      pushMonitorSample(monitorHistory, "adaptive", adaptiveResponse);
      pushMonitorSample(monitorHistory, "agitation", agitation / 2.7);

      updateFlowAnchors(elapsed, agitation, speechEnergy, controls.turbulence);

      const positionAttr = particleGeometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;

      for (let i = 0; i < particleCount; i += 1) {
        const ix = i * 3;
        const seed = seeds[i];
        const blend = anchorBlend[i];
        const anchorA = flowAnchors[primaryAnchor[i]];
        const anchorB = flowAnchors[secondaryAnchor[i]];

        tempVecA.set(positions[ix], positions[ix + 1], positions[ix + 2]);
        tempVecB.set(bases[ix], bases[ix + 1], bases[ix + 2]);

        const radius = tempVecA.length() || 0.0001;
        const baseRadius = radii[i] * shellBreathing;
        const radiusError = baseRadius - radius;

        tempVecC
          .copy(anchorA.velocity)
          .multiplyScalar(blend)
          .addScaledVector(anchorB.velocity, 1 - blend);

        tempVecD
          .copy(anchorA.current)
          .multiplyScalar(blend)
          .addScaledVector(anchorB.current, 1 - blend)
          .sub(tempVecA);

        const locality = clamp(1 - tempVecD.length() / 2.6, 0.18, 1);

        const tangentA = tempVecA
          .clone()
          .cross(anchorA.axis)
          .normalize()
          .multiplyScalar(blend);
        const tangentB = tempVecB
          .clone()
          .cross(anchorB.axis)
          .normalize()
          .multiplyScalar(1 - blend);
        const tangential = tangentA
          .add(tangentB)
          .multiplyScalar((0.0007 + thoughtBias * 0.001) * locality);

        const thoughtWave =
          Math.sin(
            elapsed * 0.12 + seed * 1.3 + tempVecB.x * 0.4 + tempVecB.z * 0.35,
          ) * 0.00075;
        const thoughtDrift = tempVecB
          .clone()
          .normalize()
          .multiplyScalar(thoughtWave * (0.35 + signals.speaking * 0.85));
        const centerBias = tempVecA
          .clone()
          .normalize()
          .multiplyScalar(
            -centerBiasStrength * Math.max(0, radius - centerBiasRadius),
          );
        const shellForce = tempVecA
          .clone()
          .normalize()
          .multiplyScalar(radiusError * cohesionStrength);
        const expansionForce = tempVecB
          .clone()
          .normalize()
          .multiplyScalar(expansionKick * locality);

        velocities[ix] =
          velocities[ix] * damping +
          (tempVecC.x * fieldScale * locality +
            tangential.x +
            thoughtDrift.x +
            shellForce.x +
            centerBias.x +
            expansionForce.x);
        velocities[ix + 1] =
          velocities[ix + 1] * damping +
          (tempVecC.y * fieldScale * locality +
            tangential.y +
            thoughtDrift.y +
            shellForce.y +
            centerBias.y +
            expansionForce.y);
        velocities[ix + 2] =
          velocities[ix + 2] * damping +
          (tempVecC.z * fieldScale * locality +
            tangential.z +
            thoughtDrift.z +
            shellForce.z +
            centerBias.z +
            expansionForce.z);

        positions[ix] += velocities[ix] * (0.95 + sparkiness * 0.02);
        positions[ix + 1] += velocities[ix + 1] * (0.95 + sparkiness * 0.02);
        positions[ix + 2] += velocities[ix + 2] * (0.95 + sparkiness * 0.02);

        const postRadius = Math.hypot(
          positions[ix],
          positions[ix + 1],
          positions[ix + 2],
        );
        if (postRadius > dynamicMaxRadius) {
          const recovery = clamp(
            (postRadius - dynamicMaxRadius) / 1.25,
            0.15,
            0.65,
          );
          positions[ix] = THREE.MathUtils.lerp(
            positions[ix],
            bases[ix],
            recovery,
          );
          positions[ix + 1] = THREE.MathUtils.lerp(
            positions[ix + 1],
            bases[ix + 1],
            recovery,
          );
          positions[ix + 2] = THREE.MathUtils.lerp(
            positions[ix + 2],
            bases[ix + 2],
            recovery,
          );
          velocities[ix] *= 0.55;
          velocities[ix + 1] *= 0.55;
          velocities[ix + 2] *= 0.55;
        }
      }

      positionAttr.needsUpdate = true;

      const hueTime = elapsed * controls.hueDrift;
      const hueSway =
        Math.sin(hueTime) * 0.024 + Math.cos(hueTime * 0.57) * 0.012;
      const colorResponse = clamp(
        responseEnergy * controls.speechColorBoost,
        0,
        1,
      );
      const eruption = clamp(signals.attack * 1.2 + colorResponse * 0.35, 0, 1);
      const warmShift = THREE.MathUtils.lerp(0, 0.085, eruption);

      fireflyBurstCooldown = Math.max(0, fireflyBurstCooldown - delta);
      const burstTriggerStrength = clamp(
        noveltyRise * 2.6 + signals.attack * 0.9 + eruption * 0.7,
        0,
        1.8,
      );
      const shouldTriggerBurst =
        fireflyBurstCooldown <= 0 &&
        burstTriggerStrength > 0.28 &&
        (Math.random() < 0.22 + controls.fireflyChance * 1.45 ||
          burstTriggerStrength > 1.05);
      if (shouldTriggerBurst) {
        let slot = 0;
        let minLife = fireflyBurstLife[0];
        for (let i = 1; i < fireflyBurstCount; i += 1) {
          if (fireflyBurstLife[i] < minLife) {
            minLife = fireflyBurstLife[i];
            slot = i;
          }
        }

        fireflyBurstLife[slot] =
          0.22 + controls.fireflyHold * 0.9 + controls.fireflyFade * 0.5;
        fireflyBurstAnchor[slot] = Math.floor(Math.random() * flowAnchorCount);
        fireflyBurstStrength[slot] = clamp(
          0.72 + burstTriggerStrength * 0.85,
          0.65,
          1.45,
        );
        spawnOverlayFireflies(
          4 + Math.round(burstTriggerStrength * 5),
          burstTriggerStrength,
          fireflyBurstAnchor[slot],
        );
        fireflyBurstCooldown = THREE.MathUtils.lerp(
          0.22,
          0.055,
          clamp(controls.fireflyChance * 3, 0, 1),
        );
      }

      let activeBurstEnergy = 0;
      for (let i = 0; i < fireflyBurstCount; i += 1) {
        if (fireflyBurstLife[i] <= 0) continue;
        fireflyBurstLife[i] = Math.max(0, fireflyBurstLife[i] - delta);
        activeBurstEnergy += fireflyBurstLife[i] * fireflyBurstStrength[i];
      }

      const emissionRate =
        3 +
        controls.fireflyChance * 20 +
        clamp(
          signals.speaking * 0.9 + novelty * 1.25 + burstTriggerStrength,
          0,
          2.2,
        ) *
          14;
      fireflyEmissionBudget += emissionRate * delta;
      const forcedEmits = Math.min(Math.floor(fireflyEmissionBudget), 18);
      fireflyEmissionBudget -= forcedEmits;
      if (forcedEmits > 0) {
        const activeBurstAnchors: number[] = [];
        for (let b = 0; b < fireflyBurstCount; b += 1) {
          if (fireflyBurstLife[b] > 0.04) {
            activeBurstAnchors.push(fireflyBurstAnchor[b]);
          }
        }

        if (Math.random() < 0.65) {
          const overlayAnchor =
            activeBurstAnchors.length > 0
              ? activeBurstAnchors[
                  Math.floor(Math.random() * activeBurstAnchors.length)
                ]
              : Math.floor(Math.random() * flowAnchorCount);

          spawnOverlayFireflies(
            1 +
              Math.min(
                3,
                Math.floor(forcedEmits / 4 + burstTriggerStrength * 2),
              ),
            0.45 + burstTriggerStrength * 0.5,
            overlayAnchor,
          );
        }

        for (let emit = 0; emit < forcedEmits; emit += 1) {
          const targetAnchor =
            activeBurstAnchors.length > 0 && Math.random() < 0.82
              ? activeBurstAnchors[
                  Math.floor(Math.random() * activeBurstAnchors.length)
                ]
              : Math.floor(Math.random() * flowAnchorCount);

          let chosen = -1;
          for (let attempt = 0; attempt < 18; attempt += 1) {
            const candidate = Math.floor(Math.random() * particleCount);
            if (fireflyLife[candidate] > 0.08) continue;

            let affinity = 0;
            if (primaryAnchor[candidate] === targetAnchor) {
              affinity = anchorBlend[candidate];
            } else if (secondaryAnchor[candidate] === targetAnchor) {
              affinity = 1 - anchorBlend[candidate];
            }

            if (affinity > 0.5 || attempt >= 14) {
              chosen = candidate;
              break;
            }
          }

          if (chosen >= 0) {
            activateFirefly(
              chosen,
              0.82 + burstTriggerStrength * 0.55 + Math.random() * 0.45,
            );
          }
        }
      }

      const colorAttr = particleGeometry.getAttribute(
        "color",
      ) as THREE.BufferAttribute;
      const baseColorHSL = new THREE.Color();
      const fireflyColorHSL = new THREE.Color();
      const accentShift = Math.sin(hueTime * 0.7 + 1.2) * 0.01;
      const baseShift = hueSway * 0.75;
      const highlightShift = Math.cos(hueTime * 0.9 + 0.4) * 0.012;
      const baseFamilyHue = wrapHue(controls.baseHue + baseShift * 0.6);
      const accentFamilyHue = wrapHue(
        controls.accentHue + accentShift + baseShift * 0.2,
      );
      const highlightFamilyHue = wrapHue(
        controls.highlightHue + highlightShift + colorResponse * 0.03,
      );
      const fireflyTriggerProb = clamp(
        (novelty * 0.9 + eruption * 0.45) * controls.fireflyChance * 2.4,
        0,
        0.95,
      );
      fireflyColorHSL.setHSL(
        highlightFamilyHue,
        1,
        clamp(0.7 + signals.attack * 0.2 + colorResponse * 0.08, 0.62, 0.92),
      );
      for (let i = 0; i < particleCount; i += 1) {
        const ix = i * 3;
        const radius = Math.hypot(
          positions[ix],
          positions[ix + 1],
          positions[ix + 2],
        );
        const radiusNorm = clamp(radius / (dynamicMaxRadius + 0.0001), 0, 1);
        const seed = seeds[i];
        const orbitalBand = clamp(
          0.5 +
            Math.sin(seed * 2.6 + elapsed * 0.42 + radiusNorm * 4.3) * 0.34 +
            (0.5 - radiusNorm) * 0.38,
          0,
          1,
        );
        const speechPush = clamp(eruption * 0.72 + novelty * 0.62, 0, 1);
        const hueMixBaseAccent = THREE.MathUtils.lerp(
          baseFamilyHue,
          accentFamilyHue,
          orbitalBand,
        );
        const particleHue = wrapHue(
          THREE.MathUtils.lerp(
            hueMixBaseAccent,
            highlightFamilyHue,
            clamp(speechPush * (0.42 + orbitalBand * 0.52), 0, 1),
          ) +
            Math.sin(seed * 6.8 + elapsed * 0.6) * 0.02,
        );
        const particleSat = clamp(
          (0.92 + orbitalBand * 0.18 + colorResponse * 0.2) *
            controls.saturation,
          0,
          1,
        );
        const particleLight = clamp(
          0.5 +
            (1 - radiusNorm) * 0.28 +
            speechPush * 0.22 +
            orbitalBand * 0.08,
          0.36,
          1,
        );
        baseColorHSL.setHSL(particleHue, particleSat, particleLight);

        let burstMix = 0;
        for (let b = 0; b < fireflyBurstCount; b += 1) {
          const burstLife = fireflyBurstLife[b];
          if (burstLife <= 0) continue;

          const burstAnchor = fireflyBurstAnchor[b];
          let anchorAffinity = 0;
          if (primaryAnchor[i] === burstAnchor) {
            anchorAffinity = anchorBlend[i];
          } else if (secondaryAnchor[i] === burstAnchor) {
            anchorAffinity = 1 - anchorBlend[i];
          }
          if (anchorAffinity <= 0.04) continue;

          const burstPhase = 1 - clamp(burstLife / 1.6, 0, 1);
          const flicker =
            0.68 +
            Math.sin(seed * 8.2 + elapsed * 18 + burstPhase * Math.PI * 2) *
              0.32;
          burstMix +=
            anchorAffinity *
            fireflyBurstStrength[b] *
            (0.42 + speechPush * 0.58) *
            flicker;
        }
        burstMix = clamp(burstMix, 0, 1.2);

        if (fireflyLife[i] <= 0) {
          if (
            Math.random() < fireflyTriggerProb * delta * 60 ||
            burstMix > 0.7
          ) {
            activateFirefly(i, 0.62 + burstMix * 0.8);
          }
        } else {
          fireflyLife[i] = Math.max(0, fireflyLife[i] - delta);
        }

        let fireflyMix = 0;
        if (fireflyLife[i] > 0) {
          const fadeWindow = Math.max(0.001, controls.fireflyFade);
          const fadeAmount =
            fireflyLife[i] > fadeWindow ? 1 : fireflyLife[i] / fadeWindow;
          fireflyMix = clamp(fadeAmount * fireflyIntensity[i], 0, 1.15);

          const drift =
            (0.00008 + fireflyMix * 0.00028) * (0.8 + speechEnergy * 0.6);
          const invRadius =
            1 /
            Math.max(
              0.001,
              Math.hypot(positions[ix], positions[ix + 1], positions[ix + 2]),
            );
          velocities[ix] +=
            positions[ix] * invRadius * drift + rand(drift * 2.6);
          velocities[ix + 1] +=
            positions[ix + 1] * invRadius * drift + rand(drift * 2.6);
          velocities[ix + 2] +=
            positions[ix + 2] * invRadius * drift + rand(drift * 2.6);
        }
        // const mix = clamp(
        //   Math.max(fireflyMix * 0.45, burstMix * 0.35),
        //   0,
        //   0.55,
        // );
        const mix = clamp(
          Math.max(fireflyMix * 0.72, burstMix * 0.68),
          0,
          0.92,
        );

        baseColorHSL.lerp(fireflyColorHSL, mix);
        colorAttr.setXYZ(i, baseColorHSL.r, baseColorHSL.g, baseColorHSL.b);
      }
      colorAttr.needsUpdate = true;

      group.rotation.y +=
        delta * controls.rotationDrift * (0.35 + speechEnergy * 0.25);
      group.rotation.x = Math.sin(elapsed * 0.05) * 0.04;
      group.rotation.z = Math.cos(elapsed * 0.04) * 0.03;

      const haloHue = wrapHue(
        controls.baseHue +
          hueSway * 0.9 +
          colorResponse * 0.018 +
          warmShift * 0.3,
      );
      const outerHue = wrapHue(
        controls.accentHue -
          hueSway * 0.45 +
          colorResponse * 0.024 +
          warmShift * 0.18,
      );
      const coreTargetHue = wrapHue(
        THREE.MathUtils.lerp(
          controls.coreHue,
          controls.highlightHue,
          eruption * 0.66,
        ),
      );
      const coreHue = wrapHue(coreTargetHue + Math.sin(hueTime + 0.8) * 0.01);
      const sparkHue = wrapHue(
        THREE.MathUtils.lerp(
          controls.highlightHue,
          controls.accentHue,
          1 - clamp(eruption * 1.1, 0, 1),
        ),
      );

      haloMaterial.color.setHSL(
        haloHue,
        clamp((0.84 + colorResponse * 0.08) * controls.saturation, 0, 1),
        0.6 + colorResponse * 0.06,
      );
      outerHaloMaterial.color.setHSL(
        outerHue,
        clamp((0.72 + colorResponse * 0.14) * controls.saturation, 0, 1),
        0.56 + eruption * 0.12,
      );
      coreMaterial.color.setHSL(
        coreHue,
        clamp((0.78 + colorResponse * 0.18) * controls.saturation, 0, 1),
        0.84 + eruption * 0.12,
      );
      bloomCoreMaterial.color.setHSL(
        wrapHue(coreHue - 0.015 + hueSway * 0.15),
        clamp((0.62 + colorResponse * 0.14) * controls.saturation, 0, 1),
        0.72 + eruption * 0.12,
      );
      particleMaterial.color.setRGB(1, 1, 1);
      sparkMaterial.color.setHSL(sparkHue, 0.9, 0.82 + eruption * 0.16);

      haloMaterial.opacity =
        (0.36 +
          adaptiveResponse * 0.42 +
          signals.brightness * 0.14 +
          colorResponse * 0.08) *
        controls.haloStrength;
      outerHaloMaterial.opacity =
        0.18 + adaptiveResponse * 0.16 + eruption * 0.08;
      bloomCoreMaterial.opacity =
        (0.18 +
          adaptiveResponse * 0.34 +
          signals.attack * 0.16 +
          colorResponse * 0.08) *
        (0.82 + controls.coreStrength * 0.42 + controls.bloomBias * 0.16);
      coreMaterial.opacity =
        (0.42 +
          adaptiveResponse * 0.48 +
          signals.attack * 0.22 +
          colorResponse * 0.1) *
        controls.coreStrength;

      particleMaterial.size =
        0.2 +
        controls.bloomBias * 0.05 +
        adaptiveResponse * 0.05 +
        eruption * 0.04;
      particleMaterial.opacity = clamp(
        0.9 +
          controls.masterIntensity * 0.03 +
          adaptiveResponse * 0.08 +
          colorResponse * 0.04,
        0.88,
        1,
      );
      halo.scale.setScalar(8.5 * haloPulse * (1 + controls.bloomBias * 0.32));
      outerHalo.scale.setScalar(
        11.2 * (1 + adaptiveResponse * 0.1 + eruption * 0.08),
      );
      bloomCore.scale.setScalar(
        (4.6 +
          adaptiveResponse * 1.2 +
          signals.attack * 0.36 +
          colorResponse * 0.3) *
          (1 + controls.bloomBias * 0.24),
      );
      const coreSizeVal =
        (3 +
          adaptiveResponse * 1.05 +
          signals.attack * 0.3 +
          colorResponse * 0.18) *
        controls.coreSize;
      const elongX = 1 - controls.coreElongation * speechEnergy * 0.35;
      const elongY = 1 + controls.coreElongation * speechEnergy * 0.35;
      core.scale.set(coreSizeVal * elongX, coreSizeVal * elongY, 1);

      const dynamicSparkThreshold = Math.max(
        0.02,
        controls.sparkThreshold - adaptiveResponse * 0.06,
      );
      if (signals.attack > dynamicSparkThreshold) {
        spawnSparks(
          Math.round(
            controls.sparkBurstSize +
              signals.attack * 12 +
              adaptiveResponse * 7,
          ),
          clamp(signals.attack * 1.12 + adaptiveResponse * 0.58, 0, 1),
        );
      }

      const sparkPositionAttr = sparkGeometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      for (let i = 0; i < sparks.length; i += 1) {
        const spark = sparks[i];
        const ix = i * 3;
        if (spark.life <= 0.001) {
          sparkPositions[ix] = 999;
          sparkPositions[ix + 1] = 999;
          sparkPositions[ix + 2] = 999;
          continue;
        }
        spark.life -= spark.decay + delta * 0.7;
        spark.base.add(spark.velocity);
        spark.velocity.multiplyScalar(0.982);
        sparkPositions[ix] = spark.base.x;
        sparkPositions[ix + 1] = spark.base.y;
        sparkPositions[ix + 2] = spark.base.z;
      }
      sparkPositionAttr.needsUpdate = true;
      sparkMaterial.size =
        0.26 +
        adaptiveResponse * 0.05 +
        clamp(activeBurstEnergy * 0.012, 0, 0.08);
      sparkMaterial.opacity =
        0.9 + speechEnergy * 0.16 + clamp(activeBurstEnergy * 0.08, 0, 0.1);

      const fireflyOverlayPositionAttr = fireflyOverlayGeometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      const fireflyOverlayColorAttr = fireflyOverlayGeometry.getAttribute(
        "color",
      ) as THREE.BufferAttribute;

      let activeOverlayFireflies = 0;
      const overlayColor = new THREE.Color();

      for (let i = 0; i < fireflies.length; i += 1) {
        const firefly = fireflies[i];
        const ix = i * 3;

        if (!firefly.active) {
          fireflyOverlayPositions[ix] = 999;
          fireflyOverlayPositions[ix + 1] = 999;
          fireflyOverlayPositions[ix + 2] = 999;
          continue;
        }

        firefly.life = Math.max(0, firefly.life - delta);
        if (firefly.life <= 0.001) {
          firefly.active = false;
          fireflyOverlayPositions[ix] = 999;
          fireflyOverlayPositions[ix + 1] = 999;
          fireflyOverlayPositions[ix + 2] = 999;
          continue;
        }

        activeOverlayFireflies += 1;

        const t = firefly.life / Math.max(0.001, firefly.maxLife);
        const envelope = t < 0.25 ? t / 0.25 : Math.min(1, t * 1.15);
        const fade = t;

        const flutter = new THREE.Vector3(
          Math.sin(elapsed * 7.2 + firefly.flickerOffset + i * 0.37),
          Math.cos(elapsed * 6.4 + firefly.flickerOffset * 1.4 + i * 0.23),
          Math.sin(elapsed * 6.8 + firefly.flickerOffset * 0.8 + i * 0.19),
        ).multiplyScalar(0.0008);

        firefly.velocity.multiplyScalar(0.986);
        firefly.velocity.add(firefly.drift);
        firefly.velocity.add(flutter);
        firefly.position.add(firefly.velocity);

        fireflyOverlayPositions[ix] = firefly.position.x;
        fireflyOverlayPositions[ix + 1] = firefly.position.y;
        fireflyOverlayPositions[ix + 2] = firefly.position.z;

        const flicker =
          0.84 +
          Math.sin(elapsed * 18 + firefly.flickerOffset + i * 0.71) * 0.16;

        const intensity = clamp(
          envelope * fade * flicker * firefly.strength,
          0,
          1.6,
        );

        const fireflyHue = wrapHue(
          highlightFamilyHue +
            firefly.hueOffset +
            Math.sin(elapsed * 0.8 + firefly.flickerOffset) * 0.02,
        );
        overlayColor.setHSL(
          fireflyHue,
          1,
          clamp(0.56 + intensity * 0.24, 0.4, 0.86),
        );

        fireflyOverlayColorAttr.setXYZ(
          i,
          overlayColor.r * intensity * 1.45,
          overlayColor.g * intensity * 1.45,
          overlayColor.b * intensity * 1.45,
        );
      }

      fireflyOverlayPositionAttr.needsUpdate = true;
      fireflyOverlayColorAttr.needsUpdate = true;

      fireflyOverlayMaterial.size =
        1.18 +
        adaptiveResponse * 0.12 +
        clamp(activeOverlayFireflies / 90, 0, 0.18);
      fireflyOverlayMaterial.opacity =
        0.96 + clamp(activeOverlayFireflies / 24, 0, 0.04);

      renderer.render(scene, camera);
    }

    function handleResize() {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }

    window.addEventListener("resize", handleResize);
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      sparkGeometry.dispose();
      sparkMaterial.dispose();
      haloMaterial.dispose();
      outerHaloMaterial.dispose();
      bloomCoreMaterial.dispose();
      coreMaterial.dispose();
      haloTexture.dispose();
      sparkTexture.dispose();
      fieldTexture.dispose();
      fireflyOverlayGeometry.dispose();
      fireflyOverlayMaterial.dispose();
      fireflyTexture.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {!kioskMode ? (
        <button
          type="button"
          onClick={() => setPanelOpen(!panelOpen)}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 15,
            border: "1px solid rgba(162, 227, 255, 0.22)",
            borderRadius: 999,
            padding: "0.55rem 0.9rem",
            background: "rgba(0,0,0,0.48)",
            color: "#dff6ff",
            backdropFilter: "blur(10px)",
            cursor: "pointer",
          }}
        >
          {panelOpen ? "Hide controls" : "Show controls"}
        </button>
      ) : null}

      {!kioskMode ? (
        <button
          type="button"
          onClick={() => setMonitorOpen((v) => !v)}
          style={{
            position: "absolute",
            top: 58,
            right: 14,
            zIndex: 15,
            border: "1px solid rgba(162, 227, 255, 0.22)",
            borderRadius: 999,
            padding: "0.5rem 0.84rem",
            background: "rgba(0,0,0,0.48)",
            color: "#dff6ff",
            backdropFilter: "blur(10px)",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {monitorOpen ? "Hide audio monitor" : "Show audio monitor"}
        </button>
      ) : null}

      {!kioskMode && monitorOpen ? (
        <div
          style={{
            position: "absolute",
            top: 96,
            right: 14,
            width: 360,
            zIndex: 15,
            padding: 12,
            borderRadius: 16,
            background: "rgba(5, 10, 18, 0.72)",
            border: "1px solid rgba(145, 225, 255, 0.14)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 0 28px rgba(0,0,0,0.32)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 8,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            Audio Tuning Monitor
          </div>
          <canvas
            ref={monitorCanvasRef}
            width={336}
            height={126}
            style={{
              width: "100%",
              borderRadius: 10,
              border: "1px solid rgba(160,220,255,0.14)",
              marginBottom: 8,
            }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 6,
              marginBottom: 10,
              fontSize: 11,
            }}
          >
            {MONITOR_SERIES.map((series) => {
              const value = monitorSignalsRef.current[series.key] ?? 0;
              return (
                <div key={series.key} style={{ display: "grid", gap: 2 }}>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: series.color }}>{series.label}</span>
                    <span style={{ opacity: 0.72 }}>{value.toFixed(2)}</span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 999,
                      background: "rgba(160,210,240,0.14)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${clamp(value, 0, 1) * 100}%`,
                        height: "100%",
                        background: series.color,
                        opacity: 0.85,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Control
            label="Speech bias (monitor)"
            helpText="How strongly speech presence is interpreted as intent/activity. Raise to make spoken words drive motion sooner and more intensely."
            min={0.4}
            max={2}
            step={0.01}
            value={controlsRef.current.speechBias}
            onChange={(v) => {
              controlsRef.current.speechBias = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Agitation gain (monitor)"
            helpText="Scales how much audio energy turns into internal current speed and turbulence. Higher values feel more animated in speech peaks."
            min={0}
            max={5}
            step={0.01}
            value={controlsRef.current.agitationGain}
            onChange={(v) => {
              controlsRef.current.agitationGain = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          {/* <Control
            label="Spark threshold (monitor)"
            helpText="Minimum attack needed to trigger spark bursts. Lower values create more frequent highlight pops; higher values reserve them for stronger syllables."
            min={0.01}
            max={0.5}
            step={0.005}
            value={controlsRef.current.sparkThreshold}
            onChange={(v) => {
              controlsRef.current.sparkThreshold = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          /> */}
          <Control
            label="Sustain backoff (monitor)"
            helpText="Habituation amount for sustained tones/noise. Higher values back off steady response and re-emphasize new changes/attacks."
            min={0}
            max={1}
            step={0.01}
            value={controlsRef.current.sustainBackoff}
            onChange={(v) => {
              controlsRef.current.sustainBackoff = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          {/* <Control
            label="Firefly chance (monitor)"
            helpText="Probability per-particle for accent-hue firefly sparks during attack/novelty. Higher creates more frequent dramatic color contrast."
            min={0}
            max={1}
            step={0.005}
            value={controlsRef.current.fireflyChance}
            onChange={(v) => {
              controlsRef.current.fireflyChance = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Firefly hold (monitor)"
            helpText="Time (seconds) each firefly remains at full accent intensity before fading. Longer hold makes each firefly event more dramatic."
            min={0}
            max={1.2}
            step={0.01}
            value={controlsRef.current.fireflyHold}
            onChange={(v) => {
              controlsRef.current.fireflyHold = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Firefly fade (monitor)"
            helpText="Time (seconds) each firefly takes to fade back to base color after hold. Longer fades feel more atmospheric; shorter are punchier."
            min={0.1}
            max={2.5}
            step={0.01}
            value={controlsRef.current.fireflyFade}
            onChange={(v) => {
              controlsRef.current.fireflyFade = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          /> */}
          <div
            style={{
              fontSize: 11,
              opacity: 0.72,
              marginTop: 4,
              lineHeight: 1.35,
            }}
          >
            Target for female speech: keep Presence and Response clearly above
            Level during syllables, with Attack peaks causing visible spark/flow
            punctuations.
          </div>
        </div>
      ) : null}

      {!kioskMode && panelOpen ? (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            width: 300,
            zIndex: 15,
            padding: 14,
            borderRadius: 16,
            background: "rgba(5, 10, 18, 0.62)",
            border: "1px solid rgba(145, 225, 255, 0.14)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 0 28px rgba(0,0,0,0.32)",
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 10,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            Thought Cloud Tuning
          </div>
          <Control
            label="Master intensity"
            helpText="Overall energy multiplier for particle motion. Higher values make the whole cloud feel more active."
            min={0.1}
            max={4}
            step={0.01}
            value={controlsRef.current.masterIntensity}
            onChange={(v) => {
              controlsRef.current.masterIntensity = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Idle drift"
            helpText="Baseline movement when there is little speech. Lower keeps silence calm; higher keeps constant background motion."
            min={0}
            max={3}
            step={0.01}
            value={controlsRef.current.idleDrift}
            onChange={(v) => {
              controlsRef.current.idleDrift = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Agitation gain"
            helpText="How strongly detected speech energy increases current speed and turbulence."
            min={0}
            max={5}
            step={0.01}
            value={controlsRef.current.agitationGain}
            onChange={(v) => {
              controlsRef.current.agitationGain = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Speech bias"
            helpText="Sensitivity to spoken presence specifically. Raise if dialogue feels under-responsive."
            min={0.4}
            max={2}
            step={0.01}
            value={controlsRef.current.speechBias}
            onChange={(v) => {
              controlsRef.current.speechBias = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Sustain backoff"
            helpText="Reduces response to steady sustained input (noise or held note) so new motion/attacks stand out again."
            min={0}
            max={1}
            step={0.01}
            value={controlsRef.current.sustainBackoff}
            onChange={(v) => {
              controlsRef.current.sustainBackoff = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Flow smoothing"
            helpText="Inertia/drag of particle velocity. Higher values feel smoother and less jittery."
            min={0}
            max={1}
            step={0.01}
            value={controlsRef.current.flowSmoothing}
            onChange={(v) => {
              controlsRef.current.flowSmoothing = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Turbulence"
            helpText="Scales the flow field's raw chaotic energy. Low = smooth, languid drift. High = wild swirling currents that really churn. Stacks with agitation gain."
            min={0}
            max={3}
            step={0.01}
            value={controlsRef.current.turbulence}
            onChange={(v) => {
              controlsRef.current.turbulence = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Orb cohesion"
            helpText="How strongly particles are kept near the orb body. Higher values keep a tighter, more singular entity."
            min={0.45}
            max={1.05}
            step={0.01}
            value={controlsRef.current.cohesion}
            onChange={(v) => {
              controlsRef.current.cohesion = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Spark threshold"
            helpText="Minimum attack needed for spark events. Lower means more frequent flashes."
            min={0.01}
            max={0.5}
            step={0.005}
            value={controlsRef.current.sparkThreshold}
            onChange={(v) => {
              controlsRef.current.sparkThreshold = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Spark burst size"
            helpText="How many spark particles appear when a spark trigger occurs."
            min={1}
            max={40}
            step={1}
            value={controlsRef.current.sparkBurstSize}
            onChange={(v) => {
              controlsRef.current.sparkBurstSize = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          {/* <Control
            label="Halo strength"
            helpText="Brightness of the outer ambient glow around the cloud."
            min={0.2}
            max={2}
            step={0.01}
            value={controlsRef.current.haloStrength}
            onChange={(v) => {
              controlsRef.current.haloStrength = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          /> */}
          <Control
            label="Core strength"
            helpText="Brightness of the inner nucleus; useful for readability from a distance."
            min={0.2}
            max={2}
            step={0.01}
            value={controlsRef.current.coreStrength}
            onChange={(v) => {
              controlsRef.current.coreStrength = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Core hue"
            helpText="Dedicated color of the orb nucleus. At rest this is the core's own identity color. Shifts toward the highlight hue during speech eruptions."
            min={0}
            max={1}
            step={0.001}
            value={controlsRef.current.coreHue}
            hue={controlsRef.current.coreHue * 360}
            onChange={(v) => {
              controlsRef.current.coreHue = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Core size"
            helpText="Base size of the orb nucleus. Low = tiny pinprick. High = massive, dominating glow. Speech still pulses it larger either way."
            min={0.1}
            max={3}
            step={0.01}
            value={controlsRef.current.coreSize}
            onChange={(v) => {
              controlsRef.current.coreSize = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Core elongation"
            helpText="Speech-driven shape distortion. At 0 the core is always round. Higher values stretch it vertically when speech energy is high — as if the voice is pulling the nucleus apart."
            min={0}
            max={2}
            step={0.01}
            value={controlsRef.current.coreElongation}
            onChange={(v) => {
              controlsRef.current.coreElongation = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Bloom bias"
            helpText="How much the glow appears to bloom/expand around bright moments."
            min={0}
            max={3}
            step={0.01}
            value={controlsRef.current.bloomBias}
            onChange={(v) => {
              controlsRef.current.bloomBias = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Rotation drift"
            helpText="Slow global rotation of the whole thought cloud."
            min={0}
            max={1.5}
            step={0.005}
            value={controlsRef.current.rotationDrift}
            onChange={(v) => {
              controlsRef.current.rotationDrift = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              marginTop: 8,
              marginBottom: 6,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              opacity: 0.82,
            }}
          >
            Color Dynamics
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 6,
              marginBottom: 8,
            }}
          >
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  Object.assign(controlsRef.current, preset.values);
                  forceRender((n) => n + 1);
                }}
                style={{
                  border: "1px solid rgba(162, 227, 255, 0.22)",
                  borderRadius: 999,
                  padding: "0.34rem 0.52rem",
                  background: "rgba(0,0,0,0.34)",
                  color: "#dff6ff",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <Control
            label="Base hue"
            helpText="Primary body/halo hue family. Use this to shift the cloud's core identity color."
            min={0}
            max={1}
            step={0.001}
            value={controlsRef.current.baseHue}
            hue={controlsRef.current.baseHue * 360}
            onChange={(v) => {
              controlsRef.current.baseHue = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Accent hue"
            helpText="Secondary hue used in outer halo and color interplay around the cloud."
            min={0}
            max={1}
            step={0.001}
            value={controlsRef.current.accentHue}
            hue={controlsRef.current.accentHue * 360}
            onChange={(v) => {
              controlsRef.current.accentHue = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Highlight hue"
            helpText="Transient eruption hue used for attack/sustained speech highlights and sparks."
            min={0}
            max={1}
            step={0.001}
            value={controlsRef.current.highlightHue}
            hue={controlsRef.current.highlightHue * 360}
            onChange={(v) => {
              controlsRef.current.highlightHue = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Hue drift"
            helpText="Rate of slow hue motion over time. Lower is stable identity; higher is more evolving color weather."
            min={0}
            max={0.08}
            step={0.001}
            value={controlsRef.current.hueDrift}
            onChange={(v) => {
              controlsRef.current.hueDrift = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Speech color boost"
            helpText="How strongly speech pushes saturation/highlight shifts. Raise for more obvious color response in phrases."
            min={0}
            max={2}
            step={0.01}
            value={controlsRef.current.speechColorBoost}
            onChange={(v) => {
              controlsRef.current.speechColorBoost = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Saturation"
            helpText="Overall color saturation multiplier. Below 1 = desaturated, ghostly, grayscale-trending. Above 1 = oversaturated, intense, vivid. Affects particles and glow equally."
            min={0}
            max={1.8}
            step={0.01}
            value={controlsRef.current.saturation}
            onChange={(v) => {
              controlsRef.current.saturation = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          {/* <Control
            label="Firefly chance"
            helpText="Probability per-particle for accent-hue firefly sparks during attack/novelty. Higher creates more frequent dramatic color contrast."
            min={0}
            max={1}
            step={0.005}
            value={controlsRef.current.fireflyChance}
            onChange={(v) => {
              controlsRef.current.fireflyChance = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          /> */}
          {/* <Control
            label="Firefly hold"
            helpText="Time (seconds) each firefly remains at full accent intensity before fading. Longer hold makes each firefly event more dramatic."
            min={0}
            max={1.2}
            step={0.01}
            value={controlsRef.current.fireflyHold}
            onChange={(v) => {
              controlsRef.current.fireflyHold = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Firefly fade"
            helpText="Time (seconds) each firefly takes to fade back to base color after hold. Longer fades feel more atmospheric; shorter are punchier."
            min={0.1}
            max={2.5}
            step={0.01}
            value={controlsRef.current.fireflyFade}
            onChange={(v) => {
              controlsRef.current.fireflyFade = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          /> */}
          <PresetsPanel
            channel={channel}
            getControls={() =>
              controlsRef.current as unknown as Record<string, number>
            }
            onLoad={(data) => {
              Object.assign(controlsRef.current, data);
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
              onLoadPreset?.(data);
            }}
          />
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 20,
            transform: "translateX(-50%)",
            zIndex: 15,
            maxWidth: 560,
            padding: "0.85rem 1rem",
            borderRadius: 14,
            background: "rgba(80, 14, 24, 0.82)",
            border: "1px solid rgba(255, 150, 160, 0.28)",
            color: "#ffe7ea",
          }}
        >
          {error}
        </div>
      ) : null}
    </>
  );
}

interface ControlProps {
  label: string;
  helpText?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  hue?: number;
}

function Control({
  label,
  helpText,
  min,
  max,
  step,
  value,
  hue,
  onChange,
}: ControlProps) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 12,
          marginBottom: 4,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span>{label}</span>
          {helpText ? (
            <span
              title={helpText}
              style={{
                display: "inline-flex",
                width: 14,
                height: 14,
                borderRadius: 999,
                border: "1px solid rgba(170,220,255,0.45)",
                color: "#d4f2ff",
                fontSize: 10,
                lineHeight: "14px",
                alignItems: "center",
                justifyContent: "center",
                cursor: "help",
                opacity: 0.85,
              }}
            >
              ?
            </span>
          ) : null}
        </span>
        <span style={{ opacity: 0.75 }}>{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{
          width: "100%",
          ...(hue === undefined ? {} : { accentColor: `hsl(${hue} 100% 75%)` }),
        }}
      />
    </label>
  );
}
