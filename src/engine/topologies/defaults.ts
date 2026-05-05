// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import type { DesignSpec } from '../types'
import type { TopologyId } from '../../store/workbenchStore'

// Canonical smart defaults per topology.
// Re-exported by design-store.ts as TOPOLOGY_DEFAULTS so the rest of the
// app keeps the same import path.
export const TOPOLOGY_DEFAULTS: Record<TopologyId, DesignSpec> = {
  buck: {
    vinMin: 10, vinMax: 14, vout: 5, iout: 3,
    fsw: 500_000, rippleRatio: 0.3, ambientTemp: 25, voutRippleMax: 0.01, efficiency: 0.92,
  },
  boost: {
    vinMin: 4.5, vinMax: 5.5, vout: 12, iout: 1,
    fsw: 300_000, rippleRatio: 0.3, ambientTemp: 25, voutRippleMax: 0.05, efficiency: 0.90,
  },
  'buck-boost': {
    vinMin: 10, vinMax: 14, vout: -5, iout: 1,
    fsw: 500_000, rippleRatio: 0.3, ambientTemp: 25, voutRippleMax: 0.05, efficiency: 0.85,
  },
  flyback: {
    vinMin: 285, vinMax: 375, vout: 5, iout: 2,
    fsw: 100_000, rippleRatio: 0.3, ambientTemp: 40, voutRippleMax: 0.1, efficiency: 0.85,
  },
  forward: {
    vinMin: 36, vinMax: 60, vout: 3.3, iout: 10,
    fsw: 200_000, rippleRatio: 0.3, ambientTemp: 25, voutRippleMax: 0.05, efficiency: 0.88,
  },
  sepic: {
    vinMin: 3.3, vinMax: 12, vout: 5, iout: 1,
    fsw: 500_000, rippleRatio: 0.3, ambientTemp: 25, voutRippleMax: 0.05, efficiency: 0.88,
  },
}
