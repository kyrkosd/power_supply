// LLC resonant converter — stub pending First Harmonic Approximation (FHA) model.
import { DesignSpec, DesignResult, Topology } from '../types'

export const llcTopology: Topology = {
  id: 'llc',
  name: 'LLC Resonant',

  compute(spec: DesignSpec): DesignResult {
    void spec
    return {
      dutyCycle: NaN,
      inductance: NaN,
      capacitance: NaN,
      peakCurrent: NaN,
      warnings: [],
    }
  },
}
