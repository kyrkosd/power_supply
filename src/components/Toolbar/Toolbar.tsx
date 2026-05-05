import React, { useEffect, useState, useCallback } from 'react'
import { useDesignStore, TopologyId } from '../../store/design-store'
import { HelpPanel } from '../HelpPanel/HelpPanel'
import { generateReport } from '../../export/pdf-report'
import { generateBOM } from '../../export/bom-export'
import styles from './Toolbar.module.css'

const TOPOLOGIES: { id: TopologyId; label: string }[] = [
  { id: 'buck',      label: 'Buck (Step-Down)' },
  { id: 'boost',     label: 'Boost (Step-Up)' },
  { id: 'buck-boost',label: 'Buck-Boost' },
  { id: 'flyback',   label: 'Flyback' },
  { id: 'forward',   label: 'Forward' },
  { id: 'sepic',     label: 'SEPIC' }
]

export function Toolbar(): React.ReactElement {
  const {
    topology, setTopology, resetSpec, isComputing,
    currentProjectPath, isModified,
    newProject, openProject, saveProject, saveProjectAs,
    undo, redo, canUndo, canRedo,
    spec, result, notes,
    activeVizTab, setActiveVizTab,
    selectedComponents,
  } = useDesignStore()

  const [isExporting, setIsExporting] = useState(false)
  const [isExportingBOM, setIsExportingBOM] = useState(false)

  // Keep the native window title bar in sync
  useEffect(() => {
    window.projectAPI?.setTitle(currentProjectPath, isModified)
  }, [currentProjectPath, isModified])

  const projectName = currentProjectPath
    ? currentProjectPath.replace(/.*[\\/]/, '')
    : null

  const handleExport = useCallback(async () => {
    if (!result || isExporting) return
    setIsExporting(true)
    try {
      const blob = await generateReport({
        topology,
        spec,
        result,
        notes,
        setActiveVizTab,
        currentTab: activeVizTab,
      })
      const buffer = await blob.arrayBuffer()
      const defaultName = `${topology}_design_report.pdf`
      await window.exportAPI?.savePdf(buffer, defaultName)
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
      const defaultName = `${topology}_bom.csv`
      await window.exportAPI?.saveCsv(csv, defaultName)
    } catch (err) {
      console.error('BOM export failed:', err)
    } finally {
      setIsExportingBOM(false)
    }
  }, [result, isExportingBOM, topology, spec, selectedComponents])

  return (
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
        <button className={styles.btn} onClick={newProject} title="New project (Ctrl+N)">
          New
        </button>
        <button className={styles.btn} onClick={openProject} title="Open project (Ctrl+O)">
          Open
        </button>
        <button
          className={styles.btn}
          onClick={saveProject}
          title={`Save${currentProjectPath ? '' : ' as'} (Ctrl+S)`}
        >
          Save
        </button>
        <button className={styles.btn} onClick={saveProjectAs} title="Save as (Ctrl+Shift+S)">
          Save As
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.undoActions}>
        <button
          className={styles.btn}
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          ←
        </button>
        <button
          className={styles.btn}
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          →
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.controls}>
        <label className={styles.label} htmlFor="topology-select">
          Topology
        </label>
        <select
          id="topology-select"
          className={styles.select}
          value={topology}
          onChange={(e) => setTopology(e.target.value as TopologyId)}
        >
          {TOPOLOGIES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {isComputing && <span className={styles.spinner} title="Computing…" />}
      </div>

      <div className={styles.spacer} />

      <div className={styles.actions}>
        <button
          className={styles.btn}
          onClick={resetSpec}
          title={`Reset ${topology} to default values`}
        >
          ↺ Reset
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
  )
}
