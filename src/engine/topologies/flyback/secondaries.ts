import type { SecondaryOutput, SecondaryOutputResult } from '../../types'
import {
  computeSecondaryTurns, computeDiodeVr,
  computeSecondaryCapacitance, estimateCrossRegPct,
} from './magnetics'

export function computeSecondaryResults(
  secondaries: SecondaryOutput[],
  primaryTurns: number,
  D: number,
  vinNom: number,
  vinMax: number,
  fsw: number,
): SecondaryOutputResult[] {
  return secondaries.map((s, i) => {
    const ns           = computeSecondaryTurns(primaryTurns, D, vinNom, s.vout, s.diode_vf)
    const diode_vr_max = computeDiodeVr(ns, primaryTurns, vinMax, s.vout)
    const capacitance  = computeSecondaryCapacitance(s.iout, D, fsw, s.vout)
    const crossRegPct  = s.is_regulated ? 0 : estimateCrossRegPct(ns, primaryTurns, vinNom, D, s.vout)
    return { label: `Output ${i + 2}`, vout_nominal: s.vout, ns, diode_vr_max, capacitance, crossRegPct }
  })
}
