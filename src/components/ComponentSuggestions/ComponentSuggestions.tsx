// Component suggestions panel: MOSFET, inductor, capacitor, gate drive, soft-start,
// current sensing, feedback network, and transformer winding in one scrollable view.
import React from 'react'
import { useDesignStore } from '../../store/design-store'
import { suggestInductors, suggestCapacitors, suggestMosfets } from '../../engine/component-selector'
import type { InductorData, CapacitorData, MosfetData } from '../../engine/component-selector'
import { derateCapacitance } from '../../engine/dc-bias'
import { computeGateDrive } from '../../engine/gate-drive'
import { estimateLifetime } from '../../engine/cap-lifetime'
import { designFeedback } from '../../engine/feedback'
import { designSoftStart } from '../../engine/soft-start'
import { Tooltip } from '../Tooltip/Tooltip'
import { MosfetCard } from './MosfetCard'
import { DigiKeySearchPanel } from './DigiKeySearchPanel'
import {
  selectBadge, GateDriveSection, InductorCard,
  SoftStartDisplay, CurrentSensingDisplay,
  FeedbackNetworkDisplay, CapLifetimeRow, TransformerDetails,
} from './SuggestionSubPanels'
import {
  HIGH_SIDE_TOPOLOGIES, NON_ISOLATED, ISOLATED_TOPOLOGIES,
  mosfetVdsRequired, getModeColor,
} from './suggestionFormatters'
import styles from './ComponentSuggestions.module.css'

// ── Tooltip content builders ──────────────────────────────────────────────────

/** Builds the inductance tooltip JSX given the calculated inductance. */
function inductanceTip(inductanceH: number): React.ReactElement {
  return (
    <div><strong>Inductance</strong><br />Calculated value: {(inductanceH * 1e6).toFixed(2)} µH<br />
      <code style={{ fontSize: '10px' }}>L = ΔIL / (fsw × Iout)</code><br />
      <small style={{ color: 'var(--text-secondary)' }}>Larger L = smoother current, smaller ripple</small></div>
  )
}

/** Builds the capacitance tooltip JSX given the calculated capacitance. */
function capacitanceTip(capacitanceF: number): React.ReactElement {
  return (
    <div><strong>Capacitance</strong><br />Calculated value: {(capacitanceF * 1e6).toFixed(1)} µF<br />
      <code style={{ fontSize: '10px' }}>C ≥ ΔIL / (fsw × ΔVout)</code><br />
      <small style={{ color: 'var(--text-secondary)' }}>Larger C = lower ripple voltage</small></div>
  )
}

/** Builds the MOSFET tooltip given voltage stress and peak current. */
function mosfetTip(vdsV: number, peakA: number): React.ReactElement {
  return (
    <div><strong>Power MOSFET (Q1)</strong><br />Vds stress: {vdsV.toFixed(0)} V<br />Peak current: {peakA.toFixed(2)} A<br />
      <small style={{ color: 'var(--text-secondary)' }}>Sorted by lowest Rds_on × Qg figure of merit</small></div>
  )
}

/** Builds the peak current tooltip (used on the Isat value in the inductor card). */
function peakCurrentTip(peakA: number): React.ReactElement {
  return (
    <div><strong>Peak Inductor Current</strong><br />Value: {peakA.toFixed(2)} A<br />
      <small style={{ color: 'var(--text-secondary)' }}>Must choose inductor with Isat rating higher than this</small></div>
  )
}

/** Builds the CCM/DCM boundary tooltip. */
function ccmBoundaryTip(boundary: number, mode?: string): React.ReactElement {
  return (
    <div><strong>CCM/DCM Boundary</strong><br />Minimum load current for CCM: {boundary.toFixed(3)} A<br />
      Operating mode: <strong>{mode ?? 'Unknown'}</strong><br />
      <small style={{ color: 'var(--text-secondary)' }}>Design equations assume CCM. Load below this enters DCM and equations become inaccurate.</small></div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/** Component suggestions panel; shows "run simulation first" when no result is available. */
export function ComponentSuggestions(): React.ReactElement {
  const { result, spec, topology, selectedComponents, setSelectedComponent, feedbackOptions, softStartOptions, setActiveVizTab, digiKeyEnabled } = useDesignStore()

  if (!result) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>Components</div>
        <div className={styles.empty}>Run a simulation first.</div>
      </div>
    )
  }

  // ── Derive component suggestions and analysis results ────────────────────
  const vdsReq     = mosfetVdsRequired(topology, spec.vinMax, spec.vout)
  const inductor   = suggestInductors(result.inductance * 1e6, result.peakCurrent)[0]
  const capacitor  = suggestCapacitors(result.capacitance * 1e6, spec.vout * 1.5)[0]
  const mosfet     = suggestMosfets(vdsReq)[0]
  const syncMode   = spec.rectification === 'synchronous'
  const syncMosfet = (syncMode && NON_ISOLATED.has(topology))
    ? suggestMosfets(vdsReq).slice().sort((a, b) => a.rds_on_mohm - b.rds_on_mohm)[0]
    : null
  const gateDrive  = mosfet ? computeGateDrive(spec, result, mosfet) : null
  const deltaIL    = 2 * Math.max(result.peakCurrent - spec.iout, 0)
  const capRipple  = deltaIL / (2 * Math.sqrt(3))
  const capLife    = (capacitor?.type === 'electrolytic')
    ? estimateLifetime(capacitor, { irms_actual: capRipple, vdc: spec.vout, ambient_temp_C: spec.ambientTemp })
    : null
  const capDerating = capacitor
    ? derateCapacitance(capacitor.capacitance_uf, spec.vout, capacitor.voltage_v, capacitor.dielectric ?? capacitor.type, capacitor.package ?? '')
    : null
  const softStart  = designSoftStart(topology, spec, result, inductor, softStartOptions)
  const feedback   = ISOLATED_TOPOLOGIES.has(topology) ? null : designFeedback(spec.vout, feedbackOptions)
  const sel        = selectedComponents

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Components</div>

      {/* ── MOSFET (Q1) ──────────────────────────────────────────── */}
      {mosfet && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>MOSFET (Q1) <Tooltip content={mosfetTip(vdsReq, result.peakCurrent)} side="right"><span className={styles.infoIcon}>ⓘ</span></Tooltip>{selectBadge(sel.mosfet?.part_number === mosfet.part_number)}</div>
          <MosfetCard data={mosfet} isSelected={sel.mosfet?.part_number === mosfet.part_number} onSelect={() => setSelectedComponent('mosfet', sel.mosfet?.part_number === mosfet.part_number ? null : mosfet)} />
          {digiKeyEnabled && <DigiKeySearchPanel requirements={{ type: 'mosfet', vds_min_v: vdsReq, id_min_a: result.peakCurrent }} />}
        </div>
      )}

      {/* ── Sync FET (Q2) ────────────────────────────────────────── */}
      {syncMosfet && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Sync FET (Q2) <Tooltip content={<div><strong>Low-Side Sync MOSFET (Q2)</strong><br />Replaces freewheeling diode — eliminates 0.7 V Vf drop.<br />Optimised for lowest Rds_on; sorted by Rds_on ascending.<br /><small style={{ color: 'var(--text-secondary)' }}>Vds same as Q1</small></div>} side="right"><span className={styles.infoIcon}>ⓘ</span></Tooltip></div>
          <MosfetCard data={syncMosfet} isSelected={false} onSelect={() => {/* sync FET selection not persisted yet */}} />
        </div>
      )}

      {/* ── Gate Drive ───────────────────────────────────────────── */}
      {gateDrive && <GateDriveSection gd={gateDrive} showBootstrap={HIGH_SIDE_TOPOLOGIES.has(topology)} />}

      {/* ── Inductor (L1) ────────────────────────────────────────── */}
      {inductor && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Inductor (L1) <Tooltip content={inductanceTip(result.inductance)} side="right"><span className={styles.infoIcon}>ⓘ</span></Tooltip>{selectBadge(sel.inductor?.part_number === inductor.part_number)}</div>
          <InductorCard inductor={inductor} peakCurrent={result.peakCurrent} iout={spec.iout} isSelected={sel.inductor?.part_number === inductor.part_number} peakCurrentTooltip={peakCurrentTip(result.peakCurrent)} onSelect={() => setSelectedComponent('inductor', sel.inductor?.part_number === inductor.part_number ? null : inductor)} />
          {digiKeyEnabled && <DigiKeySearchPanel requirements={{ type: 'inductor', inductance_uh: result.inductance * 1e6, isat_min_a: result.peakCurrent, irms_min_a: spec.iout }} />}
        </div>
      )}

      {/* ── Output Capacitor (Cout) ──────────────────────────────── */}
      {capacitor && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Output Cap (Cout) <Tooltip content={capacitanceTip(result.capacitance)} side="right"><span className={styles.infoIcon}>ⓘ</span></Tooltip>{selectBadge(sel.capacitor?.part_number === capacitor.part_number)}</div>
          <div className={styles.card}>
            <div className={styles.cardHeader}><span className={styles.rank}>#1</span><span className={styles.partNumber}>{capacitor.part_number}</span></div>
            <div className={styles.manufacturer}>{capacitor.manufacturer}</div>
            <div className={styles.specs}>
              <span className={styles.spec}><strong>{capacitor.capacitance_uf}</strong> µF</span>
              <span className={styles.spec}><strong>{capacitor.voltage_v}</strong> V</span>
              <span className={styles.spec}>ESR <strong>{capacitor.esr_mohm}</strong> mΩ</span>
              <span className={styles.spec}>{capacitor.type}</span>
            </div>
            {capDerating !== null && capDerating.ratio < 0.99 && (
              <div className={styles.deratingRow}>
                <span className={styles.deratingLabel}>DC bias derated</span>
                <span className={styles.deratingValue} style={{ color: capDerating.ratio < 0.5 ? '#f87171' : '#fbbf24' }}>
                  {capDerating.effective_uF.toFixed(2)} µF ({(capDerating.ratio * 100).toFixed(0)} %)
                </span>
              </div>
            )}
            {capLife !== null ? <CapLifetimeRow lifetime={capLife} ambientTemp={spec.ambientTemp} />
              : capacitor.type !== 'electrolytic' && <div className={styles.lifetimeRow}><span className={styles.lifetimeLabel}>Lifetime</span><span className={styles.lifetimeNa}>N/A — ceramic caps have no wear-out</span></div>}
            <button className={styles.selectButton} onClick={() => setSelectedComponent('capacitor', sel.capacitor?.part_number === capacitor.part_number ? null : capacitor)}>{sel.capacitor?.part_number === capacitor.part_number ? 'Deselect' : 'Select'}</button>
          </div>
          {digiKeyEnabled && <DigiKeySearchPanel requirements={{ type: 'capacitor', capacitance_uf: result.capacitance * 1e6, voltage_min_v: spec.vout * 1.5 }} />}
        </div>
      )}

      {/* ── Soft-Start ───────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Soft-Start</div>
        <SoftStartDisplay ss={softStart} onTransientClick={() => setActiveVizTab('transient')} />
      </div>

      {/* ── Current Sensing ──────────────────────────────────────── */}
      {(spec.controlMode ?? 'voltage') === 'current' && result.current_sense && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Current Sensing</div>
          <CurrentSensingDisplay cs={result.current_sense} />
        </div>
      )}

      {/* ── Feedback Network ─────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Feedback Network</div>
        {ISOLATED_TOPOLOGIES.has(topology)
          ? <div className={styles.fbNote}>⚠ Feedback network is on the secondary side. TL431 + optocoupler compensation not included — see control-loop analysis for loop design.</div>
          : feedback && <FeedbackNetworkDisplay fb={feedback} vout={spec.vout} />}
      </div>

      {/* ── CCM/DCM badge ────────────────────────────────────────── */}
      {result.ccm_dcm_boundary != null && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>CCM/DCM Operating Mode <Tooltip content={ccmBoundaryTip(result.ccm_dcm_boundary, result.operating_mode)} side="right"><span className={styles.infoIcon}>ⓘ</span></Tooltip></div>
          <div className={styles.card} style={{ padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Operating Mode:</span>
              <span style={{ color: getModeColor(result.operating_mode), fontWeight: 'bold', fontSize: '14px' }}>{result.operating_mode ?? 'Unknown'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>CCM Boundary:</span>
              <span style={{ fontWeight: 'bold' }}>{result.ccm_dcm_boundary.toFixed(3)} A</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>Load current below {result.ccm_dcm_boundary.toFixed(3)} A enters DCM</div>
          </div>
        </div>
      )}

      {/* ── Transformer winding ──────────────────────────────────── */}
      {result.winding_result && (
        <details className={styles.section} open={false}>
          <summary className={styles.gdrSummary}>Transformer Details</summary>
          <TransformerDetails wr={result.winding_result} />
        </details>
      )}

      {/* ── Flyback multi-output summary ─────────────────────────── */}
      {result.secondaryOutputResults && result.secondaryOutputResults.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Multi-Output Summary</div>
          <table className={styles.moTable}>
            <thead><tr><th>Output</th><th>Vout</th><th>Ns</th><th>Diode Vr</th><th>Cout</th><th>Cross-Reg</th></tr></thead>
            <tbody>
              <tr><td className={styles.moLabel}>Out 1</td><td>{spec.vout.toFixed(1)} V</td><td>{result.secondaryTurns ?? '—'}</td><td>—</td><td>{(result.capacitance * 1e6).toFixed(1)} µF</td><td className={styles.moRegulated}>Regulated</td></tr>
              {result.secondaryOutputResults.map((s) => (
                <tr key={s.label}><td className={styles.moLabel}>{s.label}</td><td>{s.vout_nominal.toFixed(1)} V</td><td>{s.ns}</td><td>{s.diode_vr_max.toFixed(0)} V</td><td>{(s.capacitance * 1e6).toFixed(1)} µF</td><td className={s.crossRegPct > 0 ? styles.moCrossReg : styles.moRegulated}>{s.crossRegPct > 0 ? `±${s.crossRegPct.toFixed(1)} %` : 'Regulated'}</td></tr>
              ))}
            </tbody>
          </table>
          <div className={styles.moWarning}>⚠ Cross-regulation on unregulated outputs is typically ±5–10 %. Use post-regulators (LDO) for tight regulation.</div>
        </div>
      )}
    </div>
  )
}

// Re-export data types consumed by external code (e.g. Toolbar, ComparisonView)
export type { InductorData, CapacitorData, MosfetData }
