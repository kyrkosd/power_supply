// Monte Carlo results view: pass-rate banner, distribution histograms, and worst-case table.
import React, { useEffect, useRef } from 'react'
import { useDesignStore } from '../../store/design-store'
import type { MCDistribution } from '../../engine/monte-carlo'
import { drawHistogram, isValidDist } from './histogramDraw'
import type { HistConfig } from './histogramDraw'
import styles from './MonteCarloView.module.css'

// ── Histogram sub-component ────────────────────────────────────────────────────

/** Props for a single histogram panel. */
interface HistogramProps extends HistConfig { data: MCDistribution }

/** Renders a D3 histogram panel; shows a "no data" placeholder when empty. */
function Histogram(props: HistogramProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (svgRef.current && isValidDist(props.data)) drawHistogram(svgRef.current, props.data, props)
  }, [props])

  if (!isValidDist(props.data)) {
    return (
      <div className={styles.histEmpty}>
        {props.title}<br />
        <span style={{ fontSize: 11, marginTop: 6, display: 'block' }}>no data</span>
      </div>
    )
  }
  return (
    <div className={styles.histCell}>
      <svg ref={svgRef} width="100%" height="100%" style={{ minHeight: 180 }} preserveAspectRatio="xMidYMid meet" />
    </div>
  )
}

// ── Worst-case table row ───────────────────────────────────────────────────────

/** Props for one row in the worst-case summary table. */
interface RowProps {
  label: string; specLimit: number; mean: number; worst: number
  isUpperLimit: boolean; multiplier?: number; unit: string; decimals?: number
}

/** One row in the worst-case summary table; returns null when data is NaN. */
function TableRow({ label, specLimit, mean, worst, isUpperLimit, multiplier = 1, unit, decimals = 2 }: RowProps): React.ReactElement | null {
  if (Number.isNaN(mean)) return null
  const margin = isUpperLimit ? specLimit - worst : worst - specLimit
  const failed = margin < 0
  const fmt    = (v: number) => (v * multiplier).toFixed(decimals)
  return (
    <tr>
      <td>{label}</td>
      <td>{fmt(specLimit)}{unit}</td>
      <td>{fmt(mean)}{unit}</td>
      <td className={failed ? styles.fail : styles.pass}>{fmt(worst)}{unit}</td>
      <td className={failed ? styles.fail : ''}>{fmt(margin)}{unit}</td>
    </tr>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

/** Banner colour class based on pass rate. */
function bannerClass(passRate: number): string {
  if (passRate > 95) return styles.bannerGreen
  if (passRate >= 80) return styles.bannerAmber
  return styles.bannerRed
}

/** Monte Carlo results: pass-rate banner, five distribution histograms, worst-case table. */
export function MonteCarloView(): React.ReactElement {
  const mcResult = useDesignStore((s) => s.mcResult)
  const spec     = useDesignStore((s) => s.spec)

  if (!mcResult) {
    return <div className={styles.empty}>Click "Run Monte Carlo" in the input panel to start analysis.</div>
  }

  const passRate = mcResult.pass_rate * 100
  const passes   = Math.round(mcResult.pass_rate * mcResult.iterations)
  const m        = mcResult.metrics

  return (
    <div className={styles.container}>
      <div className={`${styles.banner} ${bannerClass(passRate)}`}>
        <div>
          <div className={styles.bannerRate}>{passRate.toFixed(1)} %</div>
          <div className={styles.bannerSub}>{passes} of {mcResult.iterations} iterations meet all design specs</div>
        </div>
      </div>

      <div className={styles.histGrid}>
        <Histogram title="Efficiency"   data={m.efficiency}        limit={spec.efficiency}    isUpperLimit={false} multiplier={100}  unit="%" />
        <Histogram title="Output Ripple" data={m.output_ripple}    limit={spec.voutRippleMax} isUpperLimit={true}  multiplier={1000} unit="mV" />
        <Histogram title="Phase Margin"  data={m.phase_margin}     limit={45}                 isUpperLimit={false} unit="°" />
        <Histogram title="MOSFET Tj"     data={m.tj_mosfet}        limit={125}                isUpperLimit={true}  unit="°C" />
        <Histogram title="Isat Margin"   data={m.saturation_margin} limit={20}                isUpperLimit={false} unit="%" />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Metric</th><th>Spec limit</th><th>Mean</th><th>Worst case</th><th>Margin</th></tr>
          </thead>
          <tbody>
            <TableRow label="Efficiency"    specLimit={spec.efficiency}    mean={m.efficiency.mean}    worst={m.efficiency.min}    isUpperLimit={false} multiplier={100}  unit="%" />
            <TableRow label="Output ripple" specLimit={spec.voutRippleMax} mean={m.output_ripple.mean} worst={m.output_ripple.max} isUpperLimit={true}  multiplier={1000} unit=" mV" decimals={1} />
            <TableRow label="Phase margin"  specLimit={45}                 mean={m.phase_margin.mean}  worst={m.phase_margin.min}  isUpperLimit={false} unit="°" decimals={1} />
            <TableRow label="MOSFET Tj"     specLimit={125}                mean={m.tj_mosfet.mean}     worst={m.tj_mosfet.max}     isUpperLimit={true}  unit=" °C" decimals={1} />
            <TableRow label="Isat margin"   specLimit={20}                 mean={m.saturation_margin.mean} worst={m.saturation_margin.min} isUpperLimit={false} unit=" %" decimals={1} />
          </tbody>
        </table>
      </div>
    </div>
  )
}
