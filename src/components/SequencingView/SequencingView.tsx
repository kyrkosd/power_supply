// Power sequencing analysis modal: timing diagram, rail management, conflict detection.
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useDesignStore } from '../../store/design-store'
import { compute } from '../../engine/index'
import { designSoftStart } from '../../engine/soft-start'
import { analyzeSequencing, estimatePgDelay, recommendedOrder } from '../../engine/sequencing'
import type { SequencingRail, SequencingResult } from '../../engine/sequencing'
import { drawDiagram } from './sequencingDiagram'
import { SequencingRailPanel, type ManualForm, EMPTY_FORM } from './SequencingRailPanel'
import styles from './SequencingView.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generates a short random string ID for new rails. */
function newId(): string { return crypto.randomUUID().replace(/-/g, '').slice(0, 7) }

/** Sorts rails by recommended power-up priority: core (≤1.8 V) → I/O (≤3.3 V) → HV. */
function sortByPriority(arr: SequencingRail[]): SequencingRail[] {
  return [...arr].sort((a, b) => {
    const ga = a.vout <= 1.8 ? 0 : a.vout <= 3.3 ? 1 : 2
    const gb = b.vout <= 1.8 ? 0 : b.vout <= 3.3 ? 1 : 2
    return ga !== gb ? ga - gb : a.vout - b.vout
  })
}

/** Extracts rail names referenced in conflict warnings for highlight rendering. */
function conflictNames(warnings: string[]): Set<string> {
  const s = new Set<string>()
  for (const w of warnings) {
    const m = w.match(/Rail "([^"]+)" enables before "([^"]+)"/)
    if (m) { s.add(m[1]); s.add(m[2]) }
  }
  return s
}

// ── Main component ────────────────────────────────────────────────────────────

/** Sequencing analysis modal — opens via ⏱ toolbar button. */
export function SequencingView(): React.ReactElement | null {
  const isSequencing    = useDesignStore((s) => s.isSequencing)
  const setIsSequencing = useDesignStore((s) => s.setIsSequencing)

  const [rails,      setRails]      = useState<SequencingRail[]>([])
  const [showManual, setShowManual] = useState(false)
  const [form,       setForm]       = useState<ManualForm>(EMPTY_FORM)
  const [isOrdered,  setIsOrdered]  = useState(false)

  const svgRef = useRef<SVGSVGElement>(null)

  const result: SequencingResult = analyzeSequencing(rails)
  const recOrder         = recommendedOrder(rails)
  const matchesRecommended = recOrder.length === rails.length && recOrder.every((n, i) => n === rails[i].name)

  // Redraw timing diagram on every result change
  useEffect(() => {
    if (svgRef.current) drawDiagram(svgRef.current, result)
  }, [result])

  // Close on Escape
  useEffect(() => {
    if (!isSequencing) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setIsSequencing(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isSequencing, setIsSequencing])

  // ── Rail mutations ──────────────────────────────────────────────────────────

  const addRail = useCallback((rail: SequencingRail) => {
    setRails((prev) => {
      if (prev.length >= 8) return prev
      const next = [...prev, rail]
      return isOrdered ? next : sortByPriority(next)
    })
  }, [isOrdered])

  function removeRail(id: string): void { setRails((prev) => prev.filter((r) => r.id !== id)) }

  function moveRail(id: string, dir: -1 | 1): void {
    setIsOrdered(true)
    setRails((prev) => {
      const idx  = prev.findIndex((r) => r.id === id)
      const next = idx + dir
      if (idx < 0 || next < 0 || next >= prev.length) return prev
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr
    })
  }

  function resetOrder(): void { setIsOrdered(false); setRails((prev) => sortByPriority(prev)) }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleLoadFile(): Promise<void> {
    const res = await window.projectAPI?.open()
    if (!res?.success || !res.project) return
    const { topology, spec } = res.project
    const designResult = compute(topology, spec)
    const ss      = designSoftStart(topology, spec, designResult)
    const pgDelay = estimatePgDelay(ss.tss_used, spec, null)
    const rawName = res.filePath?.split(/[\\/]/).pop()?.replace(/\.pswb$/i, '') ?? `Rail ${rails.length + 1}`
    addRail({ id: newId(), name: rawName, vout: spec.vout, tss: ss.tss_used, pg_delay: pgDelay, spec })
  }

  function handleAddManual(): void {
    const vout = parseFloat(form.vout)
    const tss  = parseFloat(form.tss_ms) / 1000
    if (!isFinite(vout) || vout <= 0 || !isFinite(tss) || tss < 0) return
    addRail({ id: newId(), name: form.name.trim() || `${vout} V Rail`, vout, tss, pg_delay: tss + 0.002 })
    setShowManual(false)
    setForm(EMPTY_FORM)
  }

  const conflicted = conflictNames(result.warnings)

  if (!isSequencing) return null

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setIsSequencing(false)}>
      <div className={styles.modal}>

        <div className={styles.header}>
          <span className={styles.title}>Power Sequencing Analysis</span>
          <span className={styles.subtitle}>{rails.length} / 8 rails</span>
          <button className={styles.closeBtn} onClick={() => setIsSequencing(false)}>×</button>
        </div>

        <div className={styles.body}>
          <SequencingRailPanel
            rails={rails} conflictedNames={conflicted}
            showManual={showManual} form={form}
            matchesRecommended={matchesRecommended}
            onMoveRail={moveRail} onRemoveRail={removeRail}
            onFormChange={setForm} onAddManual={handleAddManual}
            onLoadFile={handleLoadFile} onToggleManual={setShowManual}
            onResetOrder={resetOrder}
          />

          <div className={styles.rightPanel}>
            <div className={styles.chartHeader}>
              <span>Timing Diagram</span>
              {rails.length > 0 && (
                <span className={styles.orderNote}>
                  {matchesRecommended ? 'recommended order' : 'custom order'}
                </span>
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
              <div className={styles.svgWrap}><svg ref={svgRef} className={styles.svg} /></div>
            )}
          </div>
        </div>

        {rails.length > 0 && (
          <div className={styles.statsBar}>
            <span className={styles.stat}>Rails: <strong>{rails.length}</strong></span>
            <span className={styles.stat}>Total boot: <strong>{result.total_time_ms.toFixed(1)} ms</strong></span>
            <span className={styles.stat}>Warnings: <strong>{result.warnings.length}</strong></span>
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
                  <span className={styles.warnIcon}>⚠</span><span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
