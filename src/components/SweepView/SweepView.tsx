// Parameter Sweep modal: config, run, multi-metric chart, hover legend, data table, CSV export.
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useDesignStore } from '../../store/design-store'
import type { SweepParam } from '../../store/design-store'
import { DEFAULT_CHECKED, getParamDef, getCurrentParamSI } from './sweepDefs'
import { SweepChart } from './SweepChart'
import { SweepTable } from './SweepTable'
import { SweepHoverLegend } from './SweepHoverLegend'
import { SweepConfigRow } from './SweepConfigRow'
import { SweepMetricsRow } from './SweepMetricsRow'
import { generateSweepCsv, downloadCsv } from './sweepExport'
import styles from './SweepView.module.css'

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

  const prevParamRef = useRef<SweepParam | null>(null)
  useEffect(() => {
    if (sweepParam === prevParamRef.current) return
    prevParamRef.current = sweepParam
    const [lo, hi] = getParamDef(sweepParam).defaultRange(spec)
    setMinDisp(String(lo)); setMaxDisp(String(hi))
  }, [sweepParam]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setHoverIdx(null) }, [sweepResult])

  useEffect(() => {
    if (!isSweepOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsSweepOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isSweepOpen, setIsSweepOpen])

  const handleExport = useCallback(() => {
    if (!sweepResult) return
    downloadCsv(generateSweepCsv(sweepResult, spec), `sweep_${sweepResult.sweepParam}.csv`)
  }, [sweepResult, spec])

  const currentRowIdx = useMemo(() => {
    if (!sweepResult) return -1
    const cSI = getCurrentParamSI(spec, sweepResult.sweepParam)
    let best = 0, bestDist = Infinity
    sweepResult.points.forEach((pt, i) => { const d = Math.abs(pt.paramValue - cSI); if (d < bestDist) { best = i; bestDist = d } })
    return best
  }, [sweepResult, spec])

  if (!isSweepOpen) return null

  const pd          = getParamDef(sweepParam)
  const minSI       = parseFloat(minDisp) * pd.displayScale
  const maxSI       = parseFloat(maxDisp) * pd.displayScale
  const canRun      = !sweepLoading && !isNaN(minSI) && !isNaN(maxSI) && minSI < maxSI && steps >= 2
  const resultPd    = sweepResult ? getParamDef(sweepResult.sweepParam) : pd
  const curParamSI  = getCurrentParamSI(spec, sweepResult?.sweepParam ?? sweepParam)
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
          <SweepConfigRow sweepParam={sweepParam} minDisp={minDisp} maxDisp={maxDisp} steps={steps} pd={pd}
            disabled={sweepLoading} canRun={canRun} hasResult={!!sweepResult}
            onParamChange={setSweepParam} onMinChange={setMinDisp} onMaxChange={setMaxDisp}
            onStepsChange={setSteps} onRun={() => canRun && requestSweep({ topology, baseSpec: spec, sweepParam, min: minSI, max: maxSI, steps })}
            onExport={handleExport} />
          {sweepLoading && (
            <div>
              <div className={styles.progressWrap}><div className={styles.progressBar} style={{ width: `${progressPct}%` }} /></div>
              <div className={styles.progressLabel}>{sweepProgress} / {sweepProgressTotal} steps</div>
            </div>
          )}
          <SweepMetricsRow checked={checkedMetrics} onToggle={toggleMetric} />
          {sweepResult && sweepResult.points.length > 0 ? (
            <>
              <SweepChart result={sweepResult} checkedMetrics={checkedMetrics} baseSpec={spec}
                currentParamSI={curParamSI} paramDef={resultPd} hoverIdx={hoverIdx} onHover={setHoverIdx} />
              <SweepHoverLegend hoverIdx={hoverIdx} result={sweepResult} resultPd={resultPd} checked={checkedMetrics} spec={spec} />
              <SweepTable result={sweepResult} resultPd={resultPd} spec={spec}
                currentRowIdx={currentRowIdx} hoverIdx={hoverIdx} onHover={setHoverIdx} />
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
