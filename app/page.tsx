"use client";

import { useMemo, useState } from "react";
import { StartOverlay } from "@/components/StartOverlay";
import { ThoughtOrbScene } from "@/lib/visual/ThoughtOrbScene";

export default function Page() {
  const [audioStarted, setAudioStarted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const initialControls = useMemo(
    () => ({
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
      fireflyChance: 0.08,
      fireflyHold: 0.14,
      fireflyFade: 0.64,
    }),
    [],
  );

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#000",
      }}
    >
      <ThoughtOrbScene
        audioStarted={audioStarted}
        panelOpen={panelOpen}
        setPanelOpen={setPanelOpen}
        initialControls={initialControls}
      />
      {!audioStarted ? (
        <StartOverlay onStart={() => setAudioStarted(true)} />
      ) : null}
    </main>
  );
}
