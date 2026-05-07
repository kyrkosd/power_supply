import { DesignSpec, DesignResult, Topology } from '../types'
import type { WaveformSet } from '../topologies/types'
import { analyzeBuckControlLoop } from '../control-loop'
import { checkSaturation } from '../inductor-saturation'
import { DEVICE_ASSUMPTIONS } from '../device-assumptions'
import { buildDesignResult, buildLosses } from './result-utils'
import type { StateSpaceModel } from './types'

const {
  rds_on: RDS_ON,
  t_rise: T_RISE,
  t_fall: T_FALL,
  qg: QG,
  vf: VF,
  dcr: DCR,
  esr: ESR,
  core_factor: CORE_FACTOR,
  rds_on_sync: RDS_ON_SYNC,
  t_dead: T_DEAD,
  coss_sync: COSS_SYNC,
  qg_sync: QG_SYNC,
  vf_body: VF_BODY,
} = DEVICE_ASSUMPTIONS

// Buck (step-down) converter steady-state design equations.
// Assumes CCM (Continuous Conduction Mode) and ideal switch/diode.
export const buckTopology: Topology = {
  id: 'buck',
  name: 'Buck (Step-Down)',

  compute(spec: DesignSpec): DesignResult {
    const { vinMax, vout, iout, fsw, rippleRatio, voutRippleMax } = spec
    const N = Math.max(1, Math.min(6, Math.round(spec.phases ?? 1)))

    const dutyCycle = Math.min(Math.max(vout / vinMax, 0.01), 0.99)
    const ripple = Math.max(rippleRatio, 0.05)
    // Single-phase baseline values used by waveform generator and state-space model
    const deltaIL_single = ripple * iout
    const L_single = (vout * (1 - dutyCycle)) / (deltaIL_single * fsw)
    const rippleVoltage = Math.max(voutRippleMax, 0.01 * vout)
    const C_single = deltaIL_single / (8 * fsw * rippleVoltage)

    // ── Multi-phase ripple cancellation ──────────────────────────────────────
    // Erickson & Maksimovic §12.3 — N-phase interleaved buck
    // δ = frac(N×D); K_out = δ(1−δ) / (N×D×(1−D))
    const ND = N * dutyCycle
    const delta = ND - Math.floor(ND)
    let K_out: number
    if (delta < 1e-6 || delta > 1 - 1e-6) {
      K_out = 0.0  // near-perfect cancellation
    } else {
      K_out = (delta * (1 - delta)) / (N * dutyCycle * (1 - dutyCycle))
    }
    K_out = Math.min(K_out, 1.0)

    // Floor K to avoid degenerate (near-zero) inductance at perfect-cancellation duty points
    const K_floor = Math.max(K_out, 0.05)

    // Per-phase inductance: sized so that, after N-phase cancellation, the output
    // ripple equals the single-phase target. L_phase = L_single × K_out (smaller).
    // At N=1 K_out=1 → L_phase = L_single exactly.
    const L_phase = L_single * K_floor
    // Per-phase ripple current: ΔiL_phase = ΔiL_single / K_floor (larger per phase,
    // but cancels at the output). Directly from L_phase formula.
    const deltaIL_phase = (vout * (1 - dutyCycle)) / (L_phase * fsw)

    // Per-phase DC current and peak
    const I_phase_avg = iout / N
    const peak_phase = I_phase_avg + deltaIL_phase / 2

    // Output capacitor: residual ripple appears at N×fsw effective frequency.
    // Cout_multi = Cout_single / N (same ΔVout spec at N× higher ripple frequency).
    const C_multi = Math.max(C_single / N, C_single * 0.02)

    const inductance  = L_phase
    const capacitance = N === 1 ? C_single : C_multi
    const peakCurrent = peak_phase

    // ── CCM/DCM boundary ─────────────────────────────────────────────────────
    const ccm_dcm_boundary = deltaIL_phase / 2
    const warnings: string[] = []
    let operating_mode: 'CCM' | 'DCM' | 'boundary' = 'CCM'

    if (I_phase_avg > 1.2 * ccm_dcm_boundary) {
      operating_mode = 'CCM'
    } else if (I_phase_avg < ccm_dcm_boundary) {
      operating_mode = 'DCM'
      warnings.push('Operating in DCM. Equations assume CCM — results may be inaccurate. Increase inductance or load current to enter CCM.')
    } else {
      operating_mode = 'boundary'
      warnings.push('Near CCM/DCM boundary. Performance may be unpredictable at light loads.')
    }

    // ── Multi-phase warnings ─────────────────────────────────────────────────
    if (N > 1) {
      const ripple_ratio_phase = deltaIL_phase / I_phase_avg
      if (ripple_ratio_phase > 1.5) {
        warnings.push(`Per-phase ripple ratio is ${(ripple_ratio_phase * 100).toFixed(0)} %. Consider increasing fsw or operating nearer a cancellation duty point.`)
      }
      if (N > 4) {
        warnings.push(`${N}-phase design: current sharing requires matched inductors (±2 % tolerance) or active balancing.`)
      }
      if (K_out < 0.05) {
        warnings.push(`Near-perfect ripple cancellation at this duty cycle (K = ${K_out.toFixed(3)}). Cout is sized at floor — verify at all Vin/Iout corners.`)
      }
    }

    const loop = analyzeBuckControlLoop(spec, { dutyCycle, inductance, capacitance, peakCurrent, warnings: [] })
    const saturation_check = checkSaturation(peakCurrent, I_phase_avg)
    if (saturation_check.warning) warnings.push(saturation_check.warning)

    // ── Loss estimation ──────────────────────────────────────────────────────
    // Using DEVICE_ASSUMPTIONS constants (see top of file).
    // For N-phase, per-phase quantities scale by N; totals shown are the whole converter.
    const I_L_rms   = Math.sqrt(I_phase_avg ** 2 + deltaIL_phase ** 2 / 12)
    const Ic_out_rms = (K_out * deltaIL_phase) / (2 * Math.sqrt(3))

    // MOSFET conduction: N HS-FETs each conducting D fraction at I_phase_avg
    // P = N × Rds × I_phase² × D = Rds × Iout² × D / N
    const mosfet_conduction = RDS_ON * iout ** 2 * dutyCycle / N

    // MOSFET switching: N switches, each at I_phase_peak
    // TI SLUA618 eq. 3: P_sw = 0.5 × Vin × Ipeak × (tr + tf) × fsw
    const mosfet_switching = N * 0.5 * vinMax * peak_phase * (T_RISE + T_FALL) * fsw

    // Gate drive: N drivers
    const mosfet_gate = N * QG * vinMax * fsw

    // Inductor copper: N inductors
    const inductor_copper = N * DCR * I_L_rms ** 2

    // Inductor core: simplified Steinmetz per phase
    const inductor_core = N * CORE_FACTOR * I_phase_avg * deltaIL_phase

    const syncMode = spec.rectification === 'synchronous'

    // Freewheeling diode / sync-rect: total current same regardless of N
    // In sync mode the diode is replaced by a low-side MOSFET — no Vf drop.
    const diode_conduction = syncMode ? 0 : VF * iout * (1 - dutyCycle)

    // Synchronous FET losses (zero in diode mode):
    // Conduction: N sync FETs each carrying I_phase during (1-D)
    // P_sync = N × Rds_sync × I_phase_rms² × (1-D) — Erickson §4.3
    const sync_conduction = syncMode
      ? N * RDS_ON_SYNC * (I_L_rms ** 2) * (1 - dutyCycle)
      : 0

    // Overhead: body diode dead-time (2 transitions) + Coss + Q2 gate drive
    // P_dead = N × VF_body × I_phase_avg × 2 × t_dead × fsw
    // P_coss = N × 0.5 × Coss × Vin² × fsw
    // P_gate = N × Qg_sync × Vin × fsw
    const sync_dead_time = syncMode
      ? N * (VF_BODY * I_phase_avg * 2 * T_DEAD * fsw
           + 0.5 * COSS_SYNC * vinMax ** 2 * fsw
           + QG_SYNC * vinMax * fsw)
      : 0

    // Output capacitor ESR loss (reduced by N-phase cancellation)
    const capacitor_esr = Ic_out_rms ** 2 * ESR

    const pout = vout * iout
    const totalLoss = mosfet_conduction + mosfet_switching + mosfet_gate +
                      inductor_copper + inductor_core + diode_conduction +
                      sync_conduction + sync_dead_time + capacitor_esr
    const efficiency = pout <= 0 ? 0 : pout / (pout + totalLoss)

    const multiPhaseFields: Partial<DesignResult> = N > 1 ? {
      phases:             N,
      phase_inductance:   L_phase,
      phase_peak_current: peak_phase,
      output_ripple_cancel: K_out,
      input_ripple_cancel:  1 / N,
    } : {}

    return buildDesignResult({
      dutyCycle,
      inductance,
      capacitance,
      peakCurrent,
      efficiency,
      ccm_dcm_boundary,
      operating_mode,
      saturation_check,
      losses: buildLosses(
        mosfet_conduction,
        mosfet_switching,
        mosfet_gate,
        inductor_copper,
        inductor_core,
        diode_conduction,
        sync_conduction,
        sync_dead_time,
        capacitor_esr,
      ),
      warnings: [...warnings, ...loop.warnings],
      extra: multiPhaseFields,
    })
  },

  generateWaveforms(spec: DesignSpec): WaveformSet {
    const { vinMax, vout, iout, fsw, rippleRatio, voutRippleMax } = spec
    // Waveforms show a single representative phase
    const dutyCycle = Math.min(Math.max(vout / vinMax, 0.01), 0.99)
    const N = Math.max(1, Math.min(6, Math.round(spec.phases ?? 1)))
    const ripple = Math.max(rippleRatio, 0.05)
    const deltaIL_single = ripple * iout
    const L_single = (vout * (1 - dutyCycle)) / (deltaIL_single * fsw)
    const ND = N * dutyCycle
    const delta = ND - Math.floor(ND)
    let K_out = (delta < 1e-6 || delta > 1 - 1e-6)
      ? 0
      : (delta * (1 - delta)) / (N * dutyCycle * (1 - dutyCycle))
    K_out = Math.min(K_out, 1)
    const K_floor = Math.max(K_out, 0.05)
    const L_phase = L_single * K_floor
    const deltaIL = (vout * (1 - dutyCycle)) / (L_phase * fsw)
    const iLmin = iout / N - deltaIL / 2
    const iLmax = iout / N + deltaIL / 2

    const cycles = 2
    const pointsPerCycle = 200
    const n = cycles * pointsPerCycle
    const period = 1 / fsw
    const dt = period / (pointsPerCycle - 1)
    const capAmplitude = Math.max(voutRippleMax, 0.01 * vout) / 2
    const esrAmplitude = capAmplitude * 0.25

    const time = new Float64Array(n)
    const inductor_current = new Float64Array(n)
    const switch_node = new Float64Array(n)
    const output_ripple = new Float64Array(n)
    const diode_current = new Float64Array(n)

    for (let idx = 0; idx < n; idx++) {
      const t = idx * dt
      const phase = t % period
      const onTime = dutyCycle * period
      const isOn = phase < onTime
      const phaseInSection = isOn ? phase / onTime : (phase - onTime) / (period - onTime)

      const iL = isOn
        ? iLmin + (iLmax - iLmin) * phaseInSection
        : iLmax - (iLmax - iLmin) * phaseInSection

      time[idx] = t
      inductor_current[idx] = iL
      switch_node[idx] = isOn ? vinMax : 0
      diode_current[idx] = isOn ? 0 : iL

      const triangular = ((iL - iout / N) / (deltaIL / 2)) * capAmplitude
      const rectangular = (isOn ? 1 : -1) * esrAmplitude
      output_ripple[idx] = triangular + rectangular
    }

    return { time, inductor_current, switch_node, output_ripple, diode_current }
  },

  getStateSpaceModel(spec: DesignSpec, result: DesignResult, current_vin: number, current_iout: number): StateSpaceModel {
    const res = result as DesignResult & { inductance?: number; capacitance?: number; inductor?: { value: number }; output_cap?: { value: number } }
    const L = res.inductance || res.inductor?.value || 10e-6
    const C = res.capacitance || res.output_cap?.value || 10e-6
    const DCR_val = 0.01
    const Vd = 0.5
    const R = current_iout > 0.001 ? spec.vout / current_iout : 10000

    return {
      A1: [[-DCR_val / L, -1 / L], [1 / C, -1 / (C * R)]],
      B1: [[current_vin / L], [0]],
      A2: [[-DCR_val / L, -1 / L], [1 / C, -1 / (C * R)]],
      B2: [[-Vd / L], [0]],
    }
  },
}
