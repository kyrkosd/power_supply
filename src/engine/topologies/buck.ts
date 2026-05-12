import { DesignSpec, DesignResult, Topology } from '../types'
import type { WaveformSet } from '../topologies/types'
import { analyzeBuckControlLoop } from '../control-loop'
import { checkSaturation } from '../inductor-saturation'
import { DEVICE_ASSUMPTIONS } from '../device-assumptions'
import { buildDesignResult, detectCcmDcm, calcEfficiency } from './result-utils'
import type { StateSpaceModel } from './types'

const {
  rds_on:      RDS_ON,
  t_rise:      T_RISE,
  t_fall:      T_FALL,
  qg:          QG,
  vf:          VF,
  dcr:         DCR,
  esr:         ESR,
  core_factor: CORE_FACTOR,
  rds_on_sync: RDS_ON_SYNC,
  t_dead:      T_DEAD,
  coss_sync:   COSS_SYNC,
  qg_sync:     QG_SYNC,
  vf_body:     VF_BODY,
} = DEVICE_ASSUMPTIONS

// ── Section helpers ───────────────────────────────────────────────────────────

/**
 * N-phase ripple-cancellation factor K_out.
 * Erickson & Maksimovic §12.3 — N-phase interleaved buck.
 * δ = frac(N×D); K_out = δ(1−δ) / (N×D×(1−D)).
 * K_floor ensures a minimum inductance even at perfect-cancellation duty points.
 */
function rippleCancelFactor(N: number, dutyCycle: number): { K_out: number; K_floor: number } {
  const ND    = N * dutyCycle
  const delta = ND - Math.floor(ND)
  const K_out = (delta < 1e-6 || delta > 1 - 1e-6)
    ? 0
    : Math.min((delta * (1 - delta)) / (N * dutyCycle * (1 - dutyCycle)), 1)
  return { K_out, K_floor: Math.max(K_out, 0.05) }
}

interface BuckPhaseValues {
  L_phase:       number  // H — per-phase inductance
  deltaIL_phase: number  // A — per-phase ripple current
  I_phase_avg:   number  // A — per-phase DC current (Iout/N)
  peak_phase:    number  // A — per-phase peak current
  C_single:      number  // F — single-phase output capacitance
  C_multi:       number  // F — N-phase output capacitance (partially cancels)
  K_out:         number  // — — ripple-cancellation factor
}

/**
 * Per-phase component values for an N-phase interleaved buck.
 * L_phase = L_single × K_floor; Cout_multi = Cout_single / N.
 * At N=1 these collapse to the standard single-phase values.
 */
function computePhaseValues(spec: DesignSpec, dutyCycle: number, N: number): BuckPhaseValues {
  const { vout, iout, fsw, rippleRatio, voutRippleMax } = spec
  const ripple       = Math.max(rippleRatio, 0.05)
  const deltaIL_single = ripple * iout
  const L_single       = (vout * (1 - dutyCycle)) / (deltaIL_single * fsw)
  const rippleVoltage  = Math.max(voutRippleMax, 0.01 * vout)
  const C_single       = deltaIL_single / (8 * fsw * rippleVoltage)

  const { K_out, K_floor } = rippleCancelFactor(N, dutyCycle)
  const L_phase       = L_single * K_floor
  const deltaIL_phase = (vout * (1 - dutyCycle)) / (L_phase * fsw)
  const I_phase_avg   = iout / N
  const peak_phase    = I_phase_avg + deltaIL_phase / 2
  const C_multi       = Math.max(C_single / N, C_single * 0.02)

  return { L_phase, deltaIL_phase, I_phase_avg, peak_phase, C_single, C_multi, K_out }
}

/**
 * Loss breakdown for an N-phase buck converter.
 * All per-phase quantities are scaled by N for total-converter losses.
 * TI SLUA618 eq. 3 for MOSFET switching losses.
 * Erickson & Maksimovic §4.3 for synchronous FET conduction losses.
 */
function computeBuckLosses(
  spec: DesignSpec,
  dutyCycle: number,
  N: number,
  I_phase_avg: number,
  peak_phase: number,
  deltaIL_phase: number,
  K_out: number,
) {
  const { vinMax, iout, fsw } = spec
  const syncMode    = spec.rectification === 'synchronous'
  const I_L_rms     = Math.sqrt(I_phase_avg ** 2 + deltaIL_phase ** 2 / 12)
  const Ic_out_rms  = (K_out * deltaIL_phase) / (2 * Math.sqrt(3))

  // N HS-FETs, each conducting D at I_phase_avg: P = Rds × Iout² × D / N
  const mosfet_conduction = RDS_ON * iout ** 2 * dutyCycle / N
  // TI SLUA618 eq. 3: P_sw = 0.5 × Vin × Ipeak × (tr + tf) × fsw, × N phases
  const mosfet_switching  = N * 0.5 * vinMax * peak_phase * (T_RISE + T_FALL) * fsw
  const mosfet_gate       = N * QG * vinMax * fsw

  const inductor_copper = N * DCR * I_L_rms ** 2
  const inductor_core   = N * CORE_FACTOR * I_phase_avg * deltaIL_phase

  const diode_conduction = syncMode ? 0 : VF * iout * (1 - dutyCycle)

  // Erickson §4.3: P_sync = N × Rds_sync × I_phase_rms² × (1-D)
  const sync_conduction = syncMode
    ? N * RDS_ON_SYNC * I_L_rms ** 2 * (1 - dutyCycle)
    : 0

  // Body-diode dead-time + Coss charge + gate overhead per phase
  const sync_dead_time = syncMode
    ? N * (VF_BODY * I_phase_avg * 2 * T_DEAD * fsw
         + 0.5 * COSS_SYNC * vinMax ** 2 * fsw
         + QG_SYNC * vinMax * fsw)
    : 0

  // Output cap ESR: reduced by N-phase ripple cancellation
  const capacitor_esr = Ic_out_rms ** 2 * ESR

  return {
    mosfet_conduction, mosfet_switching, mosfet_gate,
    inductor_copper,   inductor_core,
    diode_conduction,  sync_conduction,  sync_dead_time,
    capacitor_esr,
  }
}

/** Warnings specific to N > 1 multi-phase designs. */
function multiphaseWarnings(
  N: number,
  K_out: number,
  deltaIL_phase: number,
  I_phase_avg: number,
): string[] {
  const warnings: string[] = []
  const ripple_ratio_phase = deltaIL_phase / I_phase_avg
  if (ripple_ratio_phase > 1.5)
    warnings.push(`Per-phase ripple ratio is ${(ripple_ratio_phase * 100).toFixed(0)} %. Consider increasing fsw or operating nearer a cancellation duty point.`)
  if (N > 4)
    warnings.push(`${N}-phase design: current sharing requires matched inductors (±2 % tolerance) or active balancing.`)
  if (K_out < 0.05)
    warnings.push(`Near-perfect ripple cancellation at this duty cycle (K = ${K_out.toFixed(3)}). Cout is sized at floor — verify at all Vin/Iout corners.`)
  return warnings
}

// ── Topology export ───────────────────────────────────────────────────────────

// Buck (step-down) converter steady-state design equations.
// Assumes CCM (Continuous Conduction Mode) and ideal switch/diode.
export const buckTopology: Topology = {
  id: 'buck',
  name: 'Buck (Step-Down)',

  compute(spec: DesignSpec): DesignResult {
    const { vinMax, vout, iout } = spec
    const N = Math.max(1, Math.min(6, Math.round(spec.phases ?? 1)))

    const dutyCycle = Math.min(Math.max(vout / vinMax, 0.01), 0.99)
    const { L_phase, deltaIL_phase, I_phase_avg, peak_phase, C_single, C_multi, K_out } =
      computePhaseValues(spec, dutyCycle, N)

    const inductance  = L_phase
    const capacitance = N === 1 ? C_single : C_multi
    const peakCurrent = peak_phase

    const ccm_dcm_boundary = deltaIL_phase / 2
    const { operating_mode, warnings } = detectCcmDcm(I_phase_avg, ccm_dcm_boundary)
    if (N > 1) warnings.push(...multiphaseWarnings(N, K_out, deltaIL_phase, I_phase_avg))

    const loop = analyzeBuckControlLoop(spec, { dutyCycle, inductance, capacitance, peakCurrent, warnings: [] })
    const saturation_check = checkSaturation(peakCurrent, I_phase_avg)
    if (saturation_check.warning) warnings.push(saturation_check.warning)

    const lossComps = computeBuckLosses(spec, dutyCycle, N, I_phase_avg, peak_phase, deltaIL_phase, K_out)
    const totalLoss =
      lossComps.mosfet_conduction + lossComps.mosfet_switching + lossComps.mosfet_gate +
      lossComps.inductor_copper   + lossComps.inductor_core    + lossComps.diode_conduction +
      lossComps.sync_conduction   + lossComps.sync_dead_time   + lossComps.capacitor_esr
    const efficiency = calcEfficiency(vout * iout, totalLoss)

    const multiPhaseExtra: Partial<DesignResult> = N > 1 ? {
      phases:               N,
      phase_inductance:     L_phase,
      phase_peak_current:   peak_phase,
      output_ripple_cancel: K_out,
      input_ripple_cancel:  1 / N,
    } : {}

    return buildDesignResult({
      dutyCycle, inductance, capacitance, peakCurrent, efficiency,
      ccm_dcm_boundary, operating_mode, saturation_check,
      losses: lossComps, warnings: [...warnings, ...loop.warnings],
      extra: multiPhaseExtra,
    })
  },

  generateWaveforms(spec: DesignSpec): WaveformSet {
    const { vinMax, vout, iout, fsw, rippleRatio, voutRippleMax } = spec
    const N = Math.max(1, Math.min(6, Math.round(spec.phases ?? 1)))
    const dutyCycle = Math.min(Math.max(vout / vinMax, 0.01), 0.99)

    // Waveforms show a single representative phase — reuse shared helper
    const ripple       = Math.max(rippleRatio, 0.05)
    const deltaIL_single = ripple * iout
    const L_single       = (vout * (1 - dutyCycle)) / (deltaIL_single * fsw)
    const { K_floor } = rippleCancelFactor(N, dutyCycle)
    const L_phase   = L_single * K_floor
    const deltaIL   = (vout * (1 - dutyCycle)) / (L_phase * fsw)
    const iLmin     = iout / N - deltaIL / 2
    const iLmax     = iout / N + deltaIL / 2

    const cycles = 2, pointsPerCycle = 200, n = cycles * pointsPerCycle
    const period = 1 / fsw, dt = period / (pointsPerCycle - 1)
    const capAmplitude = Math.max(voutRippleMax, 0.01 * vout) / 2
    const esrAmplitude = capAmplitude * 0.25

    const time             = new Float64Array(n)
    const inductor_current = new Float64Array(n)
    const switch_node      = new Float64Array(n)
    const output_ripple    = new Float64Array(n)
    const diode_current    = new Float64Array(n)

    for (let idx = 0; idx < n; idx++) {
      const t              = idx * dt
      const phase          = t % period
      const onTime         = dutyCycle * period
      const isOn           = phase < onTime
      const phaseInSection = isOn ? phase / onTime : (phase - onTime) / (period - onTime)

      const iL = isOn
        ? iLmin + (iLmax - iLmin) * phaseInSection
        : iLmax - (iLmax - iLmin) * phaseInSection

      time[idx]             = t
      inductor_current[idx] = iL
      switch_node[idx]      = isOn ? vinMax : 0
      diode_current[idx]    = isOn ? 0 : iL

      const triangular   = ((iL - iout / N) / (deltaIL / 2)) * capAmplitude
      const rectangular  = (isOn ? 1 : -1) * esrAmplitude
      output_ripple[idx] = triangular + rectangular
    }

    return { time, inductor_current, switch_node, output_ripple, diode_current }
  },

  getStateSpaceModel(spec: DesignSpec, result: DesignResult, current_vin: number, current_iout: number): StateSpaceModel {
    const res = result as DesignResult & { inductance?: number; capacitance?: number; inductor?: { value: number }; output_cap?: { value: number } }
    const L      = res.inductance || res.inductor?.value || 10e-6
    const C      = res.capacitance || res.output_cap?.value || 10e-6
    const DCR_val = 0.01
    const Vd     = 0.5
    const R      = current_iout > 0.001 ? spec.vout / current_iout : 10000

    return {
      A1: [[-DCR_val / L, -1 / L], [1 / C, -1 / (C * R)]],
      B1: [[current_vin / L], [0]],
      A2: [[-DCR_val / L, -1 / L], [1 / C, -1 / (C * R)]],
      B2: [[-Vd / L], [0]],
    }
  },
}
