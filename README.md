# Power Supply Design Workbench

A desktop engineering tool for designing and analysing switching power supplies.
Built with **Electron + React + TypeScript**.

---

## Features

### Core Analysis
- **6 topologies** — Buck, Boost, Buck-Boost, Flyback, Forward, SEPIC
- **Live schematic** — annotated circuit diagram that updates as you change parameters
- **Interactive sliders** — all design parameters controllable with instant feedback
- **Bode plot** — Type-2 compensator design with automatic phase-margin targeting; current-mode toggle switches to single-pole plant model
- **Loss breakdown** — MOSFET conduction/switching, diode, inductor DCR/core, capacitor ESR
- **Efficiency curve** — η vs load current at the selected operating point
- **Thermal analysis** — junction temperature bars (green/yellow/red) with heatsink recommendations
- **Worker thread** — all heavy computation runs off the main thread; UI stays at 60 fps
- **DCM detection** — flags discontinuous conduction mode and computes CCM/DCM boundary current

### Component Design
- **Component suggestions** — matched inductors, capacitors, and MOSFETs from a curated local database
- **Inductor saturation check** — margin-to-Isat colour coded (green/amber/red); warns when peak ripple threatens saturation
- **Gate drive calculator** — Rg, peak gate current, turn-on/off times, dead time, gate drive power, bootstrap cap and diode Vr (Buck, Forward)
- **RCD snubber / clamp design** — sizes the RCD clamping network for flyback and forward converters; leakage ratio adjustable 0.5–10 %
- **Feedback resistor divider** — E96/E24 snapping, Vout error, divider power dissipation (TI SLVA477B)
- **Soft-start calculator** — sizes Css, estimates inrush with and without soft-start, flags monotonic-startup and pre-bias-safety (ON Semi AND9135)
- **Capacitor lifetime estimator** — Arrhenius model with ripple-current self-heating and voltage stress derating (IEC 61709 §6); electrolytic only

### Advanced Analysis
- **Monte Carlo Tolerance Analysis** — hundreds of iterations varying component tolerances; yield histograms and worst-case margins
- **Ceramic DC Bias Derating** — MLCC capacitance derated from empirical X5R/X7R DC-voltage curves
- **Startup/Transient Simulation** — RK4 state-space solver; startup inrush, load step, and line step; settling time and overshoot metrics (Buck only)
- **EMI Pre-Compliance** — conducted EMI spectrum vs. CISPR 32 Class A/B; highlights failing harmonics and suggests input LC filter
- **Efficiency heatmap** — 10×10 Vin × Iout colour-gradient SVG; crosshair at operating point; hover tooltips
- **LTspice Bridge** — generates `.asc` netlists, runs in batch mode, parses `.raw` files, overlays analytical vs. simulated waveforms *(LTspice must be installed)*
- **Current sensing design** — resistor or Rds(on) method; SNR check at 10 % load; slope-compensation ramp; Kelvin-connection flag for low-value shunts (TI SLVA452B)
- **Input filter design** — DM + CM two-stage filter with Middlebrook stability margin; auto-selects attenuation target from EMI result; X/Y capacitors per IEC 60384-14
- **Parameter sweep** — sweep any spec parameter (Vin, Vout, Iout, fsw, ripple ratio, temperature) across a user-defined range; phase margin plotted at each point; CSV export
- **Interactive equation explorer** — click any result value to open the equation with live sliders; re-evaluates instantly without a worker round-trip

### Component Design (new in v4.0)
- **Transformer winding calculator** — Dowell skin-depth and proximity-effect model; selects AWG, strand count, fill factor, and layer count; IEC 62368-1 creepage and clearance distances
- **Multi-phase buck (2–6 phases)** — per-phase inductor sizing; output ripple cancellation at N × fsw; losses and peak current scaled per-phase
- **Synchronous rectification** — toggle for buck, boost, buck-boost, SEPIC; replaces diode conduction loss with Rds(on) + dead-time + Coss losses; schematic shows sync FET symbol

### Multi-Rail & Layout
- **Power sequencing analyzer** — TI SLVA722 sequential chain; auto-orders rails (core → I/O → HV); D3 timing diagram; conflict detection (brown-out warning); load rails from `.pswb` files or enter manually
- **PCB layout guide** — topology-aware: critical loops (CRITICAL/IMPORTANT/RECOMMENDED), IPC-2221 trace widths, component placement order, thermal via counts, keep-out regions
- **Multi-output flyback** — up to 3 additional secondary windings; per-secondary Ns, diode Vr, Cout, and cross-regulation estimate (±% under ±50 % primary load swing)

### Project & Workflow
- **Project save / load** — full design (topology, parameters, notes, overrides) to `.pswb` JSON (`Ctrl+S` / `Ctrl+O`)
- **Undo / Redo** — 50-step history with 300 ms debounce (`Ctrl+Z` / `Ctrl+Shift+Z`)
- **Design comparison** — save Design A (`Ctrl+K`), compare side-by-side (`Ctrl+Shift+K`); win/lose colour coding across 10 metrics
- **PDF report export** — 6-page A4 PDF: design summary, component table, schematic, waveforms, Bode plot, loss breakdown
- **CSV BOM export** — 9-column RFC 4180 BOM with selected part numbers
- **Design library** — 12 curated reference designs (USB charger, LED driver, server PSU, USB-C PD, automotive, etc.); search by application; loads topology + spec in one click (`Ctrl+L`)
- **Community plugins** — drop a `.js` topology file into the plugins folder; no rebuild required; enable/disable per plugin in Settings; full authoring guide in [PLUGINS.md](PLUGINS.md)
- **URL state share** — one-click clipboard copy of a zlib-compressed URL encoding the current design spec
- **Input validation** — per-topology constraints (buck Vout < Vin, boost Vout > Vin, flyback D < 50 %) with inline error/warning banners
- **Smart topology defaults** — silent default-apply when spec is unmodified; confirmation dialog otherwise
- **Keyboard shortcuts** — `Ctrl+1–4` tabs, `Ctrl+K/Shift+K` comparison, `Ctrl+L` library, `?` help, `Ctrl+Z/Y` undo/redo

---

## Component Search

The Components panel shows suggestions from a curated local database by default.
An optional **Digi-Key API integration** provides real-time pricing, stock, and datasheets.

### Enabling Digi-Key Search

1. Create a free account at [developer.digikey.com](https://developer.digikey.com) and generate a **Production API key** (Client ID + Client Secret, OAuth2 client credentials flow).
2. Open **⚙ Settings** in the toolbar.
3. Enter your Client ID and Client Secret, then click **Save**.
4. Click **Test Connection** to verify credentials.
5. Toggle **Enable Digi-Key search** on.

Once enabled, each component section (Inductor, Capacitor, MOSFET) shows a collapsible **Search Digi-Key** panel. Results include price, stock quantity, electrical parameters, and a direct product link.

**Offline / no-key behaviour:** If the API is unreachable or no credentials are saved, the panel shows an "offline" badge and falls back to the local database — no interruption to the design workflow.

**Security:** Credentials are encrypted at rest using Electron's `safeStorage` API (OS keychain). The secret is never returned to the renderer process. Results are cached for 1 hour; API requests are rate-limited to 5 per minute to stay within Digi-Key's free-tier limit.

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
| Shell     | Electron 41                                  |
| Build     | electron-vite 2.3, Vite 5.4                  |
| UI        | React 18, TypeScript 5.7                     |
| Charts    | Recharts 2, D3 7                             |
| Math      | mathjs 13                                    |
| State     | Zustand 5                                    |
| Tests     | Vitest 2                                     |
| Packaging | electron-builder 25                          |

---

## Architecture

```
src/
├── engine/                Pure computation — zero GUI dependencies
│   ├── types.ts               Shared DesignSpec / DesignResult types
│   ├── worker.ts              Web Worker bridge (COMPUTE, MC_COMPUTE,
│   │                          EFFICIENCY_MAP, TRANSIENT_COMPUTE,
│   │                          SWEEP_COMPUTE, LOAD_PLUGINS)
│   ├── index.ts               Topology registry + getStateSpaceModelFn()
│   ├── control-loop.ts        Type-2 / current-mode Bode analysis
│   ├── monte-carlo.ts         Monte Carlo parameter sweep
│   ├── dc-bias.ts             MLCC DC-bias derating
│   ├── transient.ts           RK4 state-space transient solver
│   ├── emi.ts                 EMI spectrum + CISPR limit comparison
│   ├── current-sense.ts       Peak CM sensing (resistor + Rds(on))
│   ├── input-filter.ts        DM/CM EMI filter + Middlebrook stability
│   ├── transformer-winding.ts Dowell skin/proximity, AWG, creepage
│   ├── equation-metadata.ts   Equation catalogue + variable descriptors
│   ├── plugin-types.ts        TopologyPlugin interface + validatePlugin
│   ├── share.ts               URL state encode/decode (zlib + Base64)
│   ├── validation.ts          Per-topology spec validation
│   ├── gate-drive.ts          Gate drive resistor + bootstrap sizing
│   ├── snubber.ts             RCD clamp design (flyback, forward)
│   ├── pcb-guidelines.ts      Topology-aware PCB layout guidelines
│   ├── cap-lifetime.ts        Arrhenius electrolytic lifetime model
│   ├── feedback.ts            Feedback resistor divider (E96/E24)
│   ├── soft-start.ts          Soft-start cap + inrush estimation
│   ├── inductor-saturation.ts Isat margin and flux density check
│   ├── sequencing.ts          Multi-rail power sequencing analyzer
│   ├── component-search.ts    Provider abstraction (local + Digi-Key)
│   └── topologies/            One file per topology
├── store/                 Zustand — single source of truth
│   └── design-store.ts
└── components/            React presentation layer

electron/
├── main.ts                App entry; registers all IPC handlers
├── preload.ts             Context bridge (projectAPI, exportAPI, digikeyAPI, pluginAPI)
├── file-handlers.ts       Project open/save/recent IPC
├── export-handlers.ts     PDF + CSV save dialogs
├── ltspice-bridge.ts      LTspice child_process integration
├── digikey-bridge.ts      Digi-Key OAuth2, rate limit, cache, search IPC
└── plugin-ipc.ts          Plugin filesystem IPC (list, open-folder)
```

Heavy computation runs in a dedicated Web Worker — the renderer thread is never
blocked. Components never import `engine/` directly; they dispatch store actions
which forward messages to the worker. Pure helpers (`computeGateDrive`,
`designFeedback`, `generateLayoutGuidelines`, etc.) are called directly from
components without going through the worker.

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
npm test             # Single run (277 tests)
npm run test:watch   # Watch mode
npm run type-check   # TypeScript strict check
```

### Production Build

```bash
# Windows installer (.exe / NSIS)
npm run dist:win

# macOS disk image (.dmg)
npm run dist:mac

# Linux AppImage
npm run dist:linux

# All platforms
npm run dist
```

Distributable files are written to `dist/`.

> **First-time build:** regenerate the icons if `resources/icon.png` is missing:
> ```bash
> npm run make:icons
> ```

---

## License

MIT

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
