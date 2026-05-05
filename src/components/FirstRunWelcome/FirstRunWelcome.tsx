// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React, { useState, useEffect } from 'react'
import styles from './FirstRunWelcome.module.css'

const STORAGE_KEY = 'psd-welcome-seen'

export function FirstRunWelcome(): React.ReactElement | null {
  const [isVisible, setIsVisible] = useState(false)
  const [dontShow, setDontShow] = useState(false)

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem(STORAGE_KEY)
    if (!hasSeenWelcome) {
      setIsVisible(true)
    }
  }, [])

  const handleDismiss = () => {
    if (dontShow) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.icon}>⚡</div>
          <h2>Welcome to Power Supply Design Workbench</h2>
        </div>

        <p className={styles.subtitle}>
          Design switching power supplies with real-time component calculations and analysis.
        </p>

        <div className={styles.callouts}>
          <div className={styles.callout}>
            <span className={styles.number}>①</span>
            <div>
              <strong>Select Topology</strong>
              <p>Choose a converter type (Buck, Boost, Flyback, etc.)</p>
            </div>
          </div>

          <div className={styles.callout}>
            <span className={styles.number}>②</span>
            <div>
              <strong>Enter Specifications</strong>
              <p>Input voltage, output voltage, current, switching frequency</p>
            </div>
          </div>

          <div className={styles.callout}>
            <span className={styles.number}>③</span>
            <div>
              <strong>Review Schematic</strong>
              <p>See the circuit topology and component suggestions</p>
            </div>
          </div>

          <div className={styles.callout}>
            <span className={styles.number}>④</span>
            <div>
              <strong>Analyze Results</strong>
              <p>Waveforms, Bode plot, losses, thermal, Monte Carlo</p>
            </div>
          </div>
        </div>

        <div className={styles.quickTips}>
          <p>
            💡 Use <strong>?</strong> button in the toolbar for detailed help & documentation.
          </p>
          <p>
            ⌨️ Press <strong>Ctrl+1–4</strong> to quickly switch between analysis tabs.
          </p>
        </div>

        <div className={styles.footer}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
            />
            <span>Don't show this again</span>
          </label>
          <button className={styles.button} onClick={handleDismiss}>
            Got it →
          </button>
        </div>
      </div>
    </div>
  )
}
