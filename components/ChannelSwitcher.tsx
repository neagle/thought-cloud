"use client";

import type { Channel } from "@/types";
import { CHANNELS } from "@/types";

interface Props {
  channel: Channel;
  onSetChannel: (c: Channel) => void;
}

const LABELS: Record<Channel, string> = {
  presence: "Presence",
  voicemail: "Voicemail",
};

export function ChannelSwitcher({ channel, onSetChannel }: Props) {
  return (
    <div
      style={{
        display: "flex",
        borderRadius: 999,
        overflow: "hidden",
        border: "1px solid rgba(162, 227, 255, 0.2)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
      }}
    >
      {CHANNELS.map((c, i) => {
        const active = c === channel;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onSetChannel(c)}
            style={{
              padding: "0.65rem 1.2rem",
              minHeight: 44,
              border: "none",
              borderLeft: i > 0 ? "1px solid rgba(162,227,255,0.15)" : "none",
              background: active
                ? "rgba(100, 200, 255, 0.18)"
                : "rgba(0,0,0,0.48)",
              color: active ? "#7df9ff" : "rgba(200,235,255,0.6)",
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              letterSpacing: "0.04em",
              cursor: active ? "default" : "pointer",
              transition: "background 0.2s, color 0.2s",
            }}
          >
            {LABELS[c]}
          </button>
        );
      })}
    </div>
  );
}
