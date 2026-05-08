import { compute, generateWaveforms, getTopology, getStateSpaceModelFn } from './index'
import { runTransientSimulation } from './transient'
import { runMonteCarlo } from './monte-carlo'
import { designCurrentSense } from './current-sense'
import { estimateEMI } from './emi'
import { designInputFilter } from './input-filter'
import type { InputFilterOptions } from './input-filter'
import { designWinding } from './transformer-winding'
import { getCoreByType } from './topologies/core-selector'
import type { EMIResult } from './topologies/types'
import type { DesignSpec, DesignResult, Topology } from './types'
import type { WaveformSet, TransientResult, TransientMode } from './topologies/types'
import type { TopologyId } from '../store/workbenchStore'
import type { MonteCarloConfig, MonteCarloResult } from './monte-carlo'
import type { TopologyPlugin, PluginMeta, PluginSource } from './plugin-types'
import { validatePlugin } from './plugin-types'

export type SweepParam = 'vin' | 'vout' | 'iout' | 'fsw' | 'ripple_ratio' | 'ambient_temp'

// ── Plugin registry (populated by LOAD_PLUGINS messages) ─────────────────────

const pluginRegistry = new Map<string, TopologyPlugin>()
const disabledPluginIds = new Set<string>()

function evaluatePluginSource(source: string): unknown {
  const mod = { exports: {} as Record<string, unknown> }
  // new Function sandboxes the plugin: no DOM, no worker globals, no imports.
  // The plugin receives only standard JS built-ins through the function scope.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', source)(mod, mod.exports)
  return mod.exports.default ?? mod.exports
}

function resolveTopology(id: string): Topology {
  const plugin = pluginRegistry.get(id)
  if (plugin) {
    return {
      id: plugin.id,
      name: plugin.name,
      compute: (spec) => plugin.compute(spec),
      generateWaveforms: plugin.generateWaveforms ? (spec) => plugin.generateWaveforms!(spec) : undefined,
      getTransferFunction: plugin.getTransferFunction
        ? (spec, result) => plugin.getTransferFunction!(spec, result)
        : undefined,
    }
  }
  return getTopology(id as TopologyId)
}

function computeAny(topologyId: string, spec: DesignSpec): DesignResult {
  const plugin = pluginRegistry.get(topologyId)
  if (plugin) {
    if (disabledPluginIds.has(topologyId)) throw new Error(`Plugin '${topologyId}' is disabled`)
    return plugin.compute(spec)
  }
  return compute(topologyId as TopologyId, spec)
}

function generateWaveformsAny(topologyId: string, spec: DesignSpec): WaveformSet | null {
  const plugin = pluginRegistry.get(topologyId)
  if (plugin) return plugin.generateWaveforms ? plugin.generateWaveforms(spec) : null
  return generateWaveforms(topologyId as TopologyId, spec)
}

// ── Payload interfaces ────────────────────────────────────────────────────────

interface ComputePayload {
  topology: string
  spec: DesignSpec
}

interface SweepPayload {
  topology: string
  baseSpec: DesignSpec
  sweepParam: SweepParam
  min: number
  max: number
  steps: number
}

export interface SweepPoint {
  paramValue: number
  result: DesignResult | null
  phaseMargin: number | null
}

interface MCComputePayload {
  topology: string
  spec: DesignSpec
  mcConfig: MonteCarloConfig
}

interface EfficiencyMapPayload {
  topology: string
  spec: DesignSpec
}

interface TransientPayload {
  topology: string
  spec: DesignSpec
  result: DesignResult
  mode: TransientMode
  softStartSeconds: number
}

interface LoadPluginsPayload {
  sources: PluginSource[]
  disabledIds: string[]
}

type WorkerRequest =
  | { type: 'COMPUTE'; payload: ComputePayload }
  | { type: 'MC_COMPUTE'; payload: MCComputePayload }
  | { type: 'EFFICIENCY_MAP'; payload: EfficiencyMapPayload }
  | { type: 'TRANSIENT_COMPUTE'; payload: TransientPayload }
  | { type: 'SWEEP_COMPUTE'; payload: SweepPayload }
  | { type: 'LOAD_PLUGINS'; payload: LoadPluginsPayload }

type ResultResponse = {
  type: 'RESULT'
  payload: { result: DesignResult; waveforms: WaveformSet | null; timing_ms: number; emiResult: EMIResult | null }
}
type MCResultResponse = {
  type: 'MC_RESULT'
  payload: MonteCarloResult
}
type EfficiencyMapResponse = {
  type: 'EFFICIENCY_MAP_RESULT'
  payload: { matrix: number[][]; vinPoints: number[]; ioutPoints: number[] }
}
type TransientResultResponse = {
  type: 'TRANSIENT_RESULT'
  payload: TransientResult
}
type SweepProgressResponse = { type: 'SWEEP_PROGRESS'; payload: { current: number; total: number } }
type SweepResultResponse = { type: 'SWEEP_RESULT'; payload: { sweepParam: SweepParam; points: SweepPoint[] } }
type ErrorResponse = { type: 'ERROR'; payload: { message: string } }
type PluginsLoadedResponse = { type: 'PLUGINS_LOADED'; payload: { plugins: PluginMeta[] } }

const DEBOUNCE_MS = 8
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let latestPayload: ComputePayload | null = null

function scheduleCompute(payload: ComputePayload): void {
  latestPayload = payload
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    if (!latestPayload) return
    const { topology, spec } = latestPayload
    latestPayload = null
    const start = performance.now()
    try {
      let result = computeAny(topology, spec)
      if (spec.controlMode === 'current') {
        const cs = designCurrentSense(topology as TopologyId, spec, result, spec.senseMethod ?? 'resistor', spec.vsenseTargetMv ?? 150)
        result = { ...result, current_sense: cs }
      }
      // EMI + optional input filter
      const emiResult: EMIResult = estimateEMI(topology as TopologyId, spec, result)
      if (spec.inputFilterEnabled) {
        const filterOpts: InputFilterOptions = {
          enabled: true,
          attenuation_override_db: spec.inputFilterAttenuationDb ?? 0,
          cm_choke_h: (spec.inputFilterCmChokeMh ?? 0) / 1000,
        }
        const inputFilter = designInputFilter(topology as TopologyId, spec, result, emiResult, filterOpts)
        result = { ...result, input_filter: inputFilter }
      }
      // Transformer winding design (flyback and forward only)
      if ((topology === 'flyback' || topology === 'forward') && result.coreType) {
        const core = getCoreByType(result.coreType)
        if (core) {
          const winding = designWinding(topology as TopologyId, spec, result, core)
          result = { ...result, winding_result: winding }
        }
      }
      const waveforms = generateWaveformsAny(topology, spec)
      const timing_ms = performance.now() - start
      const response: ResultResponse = { type: 'RESULT', payload: { result, waveforms, timing_ms, emiResult } }
      if (waveforms) {
        self.postMessage(response, {
          transfer: [
            waveforms.time.buffer as ArrayBuffer,
            waveforms.inductor_current.buffer as ArrayBuffer,
            waveforms.switch_node.buffer as ArrayBuffer,
            waveforms.output_ripple.buffer as ArrayBuffer,
            waveforms.diode_current.buffer as ArrayBuffer,
          ],
        })
      } else {
        self.postMessage(response)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const response: ErrorResponse = { type: 'ERROR', payload: { message: msg } }
      self.postMessage(response)
    }
  }, DEBOUNCE_MS)
}

function linspace(start: number, end: number, n: number): number[] {
  if (n <= 1) return [start]
  return Array.from({ length: n }, (_, i) => start + (end - start) * (i / (n - 1)))
}

function computeEfficiencyMap(payload: EfficiencyMapPayload): EfficiencyMapResponse {
  const { topology, spec } = payload
  const N = 10
  const vinMin = spec.vinMin
  const vinMax = spec.vinMax === spec.vinMin ? spec.vinMin + 1 : spec.vinMax
  const vinPoints = linspace(vinMin, vinMax, N)
  const ioutPoints = linspace(spec.iout * 0.1, spec.iout, N)
  const matrix: number[][] = []

  for (let vi = 0; vi < N; vi++) {
    const row: number[] = []
    for (let ii = 0; ii < N; ii++) {
      try {
        const variantSpec: DesignSpec = {
          ...spec,
          vinMin: vinPoints[vi],
          vinMax: vinPoints[vi],
          iout: ioutPoints[ii],
        }
        const result = compute(topology, variantSpec)
        row.push(result.efficiency ?? spec.efficiency)
      } catch {
        row.push(spec.efficiency)
      }
    }
    matrix.push(row)
  }

  return { type: 'EFFICIENCY_MAP_RESULT', payload: { matrix, vinPoints, ioutPoints } }
}

// ── Sweep helpers ─────────────────────────────────────────────────────────────

function applyParam(spec: DesignSpec, param: SweepParam, value: number): DesignSpec {
  switch (param) {
    case 'vin':          return { ...spec, vinMin: value, vinMax: value }
    case 'vout':         return { ...spec, vout: value }
    case 'iout':         return { ...spec, iout: value }
    case 'fsw':          return { ...spec, fsw: value }
    case 'ripple_ratio': return { ...spec, rippleRatio: value }
    case 'ambient_temp': return { ...spec, ambientTemp: value }
  }
}

function computeSweepPM(
  topo: import('./types').Topology,
  spec: DesignSpec,
  result: DesignResult,
): number | null {
  if (!topo.getTransferFunction) return null
  try {
    const tf = topo.getTransferFunction(spec, result)
    let prevMag = tf.evaluate(100).magnitude_db
    for (let i = 1; i <= 400; i++) {
      const f = 100 * Math.pow(1e4, i / 400) // log sweep 100 Hz → 1 MHz
      const { magnitude_db, phase_deg } = tf.evaluate(f)
      if (prevMag >= 0 && magnitude_db < 0) return phase_deg + 180
      prevMag = magnitude_db
    }
    return null
  } catch {
    return null
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  if (!message?.type) return

  if (message.type === 'COMPUTE') {
    scheduleCompute(message.payload)
    return
  }

  if (message.type === 'LOAD_PLUGINS') {
    const { sources, disabledIds } = message.payload
    pluginRegistry.clear()
    disabledPluginIds.clear()
    disabledIds.forEach(id => disabledPluginIds.add(id))
    const loaded: PluginMeta[] = []
    for (const { filename, source } of sources) {
      try {
        const exported = evaluatePluginSource(source)
        if (!validatePlugin(exported)) {
          loaded.push({ id: filename, name: filename, version: '?', author: '?', description: '', filename, enabled: false, error: 'Missing required fields (id, name, compute)' })
          continue
        }
        pluginRegistry.set(exported.id, exported)
        loaded.push({
          id: exported.id,
          name: exported.name,
          version: exported.version,
          author: exported.author,
          description: exported.description,
          filename,
          enabled: !disabledPluginIds.has(exported.id),
        })
      } catch (err) {
        loaded.push({ id: filename, name: filename, version: '?', author: '?', description: '', filename, enabled: false, error: String(err) })
      }
    }
    const response: PluginsLoadedResponse = { type: 'PLUGINS_LOADED', payload: { plugins: loaded } }
    self.postMessage(response)
    return
  }

  if (message.type === 'MC_COMPUTE') {
    const { topology, spec, mcConfig } = message.payload
    try {
      const nominalResult = computeAny(topology, spec)
      const topologyObj = resolveTopology(topology)
      const mcResult = runMonteCarlo(topologyObj, spec, nominalResult, mcConfig)
      const response: MCResultResponse = { type: 'MC_RESULT', payload: mcResult }
      self.postMessage(response)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const response: ErrorResponse = { type: 'ERROR', payload: { message: msg } }
      self.postMessage(response)
    }
    return
  }

  if (message.type === 'EFFICIENCY_MAP') {
    try {
      const response = computeEfficiencyMap(message.payload as EfficiencyMapPayload)
      self.postMessage(response)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const response: ErrorResponse = { type: 'ERROR', payload: { message: msg } }
      self.postMessage(response)
    }
    return
  }

  if (message.type === 'SWEEP_COMPUTE') {
    const { topology: topoId, baseSpec, sweepParam, min, max, steps } = message.payload
    const topo = resolveTopology(topoId)
    const vals = linspace(min, max, Math.max(2, steps))
    const pts: SweepPoint[] = []
    let i = 0

    function doChunk(): void {
      const end = Math.min(i + 5, vals.length)
      while (i < end) {
        const v = vals[i]
        const varSpec = applyParam(baseSpec, sweepParam, v)
        try {
          const result = computeAny(topoId, varSpec)
          pts.push({ paramValue: v, result, phaseMargin: computeSweepPM(topo, varSpec, result) })
        } catch {
          pts.push({ paramValue: v, result: null, phaseMargin: null })
        }
        i++
      }
      const progress: SweepProgressResponse = { type: 'SWEEP_PROGRESS', payload: { current: i, total: vals.length } }
      self.postMessage(progress)
      if (i < vals.length) {
        setTimeout(doChunk, 0)
      } else {
        const done: SweepResultResponse = { type: 'SWEEP_RESULT', payload: { sweepParam, points: pts } }
        self.postMessage(done)
      }
    }
    doChunk()
    return
  }

  if (message.type === 'TRANSIENT_COMPUTE') {
    const { topology, spec, result, mode, softStartSeconds } = message.payload
    const getModel = getStateSpaceModelFn(topology)
    if (!getModel) {
      const response: ErrorResponse = {
        type: 'ERROR',
        payload: { message: `Topology '${topology}' does not implement getStateSpaceModel — transient unavailable` },
      }
      self.postMessage(response)
      return
    }
    try {
      const transientResult = runTransientSimulation(spec, result, mode, getModel, softStartSeconds)
      const response: TransientResultResponse = { type: 'TRANSIENT_RESULT', payload: transientResult }
      self.postMessage(response, {
        transfer: [
          transientResult.time.buffer as ArrayBuffer,
          transientResult.vout.buffer as ArrayBuffer,
          transientResult.iL.buffer as ArrayBuffer,
          transientResult.duty.buffer as ArrayBuffer,
        ],
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const response: ErrorResponse = { type: 'ERROR', payload: { message: msg } }
      self.postMessage(response)
    }
  }
})
