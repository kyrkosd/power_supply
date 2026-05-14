// Per-iteration component-value sampler — wraps the tolerance models behind a single record.

import {
  ToleranceModel,
  InductorTolerance,
  InductorDCRTolerance,
  CeramicCapTolerance,
  ElectrolyticCapTolerance,
  MosfetRdsOnTolerance,
  DiodeVfTolerance,
  InductorIsatTolerance,
} from '../tolerances'

// Fallback nominal parasitic values when the topology result doesn't carry them.
export const NOMINAL_DCR    = 0.050  // Ω
export const NOMINAL_RDS_ON = 0.100  // Ω
export const NOMINAL_VF     = 0.500  // V
export const NOMINAL_ESR    = 0.050  // Ω

export interface ToleranceOverrides {
  inductance?:  ToleranceModel
  dcr?:         ToleranceModel
  capacitance?: ToleranceModel
  esr?:         ToleranceModel
  rdsOn?:       ToleranceModel
  vf?:          ToleranceModel
  isat?:        ToleranceModel
}

export type ResolvedTolerances = Required<ToleranceOverrides>

export function resolveTolerances(overrides?: ToleranceOverrides): ResolvedTolerances {
  const t = overrides ?? {}
  return {
    inductance:  t.inductance  ?? InductorTolerance,
    dcr:         t.dcr         ?? InductorDCRTolerance,
    capacitance: t.capacitance ?? CeramicCapTolerance,
    esr:         t.esr         ?? ElectrolyticCapTolerance,
    rdsOn:       t.rdsOn       ?? MosfetRdsOnTolerance,
    vf:          t.vf          ?? DiodeVfTolerance,
    isat:        t.isat        ?? InductorIsatTolerance,
  }
}

export interface SampledComponents {
  L: number; C: number; DCR: number; RdsOn: number; Vf: number; ESR: number; Isat: number | null
}

export interface Nominals {
  L: number; C: number; ESR: number; Isat: number | null
}

export function sampleComponents(rng: () => number, tols: ResolvedTolerances, nom: Nominals): SampledComponents {
  return {
    L:     tols.inductance.sample(nom.L, rng),
    C:     tols.capacitance.sample(nom.C, rng),
    DCR:   tols.dcr.sample(NOMINAL_DCR, rng),
    RdsOn: tols.rdsOn.sample(NOMINAL_RDS_ON, rng),
    Vf:    tols.vf.sample(NOMINAL_VF, rng),
    ESR:   tols.esr.sample(nom.ESR, rng),
    Isat:  nom.Isat !== null ? tols.isat.sample(nom.Isat, rng) : null,
  }
}
