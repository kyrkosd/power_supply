import React, { useEffect, useRef, useState, useCallback } from 'react'
import { select, type Selection } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { axisBottom, axisLeft, axisRight } from 'd3-axis'
import { interpolateRgb } from 'd3-interpolate'
import { useDesignStore } from '../../store/design-store'
import type { EfficiencyMapResult } from '../../store/design-store'
import type { DesignSpec } from '../../engine/types'
import styles from './EfficiencyMap.module.css'

// ── Color scale ───────────────────────────────────────────────────────────────

const COLOR_STOPS: [number, string][] = [
  [0.00, '#6b0000'],
  [0.75, '#b03a00'],
  [0.85, '#b8a400'],
  [0.90, '#508060'],
  [0.95, '#28a030'],
  [1.00, '#00cc50'],
]

function effToColor(eff: number): string {
  const v = Math.max(0, Math.min(1, eff))
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    const [t0, c0] = COLOR_STOPS[i - 1]
    const [t1, c1] = COLOR_STOPS[i]
    if (v <= t1) {
      return interpolateRgb(c0, c1)((v - t0) / (t1 - t0))
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1][1]
}

// Topologies that compute efficiency from a loss model
const LOSS_MODEL_TOPOLOGIES = new Set(['buck-boost', 'flyback', 'forward', 'sepic'])

// ── Hover state ───────────────────────────────────────────────────────────────

interface HoverInfo {
  vin: number
  iout: number
  eff: number
  lossW: number
  x: number
  y: number
}

// ── Map rendering ─────────────────────────────────────────────────────────────

interface DrawParams {
  margin: { top: number; right: number; bottom: number; left: number }
  cellW: number
  cellH: number
  chartW: number
  chartH: number
  data: EfficiencyMapResult
}

function drawHeatmap(
  svg: SVGSVGElement,
  data: EfficiencyMapResult,
  spec: DesignSpec,
): DrawParams | null {
  const W = svg.clientWidth
  const H = svg.clientHeight
  if (!W || !H) return null

  const N = 10
  const margin = { top: 28, right: 90, bottom: 48, left: 58 }
  const chartW = W - margin.left - margin.right
  const chartH = H - margin.top - margin.bottom
  if (chartW <= 0 || chartH <= 0) return null

  const cellW = chartW / N
  const cellH = chartH / N

  const { matrix, vinPoints, ioutPoints } = data
  const vinSpan = vinPoints[N - 1] - vinPoints[0]
  const xDomain: [number, number] = vinSpan === 0
    ? [vinPoints[0] - 0.5, vinPoints[0] + 0.5]
    : [vinPoints[0], vinPoints[N - 1]]
  const yDomain: [number, number] = [ioutPoints[0], ioutPoints[N - 1]]

  const svgSel = select(svg)
  svgSel.selectAll('*').remove()

  const defs = svgSel.append('defs')

  // Legend gradient (bottom → top = low eff → high eff)
  const grad = defs.append('linearGradient')
    .attr('id', 'eff-map-grad')
    .attr('x1', 0).attr('y1', 1)
    .attr('x2', 0).attr('y2', 0)
  COLOR_STOPS.forEach(([stop, color]) => {
    grad.append('stop')
      .attr('offset', `${(stop * 100).toFixed(0)}%`)
      .attr('stop-color', color)
  })

  const root = svgSel.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  // ── Cells ─────────────────────────────────────────────────────────────────
  for (let vi = 0; vi < N; vi++) {
    for (let ii = 0; ii < N; ii++) {
      root.append('rect')
        .attr('x', vi * cellW)
        .attr('y', (N - 1 - ii) * cellH)
        .attr('width', cellW - 0.5)
        .attr('height', cellH - 0.5)
        .attr('fill', effToColor(matrix[vi][ii]))
    }
  }

  // ── Axes ──────────────────────────────────────────────────────────────────
  const xScale = scaleLinear().domain(xDomain).range([0, chartW])
  const yScale = scaleLinear().domain(yDomain).range([chartH, 0])

  const xAxis = axisBottom(xScale)
    .ticks(5)
    .tickFormat((d) => `${d} V`)

  const yAxis = axisLeft(yScale)
    .ticks(5)
    .tickFormat((d) => `${(+d).toFixed(1)} A`)

  const xGroup = root.append('g')
    .attr('transform', `translate(0,${chartH})`)
    .call(xAxis)
  xGroup.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '10px')
  xGroup.selectAll('line,path').attr('stroke', 'var(--border)')

  const yGroup = root.append('g').call(yAxis)
  yGroup.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '10px')
  yGroup.selectAll('line,path').attr('stroke', 'var(--border)')

  // ── Axis labels ───────────────────────────────────────────────────────────
  root.append('text')
    .attr('x', chartW / 2)
    .attr('y', chartH + 40)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--text-secondary)')
    .attr('font-size', '11px')
    .attr('font-family', 'var(--font-ui)')
    .text('Input Voltage Vin (V)')

  root.append('text')
    .attr('transform', `translate(-42,${chartH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--text-secondary)')
    .attr('font-size', '11px')
    .attr('font-family', 'var(--font-ui)')
    .text('Output Current Iout (A)')

  // ── Crosshair at nominal Vin, full Iout ───────────────────────────────────
  const nomVin = (spec.vinMin + spec.vinMax) / 2
  const clampedVin = Math.max(xDomain[0], Math.min(xDomain[1], nomVin))
  const clampedIout = Math.max(yDomain[0], Math.min(yDomain[1], spec.iout))
  const cx = xScale(clampedVin)
  const cy = yScale(clampedIout)
  const arm = Math.min(cellW, cellH) * 0.75

  const crossStyle = (sel: Selection<SVGLineElement, unknown, null, undefined>) =>
    sel.attr('stroke', 'white').attr('stroke-width', 1.5).attr('opacity', 0.9)

  crossStyle(root.append<SVGLineElement>('line')
    .attr('x1', cx - arm).attr('x2', cx + arm)
    .attr('y1', cy).attr('y2', cy))
  crossStyle(root.append<SVGLineElement>('line')
    .attr('x1', cx).attr('x2', cx)
    .attr('y1', cy - arm).attr('y2', cy + arm))

  // ── Legend bar ────────────────────────────────────────────────────────────
  const lgX = chartW + 22
  const lgW = 12
  const lgH = chartH

  root.append('rect')
    .attr('x', lgX)
    .attr('y', 0)
    .attr('width', lgW)
    .attr('height', lgH)
    .attr('rx', 2)
    .attr('fill', 'url(#eff-map-grad)')

  const legendScale = scaleLinear().domain([0, 1]).range([lgH, 0])
  const legendAxis = axisRight(legendScale)
    .tickValues(COLOR_STOPS.map(([t]) => t))
    .tickFormat((d) => `${(+d * 100).toFixed(0)}%`)

  const lgGroup = root.append('g')
    .attr('transform', `translate(${lgX + lgW}, 0)`)
    .call(legendAxis)
  lgGroup.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '10px')
  lgGroup.selectAll('line,path').attr('stroke', 'var(--border)')

  return { margin, cellW, cellH, chartW, chartH, data }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EfficiencyMap(): React.ReactElement {
  const svgRef   = useRef<SVGSVGElement>(null)
  const drawRef  = useRef<DrawParams | null>(null)

  const spec                 = useDesignStore((s) => s.spec)
  const topology             = useDesignStore((s) => s.topology)
  const efficiencyMapResult  = useDesignStore((s) => s.efficiencyMapResult)
  const efficiencyMapLoading = useDesignStore((s) => s.efficiencyMapLoading)
  const requestEfficiencyMap = useDesignStore((s) => s.requestEfficiencyMap)

  const [hover, setHover] = useState<HoverInfo | null>(null)

  // Redraw whenever the result or spec changes
  useEffect(() => {
    if (!svgRef.current || !efficiencyMapResult) return
    drawRef.current = drawHeatmap(svgRef.current, efficiencyMapResult, spec)
  }, [efficiencyMapResult, spec])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const params = drawRef.current
    if (!params || !efficiencyMapResult) return
    const { margin, cellW, cellH, data } = params
    const rect = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left - margin.left
    const my = e.clientY - rect.top - margin.top
    const N = 10
    const vi = Math.floor(mx / cellW)
    const ii = N - 1 - Math.floor(my / cellH)
    if (vi < 0 || vi >= N || ii < 0 || ii >= N) { setHover(null); return }
    const eff = data.matrix[vi][ii]
    const vin = data.vinPoints[vi]
    const iout = data.ioutPoints[ii]
    const pout = spec.vout * iout
    const lossW = eff > 0 && eff < 1 ? pout * (1 / eff - 1) : 0
    setHover({ vin, iout, eff, lossW, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [efficiencyMapResult, spec])

  const hasLossModel = LOSS_MODEL_TOPOLOGIES.has(topology)

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button
          className={styles.refreshBtn}
          onClick={requestEfficiencyMap}
          disabled={efficiencyMapLoading}
          title="Compute efficiency across the full Vin × Iout space"
        >
          {efficiencyMapLoading ? '⏳ Computing…' : '↻ Refresh Map'}
        </button>
        {!efficiencyMapResult && !efficiencyMapLoading && (
          <span className={styles.hint}>Click Refresh Map to compute the 10×10 operating grid.</span>
        )}
        {!hasLossModel && (
          <span className={styles.noModelNote}>
            {topology} uses a fixed target efficiency — map will be uniform until a loss model is added.
          </span>
        )}
      </div>

      <div className={styles.svgWrap}>
        {efficiencyMapLoading && (
          <div className={styles.loadingOverlay}>
            <span className={styles.spinner} />
            Computing 100 operating points…
          </div>
        )}

        <svg
          ref={svgRef}
          className={styles.svg}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
        />

        {hover && (
          <div className={styles.tooltip} style={{ left: hover.x + 14, top: hover.y - 8 }}>
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>Vin</span>
              <span>{hover.vin.toFixed(1)} V</span>
            </div>
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>Iout</span>
              <span>{hover.iout.toFixed(2)} A</span>
            </div>
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>η</span>
              <span>{(hover.eff * 100).toFixed(1)} %</span>
            </div>
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>Loss</span>
              <span>{hover.lossW.toFixed(2)} W</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
