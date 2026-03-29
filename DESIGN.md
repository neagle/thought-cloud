# Thought Cloud Project Guidelines and Design History

## Project Intent

This project renders a full-screen, audio-reactive visual presence for stage use on an iPad, intended to appear as a hovering holographic entity inside a Pepper's Ghost / glass-cloche setup.

The visual should feel like a **calm, soulful, thought-filled digital being**, not a generic music visualizer.

## Narrative Context

The effect is for the play *Anthropology*.

A programmer has created an LLM from the communication data of her missing/dead sister. The entity is recognizably based on that person, but it is also a little "too" friendly and accommodating. That softened friendliness is one of the clues that reveals its nature.

This should inform the visual language:
- calm rather than aggressive
- emotionally legible rather than flashy
- responsive to speech, but not frantic
- uncanny in a gentle way
- alive even in silence

## Core Artistic Direction

### Primary metaphor
A **thought cloud** or **internal weather system** contained within a soft orb-like field.

### Avoid
- equalizer bars
- ring visualizers with discrete segments
- obviously music-app aesthetics
- harsh or constant rainbow cycling
- rigid geometry
- anything that reads as a gadget or dashboard
- motion that feels like particles being mechanically yanked around

### Favor
- internal currents
- slow drift
- volumetric depth
- soft halos
- subtle parallax
- occasional cognitive sparks
- motion that feels suspended, atmospheric, and cohesive

## Emotional / Behavioral Guidelines

### Default emotional temperature
**Calm / comforting**.

The entity should feel warm, available, and attentive — not ominous, hostile, or chaotic.

### Silence behavior
The entity should **never fully go still**.

Even in silence it should maintain a low living drift, like a quiet interior process continuing.

### Speech behavior
The response should feel more like **thought** than **breath**.

That means favor:
- changing internal currents
- flashes of connection / sparks
- slight awareness brightening
- shifting activity density

over:
- obvious inhale/exhale expansion cycles
- heartbeat-style pulsing as the dominant behavior

## Stage / Illusion Constraints

This piece must work:
- on an iPad
- in full-screen mode
- on a black background
- inside a Pepper's Ghost style illusion
- under stage conditions
- from roughly 20–30 feet away

### Implications
- keep the composition centered and globe-like
- avoid visible rectangular framing
- use strong core readability
- preserve a clear silhouette / glow from audience distance
- prefer larger, slower, legible motions over tiny fussy detail

## Technology Direction

### Recommended stack
- Next.js
- TypeScript
- Three.js
- Web Audio API

### Why Three.js
Three.js is preferred over Canvas 2D for this project because it better supports:
- implied volume
- layered depth
- parallax
- pseudo-holographic presence
- a floating orb/cloud structure that benefits the Pepper's Ghost effect

### Why not SVG
SVG is not the right primary rendering approach for this effect because the visual language depends on continuous animation, particles, depth, glow, and field motion.

## Visual System

The visualization should be built from layered components.

### 1. Core glow
A soft inner nucleus.

Purpose:
- establishes the center of attention
- communicates awareness
- brightens in the presence of speech
- helps the form read from a distance

### 2. Cognition field
The main particle/cloud body.

Purpose:
- conveys living internal activity
- defines the entity's body without hard boundaries
- provides the primary "thought cloud" look

Desired motion:
- slow drift
- coherent shared movement
- internal turbulence that feels atmospheric
- attraction toward a loose orb shape

### 3. Thought sparks
Sparse brighter transient particles or highlights.

Purpose:
- make speech response obvious
- suggest synapses, ideas, or moments of recognition
- provide event-driven reactions to consonants and speech attacks

### 4. Halo / ambient field
A surrounding glow or outer haze.

Purpose:
- helps hide hard edges
- improves legibility in the Pepper's Ghost setup
- reinforces the suspended, non-rectangular appearance

## Color Direction

### Stable identity first
The entity should have a recognizable, stable palette rather than a wildly changing one.

### Recommended palette family
- deep indigo / midnight blue base
- cyan-teal core glow
- soft violet / magenta thought accents
- occasional pearly white highlights

### Palette behavior
- shift very slowly over time
- remain within a coherent spectral identity
- avoid full-spectrum RGB cycling
- use warmer highlights sparingly

## Audio-Reactivity Goals

The most important requirement is that the audience should have **little to no doubt** that the visual is responding to speech.

This should be accomplished through a combination of:

### Continuous response
Driven by sustained speech energy.

Map to things like:
- core brightness
- halo intensity
- field agitation
- internal motion density
- color saturation / activity

### Event-driven response
Driven by attacks / sharp speech transients.

Map to things like:
- spark bursts
- localized brightening
- ripples through the field
- brief momentary increases in flow activity

### Speech-specific emphasis
Do not tune the system as if this were primarily a music visualizer.

Favor mid and upper-mid speech bands enough that:
- vowels feel like presence/body
- consonants feel like thought/spark events
- phrases create obvious shifts in attention

## Motion Direction

### Target feeling
The current preferred motion metaphor is:

**internal weather in space**

not:
- particles suspended in gel
- particles on springs
- particles oscillating between anchor points

### Motion qualities to pursue
- inertia
- drag
- low-frequency field motion
- coherent regional drift
- shared field advection
- center cohesion without visible snapping
- occasional slow curl / vortex behavior

### Motion qualities to reduce
- obvious per-particle tugging
- spring-back oscillation
- high-frequency jitter
- symmetrical bouncing
- over-eager transient reactions that look mechanical

## Current Tuning Insights

### What is already working well
- speech responsiveness is already reading clearly
- the visual connection to human speaking rhythm is strong
- the tuning panel is useful and should remain part of development

### What still needs refinement
- motion still reads as somewhat springy / elastic
- some particles appear to bounce back and forth as if anchored
- the field needs more shared movement and less local oscillation

### Next motion priority
Introduce more **shared field motion** so larger portions of the cloud drift together.

This should move the effect closer to:
- cosmic suspension
- atmospheric cohesion
- internal weather

and further from:
- gel motion
- elastic tethering
- particle spring dynamics

### Current iteration focus (March 2026)
- replace particle-local oscillation with a shared evolving 3D flow field
- increase inertia and drag so particles are advected by flow instead of snapping to per-particle targets
- keep orb cohesion as a soft radial bias (large-scale shape guidance, not tethering)
- map speech primarily to field energy/agitation and spark activity, with less direct positional displacement

This update should move the feel toward **cosmic internal weather** and away from **dots in gelatin**.

## UX / Runtime Constraints

### Startup
Because iPad Safari requires user interaction before audio playback/processing begins, the app should include a simple tap-to-start overlay.

### Fullscreen
The app should be designed as a dedicated full-screen scene with minimal or hidden UI.

### Controls
A lightweight tuning/debug panel is useful during development and rehearsal. Ideally it can be hidden in performance.

Potential controls to preserve:
- agitation gain
- flow smoothing
- orb cohesion
- spark threshold
- halo strength
- core brightness
- rotation drift
- particle count / performance settings

## Performance Guidelines

Optimize for iPad Safari.

General principles:
- keep particle counts reasonable
- preserve smooth frame rate over adding detail
- prioritize large-scale readable motion over micro-detail
- ensure the core effect still reads under non-ideal lighting

## Development Philosophy

The first phase should aim for a **stage-credible prototype**, not final perfection.

### Phase 1 goals
- functioning project scaffold
- working audio input and analysis
- coherent visual identity
- clear speech responsiveness
- tunable parameters
- stage-friendly defaults

### Phase 2 goals
- refine emotional personality
- improve motion language
- tune for physical illusion setup
- improve long-distance readability
- reduce residual springiness/jitter

### Phase 3 goals (optional)
- scene presets
- hidden rehearsal/debug tools
- alternate palettes or moods
- more advanced field logic / wisps / filaments
- cue-based behaviors if needed

## Summary Principle

The visualization should feel like:

> a calm, hovering field of thought that becomes visibly more aware and active when spoken to.

That idea should be stronger than any individual implementation detail.
