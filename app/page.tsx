"use client";

import { useEffect, useRef, useState } from "react";
import { StartOverlay } from "@/components/StartOverlay";
import { CommandPalette } from "@/components/CommandPalette";
import { ThoughtOrbScene } from "@/lib/visual/ThoughtOrbScene";
import type { Controls } from "@/lib/visual/ThoughtOrbScene";
import { OscilloscopeOverlay } from "@/lib/visual/OscilloscopeOverlay";
import type { VoicemailControls } from "@/lib/visual/OscilloscopeOverlay";
import { AudioAnalyzer } from "@/lib/audio/AudioAnalyzer";
import { TabSync } from "@/lib/sync/TabSync";
import type { Mode } from "@/types";

const INITIAL_PRESENCE_CONTROLS: Controls = {
  masterIntensity: 1.3,
  idleDrift: 1.2,
  agitationGain: 1.75,
  sparkThreshold: 0.1,
  sparkBurstSize: 7,
  haloStrength: 0.33,
  coreStrength: 1,
  bloomBias: 0.65,
  rotationDrift: 0.26,
  speechBias: 1.45,
  flowSmoothing: 0.97,
  cohesion: 0.84,
  baseHue: 0.56,
  accentHue: 0.72,
  highlightHue: 0.1,
  hueDrift: 0.018,
  speechColorBoost: 1,
  sustainBackoff: 0.5,
  fireflyChance: 0.16,
  fireflyHold: 0.22,
  fireflyFade: 1.05,
};

const INITIAL_VOICEMAIL_CONTROLS: VoicemailControls = {
  hue: 38,
  saturation: 100,
  intensity: 1.0,
  lineWidth: 2,
  glowBlur: 12,
  glowOpacity: 0.55,
};

export default function Page() {
  const [audioStarted, setAudioStarted] = useState(false);
  const [audioAnalyzer, setAudioAnalyzer] = useState<AudioAnalyzer | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mode, setModeState] = useState<Mode>("presence");
  const [kioskMode, setKioskModeState] = useState(false);
  const [presenceControls, setPresenceControls] = useState<Controls>(INITIAL_PRESENCE_CONTROLS);
  const [voicemailControls, setVoicemailControls] = useState<VoicemailControls>(INITIAL_VOICEMAIL_CONTROLS);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const modeRef = useRef<Mode>("presence");
  const syncRef = useRef<TabSync | null>(null);
  const lastServerModeRef = useRef<Mode>("presence");
  const audioStartedRef = useRef(false);
  const presenceControlsRef = useRef<Controls>(INITIAL_PRESENCE_CONTROLS);
  const voicemailControlsRef = useRef<VoicemailControls>(INITIAL_VOICEMAIL_CONTROLS);

  function setMode(m: Mode) {
    setModeState(m);
    modeRef.current = m;
  }

  function setKioskMode(k: boolean) {
    setKioskModeState(k);
  }

  // Read ?kiosk=true from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("kiosk") === "true") setKioskMode(true);
  }, []);

  // Audio startup (lifted from ThoughtOrbScene)
  useEffect(() => {
    if (!audioStarted || audioStartedRef.current) return;
    audioStartedRef.current = true;
    const analyzer = new AudioAnalyzer();
    analyzer.start().then(() => setAudioAnalyzer(analyzer)).catch((err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Could not start audio input.";
      setAudioError(message);
      audioStartedRef.current = false;
    });
  }, [audioStarted]);

  // BroadcastChannel cross-tab sync
  useEffect(() => {
    const sync = new TabSync();
    syncRef.current = sync;

    // Ask siblings for current state
    sync.broadcast({ type: "request-state" });

    const unsub = sync.onMessage((payload) => {
      if (payload.type === "mode") {
        setMode(payload.mode);
        lastServerModeRef.current = payload.mode;
      } else if (payload.type === "controls") {
        if (payload.scope === "presence") {
          const c = payload.data as Controls;
          presenceControlsRef.current = c;
          setPresenceControls(c);
        } else if (payload.scope === "voicemail") {
          const c = payload.data as VoicemailControls;
          voicemailControlsRef.current = c;
          setVoicemailControls(c);
        }
      } else if (payload.type === "request-state") {
        sync.broadcast({
          type: "state-response",
          mode: modeRef.current,
          controls: {
            presence: presenceControlsRef.current as Record<string, number>,
            voicemail: voicemailControlsRef.current as Record<string, number>,
          },
        });
      } else if (payload.type === "state-response") {
        setMode(payload.mode);
        lastServerModeRef.current = payload.mode;
        const pc = payload.controls.presence as Controls;
        const vc = payload.controls.voicemail as VoicemailControls;
        presenceControlsRef.current = pc;
        voicemailControlsRef.current = vc;
        setPresenceControls(pc);
        setVoicemailControls(vc);
      }
    });

    return () => {
      unsub();
      sync.destroy();
    };
  }, []);

  // Poll /api/cue for QLab cues
  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch("/api/cue");
        if (!res.ok) return;
        const { mode: serverMode } = (await res.json()) as { mode: Mode };
        if (serverMode !== lastServerModeRef.current) {
          lastServerModeRef.current = serverMode;
          setMode(serverMode);
          syncRef.current?.broadcast({ type: "mode", mode: serverMode });
        }
      } catch {
        // Network error or KV not configured — stay silent
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, []);

  // Fullscreen change detection
  useEffect(() => {
    function onFSChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFSChange);
    return () => document.removeEventListener("fullscreenchange", onFSChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // F — toggle fullscreen (when not typing in an input)
      if (
        (e.key === "f" || e.key === "F") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement)
      ) {
        toggleFullscreen();
        return;
      }
      // Cmd+K / Ctrl+K — command palette
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      // Escape — close palette
      if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  function handleSetMode(m: Mode) {
    setMode(m);
    lastServerModeRef.current = m;
    syncRef.current?.broadcast({ type: "mode", mode: m });
    fetch("/api/cue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: m }),
    }).catch(() => {});
  }

  function handleSetKiosk(k: boolean) {
    setKioskMode(k);
  }

  function handlePresenceControlsChange(c: Controls) {
    presenceControlsRef.current = c;
    setPresenceControls({ ...c });
    syncRef.current?.broadcast({
      type: "controls",
      scope: "presence",
      data: c as Record<string, number>,
    });
  }

  function handleVoicemailControlsChange(c: VoicemailControls) {
    voicemailControlsRef.current = c;
    setVoicemailControls({ ...c });
    syncRef.current?.broadcast({
      type: "controls",
      scope: "voicemail",
      data: c as Record<string, number>,
    });
  }

  const inVoicemail = mode === "voicemail";

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#000",
      }}
    >
      {/* Three.js orb — fades out in voicemail mode */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: inVoicemail ? 0 : 1,
          transition: "opacity 1.5s ease",
        }}
      >
        <ThoughtOrbScene
          audioStarted={audioStarted}
          panelOpen={panelOpen}
          setPanelOpen={setPanelOpen}
          initialControls={INITIAL_PRESENCE_CONTROLS}
          audioAnalyzer={audioAnalyzer}
          kioskMode={kioskMode}
          externalControls={presenceControls}
          onControlsChange={handlePresenceControlsChange}
        />
      </div>

      {/* Oscilloscope — fades in in voicemail mode */}
      <OscilloscopeOverlay
        audioAnalyzer={audioAnalyzer}
        visible={inVoicemail}
        kioskMode={kioskMode}
        externalControls={voicemailControls}
        onControlsChange={handleVoicemailControlsChange}
      />

      {/* Start overlay */}
      {!audioStarted ? (
        <StartOverlay onStart={() => setAudioStarted(true)} />
      ) : null}

      {/* Audio error */}
      {audioError ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 20,
            transform: "translateX(-50%)",
            zIndex: 20,
            maxWidth: 560,
            padding: "0.85rem 1rem",
            borderRadius: 14,
            background: "rgba(80, 14, 24, 0.82)",
            border: "1px solid rgba(255, 150, 160, 0.28)",
            color: "#ffe7ea",
          }}
        >
          {audioError}
        </div>
      ) : null}

      {/* Command palette (Cmd+K) */}
      {paletteOpen ? (
        <CommandPalette
          mode={mode}
          kioskMode={kioskMode}
          isFullscreen={isFullscreen}
          onClose={() => setPaletteOpen(false)}
          onExitKiosk={() => handleSetKiosk(false)}
          onEnterKiosk={() => handleSetKiosk(true)}
          onToggleFullscreen={toggleFullscreen}
          onSetMode={handleSetMode}
          onOpenPanel={() => {
            setPanelOpen(true);
            if (kioskMode) handleSetKiosk(false);
          }}
        />
      ) : null}
    </main>
  );
}
