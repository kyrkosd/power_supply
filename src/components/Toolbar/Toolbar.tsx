import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useDesignStore } from '../../store/design-store'
import { HelpPanel } from '../HelpPanel/HelpPanel'
import { generateReport } from '../../export/pdf-report'
import { generateBOM } from '../../export/bom-export'
import styles from './Toolbar.module.css'

export function Toolbar(): React.ReactElement {
  const {
    currentProjectPath, isModified,
    newProject, openProject, saveProject, saveProjectAs,
    undo, redo, canUndo, canRedo,
    topology, spec, result, notes, activeVizTab, setActiveVizTab,
    selectedComponents, feedbackOptions, softStartOptions,
    comparisonSlot, saveToComparison, setIsComparing,
    setIsSettingsOpen, setIsSweepOpen, setIsLibraryOpen,
    setIsSequencing, setIsShareOpen,
  } = useDesignStore()

  const [isExporting, setIsExporting] = useState(false)
  const [isExportingBOM, setIsExportingBOM] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)

  // Sync window title
  useEffect(() => {
    window.projectAPI?.setTitle(currentProjectPath, isModified)
  }, [currentProjectPath, isModified])

  // Close dropdowns on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const projectName = currentProjectPath
    ? currentProjectPath.replace(/.*[\\/]/, '')
    : null

  const handleExport = useCallback(async () => {
    if (!result || isExporting) return
    setIsExporting(true)
    setExportOpen(false)
    try {
      const blob = await generateReport({ topology, spec, result, notes, setActiveVizTab, currentTab: activeVizTab })
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
    setExportOpen(false)
    try {
      const csv = generateBOM(topology, spec, result, selectedComponents, feedbackOptions, softStartOptions)
      await window.exportAPI?.saveCsv(csv, `${topology}_bom.csv`)
    } catch (err) {
      console.error('BOM export failed:', err)
    } finally {
      setIsExportingBOM(false)
    }
  }, [result, isExportingBOM, topology, spec, selectedComponents])

  return (
    <header className={styles.toolbar}>
      {/* Brand */}
      <div className={styles.brand}>
        <span className={styles.logo}>⚡</span>
        <span className={styles.title}>Power Supply Workbench</span>
      </div>

      {/* Project name — centered */}
      <div className={styles.projectName}>
        {projectName
          ? <>{projectName}{isModified ? <span className={styles.dot}> •</span> : null}</>
          : isModified
            ? <span className={styles.dot}>Unsaved •</span>
            : null}
      </div>

      {/* File actions */}
      <div className={styles.fileGroup}>
        <button className={styles.btn} onClick={newProject} title="New project (Ctrl+N)">New</button>
        <button className={styles.btn} onClick={openProject} title="Open project (Ctrl+O)">Open</button>
        <button className={styles.btn} onClick={saveProject} title={`Save${currentProjectPath ? '' : ' as'} (Ctrl+S)`}>Save</button>
        <button className={styles.btn} onClick={saveProjectAs} title="Save as (Ctrl+Shift+S)">Save As</button>
      </div>

      <div className={styles.divider} />

      {/* Undo / Redo */}
      <button className={styles.btn} onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">←</button>
      <button className={styles.btn} onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">→</button>

      <div className={styles.divider} />

      {/* Export dropdown */}
      <div className={styles.dropdownWrap} ref={exportRef}>
        <button
          className={styles.btn}
          onClick={() => setExportOpen(v => !v)}
          disabled={!result}
          title={result ? 'Export PDF or BOM' : 'Run simulation first'}
        >
          {isExporting || isExportingBOM ? '⏳' : '↓'} Export ▾
        </button>
        {exportOpen && (
          <div className={styles.dropdown}>
            <button
              className={styles.dropItem}
              onClick={handleExport}
              disabled={!result || isExporting}
            >
              {isExporting ? '⏳ Generating…' : '↓ PDF Report'}
            </button>
            <button
              className={styles.dropItem}
              onClick={handleExportBOM}
              disabled={!result || isExportingBOM}
            >
              {isExportingBOM ? '⏳ Generating…' : '↓ Bill of Materials (CSV)'}
            </button>
          </div>
        )}
      </div>

      {/* Share */}
      <button className={styles.btn} onClick={() => setIsShareOpen(true)} title="Share — copy a pswb:// link to clipboard">
        ⇗ Share
      </button>

      {/* Save to comparison A */}
      <button
        className={styles.btn}
        onClick={saveToComparison}
        disabled={!result}
        title={result ? 'Save current design as Design A for comparison (Ctrl+K)' : 'Run simulation first'}
      >
        {comparisonSlot ? '✓ A' : '⊞ A'}
      </button>

      {/* Compare */}
      <button
        className={styles.btn}
        onClick={() => setIsComparing(true)}
        disabled={!comparisonSlot || !result}
        title={comparisonSlot && result ? 'Compare Design A vs current (Ctrl+Shift+K)' : 'Save a design first with Ctrl+K'}
      >
        ⇄ Compare
      </button>

      <div className={styles.divider} />

      {/* Overflow "..." menu */}
      <div className={styles.dropdownWrap} ref={overflowRef}>
        <button
          className={styles.btn}
          onClick={() => setOverflowOpen(v => !v)}
          title="More tools"
          aria-label="More"
        >
          •••
        </button>
        {overflowOpen && (
          <div className={`${styles.dropdown} ${styles.dropdownRight}`}>
            <button className={styles.dropItem} onClick={() => { setIsLibraryOpen(true); setOverflowOpen(false) }}>
              📚 Design Library  <kbd>Ctrl+L</kbd>
            </button>
            <button className={styles.dropItem} onClick={() => { setIsSequencing(true); setOverflowOpen(false) }}>
              ⏱ Sequencing
            </button>
            <button className={styles.dropItem} onClick={() => { setIsSweepOpen(true); setOverflowOpen(false) }}>
              ∿ Parameter Sweep
            </button>
            <div className={styles.dropDivider} />
            <button className={styles.dropItem} onClick={() => { setIsSettingsOpen(true); setOverflowOpen(false) }}>
              ⚙ Settings
            </button>
            <div className={styles.dropDivider} />
            <div className={styles.dropHelpItem}>
              <HelpPanel />
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
