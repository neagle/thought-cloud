"use client";

import { useEffect, useRef, useState } from "react";
import type { AudioAnalyzer } from "@/lib/audio/AudioAnalyzer";

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
  externalControls?: VoicemailControls;
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

export function OscilloscopeOverlay({ audioAnalyzer, visible, kioskMode, externalControls, onControlsChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const analyzerRef = useRef<AudioAnalyzer | null>(audioAnalyzer);
  const controlsRef = useRef<VoicemailControls>({ ...DEFAULT_CONTROLS });
  const [panelOpen, setPanelOpen] = useState(false);
  const [, forceRender] = useState(0);

  useEffect(() => {
    analyzerRef.current = audioAnalyzer;
  }, [audioAnalyzer]);

  useEffect(() => {
    if (!externalControls) return;
    Object.assign(controlsRef.current, externalControls);
    forceRender((n) => n + 1);
  }, [externalControls]);

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
        </div>
      ) : null}
    </>
  );
}
