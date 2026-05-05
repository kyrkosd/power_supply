<!-- INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability. -->
<!-- INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability. -->
# Power Supply Design Workbench

A desktop engineering tool for designing and analysing switching power supplies.
Built with **Electron + React + TypeScript**.

---

## Features

- **6 topologies** — Buck, Boost, Buck-Boost, Flyback, Forward, SEPIC
- **Live schematic** — annotated circuit diagram that updates as you change parameters
- **Interactive sliders** — all design parameters controllable with instant feedback
- **Bode plot** — Type-2 compensator design with automatic phase-margin targeting
- **Loss breakdown** — MOSFET conduction/switching, diode, inductor DCR/core, capacitor ESR
- **Efficiency curve** — η vs load current at the selected operating point
- **Thermal analysis** — junction temperature bars (green/yellow/red) with heatsink recommendations
- **Component suggestions** — matched inductors, capacitors, and MOSFETs from a curated database
- **Keyboard shortcuts** — `Ctrl+1/2/3/4` to switch visualisation tabs
- **Monte Carlo Tolerance Analysis** — Runs hundreds of iterations varying component tolerances to generate yield histograms and worst-case margins. Helps ensure designs meet efficiency and ripple specs across mass production variances.
- **Ceramic DC Bias Derating** — Automatically derates MLCC capacitance based on DC voltage using empirical curves (e.g., X5R/X7R) to warn about effective capacitance loss. Prevent unexpected instability or high ripple caused by undersized output capacitors.
- **LTspice Bridge** — Generates `.asc` netlists, runs simulations in batch mode, and parses `.raw` files to overlay analytical vs. simulated waveforms. Identifies discrepancies in RMS currents or peak ripples. *(Note: LTspice comparison requires LTspice to be installed locally).*
- **Startup/Transient Simulation** — Solves state-space models using an RK4 integrator to visualize startup inrush, load steps, and line steps directly in the app. Evaluates control loop settling time and voltage overshoot without requiring an external SPICE engine.
- **EMI Pre-Compliance** — Estimates conducted EMI spectrum from input ripple and compares against CISPR 32 Class A/B limits. Highlights failing harmonics and automatically suggests a required LC input filter.
- **DCM detection** — flags when a design operates in discontinuous conduction mode and computes the CCM/DCM boundary current for all non-isolated topologies
- **Project save / load** — saves the full design (topology, all parameters, notes, component overrides) to a `.pswb` JSON file; re-opens it with a single file-open dialog (`Ctrl+S` / `Ctrl+O`)
- **Undo / Redo** — 50-step history with 300 ms debounce so rapid slider drags produce one undo step (`Ctrl+Z` / `Ctrl+Shift+Z`)
- **PDF report export** — 6-page A4 PDF containing design summary, component values table, schematic, waveforms, Bode plot, and loss-breakdown charts (captured via SVG serialisation)
- **CSV BOM export** — 9-column RFC 4180 bill of materials listing every component (Reference, Component, Value, Rating, Package, Manufacturer, Part Number, Quantity, Notes); uses selected component part numbers when available
- **Per-topology Reset** — one-click restore to sensible default values
- **Worker thread** — all computation runs off the main thread; UI stays at 60 fps
- **Design comparison** — save any computed result as Design A (`Ctrl+K`), then change topology or parameters and open a side-by-side diff table (`Ctrl+Shift+K`); win/lose colour coding and a winner badge across 10 key metrics
- **Efficiency heatmap** — 10×10 Vin × Iout operating-space map computed in the Web Worker, rendered as a D3 colour-gradient SVG (dark red → bright green) with a crosshair at the current operating point and hover tooltips; available as a dedicated visualisation tab
- **Input validation with smart defaults** — `validateSpec()` enforces topology-specific constraints (e.g. buck Vout < Vin, boost Vout > Vin, flyback D < 50 %) with inline error/warning banners; switching topology auto-applies matching defaults or shows a confirmation dialog when parameters have been customised
- **Multi-output flyback** — up to 3 additional secondary windings beyond the regulated primary; the engine sizes the transformer core to total output power and computes per-secondary turns count, diode reverse-voltage rating, output capacitance, and a cross-regulation estimate (±% under ±50 % primary load variation); schematic expands to show all secondary circuits
- **Gate drive calculator** — for the selected MOSFET, computes external gate resistor, peak gate current, turn-on/off times (Qg and Qgd based), recommended dead time, and gate drive power dissipation; buck and forward topologies additionally show bootstrap capacitor (Cboot) and bootstrap diode voltage rating with detailed engineering tooltips
- **RCD snubber / clamp design** — for flyback and forward converters, computes leakage-inductance energy at every switch-off event and sizes the RCD clamping network (resistor, capacitor, and fast-recovery diode) using TI SLUA107 / Erickson §6.2.2 formulas; leakage ratio adjustable via a slider (0.5–10 %); clamp power dissipation is factored into the efficiency calculation; a warning is shown if snubber loss exceeds 5 % of output power; schematic annotates actual R, C, and diode reverse-voltage values
- **PCB layout guide** — topology-aware checklist generated from the simulation result: critical current loops ranked by priority (CRITICAL / IMPORTANT / RECOMMENDED), IPC-2221 trace widths for every high-current net, step-by-step component placement order, thermal via recommendations for hot components, and keep-out areas; exported in the PDF report

---

## Supported Topologies

| Topology    | DC Gain | Isolation | RHPZ |
|-------------|---------|-----------|------|
| Buck        | < 1     | No        | No   |
| Boost       | > 1     | No        | Yes  |
| Buck-Boost  | any     | No        | Yes  |
| Flyback     | any     | Yes       | Yes  |
| Forward     | any     | Yes       | No   |
| SEPIC       | any     | No        | Yes  |

---

## Tech Stack

| Layer     | Library                                      |
|-----------|----------------------------------------------|
| Shell     | Electron 33                                  |
| Build     | electron-vite 2.3, Vite 5.4                  |
| UI        | React 18, TypeScript 5.7                     |
| Charts    | Recharts 2, D3 7                             |
| Math      | mathjs 13                                    |
| State     | Zustand 5                                    |
| Tests     | Vitest 2                                     |
| Packaging | electron-builder 25                          |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Development

```bash
npm run dev          # Electron + Vite with HMR
```

### Tests

```bash
npm test             # Single run
npm run test:watch   # Watch mode
npm run type-check   # TypeScript strict check
```

### Production Build

Build the Vite renderer + Electron main, then package with electron-builder:

```bash
# Windows installer (.exe / NSIS)
npm run dist:win

# macOS disk image (.dmg)
npm run dist:mac

# Linux AppImage
npm run dist:linux

# All platforms (requires the host tools to be present)
npm run dist
```

Distributable files are written to `dist/`.

> **First-time build:** regenerate the icons if `resources/icon.png` is missing:
> ```bash
> npm run make:icons
> ```

---

## Architecture

```
src/
├── engine/        Pure computation — no GUI dependencies
│   ├── types.ts               Shared DesignSpec / DesignResult types
│   ├── worker.ts              Web Worker bridge (debounced, 8 ms)
│   ├── control-loop.ts        Type-2 compensator + Bode analysis
│   └── topologies/            One file per topology
├── store/         Zustand state — single source of truth
└── components/    React presentation layer
```

Heavy computation runs in a dedicated Web Worker so the renderer thread is
never blocked. Components never import `engine/` directly; they dispatch store
actions which forward the message to the worker.

---

## License

MIT
