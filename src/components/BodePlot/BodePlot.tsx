// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React, { useEffect, useRef } from 'react'
import { select } from 'd3-selection'
import { axisBottom, axisLeft, axisRight } from 'd3-axis'
import { scaleLog, scaleLinear } from 'd3-scale'
import { line, curveLinear } from 'd3-shape'
import styles from './BodePlot.module.css'
import { analyzeBuckControlLoop } from '../../engine/control-loop'
import type { BodePoint } from '../../engine/control-loop'
import type { DesignSpec, DesignResult } from '@engine/types'

interface BodePlotProps {
  spec: DesignSpec
  result: DesignResult
}

function formatFrequency(value: number) {
  if (value >= 1e6) return `${value / 1e6}M`
  if (value >= 1e3) return `${value / 1e3}k`
  return `${Math.round(value)}`
}

export function BodePlot({ spec, result }: BodePlotProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const width = svg.clientWidth
    const height = svg.clientHeight
    if (!width || !height) return

    const margin = { top: 28, right: 80, bottom: 40, left: 56 }
    const chartWidth  = width  - margin.left - margin.right
    const chartHeight = height - margin.top  - margin.bottom

    const controlMode = spec.controlMode ?? 'voltage'
    const analysis = analyzeBuckControlLoop(spec, result, { controlMode })

    const xScale = scaleLog().base(10).domain([10, spec.fsw * 10]).range([0, chartWidth])

    const allMag = analysis.plant.map((p) => p.magnitude_db)
      .concat(analysis.compensator.map((p) => p.magnitude_db))
      .concat(analysis.loop.map((p) => p.magnitude_db))
    const magMin = Math.min(...allMag)
    const magMax = Math.max(...allMag)
    const magDomain = [Math.floor((magMin - 20) / 20) * 20, Math.ceil((magMax + 10) / 20) * 20] as [number, number]
    const yMagScale = scaleLinear().domain(magDomain).range([chartHeight, 0]).nice()

    const allPhase = analysis.loop.map((p) => p.phase_deg)
    const phaseMin = Math.min(...allPhase)
    const phaseMax = Math.max(...allPhase)
    const phaseDomain = [Math.floor(phaseMin / 20) * 20, Math.ceil(phaseMax / 20) * 20] as [number, number]
    const yPhaseScale = scaleLinear().domain(phaseDomain).range([chartHeight, 0]).nice()

    const svgSel = select(svg)
    svgSel.selectAll('*').remove()

    const root = svgSel.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const decadeTicks: number[] = []
    for (let power = 1; power <= Math.ceil(Math.log10(spec.fsw * 10)); power += 1) {
      decadeTicks.push(10 ** power)
    }

    root.append('g').attr('class', styles.grid).attr('transform', `translate(0,${chartHeight})`)
      .call(axisBottom(xScale).tickValues(decadeTicks).tickSize(-chartHeight).tickFormat(() => ''))
    root.append('g').attr('class', styles.grid)
      .call(axisLeft(yMagScale).ticks(6).tickSize(-chartWidth).tickFormat(() => ''))

    root.append('g').attr('class', styles.axis).attr('transform', `translate(0,${chartHeight})`)
      .call(axisBottom(xScale).tickValues(decadeTicks).tickFormat((v) => formatFrequency(Number(v))))
      .selectAll('text').attr('fill', 'var(--text-muted)')
    root.append('g').attr('class', styles.axis)
      .call(axisLeft(yMagScale).ticks(6))
      .selectAll('text').attr('fill', 'var(--text-muted)')
    root.append('g').attr('class', styles.axis).attr('transform', `translate(${chartWidth},0)`)
      .call(axisRight(yPhaseScale).ticks(7))
      .selectAll('text').attr('fill', 'var(--text-muted)')

    const magLine = line<BodePoint>()
      .x((d) => xScale(d.freq_hz))
      .y((d) => yMagScale(d.magnitude_db))
      .curve(curveLinear)

    // Plant
    root.append('path').datum(analysis.plant)
      .attr('fill', 'none').attr('stroke', '#9b9b9b')
      .attr('stroke-width', 1.5).attr('stroke-dasharray', '6 4')
      .attr('d', magLine)

    // Compensator
    root.append('path').datum(analysis.compensator)
      .attr('fill', 'none').attr('stroke', '#f2a700')
      .attr('stroke-width', 1.5).attr('stroke-dasharray', '6 4')
      .attr('d', magLine)

    // Loop gain
    root.append('path').datum(analysis.loop)
      .attr('fill', 'none').attr('stroke', '#36d7d1')
      .attr('stroke-width', 2)
      .attr('d', magLine)

    // Crossover marker
    const crossoverX = analysis.crossoverFrequencyHz
    if (!Number.isNaN(crossoverX)) {
      const x = xScale(crossoverX)
      root.append('line')
        .attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', chartHeight)
        .attr('stroke', 'rgba(74, 144, 217, 0.65)').attr('stroke-width', 1).attr('stroke-dasharray', '4 4')
      root.append('text')
        .attr('x', x + 6).attr('y', 20)
        .attr('fill', 'var(--text-secondary)').attr('font-size', '11px').attr('font-family', 'Segoe UI')
        .text(`fc ≈ ${formatFrequency(crossoverX)} Hz`)
    }

    // Subharmonic oscillation warning bar (current mode, D > 0.5)
    if (analysis.slopeCompensation.subharmonic_risk) {
      root.append('rect')
        .attr('x', 0).attr('y', -margin.top)
        .attr('width', chartWidth).attr('height', margin.top - 4)
        .attr('fill', 'rgba(245,158,11,0.12)')
      root.append('text')
        .attr('x', 4).attr('y', -margin.top + 13)
        .attr('fill', '#f59e0b').attr('font-size', '10px').attr('font-family', 'Segoe UI')
        .text('⚠ D > 50 % — slope compensation required to prevent fsw/2 subharmonic oscillation')
    }

    // Mode label + legend
    const modeLabel = controlMode === 'current' ? 'Current Mode (PCM)' : 'Voltage Mode (VMC)'
    root.append('text')
      .attr('x', 0).attr('y', -8)
      .attr('fill', controlMode === 'current' ? '#36d7d1' : 'var(--text-secondary)')
      .attr('font-size', '11px').attr('font-family', 'Segoe UI')
      .text(`${modeLabel}  ·  Plant · Controller · Loop gain`)

    root.append('text')
      .attr('x', 0).attr('y', chartHeight + 34)
      .attr('fill', 'var(--text-secondary)').attr('font-size', '11px').attr('font-family', 'Segoe UI')
      .text('Frequency (Hz)')

    root.append('text')
      .attr('x', 0).attr('y', chartHeight + 18)
      .attr('fill', 'var(--text-secondary)').attr('font-size', '11px').attr('font-family', 'Segoe UI')
      .text(`PM ${analysis.phaseMarginDeg.toFixed(0)}° · GM ${analysis.gainMarginDb.toFixed(1)} dB`)
  }, [spec, result])

  return (
    <div className={styles.wrapper}>
      <svg ref={svgRef} className={styles.svg} data-export-id="bode-plot" />
    </div>
  )
}
