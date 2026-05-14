// Arrhenius lifetime estimate row for electrolytic capacitors.
import React from 'react'
import type { CapLifetimeResult } from '../../../engine/cap-lifetime'
import { Tooltip } from '../../Tooltip/Tooltip'
import { lifetimeColor } from '../suggestionFormatters'
import styles from '../ComponentSuggestions.module.css'
import { capLifetimeTip } from './tooltips'

function lifetimeLabel(years: number): string {
  return years >= 100 ? '>100 yr' : `${years.toFixed(1)} yr`
}

export function CapLifetimeRow({ lifetime, ambientTemp }: { lifetime: CapLifetimeResult; ambientTemp: number }): React.ReactElement {
  const years = lifetime.derated_lifetime_years
  const tip = capLifetimeTip(lifetime, ambientTemp)
  return (
    <>
      <div className={styles.lifetimeRow}>
        <span className={styles.lifetimeLabel}>Est. lifetime <Tooltip content={tip} side="left"><span className={styles.infoIcon}>ⓘ</span></Tooltip></span>
        <span className={styles.lifetimeValue} style={{ color: lifetimeColor(years) }}>{lifetimeLabel(years)} @ {ambientTemp} °C</span>
      </div>
      {lifetime.warnings.map((w, i) => <div key={i} className={styles.lifetimeWarn}>{w}</div>)}
    </>
  )
}
