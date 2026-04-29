export interface DesignSpec {
  vinMin: number     // V — minimum input voltage
  vinMax: number     // V — maximum input voltage
  vout: number       // V — output voltage
  iout: number       // A — output current
  fsw: number        // Hz — switching frequency
  efficiency: number // 0–1 target efficiency
}

export interface DesignResult {
  dutyCycle: number    // 0–1
  inductance: number   // H
  capacitance: number  // F
  peakCurrent: number  // A
}

export interface Topology {
  id: string
  name: string
  compute: (spec: DesignSpec) => DesignResult
}
