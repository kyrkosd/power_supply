import React, { useEffect, useRef } from 'react'
import { Toolbar } from './components/Toolbar/Toolbar'
import { InputPanel } from './components/InputPanel/InputPanel'
import { SchematicView } from './components/SchematicView/SchematicView'
import { TabPanel } from './components/TabPanel/TabPanel'
import { ComponentSuggestions } from './components/ComponentSuggestions/ComponentSuggestions'
import { useDesignStore } from './store/design-store'
import styles from './App.module.css'

export default function App(): React.ReactElement {
  const topology = useDesignStore((state) => state.topology)
  const spec = useDesignStore((state) => state.spec)
  const setResult = useDesignStore((state) => state.setResult)
  const setActiveVizTab = useDesignStore((state) => state.setActiveVizTab)
  const workerRef = useRef<Worker | null>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case '1':
            event.preventDefault()
            setActiveVizTab('waveforms')
            break
          case '2':
            event.preventDefault()
            setActiveVizTab('bode')
            break
          case '3':
            event.preventDefault()
            setActiveVizTab('losses')
            break
          case '4':
            event.preventDefault()
            setActiveVizTab('thermal')
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [setActiveVizTab])

  useEffect(() => {
    const worker = new Worker(new URL('./engine/worker.ts', import.meta.url), {
      type: 'module',
    })

    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message?.type === 'RESULT' && message.payload) {
        setResult(message.payload.result, message.payload.waveforms)
      } else if (message?.type === 'ERROR' && message.payload) {
        console.error('Engine worker error:', message.payload.message)
      }
    }

    worker.addEventListener('message', handleMessage)
    workerRef.current = worker

    return () => {
      worker.removeEventListener('message', handleMessage)
      worker.terminate()
      workerRef.current = null
    }
  }, [setResult])

  useEffect(() => {
    const worker = workerRef.current
    if (!worker) return
    worker.postMessage({ type: 'COMPUTE', payload: { topology, spec } })
  }, [topology, spec])

  return (
    <div className={styles.shell}>
      <Toolbar />
      <div className={styles.workspace}>
        {/* Left sidebar */}
        <aside className={styles.sidebar}>
          <InputPanel />
        </aside>

        {/* Right content area */}
        <div className={styles.content}>
          <div className={styles.schematicArea}>
            <SchematicView />
          </div>
          <div className={styles.componentArea}>
            <ComponentSuggestions />
          </div>
          <div className={styles.tabArea}>
            <TabPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
