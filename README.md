# Thought Cloud

A full-screen, audio-reactive 3D visualization built for live theatrical performance. A particle orb responds to speech in real time and is designed to be displayed via Pepper's Ghost / glass-cloche holographic illusion. Remote-controllable via HTTP — built to work with QLab on an isolated local network.

See [`DESIGN.md`](./DESIGN.md) for the original artistic brief and visual design guidelines.  
See [`QLAB.md`](./QLAB.md) for the complete QLab integration guide and cue reference.  
Open `/cues` in your browser while the app is running for an interactive, copy-ready cue reference.

---

## Running Locally (recommended for performance)

The app runs as a local Node.js server. No internet is needed at showtime — all presets and settings are saved to `data/store.json` on disk.

### One-time setup (requires internet)

1. Install **Node.js** v18 or later: [nodejs.org](https://nodejs.org/)
2. In Terminal, from the project folder:
   ```bash
   npm install
   npm run build
   ```

### Showtime

**Double-click `start-show.command`** in the project folder to open a Terminal window and start the server.

Or from Terminal:
```bash
npm start
```

The app runs at **`http://localhost:3000`**.

To stop: press `Ctrl+C` in the Terminal window.

### Opening the display

- **Same Mac (OBS browser source):** use `http://localhost:3000`
- **iPad or another device on local WiFi:** use `http://[your-mac-ip]:3000`  
  Find your Mac's IP in System Settings → Network.

### Development

```bash
npm run dev
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd+K` | Open command palette (channel switch, kiosk, QLab cue reference) |
| `F` | Toggle fullscreen |
| `Escape` | Close palette / exit fullscreen |

---

## QLab Integration

QLab controls the app by sending HTTP POST requests from **Script cues** (AppleScript). Works with QLab Free (requires enabling a 60-minute demo session for Script cues; curl commands work any time for testing).

**Quick reference — example curl commands:**

```bash
# Switch channel
curl -s -X POST 'http://localhost:3000/api/cue' \
  -H 'Content-Type: application/json' \
  -d '{"action":"channel","channel":"voicemail"}'

# Load a named preset (2-second transition)
curl -s -X POST 'http://localhost:3000/api/cue' \
  -H 'Content-Type: application/json' \
  -d '{"action":"preset","channel":"presence","name":"calm","duration":2}'

# Enter kiosk mode (hide controls UI)
curl -s -X POST 'http://localhost:3000/api/cue' \
  -H 'Content-Type: application/json' \
  -d '{"action":"kiosk","value":true}'
```

See [`QLAB.md`](./QLAB.md) for the full guide including AppleScript templates for QLab cues.

---

## Channels

| Channel | Description |
|---------|-------------|
| `presence` | Orb / particle cloud visualization |
| `voicemail` | Oscilloscope waveform |

---

## Presets

Named snapshots of all control values. Create and manage them in the controls panel (open via the `▸` button). Load them remotely via QLab cues. Stored in `data/store.json` (local) or Upstash Redis (Vercel).

---

## Deploying to Vercel (cloud / internet)

1. Push to GitHub
2. Connect to [Vercel](https://vercel.com/)
3. Provision an **Upstash Redis** database via Vercel Storage
4. The app auto-detects Upstash env vars and uses Redis instead of the local file store

---

## Project Structure

```
app/
  page.tsx              Root client component; owns all state
  layout.tsx            HTML shell; PWA manifest; SW registration
  cues/page.tsx         Interactive QLab cue reference (open in browser)
  api/cue/route.ts      QLab endpoint — GET/POST channel + pending actions
  api/controls/route.ts Controls persistence
  api/presets/route.ts  Named preset storage
components/
  StartOverlay.tsx      Tap-to-start (required by iPad Safari audio policy)
  CommandPalette.tsx    Cmd+K overlay
  ChannelSwitcher.tsx   Channel toggle buttons
  PresetsPanel.tsx      Save/load/delete presets UI
lib/
  audio/AudioAnalyzer.ts     Web Audio → FFT → AudioSignals
  visual/ThoughtOrbScene.tsx Three.js orb scene (~2300 lines)
  visual/OscilloscopeOverlay.tsx  Canvas waveform
  storage.ts            Storage abstraction (Upstash / JSON file / in-memory)
  sync/TabSync.ts       BroadcastChannel cross-tab sync
data/
  store.json            Local persistent store (gitignored; created at runtime)
public/
  manifest.json         PWA manifest
  sw.js                 Service worker (cache-first for assets)
```

