// Input EMI filter tab: DM/CM filter component values and Middlebrook impedance Bode plot.
import React, { useEffect, useRef, useMemo } from 'react'
import { useDesignStore } from '../../../store/design-store'
import type { InputFilterResult } from '../../../engine/input-filter'
import { drawImpedancePlot } from './impedancePlot'
import { fmtHz } from '../../../export/format-utils'
import styles from './InputFilterTab.module.css'

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend(): React.ReactElement {
  return (
    <div className={styles.legend}>
      <span className={styles.legendItem}>
        <span className={styles.dot} style={{ background: '#4ade80' }} /> |Zout filter|
      </span>
      <span className={styles.legendItem}>
        <span className={styles.dot} style={{ background: '#60a5fa' }} /> |Zin converter|
      </span>
      <span className={styles.legendItem}>
        <span className={styles.dot} style={{ background: 'rgba(239,68,68,0.55)', border: '1px dashed rgba(239,68,68,0.55)' }} /> |Zin|/3 (Middlebrook limit)
      </span>
    </div>
  )
}

// ── Component value formatters ────────────────────────────────────────────────
// These differ from format-utils: fmtH uses .toFixed(1) for sub-mH; fmtF starts at µF; fmtR covers kΩ.

function fmtH(h: number): string {
  if (h >= 1e-3) return `${(h * 1e3).toFixed(2)} mH`
  if (h >= 1e-6) return `${(h * 1e6).toFixed(1)} µH`
  return `${(h * 1e9).toFixed(1)} nH`
}
function fmtF(f: number): string {
  if (f >= 1e-6) return `${(f * 1e6).toFixed(2)} µF`
  if (f >= 1e-9) return `${(f * 1e9).toFixed(1)} nF`
  return `${(f * 1e12).toFixed(1)} pF`
}
function fmtR(r: number): string {
  if (r >= 1e3) return `${(r / 1e3).toFixed(1)} kΩ`
  return `${r.toFixed(2)} Ω`
}

// ── Component values table ────────────────────────────────────────────────────

function ValuesTable({ filter }: { filter: InputFilterResult }): React.ReactElement {
  const stabColor = filter.middlebrook_stable
    ? (filter.stability_margin_db > 6 ? '#4ade80' : '#f59e0b')
    : '#ef4444'

  const rows: [string, string][] = [
    ['DM inductor (Lf)',        fmtH(filter.dm_inductor)],
    ['DM capacitor (Cf)',       fmtF(filter.dm_capacitor)],
    ['Damping resistor (Rd)',   fmtR(filter.damping_resistor)],
    ['Damping capacitor (Cd)', fmtF(filter.damping_capacitor)],
    ['CM choke (Lcm)',          fmtH(filter.cm_choke)],
    ['X2 capacitor (Cx)',       fmtF(filter.x_capacitor)],
    ['Y2 capacitors (Cy×2)',    fmtF(filter.y_capacitors)],
    ['Filter resonance',        fmtHz(filter.filter_resonant_freq)],
    ['Attenuation @ fsw',       `${filter.filter_attenuation_at_fsw.toFixed(1)} dB (need ${filter.required_attenuation_db.toFixed(1)} dB)`],
    ['Inductor DCR loss',       `${(filter.filter_inductor_loss_w * 1000).toFixed(0)} mW (est.)`],
  ]

  return (
    <div className={styles.valuesTable}>
      <div className={styles.valuesGrid}>
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <span className={styles.vtLabel}>{label}</span>
            <span className={styles.vtValue}>{value}</span>
          </React.Fragment>
        ))}
        <span className={styles.vtLabel}>Middlebrook stable</span>
        <span className={styles.vtValue} style={{ color: stabColor }}>
          {filter.middlebrook_stable ? `Yes (${filter.stability_margin_db.toFixed(1)} dB margin)` : `No — ${filter.stability_margin_db.toFixed(1)} dB margin`}
        </span>
      </div>
      {filter.warnings.length > 0 && (
        <div className={styles.warnings}>
          {filter.warnings.map((w, i) => (
            <div key={i} className={styles.warn}>{w}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Impedance plot wrapper ────────────────────────────────────────────────────

function ImpedancePlot({ filter, fsw }: { filter: InputFilterResult; fsw: number }): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) drawImpedancePlot(svgRef.current, filter, fsw)
  }, [filter, fsw])

  return (
    <div className={styles.chartPanel}>
      <svg ref={svgRef} className={styles.svg} />
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

/** Input EMI filter tab: enable toggle, component value table, and impedance Bode plot. */
export function InputFilterTab(): React.ReactElement {
  const spec       = useDesignStore((s) => s.spec)
  const result     = useDesignStore((s) => s.result)
  const updateSpec = useDesignStore((s) => s.updateSpec)

  const filter  = result?.input_filter ?? null
  const enabled = spec.inputFilterEnabled ?? false

  const filterMemo = useMemo(() => filter, [filter])

  if (!result) {
    return (
      <div className={styles.empty}>
        <span>No design result yet — set parameters and wait for computation.</span>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      {/* Enable / disable toggle */}
      <div className={styles.toolbar}>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => updateSpec({ inputFilterEnabled: e.target.checked })}
          />
          Design input EMI filter
        </label>
        {enabled && (
          <span className={styles.hint}>
            Filter topology: CM choke → X-cap → DM LC + damping. Middlebrook stability checked.
          </span>
        )}
      </div>

      {!enabled && (
        <div className={styles.empty}>
          <span>Enable the input filter to design the CM/DM filter network and check Middlebrook stability.</span>
        </div>
      )}

      {enabled && !filterMemo && (
        <div className={styles.empty}><span>Computing…</span></div>
      )}

      {enabled && filterMemo && (
        <div className={styles.content}>
          <div className={styles.topRow}>
            <ValuesTable filter={filterMemo} />
          </div>
          <Legend />
          <ImpedancePlot filter={filterMemo} fsw={spec.fsw} />
        </div>
      )}
    </div>
  )
}
