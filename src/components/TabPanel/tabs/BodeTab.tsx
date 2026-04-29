import React, { useRef } from 'react'
import styles from './Tab.module.css'

export function BodeTab(): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)

  return (
    <div className={styles.tab}>
      <div className={styles.placeholder}>
        <svg ref={svgRef} className={styles.chart}>
          <text x="50%" y="42%" textAnchor="middle" fill="rgba(74,144,217,0.35)" fontSize="15" fontFamily="Segoe UI">
            Gain (dB) · Phase (°) vs. Frequency
          </text>
          <text x="50%" y="55%" textAnchor="middle" fill="rgba(148,148,176,0.35)" fontSize="12" fontFamily="Segoe UI">
            Phase margin · Gain margin · Crossover frequency
          </text>
          <text x="50%" y="65%" textAnchor="middle" fill="rgba(148,148,176,0.25)" fontSize="12" fontFamily="Segoe UI">
            D3.js Bode plot — coming soon
          </text>
        </svg>
      </div>
    </div>
  )
}
