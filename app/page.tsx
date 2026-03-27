"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StartOverlay } from "@/components/StartOverlay";
import { CommandPalette } from "@/components/CommandPalette";
import { ChannelSwitcher } from "@/components/ChannelSwitcher";
import { ThoughtOrbScene } from "@/lib/visual/ThoughtOrbScene";
import type { Controls } from "@/lib/visual/ThoughtOrbScene";
import { OscilloscopeOverlay } from "@/lib/visual/OscilloscopeOverlay";
import type { VoicemailControls } from "@/lib/visual/OscilloscopeOverlay";
import { AudioAnalyzer } from "@/lib/audio/AudioAnalyzer";
import { TabSync } from "@/lib/sync/TabSync";
import type { Channel } from "@/types";

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
  turbulence: 1.0,
  saturation: 1.0,
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
  const [channel, setChannelState] = useState<Channel>("presence");
  const [kioskMode, setKioskMode] = useState(false);
  const [presenceControls, setPresenceControls] = useState<Controls>(INITIAL_PRESENCE_CONTROLS);
  const [voicemailControls, setVoicemailControls] = useState<VoicemailControls>(INITIAL_VOICEMAIL_CONTROLS);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const channelRef = useRef<Channel>("presence");
  const syncRef = useRef<TabSync | null>(null);
  const lastServerChannelRef = useRef<Channel>("presence");
  const lastCueActionIdRef = useRef<string | null>(null);
  const audioStartedRef = useRef(false);
  const presenceControlsRef = useRef<Controls>(INITIAL_PRESENCE_CONTROLS);
  const voicemailControlsRef = useRef<VoicemailControls>(INITIAL_VOICEMAIL_CONTROLS);
  const [presenceTransitionDuration, setPresenceTransitionDuration] = useState(0);
  const [voicemailTransitionDuration, setVoicemailTransitionDuration] = useState(0);
  // Debounce timers for KV persistence
  const presenceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voicemailSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setChannel(c: Channel) {
    setChannelState(c);
    channelRef.current = c;
  }

  // Read ?kiosk=true from URL on mount + fetch persisted state from KV
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("kiosk") === "true") setKioskMode(true);

    // Load persisted controls from KV (only if no sibling responds first)
    let siblingResponded = false;
    const timeout = setTimeout(async () => {
      if (siblingResponded) return;
      try {
        const [cueRes, ctrlRes] = await Promise.all([
          fetch("/api/cue"),
          fetch("/api/controls"),
        ]);
        if (cueRes.ok) {
          const { channel: savedChannel } = (await cueRes.json()) as { channel: Channel };
          setChannel(savedChannel);
          lastServerChannelRef.current = savedChannel;
        }
        if (ctrlRes.ok) {
          const { presence, voicemail } = (await ctrlRes.json()) as {
            presence: Record<string, number> | null;
            voicemail: Record<string, number> | null;
          };
          if (presence) {
            const c = presence as unknown as Controls;
            presenceControlsRef.current = c;
            setPresenceControls(c);
          }
          if (voicemail) {
            const c = voicemail as unknown as VoicemailControls;
            voicemailControlsRef.current = c;
            setVoicemailControls(c);
          }
        }
      } catch {}
    }, 150); // Wait briefly for BroadcastChannel sibling response first

    // Flag to skip KV fetch if a sibling responded
    const sync = new TabSync();
    syncRef.current = sync;
    sync.broadcast({ type: "request-state" });

    const unsub = sync.onMessage((payload) => {
      if (payload.type === "channel") {
        setChannel(payload.channel);
        lastServerChannelRef.current = payload.channel;
      } else if (payload.type === "controls") {
        if (payload.scope === "presence") {
          const c = payload.data as unknown as Controls;
          presenceControlsRef.current = c;
          setPresenceControls(c);
        } else if (payload.scope === "voicemail") {
          const c = payload.data as unknown as VoicemailControls;
          voicemailControlsRef.current = c;
          setVoicemailControls(c);
        }
      } else if (payload.type === "request-state") {
        sync.broadcast({
          type: "state-response",
          channel: channelRef.current,
          controls: {
            presence: presenceControlsRef.current as unknown as Record<string, number>,
            voicemail: voicemailControlsRef.current as unknown as Record<string, number>,
          },
        });
      } else if (payload.type === "state-response") {
        siblingResponded = true;
        clearTimeout(timeout);
        setChannel(payload.channel);
        lastServerChannelRef.current = payload.channel;
        const pc = payload.controls.presence as unknown as Controls;
        const vc = payload.controls.voicemail as unknown as VoicemailControls;
        presenceControlsRef.current = pc;
        voicemailControlsRef.current = vc;
        setPresenceControls(pc);
        setVoicemailControls(vc);
      }
    });

    return () => {
      clearTimeout(timeout);
      unsub();
      sync.destroy();
    };
  }, []);

  // Audio startup
  useEffect(() => {
    if (!audioStarted || audioStartedRef.current) return;
    audioStartedRef.current = true;
    const analyzer = new AudioAnalyzer();
    analyzer.start().then(() => setAudioAnalyzer(analyzer)).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Could not start audio input.";
      setAudioError(message);
      audioStartedRef.current = false;
    });
  }, [audioStarted]);

  // Poll /api/cue every 500ms for QLab-triggered changes
  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch("/api/cue");
        if (!res.ok) return;
        const { channel: serverChannel, pendingAction } = (await res.json()) as {
          channel: Channel;
          pendingAction: { id: string; type: string; channel?: Channel; scope?: Channel; data?: Record<string, number>; duration?: number } | null;
        };

        if (serverChannel !== lastServerChannelRef.current) {
          lastServerChannelRef.current = serverChannel;
          setChannel(serverChannel);
          syncRef.current?.broadcast({ type: "channel", channel: serverChannel });
        }

        if (pendingAction && pendingAction.id !== lastCueActionIdRef.current) {
          lastCueActionIdRef.current = pendingAction.id;
          if ((pendingAction.type === "preset" || pendingAction.type === "controls") && pendingAction.scope && pendingAction.data) {
            const { scope, data } = pendingAction;
            const duration = typeof pendingAction.duration === "number" ? pendingAction.duration : 2.0;
            if (scope === "presence") {
              const merged = { ...presenceControlsRef.current, ...data } as Controls;
              presenceControlsRef.current = merged;
              setPresenceTransitionDuration(duration);
              setPresenceControls({ ...merged });
              syncRef.current?.broadcast({ type: "controls", scope: "presence", data: merged as unknown as Record<string, number> });
            } else if (scope === "voicemail") {
              const merged = { ...voicemailControlsRef.current, ...data } as VoicemailControls;
              voicemailControlsRef.current = merged;
              setVoicemailTransitionDuration(duration);
              setVoicemailControls({ ...merged });
              syncRef.current?.broadcast({ type: "controls", scope: "voicemail", data: merged as unknown as Record<string, number> });
            }
          }
        }
      } catch {}
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
      if (
        (e.key === "f" || e.key === "F") &&
        !e.metaKey && !e.ctrlKey && !e.altKey &&
        !(e.target instanceof HTMLInputElement)
      ) {
        toggleFullscreen();
        return;
      }
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setPaletteOpen(false);
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

  function handleSetChannel(c: Channel) {
    setChannel(c);
    lastServerChannelRef.current = c;
    syncRef.current?.broadcast({ type: "channel", channel: c });
    fetch("/api/cue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: c }),
    }).catch(() => {});
  }

  const handlePresenceControlsChange = useCallback((c: Controls) => {
    presenceControlsRef.current = c;
    setPresenceControls({ ...c });
    syncRef.current?.broadcast({
      type: "controls",
      scope: "presence",
      data: c as unknown as Record<string, number>,
    });
    // Debounced KV persist
    if (presenceSaveTimerRef.current) clearTimeout(presenceSaveTimerRef.current);
    presenceSaveTimerRef.current = setTimeout(() => {
      fetch("/api/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "presence", data: c }),
      }).catch(() => {});
    }, 1500);
  }, []);

  const handleVoicemailControlsChange = useCallback((c: VoicemailControls) => {
    voicemailControlsRef.current = c;
    setVoicemailControls({ ...c });
    syncRef.current?.broadcast({
      type: "controls",
      scope: "voicemail",
      data: c as unknown as Record<string, number>,
    });
    if (voicemailSaveTimerRef.current) clearTimeout(voicemailSaveTimerRef.current);
    voicemailSaveTimerRef.current = setTimeout(() => {
      fetch("/api/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "voicemail", data: c }),
      }).catch(() => {});
    }, 1500);
  }, []);

  const inVoicemail = channel === "voicemail";

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#000",
      }}
    >
      {/* Three.js orb — fades out in voicemail channel */}
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
          channel="presence"
          externalControls={presenceControls}
          transitionDuration={presenceTransitionDuration}
          onControlsChange={handlePresenceControlsChange}
        />
      </div>

      {/* Oscilloscope — fades in in voicemail channel */}
      <OscilloscopeOverlay
        audioAnalyzer={audioAnalyzer}
        visible={inVoicemail}
        kioskMode={kioskMode}
        channel="voicemail"
        externalControls={voicemailControls}
        transitionDuration={voicemailTransitionDuration}
        onControlsChange={handleVoicemailControlsChange}
      />

      {/* Channel switcher — hidden in kiosk mode */}
      {!kioskMode ? (
        <ChannelSwitcher channel={channel} onSetChannel={handleSetChannel} />
      ) : null}

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
          channel={channel}
          kioskMode={kioskMode}
          isFullscreen={isFullscreen}
          onClose={() => setPaletteOpen(false)}
          onExitKiosk={() => setKioskMode(false)}
          onEnterKiosk={() => setKioskMode(true)}
          onToggleFullscreen={toggleFullscreen}
          onSetChannel={handleSetChannel}
          onOpenPanel={() => {
            setPanelOpen(true);
            if (kioskMode) setKioskMode(false);
          }}
        />
      ) : null}
    </main>
  );
}

