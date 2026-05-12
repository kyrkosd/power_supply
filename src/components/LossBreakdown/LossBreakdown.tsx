// Loss breakdown stacked bar chart and efficiency-vs-load curve for the Losses tab.
import React, { useEffect, useMemo, useRef } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from 'recharts'
import { useDesignStore } from '../../store/design-store'
import { LOSS_SEGMENTS, computeBuckEfficiencyCurve, createEfficiencyCurve } from './lossBreakdownEngine'
import type { LossBreakdownValues } from './lossBreakdownEngine'
import { drawEfficiencyCurve } from './lossBreakdownDraw'
import styles from './LossBreakdown.module.css'

/** Formats watts to two decimal places. */
const fmtW   = (v: number) => `${v.toFixed(2)} W`
/** Formats an efficiency value (0–100) as an integer percentage. */
const fmtPct = (v: number) => `${v.toFixed(0)}%`

/** Renders W and % label inside a stacked bar segment when the segment is wide enough. */
function SegmentLabel(props: unknown): React.ReactElement | null {
  const { value, width, x, y, height } = props as { value: number; width: number; x: number; y: number; height: number; total: number }
  const total = (props as { total: number }).total
  if (!Number.isFinite(value) || value <= 0 || width < 54) return null
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <text x={x + width / 2} y={y + height / 2 + 4} fill="#ffffff" fontSize={10} textAnchor="middle">
      {`${value.toFixed(2)} W · ${pct.toFixed(0)}%`}
    </text>
  )
}

/** Summary row item: label + value pair. */
function SummaryItem({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className={styles.summaryItem}>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{value}</span>
    </div>
  )
}

/** Main loss breakdown visualization: stacked bar chart + efficiency-vs-load D3 curve. */
export function LossBreakdown(): React.ReactElement {
  const spec      = useDesignStore((s) => s.spec)
  const result    = useDesignStore((s) => s.result)
  const topology  = useDesignStore((s) => s.topology)
  const setActive = useDesignStore((s) => s.setActiveVizTab)
  const svgRef    = useRef<SVGSVGElement>(null)

  const hasLoss = useMemo(() =>
    !!result?.losses && LOSS_SEGMENTS.every(
      (seg) => typeof (result.losses as Record<string, unknown>)[seg.key] === 'number',
    ),
  [result])

  const lossData = useMemo(() => {
    if (!result || !hasLoss) return []
    return [{ name: 'losses', ...(result.losses as unknown as LossBreakdownValues) }]
  }, [result, hasLoss])

  const effCurve    = useMemo(() => result ? createEfficiencyCurve(spec, result, topology) : [],  [spec, result, topology])
  const effCurveN   = useMemo(() => {
    if (!result || topology !== 'buck') return []
    const N = (result as Record<string, unknown>).phases as number ?? 1
    return N > 1 ? computeBuckEfficiencyCurve(spec, result, N, spec.rectification === 'synchronous') : []
  }, [spec, result, topology])
  const effCurveAlt = useMemo(() => {
    if (!result || topology !== 'buck') return []
    const N = (result as Record<string, unknown>).phases as number ?? 1
    return computeBuckEfficiencyCurve(spec, result, N, spec.rectification !== 'synchronous')
  }, [spec, result, topology])
  const opPoint = useMemo(() => {
    if (!result || !effCurve.length) return null
    return { loadCurrent: spec.iout, efficiency: effCurve[effCurve.length - 1].efficiency }
  }, [spec, result, effCurve])

  useEffect(() => {
    if (!svgRef.current || !result || !effCurve.length) return
    drawEfficiencyCurve(svgRef.current, {
      primary: effCurve, nPhase: effCurveN, altRect: effCurveAlt,
      opPoint, isSync: spec.rectification === 'synchronous',
      nPhases: (result as Record<string, unknown>).phases as number ?? 1,
    })
  }, [effCurve, effCurveN, effCurveAlt, opPoint, result, spec.rectification])

  if (!result) return <div className={styles.placeholder}>Run simulation to compute loss breakdown.</div>
  if (!hasLoss) {
    return (
      <div className={styles.placeholder}>
        <div className={styles.fallbackMessage}>
          <div>No loss data is available for this topology yet.</div>
          <button type="button" className={styles.backButton} onClick={() => setActive('waveforms')}>
            Back to main deck
          </button>
        </div>
      </div>
    )
  }

  const totals = lossData[0]
  return (
    <div className={styles.wrapper}>
      <div className={styles.charts}>
        <section className={styles.chartCard}>
          <div className={styles.chartHeader}>Loss Breakdown</div>
          <div className={styles.barChartWrapper} data-export-id="loss-bar">
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={lossData} layout="vertical" margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
                <XAxis type="number" hide domain={[0, 'dataMax']} />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                  formatter={(v: number) => [`${v.toFixed(2)} W`, 'Loss']} />
                {LOSS_SEGMENTS.map((seg) => (
                  <Bar key={seg.key} dataKey={seg.key} stackId="loss" fill={seg.color} isAnimationActive={false}>
                    <LabelList dataKey={seg.key} position="center"
                      content={(p) => <SegmentLabel {...(p as object)} total={totals.total} />} />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.segmentLegend}>
            {LOSS_SEGMENTS.map((seg) => (
              <div key={seg.key} className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: seg.color }} />
                <span>{seg.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.chartCard}>
          <div className={styles.chartHeader}>Efficiency Curve</div>
          <svg ref={svgRef} className={styles.curveSvg} data-export-id="loss-eff" />
        </section>
      </div>

      <div className={styles.summaryRow}>
        <SummaryItem label="Total losses"     value={fmtW(totals.total)} />
        <SummaryItem label="Efficiency"       value={fmtPct(totals.efficiency * 100)} />
        <SummaryItem label="Power dissipated" value={fmtW(totals.total)} />
      </div>
      {result.current_sense && result.current_sense.rsense_power > 0 && (
        <div className={styles.summaryRow} style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
          <SummaryItem label="Rsense loss" value={fmtW(result.current_sense.rsense_power)} />
          <SummaryItem label="Rsense"      value={`${(result.current_sense.rsense * 1000).toFixed(2)} mΩ`} />
          <SummaryItem label="Package"     value={result.current_sense.rsense_package} />
        </div>
      )}
    </div>
  )
}
