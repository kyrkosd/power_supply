// Per-iteration metric calculation: efficiency, ripple, phase margin, Tj, saturation margin.

import type { DesignSpec, DesignResult } from '../types'
import { analyzeBuckControlLoop } from '../control-loop'
import type { SampledComponents } from './sample'

const THETA_JA = 50   // °C/W — conservative SMD MOSFET package thermal resistance
const TJ_MAX   = 125  // °C
const PM_MIN   = 45   // °

export interface IterationMetrics {
  efficiency: number
  outputRipple: number
  phaseMargin: number
  Tj: number
  satMargin: number
  pass: boolean
}

function tryPhaseMargin(spec: DesignSpec, nominal: DesignResult, L: number, C: number, ESR: number): number {
  try {
    const perturbed: DesignResult = { ...nominal, inductance: L, capacitance: C }
    return analyzeBuckControlLoop(spec, perturbed, { esr: ESR }).phaseMarginDeg
  } catch {
    return NaN
  }
}

interface PassFlags {
  efficiencyOk: boolean
  rippleOk:     boolean
  pmOk:         boolean
  thermalOk:    boolean
  satOk:        boolean
}

function evaluatePassFlags(
  efficiency: number, outputRipple: number, Tj: number,
  phaseMargin: number, Isat: number | null, I_peak_i: number,
  doPhaseMargin: boolean, spec: DesignSpec,
): PassFlags {
  return {
    efficiencyOk: efficiency >= spec.efficiency,
    rippleOk:     outputRipple <= spec.voutRippleMax,
    pmOk:         !doPhaseMargin || Number.isNaN(phaseMargin) || phaseMargin >= PM_MIN,
    thermalOk:    Tj <= TJ_MAX,
    satOk:        Isat === null || I_peak_i < Isat,
  }
}

function allFlagsPass(f: PassFlags): boolean {
  return f.efficiencyOk && f.rippleOk && f.pmOk && f.thermalOk && f.satOk
}

export function computeIterationMetrics(
  s: SampledComponents,
  D: number,
  spec: DesignSpec,
  nominalResult: DesignResult,
  doPhaseMargin: boolean,
): IterationMetrics {
  const { L, C, DCR, RdsOn, Vf, ESR, Isat } = s
  const { iout, vout, fsw, ambientTemp } = spec

  // ΔiL = Vout·(1−D) / (L·fsw), conduction-only loss budget.
  const deltaIL = (vout * (1 - D)) / (L * fsw)
  const ILrms2  = iout * iout + (deltaIL * deltaIL) / 12

  const Pcond   = ILrms2 * RdsOn * D
  const Pcopper = ILrms2 * DCR
  const Pdiode  = Math.max(Vf, 0) * iout * (1 - D)
  const Pout    = vout * iout

  const efficiency   = Pout / (Pout + Pcond + Pcopper + Pdiode)
  const outputRipple = deltaIL / (8 * C * fsw) + deltaIL * ESR
  const Tj           = ambientTemp + Pcond * THETA_JA

  const phaseMargin = doPhaseMargin ? tryPhaseMargin(spec, nominalResult, L, C, ESR) : NaN
  const I_peak_i    = iout + deltaIL / 2
  const satMargin   = Isat !== null ? (Isat - I_peak_i) / Isat * 100 : NaN

  const flags = evaluatePassFlags(efficiency, outputRipple, Tj, phaseMargin, Isat, I_peak_i, doPhaseMargin, spec)
  const pass  = allFlagsPass(flags)

  return { efficiency, outputRipple, phaseMargin, Tj, satMargin, pass }
}
