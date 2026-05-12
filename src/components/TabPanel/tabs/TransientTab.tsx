// Transient simulation tab: RK4 state-space results for startup, load-step, and line-step modes.
import React, { useEffect, useRef, useState } from 'react'
import { useDesignStore } from '../../../store/design-store'
import type { TransientMode } from '../../../engine/topologies/types'
import { drawChart, type PanelCfg } from './transientChart'
import styles from './TransientTab.module.css'

// Only buck has getStateSpaceModel implemented
const SUPPORTED_TOPOLOGIES = new Set(['buck'])

const MODES: { id: TransientMode; label: string }[] = [
  { id: 'startup',   label: 'Startup' },
  { id: 'load-step', label: 'Load Step' },
  { id: 'line-step', label: 'Line Step' },
]

// ── Sub-component: single chart panel ────────────────────────────────────────

function ChartPanel({ time, panel }: { time: Float64Array; panel: PanelCfg }): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) drawChart(svgRef.current, time, panel)
  }, [time, panel])

  return (
    <div className={styles.chartPanel}>
      <svg ref={svgRef} className={styles.svg} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/** Transient simulation tab: mode selector, Run button, metrics strip, and waveform panels. */
export function TransientTab(): React.ReactElement {
  const topology            = useDesignStore((s) => s.topology)
  const spec                = useDesignStore((s) => s.spec)
  const result              = useDesignStore((s) => s.result)
  const softStartOptions    = useDesignStore((s) => s.softStartOptions)
  const transientResult     = useDesignStore((s) => s.transientResult)
  const transientLoading    = useDesignStore((s) => s.transientLoading)
  const requestTransientRun = useDesignStore((s) => s.requestTransientRun)

  const [mode, setMode] = useState<TransientMode>('startup')

  const supported = SUPPORTED_TOPOLOGIES.has(topology)
  const canRun = supported && !!result && !transientLoading

  function handleRun(): void {
    if (!result) return
    const softStartSeconds = softStartOptions.auto_tss
      ? Math.max(0.001, Math.min(0.050, (result.capacitance * spec.vout * 10) / spec.iout))
      : (softStartOptions.tss_s ?? 0.005)
    requestTransientRun({ topology, spec, result, mode, softStartSeconds })
  }

  const tr = transientResult

  return (
    <div className={styles.wrapper}>
      {/* Controls */}
      <div className={styles.toolbar}>
        <div className={styles.modeGroup}>
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`${styles.modeBtn} ${mode === m.id ? styles.modeBtnActive : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button className={styles.runBtn} onClick={handleRun} disabled={!canRun}>
          {transientLoading ? '⏳ Simulating…' : '▶ Run'}
        </button>
        {!supported && (
          <span className={styles.hint}>
            Transient simulation requires a state-space model — currently available for Buck only.
          </span>
        )}
        {supported && !tr && !transientLoading && (
          <span className={styles.hint}>Select a mode and click Run to simulate 10 ms of operation.</span>
        )}
      </div>

      {/* Metrics */}
      {tr && (
        <div className={styles.metrics}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Settling time</span>
            <span className={styles.metricValue}>{tr.metrics.settling_time_ms.toFixed(2)} ms</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Overshoot</span>
            <span className={styles.metricValue}>{tr.metrics.overshoot_pct.toFixed(1)} %</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Peak inrush</span>
            <span className={styles.metricValue}>{tr.metrics.peak_inrush_A.toFixed(2)} A</span>
          </div>
        </div>
      )}

      {/* Charts */}
      {tr ? (
        <div className={styles.charts}>
          {transientLoading && (
            <div className={styles.loadingOverlay}>
              <span className={styles.spinner} /> Simulating…
            </div>
          )}
          <ChartPanel
            time={tr.time}
            panel={{ data: tr.vout, label: 'Output voltage', unit: 'V', color: '#4adcf4', refLine: spec.vout }}
          />
          <ChartPanel
            time={tr.time}
            panel={{ data: tr.iL, label: 'Inductor current', unit: 'A', color: '#f4b400' }}
          />
        </div>
      ) : (
        <div className={styles.empty}>
          {supported ? (
            <>
              <span>No simulation data yet.</span>
              <span className={styles.emptyHint}>
                Choose a mode (Startup, Load Step, or Line Step) and click Run.
                The simulation uses your current component values and soft-start time.
              </span>
            </>
          ) : (
            <>
              <span>Not available for {topology}.</span>
              <span className={styles.emptyHint}>
                Transient simulation requires a state-space model. Switch to Buck topology to use this feature.
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
