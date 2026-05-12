// PCB layout guide: critical loops, trace widths, placement order, and keep-outs.
import React from 'react'
import { useDesignStore } from '../../store/design-store'
import { generateLayoutGuidelines } from '../../engine/pcb-guidelines'
import type { CriticalLoop, TraceWidth, PlacementStep, ThermalVia, KeepOut } from '../../engine/pcb-guidelines'
import styles from './LayoutGuide.module.css'

// ── Formatters ────────────────────────────────────────────────────────────────

/** Formats millimetres: below 1 mm rendered in µm for readability. */
function fmtMm(mm: number): string { return mm < 1 ? `${(mm * 1000).toFixed(0)} µm` : `${mm.toFixed(2)} mm` }

/** Formats a current value as "X.X A". */
function fmtA(a: number): string { return `${a.toFixed(1)} A` }

/** Human-readable labels for the three loop priority levels. */
const PRIORITY_LABEL: Record<1 | 2 | 3, string> = { 1: 'CRITICAL', 2: 'IMPORTANT', 3: 'RECOMMENDED' }

/** CSS class lookups for loop card and priority badge — avoids template-literal nesting. */
const LOOP_CARD_CLASS: Record<1 | 2 | 3, string>  = { 1: styles.priority1, 2: styles.priority2, 3: styles.priority3 }
const BADGE_CLASS:     Record<1 | 2 | 3, string>  = { 1: styles.badge1,    2: styles.badge2,    3: styles.badge3 }

// ── Sub-components ────────────────────────────────────────────────────────────

/** Section heading with optional subtitle. */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }): React.ReactElement {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionTitle}>{title}</span>
      {subtitle && <span className={styles.sectionSubtitle}>{subtitle}</span>}
    </div>
  )
}

/** Critical current loop cards with priority badge and component list. */
function CriticalLoopsSection({ loops }: { loops: CriticalLoop[] }): React.ReactElement {
  return (
    <section className={styles.section}>
      <SectionHeader title="Critical Current Loops" subtitle="Route these first — tight loops reduce EMI and switching losses" />
      {loops.map((loop, i) => (
        <div key={i} className={`${styles.loopCard} ${LOOP_CARD_CLASS[loop.priority]}`}>
          <div className={styles.loopHeader}>
            <span className={styles.loopName}>{loop.name}</span>
            <span className={`${styles.priorityBadge} ${BADGE_CLASS[loop.priority]}`}>{PRIORITY_LABEL[loop.priority]}</span>
          </div>
          <div className={styles.loopComponents}>
            {loop.components.map((c, j) => <span key={j} className={styles.component}>{c}</span>)}
          </div>
          <p className={styles.loopDesc}>{loop.description}</p>
        </div>
      ))}
    </section>
  )
}

/** IPC-2221 trace width table for all power nets. */
function TraceWidthsSection({ traces }: { traces: TraceWidth[] }): React.ReactElement {
  return (
    <section className={styles.section}>
      <SectionHeader title="Trace Widths" subtitle="IPC-2221 external layer, 10 °C rise — use 2 oz on high-current nets when possible" />
      <table className={styles.table}>
        <thead>
          <tr><th>Net</th><th>Current</th><th>Min Width (1 oz)</th><th>Min Width (2 oz)</th><th>Recommended</th></tr>
        </thead>
        <tbody>
          {traces.map((t, i) => (
            <tr key={i}>
              <td className={styles.netName}>{t.net}</td>
              <td>{fmtA(t.current_a)}</td>
              <td>{fmtMm(t.min_width_mm)}</td>
              <td>{fmtMm(t.min_width_mm_2oz)}</td>
              <td><span className={styles.recBadge}>{t.copper_weight_oz} oz</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/** Numbered placement order list; each step explains the constraint it creates. */
function PlacementSection({ steps }: { steps: PlacementStep[] }): React.ReactElement {
  return (
    <section className={styles.section}>
      <SectionHeader title="Placement Order" subtitle="Place components in this sequence — each step constrains the next" />
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

/** Thermal via recommendations for hot components; hidden when none are required. */
function ThermalViasSection({ vias }: { vias: ThermalVia[] }): React.ReactElement | null {
  if (vias.length === 0) return null
  return (
    <section className={styles.section}>
      <SectionHeader title="Thermal Vias" subtitle="Stitch copper to inner planes under hot components" />
      {vias.map((v, i) => (
        <div key={i} className={styles.thermalCard}>
          <span className={styles.thermalComponent}>{v.component}</span>
          <span className={styles.thermalSpec}>{v.via_count}× ø{v.via_diameter_mm} mm vias</span>
          <span className={styles.thermalReason}>{v.reason}</span>
        </div>
      ))}
    </section>
  )
}

/** Keep-out area list; hidden when none are specified. */
function KeepOutsSection({ keepOuts }: { keepOuts: KeepOut[] }): React.ReactElement | null {
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

/** Bulleted list of topology-specific general routing tips. */
function TipsSection({ tips }: { tips: string[] }): React.ReactElement {
  return (
    <section className={styles.section}>
      <SectionHeader title="General Tips" />
      <ul className={styles.tipsList}>
        {tips.map((tip, i) => <li key={i} className={styles.tip}>{tip}</li>)}
      </ul>
    </section>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/** PCB layout guide: generates and renders topology-specific design guidelines. */
export function LayoutGuide(): React.ReactElement {
  const topology = useDesignStore((s) => s.topology)
  const spec     = useDesignStore((s) => s.spec)
  const result   = useDesignStore((s) => s.result)

  if (!result) {
    return <div className={styles.empty}>Run the simulation to generate layout guidelines.</div>
  }

  const guide = generateLayoutGuidelines(topology, spec, result)
  return (
    <div className={styles.container}>
      <div className={styles.printHeader}>
        <span className={styles.printTitle}>PCB Layout Guide</span>
        <span className={styles.printSubtitle}>
          {topology.toUpperCase()} · {(spec.fsw / 1e3).toFixed(0)} kHz ·{' '}
          {spec.vinMin.toFixed(0)}–{spec.vinMax.toFixed(0)} V → {spec.vout} V @ {spec.iout} A
        </span>
      </div>
      <CriticalLoopsSection loops={guide.critical_loops} />
      <TraceWidthsSection   traces={guide.trace_widths} />
      <PlacementSection     steps={guide.placement_order} />
      <ThermalViasSection   vias={guide.thermal_vias} />
      <KeepOutsSection      keepOuts={guide.keep_outs} />
      <TipsSection          tips={guide.general_tips} />
    </div>
  )
}
