// First-run welcome overlay: shown once on first launch, dismissed with "Got it".
import React, { useState, useEffect } from 'react'
import styles from './FirstRunWelcome.module.css'

const STORAGE_KEY = 'psd-welcome-seen'

const CALLOUTS: { num: string; title: string; desc: string }[] = [
  { num: '①', title: 'Select Topology',     desc: 'Choose a converter type (Buck, Boost, Flyback, etc.)' },
  { num: '②', title: 'Enter Specifications', desc: 'Input voltage, output voltage, current, switching frequency' },
  { num: '③', title: 'Review Schematic',     desc: 'See the circuit topology and component suggestions' },
  { num: '④', title: 'Analyze Results',      desc: 'Waveforms, Bode plot, losses, thermal, Monte Carlo' },
]

/** Welcome modal shown once on first launch; persists dismissal in localStorage. */
export function FirstRunWelcome(): React.ReactElement | null {
  const [isVisible, setIsVisible] = useState(false)
  const [dontShow, setDontShow]   = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setIsVisible(true)
  }, [])

  const handleDismiss = () => {
    if (dontShow) localStorage.setItem(STORAGE_KEY, 'true')
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
          {CALLOUTS.map(({ num, title, desc }) => (
            <div key={num} className={styles.callout}>
              <span className={styles.number}>{num}</span>
              <div>
                <strong>{title}</strong>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.quickTips}>
          <p>💡 Use <strong>?</strong> button in the toolbar for detailed help &amp; documentation.</p>
          <p>⌨️ Press <strong>Ctrl+1–4</strong> to quickly switch between analysis tabs.</p>
        </div>

        <div className={styles.footer}>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
            <span>Don't show this again</span>
          </label>
          <button className={styles.button} onClick={handleDismiss}>Got it →</button>
        </div>
      </div>
    </div>
  )
}
