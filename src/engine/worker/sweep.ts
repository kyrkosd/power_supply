// SWEEP_COMPUTE handler: chunked parameter sweep with optional phase-margin probe.

import type { Topology, DesignSpec, DesignResult } from '../types'
import { computeAny } from './plugin-registry'
import { linspace } from './efficiency-map'
import type {
  SweepParam, SweepPayload, SweepPoint,
  SweepProgressResponse, SweepResultResponse,
} from './types'

const CHUNK_SIZE   = 5
const PM_LOG_STEPS = 400
const PM_F_MIN     = 100
const PM_F_RATIO   = 1e4   // span 100 Hz → 1 MHz

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

/** Sweep gain plot until the magnitude crosses 0 dB and return the phase margin. */
function computeSweepPM(topo: Topology, spec: DesignSpec, result: DesignResult): number | null {
  if (!topo.getTransferFunction) return null
  try {
    const tf = topo.getTransferFunction(spec, result)
    let prevMag = tf.evaluate(PM_F_MIN).magnitude_db
    for (let i = 1; i <= PM_LOG_STEPS; i++) {
      const f = PM_F_MIN * Math.pow(PM_F_RATIO, i / PM_LOG_STEPS)
      const { magnitude_db, phase_deg } = tf.evaluate(f)
      if (prevMag >= 0 && magnitude_db < 0) return phase_deg + 180
      prevMag = magnitude_db
    }
    return null
  } catch {
    return null
  }
}

function sweepOnePoint(topoId: string, topo: Topology, spec: DesignSpec, param: SweepParam, value: number): SweepPoint {
  const varSpec = applyParam(spec, param, value)
  try {
    const result = computeAny(topoId, varSpec)
    return { paramValue: value, result, phaseMargin: computeSweepPM(topo, varSpec, result) }
  } catch {
    return { paramValue: value, result: null, phaseMargin: null }
  }
}

/** Run the sweep in chunks of CHUNK_SIZE points to yield between chunks and keep the worker responsive. */
export function runSweep(payload: SweepPayload, resolveTopology: (id: string) => Topology): void {
  const { topology: topoId, baseSpec, sweepParam, min, max, steps } = payload
  const topo  = resolveTopology(topoId)
  const vals  = linspace(min, max, Math.max(2, steps))
  const pts: SweepPoint[] = []

  const chunk = (startIdx: number): void => {
    const end = Math.min(startIdx + CHUNK_SIZE, vals.length)
    for (let i = startIdx; i < end; i++) pts.push(sweepOnePoint(topoId, topo, baseSpec, sweepParam, vals[i]))

    const progress: SweepProgressResponse = { type: 'SWEEP_PROGRESS', payload: { current: end, total: vals.length } }
    self.postMessage(progress)

    if (end < vals.length) {
      setTimeout(() => chunk(end), 0)
    } else {
      const done: SweepResultResponse = { type: 'SWEEP_RESULT', payload: { sweepParam, points: pts } }
      self.postMessage(done)
    }
  }

  chunk(0)
}
