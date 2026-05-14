// Topology-specific voltage stress (Vds and Vr) with 25 % derating margin applied.

import type { DesignSpec, DesignResult } from '../../engine/types'
import { DERATING } from './types'

export interface StressCalc {
  mosfetVds: number
  diodeVr:   number
}

function flybackStress(vinMax: number, vout: number, result: DesignResult): StressCalc {
  const vdsMin = (result.clampVoltage ?? vinMax * 2) * DERATING
  const vrMin  = (vinMax / (result.turnsRatio ?? 5) + vout) * DERATING
  return { mosfetVds: vdsMin, diodeVr: vrMin }
}

function sepicStress(vinMax: number, vout: number, result: DesignResult): StressCalc {
  return {
    mosfetVds: (result.mosfetVdsMax ?? vinMax + vout) * DERATING,
    diodeVr:   (result.diodeVrMax   ?? vinMax + vout) * DERATING,
  }
}

export function voltageStress(topology: string, spec: DesignSpec, result: DesignResult): StressCalc {
  const { vinMax, vout } = spec
  switch (topology) {
    case 'boost':      return { mosfetVds: vout * DERATING,         diodeVr: vout * DERATING }
    case 'buck-boost': return { mosfetVds: (vinMax + vout) * DERATING, diodeVr: (vinMax + vout) * DERATING }
    case 'sepic':      return sepicStress(vinMax, vout, result)
    case 'flyback':    return flybackStress(vinMax, vout, result)
    case 'forward':    return { mosfetVds: vinMax * 2 * DERATING,   diodeVr: vout * 2 * DERATING }
    default:           return { mosfetVds: vinMax * DERATING,       diodeVr: vinMax * DERATING }
  }
}
