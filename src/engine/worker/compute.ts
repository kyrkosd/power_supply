// COMPUTE handler: applies optional analyses (current sense, EMI, input filter, transformer winding),
// debounces successive requests, and posts the typed-array transfer for waveforms.

import { designCurrentSense } from '../current-sense'
import { estimateEMI } from '../emi'
import { designInputFilter } from '../input-filter'
import type { InputFilterOptions } from '../input-filter'
import { designWinding } from '../transformer-winding'
import { getCoreByType } from '../topologies/core-selector'
import type { DesignSpec, DesignResult } from '../types'
import type { EMIResult, WaveformSet } from '../topologies/types'
import type { TopologyId } from '../../store/workbenchStore'
import { computeAny, generateWaveformsAny } from './plugin-registry'
import type { ComputePayload, ResultResponse } from './types'
import { postError } from './types'

const DEBOUNCE_MS = 8

function applyCurrentSense(topology: string, spec: DesignSpec, r: DesignResult): DesignResult {
  if (spec.controlMode !== 'current') return r
  const cs = designCurrentSense(
    topology as TopologyId, spec, r,
    spec.senseMethod ?? 'resistor',
    spec.vsenseTargetMv ?? 150,
  )
  return { ...r, current_sense: cs }
}

function applyInputFilter(topology: string, spec: DesignSpec, r: DesignResult, emi: EMIResult): DesignResult {
  if (!spec.inputFilterEnabled) return r
  const opts: InputFilterOptions = {
    enabled: true,
    attenuation_override_db: spec.inputFilterAttenuationDb ?? 0,
    cm_choke_h:              (spec.inputFilterCmChokeMh ?? 0) / 1000,
  }
  const inputFilter = designInputFilter(topology as TopologyId, spec, r, emi, opts)
  return { ...r, input_filter: inputFilter }
}

function applyWinding(topology: string, spec: DesignSpec, r: DesignResult): DesignResult {
  if (topology !== 'flyback' && topology !== 'forward') return r
  if (!r.coreType) return r
  const core = getCoreByType(r.coreType)
  if (!core) return r
  return { ...r, winding_result: designWinding(topology as TopologyId, spec, r, core) }
}

/** Run optional post-compute analyses and return the augmented result + EMI estimate. */
function applyOptionalAnalyses(
  topology: string, spec: DesignSpec, result: DesignResult,
): { result: DesignResult; emiResult: EMIResult } {
  let r = applyCurrentSense(topology, spec, result)
  const emiResult = estimateEMI(topology as TopologyId, spec, r)
  r = applyInputFilter(topology, spec, r, emiResult)
  r = applyWinding(topology, spec, r)
  return { result: r, emiResult }
}

/** Post the RESULT message, transferring typed-array buffers when waveforms are present. */
function postComputeResult(
  result: DesignResult, waveforms: WaveformSet | null, timing_ms: number, emiResult: EMIResult,
): void {
  const response: ResultResponse = { type: 'RESULT', payload: { result, waveforms, timing_ms, emiResult } }
  if (!waveforms) { self.postMessage(response); return }
  self.postMessage(response, {
    transfer: [
      waveforms.time.buffer             as ArrayBuffer,
      waveforms.inductor_current.buffer as ArrayBuffer,
      waveforms.switch_node.buffer      as ArrayBuffer,
      waveforms.output_ripple.buffer    as ArrayBuffer,
      waveforms.diode_current.buffer    as ArrayBuffer,
    ],
  })
}

function runCompute(payload: ComputePayload): void {
  const { topology, spec } = payload
  const start = performance.now()
  try {
    const base = computeAny(topology, spec)
    const { result, emiResult } = applyOptionalAnalyses(topology, spec, base)
    const waveforms = generateWaveformsAny(topology, spec)
    postComputeResult(result, waveforms, performance.now() - start, emiResult)
  } catch (err) { postError(err) }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let latestPayload: ComputePayload | null = null

/** Debounced entry point — keep only the most recent payload while the timer is pending. */
export function scheduleCompute(payload: ComputePayload): void {
  latestPayload = payload
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    const p = latestPayload
    latestPayload = null
    if (p) runCompute(p)
  }, DEBOUNCE_MS)
}
