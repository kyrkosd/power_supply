import React, { useEffect, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import { line } from 'd3-shape'
import { extent } from 'd3-array'
import { useDesignStore } from '../../../store/design-store'
import type { TransientMode } from '../../../engine/topologies/types'
import styles from './TransientTab.module.css'

// Only buck has getStateSpaceModel implemented
const SUPPORTED_TOPOLOGIES = new Set(['buck'])

const MODES: { id: TransientMode; label: string }[] = [
  { id: 'startup',   label: 'Startup' },
  { id: 'load-step', label: 'Load Step' },
  { id: 'line-step', label: 'Line Step' },
]

// ── Chart drawing ─────────────────────────────────────────────────────────────

interface PanelCfg {
  data: Float64Array
  label: string
  unit: string
  color: string
  refLine?: number  // horizontal reference line value
}

function drawChart(svg: SVGSVGElement, time: Float64Array, panel: PanelCfg): void {
  const W = svg.clientWidth
  const H = svg.clientHeight
  if (!W || !H) return

  const margin = { top: 14, right: 14, bottom: 28, left: 52 }
  const cW = W - margin.left - margin.right
  const cH = H - margin.top - margin.bottom
  if (cW <= 0 || cH <= 0) return

  const tMs = Array.from(time, (t) => t * 1000)
  const vals = Array.from(panel.data)

  const xDom = extent(tMs) as [number, number]
  const yExt = extent(vals) as [number, number]
  const pad = (yExt[1] - yExt[0]) * 0.12 || 0.1
  const yDom: [number, number] = [yExt[0] - pad, yExt[1] + pad]

  const xScale = scaleLinear().domain(xDom).range([0, cW])
  const yScale = scaleLinear().domain(yDom).range([cH, 0])

  const svgSel = select(svg)
  svgSel.selectAll('*').remove()

  const root = svgSel.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  // Reference line (e.g. target Vout)
  if (panel.refLine !== undefined) {
    root.append('line')
      .attr('x1', 0).attr('x2', cW)
      .attr('y1', yScale(panel.refLine)).attr('y2', yScale(panel.refLine))
      .attr('stroke', 'rgba(255,255,255,0.18)')
      .attr('stroke-dasharray', '4 3')
      .attr('stroke-width', 1)
  }

  // Signal line
  const pathGen = line<number>()
    .x((_, i) => xScale(tMs[i]))
    .y((v) => yScale(v))
    .defined((_, i) => isFinite(vals[i]))

  root.append('path')
    .datum(vals)
    .attr('fill', 'none')
    .attr('stroke', panel.color)
    .attr('stroke-width', 1.5)
    .attr('d', pathGen as unknown as string)

  // Axes
  const xAxis = axisBottom(xScale).ticks(5).tickFormat((d) => `${d} ms`)
  const yAxis = axisLeft(yScale).ticks(4)

  const xGrp = root.append('g').attr('transform', `translate(0,${cH})`).call(xAxis)
  xGrp.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '9px')
  xGrp.selectAll('line,path').attr('stroke', 'var(--border)')

  const yGrp = root.append('g').call(yAxis)
  yGrp.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '9px')
  yGrp.selectAll('line,path').attr('stroke', 'var(--border)')

  // Y-axis label
  root.append('text')
    .attr('transform', `translate(-38,${cH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--text-muted)')
    .attr('font-size', '9px')
    .attr('font-family', 'var(--font-ui)')
    .text(`${panel.label} (${panel.unit})`)
}

// ── Sub-component: single chart panel ────────────────────────────────────────

function ChartPanel({ time, panel }: { time: Float64Array; panel: PanelCfg }): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) drawChart(svgRef.current, time, panel)
  }, [time, panel])

  return (
    <div className={styles.chartPanel}>
      <svg ref={svgRef} className={styles.svg} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function TransientTab(): React.ReactElement {
  const topology            = useDesignStore((s) => s.topology)
  const spec                = useDesignStore((s) => s.spec)
  const result              = useDesignStore((s) => s.result)
  const softStartOptions    = useDesignStore((s) => s.softStartOptions)
  const transientResult     = useDesignStore((s) => s.transientResult)
  const transientLoading    = useDesignStore((s) => s.transientLoading)
  const requestTransientRun = useDesignStore((s) => s.requestTransientRun)

  const [mode, setMode] = useState<TransientMode>('startup')

  const supported = SUPPORTED_TOPOLOGIES.has(topology)
  const canRun = supported && !!result && !transientLoading

  function handleRun(): void {
    if (!result) return
    const softStartSeconds = softStartOptions.auto_tss
      ? Math.max(0.001, Math.min(0.050, (result.capacitance * spec.vout * 10) / spec.iout))
      : (softStartOptions.tss_s ?? 0.005)
    requestTransientRun({ topology, spec, result, mode, softStartSeconds })
  }

  const tr = transientResult

  return (
    <div className={styles.wrapper}>
      {/* Controls */}
      <div className={styles.toolbar}>
        <div className={styles.modeGroup}>
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`${styles.modeBtn} ${mode === m.id ? styles.modeBtnActive : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button className={styles.runBtn} onClick={handleRun} disabled={!canRun}>
          {transientLoading ? '⏳ Simulating…' : '▶ Run'}
        </button>
        {!supported && (
          <span className={styles.hint}>
            Transient simulation requires a state-space model — currently available for Buck only.
          </span>
        )}
        {supported && !tr && !transientLoading && (
          <span className={styles.hint}>Select a mode and click Run to simulate 10 ms of operation.</span>
        )}
      </div>

      {/* Metrics */}
      {tr && (
        <div className={styles.metrics}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Settling time</span>
            <span className={styles.metricValue}>{tr.metrics.settling_time_ms.toFixed(2)} ms</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Overshoot</span>
            <span className={styles.metricValue}>{tr.metrics.overshoot_pct.toFixed(1)} %</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Peak inrush</span>
            <span className={styles.metricValue}>{tr.metrics.peak_inrush_A.toFixed(2)} A</span>
          </div>
        </div>
      )}

      {/* Charts */}
      {tr ? (
        <div className={styles.charts}>
          {transientLoading && (
            <div className={styles.loadingOverlay}>
              <span className={styles.spinner} /> Simulating…
            </div>
          )}
          <ChartPanel
            time={tr.time}
            panel={{ data: tr.vout, label: 'Output voltage', unit: 'V', color: '#4adcf4', refLine: spec.vout }}
          />
          <ChartPanel
            time={tr.time}
            panel={{ data: tr.iL, label: 'Inductor current', unit: 'A', color: '#f4b400' }}
          />
        </div>
      ) : (
        <div className={styles.empty}>
          {supported ? (
            <>
              <span>No simulation data yet.</span>
              <span className={styles.emptyHint}>
                Choose a mode (Startup, Load Step, or Line Step) and click Run.
                The simulation uses your current component values and soft-start time.
              </span>
            </>
          ) : (
            <>
              <span>Not available for {topology}.</span>
              <span className={styles.emptyHint}>
                Transient simulation requires a state-space model. Switch to Buck topology to use this feature.
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
