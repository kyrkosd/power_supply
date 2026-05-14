// Collapsible gate-drive design panel (Rg, timing, bootstrap).
import React from 'react'
import type { GateDriveResult } from '../../../engine/gate-drive'
import { fmtTime, fmtCap, fmtPower } from '../suggestionFormatters'
import styles from '../ComponentSuggestions.module.css'
import { GdrRow } from './badges'
import {
  gateResistorTip, peakGateCurrentTip, gateDrivePowerTip,
  turnOnTip, turnOffTip, deadTimeTip,
  bootstrapCapTip, bootstrapDiodeTip,
} from './tooltips'

function BootstrapRows({ gd }: { gd: GateDriveResult }): React.ReactElement {
  return (
    <>
      <div className={styles.gdrDivider} />
      <GdrRow label="Bootstrap Cap (Cboot)" value={fmtCap(gd.bootstrap_cap)} tip={bootstrapCapTip} />
      <GdrRow label="Bootstrap Diode Vr"    value={`${gd.bootstrap_diode_vr.toFixed(0)} V`} tip={bootstrapDiodeTip} />
    </>
  )
}

export function GateDriveSection({ gd, showBootstrap }: { gd: GateDriveResult; showBootstrap: boolean }): React.ReactElement {
  return (
    <details className={styles.section} open={false}>
      <summary className={styles.gdrSummary}>Gate Drive Design</summary>
      <div className={styles.gdrBody}>
        <GdrRow label="Gate Resistor (Rg)"  value={`${gd.gate_resistor.toFixed(1)} Ω`}     tip={gateResistorTip(gd)} />
        <GdrRow label="Peak Gate Current"   value={`${gd.peak_gate_current.toFixed(2)} A`} tip={peakGateCurrentTip} />
        <GdrRow label="Gate Drive Power"    value={fmtPower(gd.gate_drive_power)}          tip={gateDrivePowerTip} />
        <GdrRow label="Turn-on Time"        value={fmtTime(gd.turn_on_time)}               tip={turnOnTip} />
        <GdrRow label="Turn-off Time"       value={fmtTime(gd.turn_off_time)}              tip={turnOffTip} />
        <GdrRow label="Dead Time (rec.)"    value={fmtTime(gd.dead_time_recommended)}      tip={deadTimeTip} />
        {showBootstrap && <BootstrapRows gd={gd} />}
      </div>
    </details>
  )
}
