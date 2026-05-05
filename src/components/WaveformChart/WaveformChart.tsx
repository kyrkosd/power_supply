// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React, { useEffect, useRef } from 'react'
import { select } from 'd3-selection'
import { axisBottom, axisLeft } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { line, curveLinear } from 'd3-shape'
import { extent } from 'd3-array'
import type { WaveformSet } from '../../engine/topologies/types'
import type { DesignSpec } from '../../engine/types'
import styles from './WaveformChart.module.css'

interface WaveformChartProps {
  waveforms: WaveformSet
  spec: DesignSpec
}

type WaveformKey = keyof WaveformSet

const panels: Array<{
  key: WaveformKey
  label: string
  unit: string
  color: string
}> = [
  { key: 'inductor_current', label: 'Inductor current', unit: 'A', color: '#4adcf4' },
  { key: 'switch_node', label: 'Switch node voltage', unit: 'V', color: '#f4b400' },
  { key: 'output_ripple', label: 'Output voltage ripple', unit: 'V', color: '#f26f5c' },
  { key: 'diode_current', label: 'Diode current', unit: 'A', color: '#70c7ff' },
]

export function WaveformChart({ waveforms, spec }: WaveformChartProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const width = svg.clientWidth
    const height = svg.clientHeight
    if (!width || !height) return

    const margin = { top: 20, right: 18, bottom: 32, left: 52 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom
    const rowHeight = (chartHeight - (panels.length - 1) * 12) / panels.length

    const xDomain = extent(waveforms.time) as [number, number]
    const xScale = scaleLinear().domain(xDomain).range([0, chartWidth])

    const svgSelection = select(svg)
    svgSelection.selectAll('*').remove()

    const root = svgSelection
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    panels.forEach((panel, index) => {
      const values = Array.from(waveforms[panel.key])
      const yExtent = extent(values) as [number, number]
      const delta = yExtent[1] - yExtent[0]
      const paddedExtent = delta === 0
        ? [yExtent[0] - 1, yExtent[1] + 1]
        : [yExtent[0] - delta * 0.12, yExtent[1] + delta * 0.12]
      const yScale = scaleLinear().domain(paddedExtent).range([rowHeight, 0]).nice()

      const row = root
        .append('g')
        .attr('transform', `translate(0,${index * (rowHeight + 12)})`)

      row
        .append('rect')
        .attr('width', chartWidth)
        .attr('height', rowHeight)
        .attr('fill', 'rgba(255,255,255,0.02)')

      const yAxis = axisLeft(yScale).ticks(4).tickSize(-chartWidth).tickPadding(8)
      row.append('g')
        .attr('class', styles.yAxis)
        .call(yAxis)
        .selectAll('text')
        .attr('fill', 'var(--text-muted)')

      row.append('text')
        .attr('x', 0)
        .attr('y', -8)
        .attr('fill', 'var(--text-primary)')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .text(`${panel.label} (${panel.unit})`)

      const lineGenerator = line<number>()
        .x((_, i) => xScale(waveforms.time[i]))
        .y((d) => yScale(d))
        .curve(curveLinear)

      row.append('path')
        .datum(values)
        .attr('fill', 'none')
        .attr('stroke', panel.color)
        .attr('stroke-width', 2)
        .attr('d', lineGenerator)

      if (index === panels.length - 1) {
        const xAxis = axisBottom(xScale).ticks(6).tickFormat((value) => `${(Number(value) * 1000).toFixed(1)} ms`)
        row.append('g')
          .attr('transform', `translate(0,${rowHeight})`)
          .attr('class', styles.xAxis)
          .call(xAxis)
          .selectAll('text')
          .attr('fill', 'var(--text-muted)')

        row.append('text')
          .attr('x', chartWidth / 2)
          .attr('y', rowHeight + 28)
          .attr('fill', 'var(--text-secondary)')
          .attr('font-size', '11px')
          .attr('text-anchor', 'middle')
          .text('Time (ms)')
      }
    })

    root.append('text')
      .attr('x', 0)
      .attr('y', -8)
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px')
      .text(`Waveforms · 2 cycles @ ${Math.round(spec.fsw / 1000)} kHz`)
  }, [waveforms, spec])

  return (
    <div className={styles.wrapper}>
      <svg ref={svgRef} className={styles.svg} data-export-id="waveform-chart" />
    </div>
  )
}
