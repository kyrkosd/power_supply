// Full transformer winding details: skin depth, Fr factor, windings, leakage, creepage.
import React from 'react'
import type { WindingResult, WindingSection } from '../../../engine/transformer-winding'
import { Tooltip } from '../../Tooltip/Tooltip'
import { fmtPower, fillColor, frColor } from '../suggestionFormatters'
import styles from '../ComponentSuggestions.module.css'
import {
  skinDepthTip, proximityFactorTip, leakageInductanceTip, creepageTip,
} from './tooltips'

function plural(n: number, label: string): string { return `${n} ${label}${n > 1 ? 's' : ''}` }

function WindingRow({ label, w }: { label: string; w: WindingSection }): React.ReactElement {
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '2px' }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', fontSize: '12px' }}>
        <span>AWG {w.wire_gauge_awg} × {plural(w.strands, 'strand')}</span>
        <span>{w.turns} turns, {plural(w.layers, 'layer')}</span>
        <span>R: {w.resistance_mohm.toFixed(1)} mΩ</span>
      </div>
      <div style={{ fontSize: '11px', color: fillColor(w.fill_factor_pct) }}>Fill: {w.fill_factor_pct.toFixed(1)} %</div>
    </div>
  )
}

function totalFillFactor(wr: WindingResult): number {
  return wr.primary.fill_factor_pct + wr.secondary.reduce((a, s) => a + s.fill_factor_pct, 0)
}

function tipIcon(tip: React.ReactNode): React.ReactElement {
  return <Tooltip content={tip} side="left"><span className={styles.infoIcon}>ⓘ</span></Tooltip>
}

export function TransformerDetails({ wr }: { wr: WindingResult }): React.ReactElement {
  const totalFill = totalFillFactor(wr)
  return (
    <div className={styles.gdrBody}>
      <div className={styles.gdrRow}>
        <span className={styles.gdrLabel}>Skin depth (δ) {tipIcon(skinDepthTip)}</span>
        <span className={styles.gdrValue}>{wr.skin_depth_mm.toFixed(3)} mm (max strand: {wr.max_strand_diameter_mm.toFixed(3)} mm)</span>
      </div>
      <div className={styles.gdrRow}>
        <span className={styles.gdrLabel}>AC loss factor (Fr) {tipIcon(proximityFactorTip)}</span>
        <span className={styles.gdrValue} style={{ color: frColor(wr.proximity_loss_factor) }}>{wr.proximity_loss_factor.toFixed(2)}</span>
      </div>
      <div className={styles.gdrDivider} />
      <WindingRow label="Primary" w={wr.primary} />
      {wr.secondary.map((s, i) => <WindingRow key={i} label={`Secondary ${i + 1}`} w={s} />)}
      <div className={styles.gdrRow} style={{ marginTop: '4px' }}>
        <span className={styles.gdrLabel}>Total bobbin fill</span>
        <span className={styles.gdrValue} style={{ color: fillColor(totalFill) }}>{totalFill.toFixed(1)} %</span>
      </div>
      <div className={styles.gdrDivider} />
      <div className={styles.gdrRow}>
        <span className={styles.gdrLabel}>Leakage inductance {tipIcon(leakageInductanceTip)}</span>
        <span className={styles.gdrValue}>{wr.estimated_leakage_nh.toFixed(0)} nH</span>
      </div>
      <div className={styles.gdrRow}><span className={styles.gdrLabel}>Total copper loss</span><span className={styles.gdrValue}>{fmtPower(wr.total_copper_loss)}</span></div>
      <div className={styles.gdrDivider} />
      <div className={styles.gdrRow}><span className={styles.gdrLabel}>Winding order</span><span className={styles.gdrValue} style={{ fontSize: '11px' }}>{wr.winding_order.join(' → ')}</span></div>
      <div className={styles.gdrRow}>
        <span className={styles.gdrLabel}>Creepage (IEC 62368-1) {tipIcon(creepageTip)}</span>
        <span className={styles.gdrValue}>{wr.creepage_mm.toFixed(1)} mm creepage / {wr.clearance_mm.toFixed(1)} mm clearance</span>
      </div>
      {wr.warnings.map((w, i) => <div key={i} className={styles.ssWarn}>{w}</div>)}
    </div>
  )
}
