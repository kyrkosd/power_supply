import type { WaveformSet } from './topologies/types'

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
}

export interface DesignResult {
  dutyCycle: number      // 0–1
  inductance: number     // H
  capacitance: number    // F
  peakCurrent: number    // A
  efficiency?: number    // 0–1  Pout / (Pout + total_losses); undefined when losses unavailable
  warnings: string[]     // stability and runtime advisories
  // Flyback-specific fields
  turnsRatio?: number  // Np/Ns
  primaryTurns?: number
  secondaryTurns?: number
  coreType?: string
  magnetizingInductance?: number // H
  leakageInductance?: number // H
  clampVoltage?: number // V
  losses?: {
    primaryCopper: number
    secondaryCopper: number
    core: number
    mosfet: number
    diode: number
    clamp: number
    total: number
  }
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
}
