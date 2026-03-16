"use client";

import { useEffect, useState } from "react";
import type { Channel } from "@/types";

interface Props {
  channel: Channel;
  getControls: () => Record<string, number>;
  onLoad: (data: Record<string, number>) => void;
}

export function PresetsPanel({ channel, getControls, onLoad }: Props) {
  const [presets, setPresets] = useState<Record<string, Record<string, number>>>({});
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  async function fetchPresets() {
    try {
      const res = await fetch(`/api/presets?channel=${channel}`);
      if (!res.ok) return;
      const { presets: p } = (await res.json()) as {
        presets: Record<string, Record<string, number>>;
      };
      setPresets(p);
    } catch {}
  }

  useEffect(() => {
    fetchPresets();
  }, [channel]);

  async function handleSave() {
    const name = saveName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, name, data: getControls() }),
      });
      setSaveName("");
      await fetchPresets();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(name: string) {
    await fetch("/api/presets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, name }),
    });
    await fetchPresets();
  }

  const names = Object.keys(presets).sort();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!panelOpen) fetchPresets();
          setPanelOpen((v) => !v);
        }}
        style={{
          display: "block",
          width: "100%",
          marginTop: 14,
          padding: "0.5rem 0",
          background: "rgba(162,227,255,0.06)",
          border: "1px solid rgba(162,227,255,0.16)",
          borderRadius: 8,
          color: "#c8eeff",
          fontSize: 12,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        {panelOpen ? "▾ Presets" : "▸ Presets"}
      </button>

      {panelOpen ? (
        <div style={{ marginTop: 10 }}>
          {/* Save row */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              placeholder="Preset name…"
              style={{
                flex: 1,
                padding: "0.35rem 0.5rem",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(162,227,255,0.18)",
                borderRadius: 6,
                color: "#dff6ff",
                fontSize: 12,
              }}
            />
            <button
              type="button"
              disabled={!saveName.trim() || saving}
              onClick={() => handleSave()}
              style={{
                padding: "0.35rem 0.7rem",
                background: "rgba(100,200,255,0.14)",
                border: "1px solid rgba(162,227,255,0.2)",
                borderRadius: 6,
                color: "#dff6ff",
                fontSize: 12,
                cursor: "pointer",
                opacity: !saveName.trim() || saving ? 0.4 : 1,
              }}
            >
              {saving ? "…" : "Save"}
            </button>
          </div>

          {/* Preset list */}
          {names.length === 0 ? (
            <div style={{ fontSize: 11, opacity: 0.45, textAlign: "center", padding: "6px 0" }}>
              No saved presets
            </div>
          ) : (
            names.map((name) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 5,
                }}
              >
                <span style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </span>
                <button
                  type="button"
                  onClick={() => onLoad(presets[name])}
                  style={{
                    padding: "0.25rem 0.5rem",
                    background: "rgba(100,200,255,0.12)",
                    border: "1px solid rgba(162,227,255,0.18)",
                    borderRadius: 5,
                    color: "#9ee8ff",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(name)}
                  style={{
                    padding: "0.25rem 0.5rem",
                    background: "transparent",
                    border: "1px solid rgba(255,100,100,0.2)",
                    borderRadius: 5,
                    color: "rgba(255,140,140,0.7)",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </>
  );
}

