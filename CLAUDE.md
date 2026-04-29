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
| `buck-boost`| `topologies/buckBoost.ts`     | stub |
| `flyback`   | `topologies/flyback.ts`       | stub |
| `forward`   | `topologies/forward.ts`       | stub |
| `sepic`     | `topologies/sepic.ts`         | stub |

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
