"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = "curl" | "applescript";

interface CueBlock {
  title: string;
  description: string;
  curl: string;
  applescript: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonArg(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

function buildCurl(origin: string, body: Record<string, unknown>): string {
  return `curl -s -X POST '${origin}/api/cue' \\\n  -H 'Content-Type: application/json' \\\n  -d '${jsonArg(body)}'`;
}

function buildAppleScript(
  origin: string,
  body: Record<string, unknown>,
): string {
  // In AppleScript strings, \" is an escaped double quote. Wrapping the JSON
  // in single quotes in the shell command means bash passes it through
  // literally, so the server receives valid JSON.
  const json = jsonArg(body).replace(/"/g, '\\"');
  return `do shell script "curl -s -X POST '${origin}/api/cue' -H 'Content-Type: application/json' -d '${json}'"`;
}

function buildBlocks(origin: string): CueBlock[] {
  function block(
    title: string,
    description: string,
    body: Record<string, unknown>,
  ): CueBlock {
    return {
      title,
      description,
      curl: buildCurl(origin, body),
      applescript: buildAppleScript(origin, body),
    };
  }

  return [
    // -----------------------------------------------------------------------
    // Kiosk mode
    // -----------------------------------------------------------------------
    block(
      "Enter kiosk mode (hide controls)",
      "Hides all UI panels and controls. Only the orb visualization is visible — ideal for performance.",
      { action: "kiosk", value: true },
    ),
    block(
      "Exit kiosk mode (show controls)",
      "Restores the controls UI. Use during rehearsal or when you need to adjust settings.",
      { action: "kiosk", value: false },
    ),

    // -----------------------------------------------------------------------
    // Channel switching
    // -----------------------------------------------------------------------
    block(
      "Switch to Presence channel",
      "Switches the display to the orb / particle cloud.",
      { action: "channel", channel: "presence" },
    ),
    block(
      "Switch to Voicemail channel",
      "Switches the display to the oscilloscope waveform.",
      { action: "channel", channel: "voicemail" },
    ),

    // -----------------------------------------------------------------------
    // Presets — load by name
    // -----------------------------------------------------------------------
    block(
      "Load a named preset (instant)",
      "Replace YOUR_PRESET_NAME with the exact name you saved in the app. Omitting duration defaults to 2 seconds.",
      {
        action: "preset",
        channel: "presence",
        name: "YOUR_PRESET_NAME",
        duration: 0,
      },
    ),
    block(
      "Load a named preset (2 s transition)",
      "Smoothly interpolates all controls from their current state to the preset over 2 seconds.",
      {
        action: "preset",
        channel: "presence",
        name: "YOUR_PRESET_NAME",
        duration: 2,
      },
    ),
    block(
      "Load a named preset (slow 5 s transition)",
      "Useful for very gradual mood shifts between scenes.",
      {
        action: "preset",
        channel: "presence",
        name: "YOUR_PRESET_NAME",
        duration: 5,
      },
    ),

    // -----------------------------------------------------------------------
    // Individual controls — curated performance-relevant set
    // -----------------------------------------------------------------------
    block(
      "Control: turbulence",
      "Flow field chaos. 0 = smooth laminar drift. 3 = wild, unpredictable swirling. Most dramatic single lever for 'calm vs angry'.",
      {
        action: "controls",
        scope: "presence",
        data: { turbulence: 1.0 },
        duration: 2,
      },
    ),
    block(
      "Control: agitationGain",
      "How strongly speech agitates the flow field. Low = voice barely stirs things. High (up to 5) = voice throws the whole cloud into turmoil.",
      {
        action: "controls",
        scope: "presence",
        data: { agitationGain: 1.75 },
        duration: 2,
      },
    ),
    block(
      "Control: idleDrift",
      "Baseline restlessness at silence. 0 = nearly still. 3 = always churning even without sound.",
      {
        action: "controls",
        scope: "presence",
        data: { idleDrift: 1.2 },
        duration: 2,
      },
    ),
    block(
      "Control: saturation",
      "Color vividness of all particles, halos, and sparks. 0 = monochrome grey-white. 1.8 = intensely saturated.",
      {
        action: "controls",
        scope: "presence",
        data: { saturation: 1.0 },
        duration: 2,
      },
    ),
    block(
      "Control: coreHue",
      "Hue of the orb nucleus (0–1 maps to the full color wheel: 0=red, 0.17=gold, 0.33=green, 0.5=cyan, 0.67=blue, 0.83=violet). Still shifts toward highlightHue during speech.",
      {
        action: "controls",
        scope: "presence",
        data: { coreHue: 0.55 },
        duration: 2,
      },
    ),
    block(
      "Control: coreSize",
      "Multiplier for nucleus scale. 0.2 = tiny cold star. 1.0 = default. 3.0 = massive dominating glow.",
      {
        action: "controls",
        scope: "presence",
        data: { coreSize: 1.0 },
        duration: 2,
      },
    ),
    block(
      "Control: coreElongation",
      "Speech-driven shape distortion of the nucleus. 0 = always round. 1–2 = stretches vertically under voice pressure.",
      {
        action: "controls",
        scope: "presence",
        data: { coreElongation: 0.0 },
        duration: 2,
      },
    ),
    block(
      "Control: masterIntensity",
      "Overall brightness and energy multiplier. 1.0 = neutral. 4.0 = blazing.",
      {
        action: "controls",
        scope: "presence",
        data: { masterIntensity: 1.3 },
        duration: 2,
      },
    ),
    block(
      "Multiple controls at once",
      "You can push any number of controls in a single cue. Here: set high-intensity 'agitated' state.",
      {
        action: "controls",
        scope: "presence",
        data: {
          turbulence: 2.5,
          agitationGain: 4.0,
          idleDrift: 2.2,
          saturation: 1.5,
        },
        duration: 3,
      },
    ),
  ];
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback: select text
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        padding: "4px 12px",
        borderRadius: 6,
        border: "1px solid rgba(162,227,255,0.25)",
        background: copied ? "rgba(0,220,150,0.15)" : "rgba(162,227,255,0.07)",
        color: copied ? "#00dc96" : "rgba(162,227,255,0.8)",
        fontSize: 11,
        letterSpacing: "0.06em",
        cursor: "pointer",
        transition: "all 0.15s",
        flexShrink: 0,
      }}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CuesPage() {
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [mode, setMode] = useState<Mode>("curl");
  const [blocks, setBlocks] = useState<CueBlock[]>([]);

  useEffect(() => {
    const o = window.location.origin;
    setOrigin(o);
    // Persist mode preference
    const saved = localStorage.getItem("cues-mode") as Mode | null;
    if (saved === "curl" || saved === "applescript") setMode(saved);
  }, []);

  useEffect(() => {
    setBlocks(buildBlocks(origin));
  }, [origin]);

  function handleModeToggle(m: Mode) {
    setMode(m);
    localStorage.setItem("cues-mode", m);
  }

  const sectionBreaks = new Set([2, 5, 13]); // indices before which to add a section header

  const sectionTitles: Record<number, string> = {
    0: "Kiosk Mode",
    2: "Channel Switching",
    4: "Load Presets by Name",
    7: "Push Individual Controls",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020408",
        color: "#dff6ff",
        fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif",
        padding: "32px 24px 64px",
        maxWidth: 820,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(162,227,255,0.45)",
            marginBottom: 6,
          }}
        >
          Thought Cloud
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 600,
            margin: "0 0 4px",
            color: "#dff6ff",
          }}
        >
          QLab Cue Reference
        </h1>
        <p style={{ fontSize: 13, color: "rgba(162,227,255,0.55)", margin: 0 }}>
          Ready-to-paste commands for every cue type. Toggle between curl (for
          terminal testing) and AppleScript (for QLab Script cues).
        </p>
      </div>

      {/* URL + mode toggle bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 16px",
          borderRadius: 10,
          background: "rgba(162,227,255,0.05)",
          border: "1px solid rgba(162,227,255,0.12)",
          marginBottom: 36,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(162,227,255,0.4)",
              marginBottom: 3,
            }}
          >
            Detected address
          </div>
          <code
            style={{ fontSize: 13, color: "#7df9ff", wordBreak: "break-all" }}
          >
            {origin}
          </code>
        </div>

        {/* Mode toggle */}
        <div
          style={{
            display: "flex",
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid rgba(162,227,255,0.2)",
            flexShrink: 0,
          }}
        >
          {(["curl", "applescript"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleModeToggle(m)}
              style={{
                padding: "7px 16px",
                background:
                  mode === m ? "rgba(162,227,255,0.15)" : "transparent",
                border: "none",
                borderRight:
                  m === "curl" ? "1px solid rgba(162,227,255,0.2)" : "none",
                color: mode === m ? "#dff6ff" : "rgba(162,227,255,0.45)",
                fontSize: 12,
                fontWeight: mode === m ? 600 : 400,
                cursor: "pointer",
                letterSpacing: "0.04em",
                transition: "all 0.15s",
              }}
            >
              {m === "curl" ? "curl" : "AppleScript"}
            </button>
          ))}
        </div>
      </div>

      {/* Cue blocks */}
      {blocks.map((block, i) => (
        <div key={block.title}>
          {/* Section header */}
          {sectionTitles[i] && (
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(162,227,255,0.4)",
                marginBottom: 12,
                marginTop: i === 0 ? 0 : 28,
                paddingBottom: 8,
                borderBottom: "1px solid rgba(162,227,255,0.08)",
              }}
            >
              {sectionTitles[i]}
            </div>
          )}

          {/* Block */}
          <div
            style={{
              marginBottom: 16,
              borderRadius: 10,
              border: "1px solid rgba(162,227,255,0.1)",
              background: "rgba(8,14,26,0.7)",
              overflow: "hidden",
            }}
          >
            {/* Block header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: "12px 14px 8px",
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#dff6ff",
                    marginBottom: 3,
                  }}
                >
                  {block.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(162,227,255,0.5)",
                    lineHeight: 1.5,
                  }}
                >
                  {block.description}
                </div>
              </div>
              <CopyButton
                text={mode === "curl" ? block.curl : block.applescript}
              />
            </div>

            {/* Code */}
            <pre
              style={{
                margin: 0,
                padding: "10px 14px 14px",
                fontSize: 11.5,
                lineHeight: 1.6,
                color: "#a2e3ff",
                fontFamily: "'SF Mono', 'Fira Code', 'Menlo', monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                borderTop: "1px solid rgba(162,227,255,0.07)",
                background: "rgba(0,0,0,0.2)",
              }}
            >
              {mode === "curl" ? block.curl : block.applescript}
            </pre>
          </div>
        </div>
      ))}

      {/* Footer note */}
      <div
        style={{
          marginTop: 40,
          padding: "14px 16px",
          borderRadius: 10,
          background: "rgba(162,227,255,0.03)",
          border: "1px solid rgba(162,227,255,0.08)",
          fontSize: 12,
          color: "rgba(162,227,255,0.4)",
          lineHeight: 1.7,
        }}
      >
        <strong style={{ color: "rgba(162,227,255,0.65)" }}>QLab usage:</strong>{" "}
        Paste AppleScript blocks into a Script cue. QLab Free requires a
        60-minute demo session (File → Start Demo) to use Script cues; you can
        test with curl commands in Terminal at any time.
        <br />
        <strong style={{ color: "rgba(162,227,255,0.65)" }}>
          All control keys:
        </strong>{" "}
        masterIntensity, idleDrift, agitationGain, sparkThreshold,
        sparkBurstSize, haloStrength, coreStrength, coreHue, coreSize,
        coreElongation, bloomBias, rotationDrift, speechBias, flowSmoothing,
        cohesion, turbulence, saturation, baseHue, accentHue, highlightHue,
        hueDrift, speechColorBoost, sustainBackoff, fireflyChance, fireflyHold,
        fireflyFade
        <br />
        <strong style={{ color: "rgba(162,227,255,0.65)" }}>
          Transition duration:
        </strong>{" "}
        Pass <code style={{ color: "#7df9ff" }}>"duration": 0</code> for
        instant, or any positive number of seconds. Omit for the default (2 s).
      </div>
    </div>
  );
}
