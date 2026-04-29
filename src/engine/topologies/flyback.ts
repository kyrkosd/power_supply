import { DesignSpec, DesignResult, Topology } from '../types'

export const flybackTopology: Topology = {
  id: 'flyback',
  name: 'Flyback',

  compute(spec: DesignSpec): DesignResult {
    // Placeholder — transformer turns ratio and magnetising inductance TBD
    void spec
    return {
      dutyCycle: NaN,
      inductance: NaN,
      capacitance: NaN,
      peakCurrent: NaN
    }
  }
}
