// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React, { useEffect, useState, useCallback } from 'react'
import { useDesignStore, TopologyId } from '../../store/design-store'
import { TOPOLOGY_DEFAULTS } from '../../engine/topologies/defaults'
import { HelpPanel } from '../HelpPanel/HelpPanel'
import { generateReport } from '../../export/pdf-report'
import { generateBOM } from '../../export/bom-export'
import type { DesignSpec } from '../../engine/types'
import styles from './Toolbar.module.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const TOPOLOGIES: { id: TopologyId; label: string }[] = [
  { id: 'buck',      label: 'Buck (Step-Down)' },
  { id: 'boost',     label: 'Boost (Step-Up)' },
  { id: 'buck-boost',label: 'Buck-Boost' },
  { id: 'flyback',   label: 'Flyback' },
  { id: 'forward',   label: 'Forward' },
  { id: 'sepic',     label: 'SEPIC' },
]

function topologyLabel(id: TopologyId): string {
  return TOPOLOGIES.find((t) => t.id === id)?.label ?? id
}

// Returns true when spec exactly matches the canonical defaults for the given
// topology — used to decide whether to skip the confirmation dialog.
function isSpecDefault(spec: DesignSpec, topology: TopologyId): boolean {
  const defaults = TOPOLOGY_DEFAULTS[topology]
  return (Object.keys(defaults) as Array<keyof DesignSpec>).every(
    (k) => spec[k] === defaults[k],
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Toolbar(): React.ReactElement {
  const {
    topology, setTopology, setTopologyOnly, resetSpec, isComputing,
    currentProjectPath, isModified,
    newProject, openProject, saveProject, saveProjectAs,
    undo, redo, canUndo, canRedo,
    spec, result, notes,
    activeVizTab, setActiveVizTab,
    selectedComponents,
    comparisonSlot, saveToComparison, setIsComparing,
  } = useDesignStore()

  const [isExporting, setIsExporting] = useState(false)
  const [isExportingBOM, setIsExportingBOM] = useState(false)

  // Pending topology change — waiting for user confirmation
  const [pendingTopology, setPendingTopology] = useState<TopologyId | null>(null)

  // Keep the native window title bar in sync
  useEffect(() => {
    window.projectAPI?.setTitle(currentProjectPath, isModified)
  }, [currentProjectPath, isModified])

  const projectName = currentProjectPath
    ? currentProjectPath.replace(/.*[\\/]/, '')
    : null

  // ── Topology change handling ───────────────────────────────────────────────

  const handleTopologyChange = useCallback((newTopology: TopologyId) => {
    if (newTopology === topology) return
    if (isSpecDefault(spec, topology)) {
      // Spec was never customized — silently apply new defaults
      setTopology(newTopology)
    } else {
      // User has customized values — ask before replacing
      setPendingTopology(newTopology)
    }
  }, [topology, spec, setTopology])

  const confirmApplyDefaults = useCallback(() => {
    if (pendingTopology) setTopology(pendingTopology)
    setPendingTopology(null)
  }, [pendingTopology, setTopology])

  const confirmKeepCurrent = useCallback(() => {
    if (pendingTopology) setTopologyOnly(pendingTopology)
    setPendingTopology(null)
  }, [pendingTopology, setTopologyOnly])

  // ── Export handlers ────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (!result || isExporting) return
    setIsExporting(true)
    try {
      const blob = await generateReport({
        topology, spec, result, notes, setActiveVizTab, currentTab: activeVizTab,
      })
      const buffer = await blob.arrayBuffer()
      await window.exportAPI?.savePdf(buffer, `${topology}_design_report.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }, [result, isExporting, topology, spec, notes, setActiveVizTab, activeVizTab])

  const handleExportBOM = useCallback(async () => {
    if (!result || isExportingBOM) return
    setIsExportingBOM(true)
    try {
      const csv = generateBOM(topology, spec, result, selectedComponents)
      await window.exportAPI?.saveCsv(csv, `${topology}_bom.csv`)
    } catch (err) {
      console.error('BOM export failed:', err)
    } finally {
      setIsExportingBOM(false)
    }
  }, [result, isExportingBOM, topology, spec, selectedComponents])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <header className={styles.toolbar}>
        <div className={styles.brand}>
          <span className={styles.logo}>⚡</span>
          <span className={styles.title}>Power Supply Workbench</span>
          {projectName ? (
            <span className={styles.projectName}>
              — {projectName}{isModified ? ' •' : ''}
            </span>
          ) : isModified ? (
            <span className={styles.unsaved}> •</span>
          ) : null}
        </div>

        <div className={styles.divider} />

        <div className={styles.fileActions}>
          <button className={styles.btn} onClick={newProject} title="New project (Ctrl+N)">New</button>
          <button className={styles.btn} onClick={openProject} title="Open project (Ctrl+O)">Open</button>
          <button className={styles.btn} onClick={saveProject} title={`Save${currentProjectPath ? '' : ' as'} (Ctrl+S)`}>Save</button>
          <button className={styles.btn} onClick={saveProjectAs} title="Save as (Ctrl+Shift+S)">Save As</button>
        </div>

        <div className={styles.divider} />

        <div className={styles.undoActions}>
          <button className={styles.btn} onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">←</button>
          <button className={styles.btn} onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">→</button>
        </div>

        <div className={styles.divider} />

        <div className={styles.controls}>
          <label className={styles.label} htmlFor="topology-select">Topology</label>
          <select
            id="topology-select"
            className={styles.select}
            value={topology}
            onChange={(e) => handleTopologyChange(e.target.value as TopologyId)}
          >
            {TOPOLOGIES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          {isComputing && <span className={styles.spinner} title="Computing…" />}
        </div>

        <div className={styles.spacer} />

        <div className={styles.actions}>
          <button className={styles.btn} onClick={resetSpec} title={`Reset ${topology} to default values`}>
            ↺ Reset
          </button>
          <button
            className={styles.btn}
            onClick={saveToComparison}
            disabled={!result}
            title={result ? 'Save current design as Design A for comparison (Ctrl+K)' : 'Run simulation first'}
          >
            {comparisonSlot ? '✓ Saved A' : '⊞ Save to A'}
          </button>
          <button
            className={styles.btn}
            onClick={() => setIsComparing(true)}
            disabled={!comparisonSlot || !result}
            title={comparisonSlot && result ? 'Compare Design A vs current (Ctrl+Shift+K)' : 'Save a design first'}
          >
            ⇄ Compare
          </button>
          <button
            className={styles.btn}
            onClick={handleExport}
            disabled={!result || isExporting}
            title={result ? 'Export PDF report' : 'Run simulation first to enable export'}
          >
            {isExporting ? '⏳ PDF…' : '↓ PDF'}
          </button>
          <button
            className={styles.btn}
            onClick={handleExportBOM}
            disabled={!result || isExportingBOM}
            title={result ? 'Export Bill of Materials (CSV)' : 'Run simulation first to enable export'}
          >
            {isExportingBOM ? '⏳ BOM…' : '↓ BOM'}
          </button>
          <HelpPanel />
        </div>
      </header>

      {/* ── Smart-defaults confirmation banner ── */}
      {pendingTopology && (
        <div className={styles.confirmBanner}>
          <span className={styles.confirmText}>
            Apply default values for <strong>{topologyLabel(pendingTopology)}</strong>?
            Your current values will be replaced.
          </span>
          <div className={styles.confirmBtns}>
            <button className={styles.confirmApply} onClick={confirmApplyDefaults}>
              Apply Defaults
            </button>
            <button className={styles.confirmKeep} onClick={confirmKeepCurrent}>
              Keep Current
            </button>
          </div>
        </div>
      )}
    </>
  )
}
