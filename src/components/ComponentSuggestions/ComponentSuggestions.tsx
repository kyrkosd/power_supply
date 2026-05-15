// Component suggestions panel: MOSFET, inductor, output cap, gate drive, soft-start,
// current sensing, feedback, transformer, CCM/DCM badge, multi-output table.
// Each visual section lives in panels/*.tsx; this file orchestrates them.

import React from 'react'
import { useDesignStore } from '../../store/design-store'
import { suggestInductors, suggestCapacitors, suggestMosfets } from '../../engine/component-selector'
import type { InductorData, CapacitorData, MosfetData } from '../../engine/component-selector'
import { derateCapacitance } from '../../engine/dc-bias'
import { computeGateDrive } from '../../engine/gate-drive'
import { estimateLifetime } from '../../engine/cap-lifetime'
import { designFeedback } from '../../engine/feedback'
import { designSoftStart } from '../../engine/soft-start'
import type { CurrentSenseResult, WindingResult, SecondaryOutputResult } from '../../engine/types'
import {
  GateDriveSection, SoftStartDisplay, CurrentSensingDisplay,
  FeedbackNetworkDisplay, TransformerDetails,
} from './SuggestionSubPanels'
import { MosfetSection, SyncFETSection } from './panels/MosfetSection'
import { InductorSection }                from './panels/InductorSection'
import { OutputCapSection }               from './panels/OutputCapPanel'
import { CcmDcmSection }                  from './panels/CcmDcmPanel'
import { MultiOutputSection }             from './panels/MultiOutputPanel'
import {
  HIGH_SIDE_TOPOLOGIES, NON_ISOLATED, ISOLATED_TOPOLOGIES,
  mosfetVdsRequired,
} from './suggestionFormatters'
import styles from './ComponentSuggestions.module.css'

// ── Derived values for the current spec/result ───────────────────────────────

interface Derived {
  vdsReq: number
  inductor: InductorData | undefined
  capacitor: CapacitorData | undefined
  mosfet: MosfetData | undefined
  syncMosfet: MosfetData | null
  gateDrive: ReturnType<typeof computeGateDrive> | null
  capLife: ReturnType<typeof estimateLifetime> | null
  capDerating: ReturnType<typeof derateCapacitance> | null
  softStart: ReturnType<typeof designSoftStart>
  feedback: ReturnType<typeof designFeedback> | null
}

function pickSyncFet(
  syncMode: boolean, topology: string, vdsReq: number,
): MosfetData | null {
  if (!syncMode || !NON_ISOLATED.has(topology)) return null
  return suggestMosfets(vdsReq).slice().sort((a, b) => a.rds_on_mohm - b.rds_on_mohm)[0] ?? null
}

function deriveSuggestions(
  topology: string,
  spec: ReturnType<typeof useDesignStore.getState>['spec'],
  result: NonNullable<ReturnType<typeof useDesignStore.getState>['result']>,
  feedbackOptions: ReturnType<typeof useDesignStore.getState>['feedbackOptions'],
  softStartOptions: ReturnType<typeof useDesignStore.getState>['softStartOptions'],
): Derived {
  const vdsReq    = mosfetVdsRequired(topology, spec.vinMax, spec.vout)
  const inductor  = suggestInductors(result.inductance * 1e6, result.peakCurrent)[0]
  const capacitor = suggestCapacitors(result.capacitance * 1e6, spec.vout * 1.5)[0]
  const mosfet    = suggestMosfets(vdsReq)[0]
  const syncMode  = spec.rectification === 'synchronous'
  const deltaIL   = 2 * Math.max(result.peakCurrent - spec.iout, 0)
  const capRipple = deltaIL / (2 * Math.sqrt(3))

  return {
    vdsReq, inductor, capacitor, mosfet,
    syncMosfet: pickSyncFet(syncMode, topology, vdsReq),
    gateDrive:  mosfet ? computeGateDrive(spec, result, mosfet) : null,
    capLife:    capacitor?.type === 'electrolytic'
                  ? estimateLifetime(capacitor, { irms_actual: capRipple, vdc: spec.vout, ambient_temp_C: spec.ambientTemp })
                  : null,
    capDerating: capacitor
                  ? derateCapacitance(capacitor.capacitance_uf, spec.vout, capacitor.voltage_v, capacitor.dielectric ?? capacitor.type, capacitor.package ?? '')
                  : null,
    softStart:  designSoftStart(topology, spec, result, inductor, softStartOptions),
    feedback:   ISOLATED_TOPOLOGIES.has(topology) ? null : designFeedback(spec.vout, feedbackOptions),
  }
}

// ── Sub-components — each handles its own null guard ────────────────────────

function SwitchSection({ mosfet, syncMosfet, gateDrive, vdsReq, peakCurrent, topology, isMosfetSel, onSelectMosfet }: {
  mosfet: MosfetData | undefined
  syncMosfet: MosfetData | null
  gateDrive: ReturnType<typeof computeGateDrive> | null
  vdsReq: number
  peakCurrent: number
  topology: string
  isMosfetSel: boolean
  onSelectMosfet: () => void
}): React.ReactElement {
  return (
    <>
      {mosfet && (
        <MosfetSection mosfet={mosfet} vdsReq={vdsReq} peakCurrent={peakCurrent}
          isSelected={isMosfetSel} onSelect={onSelectMosfet} />
      )}
      {syncMosfet && <SyncFETSection mosfet={syncMosfet} />}
      {gateDrive && <GateDriveSection gd={gateDrive} showBootstrap={HIGH_SIDE_TOPOLOGIES.has(topology)} />}
    </>
  )
}

function StorageSection({ inductor, capacitor, inductanceH, capacitanceH, peakCurrent, iout, ambientTemp, capDerating, capLife, isInductorSel, isCapacitorSel, onSelectInductor, onSelectCapacitor }: {
  inductor: InductorData | undefined
  capacitor: CapacitorData | undefined
  inductanceH: number
  capacitanceH: number
  peakCurrent: number
  iout: number
  ambientTemp: number
  capDerating: ReturnType<typeof derateCapacitance> | null
  capLife: ReturnType<typeof estimateLifetime> | null
  isInductorSel: boolean
  isCapacitorSel: boolean
  onSelectInductor: () => void
  onSelectCapacitor: () => void
}): React.ReactElement {
  return (
    <>
      {inductor && (
        <InductorSection inductor={inductor} inductanceH={inductanceH}
          peakCurrent={peakCurrent} iout={iout}
          isSelected={isInductorSel} onSelect={onSelectInductor} />
      )}
      {capacitor && (
        <OutputCapSection capacitor={capacitor} capacitanceH={capacitanceH}
          capDerating={capDerating} capLife={capLife}
          ambientTemp={ambientTemp}
          isSelected={isCapacitorSel} onSelect={onSelectCapacitor} />
      )}
    </>
  )
}

function FeedbackSection({ feedback, vout, isolated }: {
  feedback: ReturnType<typeof designFeedback> | null
  vout: number
  isolated: boolean
}): React.ReactElement {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Feedback Network</div>
      {isolated
        ? <div className={styles.fbNote}>⚠ Feedback network is on the secondary side. TL431 + optocoupler compensation not included — see control-loop analysis for loop design.</div>
        : feedback && <FeedbackNetworkDisplay fb={feedback} vout={vout} />}
    </div>
  )
}

function CurrentSensingSection({ cs, enabled }: {
  cs: CurrentSenseResult | null | undefined
  enabled: boolean
}): React.ReactElement | null {
  if (!enabled) return null
  if (!cs) return null
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Current Sensing</div>
      <CurrentSensingDisplay cs={cs} />
    </div>
  )
}

function WindingSection({ wr }: { wr: WindingResult | null | undefined }): React.ReactElement | null {
  if (!wr) return null
  return (
    <details className={styles.section} open={false}>
      <summary className={styles.gdrSummary}>Transformer Details</summary>
      <TransformerDetails wr={wr} />
    </details>
  )
}

function CcmDcmWrapper({ boundary, mode }: {
  boundary: number | null | undefined
  mode?: 'CCM' | 'DCM' | 'boundary'
}): React.ReactElement | null {
  if (boundary == null) return null
  return <CcmDcmSection boundary={boundary} mode={mode} />
}

function SecondarySection({ vout, capacitanceH, secondaryTurns, results }: {
  vout: number
  capacitanceH: number
  secondaryTurns?: number
  results: SecondaryOutputResult[] | null | undefined
}): React.ReactElement | null {
  if (!results) return null
  if (results.length === 0) return null
  return (
    <MultiOutputSection
      vout={vout} capacitanceH={capacitanceH}
      secondaryTurns={secondaryTurns} results={results}
    />
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function ComponentSuggestions(): React.ReactElement {
  const {
    result, spec, topology, selectedComponents, setSelectedComponent,
    feedbackOptions, softStartOptions, setActiveVizTab,
  } = useDesignStore()

  if (!result) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>Components</div>
        <div className={styles.empty}>Run a simulation first.</div>
      </div>
    )
  }

  const d   = deriveSuggestions(topology, spec, result, feedbackOptions, softStartOptions)
  const sel = selectedComponents
  const isolated = ISOLATED_TOPOLOGIES.has(topology)
  const currentControl = (spec.controlMode ?? 'voltage') === 'current'

  const isMosfetSel    = sel.mosfet?.part_number    === d.mosfet?.part_number
  const isInductorSel  = sel.inductor?.part_number  === d.inductor?.part_number
  const isCapacitorSel = sel.capacitor?.part_number === d.capacitor?.part_number

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Components</div>

      <SwitchSection
        mosfet={d.mosfet} syncMosfet={d.syncMosfet} gateDrive={d.gateDrive}
        vdsReq={d.vdsReq} peakCurrent={result.peakCurrent} topology={topology}
        isMosfetSel={isMosfetSel}
        onSelectMosfet={() => setSelectedComponent('mosfet', isMosfetSel ? null : d.mosfet!)}
      />

      <StorageSection
        inductor={d.inductor} capacitor={d.capacitor}
        inductanceH={result.inductance} capacitanceH={result.capacitance}
        peakCurrent={result.peakCurrent} iout={spec.iout} ambientTemp={spec.ambientTemp}
        capDerating={d.capDerating} capLife={d.capLife}
        isInductorSel={isInductorSel} isCapacitorSel={isCapacitorSel}
        onSelectInductor={() => setSelectedComponent('inductor', isInductorSel ? null : d.inductor!)}
        onSelectCapacitor={() => setSelectedComponent('capacitor', isCapacitorSel ? null : d.capacitor!)}
      />

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Soft-Start</div>
        <SoftStartDisplay ss={d.softStart} onTransientClick={() => setActiveVizTab('transient')} />
      </div>

      <CurrentSensingSection cs={result.current_sense} enabled={currentControl} />

      <FeedbackSection feedback={d.feedback} vout={spec.vout} isolated={isolated} />

      <CcmDcmWrapper boundary={result.ccm_dcm_boundary} mode={result.operating_mode} />

      <WindingSection wr={result.winding_result} />

      <SecondarySection
        vout={spec.vout} capacitanceH={result.capacitance}
        secondaryTurns={result.secondaryTurns}
        results={result.secondaryOutputResults}
      />
    </div>
  )
}

// Re-export data types consumed by external code (e.g. Toolbar, ComparisonView)
export type { InductorData, CapacitorData, MosfetData }
