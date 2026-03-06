"use client";

import { useMemo, useState } from "react";
import { StartOverlay } from "@/components/StartOverlay";
import { ThoughtOrbScene } from "@/lib/visual/ThoughtOrbScene";

export default function Page() {
  const [audioStarted, setAudioStarted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const initialControls = useMemo(
    () => ({
      masterIntensity: 1,
      idleDrift: 0.24,
      agitationGain: 0.8,
      sparkThreshold: 0.12,
      sparkBurstSize: 7,
      haloStrength: 1,
      coreStrength: 1,
      bloomBias: 0.65,
      rotationDrift: 0.035,
      speechBias: 1.1,
      flowSmoothing: 0.9,
      cohesion: 0.72,
    }),
    [],
  );

  return (
    <main style={{ width: "100vw", height: "100vh", position: "relative", background: "#000" }}>
      <ThoughtOrbScene audioStarted={audioStarted} panelOpen={panelOpen} setPanelOpen={setPanelOpen} initialControls={initialControls} />
      {!audioStarted ? <StartOverlay onStart={() => setAudioStarted(true)} /> : null}
    </main>
  );
}
