import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useDesignStore } from '../../store/design-store'
import type { SweepParam, SweepResult, SweepPoint } from '../../store/design-store'
import type { DesignSpec } from '../../engine/types'
import styles from './SweepView.module.css'

// ── Metric definitions ────────────────────────────────────────────────────────

const THETA_JA = 40 // °C/W — typical SO-8 package junction-to-ambient

function effectiveSpec(base: DesignSpec, param: SweepParam, v: number): DesignSpec {
  switch (param) {
    case 'vin':          return { ...base, vinMin: v, vinMax: v }
    case 'vout':         return { ...base, vout: v }
    case 'iout':         return { ...base, iout: v }
    case 'fsw':          return { ...base, fsw: v }
    case 'ripple_ratio': return { ...base, rippleRatio: v }
    case 'ambient_temp': return { ...base, ambientTemp: v }
  }
}

interface MetricDef {
  key:        string
  label:      string
  shortLabel: string
  unit:       string
  color:      string
  get: (pt: SweepPoint, param: SweepParam, base: DesignSpec) => number | null
}

const METRICS: MetricDef[] = [
  {
    key: 'inductance', label: 'Inductance', shortLabel: 'L', unit: 'µH', color: '#32c9e6',
    get: (pt) => pt.result ? pt.result.inductance * 1e6 : null,
  },
  {
    key: 'capacitance', label: 'Output Cap', shortLabel: 'C', unit: 'µF', color: '#22c55e',
    get: (pt) => pt.result ? pt.result.capacitance * 1e6 : null,
  },
  {
    key: 'dutyCycle', label: 'Duty Cycle', shortLabel: 'D', unit: '%', color: '#f59e0b',
    get: (pt) => pt.result ? pt.result.dutyCycle * 100 : null,
  },
  {
    key: 'efficiency', label: 'Efficiency', shortLabel: 'η', unit: '%', color: '#a78bfa',
    get: (pt) => pt.result?.efficiency != null ? pt.result.efficiency * 100 : null,
  },
  {
    key: 'losses', label: 'Total Losses', shortLabel: 'P_loss', unit: 'W', color: '#f97316',
    get: (pt) => pt.result?.losses?.total ?? null,
  },
  {
    key: 'phaseMargin', label: 'Phase Margin', shortLabel: 'PM', unit: '°', color: '#38bdf8',
    get: (pt) => pt.phaseMargin,
  },
  {
    key: 'mosfetTj', label: 'MOSFET Tj', shortLabel: 'Tj', unit: '°C', color: '#ef4444',
    get: (pt, param, base) => {
      if (!pt.result) return null
      const spec = effectiveSpec(base, param, pt.paramValue)
      const loss = (pt.result.losses?.mosfet_conduction ?? 0) + (pt.result.losses?.mosfet_switching ?? 0)
      return spec.ambientTemp + loss * THETA_JA
    },
  },
  {
    key: 'outputRipple', label: 'Output Ripple', shortLabel: 'ΔV', unit: 'mV', color: '#84cc16',
    get: (pt, param, base) => {
      if (!pt.result || pt.result.capacitance <= 0) return null
      const spec = effectiveSpec(base, param, pt.paramValue)
      const dIL = spec.rippleRatio * spec.iout
      return (dIL / (8 * spec.fsw * pt.result.capacitance)) * 1000
    },
  },
  {
    key: 'ccmBoundary', label: 'CCM Boundary', shortLabel: 'I_crit', unit: 'A', color: '#e879f9',
    get: (pt) => pt.result?.ccm_dcm_boundary ?? null,
  },
]

const DEFAULT_CHECKED = new Set(['inductance', 'capacitance', 'dutyCycle', 'efficiency', 'losses'])

// ── Param definitions ─────────────────────────────────────────────────────────

interface ParamDef {
  key:          SweepParam
  label:        string
  unit:         string
  displayScale: number   // SI_value = display_value * displayScale
  decimals:     number   // input decimal places
  defaultRange: (spec: DesignSpec) => [number, number]  // display units
}

const PARAM_DEFS: ParamDef[] = [
  {
    key: 'vin', label: 'Input Voltage (Vin)', unit: 'V', displayScale: 1, decimals: 1,
    defaultRange: (s) => [+(s.vinMin * 0.5).toFixed(1), +(s.vinMax * 2.0).toFixed(1)],
  },
  {
    key: 'vout', label: 'Output Voltage (Vout)', unit: 'V', displayScale: 1, decimals: 2,
    defaultRange: (s) => [+(s.vout * 0.5).toFixed(2), +(s.vout * 2.0).toFixed(2)],
  },
  {
    key: 'iout', label: 'Output Current (Iout)', unit: 'A', displayScale: 1, decimals: 2,
    defaultRange: (s) => [+(s.iout * 0.2).toFixed(2), +(s.iout * 3.0).toFixed(2)],
  },
  {
    key: 'fsw', label: 'Switching Freq (fsw)', unit: 'kHz', displayScale: 1000, decimals: 0,
    defaultRange: (s) => [Math.round(s.fsw / 1000 * 0.2), Math.round(s.fsw / 1000 * 4)],
  },
  {
    key: 'ripple_ratio', label: 'Ripple Ratio (ΔIL/Iout)', unit: '', displayScale: 1, decimals: 2,
    defaultRange: () => [0.05, 0.80],
  },
  {
    key: 'ambient_temp', label: 'Ambient Temp (Ta)', unit: '°C', displayScale: 1, decimals: 0,
    defaultRange: () => [-20, 85],
  },
]

function getParamDef(key: SweepParam): ParamDef {
  return PARAM_DEFS.find(p => p.key === key)!
}

function getCurrentParamSI(spec: DesignSpec, param: SweepParam): number {
  switch (param) {
    case 'vin':          return (spec.vinMin + spec.vinMax) / 2
    case 'vout':         return spec.vout
    case 'iout':         return spec.iout
    case 'fsw':          return spec.fsw
    case 'ripple_ratio': return spec.rippleRatio
    case 'ambient_temp': return spec.ambientTemp
  }
}

// ── Chart sub-component ───────────────────────────────────────────────────────

const CW = 820, CH = 210
const ML = 38, MR = 14, MT = 14, MB = 34
const PW = CW - ML - MR
const PH = CH - MT - MB

interface ChartProps {
  result:            SweepResult
  checkedMetrics:    Set<string>
  baseSpec:          DesignSpec
  currentParamSI:    number
  paramDef:          ParamDef
  hoverIdx:          number | null
  onHover:           (idx: number | null) => void
}

function SweepChart({ result, checkedMetrics, baseSpec, currentParamSI, paramDef, hoverIdx, onHover }: ChartProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)

  const pts = result.points
  const activeMetrics = METRICS.filter(m => checkedMetrics.has(m.key))

  // X values in display units
  const xDisp = pts.map(pt => pt.paramValue / paramDef.displayScale)
  const xMin  = xDisp[0] ?? 0
  const xMax  = xDisp[xDisp.length - 1] ?? 1
  const xRng  = xMax - xMin || 1

  const xScale = (v: number) => ML + ((v - xMin) / xRng) * PW

  // Current param position
  const currentDispVal = currentParamSI / paramDef.displayScale
  const currentX = xScale(currentDispVal)
  const showCurrentLine = currentDispVal >= xMin && currentDispVal <= xMax

  // Per-metric normalized data (0–1 for chart height)
  const seriesData = useMemo(() =>
    activeMetrics.map(m => {
      const vals = pts.map(pt => {
        const v = m.get(pt, result.sweepParam, baseSpec)
        return (v != null && isFinite(v)) ? v : null
      })
      const valid = vals.filter((v): v is number => v != null)
      const lo = valid.length ? Math.min(...valid) : 0
      const hi = valid.length ? Math.max(...valid) : 1
      const rng = hi - lo || 1
      const norm = vals.map(v => v != null ? (v - lo) / rng : null)
      return { metric: m, vals, norm, lo, hi }
    }), [pts, activeMetrics, baseSpec, result.sweepParam])

  // Y scale: norm 0=bottom, 1=top
  const yScale = (n: number) => MT + PH - n * PH

  // Build polyline point strings, splitting on null values
  function buildSegments(norm: (number | null)[], xArr: number[]): string[] {
    const segs: string[] = []
    let cur: string[] = []
    for (let i = 0; i < norm.length; i++) {
      const n = norm[i]
      if (n != null) {
        cur.push(`${xScale(xArr[i]).toFixed(1)},${yScale(n).toFixed(1)}`)
      } else {
        if (cur.length >= 2) segs.push(cur.join(' '))
        cur = []
      }
    }
    if (cur.length >= 2) segs.push(cur.join(' '))
    return segs
  }

  // X-axis ticks (5)
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map(t => xMin + t * xRng)

  function fmtTick(v: number): string {
    if (Math.abs(v) >= 10000) return `${(v / 1000).toFixed(0)}k`
    if (Math.abs(v) >= 100)   return v.toFixed(0)
    if (Math.abs(v) >= 10)    return v.toFixed(1)
    return v.toFixed(2)
  }

  // Mouse hover
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const svgX = ((e.clientX - rect.left) / rect.width) * CW
    const frac = Math.max(0, Math.min(1, (svgX - ML) / PW))
    onHover(Math.round(frac * (pts.length - 1)))
  }, [pts.length, onHover])

  const hX = hoverIdx != null ? xScale(xDisp[hoverIdx]) : null

  return (
    <div className={styles.chartOuter}>
      <svg ref={svgRef} viewBox={`0 0 ${CW} ${CH}`} className={styles.chartSvg} preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct}
            x1={ML} y1={yScale(pct)} x2={ML + PW} y2={yScale(pct)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}

        {/* Axes */}
        <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

        {/* Y-axis labels */}
        {['100%', '75%', '50%', '25%', '0%'].map((label, i) => (
          <text key={label} x={ML - 5} y={yScale(1 - i * 0.25) + 4}
            fontSize={9} fill="rgba(148,163,184,0.55)" textAnchor="end">{label}</text>
        ))}

        {/* X-axis tick labels */}
        {xTicks.map((v, i) => (
          <text key={i} x={xScale(v)} y={MT + PH + 13}
            fontSize={9} fill="rgba(148,163,184,0.65)" textAnchor="middle">
            {fmtTick(v)}
          </text>
        ))}
        <text x={ML + PW / 2} y={CH - 3} fontSize={9} fill="rgba(148,163,184,0.45)" textAnchor="middle">
          {paramDef.label}{paramDef.unit ? ` (${paramDef.unit})` : ''}
        </text>

        {/* Current operating point */}
        {showCurrentLine && (
          <>
            <line x1={currentX} y1={MT} x2={currentX} y2={MT + PH}
              stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="5,3" />
            <text x={currentX + 3} y={MT + 10} fontSize={8} fill="rgba(255,255,255,0.4)">
              current
            </text>
          </>
        )}

        {/* Data series */}
        {seriesData.map(({ metric, norm }) =>
          buildSegments(norm, xDisp).map((pts, si) => (
            <polyline key={`${metric.key}-${si}`} points={pts}
              fill="none" stroke={metric.color} strokeWidth={1.8}
              strokeLinejoin="round" opacity={0.9} />
          ))
        )}

        {/* Hover elements */}
        {hX != null && (
          <line x1={hX} y1={MT} x2={hX} y2={MT + PH}
            stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
        )}
        {hoverIdx != null && seriesData.map(({ metric, norm }) => {
          const n = norm[hoverIdx]
          return n != null ? (
            <circle key={metric.key} cx={hX!} cy={yScale(n)} r={3.5}
              fill={metric.color} stroke="#141624" strokeWidth={1.5} />
          ) : null
        })}

        {/* Transparent hit area */}
        <rect x={ML} y={MT} width={PW} height={PH} fill="transparent"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => onHover(null)} />
      </svg>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SweepView(): React.ReactElement | null {
  const isSweepOpen        = useDesignStore(s => s.isSweepOpen)
  const setIsSweepOpen     = useDesignStore(s => s.setIsSweepOpen)
  const sweepLoading       = useDesignStore(s => s.sweepLoading)
  const sweepProgress      = useDesignStore(s => s.sweepProgress)
  const sweepProgressTotal = useDesignStore(s => s.sweepProgressTotal)
  const sweepResult        = useDesignStore(s => s.sweepResult)
  const requestSweep       = useDesignStore(s => s.requestSweep)
  const topology           = useDesignStore(s => s.topology)
  const spec               = useDesignStore(s => s.spec)

  // Local config state (persists across open/close cycles)
  const [sweepParam,    setSweepParam]    = useState<SweepParam>('vin')
  const [minDisp,       setMinDisp]       = useState('')
  const [maxDisp,       setMaxDisp]       = useState('')
  const [steps,         setSteps]         = useState(20)
  const [checkedMetrics, setCheckedMetrics] = useState<Set<string>>(new Set(DEFAULT_CHECKED))
  const [hoverIdx,      setHoverIdx]      = useState<number | null>(null)

  // Auto-populate range when param changes
  const prevParamRef = useRef<SweepParam | null>(null)
  useEffect(() => {
    if (sweepParam === prevParamRef.current) return
    prevParamRef.current = sweepParam
    const pd = getParamDef(sweepParam)
    const [lo, hi] = pd.defaultRange(spec)
    setMinDisp(String(lo))
    setMaxDisp(String(hi))
  }, [sweepParam]) // intentionally exclude spec — only update on param change

  // Reset hover when result changes
  useEffect(() => { setHoverIdx(null) }, [sweepResult])

  // Escape key closes
  useEffect(() => {
    if (!isSweepOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsSweepOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isSweepOpen, setIsSweepOpen])

  // CSV export — useCallback MUST be before the early return (Rules of Hooks)
  const handleExport = useCallback(() => {
    if (!sweepResult) return
    const resPd = getParamDef(sweepResult.sweepParam)
    const header = `${resPd.label}${resPd.unit ? ` (${resPd.unit})` : ''},L (µH),C (µF),D (%),η (%),P_loss (W),PM (°),Tj (°C),Ripple (mV),I_crit (A)\n`
    const rows = sweepResult.points.map(pt => {
      const pv = (pt.paramValue / resPd.displayScale).toFixed(resPd.decimals)
      const r = pt.result
      if (!r) return `${pv},,,,,,,,\n`
      const eff = METRICS.find(m => m.key === 'efficiency')!.get(pt, sweepResult.sweepParam, spec)
      const tj  = METRICS.find(m => m.key === 'mosfetTj')!.get(pt, sweepResult.sweepParam, spec)
      const rip = METRICS.find(m => m.key === 'outputRipple')!.get(pt, sweepResult.sweepParam, spec)
      return [
        pv,
        (r.inductance * 1e6).toFixed(4),
        (r.capacitance * 1e6).toFixed(4),
        (r.dutyCycle * 100).toFixed(3),
        eff != null ? eff.toFixed(3) : '',
        r.losses?.total?.toFixed(5) ?? '',
        pt.phaseMargin != null ? pt.phaseMargin.toFixed(2) : '',
        tj  != null ? tj.toFixed(2)  : '',
        rip != null ? rip.toFixed(4) : '',
        r.ccm_dcm_boundary != null ? r.ccm_dcm_boundary.toFixed(4) : '',
      ].join(',') + '\n'
    })
    const csv = header + rows.join('')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sweep_${sweepResult.sweepParam}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [sweepResult, spec])

  // Table row for current operating point — useMemo MUST be before the early return (Rules of Hooks)
  const currentRowIdx = useMemo(() => {
    if (!sweepResult) return -1
    const cSI = getCurrentParamSI(spec, sweepResult.sweepParam)
    let best = 0, bestDist = Infinity
    sweepResult.points.forEach((pt, i) => {
      const d = Math.abs(pt.paramValue - cSI)
      if (d < bestDist) { best = i; bestDist = d }
    })
    return best
  }, [sweepResult, spec])

  // All hooks must appear before this early return
  if (!isSweepOpen) return null

  const pd = getParamDef(sweepParam)

  const minSI = parseFloat(minDisp) * pd.displayScale
  const maxSI = parseFloat(maxDisp) * pd.displayScale
  const canRun = !sweepLoading && !isNaN(minSI) && !isNaN(maxSI) && minSI < maxSI && steps >= 2

  const handleRun = () => {
    if (!canRun) return
    requestSweep({ topology, baseSpec: spec, sweepParam, min: minSI, max: maxSI, steps })
  }

  const toggleMetric = (key: string) => {
    setCheckedMetrics(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const progressPct = sweepProgressTotal > 0
    ? Math.round((sweepProgress / sweepProgressTotal) * 100)
    : 0

  const currentParamSI = getCurrentParamSI(spec, sweepResult?.sweepParam ?? sweepParam)

  const resultPd = sweepResult ? getParamDef(sweepResult.sweepParam) : pd

  return (
    <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget) setIsSweepOpen(false) }}>
      <div className={styles.panel}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <span className={styles.headerTitle}>Parameter Sweep</span>
          <span className={styles.headerSubtitle}>
            Read-only analysis — does not modify the design
          </span>
          <button className={styles.headerClose} onClick={() => setIsSweepOpen(false)}>×</button>
        </div>

        <div className={styles.body}>

          {/* ── Config row ── */}
          <div className={styles.configRow}>
            <div className={styles.configGroup}>
              <span className={styles.configLabel}>Sweep</span>
              <select
                className={styles.configSelect}
                value={sweepParam}
                onChange={e => setSweepParam(e.target.value as SweepParam)}
                disabled={sweepLoading}
              >
                {PARAM_DEFS.map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.configGroup}>
              <span className={styles.configLabel}>Min</span>
              <input
                className={styles.configInput}
                value={minDisp}
                onChange={e => setMinDisp(e.target.value)}
                disabled={sweepLoading}
              />
              {pd.unit && <span className={styles.configUnit}>{pd.unit}</span>}
            </div>

            <div className={styles.configGroup}>
              <span className={styles.configLabel}>Max</span>
              <input
                className={styles.configInput}
                value={maxDisp}
                onChange={e => setMaxDisp(e.target.value)}
                disabled={sweepLoading}
              />
              {pd.unit && <span className={styles.configUnit}>{pd.unit}</span>}
            </div>

            <div className={styles.configGroup}>
              <span className={styles.configLabel}>Steps</span>
              <input
                className={`${styles.configInput} ${styles.configInputSmall}`}
                type="number"
                min={2}
                max={100}
                value={steps}
                onChange={e => setSteps(Math.max(2, Math.min(100, parseInt(e.target.value) || 20)))}
                disabled={sweepLoading}
              />
            </div>

            <div className={styles.spacer} />

            <button className={styles.runBtn} onClick={handleRun} disabled={!canRun}>
              {sweepLoading ? '⏳ Computing…' : '▶ Run Sweep'}
            </button>
            <button className={styles.exportBtn} onClick={handleExport} disabled={!sweepResult}>
              ↓ CSV
            </button>
          </div>

          {/* ── Progress bar ── */}
          {sweepLoading && (
            <div>
              <div className={styles.progressWrap}>
                <div className={styles.progressBar} style={{ width: `${progressPct}%` }} />
              </div>
              <div className={styles.progressLabel}>{sweepProgress} / {sweepProgressTotal} steps</div>
            </div>
          )}

          {/* ── Metric checkboxes ── */}
          <div className={styles.metricsRow}>
            <span className={styles.metricsLabel}>Metrics</span>
            {METRICS.map(m => (
              <label key={m.key} className={styles.metricCheck}>
                <input
                  type="checkbox"
                  checked={checkedMetrics.has(m.key)}
                  onChange={() => toggleMetric(m.key)}
                />
                <span className={styles.metricDot} style={{ background: m.color }} />
                <span className={styles.metricCheckLabel}>{m.shortLabel}</span>
              </label>
            ))}
          </div>

          {/* ── Chart + hover legend ── */}
          {sweepResult && sweepResult.points.length > 0 ? (
            <>
              <SweepChart
                result={sweepResult}
                checkedMetrics={checkedMetrics}
                baseSpec={spec}
                currentParamSI={currentParamSI}
                paramDef={resultPd}
                hoverIdx={hoverIdx}
                onHover={setHoverIdx}
              />

              {/* Hover legend row */}
              <div className={styles.hoverLegend}>
                {hoverIdx != null ? (
                  <>
                    <span className={styles.hoverParamLabel}>
                      {(sweepResult.points[hoverIdx].paramValue / resultPd.displayScale).toFixed(resultPd.decimals)}
                      {resultPd.unit && ` ${resultPd.unit}`}
                    </span>
                    {METRICS.filter(m => checkedMetrics.has(m.key)).map(m => {
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
                  <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)' }}>
                    Hover the chart to inspect values
                  </span>
                )}
              </div>

              {/* ── Data table ── */}
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{resultPd.label}{resultPd.unit ? ` (${resultPd.unit})` : ''}</th>
                      <th>L (µH)</th>
                      <th>C (µF)</th>
                      <th>D (%)</th>
                      <th>η (%)</th>
                      <th>P_loss (W)</th>
                      <th>PM (°)</th>
                      <th>Tj (°C)</th>
                      <th>ΔV (mV)</th>
                      <th>I_crit (A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sweepResult.points.map((pt, i) => {
                      const r = pt.result
                      const eff = METRICS.find(m => m.key === 'efficiency')!.get(pt, sweepResult.sweepParam, spec)
                      const tj  = METRICS.find(m => m.key === 'mosfetTj')!.get(pt, sweepResult.sweepParam, spec)
                      const rip = METRICS.find(m => m.key === 'outputRipple')!.get(pt, sweepResult.sweepParam, spec)
                      const isCurrentRow = i === currentRowIdx
                      const isHoverRow   = i === hoverIdx
                      const rowClass = isCurrentRow ? styles.currentRow : isHoverRow ? styles.currentRow : ''
                      return (
                        <tr key={i} className={rowClass} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
                          <td>{(pt.paramValue / resultPd.displayScale).toFixed(resultPd.decimals)}</td>
                          {r ? (
                            <>
                              <td>{(r.inductance * 1e6).toFixed(3)}</td>
                              <td>{(r.capacitance * 1e6).toFixed(3)}</td>
                              <td>{(r.dutyCycle * 100).toFixed(2)}</td>
                              <td>{eff != null ? eff.toFixed(2) : <span className={styles.nullVal}>—</span>}</td>
                              <td>{r.losses?.total != null ? r.losses.total.toFixed(4) : <span className={styles.nullVal}>—</span>}</td>
                              <td>{pt.phaseMargin != null ? pt.phaseMargin.toFixed(1) : <span className={styles.nullVal}>—</span>}</td>
                              <td>{tj  != null ? tj.toFixed(1)  : <span className={styles.nullVal}>—</span>}</td>
                              <td>{rip != null ? rip.toFixed(3) : <span className={styles.nullVal}>—</span>}</td>
                              <td>{r.ccm_dcm_boundary != null ? r.ccm_dcm_boundary.toFixed(3) : <span className={styles.nullVal}>—</span>}</td>
                            </>
                          ) : (
                            Array.from({ length: 9 }, (_, ci) => (
                              <td key={ci}><span className={styles.nullVal}>—</span></td>
                            ))
                          )}
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
              <span className={styles.emptyHint}>
                Select a parameter, set the range, then click ▶ Run Sweep
              </span>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  )
}
