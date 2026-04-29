// ─────────────────────────────────────────────────────────────────────────────
// Engine layer type definitions
// All quantities are in SI base units unless a comment says otherwise.
// Scale factors (µH, kHz, etc.) live at the UI boundary only.
// ─────────────────────────────────────────────────────────────────────────────

// ── Warning codes ─────────────────────────────────────────────────────────────

export const WarningCode = {
  NOT_IMPLEMENTED:          'NOT_IMPLEMENTED',
  CCM_BOUNDARY_VIOLATED:    'CCM_BOUNDARY_VIOLATED',   // converter enters DCM at iout_min
  DUTY_CYCLE_TOO_HIGH:      'DUTY_CYCLE_TOO_HIGH',     // D > 0.9 — control headroom risk
  DUTY_CYCLE_TOO_LOW:       'DUTY_CYCLE_TOO_LOW',      // D < 0.1 — noise susceptibility
  VOUT_RIPPLE_EXCEEDED:     'VOUT_RIPPLE_EXCEEDED',    // computed ripple > vout_ripple_max
  PEAK_CURRENT_HIGH:        'PEAK_CURRENT_HIGH',       // peak iL > 3× iout_max
  EFFICIENCY_BELOW_TARGET:  'EFFICIENCY_BELOW_TARGET', // computed η < efficiency_target
} as const

export type WarningCode = typeof WarningCode[keyof typeof WarningCode]

export type WarningSeverity = 'info' | 'warning' | 'error'

export interface DesignWarning {
  code: WarningCode | string   // string allows topology-specific codes beyond the known set
  severity: WarningSeverity
  message: string              // human-readable; shown directly in the UI
  parameter?: keyof DesignSpec // which input triggered this warning, if applicable
}

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface DesignSpec {
  vin_min: number            // V   — minimum input voltage (worst-case for duty cycle)
  vin_max: number            // V   — maximum input voltage (worst-case for inductor volt-seconds)
  vin_nom: number            // V   — nominal input (used for operating-point / transfer function)
  vout: number               // V   — regulated output voltage
  iout_max: number           // A   — maximum output current (full load)
  iout_min: number           // A   — minimum output current (CCM/DCM boundary check)
  fsw: number                // Hz  — switching frequency
  ripple_ratio: number       // —   — ΔiL / iout_max, e.g. 0.3 for 30 % peak-to-peak
  vout_ripple_max: number    // V   — maximum allowable output voltage ripple (peak-to-peak)
  ambient_temp: number       // °C  — ambient temperature for thermal derating
  efficiency_target: number  // —   — target efficiency 0–1 (used in input current estimates)
}

// ── Component sizing ──────────────────────────────────────────────────────────

export interface InductorResult {
  value: number         // H — minimum inductance to maintain CCM down to iout_min
  peak_current: number  // A — Iout_max + ΔiL/2
  rms_current: number   // A — RMS current (relevant for copper loss)
}

export interface OutputCapResult {
  value: number          // F — minimum capacitance to meet vout_ripple_max
  esr_max: number        // Ω — maximum ESR that still meets the ripple spec
  ripple_current: number // A — RMS ripple current the cap must handle
}

export interface InputCapResult {
  value: number         // F — minimum input capacitance
  rms_current: number   // A — RMS ripple current through the input cap
}

export interface MosfetResult {
  rds_on_max: number  // Ω — maximum Rds_on for the conduction-loss budget
  vds_max: number     // V — peak VDS including ringing margin (typ. 1.3× Vin_max)
}

export interface DiodeResult {
  vr_max: number  // V — peak reverse voltage including margin (typ. 1.3× Vin_max)
  if_avg: number  // A — average forward current at full load
}

// ── Loss breakdown ────────────────────────────────────────────────────────────

export interface LossBreakdown {
  mosfet_conduction: number  // W — I²·Rds_on·D
  mosfet_switching: number   // W — ½·Vin·IL_peak·(t_rise+t_fall)·fsw
  mosfet_gate: number        // W — Qg·Vgs·fsw
  inductor_copper: number    // W — IL_rms²·DCR
  inductor_core: number      // W — Steinmetz model (placeholder until Bm known)
  diode_conduction: number   // W — Vf·If_avg·(1−D)
  capacitor_esr: number      // W — Ic_rms²·ESR
  total: number              // W — sum of all loss terms above
  efficiency: number         // —  Pout / (Pout + total)
}

// ── Aggregate result ──────────────────────────────────────────────────────────

export interface DesignResult {
  duty_cycle: number      // —  at vin_nom, iout_max
  inductor: InductorResult
  output_cap: OutputCapResult
  input_cap: InputCapResult
  mosfet: MosfetResult
  diode: DiodeResult
  losses: LossBreakdown
  efficiency: number      // —  overall at vin_nom, iout_max (mirrors losses.efficiency)
  warnings: DesignWarning[]
}

// ── Transfer function ─────────────────────────────────────────────────────────

// Polynomial coefficients in descending-power order: [a_n, …, a_1, a_0]
// H(s) = num[0]·sⁿ + … + num[n]  /  den[0]·sᵐ + … + den[m]
//
// evaluate() computes H(j·2π·f) and returns magnitude and phase.
// Implementations should use mathjs complex arithmetic internally.
export interface TransferFunction {
  readonly numerator: readonly number[]
  readonly denominator: readonly number[]
  evaluate(freq_hz: number): { magnitude_db: number; phase_deg: number }
}

export interface TransferFunctionParams {
  spec: DesignSpec
  result: DesignResult
  inductance?: number   // H — overrides result.inductor.value for what-if analysis
  capacitance?: number  // F — overrides result.output_cap.value
  esr?: number          // Ω — overrides result.output_cap.esr_max
}

// ── Waveforms ─────────────────────────────────────────────────────────────────

// Float64Array for all signal data — efficient transfer to/from Web Worker
// via Transferable objects.
export interface WaveformSet {
  time: Float64Array             // s  — length = cycles × points_per_cycle
  inductor_current: Float64Array // A
  switch_node: Float64Array      // V
  output_ripple: Float64Array    // V — AC component (mean subtracted)
  diode_current: Float64Array    // A
}

export interface WaveformParams {
  spec: DesignSpec
  result: DesignResult
  cycles?: number           // switching cycles to simulate (default: 3)
  points_per_cycle?: number // time-domain resolution per cycle (default: 200)
}

// ── Topology engine ───────────────────────────────────────────────────────────

export interface TopologyEngine {
  readonly id: string
  readonly name: string

  // Steady-state design: component sizing, losses, ratings.
  compute(spec: DesignSpec): DesignResult

  // Small-signal control-to-output transfer function at the operating point
  // defined by spec + result. Used for Bode plot rendering.
  getTransferFunction(params: TransferFunctionParams): TransferFunction

  // Time-domain waveforms for one or more switching cycles.
  // Returns Transferable Float64Arrays — post to worker, transfer ownership.
  generateWaveforms(params: WaveformParams): WaveformSet
}
