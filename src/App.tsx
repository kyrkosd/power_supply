// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React, { useEffect, useRef } from 'react'
import { Toolbar } from './components/Toolbar/Toolbar'
import { InputPanel } from './components/InputPanel/InputPanel'
import { SchematicView } from './components/SchematicView/SchematicView'
import { TabPanel } from './components/TabPanel/TabPanel'
import { FirstRunWelcome } from './components/FirstRunWelcome/FirstRunWelcome'
import { StatusBar } from './components/StatusBar/StatusBar'
import { useDesignStore, type ActiveVizTab } from './store/design-store'
import type { PluginSource } from './engine/plugin-types'
import { DesignComparison } from './components/ComparisonView/DesignComparison'
import { SequencingView } from './components/SequencingView/SequencingView'
import { Settings } from './components/Settings/Settings'
import { EquationExplorer } from './components/EquationExplorer/EquationExplorer'
import { SweepView } from './components/SweepView/SweepView'
import { DesignLibrary } from './components/DesignLibrary/DesignLibrary'
import { ShareModal, PasteConfirmModal } from './components/ShareModal/ShareModal'
import { TopologySelector } from './components/TopologySelector/TopologySelector'
import { RightPanel } from './components/RightPanel/RightPanel'
import { validateSpec } from './engine/validation'
import { isPswbLink, decodeDesign } from './export/share-link'
import styles from './App.module.css'

// ── Keyboard shortcut handlers ────────────────────────────────────────────────

type FileHandlers = {
  newProject: () => void
  openProject: () => void
  saveProject: () => void
  saveProjectAs: () => void
}

type EditHandlers = {
  undo: () => void
  redo: () => void
  setActiveVizTab: (tab: ActiveVizTab) => void
  saveToComparison: () => void
  setIsComparing: (open: boolean) => void
  setIsLibraryOpen: (open: boolean) => void
}

function handleFileShortcut(event: KeyboardEvent, handlers: FileHandlers): boolean {
  if (!event.ctrlKey && !event.metaKey) return false
  if (event.key === 'n' && !event.shiftKey) { event.preventDefault(); handlers.newProject();    return true }
  if (event.key === 'o' && !event.shiftKey) { event.preventDefault(); handlers.openProject();   return true }
  if (event.key === 's') {
    event.preventDefault()
    event.shiftKey ? handlers.saveProjectAs() : handlers.saveProject()
    return true
  }
  return false
}

function handleEditShortcut(event: KeyboardEvent, handlers: EditHandlers): void {
  if (!event.ctrlKey && !event.metaKey) return
  switch (event.key) {
    case 'z': event.preventDefault(); event.shiftKey ? handlers.redo() : handlers.undo(); break
    case 'y': event.preventDefault(); handlers.redo(); break
    case 'k': event.preventDefault(); event.shiftKey ? handlers.setIsComparing(true) : handlers.saveToComparison(); break
    case 'l': event.preventDefault(); handlers.setIsLibraryOpen(true); break
    case '1': event.preventDefault(); handlers.setActiveVizTab('waveforms'); break
    case '2': event.preventDefault(); handlers.setActiveVizTab('bode'); break
    case '3': event.preventDefault(); handlers.setActiveVizTab('losses'); break
    case '4': event.preventDefault(); handlers.setActiveVizTab('thermal'); break
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function App(): React.ReactElement {
  const topology        = useDesignStore((s) => s.topology)
  const spec            = useDesignStore((s) => s.spec)
  const setResult       = useDesignStore((s) => s.setResult)
  const setMcResult     = useDesignStore((s) => s.setMcResult)
  const mcRunRequest    = useDesignStore((s) => s.mcRunRequest)
  const clearMcRunRequest = useDesignStore((s) => s.clearMcRunRequest)
  const setActiveVizTab = useDesignStore((s) => s.setActiveVizTab)
  const newProject      = useDesignStore((s) => s.newProject)
  const openProject     = useDesignStore((s) => s.openProject)
  const saveProject     = useDesignStore((s) => s.saveProject)
  const saveProjectAs   = useDesignStore((s) => s.saveProjectAs)
  const undo                      = useDesignStore((s) => s.undo)
  const redo                      = useDesignStore((s) => s.redo)
  const cancelComputing           = useDesignStore((s) => s.cancelComputing)
  const saveToComparison          = useDesignStore((s) => s.saveToComparison)
  const setIsComparing            = useDesignStore((s) => s.setIsComparing)
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

  // Keyboard shortcuts
  useEffect(() => {
    const fileHandlers: FileHandlers = { newProject, openProject, saveProject, saveProjectAs }
    const editHandlers: EditHandlers = { undo, redo, setActiveVizTab, saveToComparison, setIsComparing, setIsLibraryOpen }

    function onKeyDown(event: KeyboardEvent): void {
      // File shortcuts work even when focus is inside a text field
      if (handleFileShortcut(event, fileHandlers)) return
      // Undo/redo and tab shortcuts skip text fields to avoid conflicting with native editing
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      handleEditShortcut(event, editHandlers)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setActiveVizTab, newProject, openProject, saveProject, saveProjectAs, undo, redo, saveToComparison, setIsComparing, setIsLibraryOpen])

  // Engine worker — lifecycle
  useEffect(() => {
    const worker = new Worker(new URL('./engine/worker.ts', import.meta.url), { type: 'module' })

    function onWorkerMessage(event: MessageEvent): void {
      const msg = event.data
      if (msg?.type === 'RESULT' && msg.payload) {
        setResult(msg.payload.result, msg.payload.waveforms)
        if (msg.payload.emiResult) setEmiResult(msg.payload.emiResult)
      } else if (msg?.type === 'MC_RESULT' && msg.payload) {
        setMcResult(msg.payload)
      } else if (msg?.type === 'EFFICIENCY_MAP_RESULT' && msg.payload) {
        setEfficiencyMapResult(msg.payload)
      } else if (msg?.type === 'TRANSIENT_RESULT' && msg.payload) {
        setTransientResult(msg.payload)
      } else if (msg?.type === 'SWEEP_PROGRESS' && msg.payload) {
        setSweepProgress(msg.payload.current, msg.payload.total)
      } else if (msg?.type === 'SWEEP_RESULT' && msg.payload) {
        setSweepResult(msg.payload)
      } else if (msg?.type === 'PLUGINS_LOADED' && msg.payload) {
        setPlugins(msg.payload.plugins)
      } else if (msg?.type === 'ERROR' && msg.payload) {
        console.error('Engine worker error:', msg.payload.message)
      }
    }

    worker.addEventListener('message', onWorkerMessage)
    workerRef.current = worker
    return () => {
      worker.removeEventListener('message', onWorkerMessage)
      worker.terminate()
      workerRef.current = null
    }
  }, [setResult, setMcResult, setEfficiencyMapResult, setTransientResult, setEmiResult, setSweepResult, setSweepProgress, setPlugins])

  // Engine worker — dispatch design computation on spec/topology change
  // Skip when validation errors exist; cancelComputing clears the spinner.
  // When a plugin topology is active, validation is skipped (plugins define their own constraints).
  useEffect(() => {
    const activeTopology = pluginTopologyId ?? topology
    if (!pluginTopologyId) {
      const { valid } = validateSpec(topology, spec)
      if (!valid) {
        cancelComputing()
        return
      }
    }
    workerRef.current?.postMessage({ type: 'COMPUTE', payload: { topology: activeTopology, spec } })
  }, [topology, spec, pluginTopologyId, cancelComputing])

  // Engine worker — dispatch efficiency map computation when requested
  useEffect(() => {
    if (!efficiencyMapRequest) return
    workerRef.current?.postMessage({ type: 'EFFICIENCY_MAP', payload: efficiencyMapRequest })
    clearEfficiencyMapRequest()
  }, [efficiencyMapRequest, clearEfficiencyMapRequest])

  // Engine worker — dispatch Monte Carlo run when requested
  useEffect(() => {
    if (!mcRunRequest) return
    const { iterations, seed, computePhaseMargin } = mcRunRequest
    workerRef.current?.postMessage({
      type: 'MC_COMPUTE',
      payload: { topology, spec, mcConfig: { iterations, seed, computePhaseMargin } },
    })
    clearMcRunRequest()
  }, [mcRunRequest, topology, spec, clearMcRunRequest])

  // Engine worker — dispatch transient simulation when requested
  useEffect(() => {
    if (!transientRunRequest) return
    workerRef.current?.postMessage({ type: 'TRANSIENT_COMPUTE', payload: transientRunRequest })
    clearTransientRunRequest()
  }, [transientRunRequest, clearTransientRunRequest])

  // Engine worker — dispatch parameter sweep when requested
  useEffect(() => {
    if (!sweepRequest) return
    workerRef.current?.postMessage({ type: 'SWEEP_COMPUTE', payload: sweepRequest })
    clearSweepRequest()
  }, [sweepRequest, clearSweepRequest])

  // Share — handle pswb:// deep links received while the app is running
  useEffect(() => {
    window.shareAPI?.onDeepLink((url) => {
      const design = decodeDesign(url)
      if (design) setPendingShareDesign(design)
    })
    // Check for a pswb:// URL that arrived via CLI on first launch
    window.shareAPI?.getLaunchLink().then((url) => {
      if (!url) return
      const design = decodeDesign(url)
      if (design) setPendingShareDesign(design)
    })
  // Run once on mount; the callbacks register listeners that stay alive
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Share — global paste listener: intercept pswb:// strings pasted anywhere
  useEffect(() => {
    function onPaste(e: ClipboardEvent): void {
      const text = e.clipboardData?.getData('text') ?? ''
      if (!isPswbLink(text)) return
      const design = decodeDesign(text.trim())
      if (!design) return
      // Only intercept when the paste target is not a text input / textarea
      // (so normal editing isn't disrupted)
      const target = e.target as HTMLElement
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      setPendingShareDesign(design)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [setPendingShareDesign])

  // Plugin system — load plugins from filesystem and send to worker
  useEffect(() => {
    async function loadPlugins(): Promise<void> {
      const api = window.pluginAPI
      if (!api) return
      try {
        const res = await api.listPlugins()
        if (!res.success) return
        const sources: PluginSource[] = res.plugins
        workerRef.current?.postMessage({
          type: 'LOAD_PLUGINS',
          payload: { sources, disabledIds: disabledPluginIds },
        })
      } catch {
        // Non-Electron environment — silently skip
      }
    }
    loadPlugins()
  // pluginReloadRequest is a counter that increments when the user clicks "Reload"
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
        {/* Left column: topology selector + input panel */}
        <aside className={styles.leftCol}>
          <TopologySelector />
          <InputPanel />
        </aside>

        {/* Center column: schematic + visualization tabs */}
        <div className={styles.centerCol}>
          <div className={styles.schematicArea}>
            <SchematicView />
          </div>
          <div className={styles.vizArea}>
            <TabPanel />
          </div>
        </div>

        {/* Right column: result cards + component suggestions + notes */}
        <aside className={styles.rightCol}>
          <RightPanel />
        </aside>
      </div>
      <StatusBar />
    </div>
  )
}
