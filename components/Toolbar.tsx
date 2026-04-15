"use client";

import { ChannelSwitcher } from "@/components/ChannelSwitcher";
import type { Channel } from "@/types";

interface Props {
  channel: Channel;
  onSetChannel: (c: Channel) => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  kioskMode: boolean;
  onEnterKiosk: () => void;
}

export function Toolbar({
  channel,
  onSetChannel,
  panelOpen,
  onTogglePanel,
  isFullscreen,
  onToggleFullscreen,
  kioskMode,
  onEnterKiosk,
}: Props) {
  if (kioskMode) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 52,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 14px",
        background: "rgba(5, 10, 18, 0.76)",
        borderBottom: "1px solid rgba(145, 225, 255, 0.10)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.28)",
      }}
    >
      {/* Left: Fullscreen + Kiosk */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
          style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "1px solid rgba(162, 227, 255, 0.18)",
            borderRadius: 10,
            color: "#dff6ff",
            fontSize: 20,
            cursor: "pointer",
          }}
        >
          {isFullscreen ? "⤡" : "⤢"}
        </button>
        <button
          type="button"
          onClick={onEnterKiosk}
          title="Enter kiosk mode — hides all controls (use Cmd+K to exit)"
          style={{
            height: 44,
            padding: "0 14px",
            display: "flex",
            alignItems: "center",
            background: "transparent",
            border: "1px solid rgba(162, 227, 255, 0.18)",
            borderRadius: 10,
            color: "rgba(200, 235, 255, 0.6)",
            fontSize: 13,
            cursor: "pointer",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          Kiosk
        </button>
      </div>

      {/* Center: Channel switcher */}
      <ChannelSwitcher channel={channel} onSetChannel={onSetChannel} />

      {/* Right: Controls toggle */}
      <button
        type="button"
        onClick={onTogglePanel}
        style={{
          height: 44,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: panelOpen
            ? "rgba(100, 200, 255, 0.16)"
            : "transparent",
          border: "1px solid rgba(162, 227, 255, 0.18)",
          borderRadius: 10,
          color: panelOpen ? "#7df9ff" : "#dff6ff",
          fontSize: 13,
          fontWeight: panelOpen ? 600 : 400,
          cursor: "pointer",
          transition: "background 0.15s, color 0.15s",
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        ⚙ Controls
      </button>
    </div>
  );
}
