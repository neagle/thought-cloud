"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StartOverlay } from "@/components/StartOverlay";
import { CommandPalette } from "@/components/CommandPalette";
import { Toolbar } from "@/components/Toolbar";
import { ThoughtOrbScene } from "@/lib/visual/ThoughtOrbScene";
import type { Controls } from "@/lib/visual/ThoughtOrbScene";
import { OscilloscopeOverlay } from "@/lib/visual/OscilloscopeOverlay";
import type { VoicemailControls } from "@/lib/visual/OscilloscopeOverlay";
import { AudioAnalyzer } from "@/lib/audio/AudioAnalyzer";
import { TabSync } from "@/lib/sync/TabSync";
import type { Channel } from "@/types";

type AudioControls = {
  presenceInputGain: number;
  voicemailInputGain: number;
};

const INITIAL_PRESENCE_CONTROLS: Controls = {
  masterIntensity: 1.65,
  idleDrift: 1.2,
  agitationGain: 1.75,
  sparkThreshold: 0.07,
  sparkBurstSize: 10,
  haloStrength: 0.9,
  coreStrength: 1.7,
  coreHue: 0.55,
  coreSize: 1.55,
  coreElongation: 0.0,
  bloomBias: 1.5,
  rotationDrift: 0.26,
  speechBias: 1.45,
  flowSmoothing: 0.97,
  cohesion: 0.84,
  turbulence: 1.0,
  saturation: 1.15,
  baseHue: 0.56,
  accentHue: 0.72,
  highlightHue: 0.1,
  hueDrift: 0.018,
  speechColorBoost: 1.2,
  sustainBackoff: 0.5,
  fireflyChance: 0.24,
  fireflyHold: 0.28,
  fireflyFade: 1.2,
};

const INITIAL_VOICEMAIL_CONTROLS: VoicemailControls = {
  hue: 38,
  saturation: 100,
  intensity: 1.0,
  lineWidth: 2,
  glowBlur: 12,
  glowOpacity: 0.55,
};

const INITIAL_AUDIO_CONTROLS: AudioControls = {
  presenceInputGain: 1,
  voicemailInputGain: 1,
};

export default function Page() {
  const [audioStarted, setAudioStarted] = useState(false);
  const [audioAnalyzer, setAudioAnalyzer] = useState<AudioAnalyzer | null>(
    null,
  );
  const [audioError, setAudioError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [channel, setChannelState] = useState<Channel>("presence");
  const [kioskMode, setKioskMode] = useState(false);
  const [presenceControls, setPresenceControls] = useState<Controls>(
    INITIAL_PRESENCE_CONTROLS,
  );
  const [voicemailControls, setVoicemailControls] = useState<VoicemailControls>(
    INITIAL_VOICEMAIL_CONTROLS,
  );
  const [audioControls, setAudioControls] = useState<AudioControls>(
    INITIAL_AUDIO_CONTROLS,
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const channelRef = useRef<Channel>("presence");
  const syncRef = useRef<TabSync | null>(null);
  const lastServerChannelRef = useRef<Channel>("presence");
  const lastCueActionIdRef = useRef<string | null>(null);
  const audioStartedRef = useRef(false);
  const presenceControlsRef = useRef<Controls>(INITIAL_PRESENCE_CONTROLS);
  const voicemailControlsRef = useRef<VoicemailControls>(
    INITIAL_VOICEMAIL_CONTROLS,
  );
  const audioControlsRef = useRef<AudioControls>(INITIAL_AUDIO_CONTROLS);
  const [presenceTransitionDuration, setPresenceTransitionDuration] =
    useState(0);
  const [voicemailTransitionDuration, setVoicemailTransitionDuration] =
    useState(0);
  // Debounce timers for KV persistence
  const presenceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const voicemailSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const audioSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setChannel(c: Channel) {
    setChannelState(c);
    channelRef.current = c;
  }

  // Lock scrolling for the full-screen canvas app
  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

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
          const { channel: savedChannel } = (await cueRes.json()) as {
            channel: Channel;
          };
          setChannel(savedChannel);
          lastServerChannelRef.current = savedChannel;
        }
        if (ctrlRes.ok) {
          const { presence, voicemail, audio } = (await ctrlRes.json()) as {
            presence: Record<string, number> | null;
            voicemail: Record<string, number> | null;
            audio: Record<string, number> | null;
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
          if (audio && typeof (audio as Record<string, number>).inputGain === "number") {
            // backward-compat: old single-gain format
            const gain = (audio as Record<string, number>).inputGain;
            const c: AudioControls = { presenceInputGain: gain, voicemailInputGain: gain };
            audioControlsRef.current = c;
            setAudioControls(c);
          } else if (audio && ("presenceInputGain" in audio || "voicemailInputGain" in audio)) {
            const raw = audio as Record<string, number>;
            const c: AudioControls = {
              presenceInputGain: raw.presenceInputGain ?? 1,
              voicemailInputGain: raw.voicemailInputGain ?? 1,
            };
            audioControlsRef.current = c;
            setAudioControls(c);
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
        } else if (payload.scope === "audio") {
          const c = payload.data as unknown as AudioControls;
          audioControlsRef.current = c;
          setAudioControls(c);
        }
      } else if (payload.type === "request-state") {
        sync.broadcast({
          type: "state-response",
          channel: channelRef.current,
          controls: {
            presence: presenceControlsRef.current as unknown as Record<
              string,
              number
            >,
            voicemail: voicemailControlsRef.current as unknown as Record<
              string,
              number
            >,
            audio: audioControlsRef.current as unknown as Record<
              string,
              number
            >,
          },
        });
      } else if (payload.type === "state-response") {
        siblingResponded = true;
        clearTimeout(timeout);
        setChannel(payload.channel);
        lastServerChannelRef.current = payload.channel;
        const pc = payload.controls.presence as unknown as Controls;
        const vc = payload.controls.voicemail as unknown as VoicemailControls;
        const ac = payload.controls.audio as unknown as AudioControls;
        presenceControlsRef.current = pc;
        voicemailControlsRef.current = vc;
        audioControlsRef.current = ac;
        setPresenceControls(pc);
        setVoicemailControls(vc);
        setAudioControls(ac);
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
    analyzer
      .start()
      .then(() => {
        const initialGain =
          channelRef.current === "presence"
            ? audioControlsRef.current.presenceInputGain
            : audioControlsRef.current.voicemailInputGain;
        analyzer.setInputGain(initialGain);
        setAudioAnalyzer(analyzer);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Could not start audio input.";
        setAudioError(message);
        audioStartedRef.current = false;
      });
  }, [audioStarted]);

  useEffect(() => {
    if (!audioAnalyzer) return;
    const gain =
      channel === "presence"
        ? audioControls.presenceInputGain
        : audioControls.voicemailInputGain;
    audioAnalyzer.setInputGain(gain);
  }, [audioAnalyzer, audioControls, channel]);

  // Poll /api/cue every 500ms for QLab-triggered changes
  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch("/api/cue");
        if (!res.ok) return;
        const { channel: serverChannel, pendingAction } =
          (await res.json()) as {
            channel: Channel;
            pendingAction: {
              id: string;
              type: string;
              channel?: Channel;
              scope?: Channel;
              data?: Record<string, number>;
              duration?: number;
              value?: boolean;
            } | null;
          };

        if (serverChannel !== lastServerChannelRef.current) {
          lastServerChannelRef.current = serverChannel;
          setChannel(serverChannel);
          syncRef.current?.broadcast({
            type: "channel",
            channel: serverChannel,
          });
        }

        if (pendingAction && pendingAction.id !== lastCueActionIdRef.current) {
          lastCueActionIdRef.current = pendingAction.id;
          if (
            pendingAction.type === "kiosk" &&
            typeof pendingAction.value === "boolean"
          ) {
            setKioskMode(pendingAction.value);
          } else if (
            (pendingAction.type === "preset" ||
              pendingAction.type === "controls") &&
            pendingAction.scope &&
            pendingAction.data
          ) {
            const { scope, data } = pendingAction;
            const duration =
              typeof pendingAction.duration === "number"
                ? pendingAction.duration
                : 2.0;
            if (scope === "presence") {
              const merged = {
                ...presenceControlsRef.current,
                ...data,
              } as Controls;
              presenceControlsRef.current = merged;
              setPresenceTransitionDuration(duration);
              setPresenceControls({ ...merged });
              syncRef.current?.broadcast({
                type: "controls",
                scope: "presence",
                data: merged as unknown as Record<string, number>,
              });
            } else if (scope === "voicemail") {
              const merged = {
                ...voicemailControlsRef.current,
                ...data,
              } as VoicemailControls;
              voicemailControlsRef.current = merged;
              setVoicemailTransitionDuration(duration);
              setVoicemailControls({ ...merged });
              syncRef.current?.broadcast({
                type: "controls",
                scope: "voicemail",
                data: merged as unknown as Record<string, number>,
              });
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
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
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
    if (presenceSaveTimerRef.current)
      clearTimeout(presenceSaveTimerRef.current);
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
    if (voicemailSaveTimerRef.current)
      clearTimeout(voicemailSaveTimerRef.current);
    voicemailSaveTimerRef.current = setTimeout(() => {
      fetch("/api/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "voicemail", data: c }),
      }).catch(() => {});
    }, 1500);
  }, []);

  const handleAudioControlsChange = useCallback((c: AudioControls) => {
    audioControlsRef.current = c;
    setAudioControls({ ...c });
    syncRef.current?.broadcast({
      type: "controls",
      scope: "audio",
      data: c as unknown as Record<string, number>,
    });
    if (audioSaveTimerRef.current) clearTimeout(audioSaveTimerRef.current);
    audioSaveTimerRef.current = setTimeout(() => {
      fetch("/api/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "audio", data: c }),
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
          initialControls={INITIAL_PRESENCE_CONTROLS}
          audioAnalyzer={audioAnalyzer}
          kioskMode={kioskMode}
          channel="presence"
          externalControls={presenceControls}
          transitionDuration={presenceTransitionDuration}
          onControlsChange={handlePresenceControlsChange}
          inputGain={audioControls.presenceInputGain}
          onInputGainChange={(v) =>
            handleAudioControlsChange({
              ...audioControls,
              presenceInputGain: v,
            })
          }
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
        panelOpen={panelOpen}
        inputGain={audioControls.voicemailInputGain}
        onInputGainChange={(v) =>
          handleAudioControlsChange({
            ...audioControls,
            voicemailInputGain: v,
          })
        }
      />

      {/* Toolbar — hidden in kiosk mode */}
      <Toolbar
        channel={channel}
        onSetChannel={handleSetChannel}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((v) => !v)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        kioskMode={kioskMode}
        onEnterKiosk={() => setKioskMode(true)}
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
