"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AudioAnalyzer } from "@/lib/audio/AudioAnalyzer";

type Controls = {
  masterIntensity: number;
  idleDrift: number;
  agitationGain: number;
  sparkThreshold: number;
  sparkBurstSize: number;
  haloStrength: number;
  coreStrength: number;
  bloomBias: number;
  rotationDrift: number;
  speechBias: number;
  flowSmoothing: number;
  cohesion: number;
};

interface Props {
  audioStarted: boolean;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  initialControls: Controls;
}

type Spark = {
  life: number;
  decay: number;
  velocity: THREE.Vector3;
  base: THREE.Vector3;
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

const rand = THREE.MathUtils.randFloatSpread;
const clamp = THREE.MathUtils.clamp;
const MAX_PARTICLE_RADIUS = 3.2;

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
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<Controls>(initialControls);
  const audioRef = useRef<AudioAnalyzer | null>(null);
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [, forceRender] = useState(0);

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
      "rgba(158,240,255,0.9)",
      "rgba(158,240,255,0)",
    );
    const sparkTexture = makeSpriteTexture(
      "rgba(255,210,255,1)",
      "rgba(255,210,255,0)",
    );
    const fieldTexture = makeSpriteTexture(
      "rgba(140,220,255,0.85)",
      "rgba(140,220,255,0)",
    );

    const particleCount = 1700;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const seeds = new Float32Array(particleCount);
    const bases = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const radii = new Float32Array(particleCount);

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
      const r = Math.pow(Math.random(), 0.6) * 1.55;
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
      size: 0.12,
      transparent: true,
      opacity: 0.52,
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
      opacity: 0.33,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Sprite(haloMaterial);
    halo.scale.set(7.8, 7.8, 1);
    scene.add(halo);

    const outerHaloMaterial = new THREE.SpriteMaterial({
      map: haloTexture,
      color: new THREE.Color("#7e68ff"),
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const outerHalo = new THREE.Sprite(outerHaloMaterial);
    outerHalo.scale.set(10.5, 10.5, 1);
    scene.add(outerHalo);

    const coreMaterial = new THREE.SpriteMaterial({
      map: haloTexture,
      color: new THREE.Color("#c4f3ff"),
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Sprite(coreMaterial);
    core.scale.set(2.4, 2.4, 1);
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
      size: 0.18,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const sparkPoints = new THREE.Points(sparkGeometry, sparkMaterial);
    scene.add(sparkPoints);

    const ambientLight = new THREE.AmbientLight("#6aa7ff", 0.2);
    scene.add(ambientLight);

    const clock = new THREE.Clock();
    let frameId = 0;

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

    function updateFlowAnchors(
      elapsed: number,
      agitation: number,
      speechEnergy: number,
    ) {
      const fieldStrength = 0.16 + agitation * 0.12 + speechEnergy * 0.08;
      for (let i = 0; i < flowAnchors.length; i += 1) {
        const anchor = flowAnchors[i];
        const wobble = 0.12 + speechEnergy * 0.05;
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
      const agitation =
        controls.idleDrift +
        responseEnergy * controls.agitationGain +
        signals.attack * 1.2;
      const pulse = 1 + responseEnergy * 0.09 + signals.attack * 0.05;
      const haloPulse = 1 + responseEnergy * 0.16 + signals.brightness * 0.1;
      const thoughtBias = signals.speaking * 0.1 + signals.attack * 0.08;
      const damping = clamp(
        0.925 + controls.flowSmoothing * 0.055 - responseEnergy * 0.06,
        0.84,
        0.985,
      );
      const fieldScale =
        (0.62 + controls.masterIntensity * 0.76) *
        (0.68 + agitation * 0.82 + responseEnergy * 0.42);
      const cohesionStrength =
        (0.0014 + controls.cohesion * 0.002) * (1 + speechEnergy * 0.22);
      const centerBiasStrength = 0.00065 + controls.cohesion * 0.00065;
      const shellBreathing = 1 + speechEnergy * 0.05;
      const sparkiness = 0.55 + responseEnergy * 0.85 + signals.attack * 0.4;

      updateFlowAnchors(elapsed, agitation, speechEnergy);

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
          .multiplyScalar(-centerBiasStrength * Math.max(0, radius - 1.95));
        const shellForce = tempVecA
          .clone()
          .normalize()
          .multiplyScalar(radiusError * cohesionStrength);

        velocities[ix] =
          velocities[ix] * damping +
          (tempVecC.x * fieldScale * locality +
            tangential.x +
            thoughtDrift.x +
            shellForce.x +
            centerBias.x);
        velocities[ix + 1] =
          velocities[ix + 1] * damping +
          (tempVecC.y * fieldScale * locality +
            tangential.y +
            thoughtDrift.y +
            shellForce.y +
            centerBias.y);
        velocities[ix + 2] =
          velocities[ix + 2] * damping +
          (tempVecC.z * fieldScale * locality +
            tangential.z +
            thoughtDrift.z +
            shellForce.z +
            centerBias.z);

        positions[ix] += velocities[ix] * (0.95 + sparkiness * 0.02);
        positions[ix + 1] += velocities[ix + 1] * (0.95 + sparkiness * 0.02);
        positions[ix + 2] += velocities[ix + 2] * (0.95 + sparkiness * 0.02);

        const postRadius = Math.hypot(
          positions[ix],
          positions[ix + 1],
          positions[ix + 2],
        );
        if (postRadius > MAX_PARTICLE_RADIUS) {
          const recovery = clamp(
            (postRadius - MAX_PARTICLE_RADIUS) / 1.2,
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

      group.rotation.y +=
        delta * controls.rotationDrift * (0.35 + speechEnergy * 0.25);
      group.rotation.x = Math.sin(elapsed * 0.05) * 0.04;
      group.rotation.z = Math.cos(elapsed * 0.04) * 0.03;

      const hueShift = (elapsed * 0.012) % 1;
      haloMaterial.color.setHSL(
        0.56 + Math.sin(hueShift * Math.PI * 2) * 0.03,
        0.85,
        0.62,
      );
      outerHaloMaterial.color.setHSL(
        0.72 + Math.cos(hueShift * Math.PI * 2) * 0.03,
        0.75,
        0.58,
      );
      coreMaterial.color.setHSL(
        0.53 + Math.sin(hueShift * Math.PI * 2 + 0.7) * 0.02,
        0.65,
        0.82,
      );

      haloMaterial.opacity =
        (0.2 + responseEnergy * 0.32 + signals.brightness * 0.1) *
        controls.haloStrength;
      outerHaloMaterial.opacity = 0.11 + responseEnergy * 0.1;
      coreMaterial.opacity =
        (0.26 + responseEnergy * 0.42 + signals.attack * 0.16) *
        controls.coreStrength;

      halo.scale.setScalar(7.6 * haloPulse * (1 + controls.bloomBias * 0.08));
      outerHalo.scale.setScalar(10.3 * (1 + responseEnergy * 0.07));
      core.scale.setScalar(2.3 + responseEnergy * 0.9 + signals.attack * 0.24);

      const dynamicSparkThreshold = Math.max(
        0.02,
        controls.sparkThreshold - responseEnergy * 0.06,
      );
      if (signals.attack > dynamicSparkThreshold) {
        spawnSparks(
          Math.round(
            controls.sparkBurstSize + signals.attack * 12 + responseEnergy * 7,
          ),
          clamp(signals.attack * 1.12 + responseEnergy * 0.58, 0, 1),
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
      sparkMaterial.opacity = 0.72 + speechEnergy * 0.22;

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
      coreMaterial.dispose();
      haloTexture.dispose();
      sparkTexture.dispose();
      fieldTexture.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!audioStarted || startedRef.current) return;
    startedRef.current = true;
    const analyzer = new AudioAnalyzer();
    audioRef.current = analyzer;
    analyzer.start().catch((err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Could not start audio input.";
      setError(message);
      startedRef.current = false;
    });
  }, [audioStarted]);

  return (
    <>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

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

      {panelOpen ? (
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
            min={0.3}
            max={2}
            step={0.01}
            value={controlsRef.current.masterIntensity}
            onChange={(v) => {
              controlsRef.current.masterIntensity = v;
              forceRender((n) => n + 1);
            }}
          />
          <Control
            label="Idle drift"
            min={0}
            max={1.2}
            step={0.01}
            value={controlsRef.current.idleDrift}
            onChange={(v) => {
              controlsRef.current.idleDrift = v;
              forceRender((n) => n + 1);
            }}
          />
          <Control
            label="Agitation gain"
            min={0.1}
            max={2.5}
            step={0.01}
            value={controlsRef.current.agitationGain}
            onChange={(v) => {
              controlsRef.current.agitationGain = v;
              forceRender((n) => n + 1);
            }}
          />
          <Control
            label="Speech bias"
            min={0.4}
            max={2}
            step={0.01}
            value={controlsRef.current.speechBias}
            onChange={(v) => {
              controlsRef.current.speechBias = v;
              forceRender((n) => n + 1);
            }}
          />
          <Control
            label="Flow smoothing"
            min={0.2}
            max={1}
            step={0.01}
            value={controlsRef.current.flowSmoothing}
            onChange={(v) => {
              controlsRef.current.flowSmoothing = v;
              forceRender((n) => n + 1);
            }}
          />
          <Control
            label="Orb cohesion"
            min={0.45}
            max={1.05}
            step={0.01}
            value={controlsRef.current.cohesion}
            onChange={(v) => {
              controlsRef.current.cohesion = v;
              forceRender((n) => n + 1);
            }}
          />
          <Control
            label="Spark threshold"
            min={0.01}
            max={0.5}
            step={0.005}
            value={controlsRef.current.sparkThreshold}
            onChange={(v) => {
              controlsRef.current.sparkThreshold = v;
              forceRender((n) => n + 1);
            }}
          />
          <Control
            label="Spark burst size"
            min={1}
            max={18}
            step={1}
            value={controlsRef.current.sparkBurstSize}
            onChange={(v) => {
              controlsRef.current.sparkBurstSize = v;
              forceRender((n) => n + 1);
            }}
          />
          <Control
            label="Halo strength"
            min={0.2}
            max={2}
            step={0.01}
            value={controlsRef.current.haloStrength}
            onChange={(v) => {
              controlsRef.current.haloStrength = v;
              forceRender((n) => n + 1);
            }}
          />
          <Control
            label="Core strength"
            min={0.2}
            max={2}
            step={0.01}
            value={controlsRef.current.coreStrength}
            onChange={(v) => {
              controlsRef.current.coreStrength = v;
              forceRender((n) => n + 1);
            }}
          />
          <Control
            label="Bloom bias"
            min={0}
            max={1.5}
            step={0.01}
            value={controlsRef.current.bloomBias}
            onChange={(v) => {
              controlsRef.current.bloomBias = v;
              forceRender((n) => n + 1);
            }}
          />
          <Control
            label="Rotation drift"
            min={0}
            max={0.3}
            step={0.005}
            value={controlsRef.current.rotationDrift}
            onChange={(v) => {
              controlsRef.current.rotationDrift = v;
              forceRender((n) => n + 1);
            }}
          />
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              opacity: 0.75,
              lineHeight: 1.4,
            }}
          >
            This pass replaces springier particle following with shared, slow
            flow anchors so nearby regions drift together like internal weather.
          </div>
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
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

function Control({ label, min, max, step, value, onChange }: ControlProps) {
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
        <span>{label}</span>
        <span style={{ opacity: 0.75 }}>{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: "100%" }}
      />
    </label>
  );
}
