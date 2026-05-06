# Changelog

All notable changes to Power Supply Design Workbench are documented here.

---

## v3.0.0

### New Features

#### Component Design
- **Electrolytic capacitor lifetime estimator** — Arrhenius model (IEC 61709 §6) with ripple-current self-heating (ΔT from Irms vs rated) and voltage stress derating; shown per-capacitor in the Components panel; ceramics display "N/A".
- **Feedback resistor divider calculator** — sizes R_top / R_bottom using E96 or E24 standard values with Vout error, divider current, and power dissipation (TI SLVA477B eq. 3); isolated topologies (flyback, forward) show a note in place of computed values.
- **Soft-start calculator** — computes Css, recommended tss, peak inrush with and without soft-start, monotonic-startup flag, and pre-bias-safe flag (ON Semiconductor AND9135); links directly to the Transient tab for startup simulation.
- **Inductor saturation margin check** — compares peak inductor current to the selected inductor's Isat rating; colour-coded red (< 10 % headroom or saturated), amber (< 30 %), green (safe); estimates peak flux density against material Bsat.

#### Multi-Rail
- **Power sequencing analyzer** — implements TI SLVA722 sequential-chain timing; auto-orders rails (core ≤ 1.8 V → I/O ≤ 3.3 V → high-voltage > 3.3 V) then by Vout within each group; `estimatePgDelay()` uses transient settling time when available, else `50/fsw` (TI SLVA236A eq. 4); D3 timing diagram shows enable/PG events per rail; conflict detection warns on brown-out (dependent rail enables before its input supply reaches PG), simultaneous start, or total boot time > 100 ms; rails can be loaded from saved `.pswb` files or entered manually; ↑/↓ drag-to-reorder. Toolbar button: ⏱ Sequencing.

#### Component Search
- **Optional Digi-Key API integration** — provider abstraction (`ComponentSearchProvider`) with `LocalDatabaseProvider` (existing curated database) and `DigiKeyProvider` (live search). Main-process bridge (`electron/digikey-bridge.ts`) implements OAuth2 client credentials, `safeStorage` credential encryption, 1-hour result cache, and 5 req/min token-bucket rate limiter. Settings modal (⚙) stores Client ID + Client Secret; Test Connection verifies token exchange; secret is never returned to the renderer. Each component section shows a collapsible "Search Digi-Key" panel with price, stock, electrical parameters, and "View on Digi-Key ↗" links. Graceful offline fallback with indicator badge.

#### Transient Simulation (Wiring)
- **Transient tab fully wired end-to-end** — `TransientTab` component dispatches `TRANSIENT_COMPUTE` messages through the Web Worker; mode selector (Startup / Load Step / Line Step); soft-start time computed from `SoftStartOptions`; two D3 chart panels (Vout with dashed reference, iL); settling time, overshoot, and peak-inrush metrics row. Unsupported topologies show a descriptive message (Buck only currently has `getStateSpaceModel`).

### Engine
- `src/engine/cap-lifetime.ts` — `estimateLifetime(cap, conditions): CapLifetimeResult`
- `src/engine/feedback.ts` — `designFeedback(vout, options): FeedbackResult`; `fmtResistor()`; `FeedbackOptions`
- `src/engine/soft-start.ts` — `designSoftStart(topology, spec, result, inductor?, options?): SoftStartResult`; `SoftStartOptions`; `DEFAULT_SOFT_START_OPTIONS`
- `src/engine/inductor-saturation.ts` — `checkSaturation(peakCurrent, iout, inductor): SaturationResult`
- `src/engine/sequencing.ts` — `analyzeSequencing()`, `recommendedOrder()`, `estimatePgDelay()`; `SequencingRail`, `SequencingResult`, `RailTiming`, `TimingEvent`
- `src/engine/component-search.ts` — `ComponentSearchProvider`, `LocalDatabaseProvider`, `DigiKeyProvider`, `getProvider()`; `ComponentRequirements`, `ComponentResult`
- `src/engine/index.ts` — added `getStateSpaceModelFn(topologyId)` for worker transient dispatch

### Electron
- `electron/digikey-bridge.ts` — Digi-Key OAuth2 bridge with safeStorage, rate limiter, cache, IPC handlers
- `electron/preload.ts` — `window.digikeyAPI` context-bridge (`setCredentials`, `getCredentials`, `testConnection`, `search`)
- `electron/main.ts` — registers `setupDigiKeyIPC()`

### Components
- `src/components/Settings/` — credential modal with enable toggle and Test Connection
- `src/components/SequencingView/` — sequencing modal with D3 timing diagram
- `src/components/TabPanel/tabs/TransientTab.tsx` — transient simulation UI
- `ComponentSuggestions` — added DigiKeySearchPanel, CapLifetimeRow, SoftStartDisplay, FeedbackNetworkDisplay, saturation margin badge

### Store
- `design-store.ts` — added `transientLoading`, `transientRunRequest`, `isSequencing`, `isSettingsOpen`, `digiKeyEnabled` and corresponding setters

### Documentation
- CLAUDE.md updated with all new engine modules, component files, and electron bridge
- README.md updated with full feature list, Component Search section, and expanded architecture diagram

### Tests
- `tests/engine/sequencing.test.ts` — 12 tests covering chain timing, recommendedOrder, all warning types, and estimatePgDelay (with and without transient result)
- Total test suite: **160 tests**, all passing

---

## v2.0.0

- **DCM detection** — discontinuous conduction mode flag and CCM/DCM boundary current for all non-isolated topologies
- **Project save / load** — full design state to `.pswb` JSON files (`Ctrl+S` / `Ctrl+O`); recent files list
- **Undo / Redo** — 50-step history with 300 ms debounce (`Ctrl+Z` / `Ctrl+Shift+Z`)
- **PDF report export** — 6-page A4 PDF with schematic, waveforms, Bode plot, loss breakdown
- **CSV BOM export** — 9-column RFC 4180 BOM with selected part numbers
- **Buck-Boost topology** — CCM equations fully implemented
- **Forward topology** — CCM equations fully implemented

---

## v1.0.0

Initial release:

- 6 switching topologies: Buck, Boost, Buck-Boost, Flyback, Forward, SEPIC (all CCM)
- Live annotated schematic that redraws as parameters change
- Bode plot with Type-2 compensator and automatic phase-margin targeting
- Loss breakdown: MOSFET conduction/switching, diode, inductor DCR/core, capacitor ESR
- Efficiency curve (η vs Iout)
- Thermal analysis with junction temperature and heatsink guidance
- Component suggestions (curated inductor, capacitor, MOSFET database)
- Monte Carlo tolerance analysis (yield histograms, worst-case margins)
- Ceramic DC bias derating (X5R/X7R empirical curves)
- LTspice bridge (netlist generation, batch run, .raw waveform overlay)
- Startup/transient simulation (RK4 state-space solver)
- EMI pre-compliance (CISPR 32 Class A/B harmonic comparison, filter suggestion)
- Design comparison side-by-side modal (Ctrl+K / Ctrl+Shift+K)
- Efficiency heatmap (10×10 Vin × Iout D3 colour-gradient SVG)
- Input validation with per-topology smart defaults
- Multi-output flyback (up to 3 additional secondaries, cross-regulation estimate)
- Gate drive calculator (Rg, dead time, bootstrap cap, bootstrap diode Vr)
- RCD snubber/clamp design for flyback and forward
- PCB layout guide (critical loops, IPC-2221 trace widths, placement order, thermal vias)
- In-app help panel (5 tabs: Quick Start, Results, Charts, Topology Guide, Shortcuts)
- First-run welcome overlay
- Status bar with live results summary
- Per-topology reset to canonical defaults
- Full keyboard shortcut set (Ctrl+1–4, Ctrl+Z/Y/K, ?)
- Worker-thread computation for 60 fps UI
