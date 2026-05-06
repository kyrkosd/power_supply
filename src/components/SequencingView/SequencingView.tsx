import React, { useEffect, useRef, useState, useCallback } from 'react'
import { select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { axisBottom } from 'd3-axis'
import { useDesignStore } from '../../store/design-store'
import { compute } from '../../engine/index'
import { designSoftStart } from '../../engine/soft-start'
import {
  analyzeSequencing,
  estimatePgDelay,
  recommendedOrder,
} from '../../engine/sequencing'
import type { SequencingRail, SequencingResult } from '../../engine/sequencing'
import styles from './SequencingView.module.css'

// ── Timing diagram (D3) ───────────────────────────────────────────────────────

const ENABLE_COLOR  = '#4adcf4'
const SETTLING_COLOR = 'rgba(74,220,244,0.45)'
const PG_COLOR      = '#4ade80'
const WARN_COLOR    = '#f59e0b'

function drawDiagram(svg: SVGSVGElement, result: SequencingResult): void {
  const W = svg.clientWidth
  const H = svg.clientHeight
  if (!W || !H || result.rails.length === 0) return

  const N = result.rails.length
  const margin = { top: 18, right: 24, bottom: 32, left: 110 }
  const cW = W - margin.left - margin.right
  const cH = H - margin.top - margin.bottom
  const rowH = Math.min(50, cH / N)
  const pad = 6

  const maxTime = Math.max(result.total_time_ms * 1.08, 10)
  const xScale = scaleLinear().domain([0, maxTime]).range([0, cW])

  const svgSel = select(svg)
  svgSel.selectAll('*').remove()

  const root = svgSel.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  // Grid lines
  root.append('g')
    .attr('transform', `translate(0,${N * rowH})`)
    .call(
      axisBottom(xScale)
        .ticks(6)
        .tickSize(-(N * rowH))
        .tickFormat(() => '')
    )
    .call((g) => {
      g.selectAll('line').attr('stroke', 'rgba(255,255,255,0.05)')
      g.select('.domain').remove()
    })

  // X axis
  const xAxis = axisBottom(xScale).ticks(6).tickFormat((d) => `${(+d).toFixed(1)} ms`)
  const xGrp = root.append('g')
    .attr('transform', `translate(0,${N * rowH})`)
    .call(xAxis)
  xGrp.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '9px')
  xGrp.selectAll('line,path').attr('stroke', 'var(--border)')

  // Detect conflicted rails (appear in warnings)
  const conflictedRails = new Set<string>()
  for (const w of result.warnings) {
    const m = w.match(/Rail "([^"]+)" enables before "([^"]+)"/)
    if (m) { conflictedRails.add(m[1]); conflictedRails.add(m[2]) }
  }

  // Draw each rail row
  result.rails.forEach((rail, i) => {
    const yTop = i * rowH + pad
    const yBot = (i + 1) * rowH - pad
    const midY = (yTop + yBot) / 2
    const isConflict = conflictedRails.has(rail.name)
    const color = isConflict ? WARN_COLOR : ENABLE_COLOR

    // Rail name label
    root.append('text')
      .attr('x', -8)
      .attr('y', midY + 3)
      .attr('text-anchor', 'end')
      .attr('fill', isConflict ? WARN_COLOR : 'var(--text-secondary)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-weight', isConflict ? 700 : 400)
      .text(`${rail.name}`)

    // Vout badge to the far left
    root.append('text')
      .attr('x', -8)
      .attr('y', midY + 13)
      .attr('text-anchor', 'end')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '8px')
      .attr('font-family', 'var(--font-mono)')
      .text(`${rail.vout} V`)

    const enableX = xScale(rail.enable_time_ms)
    const rampEndX = xScale(rail.enable_time_ms + rail.tss * 1000)
    const pgX = xScale(rail.pg_time_ms)

    // Pre-enable flat at bottom (dashed)
    if (enableX > 1) {
      root.append('line')
        .attr('x1', 0).attr('x2', enableX)
        .attr('y1', yBot).attr('y2', yBot)
        .attr('stroke', color)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3 3')
        .attr('opacity', 0.4)
    }

    // Rising ramp: enable → ramp end
    const rampEnd = Math.min(rampEndX, pgX)
    root.append('line')
      .attr('x1', enableX).attr('x2', rampEnd)
      .attr('y1', yBot).attr('y2', yTop)
      .attr('stroke', color)
      .attr('stroke-width', 1.5)

    // Settling zone: ramp end → pg (not yet PG-stable)
    if (pgX > rampEndX) {
      root.append('line')
        .attr('x1', rampEndX).attr('x2', pgX)
        .attr('y1', yTop).attr('y2', yTop)
        .attr('stroke', SETTLING_COLOR)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 2')
    }

    // Post-PG steady state
    if (pgX < cW) {
      root.append('line')
        .attr('x1', pgX).attr('x2', cW)
        .attr('y1', yTop).attr('y2', yTop)
        .attr('stroke', color)
        .attr('stroke-width', 2)
    }

    // PG marker (dashed vertical)
    root.append('line')
      .attr('x1', pgX).attr('x2', pgX)
      .attr('y1', yTop - 3).attr('y2', yBot + 3)
      .attr('stroke', PG_COLOR)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3 2')

    // PG label
    root.append('text')
      .attr('x', pgX + 3)
      .attr('y', yTop + 8)
      .attr('fill', PG_COLOR)
      .attr('font-size', '8px')
      .attr('font-family', 'var(--font-ui)')
      .text('PG')

    // Row separator
    if (i < N - 1) {
      root.append('line')
        .attr('x1', 0).attr('x2', cW)
        .attr('y1', (i + 1) * rowH).attr('y2', (i + 1) * rowH)
        .attr('stroke', 'var(--border)')
        .attr('stroke-width', 0.5)
    }
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function newId(): string {
  return Math.random().toString(36).slice(2, 9)
}

function fmtMs(s: number): string {
  const ms = s * 1000
  return ms >= 1 ? `${ms.toFixed(1)} ms` : `${(ms * 1000).toFixed(0)} µs`
}

interface ManualForm {
  name: string
  vout: string
  tss_ms: string
}

const EMPTY_FORM: ManualForm = { name: '', vout: '3.3', tss_ms: '5' }

// ── Component ─────────────────────────────────────────────────────────────────

export function SequencingView(): React.ReactElement | null {
  const isSequencing    = useDesignStore((s) => s.isSequencing)
  const setIsSequencing = useDesignStore((s) => s.setIsSequencing)

  const [rails, setRails] = useState<SequencingRail[]>([])
  const [showManual, setShowManual] = useState(false)
  const [form, setForm] = useState<ManualForm>(EMPTY_FORM)
  const [isOrdered, setIsOrdered] = useState(false)  // true when user has manually reordered

  const svgRef = useRef<SVGSVGElement>(null)

  const result: SequencingResult = analyzeSequencing(rails)

  // Compute recommended order and check if current order matches
  const recOrder = recommendedOrder(rails)
  const currentOrder = rails.map((r) => r.name)
  const matchesRecommended =
    recOrder.length === currentOrder.length &&
    recOrder.every((n, i) => n === currentOrder[i])

  // Redraw timing diagram whenever result changes
  useEffect(() => {
    if (svgRef.current) drawDiagram(svgRef.current, result)
  }, [result])

  // Close on Escape
  useEffect(() => {
    if (!isSequencing) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setIsSequencing(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isSequencing, setIsSequencing])

  // ── Rail mutations ─────────────────────────────────────────────────────────

  const addRail = useCallback((rail: SequencingRail) => {
    setRails((prev) => {
      if (prev.length >= 8) return prev
      const next = [...prev, rail]
      // Auto-sort on first addition unless user has manually reordered
      if (!isOrdered) {
        return next.sort((a, b) => {
          const ga = a.vout <= 1.8 ? 0 : a.vout <= 3.3 ? 1 : 2
          const gb = b.vout <= 1.8 ? 0 : b.vout <= 3.3 ? 1 : 2
          return ga !== gb ? ga - gb : a.vout - b.vout
        })
      }
      return next
    })
  }, [isOrdered])

  function removeRail(id: string): void {
    setRails((prev) => prev.filter((r) => r.id !== id))
  }

  function moveRail(id: string, dir: -1 | 1): void {
    setIsOrdered(true)
    setRails((prev) => {
      const idx = prev.findIndex((r) => r.id === id)
      if (idx < 0) return prev
      const next = idx + dir
      if (next < 0 || next >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr
    })
  }

  function resetOrder(): void {
    setIsOrdered(false)
    setRails((prev) =>
      [...prev].sort((a, b) => {
        const ga = a.vout <= 1.8 ? 0 : a.vout <= 3.3 ? 1 : 2
        const gb = b.vout <= 1.8 ? 0 : b.vout <= 3.3 ? 1 : 2
        return ga !== gb ? ga - gb : a.vout - b.vout
      })
    )
  }

  // ── Load from file ─────────────────────────────────────────────────────────

  async function handleLoadFile(): Promise<void> {
    const res = await window.projectAPI?.open()
    if (!res?.success || !res.project) return
    const { topology, spec } = res.project
    const designResult = compute(topology, spec)
    const ss = designSoftStart(topology, spec, designResult)
    const pgDelay = estimatePgDelay(ss.tss_used, spec, null)
    const rawName = res.filePath?.split(/[\\/]/).pop()?.replace(/\.pswb$/i, '') ?? `Rail ${rails.length + 1}`
    addRail({
      id: newId(),
      name: rawName,
      vout: spec.vout,
      tss: ss.tss_used,
      pg_delay: pgDelay,
      spec,
    })
  }

  // ── Manual add ─────────────────────────────────────────────────────────────

  function handleAddManual(): void {
    const vout = parseFloat(form.vout)
    const tss = parseFloat(form.tss_ms) / 1000  // ms → s
    if (!isFinite(vout) || vout <= 0 || !isFinite(tss) || tss < 0) return
    const pg_delay = tss + 0.002  // conservative 2 ms settling estimate
    addRail({
      id: newId(),
      name: form.name.trim() || `${vout} V Rail`,
      vout,
      tss,
      pg_delay,
    })
    setShowManual(false)
    setForm(EMPTY_FORM)
  }

  // ── Conflict detection per card ────────────────────────────────────────────

  const conflictedNames = new Set<string>()
  for (const w of result.warnings) {
    const m = w.match(/Rail "([^"]+)" enables before "([^"]+)"/)
    if (m) { conflictedNames.add(m[1]); conflictedNames.add(m[2]) }
  }

  if (!isSequencing) return null

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setIsSequencing(false)}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Power Sequencing Analysis</span>
          <span className={styles.subtitle}>{rails.length} / 8 rails</span>
          <button className={styles.closeBtn} onClick={() => setIsSequencing(false)}>×</button>
        </div>

        {/* Body */}
        <div className={styles.body}>

          {/* Left — rail list */}
          <div className={styles.leftPanel}>
            <div className={styles.railList}>
              {rails.length === 0 && (
                <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Add rails using the buttons below. Load from a <strong>.pswb</strong> project file or enter values manually.
                </div>
              )}
              {rails.map((rail, i) => (
                <div
                  key={rail.id}
                  className={`${styles.railCard} ${conflictedNames.has(rail.name) ? styles.railCardConflict : ''}`}
                >
                  <div className={styles.railCardRow}>
                    <span className={styles.railName} title={rail.name}>{rail.name}</span>
                    <span className={styles.railVout}>{rail.vout} V</span>
                    <div className={styles.orderBtns}>
                      <button className={styles.orderBtn} onClick={() => moveRail(rail.id, -1)} disabled={i === 0} title="Move up">↑</button>
                      <button className={styles.orderBtn} onClick={() => moveRail(rail.id, 1)} disabled={i === rails.length - 1} title="Move down">↓</button>
                    </div>
                    <button className={styles.removeBtn} onClick={() => removeRail(rail.id)} title="Remove rail">×</button>
                  </div>
                  <div className={styles.railMeta}>
                    <span>tss: {fmtMs(rail.tss)}</span>
                    <span>PG: {fmtMs(rail.pg_delay)}</span>
                  </div>
                  <div className={styles.railSource}>
                    {rail.spec ? 'loaded from file' : 'manual entry'}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className={styles.railActions}>
              {showManual && (
                <div className={styles.manualForm}>
                  <div className={styles.formRow}>
                    <span className={styles.formLabel}>Name</span>
                    <input
                      className={styles.formInput}
                      placeholder="e.g. VDD_CORE"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <span className={styles.formLabel}>Vout</span>
                    <input
                      className={styles.formInput}
                      type="number"
                      min="0.1"
                      max="100"
                      step="0.1"
                      value={form.vout}
                      onChange={(e) => setForm({ ...form, vout: e.target.value })}
                    />
                    <span className={styles.formUnit}>V</span>
                  </div>
                  <div className={styles.formRow}>
                    <span className={styles.formLabel}>Soft-start</span>
                    <input
                      className={styles.formInput}
                      type="number"
                      min="0.1"
                      max="500"
                      step="0.1"
                      value={form.tss_ms}
                      onChange={(e) => setForm({ ...form, tss_ms: e.target.value })}
                    />
                    <span className={styles.formUnit}>ms</span>
                  </div>
                  <div className={styles.formActions}>
                    <button className={styles.formCancelBtn} onClick={() => { setShowManual(false); setForm(EMPTY_FORM) }}>
                      Cancel
                    </button>
                    <button className={styles.formAddBtn} onClick={handleAddManual}>
                      Add Rail
                    </button>
                  </div>
                </div>
              )}

              {!showManual && (
                <div className={styles.actionRow}>
                  <button
                    className={styles.addBtn}
                    onClick={handleLoadFile}
                    disabled={rails.length >= 8}
                    title="Open a .pswb project file"
                  >
                    + From File
                  </button>
                  <button
                    className={styles.addBtn}
                    onClick={() => setShowManual(true)}
                    disabled={rails.length >= 8}
                  >
                    + Manual
                  </button>
                </div>
              )}

              {!matchesRecommended && rails.length > 1 && !showManual && (
                <button className={styles.resetOrderBtn} onClick={resetOrder}>
                  Reset to recommended order
                </button>
              )}
            </div>
          </div>

          {/* Right — timing diagram */}
          <div className={styles.rightPanel}>
            <div className={styles.chartHeader}>
              <span>Timing Diagram</span>
              {rails.length > 0 && !matchesRecommended && (
                <span className={styles.orderNote}>custom order</span>
              )}
              {rails.length > 0 && matchesRecommended && (
                <span className={styles.orderNote}>recommended order</span>
              )}
            </div>
            {rails.length === 0 ? (
              <div className={styles.emptyChart}>
                <span>No rails added yet.</span>
                <span className={styles.emptyHint}>
                  Add rails from .pswb project files or enter voltage, soft-start time, and name manually.
                  The timing diagram shows the sequential power-up chain with PG assertion markers.
                </span>
              </div>
            ) : (
              <div className={styles.svgWrap}>
                <svg ref={svgRef} className={styles.svg} />
              </div>
            )}
          </div>
        </div>

        {/* Stats + Warnings footer */}
        {rails.length > 0 && (
          <div className={styles.statsBar}>
            <span className={styles.stat}>
              Rails: <strong>{rails.length}</strong>
            </span>
            <span className={styles.stat}>
              Total boot: <strong>{result.total_time_ms.toFixed(1)} ms</strong>
            </span>
            <span className={styles.stat}>
              Warnings: <strong>{result.warnings.length}</strong>
            </span>
          </div>
        )}

        <div className={styles.footer}>
          {result.warnings.length === 0 ? (
            <span className={styles.noWarnings}>
              {rails.length > 1 ? 'No sequencing conflicts detected.' : 'Add rails to begin analysis.'}
            </span>
          ) : (
            <div className={styles.warnList}>
              {result.warnings.map((w, i) => (
                <div key={i} className={styles.warn}>
                  <span className={styles.warnIcon}>⚠</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
