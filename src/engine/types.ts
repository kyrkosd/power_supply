import type { WaveformSet, TransferFunction, StateSpaceModel } from './topologies/types'

export type { TransferFunction }

// ── Analysis-module result types ──────────────────────────────────────────────
// Defined here so DesignResult can reference them without importing from the
// analysis modules (which themselves import from types.ts — keeping this file
// as the dependency-graph leaf for pure types).

export interface SaturationResult {
  i_peak:           number        // A — peak inductor current from design
  i_sat:            number | null // A — datasheet saturation current; null when no part selected
  margin_pct:       number | null // % — (Isat − Ipeak) / Isat × 100; null when no part selected
  estimated_B_peak: number        // T — estimated peak flux density (linear B ∝ I model)
  B_sat_material:   number        // T — assumed saturation flux density for default core material
  is_saturated:     boolean
  warning:          string | null
}

export interface SnubberResult {
  type: 'RCD_clamp'
  leakage_inductance: number // H — Llk = leakage_ratio × Lm
  V_clamp: number            // V
  R: number                  // Ω
  C: number                  // F
  P_dissipated: number       // W
  components: {
    R_value: number          // Ω — use nearest E24 series resistor
    R_power_rating: number   // W — 2× P_dissipated for thermal margin
    C_value: number          // F
    C_voltage_rating: number // V — 125% of V_clamp
    diode_Vr: number         // V — minimum reverse voltage for clamp diode
  }
}

export type SenseMethod = 'resistor' | 'rdson'

export interface CurrentSenseResult {
  method: SenseMethod
  rsense: number                       // Ω   — 0 for rdson
  rsense_power: number                 // W   — I²_rms × Rsense (0 for rdson)
  rsense_package: string               // recommended package (0805, 1206, 2010, 2512, shunt)
  vsense_peak: number                  // V   — peak voltage across sense element
  vsense_valley: number                // V   — valley voltage
  snr_at_light_load: number            // dB  — at 10 % Iout vs 5 mV noise floor
  kelvin_connection_required: boolean  // true when Rsense < 10 mΩ
  rdson_temp_error_pct: number         // %   — 0 for resistor; accuracy drift at 100 °C
  slope_comp_ramp: number              // V/s — minimum external ramp to avoid subharmonics
  warnings: string[]
}

export interface FilterComponent {
  type: string
  value: string
  voltage_rating: string
  current_rating: string
  ref: string
}

export interface InputFilterResult {
  dm_inductor: number
  dm_capacitor: number
  cm_choke: number
  x_capacitor: number
  y_capacitors: number
  damping_resistor: number
  damping_capacitor: number
  filter_resonant_freq: number
  filter_attenuation_at_fsw: number
  required_attenuation_db: number
  middlebrook_stable: boolean
  negative_input_impedance: number
  filter_output_impedance_at_resonance: number
  stability_margin_db: number
  filter_inductor_loss_w: number
  components: FilterComponent[]
  warnings: string[]
}

export interface WindingSection {
  turns: number
  wire_gauge_awg: number
  strands: number
  resistance_mohm: number  // DC resistance, mΩ
  fill_factor_pct: number  // this winding's copper area / bobbin area × 100
  layers: number
}

export interface WindingResult {
  primary: WindingSection
  secondary: WindingSection[]        // index 0 = main regulated output
  winding_order: string[]            // e.g. ["Primary (½)", "Sec 1", "Primary (½)"]
  estimated_leakage_nh: number       // nH — Kazimierczuk eq. 6.28
  skin_depth_mm: number              // δ at fsw
  max_strand_diameter_mm: number     // 2 × skin_depth
  proximity_loss_factor: number      // Fr = Rac/Rdc for primary (Dowell 1966)
  total_copper_loss: number          // W — DC + AC (Fr-weighted)
  creepage_mm: number                // IEC 62368-1, reinforced insulation
  clearance_mm: number
  bobbin_fill_check: boolean         // true = all copper fits (fill ≤ 60 %)
  warnings: string[]
}

// ── Design domain types ───────────────────────────────────────────────────────

/** One additional transformer secondary winding (flyback multi-output only). */
export interface SecondaryOutput {
  vout: number          // V — output voltage
  iout: number          // A — output current
  diode_vf: number      // V — rectifier diode forward voltage (typical 0.4 V Schottky)
  is_regulated: boolean // true only for the feedback-controlled output
}

export interface DesignSpec {
  vinMin: number        // V — minimum input voltage
  vinMax: number        // V — maximum input voltage
  vout: number          // V — output voltage
  iout: number          // A — output current
  fsw: number           // Hz — switching frequency
  rippleRatio: number   // —   — ΔiL / Iout_max
  ambientTemp: number   // °C — ambient temperature
  voutRippleMax: number // V   — maximum output voltage ripple (pk-pk)
  efficiency: number    // 0–1 target efficiency
  // Flyback multi-output: up to 3 additional secondaries beyond the primary.
  secondary_outputs?: SecondaryOutput[]
  // Control loop mode — affects Bode plot only, not component sizing.
  controlMode?: 'voltage' | 'current'
  // Leakage inductance as fraction of Lm (flyback/forward RCD clamp). Default: 0.02 (2 %).
  leakageRatio?: number
  // Current sense method (only used when controlMode === 'current').
  senseMethod?: 'resistor' | 'rdson'
  // Peak sense voltage target in mV for resistor method. Default: 150 mV.
  vsenseTargetMv?: number
  // Input EMI filter options.
  inputFilterEnabled?: boolean
  inputFilterAttenuationDb?: number  // override target dB; 0 = auto from EMI
  inputFilterCmChokeMh?: number      // CM choke in mH; 0 = auto
  // Multi-phase interleaved buck (1–6 phases, default 1).
  phases?: number
  // Synchronous rectification: replace freewheeling diode with low-side FET.
  // Applies to non-isolated topologies only (buck, boost, buck-boost, sepic).
  rectification?: 'diode' | 'synchronous'
}

/** Computed values for one flyback secondary winding. */
export interface SecondaryOutputResult {
  label: string          // "Output 2", "Output 3", etc.
  vout_nominal: number   // V — target voltage
  ns: number             // secondary turns (integer)
  diode_vr_max: number   // V — reverse voltage the rectifier diode must withstand
  capacitance: number    // F — minimum output capacitance
  crossRegPct: number    // % — cross-regulation estimate under ±50 % primary load variation
}

export interface InductorResult {
  value: number        // H
  peak_current: number // A
  rms_current: number  // A
}

export interface OutputCapResult {
  value: number        // F
  esr_max: number      // Ω
  ripple_current: number // A rms
}

export interface DesignResult {
  output_cap?: OutputCapResult
  inductor?: InductorResult
  dutyCycle: number      // 0–1
  inductance: number     // H
  capacitance: number    // F
  peakCurrent: number    // A
  efficiency?: number    // 0–1  Pout / (Pout + total_losses); undefined when losses unavailable
  warnings: string[]     // stability and runtime advisories
  ccm_dcm_boundary?: number     // A — critical load current below which converter enters DCM
  operating_mode?: 'CCM' | 'DCM' | 'boundary'  // Conduction mode indicator
  // Flyback-specific fields
  turnsRatio?: number  // Np/Ns
  primaryTurns?: number
  secondaryTurns?: number
  coreType?: string
  magnetizingInductance?: number // H
  leakageInductance?: number // H
  clampVoltage?: number // V
  secondaryOutputResults?: SecondaryOutputResult[]
  losses?: {
    // Flyback/forward loss breakdown
    primaryCopper?: number
    secondaryCopper?: number
    core?: number
    clamp?: number
    // Buck loss breakdown (matches LossBreakdown.tsx keys)
    mosfet_conduction?: number
    mosfet_switching?: number
    mosfet_gate?: number
    inductor_copper?: number
    inductor_core?: number
    diode_conduction?: number
    capacitor_esr?: number
    // Synchronous rectification loss keys (zero in diode mode)
    sync_conduction?: number    // Q2 Rds×(1-D) conduction loss
    sync_dead_time?: number     // Q2 body diode dead-time + Coss + gate drive
    // Legacy single key kept for compatibility
    mosfet?: number
    diode?: number
    total: number
  }
  // Multi-phase interleaved buck fields
  phases?: number
  phase_inductance?: number    // H — per-phase inductor value
  phase_peak_current?: number  // A — per-phase peak current
  output_ripple_cancel?: number // 0–1 ripple cancellation factor (0 = perfect)
  input_ripple_cancel?: number  // 0–1 Cin RMS ratio vs single-phase
  saturation_check?: SaturationResult
  snubber?: SnubberResult         // RCD clamp design (flyback and forward only)
  current_sense?: CurrentSenseResult  // current sense element design (when controlMode === 'current')
  input_filter?: InputFilterResult    // EMI input filter design (when inputFilterEnabled)
  winding_result?: WindingResult      // transformer winding design (flyback and forward only)
  // Forward-specific fields
  outputInductance?: number // H - separate from magnetizing
  resetVoltage?: number // V - reset winding voltage
  rectifierDiodes?: number // count of rectifier diodes
  // SEPIC-specific fields
  couplingCapacitance?: number // F - coupling capacitor Cc
  mosfetVdsMax?: number // V - MOSFET drain-source max voltage
  diodeVrMax?: number // V - diode reverse voltage max
}

export interface Topology {
  id: string
  name: string
  compute: (spec: DesignSpec) => DesignResult
  getTransferFunction?: (spec: DesignSpec, result: DesignResult) => TransferFunction
  generateWaveforms?: (spec: DesignSpec) => WaveformSet
  getStateSpaceModel?: (spec: DesignSpec, result: DesignResult, vin: number, iout: number) => StateSpaceModel
}
