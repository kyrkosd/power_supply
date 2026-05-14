// EFFICIENCY_MAP handler: 10×10 Vin × Iout grid of efficiency values.

import { compute } from '../index'
import type { DesignSpec } from '../types'
import type { TopologyId } from '../../store/workbenchStore'
import type { EfficiencyMapPayload, EfficiencyMapResponse } from './types'

export function linspace(start: number, end: number, n: number): number[] {
  if (n <= 1) return [start]
  return Array.from({ length: n }, (_, i) => start + (end - start) * (i / (n - 1)))
}

const GRID = 10

function efficiencyAt(topology: TopologyId, spec: DesignSpec, vin: number, iout: number): number {
  try {
    const variant: DesignSpec = { ...spec, vinMin: vin, vinMax: vin, iout }
    return compute(topology, variant).efficiency ?? spec.efficiency
  } catch {
    return spec.efficiency
  }
}

export function computeEfficiencyMap(payload: EfficiencyMapPayload): EfficiencyMapResponse {
  const { topology, spec } = payload
  const topo       = topology as TopologyId
  const vinMax     = spec.vinMax === spec.vinMin ? spec.vinMin + 1 : spec.vinMax
  const vinPoints  = linspace(spec.vinMin,      vinMax,    GRID)
  const ioutPoints = linspace(spec.iout * 0.1,  spec.iout, GRID)
  const matrix     = vinPoints.map(vin => ioutPoints.map(iout => efficiencyAt(topo, spec, vin, iout)))
  return { type: 'EFFICIENCY_MAP_RESULT', payload: { matrix, vinPoints, ioutPoints } }
}
