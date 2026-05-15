// Transient simulation tab: RK4 state-space results for startup, load-step, and line-step modes.
import React, { useEffect, useRef, useState } from 'react'
import { useDesignStore } from '../../../store/design-store'
import type { TransientMode, TransientResult } from '../../../engine/topologies/types'
import { drawChart, type PanelCfg } from './transientChart'
import styles from './TransientTab.module.css'

const SUPPORTED_TOPOLOGIES = new Set(['buck'])

const MODES: { id: TransientMode; label: string }[] = [
  { id: 'startup',   label: 'Startup' },
  { id: 'load-step', label: 'Load Step' },
  { id: 'line-step', label: 'Line Step' },
]

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Computes soft-start duration in seconds; auto mode clamps result to 1–50 ms. */
function computeSoftStartSeconds(
  auto: boolean, tss_s: number | undefined,
  capacitance: number, vout: number, iout: number,
): number {
  if (!auto) return tss_s ?? 0.005
  return Math.max(0.001, Math.min(0.050, (capacitance * vout * 10) / iout))
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Single SVG chart panel driven by a D3 draw function. */
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

interface Metrics { settling_time_ms: number; overshoot_pct: number; peak_inrush_A: number }

/** Three-value strip: settling time, overshoot percent, and peak inrush current. */
function MetricsStrip({ m }: { m: Metrics }): React.ReactElement {
  const items: [string, string][] = [
    ['Settling time', `${m.settling_time_ms.toFixed(2)} ms`],
    ['Overshoot',     `${m.overshoot_pct.toFixed(1)} %`],
    ['Peak inrush',   `${m.peak_inrush_A.toFixed(2)} A`],
  ]
  return (
    <div className={styles.metrics}>
      {items.map(([label, value]) => (
        <div key={label} className={styles.metric}>
          <span className={styles.metricLabel}>{label}</span>
          <span className={styles.metricValue}>{value}</span>
        </div>
      ))}
    </div>
  )
}

/** Startup / load-step / line-step mode selector button group. */
function ModeSelector({ mode, onSelect }: { mode: TransientMode; onSelect: (m: TransientMode) => void }): React.ReactElement {
  return (
    <div className={styles.modeGroup}>
      {MODES.map((m) => (
        <button key={m.id}
          className={`${styles.modeBtn} ${mode === m.id ? styles.modeBtnActive : ''}`}
          onClick={() => onSelect(m.id)}>
          {m.label}
        </button>
      ))}
    </div>
  )
}

/** Empty-state placeholder for unsupported topologies or before the first run. */
function EmptyState({ supported, topology }: { supported: boolean; topology: string }): React.ReactElement {
  return (
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
  )
}

// ── Toolbar hints ─────────────────────────────────────────────────────────────

/** Inline hint text shown when unsupported or before first run. */
function ToolbarHints({ supported, tr, transientLoading }: {
  supported: boolean
  tr: TransientResult | null
  transientLoading: boolean
}): React.ReactElement | null {
  if (!supported) return <span className={styles.hint}>Transient simulation requires a state-space model — currently available for Buck only.</span>
  if (!tr && !transientLoading) return <span className={styles.hint}>Select a mode and click Run to simulate 10 ms of operation.</span>
  return null
}

// ── Charts area ───────────────────────────────────────────────────────────────

/** Renders MetricsStrip + waveform panels (or EmptyState) and loading overlay. */
function ChartsArea({ tr, transientLoading, vout, supported, topology }: {
  tr: TransientResult | null
  transientLoading: boolean
  vout: number
  supported: boolean
  topology: string
}): React.ReactElement {
  if (!tr) return <EmptyState supported={supported} topology={topology} />
  return (
    <>
      <MetricsStrip m={tr.metrics} />
      <div className={styles.charts}>
        {transientLoading && (
          <div className={styles.loadingOverlay}><span className={styles.spinner} /> Simulating…</div>
        )}
        <ChartPanel time={tr.time} panel={{ data: tr.vout, label: 'Output voltage',   unit: 'V', color: '#4adcf4', refLine: vout }} />
        <ChartPanel time={tr.time} panel={{ data: tr.iL,  label: 'Inductor current', unit: 'A', color: '#f4b400' }} />
      </div>
    </>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

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
  const canRun    = supported && !!result && !transientLoading

  function handleRun(): void {
    if (!result) return
    const softStartSeconds = computeSoftStartSeconds(
      softStartOptions.auto_tss, softStartOptions.tss_s,
      result.capacitance, spec.vout, spec.iout,
    )
    requestTransientRun({ topology, spec, result, mode, softStartSeconds })
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <ModeSelector mode={mode} onSelect={setMode} />
        <button className={styles.runBtn} onClick={handleRun} disabled={!canRun}>
          {transientLoading ? '⏳ Simulating…' : '▶ Run'}
        </button>
        <ToolbarHints supported={supported} tr={transientResult} transientLoading={transientLoading} />
      </div>
      <ChartsArea tr={transientResult} transientLoading={transientLoading} vout={spec.vout} supported={supported} topology={topology} />
    </div>
  )
}
