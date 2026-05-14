// Sticky footer at the bottom of the input panel that launches a Monte Carlo run.
import React, { useState } from 'react'
import styles from './InputPanel.module.css'

interface MonteCarloFooterProps {
  resultAvailable: boolean
  onRun: (iterations: number, seed: number) => void
}

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v))
}

export function MonteCarloFooter({ resultAvailable, onRun }: MonteCarloFooterProps): React.ReactElement {
  const [iterations, setIterations] = useState(1000)
  const [seed,       setSeed]       = useState(42)

  return (
    <div className={styles.mcFooter}>
      <div className={styles.mcLabel}>Monte Carlo</div>
      <div className={styles.mcControls}>
        <span className={styles.mcFieldLabel}>n =</span>
        <input type="number" className={styles.mcInput} value={iterations}
          min={100} max={10000} step={100}
          onChange={(e) => setIterations(clamp(100, 10000, Number(e.target.value)))} />
        <span className={styles.mcFieldLabel}>seed</span>
        <input type="number" className={styles.mcInput} value={seed}
          min={0} step={1}
          onChange={(e) => setSeed(Math.max(0, Number(e.target.value)))} />
        <div className={styles.mcSpacer} />
        <button
          className={styles.mcButton}
          disabled={!resultAvailable}
          onClick={() => onRun(iterations, seed)}
        >
          Run
        </button>
      </div>
    </div>
  )
}
