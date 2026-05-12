import type { TopologyId } from '../store/workbenchStore'
import type {
  TopologyEngine,
  DesignSpec,
  DesignResult,
  TransferFunction,
  WaveformParams,
  WaveformSet,
  LossBreakdown,
  InductorResult,
  OutputCapResult,
  InputCapResult,
  MosfetResult,
  DiodeResult,
} from './topologies/types'
import { WarningCode } from './topologies/types'

// ── NaN sentinel shapes ───────────────────────────────────────────────────────
// Each constant matches the corresponding result interface with every numeric
// field set to NaN, signalling "not computed" without requiring null checks.

const NAN_LOSSES: LossBreakdown = {
  mosfet_conduction: NaN,
  mosfet_switching:  NaN,
  mosfet_gate:       NaN,
  inductor_copper:   NaN,
  inductor_core:     NaN,
  diode_conduction:  NaN,
  capacitor_esr:     NaN,
  total:             NaN,
  efficiency:        NaN,
}

const NAN_INDUCTOR: InductorResult  = { value: NaN, peak_current: NaN, rms_current: NaN }
const NAN_OUT_CAP:  OutputCapResult = { value: NaN, esr_max: NaN, ripple_current: NaN }
const NAN_IN_CAP:   InputCapResult  = { value: NaN, rms_current: NaN }
const NAN_MOSFET:   MosfetResult    = { rds_on_max: NaN, vds_max: NaN }
const NAN_DIODE:    DiodeResult     = { vr_max: NaN, if_avg: NaN }

// ── Stub engine helpers ───────────────────────────────────────────────────────

/** Full NaN result returned by any topology whose real engine hasn't been registered. */
function notImplementedResult(id: string): DesignResult {
  return {
    duty_cycle:  NaN,
    inductor:    NAN_INDUCTOR,
    output_cap:  NAN_OUT_CAP,
    input_cap:   NAN_IN_CAP,
    mosfet:      NAN_MOSFET,
    diode:       NAN_DIODE,
    losses:      NAN_LOSSES,
    efficiency:  NaN,
    warnings: [{
      code:     WarningCode.NOT_IMPLEMENTED,
      severity: 'warning',
      message:  `Topology "${id}" is not yet implemented. Equations coming soon.`,
    }],
  }
}

/** Transfer-function stub — throws on call since stubs are never exercised for Bode plots. */
function notImplementedTransferFn(): TransferFunction {
  throw new Error('getTransferFunction() not implemented for this topology')
}

/** Zero-filled waveform arrays sized to `params.cycles × params.points_per_cycle`. */
function emptyWaveforms(params: WaveformParams): WaveformSet {
  const cycles         = params.cycles          ?? 3
  const pointsPerCycle = params.points_per_cycle ?? 200
  const n              = cycles * pointsPerCycle
  return {
    time:             new Float64Array(n),
    inductor_current: new Float64Array(n),
    switch_node:      new Float64Array(n),
    output_ripple:    new Float64Array(n),
    diode_current:    new Float64Array(n),
  }
}

/** Build a no-op engine that signals "not implemented" for a given topology id. */
function createStubEngine(id: string, name: string): TopologyEngine {
  return {
    id,
    name,
    compute():                                DesignResult   { return notImplementedResult(id) },
    getTransferFunction():                    TransferFunction { return notImplementedTransferFn() },
    generateWaveforms(p: WaveformParams):     WaveformSet    { return emptyWaveforms(p) },
  }
}

// ── Registry ─────────────────────────────────────────────────────────────────

const _engines  = new Map<TopologyId, TopologyEngine>()
const _realImpl = new Set<TopologyId>()

/** Display names for all supported topology IDs. Add a new entry here before calling register(). */
const TOPOLOGY_NAMES: Record<TopologyId, string> = {
  buck:         'Buck (Step-Down)',
  boost:        'Boost (Step-Up)',
  'buck-boost': 'Buck-Boost',
  flyback:      'Flyback',
  forward:      'Forward',
  sepic:        'SEPIC',
}

/** Pre-populate every supported topology as a stub so the UI always has a complete list. */
function initStubs(): void {
  for (const [id, name] of Object.entries(TOPOLOGY_NAMES) as [TopologyId, string][]) {
    _engines.set(id, createStubEngine(id, name))
  }
}
initStubs()

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register a real TopologyEngine, replacing the stub for the same id.
 * Throws if `engine.id` is not listed in `TOPOLOGY_NAMES`.
 * Call at module level in each topology file: `registry.register(buckEngine)`.
 */
export function register(engine: TopologyEngine): void {
  if (!_engines.has(engine.id as TopologyId)) {
    throw new Error(
      `Unknown topology id "${engine.id}". Add it to TOPOLOGY_NAMES in registry.ts first.`
    )
  }
  _engines.set(engine.id as TopologyId, engine)
  _realImpl.add(engine.id as TopologyId)
}

/**
 * Retrieve the engine for `id`. Always returns an engine — unimplemented topologies
 * return a stub that produces NaN results with a NOT_IMPLEMENTED warning.
 */
export function getEngine(id: TopologyId): TopologyEngine {
  const engine = _engines.get(id)
  if (!engine) throw new Error(`Unknown topology id "${id}"`)
  return engine
}

/**
 * Returns true if a real (non-stub) engine has been registered for `id`.
 * Use this to disable simulate buttons or show "coming soon" badges.
 */
export function isImplemented(id: TopologyId): boolean {
  return _realImpl.has(id)
}

/** All registered engines, in insertion order (alphabetical by id). */
export function getAll(): ReadonlyMap<TopologyId, TopologyEngine> {
  return _engines
}

export type { TopologyEngine, DesignSpec, DesignResult, TransferFunction, WaveformSet }
