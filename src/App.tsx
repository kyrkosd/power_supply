// Root application shell: worker bridge, keyboard shortcuts, share-link handlers.
import React, { useEffect } from 'react'
import { Toolbar }          from './components/Toolbar/Toolbar'
import { InputPanel }       from './components/InputPanel/InputPanel'
import { SchematicView }    from './components/SchematicView/SchematicView'
import { TabPanel }         from './components/TabPanel/TabPanel'
import { FirstRunWelcome }  from './components/FirstRunWelcome/FirstRunWelcome'
import { StatusBar }        from './components/StatusBar/StatusBar'
import { useDesignStore }   from './store/design-store'
import { DesignComparison } from './components/ComparisonView/DesignComparison'
import { SequencingView }   from './components/SequencingView/SequencingView'
import { Settings }         from './components/Settings/Settings'
import { EquationExplorer } from './components/EquationExplorer/EquationExplorer'
import { SweepView }        from './components/SweepView/SweepView'
import { DesignLibrary }    from './components/DesignLibrary/DesignLibrary'
import { ShareModal, PasteConfirmModal } from './components/ShareModal/ShareModal'
import { TopologySelector } from './components/TopologySelector/TopologySelector'
import { RightPanel }       from './components/RightPanel/RightPanel'
import { isPswbLink, decodeDesign } from './export/share-link'
import { useAppWorker }     from './useAppWorker'
import { handleFileShortcut, handleEditShortcut } from './appShortcuts'
import styles from './App.module.css'

export default function App(): React.ReactElement {
  const setActiveVizTab  = useDesignStore((s) => s.setActiveVizTab)
  const newProject       = useDesignStore((s) => s.newProject)
  const openProject      = useDesignStore((s) => s.openProject)
  const saveProject      = useDesignStore((s) => s.saveProject)
  const saveProjectAs    = useDesignStore((s) => s.saveProjectAs)
  const undo             = useDesignStore((s) => s.undo)
  const redo             = useDesignStore((s) => s.redo)
  const saveToComparison = useDesignStore((s) => s.saveToComparison)
  const setIsComparing   = useDesignStore((s) => s.setIsComparing)
  const setIsLibraryOpen = useDesignStore((s) => s.setIsLibraryOpen)
  const setPendingShareDesign = useDesignStore((s) => s.setPendingShareDesign)

  useAppWorker()

  useEffect(() => {
    const fileH = { newProject, openProject, saveProject, saveProjectAs }
    const editH = { undo, redo, setActiveVizTab, saveToComparison, setIsComparing, setIsLibraryOpen }
    function onKeyDown(e: KeyboardEvent): void {
      if (handleFileShortcut(e, fileH)) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      handleEditShortcut(e, editH)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setActiveVizTab, newProject, openProject, saveProject, saveProjectAs, undo, redo, saveToComparison, setIsComparing, setIsLibraryOpen])

  useEffect(() => {
    window.shareAPI?.onDeepLink((url) => { const d = decodeDesign(url); if (d) setPendingShareDesign(d) })
    window.shareAPI?.getLaunchLink().then((url) => { if (!url) return; const d = decodeDesign(url); if (d) setPendingShareDesign(d) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onPaste(e: ClipboardEvent): void {
      const text = e.clipboardData?.getData('text') ?? ''
      if (!isPswbLink(text)) return
      const design = decodeDesign(text.trim())
      if (!design) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      setPendingShareDesign(design)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [setPendingShareDesign])

  return (
    <div className={styles.shell}>
      <FirstRunWelcome />
      <DesignComparison />
      <SequencingView />
      <Settings />
      <EquationExplorer />
      <SweepView />
      <DesignLibrary />
      <ShareModal />
      <PasteConfirmModal />
      <Toolbar />
      <div className={styles.workspace}>
        <aside className={styles.leftCol}>
          <TopologySelector />
          <InputPanel />
        </aside>
        <div className={styles.centerCol}>
          <div className={styles.schematicArea}><SchematicView /></div>
          <div className={styles.vizArea}><TabPanel /></div>
        </div>
        <aside className={styles.rightCol}><RightPanel /></aside>
      </div>
      <StatusBar />
    </div>
  )
}
