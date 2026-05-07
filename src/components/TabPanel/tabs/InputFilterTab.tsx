import React, { useEffect, useRef, useMemo } from 'react'
import { select } from 'd3-selection'
import { scaleLog } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import { line } from 'd3-shape'
import { useDesignStore } from '../../../store/design-store'
import {
  filterOutputImpedance,
  converterInputImpedance,
} from '../../../engine/input-filter'
import type { InputFilterResult } from '../../../engine/input-filter'
import styles from './InputFilterTab.module.css'

// ── Impedance chart ───────────────────────────────────────────────────────────

const FREQ_POINTS = 200

function logspace(fMin: number, fMax: number, n: number): number[] {
  const lo = Math.log10(fMin)
  const hi = Math.log10(fMax)
  return Array.from({ length: n }, (_, i) => Math.pow(10, lo + (hi - lo) * (i / (n - 1))))
}

function drawImpedancePlot(
  svg: SVGSVGElement,
  filter: InputFilterResult,
  fsw: number,
): void {
  const W = svg.clientWidth
  const H = svg.clientHeight
  if (!W || !H) return

  const margin = { top: 16, right: 24, bottom: 40, left: 62 }
  const cW = W - margin.left - margin.right
  const cH = H - margin.top - margin.bottom
  if (cW <= 0 || cH <= 0) return

  const freqs = logspace(100, Math.min(30e6, fsw * 10), FREQ_POINTS)

  const zOut = filterOutputImpedance(
    filter.dm_inductor,
    filter.dm_capacitor,
    filter.damping_resistor,
    filter.damping_capacitor,
    freqs,
  )
  const zIn = converterInputImpedance(filter.negative_input_impedance, fsw, freqs)
  // Stability boundary: |Zin| / 3 (tightened Middlebrook)
  const zBound = zIn.map((z) => z / 3)

  const allZ = [...zOut, ...zIn, ...zBound].filter(isFinite).filter((v) => v > 0)
  const yMin = Math.min(...allZ) * 0.5
  const yMax = Math.max(...allZ) * 2

  const xScale = scaleLog().domain([freqs[0], freqs[freqs.length - 1]]).range([0, cW])
  const yScale = scaleLog().domain([Math.max(1e-3, yMin), yMax]).range([cH, 0]).clamp(true)

  const svgSel = select(svg)
  svgSel.selectAll('*').remove()
  const root = svgSel.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  // Grid
  root.append('g').attr('class', styles.grid)
    .selectAll('line.h')
    .data(yScale.ticks(5))
    .enter().append('line')
    .attr('x1', 0).attr('x2', cW)
    .attr('y1', (d) => yScale(d)).attr('y2', (d) => yScale(d))
    .attr('stroke', 'var(--border)').attr('stroke-width', 0.5)

  // Violation shading: region where zOut > zBound
  for (let i = 0; i < freqs.length - 1; i++) {
    if (zOut[i] > zBound[i]) {
      root.append('rect')
        .attr('x', xScale(freqs[i]))
        .attr('y', 0)
        .attr('width', xScale(freqs[i + 1]) - xScale(freqs[i]))
        .attr('height', cH)
        .attr('fill', 'rgba(239,68,68,0.08)')
    }
  }

  const mkLine = (data: number[], color: string, dash?: string) => {
    const pathGen = line<number>()
      .x((_, i) => xScale(freqs[i]))
      .y((v) => yScale(Math.max(1e-6, v)))
      .defined((v) => isFinite(v) && v > 0)

    const path = root.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr('d', pathGen as unknown as string)
    if (dash) path.attr('stroke-dasharray', dash)
  }

  // Draw Zin/3 boundary first (behind), then zIn, then zOut
  mkLine(zBound, 'rgba(239,68,68,0.55)', '4 3')
  mkLine(zIn,   '#60a5fa')
  mkLine(zOut,  '#4ade80')

  // fsw marker
  if (fsw >= freqs[0] && fsw <= freqs[freqs.length - 1]) {
    root.append('line')
      .attr('x1', xScale(fsw)).attr('x2', xScale(fsw))
      .attr('y1', 0).attr('y2', cH)
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-dasharray', '4 3')
      .attr('stroke-width', 1)
    root.append('text')
      .attr('x', xScale(fsw) + 3).attr('y', 10)
      .attr('fill', 'var(--text-muted)').attr('font-size', '9px')
      .attr('font-family', 'var(--font-ui)')
      .text('fsw')
  }

  // f_res marker
  const fres = filter.filter_resonant_freq
  if (fres >= freqs[0] && fres <= freqs[freqs.length - 1]) {
    root.append('line')
      .attr('x1', xScale(fres)).attr('x2', xScale(fres))
      .attr('y1', 0).attr('y2', cH)
      .attr('stroke', 'rgba(74,220,128,0.35)')
      .attr('stroke-dasharray', '2 3')
      .attr('stroke-width', 1)
    root.append('text')
      .attr('x', xScale(fres) + 3).attr('y', 22)
      .attr('fill', 'var(--text-muted)').attr('font-size', '9px')
      .attr('font-family', 'var(--font-ui)')
      .text('fres')
  }

  // Axes
  const fmtHz = (d: d3.NumberValue) => {
    const v = +d
    if (v >= 1e6) return `${v / 1e6}M`
    if (v >= 1e3) return `${v / 1e3}k`
    return `${v}`
  }
  const xAxis = axisBottom(xScale).ticks(6, fmtHz)
  const yAxis = axisLeft(yScale).ticks(5, (d: d3.NumberValue) => {
    const v = +d
    if (v >= 1e3) return `${v / 1e3}k`
    if (v < 1) return v.toFixed(2)
    return `${v.toFixed(0)}`
  })

  const xGrp = root.append('g').attr('transform', `translate(0,${cH})`).call(xAxis)
  xGrp.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '9px')
  xGrp.selectAll('line,path').attr('stroke', 'var(--border)')
  xGrp.append('text')
    .attr('x', cW / 2).attr('y', 34).attr('fill', 'var(--text-muted)')
    .attr('font-size', '9px').attr('font-family', 'var(--font-ui)')
    .attr('text-anchor', 'middle').text('Frequency (Hz)')

  const yGrp = root.append('g').call(yAxis)
  yGrp.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '9px')
  yGrp.selectAll('line,path').attr('stroke', 'var(--border)')
  yGrp.append('text')
    .attr('transform', `translate(-50,${cH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle').attr('fill', 'var(--text-muted)')
    .attr('font-size', '9px').attr('font-family', 'var(--font-ui)')
    .text('Impedance (Ω)')
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend(): React.ReactElement {
  return (
    <div className={styles.legend}>
      <span className={styles.legendItem}>
        <span className={styles.dot} style={{ background: '#4ade80' }} /> |Zout filter|
      </span>
      <span className={styles.legendItem}>
        <span className={styles.dot} style={{ background: '#60a5fa' }} /> |Zin converter|
      </span>
      <span className={styles.legendItem}>
        <span className={styles.dot} style={{ background: 'rgba(239,68,68,0.55)', border: '1px dashed rgba(239,68,68,0.55)' }} /> |Zin|/3 (Middlebrook limit)
      </span>
    </div>
  )
}

// ── Filter schematic / values table ──────────────────────────────────────────

function fmtH(h: number): string {
  if (h >= 1e-3) return `${(h * 1e3).toFixed(2)} mH`
  if (h >= 1e-6) return `${(h * 1e6).toFixed(1)} µH`
  return `${(h * 1e9).toFixed(1)} nH`
}
function fmtF(f: number): string {
  if (f >= 1e-6) return `${(f * 1e6).toFixed(2)} µF`
  if (f >= 1e-9) return `${(f * 1e9).toFixed(1)} nF`
  return `${(f * 1e12).toFixed(1)} pF`
}
function fmtR(r: number): string {
  if (r >= 1e3) return `${(r / 1e3).toFixed(1)} kΩ`
  return `${r.toFixed(2)} Ω`
}
function fmtHz(f: number): string {
  if (f >= 1e6) return `${(f / 1e6).toFixed(2)} MHz`
  if (f >= 1e3) return `${(f / 1e3).toFixed(1)} kHz`
  return `${f.toFixed(0)} Hz`
}

function ValuesTable({ filter }: { filter: InputFilterResult }): React.ReactElement {
  const stabColor = filter.middlebrook_stable
    ? (filter.stability_margin_db > 6 ? '#4ade80' : '#f59e0b')
    : '#ef4444'

  const rows: [string, string][] = [
    ['DM inductor (Lf)',        fmtH(filter.dm_inductor)],
    ['DM capacitor (Cf)',       fmtF(filter.dm_capacitor)],
    ['Damping resistor (Rd)',   fmtR(filter.damping_resistor)],
    ['Damping capacitor (Cd)', fmtF(filter.damping_capacitor)],
    ['CM choke (Lcm)',          fmtH(filter.cm_choke)],
    ['X2 capacitor (Cx)',       fmtF(filter.x_capacitor)],
    ['Y2 capacitors (Cy×2)',    fmtF(filter.y_capacitors)],
    ['Filter resonance',        fmtHz(filter.filter_resonant_freq)],
    ['Attenuation @ fsw',       `${filter.filter_attenuation_at_fsw.toFixed(1)} dB (need ${filter.required_attenuation_db.toFixed(1)} dB)`],
    ['Inductor DCR loss',       `${(filter.filter_inductor_loss_w * 1000).toFixed(0)} mW (est.)`],
  ]

  return (
    <div className={styles.valuesTable}>
      <div className={styles.valuesGrid}>
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <span className={styles.vtLabel}>{label}</span>
            <span className={styles.vtValue}>{value}</span>
          </React.Fragment>
        ))}
        <span className={styles.vtLabel}>Middlebrook stable</span>
        <span className={styles.vtValue} style={{ color: stabColor }}>
          {filter.middlebrook_stable ? `Yes (${filter.stability_margin_db.toFixed(1)} dB margin)` : `No — ${filter.stability_margin_db.toFixed(1)} dB margin`}
        </span>
      </div>
      {filter.warnings.length > 0 && (
        <div className={styles.warnings}>
          {filter.warnings.map((w, i) => (
            <div key={i} className={styles.warn}>{w}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Chart sub-component ───────────────────────────────────────────────────────

function ImpedancePlot({ filter, fsw }: { filter: InputFilterResult; fsw: number }): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) drawImpedancePlot(svgRef.current, filter, fsw)
  }, [filter, fsw])

  return (
    <div className={styles.chartPanel}>
      <svg ref={svgRef} className={styles.svg} />
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function InputFilterTab(): React.ReactElement {
  const spec   = useDesignStore((s) => s.spec)
  const result = useDesignStore((s) => s.result)
  const updateSpec = useDesignStore((s) => s.updateSpec)

  const filter = result?.input_filter ?? null
  const enabled = spec.inputFilterEnabled ?? false

  const filterMemo = useMemo(() => filter, [filter])

  if (!result) {
    return (
      <div className={styles.empty}>
        <span>No design result yet — set parameters and wait for computation.</span>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      {/* Enable / disable toggle */}
      <div className={styles.toolbar}>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => updateSpec({ inputFilterEnabled: e.target.checked })}
          />
          Design input EMI filter
        </label>
        {enabled && (
          <span className={styles.hint}>
            Filter topology: CM choke → X-cap → DM LC + damping. Middlebrook stability checked.
          </span>
        )}
      </div>

      {!enabled && (
        <div className={styles.empty}>
          <span>Enable the input filter to design the CM/DM filter network and check Middlebrook stability.</span>
        </div>
      )}

      {enabled && !filterMemo && (
        <div className={styles.empty}><span>Computing…</span></div>
      )}

      {enabled && filterMemo && (
        <div className={styles.content}>
          <div className={styles.topRow}>
            <ValuesTable filter={filterMemo} />
          </div>
          <Legend />
          <ImpedancePlot filter={filterMemo} fsw={spec.fsw} />
        </div>
      )}
    </div>
  )
}
