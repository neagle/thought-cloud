"use client";

import { useEffect } from "react";
import type { Channel } from "@/types";

interface Props {
  channel: Channel;
  kioskMode: boolean;
  isFullscreen: boolean;
  onClose: () => void;
  onExitKiosk: () => void;
  onEnterKiosk: () => void;
  onToggleFullscreen: () => void;
  onSetChannel: (channel: Channel) => void;
  onOpenPanel: () => void;
}

export function CommandPalette({
  channel,
  kioskMode,
  isFullscreen,
  onClose,
  onExitKiosk,
  onEnterKiosk,
  onToggleFullscreen,
  onSetChannel,
  onOpenPanel,
}: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const items: Array<{ label: string; action: () => void; active?: boolean }> =
    [
      {
        label: isFullscreen ? "Exit fullscreen" : "Enter fullscreen",
        action: onToggleFullscreen,
      },
      kioskMode
        ? { label: "Exit kiosk mode (show controls)", action: onExitKiosk }
        : { label: "Enter kiosk mode (hide controls)", action: onEnterKiosk },
      {
        label: "QLab cue reference →",
        action: () => window.open("/cues", "_blank"),
      },
    ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: "rgba(0,0,0,0.45)",
        }}
      />

      {/* Palette */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 51,
          width: 360,
          borderRadius: 16,
          background: "rgba(8, 14, 26, 0.92)",
          border: "1px solid rgba(162, 227, 255, 0.2)",
          backdropFilter: "blur(24px)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px 10px",
            borderBottom: "1px solid rgba(162,227,255,0.1)",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(162,227,255,0.5)",
          }}
        >
          Command Palette
        </div>
        <div style={{ padding: "6px 0 8px" }}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                item.action();
                onClose();
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "11px 18px",
                background: "transparent",
                border: "none",
                color: item.active ? "#7df9ff" : "#dff6ff",
                fontSize: 14,
                cursor: "pointer",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(162,227,255,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "transparent";
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          style={{
            padding: "8px 18px 12px",
            borderTop: "1px solid rgba(162,227,255,0.1)",
            fontSize: 11,
            color: "rgba(162,227,255,0.35)",
          }}
        >
          Press Esc to close
        </div>
      </div>
    </>
  );
}
