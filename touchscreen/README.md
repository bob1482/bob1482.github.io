# Web Piano

A touch-friendly, hexagonal keyboard instrument built with TypeScript, Pixi.js, and the Web Audio API. Uses the Wicki-Heyden note layout for isomorphic fingering — the same chord shape can be transposed to any key by moving the hand position.

## Features

- **Wicki-Heyden hexagonal layout** — isomorphic fingering across all keys
- **Multi-touch support** — play multiple notes simultaneously via pointer events
- **Keyboard input** — QWERTY keyboard mapping in landscape mode
- **Portrait & landscape modes** — automatically adapts to screen orientation
  - Portrait: 4×10 hex grid
  - Landscape (standard): 12×8 hex grid
  - Landscape (ultra-wide, 2:1+): 10×5 hex grid
- **Jianpu (numbered musical notation)** — scale degrees with octave dots
- **Gliding notes** — optional slide between adjacent keys while dragging
- **Nearest-sample pitch shifting** — plays closest available sample with playback rate adjustment
- **Low-latency rendering** — Pixi.js with manual render-on-demand (no 60fps idle loop)

## Quick Start

```bash
# Install dependencies
npm install

# Build the bundle
npm run build

# Serve locally on port 3000
npm run serve
```

Then open `http://localhost:3000` in your browser.

## Development

```bash
# Watch mode with auto-rebuild
npm run dev

# Type checking
npm run typecheck

# Run tests
npm test
```

## Project Structure

```
touchscreen/
├── index.html              # Entry point HTML
├── sample/                 # MP3 audio samples (A, C, D#, F# across octaves)
├── src/
│   ├── main.ts             # Application bootstrap & sample loading
│   ├── AudioEngine.ts     # Web Audio playback with pitch-shift fallback
│   ├── SampleLoader.ts    # MP3 fetch & decode with progress reporting
│   ├── WickiHeydenGrid.ts # Main grid controller (layout, render, resize)
│   ├── GridLayout.ts      # Hex grid construction & positioning math
│   ├── HexKey.ts           # HexKey interface & constants
│   ├── HexUtils.ts         # Hexagon drawing & hit-testing
│   ├── HexRenderer.ts     # Key color logic & shared render helpers
│   ├── PointerHandler.ts   # Multi-touch pointer event handling
│   ├── KeyboardHandler.ts  # QWERTY keyboard → hex key mapping
│   ├── SettingsUI.ts       # Settings button (PIXI) + overlay (DOM)
│   ├── NoteUtils.ts        # Note name ↔ MIDI, Jianpu notation
│   ├── constants.ts        # Shared named constants (no magic numbers)
│   └── types.ts            # Shared type definitions
├── tests/                  # Unit tests (Vitest)
│   ├── NoteUtils.test.ts
│   ├── HexUtils.test.ts
│   └── GridLayout.test.ts
├── package.json
├── tsconfig.json
└── .gitignore
```

## Audio Samples

The `sample/` directory contains 30 MP3 files covering:
- **A** (A0–A7)
- **C** (C1–C8)
- **D#** (Ds1–Ds7)
- **F#** (Fs1–Fs7)

When a note doesn't have an exact sample, the engine finds the nearest available sample and pitch-shifts it using Web Audio's `playbackRate`.

## Wicki-Heyden Layout

The Wicki-Heyden system arranges notes in a hexagonal grid where:
- **Even rows** are C octaves (C, D, E, F, G, A, B)
- **Odd rows** are G octaves (shifted by a perfect fifth)
- Moving **right** goes up a whole step
- Moving **up-right** goes up a perfect fourth
- Moving **down-right** goes up a perfect fifth

This means any scale or chord has the same physical fingering pattern regardless of the key — you just shift your hand to transpose.

## Jianpu (Numbered Notation)

Keys display their scale degree (1–7) in the C major scale:
- `1` = C, `2` = D, `3` = E, `4` = F, `5` = G, `6` = A, `7` = B
- Sharps are prefixed with `#` (e.g., `#1` = C#)
- Octave dots appear above (higher octaves) or below (lower octaves) the number:
  - 3 dots = 2+ octaves away
  - 2 dots = 2 octaves away
  - 1 dot = 1 octave away
  - No dots = middle octave (C4–B4)

## Settings

Long-press the ⚙ button (bottom-right of the grid) to open the settings panel:
- **Gliding Notes** — when enabled, sliding your finger across the grid plays each key you pass over

## Tech Stack

- **TypeScript** — type-safe development
- **Pixi.js v7** — WebGL-based 2D rendering
- **Web Audio API** — low-latency audio playback
- **esbuild** — fast bundling with watch mode
- **Vitest** — unit testing