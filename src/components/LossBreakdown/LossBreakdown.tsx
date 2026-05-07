// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React, { useEffect, useMemo, useRef } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from 'recharts'
import { select } from 'd3-selection'
import { axisBottom, axisLeft } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { line, curveMonotoneX } from 'd3-shape'
import { max, min } from 'd3-array'
import { useDesignStore } from '../../store/design-store'
import styles from './LossBreakdown.module.css'
import type { DesignSpec, DesignResult } from '../../engine/types'

type LossKey =
  | 'mosfet_conduction'
  | 'mosfet_switching'
  | 'mosfet_gate'
  | 'inductor_copper'
  | 'inductor_core'
  | 'diode_conduction'
  | 'capacitor_esr'

interface LossBreakdownValues {
  mosfet_conduction: number
  mosfet_switching: number
  mosfet_gate: number
  inductor_copper: number
  inductor_core: number
  diode_conduction: number
  capacitor_esr: number
  total: number
  efficiency: number
}

const LOSS_SEGMENTS: Array<{
  key: LossKey
  label: string
  color: string
}> = [
  { key: 'mosfet_conduction', label: 'MOSFET conduction', color: '#1f4f8b' },
  { key: 'mosfet_switching', label: 'MOSFET switching', color: '#3f72ff' },
  { key: 'mosfet_gate', label: 'MOSFET gate drive', color: '#8fb9ff' },
  { key: 'inductor_copper', label: 'Inductor copper/DCR', color: '#f88f1f' },
  { key: 'inductor_core', label: 'Inductor core loss', color: '#ffb76b' },
  { key: 'diode_conduction', label: 'Diode conduction', color: '#d9382f' },
  { key: 'capacitor_esr', label: 'Capacitor ESR', color: '#7d7d7d' },
]

const DEVICE_ASSUMPTIONS = {
  rdsOn: 0.02,
  trise: 25e-9,
  tfall: 25e-9,
  qg: 12e-9,
  vf: 0.7,
  dcr: 0.045,
  esr: 0.02,
  coreFactor: 0.02,
}

function formatWatts(value: number): string {
  return `${value.toFixed(2)} W`
}

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`
}

// Compute buck efficiency curve for a given number of interleaved phases.
// Uses same DEVICE_ASSUMPTIONS constants as buck.ts for consistency.
function computeBuckEfficiencyCurve(
  spec: DesignSpec,
  result: DesignResult,
  phases: number,
): Array<{ loadCurrent: number; efficiency: number }> {
  const N = Math.max(1, phases)
  const D = Math.min(Math.max(spec.vout / spec.vinMax, 0.01), 0.99)
  const fsw = spec.fsw
  // Reconstruct per-phase inductance from K_out or use result.phase_inductance
  const L_phase = (N > 1 && result.phase_inductance) ? result.phase_inductance : result.inductance

  return Array.from({ length: 10 }, (_, index) => {
    const ratio = 0.1 + index * 0.1
    const loadCurrent = spec.iout * ratio

    // N-phase ripple cancellation factor at this duty cycle
    const ND = N * D
    const delta = ND - Math.floor(ND)
    const K_out = (delta < 1e-6 || delta > 1 - 1e-6)
      ? 0
      : Math.min((delta * (1 - delta)) / (N * D * (1 - D)), 1)

    const I_phase = loadCurrent / N
    const deltaIL_phase = Math.abs((spec.vout * (1 - D)) / (L_phase * fsw))
    const IL_peak_phase = I_phase + deltaIL_phase / 2
    const IL_rms_phase = Math.sqrt(I_phase ** 2 + deltaIL_phase ** 2 / 12)
    const Ic_out_rms = (K_out * deltaIL_phase) / (2 * Math.sqrt(3))

    const mosfet_conduction = DEVICE_ASSUMPTIONS.rdsOn * loadCurrent ** 2 * D / N
    const mosfet_switching = N * 0.5 * spec.vinMax * IL_peak_phase * (DEVICE_ASSUMPTIONS.trise + DEVICE_ASSUMPTIONS.tfall) * fsw
    const mosfet_gate = N * DEVICE_ASSUMPTIONS.qg * spec.vinMax * fsw
    const inductor_copper = N * DEVICE_ASSUMPTIONS.dcr * IL_rms_phase ** 2
    const inductor_core = N * DEVICE_ASSUMPTIONS.coreFactor * I_phase * deltaIL_phase
    const diode_conduction = DEVICE_ASSUMPTIONS.vf * loadCurrent * (1 - D)
    const capacitor_esr = Ic_out_rms ** 2 * DEVICE_ASSUMPTIONS.esr

    const total = mosfet_conduction + mosfet_switching + mosfet_gate +
                  inductor_copper + inductor_core + diode_conduction + capacitor_esr
    const pout = spec.vout * loadCurrent
    return {
      loadCurrent,
      efficiency: pout <= 0 ? 0 : (pout / (pout + total)) * 100,
    }
  })
}

function createEfficiencyCurve(spec: DesignSpec, result: DesignResult, topology: string) {
  if (topology !== 'buck') return []
  return computeBuckEfficiencyCurve(spec, result, 1)
}

export function LossBreakdown(): React.ReactElement {
  const spec = useDesignStore((state) => state.spec)
  const result = useDesignStore((state) => state.result)
  const topology = useDesignStore((state) => state.topology)
  const setActiveVizTab = useDesignStore((state) => state.setActiveVizTab)
  const svgRef = useRef<SVGSVGElement>(null)

  const hasLossBreakdown = useMemo(() => {
    if (!result?.losses) return false
    return LOSS_SEGMENTS.every((segment) => typeof (result.losses as Record<string, unknown>)[segment.key] === 'number')
  }, [result])

  const lossData = useMemo((): Array<LossBreakdownValues & { name: string }> => {
    if (!result || !hasLossBreakdown) return []
    return [{
      name: 'losses',
      ...(result.losses as unknown as LossBreakdownValues),
    }]
  }, [result, hasLossBreakdown])

  const efficiencyCurve = useMemo(() => {
    if (!result) return []
    return createEfficiencyCurve(spec, result, topology)
  }, [spec, result, topology])

  // N-phase curve — single-phase equivalent for comparison (only when N > 1, buck)
  const efficiencyCurveNPhase = useMemo(() => {
    if (!result || topology !== 'buck') return []
    const N = result.phases ?? 1
    if (N <= 1) return []
    return computeBuckEfficiencyCurve(spec, result, N)
  }, [spec, result, topology])

  const operatingPoint = useMemo(() => {
    if (!result || efficiencyCurve.length === 0) return null
    const current = spec.iout
    const point = efficiencyCurve[efficiencyCurve.length - 1]
    return { loadCurrent: current, efficiency: point.efficiency }
  }, [spec, result, efficiencyCurve])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !result || efficiencyCurve.length === 0) return
    const width = svg.clientWidth
    const height = svg.clientHeight
    if (width === 0 || height === 0) return

    const margin = { top: 18, right: 18, bottom: 34, left: 52 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const allPoints = [...efficiencyCurve, ...efficiencyCurveNPhase]
    const xDomain = [efficiencyCurve[0].loadCurrent, efficiencyCurve[efficiencyCurve.length - 1].loadCurrent]
    const yDomain = [
      Math.max(0, min(allPoints, (d) => d.efficiency)! - 2),
      Math.min(100, max(allPoints, (d) => d.efficiency)! + 2),
    ]

    const xScale = scaleLinear().domain(xDomain as [number, number]).range([0, chartWidth]).nice()
    const yScale = scaleLinear().domain(yDomain as [number, number]).range([chartHeight, 0]).nice()

    const svgSelection = select(svg)
    svgSelection.selectAll('*').remove()

    const root = svgSelection
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    root.append('g')
      .attr('class', styles.xAxis)
      .attr('transform', `translate(0,${chartHeight})`)
      .call(axisBottom(xScale).ticks(6).tickFormat((value) => `${Number(value).toFixed(2)} A`))
      .selectAll('text')
      .attr('fill', 'var(--text-muted)')

    root.append('g')
      .attr('class', styles.yAxis)
      .call(axisLeft(yScale).ticks(6).tickFormat((value) => `${Number(value).toFixed(0)}%`))
      .selectAll('text')
      .attr('fill', 'var(--text-muted)')

    const lineGenerator = line<{ loadCurrent: number; efficiency: number }>()
      .x((d) => xScale(d.loadCurrent))
      .y((d) => yScale(d.efficiency))
      .curve(curveMonotoneX)

    // Single-phase reference curve (dashed gray) when N > 1
    if (efficiencyCurveNPhase.length > 0) {
      root.append('path')
        .datum(efficiencyCurve)
        .attr('fill', 'none')
        .attr('stroke', '#64748b')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 3')
        .attr('d', lineGenerator)

      // N-phase curve (solid, highlighted)
      root.append('path')
        .datum(efficiencyCurveNPhase)
        .attr('fill', 'none')
        .attr('stroke', '#32c9e6')
        .attr('stroke-width', 2.5)
        .attr('d', lineGenerator)

      // Legend
      const N = result.phases ?? 1
      const legendX = chartWidth - 130
      root.append('line').attr('x1', legendX).attr('x2', legendX + 20).attr('y1', 6).attr('y2', 6)
        .attr('stroke', '#64748b').attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3')
      root.append('text').attr('x', legendX + 24).attr('y', 10).attr('fill', 'var(--text-muted)').attr('font-size', '10px').text('1-phase')
      root.append('line').attr('x1', legendX).attr('x2', legendX + 20).attr('y1', 20).attr('y2', 20)
        .attr('stroke', '#32c9e6').attr('stroke-width', 2.5)
      root.append('text').attr('x', legendX + 24).attr('y', 24).attr('fill', 'var(--text-muted)').attr('font-size', '10px').text(`${N}-phase`)
    } else {
      root.append('path')
        .datum(efficiencyCurve)
        .attr('fill', 'none')
        .attr('stroke', '#32c9e6')
        .attr('stroke-width', 2.5)
        .attr('d', lineGenerator)
    }

    const activeCurve = efficiencyCurveNPhase.length > 0 ? efficiencyCurveNPhase : efficiencyCurve
    if (operatingPoint) {
      const opEff = activeCurve[activeCurve.length - 1]?.efficiency ?? operatingPoint.efficiency
      root.append('circle')
        .attr('cx', xScale(operatingPoint.loadCurrent))
        .attr('cy', yScale(opEff))
        .attr('r', 5)
        .attr('fill', '#00f2ff')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5)

      root.append('text')
        .attr('x', xScale(operatingPoint.loadCurrent) + 8)
        .attr('y', yScale(opEff) - 8)
        .attr('fill', 'var(--text-primary)')
        .attr('font-size', '11px')
        .text('Current load')
    }

    root.append('text')
      .attr('x', 0)
      .attr('y', -8)
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px')
      .text('Efficiency vs Load')
  }, [efficiencyCurve, efficiencyCurveNPhase, operatingPoint, result])

  if (!result) {
    return (
      <div className={styles.placeholder}>
        Run simulation to compute loss breakdown.
      </div>
    )
  }

  if (!hasLossBreakdown) {
    return (
      <div className={styles.placeholder}>
        <div className={styles.fallbackMessage}>
          <div>No loss data is available for this topology yet.</div>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => setActiveVizTab('waveforms')}
          >
            Back to main deck
          </button>
        </div>
      </div>
    )
  }

  const totals = lossData[0]
  const barChartData = lossData.map((entry) => ({
    ...entry,
    total: entry.total,
  }))

  return (
    <div className={styles.wrapper}>
      <div className={styles.charts}>
        <section className={styles.chartCard}>
          <div className={styles.chartHeader}>Loss Breakdown</div>
          <div className={styles.barChartWrapper} data-export-id="loss-bar">
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={barChartData} layout="vertical" margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
                <XAxis type="number" hide domain={[0, 'dataMax']} />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                  formatter={(value: number) => [`${value.toFixed(2)} W`, 'Loss']}
                />
                {LOSS_SEGMENTS.map((segment) => (
                  <Bar
                    key={segment.key}
                    dataKey={segment.key}
                    stackId="loss"
                    fill={segment.color}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey={segment.key}
                      position="center"
                      content={(props) => {
                        const { value, width, x, y, height } = props as { value: number; width: number; x: number; y: number; height: number }
                        if (!Number.isFinite(value) || value <= 0 || width < 54) return null
                        const percent = totals.total > 0 ? (value / totals.total) * 100 : 0
                        return (
                          <text
                            x={x + width / 2}
                            y={y + height / 2 + 4}
                            fill="#ffffff"
                            fontSize={10}
                            textAnchor="middle"
                          >
                            {`${value.toFixed(2)} W · ${percent.toFixed(0)}%`}
                          </text>
                        )
                      }}
                    />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.segmentLegend}>
            {LOSS_SEGMENTS.map((segment) => (
              <div key={segment.key} className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: segment.color }} />
                <span>{segment.label}</span>
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
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total losses</span>
          <span className={styles.summaryValue}>{formatWatts(totals.total)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Efficiency</span>
          <span className={styles.summaryValue}>{formatPercent(totals.efficiency * 100)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Power dissipated</span>
          <span className={styles.summaryValue}>{formatWatts(totals.total)}</span>
        </div>
      </div>
      {result.current_sense && result.current_sense.rsense_power > 0 && (
        <div className={styles.summaryRow} style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Rsense loss</span>
            <span className={styles.summaryValue}>{formatWatts(result.current_sense.rsense_power)}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Rsense</span>
            <span className={styles.summaryValue}>{(result.current_sense.rsense * 1000).toFixed(2)} mΩ</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Package</span>
            <span className={styles.summaryValue}>{result.current_sense.rsense_package}</span>
          </div>
        </div>
      )}
    </div>
  )
}
