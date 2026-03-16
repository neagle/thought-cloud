# Copilot Instructions — Thought Cloud

## Project Purpose

A full-screen, audio-reactive 3D visualization for a theatrical stage production (*Anthropology*). It runs on an iPad inside a Pepper's Ghost / glass-cloche holographic illusion. The visual represents an AI entity made from a deceased person's communication data — **calm, soulful, and gently uncanny**, not a music visualizer.

## Commands

```bash
npm run dev    # Start dev server
npm run build  # Production build
npm start      # Run production build
```

There are no tests. `npm run lint` requires ESLint to be configured (not yet set up).

## Architecture

**Single-page Next.js app (App Router):**

```
app/page.tsx                    → Root client component; owns all state; manages AudioAnalyzer
app/api/cue/route.ts            → GET/POST channel cue endpoint (Upstash Redis-backed; for QLab)
app/api/controls/route.ts       → GET/POST controls persistence (Upstash Redis-backed)
app/api/presets/route.ts        → GET/POST/DELETE named presets per channel (Upstash Redis-backed)
components/StartOverlay.tsx     → Tap-to-start overlay (required by iPad Safari audio policy)
components/CommandPalette.tsx   → Cmd+K overlay: channel switch, fullscreen, kiosk toggle
components/ChannelSwitcher.tsx  → Joined button group for switching channels (bottom-center)
components/PresetsPanel.tsx     → Save/load/delete named control presets; embedded in each controls panel
lib/audio/AudioAnalyzer.ts      → Web Audio API: mic → FFT → AudioSignals + time-domain data
lib/visual/ThoughtOrbScene.tsx  → Three.js scene (~2200 lines); the orb visualization
lib/visual/OscilloscopeOverlay.tsx → Canvas-based waveform for voicemail channel (amber/gold)
lib/sync/TabSync.ts             → BroadcastChannel cross-tab state sync
types/index.ts                  → Shared types: Channel, CHANNELS array
```

**Data flow:**
```
Mic → AudioAnalyzer (owned by page.tsx) → passed as prop to ThoughtOrbScene + OscilloscopeOverlay
```

**Channel vs kiosk/mode — important distinction:**
- **Channel** (`Channel = 'presence' | 'voicemail'`) — what's being shown to the audience. Synced globally across all tabs via BroadcastChannel and persisted to Upstash. QLab controls this via `POST /api/cue`.
- **Station state** (`kioskMode`, `panelOpen`, fullscreen) — per-instance view settings. Never broadcast. Each tab manages its own independently.

**Cross-tab sync (BroadcastChannel):** Channel changes and all slider control values sync instantly across tabs. New tabs do a hello handshake; if no sibling responds within 150ms they fall back to loading from Upstash KV.

**Controls persistence:** Slider changes are debounced 1.5s then saved to Upstash via `POST /api/controls`. Loaded from KV on page mount (after BroadcastChannel handshake timeout).

**Presets:** Named snapshots of control values, stored per-channel in Upstash. Accessible via ▸ Presets section at the bottom of each channel's controls panel.

**QLab integration:** `POST /api/cue` with `{ "channel": "voicemail" }`. Requires Upstash Redis — provision via Vercel dashboard (Storage → Connect Database → Upstash). App polls `GET /api/cue` every 500ms; first tab to detect a change re-broadcasts via BroadcastChannel.

**AudioAnalyzer is lifted to page.tsx** and passed as a prop (`audioAnalyzer: AudioAnalyzer | null`) to both visual components. `ThoughtOrbScene` keeps an internal `audioRef` synced via `useEffect`.

**Controls type is exported** from `ThoughtOrbScene.tsx` (`export type Controls`). `VoicemailControls` exported from `OscilloscopeOverlay.tsx`.

**`ThoughtOrbScene` accepts `audioAnalyzer`, `kioskMode`, `channel`, `externalControls`, `onControlsChange`, `onLoadPreset` props.** When `kioskMode=true`, all UI buttons and panels are hidden — only the Three.js canvas renders.

**Keyboard shortcuts:** `F` toggles fullscreen; `Cmd+K` opens/closes CommandPalette; `Escape` closes palette and natively exits fullscreen.

**URL param:** `?kiosk=true` starts in kiosk mode (display tab).

## Key Conventions

**Styling:** Inline `style` objects only — no Tailwind, no CSS modules, no external CSS framework. Global CSS (`app/globals.css`) only resets body/html and sets `color-scheme: dark`.

**TypeScript:** Strict mode, no `allowJs`. All types defined inline in the file that uses them — no separate type files. Key types: `Controls` (25+ tunable params), `AudioSignals`, `Spark`, `FireflyOverlay`, `FlowAnchor`.

**Imports:** Use the `@/` alias for all non-relative imports. Three.js is always imported as `import * as THREE from 'three'`.

**Constants:** `UPPER_SNAKE_CASE`. Refs: suffix with `Ref` (`containerRef`, `audioRef`, `controlsRef`).

**File placement:** visual components → `lib/visual/`, audio logic → `lib/audio/`, UI overlays → `components/`.

**No backend.** Everything is client-side. No database, no API routes, no external services.

## Artistic Constraints (inform all visual/motion decisions)

- Motion should feel like **internal weather in space** — inertia, drag, coherent field drift — not particles on springs or in gel
- Particles should **never fully stop**; maintain low living drift in silence
- Speech response maps to internal currents and spark bursts, not mechanical expansion/contraction
- Color palette: deep indigo/midnight blue base, cyan-teal core glow, soft violet/magenta accents — shift slowly, never full-spectrum RGB cycling
- Composition must stay centered and globe-like with no visible rectangular framing (Pepper's Ghost constraint)
- Optimize for **iPad Safari** — smooth frame rate over detail density

## Current Iteration Focus (March 2026)

- Replace per-particle local oscillation with a **shared evolving 3D flow field**
- Increase inertia/drag so particles are advected by flow, not snapped to per-particle targets
- Orb cohesion = soft radial bias only (large-scale shape guidance, not tethering)
- Speech maps primarily to **field energy/agitation and spark activity**, less to direct positional displacement
