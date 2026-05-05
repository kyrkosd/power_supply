import React from 'react'
import { useDesignStore } from '../../store/design-store'
import { generateLayoutGuidelines } from '../../engine/pcb-guidelines'
import type { CriticalLoop, TraceWidth, PlacementStep, ThermalVia, KeepOut } from '../../engine/pcb-guidelines'
import styles from './LayoutGuide.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMm(mm: number): string {
  return mm < 1 ? `${(mm * 1000).toFixed(0)} µm` : `${mm.toFixed(2)} mm`
}

function fmtA(a: number): string {
  return `${a.toFixed(1)} A`
}

const PRIORITY_LABEL: Record<1 | 2 | 3, string> = {
  1: 'CRITICAL',
  2: 'IMPORTANT',
  3: 'RECOMMENDED',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionTitle}>{title}</span>
      {subtitle && <span className={styles.sectionSubtitle}>{subtitle}</span>}
    </div>
  )
}

function CriticalLoopsSection({ loops }: { loops: CriticalLoop[] }) {
  return (
    <section className={styles.section}>
      <SectionHeader
        title="Critical Current Loops"
        subtitle="Route these first — tight loops reduce EMI and switching losses"
      />
      {loops.map((loop, i) => (
        <div key={i} className={`${styles.loopCard} ${styles[`priority${loop.priority}`]}`}>
          <div className={styles.loopHeader}>
            <span className={styles.loopName}>{loop.name}</span>
            <span className={`${styles.priorityBadge} ${styles[`badge${loop.priority}`]}`}>
              {PRIORITY_LABEL[loop.priority]}
            </span>
          </div>
          <div className={styles.loopComponents}>
            {loop.components.map((c, j) => (
              <span key={j} className={styles.component}>{c}</span>
            ))}
          </div>
          <p className={styles.loopDesc}>{loop.description}</p>
        </div>
      ))}
    </section>
  )
}

function TraceWidthsSection({ traces }: { traces: TraceWidth[] }) {
  return (
    <section className={styles.section}>
      <SectionHeader
        title="Trace Widths"
        subtitle="IPC-2221 external layer, 10 °C rise — use 2 oz on high-current nets when possible"
      />
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Net</th>
            <th>Current</th>
            <th>Min Width (1 oz)</th>
            <th>Min Width (2 oz)</th>
            <th>Recommended</th>
          </tr>
        </thead>
        <tbody>
          {traces.map((t, i) => (
            <tr key={i}>
              <td className={styles.netName}>{t.net}</td>
              <td>{fmtA(t.current_a)}</td>
              <td>{fmtMm(t.min_width_mm)}</td>
              <td>{fmtMm(t.min_width_mm_2oz)}</td>
              <td>
                <span className={styles.recBadge}>{t.copper_weight_oz} oz</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function PlacementSection({ steps }: { steps: PlacementStep[] }) {
  return (
    <section className={styles.section}>
      <SectionHeader
        title="Placement Order"
        subtitle="Place components in this sequence — each step constrains the next"
      />
      <ol className={styles.placementList}>
        {steps.map((s) => (
          <li key={s.step} className={styles.placementItem}>
            <div className={styles.placementStep}>
              <span className={styles.stepNum}>{s.step}</span>
              <div className={styles.stepContent}>
                <span className={styles.stepComponent}>{s.component}</span>
                <span className={styles.stepReason}>{s.reason}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ThermalViasSection({ vias }: { vias: ThermalVia[] }) {
  if (vias.length === 0) return null
  return (
    <section className={styles.section}>
      <SectionHeader
        title="Thermal Vias"
        subtitle="Stitch copper to inner planes under hot components"
      />
      {vias.map((v, i) => (
        <div key={i} className={styles.thermalCard}>
          <span className={styles.thermalComponent}>{v.component}</span>
          <span className={styles.thermalSpec}>
            {v.via_count}× ø{v.via_diameter_mm} mm vias
          </span>
          <span className={styles.thermalReason}>{v.reason}</span>
        </div>
      ))}
    </section>
  )
}

function KeepOutsSection({ keepOuts }: { keepOuts: KeepOut[] }) {
  if (keepOuts.length === 0) return null
  return (
    <section className={styles.section}>
      <SectionHeader title="Keep-Out Areas" />
      {keepOuts.map((k, i) => (
        <div key={i} className={styles.keepOutRow}>
          <span className={styles.keepOutArea}>{k.area}</span>
          <span className={styles.keepOutReason}>{k.reason}</span>
        </div>
      ))}
    </section>
  )
}

function TipsSection({ tips }: { tips: string[] }) {
  return (
    <section className={styles.section}>
      <SectionHeader title="General Tips" />
      <ul className={styles.tipsList}>
        {tips.map((tip, i) => (
          <li key={i} className={styles.tip}>{tip}</li>
        ))}
      </ul>
    </section>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function LayoutGuide(): React.ReactElement {
  const topology = useDesignStore((s) => s.topology)
  const spec     = useDesignStore((s) => s.spec)
  const result   = useDesignStore((s) => s.result)

  if (!result) {
    return (
      <div className={styles.empty}>
        Run the simulation to generate layout guidelines.
      </div>
    )
  }

  const guide = generateLayoutGuidelines(topology, spec, result)

  return (
    <div className={styles.container}>
      <div className={styles.printHeader}>
        <span className={styles.printTitle}>PCB Layout Guide</span>
        <span className={styles.printSubtitle}>
          {topology.toUpperCase()} · {(spec.fsw / 1e3).toFixed(0)} kHz ·{' '}
          {spec.vinNom} V → {spec.vout} V @ {spec.iout} A
        </span>
      </div>

      <CriticalLoopsSection loops={guide.critical_loops} />
      <TraceWidthsSection traces={guide.trace_widths} />
      <PlacementSection steps={guide.placement_order} />
      <ThermalViasSection vias={guide.thermal_vias} />
      <KeepOutsSection keepOuts={guide.keep_outs} />
      <TipsSection tips={guide.general_tips} />
    </div>
  )
}
