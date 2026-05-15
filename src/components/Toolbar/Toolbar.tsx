// Toolbar: project file actions, undo/redo, export dropdown, share, comparison, and overflow menu.
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useDesignStore } from '../../store/design-store'
import { HelpPanel } from '../HelpPanel/HelpPanel'
import { generateReport } from '../../export/pdf-report'
import { generateBOM } from '../../export/bom-export'
import styles from './Toolbar.module.css'

function isClickOutside(ref: React.RefObject<HTMLElement>, e: MouseEvent): boolean {
  return !!ref.current && !ref.current.contains(e.target as Node)
}

/** Spinner/arrow prefix for the export dropdown trigger button. */
function ExportBtnLabel({ isExporting, isExportingBOM }: { isExporting: boolean; isExportingBOM: boolean }): React.ReactElement {
  return <>{isExporting || isExportingBOM ? '⏳' : '↓'} Export ▾</>
}

/** Two export action buttons shown inside the open export dropdown. */
function ExportMenuItems({ isExporting, isExportingBOM, hasResult, onExport, onExportBOM }: {
  isExporting: boolean; isExportingBOM: boolean; hasResult: boolean
  onExport: () => void; onExportBOM: () => void
}): React.ReactElement {
  return (
    <div className={styles.dropdown}>
      <button className={styles.dropItem} onClick={onExport} disabled={!hasResult || isExporting}>
        {isExporting ? '⏳ Generating…' : '↓ PDF Report'}
      </button>
      <button className={styles.dropItem} onClick={onExportBOM} disabled={!hasResult || isExportingBOM}>
        {isExportingBOM ? '⏳ Generating…' : '↓ Bill of Materials (CSV)'}
      </button>
    </div>
  )
}

/** Save-to-slot and compare buttons. */
function ComparisonButtons({ comparisonSlot, hasResult, onSave, onCompare }: {
  comparisonSlot: unknown; hasResult: boolean; onSave: () => void; onCompare: () => void
}): React.ReactElement {
  return (
    <>
      <button className={styles.btn} onClick={onSave} disabled={!hasResult}
        title={hasResult ? 'Save current design as Design A (Ctrl+K)' : 'Run simulation first'}>
        {comparisonSlot ? '✓ A' : '⊞ A'}
      </button>
      <button className={styles.btn} onClick={onCompare} disabled={!comparisonSlot || !hasResult}
        title={comparisonSlot && hasResult ? 'Compare Design A vs current (Ctrl+Shift+K)' : 'Save a design first with Ctrl+K'}>
        ⇄ Compare
      </button>
    </>
  )
}

/** Overflow "•••" dropdown — returns null when closed. */
function OverflowMenu({ isOpen, onClose, onOpenLibrary, onOpenSequencing, onOpenSweep, onOpenSettings }: {
  isOpen: boolean; onClose: () => void
  onOpenLibrary: () => void; onOpenSequencing: () => void
  onOpenSweep: () => void; onOpenSettings: () => void
}): React.ReactElement | null {
  if (!isOpen) return null
  return (
    <div className={`${styles.dropdown} ${styles.dropdownRight}`}>
      <button className={styles.dropItem} onClick={() => { onOpenLibrary();   onClose() }}>📚 Design Library  <kbd>Ctrl+L</kbd></button>
      <button className={styles.dropItem} onClick={() => { onOpenSequencing(); onClose() }}>⏱ Sequencing</button>
      <button className={styles.dropItem} onClick={() => { onOpenSweep();     onClose() }}>∿ Parameter Sweep</button>
      <div className={styles.dropDivider} />
      <button className={styles.dropItem} onClick={() => { onOpenSettings();  onClose() }}>⚙ Settings</button>
      <div className={styles.dropDivider} />
      <div className={styles.dropHelpItem}><HelpPanel /></div>
    </div>
  )
}

function ProjectNameDisplay({ projectName, isModified }: { projectName: string | null; isModified: boolean }): React.ReactElement | null {
  if (!projectName && !isModified) return null
  if (!projectName) return <span className={styles.dot}>Unsaved •</span>
  return <>{projectName}{isModified && <span className={styles.dot}> •</span>}</>
}

/** Main application toolbar with file, export, share, and tool actions. */
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

  const [isExporting, setIsExporting]     = useState(false)
  const [isExportingBOM, setIsExportingBOM] = useState(false)
  const [exportOpen, setExportOpen]       = useState(false)
  const [overflowOpen, setOverflowOpen]   = useState(false)
  const exportRef   = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)

  // Sync window title with project name + modified flag
  useEffect(() => {
    window.projectAPI?.setTitle(currentProjectPath, isModified)
  }, [currentProjectPath, isModified])

  // Close dropdowns when clicking outside their containers
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (isClickOutside(exportRef,   e)) setExportOpen(false)
    if (isClickOutside(overflowRef, e)) setOverflowOpen(false)
  }, [])

  useEffect(() => {
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [handleOutsideClick])

  const projectName = currentProjectPath ? currentProjectPath.replace(/.*[\\/]/, '') : null

  const handleExport = useCallback(async () => {
    if (!result || isExporting) return
    setIsExporting(true)
    setExportOpen(false)
    try {
      const blob   = await generateReport({ topology, spec, result, notes, setActiveVizTab, currentTab: activeVizTab })
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
  }, [result, isExportingBOM, topology, spec, selectedComponents, feedbackOptions, softStartOptions])

  return (
    <header className={styles.toolbar}>
      {/* Brand */}
      <div className={styles.brand}>
        <span className={styles.logo}>⚡</span>
        <span className={styles.title}>Power Supply Workbench</span>
      </div>

      {/* Centered project name */}
      <div className={styles.projectName}>
        <ProjectNameDisplay projectName={projectName} isModified={isModified} />
      </div>

      {/* File actions */}
      <div className={styles.fileGroup}>
        <button className={styles.btn} onClick={newProject}      title="New project (Ctrl+N)">New</button>
        <button className={styles.btn} onClick={openProject}     title="Open project (Ctrl+O)">Open</button>
        <button className={styles.btn} onClick={saveProject}     title={`Save${currentProjectPath ? '' : ' as'} (Ctrl+S)`}>Save</button>
        <button className={styles.btn} onClick={saveProjectAs}   title="Save as (Ctrl+Shift+S)">Save As</button>
      </div>

      <div className={styles.divider} />

      {/* Undo / Redo */}
      <button className={styles.btn} onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">←</button>
      <button className={styles.btn} onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">→</button>

      <div className={styles.divider} />

      {/* Export dropdown */}
      <div className={styles.dropdownWrap} ref={exportRef}>
        <button className={styles.btn} onClick={() => setExportOpen((v) => !v)} disabled={!result}
          title="Export PDF or BOM">
          <ExportBtnLabel isExporting={isExporting} isExportingBOM={isExportingBOM} />
        </button>
        {exportOpen && <ExportMenuItems isExporting={isExporting} isExportingBOM={isExportingBOM}
          hasResult={!!result} onExport={handleExport} onExportBOM={handleExportBOM} />}
      </div>

      {/* Share */}
      <button className={styles.btn} onClick={() => setIsShareOpen(true)} title="Share — copy a pswb:// link to clipboard">⇗ Share</button>

      {/* Save / Compare */}
      <ComparisonButtons comparisonSlot={comparisonSlot} hasResult={!!result}
        onSave={saveToComparison} onCompare={() => setIsComparing(true)} />

      <div className={styles.divider} />

      {/* Overflow "•••" menu */}
      <div className={styles.dropdownWrap} ref={overflowRef}>
        <button className={styles.btn} onClick={() => setOverflowOpen((v) => !v)} title="More tools" aria-label="More">•••</button>
        <OverflowMenu isOpen={overflowOpen} onClose={() => setOverflowOpen(false)}
          onOpenLibrary={() => setIsLibraryOpen(true)}
          onOpenSequencing={() => setIsSequencing(true)}
          onOpenSweep={() => setIsSweepOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)} />
      </div>
    </header>
  )
}
