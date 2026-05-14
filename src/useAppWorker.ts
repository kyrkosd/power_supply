import { useEffect, useRef, useCallback } from 'react'
import { useDesignStore } from './store/design-store'
import type { PluginSource } from './engine/plugin-types'
import { validateSpec } from './engine/validation'

export function useAppWorker(): void {
  const setResult         = useDesignStore((s) => s.setResult)
  const setMcResult       = useDesignStore((s) => s.setMcResult)
  const setEfficiencyMapResult = useDesignStore((s) => s.setEfficiencyMapResult)
  const setTransientResult     = useDesignStore((s) => s.setTransientResult)
  const setEmiResult           = useDesignStore((s) => s.setEmiResult)
  const setSweepResult         = useDesignStore((s) => s.setSweepResult)
  const setSweepProgress       = useDesignStore((s) => s.setSweepProgress)
  const setPlugins             = useDesignStore((s) => s.setPlugins)
  const topology               = useDesignStore((s) => s.topology)
  const spec                   = useDesignStore((s) => s.spec)
  const pluginTopologyId       = useDesignStore((s) => s.pluginTopologyId)
  const cancelComputing        = useDesignStore((s) => s.cancelComputing)
  const efficiencyMapRequest       = useDesignStore((s) => s.efficiencyMapRequest)
  const clearEfficiencyMapRequest  = useDesignStore((s) => s.clearEfficiencyMapRequest)
  const mcRunRequest               = useDesignStore((s) => s.mcRunRequest)
  const clearMcRunRequest          = useDesignStore((s) => s.clearMcRunRequest)
  const transientRunRequest        = useDesignStore((s) => s.transientRunRequest)
  const clearTransientRunRequest   = useDesignStore((s) => s.clearTransientRunRequest)
  const sweepRequest               = useDesignStore((s) => s.sweepRequest)
  const clearSweepRequest          = useDesignStore((s) => s.clearSweepRequest)
  const disabledPluginIds          = useDesignStore((s) => s.disabledPluginIds)
  const pluginReloadRequest        = useDesignStore((s) => s.pluginReloadRequest)

  const workerRef = useRef<Worker | null>(null)

  const handleWorkerMsg = useCallback((event: MessageEvent): void => {
    const { type, payload } = event.data ?? {}
    if (!type || !payload) return
    const dispatch: Record<string, (p: typeof payload) => void> = {
      RESULT:                (p) => { setResult(p.result, p.waveforms); if (p.emiResult) setEmiResult(p.emiResult) },
      MC_RESULT:             (p) => setMcResult(p),
      EFFICIENCY_MAP_RESULT: (p) => setEfficiencyMapResult(p),
      TRANSIENT_RESULT:      (p) => setTransientResult(p),
      SWEEP_PROGRESS:        (p) => setSweepProgress(p.current, p.total),
      SWEEP_RESULT:          (p) => setSweepResult(p),
      PLUGINS_LOADED:        (p) => setPlugins(p.plugins),
      ERROR:                 (p) => console.error('Engine worker error:', p.message),
    }
    dispatch[type]?.(payload)
  }, [setResult, setMcResult, setEfficiencyMapResult, setTransientResult, setEmiResult, setSweepResult, setSweepProgress, setPlugins])

  useEffect(() => {
    const worker = new Worker(new URL('./engine/worker.ts', import.meta.url), { type: 'module' })
    worker.addEventListener('message', handleWorkerMsg)
    workerRef.current = worker
    return () => { worker.removeEventListener('message', handleWorkerMsg); worker.terminate(); workerRef.current = null }
  }, [handleWorkerMsg])

  useEffect(() => {
    const activeTopology = pluginTopologyId ?? topology
    if (!pluginTopologyId) {
      const { valid } = validateSpec(topology, spec)
      if (!valid) { cancelComputing(); return }
    }
    workerRef.current?.postMessage({ type: 'COMPUTE', payload: { topology: activeTopology, spec } })
  }, [topology, spec, pluginTopologyId, cancelComputing])

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
}
