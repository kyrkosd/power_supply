# Changelog

All notable changes to Power Supply Design Workbench are documented here.

---

## v4.0.0

### New Features

#### Current Sensing Design
- **Current sense element sizing** — `src/engine/current-sense.ts`. Supports resistor and Rds(on) methods for peak current-mode control. Computes `Rsense` from peak current and voltage target; checks SNR at 10 % load against a 5 mV noise floor; recommends package (0805/1206/2010/2512/shunt); flags Kelvin-connection requirement when `Rsense < 10 mΩ`; estimates Rds(on) temperature drift at 100 °C; derives minimum slope-compensation ramp to prevent subharmonic oscillation at D > 50 % (Ridley 1991). Activated in the worker when `spec.controlMode === 'current'`.

#### Input Filter Design
- **Two-stage EMI input filter** — `src/engine/input-filter.ts`. Designs differential-mode (L/C) and common-mode (choke + Y-caps) stages from the EMI estimation result. Implements Middlebrook's negative-impedance stability criterion with a damping resistor to prevent filter–converter interaction. X/Y capacitor safety classes per IEC 60384-14. Returns `insertion_loss_db` and `middlebrook_margin_db`. Runs automatically in the worker when `spec.inputFilterEnabled === true`.

#### Transformer Winding Calculator
- **Winding design for flyback and forward** — `src/engine/transformer-winding.ts`. Applies Dowell's eddy-current model (1966) to select the minimum AWG that keeps the conductor within one skin depth; computes the proximity-effect factor Fr and warns when Fr > 1.5; recommends stranding when solid wire diameter exceeds 2δ; checks fill factor per winding and total bobbin fill (< 0.7 guideline); enforces IEC 62368-1:2018 Table F.5 creepage and clearance for reinforced insulation at 250 Vac. Result stored in `DesignResult.winding_result`; rendered in the schematic and PDF report.

#### Multi-Phase Interleaved Buck
- **2–6 interleaved phases** — `DesignSpec.phases` integer field added to the buck topology. Per-phase inductor sized at `L_single × N`; per-phase peak and RMS currents scaled by `1/N`; output ripple frequency multiplies to `N × fsw`; gate-drive power accounts for all N sync FETs. Phase count shown in the results table and reflected in the schematic.

#### Synchronous Rectification
- **Sync FET toggle** — `DesignSpec.rectification: 'diode' | 'synchronous'`. Replaces output-diode conduction loss with Rds(on) conduction + dead-time body-diode + Coss charge losses for buck, boost, buck-boost, and SEPIC. Schematic renders a MOSFET symbol with body diode in place of the output diode when synchronous mode is selected.

#### Interactive Equation Explorer
- **Click-through equation viewer** — `src/engine/equation-metadata.ts` (catalogue) + `src/components/EquationExplorer/` (UI). Clicking any result value opens a modal showing the equation in LaTeX, its source reference, and variable sliders. Changing a slider re-evaluates the formula in real time client-side — no worker round-trip. Store key: `activeEquationId`.

#### Parameter Sweep
- **One-parameter sweep** — `src/components/SweepView/` + worker `SWEEP_COMPUTE` message. Sweeps any of: `vin`, `vout`, `iout`, `fsw`, `ripple_ratio`, `ambient_temp`. Worker processes points in chunks of 5 (yielding via `setTimeout`) to stay responsive. Phase margin computed at each point via a 100 Hz–1 MHz log-sweep. Live progress bar; Recharts line chart; CSV export. Toolbar button: ∿ Sweep.

#### Design Library
- **12 curated reference designs** — `src/data/reference-designs/*.json` + `src/components/DesignLibrary/`. Designs cover: 5V/1A USB charger (buck), 12V LED driver (boost), 3.3V CPU core (buck), Li-ion to 5V USB (boost), 48V→12V telecom (buck), 24V industrial SMPS (forward), 5V/3.3V dual-output flyback, 12V server auxiliary (flyback), 65W USB-C PD adapter (flyback), automotive SEPIC, buck-boost battery manager, and a 4-phase high-current buck. Search by title / application; detail view with design notes and source citations; "Load Design" hot-applies spec + topology. Keyboard shortcut: `Ctrl+L`.

#### Community Plugin System
- **Drop-in topology plugins** — `src/engine/plugin-types.ts` + `electron/plugin-ipc.ts`. Community-authored `.js` files placed in `userData/plugins/` are loaded on startup or on "Reload Plugins". Plugins run sandboxed inside the Web Worker (`new Function` scope — no DOM, no Node, no `import`). Each plugin exports a `TopologyPlugin` object (`id`, `name`, `version`, `compute`, optional `getTransferFunction` / `generateWaveforms` / `getSchematicSVG` / `customInputs`). The topology dropdown gains a **Community Plugins** `<optgroup>`; Settings modal shows a per-plugin enable/disable list with error badges. See `PLUGINS.md` for the authoring guide.

#### URL State Share
- **Compressed URL export** — `src/engine/share.ts` (zlib + Base64) + `src/components/ShareButton.tsx`. One click writes the complete design spec to the clipboard as a URL. Pasting the URL into a browser hydrates the store automatically via `?s=` query parameter.

### Engine
- `src/engine/current-sense.ts` — `designCurrentSense()`, `CurrentSenseResult`, `SenseMethod`
- `src/engine/input-filter.ts` — `designInputFilter()`, `InputFilterResult`, `FilterComponent`, `InputFilterOptions`
- `src/engine/transformer-winding.ts` — `designWinding()`, `WindingResult`, `WindingSection`
- `src/engine/equation-metadata.ts` — `EQUATION_CATALOG`, `EquationEntry`, `EquationVar`
- `src/engine/plugin-types.ts` — `TopologyPlugin`, `PluginMeta`, `PluginSource`, `validatePlugin()`
- `src/engine/share.ts` — `serializeState()`, `deserializeState()`
- `src/engine/topologies/buck.ts` — added `phases` (multi-phase) and `rectification` (sync rect) support
- `src/engine/worker.ts` — added `SWEEP_COMPUTE`, `SWEEP_RESULT`, `SWEEP_PROGRESS`, `LOAD_PLUGINS`, `PLUGINS_LOADED` message types; plugin registry with sandboxed evaluation; `computeAny()` / `resolveTopology()` dispatchers

### Electron
- `electron/plugin-ipc.ts` — `setupPluginIPC()`: `plugin:list` and `plugin:open-folder` IPC handlers
- `electron/preload.ts` — added `window.pluginAPI` context-bridge (`listPlugins`, `openPluginsFolder`)
- `electron/main.ts` — registers `setupPluginIPC()`

### Components
- `src/components/EquationExplorer/` — equation modal with LaTeX rendering and live variable sliders
- `src/components/SweepView/` — sweep parameter selector, range inputs, progress bar, Recharts chart, CSV export
- `src/components/DesignLibrary/` — reference design browser with search, detail view, and load action
- `src/components/ShareButton.tsx` — clipboard URL share button
- `src/components/Settings/` — added Plugins section (per-plugin toggles, Open Folder, Reload Plugins)
- `src/components/Toolbar/` — Community Plugins `<optgroup>` in topology dropdown

### Store
- `design-store.ts` — added `pluginTopologyId`, `plugins`, `disabledPluginIds`, `pluginReloadRequest`, `setPluginTopology`, `setPlugins`, `togglePlugin`, `requestPluginReload`; also `sweepRequest`, `sweepResult`, `sweepLoading`, `sweepProgress` for the sweep feature; `activeEquationId` for the equation explorer

### Documentation
- `PLUGINS.md` — community plugin authoring guide with interface reference, field descriptions, and Ćuk converter skeleton example
- `CLAUDE.md` — updated with all new engine modules, worker message types, and component architecture
- `README.md` — full feature list updated; test count updated (277 tests); architecture diagram updated

### Tests
- Total test suite: **277 tests** across 20 test files, all passing
- Type-check: **0 errors** (`tsc --noEmit`)

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
