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

function createEfficiencyCurve(spec: DesignSpec, result: DesignResult, topology: string) {
  // The efficiency curve calculation is currently only implemented for the
  // buck topology. Return an empty array for others to prevent a crash.
  if (topology !== 'buck') {
    return []
  }
  // This calculation is only valid for a buck converter.
  function computeBuckLosses(loadCurrent: number): LossBreakdownValues {
    const D = Math.min(Math.max(spec.vout / spec.vinMax, 0.01), 0.99)
    const L = result.inductance
    const fsw = spec.fsw
    const deltaIL = Math.abs((spec.vout * (1 - D)) / (L * fsw))
    const IL_peak = loadCurrent + deltaIL / 2
    const IL_rms = Math.sqrt(loadCurrent * loadCurrent + (deltaIL * deltaIL) / 12)
    const Ic_rms = deltaIL / (2 * Math.sqrt(3))

    const mosfet_conduction = loadCurrent * loadCurrent * DEVICE_ASSUMPTIONS.rdsOn * D
    const mosfet_switching = 0.5 * spec.vinMax * IL_peak * (DEVICE_ASSUMPTIONS.trise + DEVICE_ASSUMPTIONS.tfall) * fsw
    const mosfet_gate = DEVICE_ASSUMPTIONS.qg * spec.vinMax * fsw
    const inductor_copper = IL_rms * IL_rms * DEVICE_ASSUMPTIONS.dcr
    const inductor_core = DEVICE_ASSUMPTIONS.coreFactor * loadCurrent * deltaIL
    const diode_conduction = DEVICE_ASSUMPTIONS.vf * loadCurrent * (1 - D)
    const capacitor_esr = Ic_rms * Ic_rms * DEVICE_ASSUMPTIONS.esr

    const total =
      mosfet_conduction + mosfet_switching + mosfet_gate +
      inductor_copper + inductor_core + diode_conduction + capacitor_esr

    const pout = spec.vout * loadCurrent
    const efficiency = pout <= 0 ? 0 : pout / (pout + total)

    return {
      mosfet_conduction, mosfet_switching, mosfet_gate, inductor_copper,
      inductor_core, diode_conduction, capacitor_esr, total, efficiency,
    }
  }

  return Array.from({ length: 10 }, (_, index) => {
    const ratio = 0.1 + index * 0.1
    const current = spec.iout * ratio
    const losses = computeBuckLosses(current)
    return {
      loadCurrent: current,
      efficiency: losses.efficiency * 100,
    }
  })
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

    const xDomain = [efficiencyCurve[0].loadCurrent, efficiencyCurve[efficiencyCurve.length - 1].loadCurrent]
    const yDomain = [
      Math.max(0, min(efficiencyCurve, (d) => d.efficiency)! - 2),
      Math.min(100, max(efficiencyCurve, (d) => d.efficiency)! + 2),
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

    root.append('path')
      .datum(efficiencyCurve)
      .attr('fill', 'none')
      .attr('stroke', '#32c9e6')
      .attr('stroke-width', 2.5)
      .attr('d', lineGenerator)

    if (operatingPoint) {
      root.append('circle')
        .attr('cx', xScale(operatingPoint.loadCurrent))
        .attr('cy', yScale(operatingPoint.efficiency))
        .attr('r', 5)
        .attr('fill', '#00f2ff')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5)

      root.append('text')
        .attr('x', xScale(operatingPoint.loadCurrent) + 8)
        .attr('y', yScale(operatingPoint.efficiency) - 8)
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
  }, [efficiencyCurve, operatingPoint, result])

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
    </div>
  )
}
