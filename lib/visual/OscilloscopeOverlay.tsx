"use client";

import { useEffect, useRef, useState } from "react";
import type { AudioAnalyzer } from "@/lib/audio/AudioAnalyzer";
import { PresetsPanel } from "@/components/PresetsPanel";
import type { Channel } from "@/types";

export type VoicemailControls = {
  hue: number;
  saturation: number;
  intensity: number;
  lineWidth: number;
  glowBlur: number;
  glowOpacity: number;
};

const DEFAULT_CONTROLS: VoicemailControls = {
  hue: 38,
  saturation: 100,
  intensity: 1.0,
  lineWidth: 2,
  glowBlur: 12,
  glowOpacity: 0.55,
};

interface Props {
  audioAnalyzer: AudioAnalyzer | null;
  visible: boolean;
  kioskMode: boolean;
  channel: Channel;
  externalControls?: VoicemailControls;
  transitionDuration?: number;
  onControlsChange?: (c: VoicemailControls) => void;
}

interface ControlProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  hue?: number;
}

function Control({ label, min, max, step, value, onChange, hue }: ControlProps) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
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
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          ...(hue === undefined ? {} : { accentColor: `hsl(${hue} 100% 75%)` }),
        }}
      />
    </label>
  );
}

export function OscilloscopeOverlay({ audioAnalyzer, visible, kioskMode, channel, externalControls, transitionDuration = 0, onControlsChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const analyzerRef = useRef<AudioAnalyzer | null>(audioAnalyzer);
  const controlsRef = useRef<VoicemailControls>({ ...DEFAULT_CONTROLS });
  const controlsTransitionRef = useRef<{
    from: Record<string, number>;
    to: Record<string, number>;
    startMs: number;
    durationMs: number;
  } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [, forceRender] = useState(0);

  useEffect(() => {
    analyzerRef.current = audioAnalyzer;
  }, [audioAnalyzer]);

  useEffect(() => {
    if (!externalControls) return;
    if (transitionDuration <= 0) {
      Object.assign(controlsRef.current, externalControls);
      controlsTransitionRef.current = null;
      forceRender((n) => n + 1);
      return;
    }
    const keys = Object.keys(externalControls) as (keyof VoicemailControls)[];
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
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

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

      const c = controlsRef.current;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const data = analyzerRef.current?.getTimeDomainData() ?? null;

      const waveTop = h * 0.35;
      const waveHeight = h * 0.3;

      const glowColor = `hsla(${c.hue}, ${c.saturation}%, 55%, ${c.glowOpacity})`;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = c.glowBlur;

      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      const baseColor = `hsl(${c.hue}, ${c.saturation}%, 65%)`;
      const midColor = `hsl(${c.hue + 10}, ${c.saturation}%, 75%)`;
      gradient.addColorStop(0, `hsla(${c.hue}, ${c.saturation}%, 55%, 0.0)`);
      gradient.addColorStop(0.08, `hsla(${c.hue}, ${c.saturation}%, 65%, 0.85)`);
      gradient.addColorStop(0.5, midColor);
      gradient.addColorStop(0.92, `hsla(${c.hue}, ${c.saturation}%, 65%, 0.85)`);
      gradient.addColorStop(1, `hsla(${c.hue}, ${c.saturation}%, 55%, 0.0)`);
      void baseColor;

      ctx.strokeStyle = gradient;
      ctx.lineWidth = c.lineWidth;
      ctx.beginPath();

      if (!data) {
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
      } else {
        const step = Math.max(1, Math.ceil(data.length / w));
        let x = 0;
        for (let i = 0; i < data.length; i += step) {
          const v = data[i] * c.intensity;
          const y = waveTop + (v * 0.5 + 0.5) * waveHeight;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += step * (w / data.length);
        }
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const c = controlsRef.current;

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: visible ? 1 : 0,
          transition: "opacity 1.5s ease",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />

      {/* Show/hide controls button — only visible in voicemail mode and not kiosk */}
      {visible && !kioskMode ? (
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 15,
            border: "1px solid rgba(255, 190, 80, 0.25)",
            borderRadius: 999,
            padding: "0.55rem 0.9rem",
            background: "rgba(0,0,0,0.48)",
            color: "#ffe9b0",
            backdropFilter: "blur(10px)",
            cursor: "pointer",
          }}
        >
          {panelOpen ? "Hide voicemail controls" : "Show voicemail controls"}
        </button>
      ) : null}

      {/* Controls panel */}
      {visible && !kioskMode && panelOpen ? (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            width: 300,
            zIndex: 15,
            padding: 14,
            borderRadius: 16,
            background: "rgba(20, 12, 4, 0.72)",
            border: "1px solid rgba(255, 190, 80, 0.18)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 0 28px rgba(0,0,0,0.32)",
            maxHeight: "90vh",
            overflowY: "auto",
            color: "#ffe9b0",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 14,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            Voicemail Tuning
          </div>

          <Control
            label="Hue"
            min={0}
            max={360}
            step={1}
            value={c.hue}
            hue={c.hue}
            onChange={(v) => {
              controlsRef.current.hue = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Saturation"
            min={0}
            max={100}
            step={1}
            value={c.saturation}
            hue={c.hue}
            onChange={(v) => {
              controlsRef.current.saturation = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Amplitude"
            min={0.1}
            max={4}
            step={0.05}
            value={c.intensity}
            hue={c.hue}
            onChange={(v) => {
              controlsRef.current.intensity = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Line width"
            min={0.5}
            max={8}
            step={0.5}
            value={c.lineWidth}
            hue={c.hue}
            onChange={(v) => {
              controlsRef.current.lineWidth = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Glow blur"
            min={0}
            max={50}
            step={1}
            value={c.glowBlur}
            hue={c.hue}
            onChange={(v) => {
              controlsRef.current.glowBlur = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <Control
            label="Glow opacity"
            min={0}
            max={1}
            step={0.01}
            value={c.glowOpacity}
            hue={c.hue}
            onChange={(v) => {
              controlsRef.current.glowOpacity = v;
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
          <PresetsPanel
            channel={channel}
            getControls={() => controlsRef.current as unknown as Record<string, number>}
            onLoad={(data) => {
              Object.assign(controlsRef.current, data);
              forceRender((n) => n + 1);
              onControlsChange?.(controlsRef.current);
            }}
          />
        </div>
      ) : null}
    </>
  );
}
