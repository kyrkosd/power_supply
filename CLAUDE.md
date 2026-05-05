<!-- INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability. -->
<!-- INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability. -->
# Power Supply Design Workbench

Desktop app for electrical engineers designing switching power supplies.
Electron + React + TypeScript, built with electron-vite.

---

## Architecture — three strict layers

```
src/engine/        Computation — pure math, zero GUI dependencies
src/store/         State — Zustand, single source of truth
src/components/    Presentation — React, reads store, triggers actions
```

These layers are one-way. Components never import from `engine/` directly;
they dispatch store actions. The store owns the worker bridge.

### Data flow

```
Slider change
  → Zustand action (setInput)
    → postMessage to Web Worker (src/engine/worker.ts)
      → topology.compute(spec) runs off the main thread
        → worker postMessage result back
          → store.setResults(result)
            → React re-render
```

Heavy computation always runs in the worker to keep UI at 60 fps.
Never call topology `compute()` directly from a component or store action;
always go through the worker.

### Advanced Analysis Integrations
- **Monte Carlo**: `src/engine/monte-carlo.ts` leverages the existing topology `compute()` engines to run randomized parameter sweeps. Results are stored in Zustand and rendered via D3.
- **DC Bias Derating**: `src/engine/dc-bias.ts` hooks into the component sizing phase of the topology calculations, utilizing `src/data/dc-bias-curves.json` to calculate `effective_value`.
- **LTspice Bridge**: `electron/ltspice-bridge.ts` executes LTspice natively via Electron's `child_process`. `src/engine/ltspice/` contains the netlist generators and `.raw`/`.log` parsers which integrate with `ComparisonView` to overlay data.
- **Startup/Transient Simulation**: `src/engine/transient.ts` uses an RK4 state-space solver. Integrates by requiring Topologies to optionally implement `getStateSpaceModel()` returning A/B matrices.
- **EMI Pre-Compliance**: `src/engine/emi.ts` takes the steady-state `DesignResult` and spec, computes the Fourier spectrum, and evaluates against limits from `src/data/emi-limits.json`.

---

## Engine layer rules

- **Zero GUI imports.** No React, no Zustand, no DOM APIs in `src/engine/`.
- Every topology implements the `Topology` interface in `src/engine/types.ts`.
- Every public formula must have a comment citing its source:
  ```ts
  // TI SLVA477 eq. 4 — minimum inductance for CCM
  const L = (Vout * (1 - D)) / (deltaIL * fsw)
  ```
  Acceptable sources: TI/ST/Microchip application notes, Erickson & Maksimovic,
  Mohan/Undeland/Robbins, Kazimierczuk.
- Physical quantities are always in SI base units internally (V, A, H, F, Hz, Ω, W).
  Scale only at the UI boundary (display µH, kHz, etc.).

---

## Topologies

| ID          | File                          | Status |
|-------------|-------------------------------|--------|
| `buck`      | `topologies/buck.ts`          | CCM equations implemented |
| `boost`     | `topologies/boost.ts`         | CCM equations implemented |
| `buck-boost`| `topologies/buckBoost.ts`     | CCM equations implemented |
| `flyback`   | `topologies/flyback.ts`       | CCM equations implemented |
| `forward`   | `topologies/forward.ts`       | CCM equations implemented |
| `sepic`     | `topologies/sepic.ts`         | CCM equations implemented |

Each file exports a single `const xxxTopology: Topology` object.
Register it in `src/engine/index.ts`.

**Flyback extras:** `DesignSpec.secondary_outputs?: SecondaryOutput[]` enables
multi-output mode (max 3 additional secondaries). The engine scales core sizing
to total `Ptotal`, computes per-secondary `Ns_k`, diode Vr, Cout, and a
cross-regulation estimate (±% under ±50 % primary load swing). Results are
returned in `DesignResult.secondaryOutputResults`.

---

## Recent Features

### Design Comparison (`src/components/ComparisonView/`)
Save any computed design as **Design A** (`Ctrl+K`), then change parameters or
topology and open the side-by-side modal (`Ctrl+Shift+K`). The modal shows 10
comparison rows with win/lose colour coding and a winner badge.
Store keys: `comparisonSlot`, `isComparing`, `saveToComparison`, `setIsComparing`.

### Efficiency Heatmap (`src/components/EfficiencyMap/`)
A 10×10 Vin × Iout grid computed in the Web Worker (`EFFICIENCY_MAP` message).
Rendered with D3 as SVG rectangles with a dark-red → bright-green colour scale,
a crosshair at the current operating point, and hover tooltips.
Worker flow: `requestEfficiencyMap()` → store sets `efficiencyMapRequest` →
`App.tsx` posts `EFFICIENCY_MAP` message → worker calls `computeEfficiencyMap`
→ `setEfficiencyMapResult`.

### Input Validation (`src/engine/validation.ts`)
`validateSpec(topology, spec): ValidationResult` enforces positivity, topology-
specific voltage constraints (buck step-down, boost step-up, flyback D < 50 %,
etc.), fsw range, ripple ratio bounds, and output ripple budget.
`error` severity blocks worker dispatch; `warning` shows inline but allows
computation. Called directly in components — **not** through the worker.

### Smart Topology Defaults (`src/engine/topologies/defaults.ts`)
Canonical `TOPOLOGY_DEFAULTS` record keyed by `TopologyId`. On topology switch:
if the current spec equals the old defaults, silently apply the new ones;
otherwise show a confirmation banner ("Apply Defaults" / "Keep Current").
`setTopology` resets spec; `setTopologyOnly` keeps it.

### Gate Drive Calculator (`src/engine/gate-drive.ts`)
`computeGateDrive(spec, result, mosfet): GateDriveResult` computes Rg, peak
gate current, turn-on/off times, dead time, gate drive power, bootstrap cap,
and bootstrap diode Vr.
- References: TI SLUA618, Infineon AN_201702_PL52_014, Microchip AN1471, TI SLVA301.
- Bootstrap rows shown only for `buck` and `forward` (high-side switch topologies).
- Called directly from `ComponentSuggestions` (pure function, no worker needed).

### RCD Snubber / Clamp Design (`src/engine/snubber.ts`)
`designSnubber(topologyId, spec, result, leakage_ratio): SnubberResult` sizes an
RCD clamping network for flyback and forward converters.
- Energy model: `Llk = ratio × Lm`, `E_lk = 0.5 × Llk × Ip²`, `V_clamp = 1.5 × Vin_max`.
- Component values: `R = V_clamp² / (E_lk × fsw)`, `C = 2E_lk / V_clamp²`, `P = E_lk × fsw`.
- References: TI SLUA107 (flyback), Erickson & Maksimovic §6.2.2 (forward).
- `DesignSpec.leakageRatio?: number` (default 0.02 = 2 %) — editable via an Advanced slider
  in InputPanel (flyback and forward only, range 0.5–10 %).
- `DesignResult.snubber?: SnubberResult` carries the result into the schematic and PDF.
- Clamp power dissipation replaces the previous fixed-placeholder `clampLoss` in both
  flyback.ts and forward.ts; a warning fires if P > 5 % of Pout.
- Schematic annotates R, C, and diode reverse-voltage values on the RCD clamp symbol.

### PCB Layout Guide (`src/components/LayoutGuide/`, `src/engine/pcb-guidelines.ts`)
`generateLayoutGuidelines(topology, spec, result): LayoutGuidelines` produces:
- `critical_loops[]` — current loops ranked CRITICAL/IMPORTANT/RECOMMENDED with
  component lists and routing guidance.
- `trace_widths[]` — IPC-2221 external-layer widths for every power net (1 oz and 2 oz).
- `placement_order[]` — numbered steps; each step constrains the next.
- `thermal_vias[]` — via count and diameter for hot components.
- `keep_outs[]` — regions where high-impedance or sensitive signals must be excluded.
- `general_tips[]` — topology-specific routing reminders.
`LayoutGuide` component renders the above in a scrollable panel (tab 5) and the data
is also captured in the PDF report export.

---

## Testing

- Framework: Vitest. Tests live in `tests/engine/`.
- **Every formula must be tested against a hand-calculated reference value**
  taken from a TI, ST, or Microchip application note. Pin the exact spec
  used (Vin, Vout, Iout, fsw) in a comment above the test.
- No mocks in engine tests — pure function inputs and outputs only.
- Accuracy threshold: results must be within 0.1% of the reference value
  (`toBeCloseTo(..., 3)` or a relative tolerance check).
- Run tests: `npm test` (single run) · `npm run test:watch` (watch mode).

---

## Key commands

```bash
npm run dev          # Electron + Vite HMR dev server
npm run build        # Production build → out/
npm test             # Vitest unit tests
npm run type-check   # tsc --noEmit across all sources
```

---

## Dependency notes

- Vite is pinned to `^5.4.0` — electron-vite 2.3.x requires `vite ^4 || ^5`.
  Do not upgrade Vite to v6 without upgrading electron-vite first.
- D3 is imported per-module (`import { scaleLinear } from 'd3-scale'`) to keep
  the renderer bundle lean. Never `import * as d3 from 'd3'`.
- mathjs is used in the engine layer only, never in components.

---

## In-App Help System

The application includes comprehensive in-app documentation tailored for electrical engineers.

### HelpPanel Component
**File:** `src/components/HelpPanel/HelpPanel.tsx`

A collapsible help panel accessed via the `?` button in the top-right toolbar. Contains five tabs:

1. **Quick Start**: Step-by-step workflow, unit conventions, and UI layout guide.
2. **How to Read Results**: Interpretation of component values, duty cycle, efficiency, and warnings.
3. **Interpreting Charts**: Detailed guides for waveforms, Bode plot, loss breakdown, thermal analysis, and optional tabs (Monte Carlo, Transient, EMI, LTspice).
4. **Topology Guide**: Decision tree for topology selection, detailed pros/cons per topology, and common pitfalls.
5. **Keyboard Shortcuts**: Quick reference for Ctrl+1–4, Escape, and "?" key.

**Keyboard interaction:**
- `?` key toggles the help panel
- `Escape` closes the panel
- Panel also closes on outside click

### FirstRunWelcome Overlay
**File:** `src/components/FirstRunWelcome/FirstRunWelcome.tsx`

A modal shown on first app launch (checked via `localStorage.psd-welcome-seen`). Includes:
- Welcome message with app icon
- 4 numbered callouts pointing to key UI regions (topology selector, input panel, schematic, visualization tabs)
- Quick tips on keyboard shortcuts and help access
- "Don't show again" checkbox
- Dismissible with "Got it" button

### StatusBar Component
**File:** `src/components/StatusBar/StatusBar.tsx`

Thin footer bar showing:
- Current topology name
- Key results summary: D (duty cycle %), L (µH), C (µF), η (efficiency %)
- Warning badge with count (click-able for future expansion)

### Tooltip Component
**File:** `src/components/Tooltip/Tooltip.tsx`

Reusable tooltip UI component. Props:
- `content`: React node (HTML allowed; can include formulas, strong text, etc.)
- `side`: 'top' | 'bottom' | 'left' | 'right' (default: 'top')
- `delay`: milliseconds before showing (default: 200ms)

**Usage:**
```jsx
<Tooltip content="Your help text here" side="right">
  <span className={styles.infoIcon}>ⓘ</span>
</Tooltip>
```

### Input Slider Tooltips
Each input field in `InputPanel` has an info icon (ⓘ) that explains:
- What the parameter controls
- Typical range for common designs
- Effect of increasing/decreasing the value

Example tooltip for `fsw` (switching frequency):
> "Switching frequency. Higher = smaller L/C but higher switching losses & EMI. Typical: 100kHz–2MHz."

### Result Value Tooltips
Computed results in `ComponentSuggestions` include tooltips showing:
- The calculated formula (e.g., `L = ΔIL / (fsw × Iout)`)
- The substituted values in the formula
- Interpretation guidance

Example for inductance:
```
Inductance
Calculated value: 6.50 µH
L = ΔIL / (fsw × Iout)
Larger L = smoother current, smaller ripple
```

### Tooltip Styling Conventions
- **Font:** 11px, monospace for formulas/code
- **Color scheme:** Matches the app's dark theme (var(--accent) for emphasized text)
- **Animation:** Fade-in with 150ms ease-in
- **Max width:** 280px with text wrapping

---

## Documentation Best Practices

When adding new features or analysis modes:

1. **Add help content to HelpPanel** if it's a major feature (e.g., a new analysis tab).
2. **Add input tooltips** for any new parameters in InputPanel.
3. **Add result tooltips** for any new computed values shown in the UI.
4. **Cite sources:** Every formula reference should link back to a textbook or app note (include in tooltip or help text).
5. **Use plain language:** Assume the user knows power electronics but may be unfamiliar with this specific tool.
