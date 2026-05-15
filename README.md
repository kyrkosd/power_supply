# Power Supply Design Workbench

A desktop engineering tool for designing and analysing switching power supplies.
Built with **Electron + React + TypeScript**, computation runs entirely off the main thread in a dedicated Web Worker.

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
- **Transformer winding calculator** — Dowell skin/proximity model (1966); selects AWG, strand count, fill factor, and layer count; IEC 62368-1 creepage distances (Flyback, Forward)

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

### Multi-Rail & Layout
- **Power sequencing analyzer** — TI SLVA722 sequential chain; auto-orders rails (core → I/O → HV); D3 timing diagram; conflict detection (brown-out warning); load rails from `.pswb` files or enter manually
- **PCB layout guide** — topology-aware: critical loops (CRITICAL/IMPORTANT/RECOMMENDED), IPC-2221 trace widths, component placement order, thermal via counts, keep-out regions
- **Multi-phase buck (2–6 phases)** — per-phase inductor sizing; output ripple cancellation at N × fsw; losses and peak current scaled per-phase
- **Synchronous rectification** — toggle for buck, boost, buck-boost, SEPIC; replaces diode conduction loss with Rds(on) + dead-time + Coss losses; schematic shows sync FET symbol
- **Multi-output flyback** — up to 3 additional secondary windings; per-secondary Ns, diode Vr, Cout, and cross-regulation estimate

### Project & Workflow
- **Project save / load** — full design (topology, parameters, notes, overrides) to `.pswb` JSON (`Ctrl+S` / `Ctrl+O`)
- **Undo / Redo** — 50-step history with 300 ms debounce (`Ctrl+Z` / `Ctrl+Shift+Z`)
- **Design comparison** — save Design A (`Ctrl+K`), compare side-by-side (`Ctrl+Shift+K`); win/lose colour coding across 10 metrics
- **PDF report export** — 6-page A4 PDF: design summary, component table, schematic, waveforms, Bode plot, loss breakdown
- **CSV BOM export** — 9-column RFC 4180 BOM with selected part numbers
- **Design library** — 12 curated reference designs; search by application; loads topology + spec in one click (`Ctrl+L`)
- **Community plugins** — drop a `.js` topology file into the plugins folder; no rebuild required; enable/disable per plugin in Settings; full authoring guide in [PLUGINS.md](PLUGINS.md)
- **URL state share** — one-click clipboard copy of a zlib-compressed URL encoding the current design spec
- **Input validation** — per-topology constraints (buck Vout < Vin, boost Vout > Vin, flyback D < 50 %) with inline error/warning banners
- **Smart topology defaults** — silent default-apply when spec is unmodified; confirmation dialog otherwise
- **Keyboard shortcuts** — `Ctrl+1–4` tabs, `Ctrl+K/Shift+K` comparison, `Ctrl+L` library, `?` help, `Ctrl+Z/Y` undo/redo

---

## How It Works — End-to-End Data Flow

Every parameter change follows a strict unidirectional path to prevent the UI from blocking on computation:

```
1. User moves a slider (InputPanel)
   └─ store.updateSpec({ fsw: 300e3 })           Zustand action

2. Store schedules a worker dispatch
   └─ postMessage({ type: 'COMPUTE', payload })   Web Worker message

3. Web Worker (worker.ts → worker/compute.ts)
   ├─ scheduleCompute() debounces at 8 ms        Drop fast-typed keystrokes
   ├─ computeAny(topology, spec)                 Run selected topology engine
   ├─ estimateEMI(...)                           Fourier-spectrum check (always)
   ├─ designCurrentSense(...) [if PCM]           Current-sense element sizing
   ├─ designInputFilter(...)  [if enabled]       DM/CM filter + Middlebrook check
   └─ designWinding(...)      [flyback/forward]  Dowell AWG selection

4. Worker posts RESULT back to renderer
   └─ store.setResults(result)                   Zustand state update

5. React re-renders only the components that read changed slices
   ├─ SchematicView  — annotated SVG
   ├─ ResultsTable   — duty cycle, L, C, η, …
   ├─ RightPanel     — result cards + warnings
   └─ TabPanel       — active analysis tab
```

**Heavy analyses** (Monte Carlo, transient simulation, efficiency map, parameter sweep) follow the same postMessage path but use separate message types so they never stall a regular COMPUTE.

**Pure helpers** (`computeGateDrive`, `designFeedback`, `generateLayoutGuidelines`, `analyzeSequencing`, `validateSpec`) are called directly from components because they are fast pure functions that don't need debouncing or worker offloading.

---

## Supported Topologies

| Topology    | DC Gain | Isolation | RHPZ | Winding Calc | State-Space |
|-------------|---------|-----------|------|--------------|-------------|
| Buck        | < 1     | No        | No   | —            | ✓           |
| Boost       | > 1     | No        | Yes  | —            | —           |
| Buck-Boost  | any     | No        | Yes  | —            | —           |
| Flyback     | any     | Yes       | Yes  | ✓            | —           |
| Forward     | any     | Yes       | No   | ✓            | —           |
| SEPIC       | any     | No        | Yes  | —            | —           |

RHPZ = right-half-plane zero (requires slower crossover). Only Buck has a state-space model, which enables transient simulation and RK4 startup/load-step/line-step analysis.

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

> **Vite version:** Pinned to `^5.4.0` — electron-vite 2.3.x requires `vite ^4 || ^5`. Do not upgrade Vite to v6 without first upgrading electron-vite.

---

## Architecture

### Three-Layer Rule

```
src/engine/        Pure math — zero GUI imports, zero Zustand, zero DOM
src/store/         Zustand — single source of truth; owns the worker bridge
src/components/    React — reads store slices; triggers store actions only
```

These layers are strictly one-way. **Components never import from `engine/` directly**; they dispatch store actions. The store posts messages to the worker. The worker calls engine functions and posts results back. Components re-render from the returned store state.

```
src/
├── engine/                   Pure computation — zero GUI dependencies
│   ├── types.ts                  DesignSpec / DesignResult / Topology interfaces
│   ├── index.ts                  Topology registry: compute(), getTopology(), getStateSpaceModelFn()
│   ├── worker.ts                 Web Worker entry: thin dispatch loop
│   ├── worker/
│   │   ├── compute.ts            COMPUTE handler — debounce + optional analyses chain
│   │   ├── sweep.ts              SWEEP_COMPUTE — chunked parameter sweep
│   │   ├── efficiency-map.ts     EFFICIENCY_MAP — 10×10 Vin×Iout grid
│   │   ├── handlers.ts           MC_COMPUTE + TRANSIENT_COMPUTE handlers
│   │   ├── plugin-registry.ts    Plugin sandboxing + computeAny() dispatch
│   │   └── types.ts              Worker message type definitions
│   ├── topologies/
│   │   ├── buck.ts               Buck (step-down) — multi-phase + sync rect
│   │   ├── boost.ts              Boost (step-up)
│   │   ├── buckBoost.ts          Buck-Boost (inverting)
│   │   ├── flyback.ts            Flyback — multi-output + RCD clamp
│   │   ├── forward.ts            Forward — RCD clamp + transformer reset
│   │   ├── sepic.ts              SEPIC
│   │   ├── result-utils.ts       Shared: detectCcmDcm, buildDesignResult, calcEfficiency
│   │   └── core-selector.ts      Transformer core database + area-product selector
│   ├── control/
│   │   ├── plant.ts              Buck/boost/CM plant transfer function
│   │   ├── compensator.ts        Type-2 (VM) + single-pole (CM) compensator design
│   │   ├── bode.ts               Frequency sweep: magnitude_db + phase_deg
│   │   ├── slope.ts              Slope-compensation ramp calculation
│   │   └── warnings.ts           Loop stability warning generator
│   ├── mc/
│   │   ├── distribution.ts       Histogram + mean/std/percentile statistics
│   │   ├── sample.ts             Component tolerance sampling (mulberry32 RNG)
│   │   └── iteration.ts          Per-iteration metrics (efficiency, ripple, Tj, PM, Isat)
│   ├── sequencing/
│   │   ├── types.ts              SequencingRail / RailTiming / TimingEvent
│   │   ├── timing.ts             PG-delay estimation + timing chain builder
│   │   └── warnings.ts           Brown-out conflict detection + sequencing warnings
│   ├── current-sense/
│   │   ├── common.ts             Triangular-wave RMS helper, noise floor constant
│   │   ├── resistor.ts           Rsense sizing, SNR check, Kelvin flag, package recommendation
│   │   ├── rdson.ts              Rds(on) accuracy estimation vs. temperature
│   │   └── types.ts              SenseMethod / CurrentSenseResult
│   ├── input-filter/
│   │   ├── dm-stage.ts           DM inductor + capacitor sizing, Z0, resonant frequency
│   │   ├── stability.ts          Middlebrook stability criterion
│   │   ├── cm-stage.ts           CM choke + X/Y capacitor sizing
│   │   ├── components.ts         FilterComponent record builder
│   │   ├── impedance.ts          Filter output + converter input impedance
│   │   └── warnings.ts           Middlebrook failure, resonance overlap, CM warnings
│   ├── winding/
│   │   ├── awg.ts                NEMA MW1000 AWG table + skin-depth wire selector
│   │   ├── physics.ts            Skin depth, Dowell proximity factor, fill ratio
│   │   ├── currents.ts           Winding RMS current calculation
│   │   ├── sections.ts           WindingSection builder — primary + secondaries
│   │   ├── insulation.ts         IEC 62368-1 creepage/clearance calculation
│   │   └── warnings.ts           Fill, proximity factor, leakage, copper loss warnings
│   ├── soft-start/
│   │   ├── tss.ts                Soft-start capacitor sizing (AND9135)
│   │   ├── inrush.ts             Peak inrush with and without soft-start
│   │   └── warnings.ts           Monotonic-startup and pre-bias-safe flags
│   ├── validation/
│   │   ├── types.ts              ValidationResult / ValidationError
│   │   └── voltages.ts           Per-topology voltage-constraint checks
│   ├── pcb/
│   │   ├── loops.ts              Critical current-loop descriptions
│   │   ├── trace-width.ts        IPC-2221 external-layer trace widths
│   │   ├── thermal-vias.ts       Via count + diameter for hot components
│   │   ├── placement.ts          Numbered component placement steps
│   │   └── keep-outs.ts          High-impedance region exclusion rules
│   ├── equation-metadata/
│   │   ├── types.ts              EquationEntry / EquationVar interfaces
│   │   ├── inductance.ts         Inductance equation with live-slider variables
│   │   ├── capacitance.ts        Capacitance equation
│   │   ├── duty-cycle.ts         Duty-cycle equation
│   │   └── efficiency.ts         Efficiency equation
│   ├── control-loop.ts           Top-level Bode analysis: plant × compensator
│   ├── monte-carlo.ts            MC orchestrator: sample → compute → aggregate
│   ├── current-sense.ts          Current-sense facade: method dispatch
│   ├── input-filter.ts           Input-filter facade: DM + CM + Middlebrook
│   ├── transformer-winding.ts    Winding facade: Dowell + AWG + fill + creepage
│   ├── emi.ts                    Fourier spectrum + CISPR 32 limit comparison
│   ├── dc-bias.ts                MLCC DC-bias derating from empirical curves
│   ├── transient.ts              RK4 orchestrator: init → solve → metrics
│   ├── gate-drive.ts             Gate drive resistor + bootstrap cap sizing
│   ├── snubber.ts                RCD clamp design (flyback, forward)
│   ├── feedback.ts               Feedback resistor divider (E96/E24 series)
│   ├── cap-lifetime.ts           Arrhenius electrolytic lifetime estimator
│   ├── soft-start.ts             Soft-start facade: Css + inrush + flags
│   ├── inductor-saturation.ts    Isat margin + estimated peak flux density
│   ├── sequencing.ts             Power-sequencing facade: chain + warnings
│   ├── pcb-guidelines.ts         Topology-aware PCB guideline generator
│   ├── validation.ts             Per-topology spec validation facade
│   ├── share.ts                  URL state encode/decode (zlib + Base64)
│   ├── equation-metadata.ts      EQUATION_CATALOG registry + findEquation()
│   ├── component-search.ts       Provider abstraction: local database + Digi-Key
│   └── plugin-types.ts           TopologyPlugin interface + validatePlugin()
├── store/
│   └── design-store.ts           Zustand store: all UI state + worker bridge
└── components/                   React presentation layer

electron/
├── main.ts                       App entry; registers all IPC handlers
├── preload.ts                    Context bridge (projectAPI, exportAPI, digikeyAPI, pluginAPI)
├── file-handlers.ts              Project open/save/recent IPC
├── export-handlers.ts            PDF + CSV save dialogs
├── ltspice-bridge.ts             LTspice child_process integration
├── digikey-bridge.ts             Digi-Key OAuth2, rate limit, cache, search IPC
└── plugin-ipc.ts                 Plugin filesystem IPC (list, open-folder)
```

### Worker Message Protocol

The renderer and Web Worker communicate exclusively via typed messages. The store (`design-store.ts`) is the only sender on the renderer side. The worker (`worker.ts`) is the only receiver.

| Message type (renderer → worker) | Payload | Response |
|-----------------------------------|---------|----------|
| `COMPUTE` | `{ topology, spec }` | `RESULT { result, waveforms, timing_ms, emiResult }` |
| `MC_COMPUTE` | `{ topology, spec, mcConfig }` | `MC_RESULT { monteCarloResult }` |
| `TRANSIENT_COMPUTE` | `{ topology, spec, result, mode, softStartSeconds }` | `TRANSIENT_RESULT { time, vout, iL, duty, metrics }` |
| `EFFICIENCY_MAP` | `{ topology, spec, gridSpec }` | `EFFICIENCY_MAP_RESULT { grid }` |
| `SWEEP_COMPUTE` | `{ topology, baseSpec, sweepParam, min, max, steps }` | `SWEEP_PROGRESS` (n times) + `SWEEP_RESULT` |
| `LOAD_PLUGINS` | `{ plugins: PluginSource[] }` | `PLUGINS_LOADED { plugins: PluginMeta[] }` |

Waveform and transient result arrays are transferred (not copied) using `ArrayBuffer` ownership transfer to avoid serialisation overhead on large Float64Array buffers.

### Key Store Slices

`design-store.ts` holds all application state and owns the worker bridge. Key slices:

| Slice | Type | Purpose |
|-------|------|---------|
| `topology` | `TopologyId` | Currently selected topology |
| `spec` | `DesignSpec` | All design parameters (inputs) |
| `result` | `DesignResult \| null` | Latest computed result |
| `isComputing` | `boolean` | True while worker is running |
| `activeVizTab` | `ActiveVizTab` | Which analysis tab is visible |
| `monteCarloResult` | `MonteCarloResult \| null` | Last MC run |
| `transientResult` | `TransientResult \| null` | Last transient simulation |
| `sweepResult` | `SweepResult \| null` | Last parameter sweep |
| `efficiencyMapResult` | `EfficiencyMapResult \| null` | Last efficiency map |
| `comparisonSlot` | `DesignResult \| null` | Design A for side-by-side compare |
| `selectedComponents` | `SelectedComponents` | User-selected inductor/cap/FET |
| `plugins` | `PluginMeta[]` | Loaded community topology plugins |
| `activeEquationId` | `string \| null` | Equation explorer: which equation is open |

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
npm test             # Single run (277 tests across 20 test files)
npm run test:watch   # Watch mode
npm run type-check   # TypeScript strict check (0 errors)
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

## Testing Approach

Tests live in `tests/engine/` and cover the pure engine layer only — no React, no Electron, no Zustand.

**Rules enforced by the test suite:**

- Every formula is validated against a hand-calculated reference value taken from a TI, ST, or Microchip application note. The exact spec (Vin, Vout, Iout, fsw) is pinned in a comment above each test case.
- No mocks — engine functions are pure and are tested with real inputs and real outputs.
- Accuracy threshold: results must be within 0.1 % of the reference (`toBeCloseTo(..., 3)` or a relative tolerance check).

**What is NOT tested in unit tests:**

- React components — covered by visual review and end-to-end behaviour.
- Worker message dispatch — the pure compute functions are tested directly without the worker wrapper.
- Electron IPC — Electron-specific code is not importable by Vitest and is tested manually.

---

## Engine Formula Conventions

All public formulas in `src/engine/` must cite their source:

```ts
// TI SLVA477 eq. 4 — minimum inductance for CCM
const L = (Vout * (1 - D)) / (deltaIL * fsw)
```

Accepted sources: TI / ST / Microchip application notes, Erickson & Maksimovic, Mohan/Undeland/Robbins, Kazimierczuk.

**Unit convention:** All physical quantities are in SI base units internally (V, A, H, F, Hz, Ω, W). Scaling to µH, kHz, mΩ, etc. only happens at the UI boundary (display formatters in `RightPanel`, `ComponentSuggestions`, etc.).

---

## Adding a New Topology

1. Create `src/engine/topologies/myTopology.ts` and implement the `Topology` interface from `src/engine/types.ts`. The only required export is `myTopology: Topology`.
2. Register it in `src/engine/index.ts`: add the ID to `TopologyId` (in `src/store/design-store.ts`) and add an entry to the `registry` record.
3. Add smart defaults in `src/engine/topologies/defaults.ts`.
4. Add input validation in `src/engine/validation/voltages.ts`.
5. Add a schematic generator in `src/components/SchematicView/generators/`.
6. Add at least one test in `tests/engine/` validating the core formula against a published reference.

For community-contributed topologies that don't warrant core changes, use the **plugin system** instead — see [PLUGINS.md](PLUGINS.md).

---

## License

MIT

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
