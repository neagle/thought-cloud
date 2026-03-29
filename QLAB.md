# QLab → Thought Cloud Cue Guide

> **Tip:** Open `/cues` in any browser while the app is running for an interactive version of this guide with one-click copy buttons and auto-detected address.

## Local / Offline Setup (recommended for live performance)

The app can run entirely on a local network with no internet required. Presets and settings persist to a local file (`data/store.json`) that survives server restarts.

### One-time setup (requires internet)

1. Install **Node.js** (v18 or later): [nodejs.org](https://nodejs.org/) — download the macOS installer
2. In Terminal, navigate to the project folder and run:
   ```
   npm install
   npm run build
   ```

### Showtime (no internet needed)

Double-click **`start-show.command`** in the project folder. A Terminal window opens and the server starts at `http://localhost:3000`.

Or from Terminal:
```bash
npm start
```

**QLab URL:** `http://localhost:3000/api/cue` (QLab runs on the same Mac — no network needed for cues)

**iPad URL:** `http://YOUR_MAC_LOCAL_IP:3000` — find your Mac's IP in System Settings → Network.  
Example: `http://192.168.1.42:3000`

### Stopping the server

Press `Ctrl+C` in the Terminal window.

### Presets and settings persistence

Presets and control values are saved to `data/store.json` in the project folder. This file:
- Persists across server restarts
- Is human-readable JSON (you can inspect or edit it in any text editor)
- Is excluded from git (so show-specific presets don't get committed)
- Can be copied to another machine to transfer your preset library

---

## How it works

Thought Cloud polls `GET /api/cue` every 500ms. You trigger changes by sending a `POST /api/cue` from QLab using a **Script cue** (AppleScript). The app picks up the change within ~500ms + network latency.

**Local:** Replace `YOUR_SERVER_URL` with `http://localhost:3000`  
**Cloud (Vercel):** Replace `YOUR_SERVER_URL` with your deployment URL (e.g. `https://thought-cloud.vercel.app`)

---

## QLab Setup

In QLab Free, create a **Script cue** and paste one of the AppleScript snippets below.  
Tip: name your Script cues clearly (e.g. "TC → voicemail", "TC → presence", "TC → preset: dramatic").

**Note on QLab Free:** Script cues require a 60-minute demo session (File → Start Demo). For testing without opening a demo session, use the `curl` commands in Terminal — they are functionally identical.

---

---

## Cue Types

### 1. Kiosk Mode

Enter kiosk mode to hide all controls UI (performance mode). Exit to restore controls for rehearsal.

```applescript
-- Enter kiosk mode (hide controls)
do shell script "curl -s -X POST 'http://localhost:3000/api/cue' -H 'Content-Type: application/json' -d '{\"action\":\"kiosk\",\"value\":true}'"
```

```applescript
-- Exit kiosk mode (show controls)
do shell script "curl -s -X POST 'http://localhost:3000/api/cue' -H 'Content-Type: application/json' -d '{\"action\":\"kiosk\",\"value\":false}'"
```

---

### 2. Switch Channel

```applescript
-- Switch to VOICEMAIL channel
do shell script "curl -s -X POST 'https://YOUR_VERCEL_URL/api/cue' -H 'Content-Type: application/json' -d '{\"action\":\"channel\",\"channel\":\"voicemail\"}'"
```

```applescript
-- Switch to PRESENCE channel
do shell script "curl -s -X POST 'https://YOUR_VERCEL_URL/api/cue' -H 'Content-Type: application/json' -d '{\"action\":\"channel\",\"channel\":\"presence\"}'"
```

---

### 3. Load a Saved Preset by Name

Presets must already be saved in the app's UI before they can be triggered by QLab.  
The preset name is case-sensitive and must match exactly.

The optional `duration` field controls the transition length in seconds (default: **2.0**).  
Pass `"duration": 0` for an instant snap.

```applescript
-- Load preset "dramatic" with default 2s transition
do shell script "curl -s -X POST 'https://YOUR_VERCEL_URL/api/cue' -H 'Content-Type: application/json' -d '{\"action\":\"preset\",\"channel\":\"presence\",\"name\":\"dramatic\"}'"
```

```applescript
-- Load preset with a custom 4s transition
do shell script "curl -s -X POST 'https://YOUR_VERCEL_URL/api/cue' -H 'Content-Type: application/json' -d '{\"action\":\"preset\",\"channel\":\"presence\",\"name\":\"dramatic\",\"duration\":4}'"
```

```applescript
-- Instant snap (no transition)
do shell script "curl -s -X POST 'https://YOUR_VERCEL_URL/api/cue' -H 'Content-Type: application/json' -d '{\"action\":\"preset\",\"channel\":\"presence\",\"name\":\"dramatic\",\"duration\":0}'"
```

If the preset name is not found, the API returns a 404 (the cue fires but nothing changes in the app).

---

### 4. Set Individual Control Values

You can push any subset of slider values directly. Unspecified sliders keep their current values.  
The optional `duration` field works the same as for presets (default: **2.0s**).

**Presence channel controls** (available keys):  
`masterIntensity`, `idleDrift`, `agitationGain`, `sparkThreshold`, `sparkBurstSize`,
`haloStrength`, `coreStrength`, `coreHue`, `coreSize`, `coreElongation`,
`bloomBias`, `rotationDrift`, `speechBias`,
`flowSmoothing`, `cohesion`, `turbulence`, `saturation`,
`baseHue`, `accentHue`, `highlightHue`, `hueDrift`,
`speechColorBoost`, `sustainBackoff`, `fireflyChance`, `fireflyHold`, `fireflyFade`

**Voicemail channel controls** (available keys):  
`hue`, `saturation`, `intensity`, `lineWidth`, `glowBlur`, `glowOpacity`

```applescript
-- Set masterIntensity to 0.5 and agitationGain to 2.0 on presence
do shell script "curl -s -X POST 'https://YOUR_VERCEL_URL/api/cue' -H 'Content-Type: application/json' -d '{\"action\":\"controls\",\"scope\":\"presence\",\"data\":{\"masterIntensity\":0.5,\"agitationGain\":2.0}}'"
```

```applescript
-- Set voicemail glow intensity and hue
do shell script "curl -s -X POST 'https://YOUR_VERCEL_URL/api/cue' -H 'Content-Type: application/json' -d '{\"action\":\"controls\",\"scope\":\"voicemail\",\"data\":{\"intensity\":1.5,\"hue\":200}}'"
```

---

## Combining Channel Switch + Preset in Sequence

QLab cues fire in order. To switch channel AND load a preset:

1. Script Cue: switch channel (`action: "channel"`)
2. Wait Cue: 0.6s (let the app pick up the channel change)
3. Script Cue: load preset (`action: "preset"`)

---

## Testing from Terminal

Use single quotes around the JSON body — no backslash-escaping needed in the shell.  
(The `\"` escaping in the AppleScript snippets above is only needed inside AppleScript's double-quoted strings.)

```bash
# Switch channel
curl -X POST 'https://YOUR_VERCEL_URL/api/cue' \
  -H 'Content-Type: application/json' \
  -d '{"action":"channel","channel":"voicemail"}'

# Load preset
curl -X POST 'https://YOUR_VERCEL_URL/api/cue' \
  -H 'Content-Type: application/json' \
  -d '{"action":"preset","channel":"presence","name":"dramatic"}'

# Push control values
curl -X POST 'https://YOUR_VERCEL_URL/api/cue' \
  -H 'Content-Type: application/json' \
  -d '{"action":"controls","scope":"presence","data":{"masterIntensity":0.5}}'
```

---

## Timing Notes

- App polls every 500ms → worst-case latency ~500ms after curl returns
- Vercel cold start can add 200–400ms on the first request after inactivity
- For tightly-timed cues, fire the Script cue ~0.5–1s before the visual needs to change
- All open browser tabs pick up the change (first via polling, others via BroadcastChannel)
