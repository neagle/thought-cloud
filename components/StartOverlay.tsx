"use client";

interface Props {
  onStart: () => void;
}

export function StartOverlay({ onStart }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at center, rgba(34, 72, 111, 0.22), rgba(0,0,0,0.96) 56%)",
        zIndex: 20,
      }}
    >
      <button
        type="button"
        onClick={onStart}
        style={{
          border: "1px solid rgba(176, 229, 255, 0.35)",
          borderRadius: 999,
          padding: "1rem 1.5rem",
          background: "rgba(8, 17, 28, 0.86)",
          color: "#e5f7ff",
          fontSize: "1rem",
          letterSpacing: "0.02em",
          boxShadow: "0 0 40px rgba(64, 186, 255, 0.18)",
          cursor: "pointer",
          backdropFilter: "blur(14px)",
        }}
      >
        Tap to start audio-reactive mode
      </button>
    </div>
  );
}
