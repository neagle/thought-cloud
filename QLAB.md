# QLab → Thought Cloud Cue Guide

## How it works

Thought Cloud polls `GET /api/cue` every 500ms. You trigger changes by sending a `POST /api/cue` from QLab using a **Script cue** (AppleScript). The app picks up the change within ~500ms + network latency.

Replace `YOUR_VERCEL_URL` with your actual deployment URL (e.g. `https://thought-cloud.vercel.app`).

---

## QLab Setup

In QLab Free, create a **Script cue** and paste one of the AppleScript snippets below.  
Tip: name your Script cues clearly (e.g. "TC → voicemail", "TC → presence", "TC → preset: dramatic").

---

## Cue Types

### 1. Switch Channel

```applescript
-- Switch to VOICEMAIL channel
do shell script "curl -s -X POST 'https://YOUR_VERCEL_URL/api/cue' -H 'Content-Type: application/json' -d '{\"action\":\"channel\",\"channel\":\"voicemail\"}'"
```

```applescript
-- Switch to PRESENCE channel
do shell script "curl -s -X POST 'https://YOUR_VERCEL_URL/api/cue' -H 'Content-Type: application/json' -d '{\"action\":\"channel\",\"channel\":\"presence\"}'"
```

---

### 2. Load a Saved Preset by Name

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

### 3. Set Individual Control Values

You can push any subset of slider values directly. Unspecified sliders keep their current values.  
The optional `duration` field works the same as for presets (default: **2.0s**).

**Presence channel controls** (available keys):  
`masterIntensity`, `idleDrift`, `agitationGain`, `sparkThreshold`, `sparkBurstSize`,
`haloStrength`, `coreStrength`, `bloomBias`, `rotationDrift`, `speechBias`,
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
