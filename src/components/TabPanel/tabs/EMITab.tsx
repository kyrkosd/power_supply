// EMI pre-compliance tab: conducted emissions vs. CISPR 32 Class B limit.
import React from 'react'
import { useDesignStore } from '../../../store/design-store'
import { EMIChart } from '../../EMIChart'

// Typical MOSFET switching transition times used when device data is unavailable.
const DEFAULT_TRISE_S = 50e-9
const DEFAULT_TFALL_S = 50e-9

/** Renders the CISPR 32 conducted EMI chart for the current design. */
export function EMITab(): React.ReactElement {
  const result = useDesignStore((s) => s.result)
  const spec   = useDesignStore((s) => s.spec)

  if (!result) {
    return (
      <div style={{ padding: 24, color: 'var(--text-secondary)' }}>
        Run a simulation first to see the EMI pre-compliance chart.
      </div>
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <EMIChart
        fsw={spec.fsw}
        dutyCycle={result.dutyCycle}
        trise={DEFAULT_TRISE_S}
        tfall={DEFAULT_TFALL_S}
        Ipeak={result.peakCurrent}
      />
    </div>
  )
}
