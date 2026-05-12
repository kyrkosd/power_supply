// Parameter Sweep modal: config, run, multi-metric chart, hover legend, data table, CSV export.
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useDesignStore } from '../../store/design-store'
import type { SweepParam } from '../../store/design-store'
import { METRICS, PARAM_DEFS, DEFAULT_CHECKED, getParamDef, getCurrentParamSI } from './sweepDefs'
import { SweepChart } from './SweepChart'
import styles from './SweepView.module.css'

/** Renders a table cell: formatted number or an em-dash placeholder. */
function nd(v: number | null | undefined, dec: number): React.ReactElement {
  return v != null ? <td>{v.toFixed(dec)}</td> : <td><span className={styles.nullVal}>—</span></td>
}

/** Parameter sweep modal — read-only analysis that does not modify the design. */
export function SweepView(): React.ReactElement | null {
  const isSweepOpen        = useDesignStore((s) => s.isSweepOpen)
  const setIsSweepOpen     = useDesignStore((s) => s.setIsSweepOpen)
  const sweepLoading       = useDesignStore((s) => s.sweepLoading)
  const sweepProgress      = useDesignStore((s) => s.sweepProgress)
  const sweepProgressTotal = useDesignStore((s) => s.sweepProgressTotal)
  const sweepResult        = useDesignStore((s) => s.sweepResult)
  const requestSweep       = useDesignStore((s) => s.requestSweep)
  const topology           = useDesignStore((s) => s.topology)
  const spec               = useDesignStore((s) => s.spec)

  const [sweepParam,     setSweepParam]     = useState<SweepParam>('vin')
  const [minDisp,        setMinDisp]        = useState('')
  const [maxDisp,        setMaxDisp]        = useState('')
  const [steps,          setSteps]          = useState(20)
  const [checkedMetrics, setCheckedMetrics] = useState<Set<string>>(new Set(DEFAULT_CHECKED))
  const [hoverIdx,       setHoverIdx]       = useState<number | null>(null)

  // Auto-populate range when param changes; intentionally excludes spec
  const prevParamRef = useRef<SweepParam | null>(null)
  useEffect(() => {
    if (sweepParam === prevParamRef.current) return
    prevParamRef.current = sweepParam
    const [lo, hi] = getParamDef(sweepParam).defaultRange(spec)
    setMinDisp(String(lo))
    setMaxDisp(String(hi))
  }, [sweepParam]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setHoverIdx(null) }, [sweepResult])

  useEffect(() => {
    if (!isSweepOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsSweepOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isSweepOpen, setIsSweepOpen])

  // CSV export — hook must appear before early return
  const handleExport = useCallback(() => {
    if (!sweepResult) return
    const resPd  = getParamDef(sweepResult.sweepParam)
    const getM   = (key: string) => METRICS.find((m) => m.key === key)!
    const header = `${resPd.label}${resPd.unit ? ` (${resPd.unit})` : ''},L (µH),C (µF),D (%),η (%),P_loss (W),PM (°),Tj (°C),ΔV (mV),I_crit (A)\n`
    const rows   = sweepResult.points.map((pt) => {
      const pv  = (pt.paramValue / resPd.displayScale).toFixed(resPd.decimals)
      const r   = pt.result
      if (!r) return `${pv},,,,,,,,\n`
      const eff = getM('efficiency').get(pt, sweepResult.sweepParam, spec)
      const tj  = getM('mosfetTj').get(pt, sweepResult.sweepParam, spec)
      const rip = getM('outputRipple').get(pt, sweepResult.sweepParam, spec)
      return [pv, (r.inductance * 1e6).toFixed(4), (r.capacitance * 1e6).toFixed(4),
        (r.dutyCycle * 100).toFixed(3), eff?.toFixed(3) ?? '', r.losses?.total?.toFixed(5) ?? '',
        pt.phaseMargin?.toFixed(2) ?? '', tj?.toFixed(2) ?? '', rip?.toFixed(4) ?? '',
        r.ccm_dcm_boundary?.toFixed(4) ?? ''].join(',') + '\n'
    })
    const blob = new Blob([header + rows.join('')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `sweep_${sweepResult.sweepParam}.csv`; a.click()
    URL.revokeObjectURL(url)
  }, [sweepResult, spec])

  // Closest sweep point to current operating value — hook must appear before early return
  const currentRowIdx = useMemo(() => {
    if (!sweepResult) return -1
    const cSI = getCurrentParamSI(spec, sweepResult.sweepParam)
    let best = 0, bestDist = Infinity
    sweepResult.points.forEach((pt, i) => { const d = Math.abs(pt.paramValue - cSI); if (d < bestDist) { best = i; bestDist = d } })
    return best
  }, [sweepResult, spec])

  if (!isSweepOpen) return null

  const pd        = getParamDef(sweepParam)
  const minSI     = parseFloat(minDisp) * pd.displayScale
  const maxSI     = parseFloat(maxDisp) * pd.displayScale
  const canRun    = !sweepLoading && !isNaN(minSI) && !isNaN(maxSI) && minSI < maxSI && steps >= 2
  const resultPd  = sweepResult ? getParamDef(sweepResult.sweepParam) : pd
  const curParamSI = getCurrentParamSI(spec, sweepResult?.sweepParam ?? sweepParam)
  const progressPct = sweepProgressTotal > 0 ? Math.round((sweepProgress / sweepProgressTotal) * 100) : 0

  const toggleMetric = (key: string) => setCheckedMetrics((prev) => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
  })

  return (
    <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget) setIsSweepOpen(false) }}>
      <div className={styles.panel}>

        <div className={styles.header}>
          <span className={styles.headerTitle}>Parameter Sweep</span>
          <span className={styles.headerSubtitle}>Read-only analysis — does not modify the design</span>
          <button className={styles.headerClose} onClick={() => setIsSweepOpen(false)}>×</button>
        </div>

        <div className={styles.body}>
          {/* Config row */}
          <div className={styles.configRow}>
            <div className={styles.configGroup}>
              <span className={styles.configLabel}>Sweep</span>
              <select className={styles.configSelect} value={sweepParam} disabled={sweepLoading}
                onChange={(e) => setSweepParam(e.target.value as SweepParam)}>
                {PARAM_DEFS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div className={styles.configGroup}>
              <span className={styles.configLabel}>Min</span>
              <input className={styles.configInput} value={minDisp} disabled={sweepLoading} onChange={(e) => setMinDisp(e.target.value)} />
              {pd.unit && <span className={styles.configUnit}>{pd.unit}</span>}
            </div>
            <div className={styles.configGroup}>
              <span className={styles.configLabel}>Max</span>
              <input className={styles.configInput} value={maxDisp} disabled={sweepLoading} onChange={(e) => setMaxDisp(e.target.value)} />
              {pd.unit && <span className={styles.configUnit}>{pd.unit}</span>}
            </div>
            <div className={styles.configGroup}>
              <span className={styles.configLabel}>Steps</span>
              <input className={`${styles.configInput} ${styles.configInputSmall}`} type="number"
                min={2} max={100} value={steps} disabled={sweepLoading}
                onChange={(e) => setSteps(Math.max(2, Math.min(100, parseInt(e.target.value) || 20)))} />
            </div>
            <div className={styles.spacer} />
            <button className={styles.runBtn} disabled={!canRun}
              onClick={() => canRun && requestSweep({ topology, baseSpec: spec, sweepParam, min: minSI, max: maxSI, steps })}>
              {sweepLoading ? '⏳ Computing…' : '▶ Run Sweep'}
            </button>
            <button className={styles.exportBtn} onClick={handleExport} disabled={!sweepResult}>↓ CSV</button>
          </div>

          {/* Progress bar */}
          {sweepLoading && (
            <div>
              <div className={styles.progressWrap}><div className={styles.progressBar} style={{ width: `${progressPct}%` }} /></div>
              <div className={styles.progressLabel}>{sweepProgress} / {sweepProgressTotal} steps</div>
            </div>
          )}

          {/* Metric checkboxes */}
          <div className={styles.metricsRow}>
            <span className={styles.metricsLabel}>Metrics</span>
            {METRICS.map((m) => (
              <label key={m.key} className={styles.metricCheck}>
                <input type="checkbox" checked={checkedMetrics.has(m.key)} onChange={() => toggleMetric(m.key)} />
                <span className={styles.metricDot} style={{ background: m.color }} />
                <span className={styles.metricCheckLabel}>{m.shortLabel}</span>
              </label>
            ))}
          </div>

          {/* Chart + legend + table */}
          {sweepResult && sweepResult.points.length > 0 ? (
            <>
              <SweepChart result={sweepResult} checkedMetrics={checkedMetrics} baseSpec={spec}
                currentParamSI={curParamSI} paramDef={resultPd} hoverIdx={hoverIdx} onHover={setHoverIdx} />

              <div className={styles.hoverLegend}>
                {hoverIdx != null ? (
                  <>
                    <span className={styles.hoverParamLabel}>
                      {(sweepResult.points[hoverIdx].paramValue / resultPd.displayScale).toFixed(resultPd.decimals)}
                      {resultPd.unit && ` ${resultPd.unit}`}
                    </span>
                    {METRICS.filter((m) => checkedMetrics.has(m.key)).map((m) => {
                      const v = m.get(sweepResult.points[hoverIdx!], sweepResult.sweepParam, spec)
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

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{resultPd.label}{resultPd.unit ? ` (${resultPd.unit})` : ''}</th>
                      <th>L (µH)</th><th>C (µF)</th><th>D (%)</th><th>η (%)</th>
                      <th>P_loss (W)</th><th>PM (°)</th><th>Tj (°C)</th><th>ΔV (mV)</th><th>I_crit (A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sweepResult.points.map((pt, i) => {
                      const r   = pt.result
                      const eff = METRICS.find((m) => m.key === 'efficiency')!.get(pt, sweepResult.sweepParam, spec)
                      const tj  = METRICS.find((m) => m.key === 'mosfetTj')!.get(pt, sweepResult.sweepParam, spec)
                      const rip = METRICS.find((m) => m.key === 'outputRipple')!.get(pt, sweepResult.sweepParam, spec)
                      const rowClass = (i === currentRowIdx || i === hoverIdx) ? styles.currentRow : ''
                      return (
                        <tr key={i} className={rowClass}
                          onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
                          <td>{(pt.paramValue / resultPd.displayScale).toFixed(resultPd.decimals)}</td>
                          {r ? <>{nd(r.inductance * 1e6, 3)}{nd(r.capacitance * 1e6, 3)}{nd(r.dutyCycle * 100, 2)}{nd(eff, 2)}{nd(r.losses?.total, 4)}{nd(pt.phaseMargin, 1)}{nd(tj, 1)}{nd(rip, 3)}{nd(r.ccm_dcm_boundary, 3)}</>
                            : Array.from({ length: 9 }, (_, ci) => <td key={ci}><span className={styles.nullVal}>—</span></td>)}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : !sweepLoading ? (
            <div className={styles.emptyState}>
              <span>No sweep results yet</span>
              <span className={styles.emptyHint}>Select a parameter, set the range, then click ▶ Run Sweep</span>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  )
}
