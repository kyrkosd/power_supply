// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import type { WaveformSet, TransferFunction, StateSpaceModel } from './topologies/types'
import type { SaturationResult } from './inductor-saturation'
import type { SnubberResult } from './snubber'
import type { CurrentSenseResult } from './current-sense'
import type { InputFilterResult } from './input-filter'
import type { WindingResult } from './transformer-winding'

export type { SaturationResult }
export type { SnubberResult }
export type { CurrentSenseResult }
export type { InputFilterResult }
export type { WindingResult }

export type { TransferFunction }

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
