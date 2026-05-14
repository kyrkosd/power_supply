import React from 'react'
import type { SweepResult } from '../../store/design-store'
import type { DesignSpec } from '../../engine/types'
import type { ParamDef } from './sweepDefs'
import { METRICS } from './sweepDefs'
import styles from './SweepView.module.css'

interface Props {
  hoverIdx:  number | null
  result:    SweepResult
  resultPd:  ParamDef
  checked:   Set<string>
  spec:      DesignSpec
}

export function SweepHoverLegend({ hoverIdx, result, resultPd, checked, spec }: Props): React.ReactElement {
  return (
    <div className={styles.hoverLegend}>
      {hoverIdx != null ? (
        <>
          <span className={styles.hoverParamLabel}>
            {(result.points[hoverIdx].paramValue / resultPd.displayScale).toFixed(resultPd.decimals)}
            {resultPd.unit && ` ${resultPd.unit}`}
          </span>
          {METRICS.filter((m) => checked.has(m.key)).map((m) => {
            const v = m.get(result.points[hoverIdx!], result.sweepParam, spec)
            return v != null ? (
              <span key={m.key} className={styles.hoverItem}>
                <span className={styles.hoverDot} style={{ background: m.color }} />
                <span className={styles.hoverKey}>{m.shortLabel}:</span>
                <span className={styles.hoverVal}>{v.toFixed(3)} {m.unit}</span>
              </span>
            ) : null
          })}
        </>
      ) : (
        <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)' }}>Hover the chart to inspect values</span>
      )}
    </div>
  )
}
