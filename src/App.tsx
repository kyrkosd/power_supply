// Root application shell: worker bridge, keyboard shortcuts, share-link handlers, plugin loader.
import React, { useEffect, useRef, useCallback } from 'react'
import { Toolbar }          from './components/Toolbar/Toolbar'
import { InputPanel }       from './components/InputPanel/InputPanel'
import { SchematicView }    from './components/SchematicView/SchematicView'
import { TabPanel }         from './components/TabPanel/TabPanel'
import { FirstRunWelcome }  from './components/FirstRunWelcome/FirstRunWelcome'
import { StatusBar }        from './components/StatusBar/StatusBar'
import { useDesignStore, type ActiveVizTab } from './store/design-store'
import type { PluginSource } from './engine/plugin-types'
import { DesignComparison } from './components/ComparisonView/DesignComparison'
import { SequencingView }   from './components/SequencingView/SequencingView'
import { Settings }         from './components/Settings/Settings'
import { EquationExplorer } from './components/EquationExplorer/EquationExplorer'
import { SweepView }        from './components/SweepView/SweepView'
import { DesignLibrary }    from './components/DesignLibrary/DesignLibrary'
import { ShareModal, PasteConfirmModal } from './components/ShareModal/ShareModal'
import { TopologySelector } from './components/TopologySelector/TopologySelector'
import { RightPanel }       from './components/RightPanel/RightPanel'
import { validateSpec }     from './engine/validation'
import { isPswbLink, decodeDesign } from './export/share-link'
import styles from './App.module.css'

// ── Keyboard shortcut handlers ────────────────────────────────────────────────

type FileHandlers = { newProject: () => void; openProject: () => void; saveProject: () => void; saveProjectAs: () => void }
type EditHandlers = { undo: () => void; redo: () => void; setActiveVizTab: (t: ActiveVizTab) => void; saveToComparison: () => void; setIsComparing: (v: boolean) => void; setIsLibraryOpen: (v: boolean) => void }

/** Handle Ctrl+N/O/S file shortcuts; returns true if event was consumed. */
function handleFileShortcut(event: KeyboardEvent, h: FileHandlers): boolean {
  if (!event.ctrlKey && !event.metaKey) return false
  if (event.key === 'n' && !event.shiftKey) { event.preventDefault(); h.newProject();    return true }
  if (event.key === 'o' && !event.shiftKey) { event.preventDefault(); h.openProject();   return true }
  if (event.key === 's') { event.preventDefault(); event.shiftKey ? h.saveProjectAs() : h.saveProject(); return true }
  return false
}

/** Handle Ctrl+Z/Y/K/L/1–4 edit and navigation shortcuts. */
function handleEditShortcut(event: KeyboardEvent, h: EditHandlers): void {
  if (!event.ctrlKey && !event.metaKey) return
  switch (event.key) {
    case 'z': event.preventDefault(); event.shiftKey ? h.redo() : h.undo(); break
    case 'y': event.preventDefault(); h.redo(); break
    case 'k': event.preventDefault(); event.shiftKey ? h.setIsComparing(true) : h.saveToComparison(); break
    case 'l': event.preventDefault(); h.setIsLibraryOpen(true); break
    case '1': event.preventDefault(); h.setActiveVizTab('waveforms'); break
    case '2': event.preventDefault(); h.setActiveVizTab('bode'); break
    case '3': event.preventDefault(); h.setActiveVizTab('losses'); break
    case '4': event.preventDefault(); h.setActiveVizTab('thermal'); break
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Root shell: renders the 3-column layout and owns all worker communication. */
export default function App(): React.ReactElement {
  const topology          = useDesignStore((s) => s.topology)
  const spec              = useDesignStore((s) => s.spec)
  const setResult         = useDesignStore((s) => s.setResult)
  const setMcResult       = useDesignStore((s) => s.setMcResult)
  const mcRunRequest      = useDesignStore((s) => s.mcRunRequest)
  const clearMcRunRequest = useDesignStore((s) => s.clearMcRunRequest)
  const setActiveVizTab   = useDesignStore((s) => s.setActiveVizTab)
  const newProject        = useDesignStore((s) => s.newProject)
  const openProject       = useDesignStore((s) => s.openProject)
  const saveProject       = useDesignStore((s) => s.saveProject)
  const saveProjectAs     = useDesignStore((s) => s.saveProjectAs)
  const undo              = useDesignStore((s) => s.undo)
  const redo              = useDesignStore((s) => s.redo)
  const cancelComputing   = useDesignStore((s) => s.cancelComputing)
  const saveToComparison  = useDesignStore((s) => s.saveToComparison)
  const setIsComparing    = useDesignStore((s) => s.setIsComparing)
  const efficiencyMapRequest      = useDesignStore((s) => s.efficiencyMapRequest)
  const clearEfficiencyMapRequest = useDesignStore((s) => s.clearEfficiencyMapRequest)
  const setEfficiencyMapResult    = useDesignStore((s) => s.setEfficiencyMapResult)
  const transientRunRequest       = useDesignStore((s) => s.transientRunRequest)
  const clearTransientRunRequest  = useDesignStore((s) => s.clearTransientRunRequest)
  const setTransientResult        = useDesignStore((s) => s.setTransientResult)
  const setEmiResult              = useDesignStore((s) => s.setEmiResult)
  const sweepRequest              = useDesignStore((s) => s.sweepRequest)
  const clearSweepRequest         = useDesignStore((s) => s.clearSweepRequest)
  const setSweepResult            = useDesignStore((s) => s.setSweepResult)
  const setSweepProgress          = useDesignStore((s) => s.setSweepProgress)
  const setIsLibraryOpen          = useDesignStore((s) => s.setIsLibraryOpen)
  const pluginTopologyId          = useDesignStore((s) => s.pluginTopologyId)
  const disabledPluginIds         = useDesignStore((s) => s.disabledPluginIds)
  const setPlugins                = useDesignStore((s) => s.setPlugins)
  const pluginReloadRequest       = useDesignStore((s) => s.pluginReloadRequest)
  const setPendingShareDesign     = useDesignStore((s) => s.setPendingShareDesign)

  const workerRef = useRef<Worker | null>(null)

  // Worker message dispatcher — named callback so the worker lifecycle effect stays minimal
  const handleWorkerMsg = useCallback((event: MessageEvent): void => {
    const { type, payload } = event.data ?? {}
    if (!type || !payload) return
    switch (type) {
      case 'RESULT':
        setResult(payload.result, payload.waveforms)
        if (payload.emiResult) setEmiResult(payload.emiResult)
        break
      case 'MC_RESULT':             setMcResult(payload); break
      case 'EFFICIENCY_MAP_RESULT': setEfficiencyMapResult(payload); break
      case 'TRANSIENT_RESULT':      setTransientResult(payload); break
      case 'SWEEP_PROGRESS':        setSweepProgress(payload.current, payload.total); break
      case 'SWEEP_RESULT':          setSweepResult(payload); break
      case 'PLUGINS_LOADED':        setPlugins(payload.plugins); break
      case 'ERROR':                 console.error('Engine worker error:', payload.message); break
    }
  }, [setResult, setMcResult, setEfficiencyMapResult, setTransientResult, setEmiResult, setSweepResult, setSweepProgress, setPlugins])

  // Worker lifecycle
  useEffect(() => {
    const worker = new Worker(new URL('./engine/worker.ts', import.meta.url), { type: 'module' })
    worker.addEventListener('message', handleWorkerMsg)
    workerRef.current = worker
    return () => { worker.removeEventListener('message', handleWorkerMsg); worker.terminate(); workerRef.current = null }
  }, [handleWorkerMsg])

  // Keyboard shortcuts
  useEffect(() => {
    const fileH: FileHandlers = { newProject, openProject, saveProject, saveProjectAs }
    const editH: EditHandlers = { undo, redo, setActiveVizTab, saveToComparison, setIsComparing, setIsLibraryOpen }
    function onKeyDown(e: KeyboardEvent): void {
      if (handleFileShortcut(e, fileH)) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      handleEditShortcut(e, editH)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setActiveVizTab, newProject, openProject, saveProject, saveProjectAs, undo, redo, saveToComparison, setIsComparing, setIsLibraryOpen])

  // Dispatch design computation on spec/topology change
  useEffect(() => {
    const activeTopology = pluginTopologyId ?? topology
    if (!pluginTopologyId) {
      const { valid } = validateSpec(topology, spec)
      if (!valid) { cancelComputing(); return }
    }
    workerRef.current?.postMessage({ type: 'COMPUTE', payload: { topology: activeTopology, spec } })
  }, [topology, spec, pluginTopologyId, cancelComputing])

  // Dispatch efficiency map, Monte Carlo, transient, and sweep requests
  useEffect(() => {
    if (!efficiencyMapRequest) return
    workerRef.current?.postMessage({ type: 'EFFICIENCY_MAP', payload: efficiencyMapRequest })
    clearEfficiencyMapRequest()
  }, [efficiencyMapRequest, clearEfficiencyMapRequest])

  useEffect(() => {
    if (!mcRunRequest) return
    const { iterations, seed, computePhaseMargin } = mcRunRequest
    workerRef.current?.postMessage({ type: 'MC_COMPUTE', payload: { topology, spec, mcConfig: { iterations, seed, computePhaseMargin } } })
    clearMcRunRequest()
  }, [mcRunRequest, topology, spec, clearMcRunRequest])

  useEffect(() => {
    if (!transientRunRequest) return
    workerRef.current?.postMessage({ type: 'TRANSIENT_COMPUTE', payload: transientRunRequest })
    clearTransientRunRequest()
  }, [transientRunRequest, clearTransientRunRequest])

  useEffect(() => {
    if (!sweepRequest) return
    workerRef.current?.postMessage({ type: 'SWEEP_COMPUTE', payload: sweepRequest })
    clearSweepRequest()
  }, [sweepRequest, clearSweepRequest])

  // Share — deep link on launch or while running
  useEffect(() => {
    window.shareAPI?.onDeepLink((url) => { const d = decodeDesign(url); if (d) setPendingShareDesign(d) })
    window.shareAPI?.getLaunchLink().then((url) => { if (!url) return; const d = decodeDesign(url); if (d) setPendingShareDesign(d) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Share — global paste listener for pswb:// strings
  useEffect(() => {
    function onPaste(e: ClipboardEvent): void {
      const text = e.clipboardData?.getData('text') ?? ''
      if (!isPswbLink(text)) return
      const design = decodeDesign(text.trim())
      if (!design) return
      const target = e.target as HTMLElement
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      setPendingShareDesign(design)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [setPendingShareDesign])

  // Plugin loader — runs on mount and whenever the user clicks "Reload"
  useEffect(() => {
    async function loadPlugins(): Promise<void> {
      const api = window.pluginAPI
      if (!api) return
      try {
        const res = await api.listPlugins()
        if (!res.success) return
        const sources: PluginSource[] = res.plugins
        workerRef.current?.postMessage({ type: 'LOAD_PLUGINS', payload: { sources, disabledIds: disabledPluginIds } })
      } catch { /* Non-Electron environment — skip silently */ }
    }
    loadPlugins()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginReloadRequest])

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
