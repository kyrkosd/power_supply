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
| `sepic`     | `topologies/sepic.ts`       | CCM equations implemented |

Each file exports a single `const xxxTopology: Topology` object.
Register it in `src/engine/index.ts`.

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
