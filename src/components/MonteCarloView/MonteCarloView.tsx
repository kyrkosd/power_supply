import React, { useEffect, useRef } from 'react'
import { select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import { max } from 'd3-array'
import { useDesignStore } from '../../store/design-store'
import type { MCDistribution } from '../../engine/monte-carlo'
import styles from './MonteCarloView.module.css'

// ── Histogram ─────────────────────────────────────────────────────────────────

interface HistogramProps {
  title: string
  data: MCDistribution
  limit: number
  /** true = bins above limit fail; false = bins below limit fail */
  isUpperLimit: boolean
  multiplier?: number
  unit?: string
}

function Histogram({ title, data, limit, isUpperLimit, multiplier = 1, unit = '' }: HistogramProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !data || data.values.length === 0 || Number.isNaN(data.mean)) return

    const W = 360
    const H = 200
    const m = { top: 28, right: 14, bottom: 36, left: 40 }
    const iW = W - m.left - m.right
    const iH = H - m.top - m.bottom

    const scaledMin   = data.min  * multiplier
    const scaledMax   = data.max  * multiplier
    const scaledLimit = limit     * multiplier
    const span = scaledMax - scaledMin || 1
    const pad  = span * 0.06

    const xDomain = [
      Math.min(scaledMin - pad, isUpperLimit ? scaledMin - pad : scaledLimit - pad),
      Math.max(scaledMax + pad, isUpperLimit ? scaledLimit + pad : scaledMax + pad),
    ]

    const x = scaleLinear().domain(xDomain).range([0, iW])
    const y = scaleLinear()
      .domain([0, max(data.histogram, d => d.count) ?? 10])
      .nice()
      .range([iH, 0])

    const root = select(svg)
    root.selectAll('*').remove()
    root.attr('viewBox', `0 0 ${W} ${H}`)

    const g = root.append('g').attr('transform', `translate(${m.left},${m.top})`)

    // Background
    g.append('rect')
      .attr('width', iW).attr('height', iH)
      .attr('fill', 'rgba(255,255,255,0.02)')

    // Bins
    const binW = iW / (data.histogram.length || 1)
    g.selectAll('rect.bin')
      .data(data.histogram)
      .enter()
      .append('rect')
      .attr('class', 'bin')
      .attr('x',      d => x(d.bin_center * multiplier) - binW / 2)
      .attr('y',      d => y(d.count))
      .attr('width',  Math.max(1, binW * 0.88))
      .attr('height', d => Math.max(0, iH - y(d.count)))
      .attr('fill',   d => {
        const fail = isUpperLimit ? d.bin_center > limit : d.bin_center < limit
        return fail ? '#f87171' : '#4ade80'
      })

    // Spec limit line
    const lx = x(scaledLimit)
    g.append('line')
      .attr('x1', lx).attr('x2', lx)
      .attr('y1', 0).attr('y2', iH)
      .attr('stroke', '#f87171').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,3')

    // Axes
    const xAxis = axisBottom(x).ticks(4).tickFormat(d => `${(+d).toFixed(1)}${unit}`)
    const yAxis = axisLeft(y).ticks(3)

    g.append('g')
      .attr('transform', `translate(0,${iH})`)
      .call(xAxis)
      .attr('color', 'var(--text-muted)')
      .selectAll('text').style('font-size', '9px')

    g.append('g')
      .call(yAxis)
      .attr('color', 'var(--text-muted)')
      .selectAll('text').style('font-size', '9px')

    // p5 / p95 ticks
    const p5x  = x(data.p5  * multiplier)
    const p95x = x(data.p95 * multiplier)
    for (const [px, label] of [[p5x, 'p5'], [p95x, 'p95']] as const) {
      g.append('line')
        .attr('x1', px).attr('x2', px)
        .attr('y1', iH).attr('y2', iH + 5)
        .attr('stroke', 'var(--text-muted)').attr('stroke-width', 1)
      g.append('text')
        .attr('x', px).attr('y', iH + 22)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-muted)')
        .style('font-size', '9px')
        .text(`${label}: ${(+((label === 'p5' ? data.p5 : data.p95) * multiplier)).toFixed(1)}${unit}`)
    }

    // Title
    root.append('text')
      .attr('x', m.left + iW / 2).attr('y', 16)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-secondary)')
      .style('font-size', '11px').style('font-weight', '600')
      .text(title)

  }, [data, limit, isUpperLimit, multiplier, unit, title])

  if (!data || data.values.length === 0 || Number.isNaN(data.mean)) {
    return (
      <div className={styles.histEmpty}>
        {title}
        <br />
        <span style={{ fontSize: 11, marginTop: 6, display: 'block' }}>no data</span>
      </div>
    )
  }

  return (
    <div className={styles.histCell}>
      <svg ref={svgRef} width="100%" height="100%"
        style={{ minHeight: 180 }} preserveAspectRatio="xMidYMid meet" />
    </div>
  )
}

// ── Worst-case table row ───────────────────────────────────────────────────────

interface RowProps {
  label: string
  specLimit: number
  mean: number
  worst: number
  isUpperLimit: boolean
  multiplier?: number
  unit: string
  decimals?: number
}

function TableRow({ label, specLimit, mean, worst, isUpperLimit, multiplier = 1, unit, decimals = 2 }: RowProps) {
  if (Number.isNaN(mean)) return null
  const margin = isUpperLimit ? specLimit - worst : worst - specLimit
  const failed = margin < 0
  const fmt = (v: number) => (v * multiplier).toFixed(decimals)
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

export function MonteCarloView(): React.ReactElement {
  const mcResult = useDesignStore((s) => s.mcResult)
  const spec     = useDesignStore((s) => s.spec)

  if (!mcResult) {
    return (
      <div className={styles.empty}>
        Click "Run Monte Carlo" in the input panel to start analysis.
      </div>
    )
  }

  const passRate = mcResult.pass_rate * 100
  const passes   = Math.round(mcResult.pass_rate * mcResult.iterations)
  const m        = mcResult.metrics

  const bannerMod =
    passRate > 95 ? styles.bannerGreen :
    passRate >= 80 ? styles.bannerAmber :
    styles.bannerRed

  return (
    <div className={styles.container}>
      {/* Pass-rate banner */}
      <div className={`${styles.banner} ${bannerMod}`}>
        <div>
          <div className={styles.bannerRate}>{passRate.toFixed(1)} %</div>
          <div className={styles.bannerSub}>
            {passes} of {mcResult.iterations} iterations meet all design specs
          </div>
        </div>
      </div>

      {/* histogram grid */}
      <div className={styles.histGrid}>
        <Histogram title="Efficiency"        data={m.efficiency}         limit={spec.efficiency}    isUpperLimit={false} multiplier={100}  unit="%" />
        <Histogram title="Output Ripple"     data={m.output_ripple}      limit={spec.voutRippleMax} isUpperLimit={true}  multiplier={1000} unit="mV" />
        <Histogram title="Phase Margin"      data={m.phase_margin}       limit={45}                 isUpperLimit={false} unit="°" />
        <Histogram title="MOSFET Tj"         data={m.tj_mosfet}          limit={125}                isUpperLimit={true}  unit="°C" />
        <Histogram title="Isat Margin"       data={m.saturation_margin}  limit={20}                 isUpperLimit={false} unit="%" />
      </div>

      {/* Worst-case summary table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Spec limit</th>
              <th>Mean</th>
              <th>Worst case</th>
              <th>Margin</th>
            </tr>
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
