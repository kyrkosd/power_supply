// Sub-components for ComponentSuggestions: gate drive, inductor, soft-start, current sensing,
// feedback network, capacitor lifetime, and transformer winding panels.
import React from 'react'
import type { GateDriveResult } from '../../engine/gate-drive'
import type { SoftStartResult } from '../../engine/soft-start'
import type { CurrentSenseResult } from '../../engine/current-sense'
import { fmtResistor, type FeedbackResult } from '../../engine/feedback'
import type { CapLifetimeResult } from '../../engine/cap-lifetime'
import type { WindingResult, WindingSection } from '../../engine/transformer-winding'
import { checkSaturation } from '../../engine/inductor-saturation'
import type { InductorData } from '../../engine/component-selector'
import { Tooltip } from '../Tooltip/Tooltip'
import {
  fmtTime, fmtCap, fmtPower, fmtMs, fmtCap2,
  snrColor, errorColor, lifetimeColor, fillColor, frColor,
} from './suggestionFormatters'
import styles from './ComponentSuggestions.module.css'

// ── Shared badge ──────────────────────────────────────────────────────────────

/** Green "✓ selected" pill shown beside any section header when the part is active. */
export function selectBadge(isSelected: boolean): React.ReactElement | null {
  if (!isSelected) return null
  return (
    <span style={{ fontSize: '10px', background: '#1a4a2e', color: '#4ade80', borderRadius: '3px', padding: '1px 5px', marginLeft: '6px' }}>
      ✓ selected
    </span>
  )
}

// ── Gate Drive section ────────────────────────────────────────────────────────

/** A labelled row inside the Gate Drive `<details>` panel with an info tooltip. */
export function GdrRow({ label, value, tip }: { label: string; value: string; tip: React.ReactNode }): React.ReactElement {
  return (
    <div className={styles.gdrRow}>
      <span className={styles.gdrLabel}>
        {label}
        <Tooltip content={tip} side="left"><span className={styles.infoIcon}>ⓘ</span></Tooltip>
      </span>
      <span className={styles.gdrValue}>{value}</span>
    </div>
  )
}

/** Bootstrap-related rows; rendered only for high-side topologies (buck, forward). */
function BootstrapRows({ gd }: { gd: GateDriveResult }): React.ReactElement {
  return (
    <>
      <div className={styles.gdrDivider} />
      <GdrRow label="Bootstrap Cap (Cboot)" value={fmtCap(gd.bootstrap_cap)} tip={
        <div>
          <strong>Bootstrap capacitor</strong><br />
          Supplies charge to the high-side gate driver when the switch node flies above the rail.
          Charges through a diode during low-side on-time; discharges into the gate during high-side on-time.<br /><br />
          <code style={{ fontSize: '10px' }}>Cboot ≥ 10 × Qg / ΔVboot</code><br />
          <small style={{ color: 'var(--text-secondary)' }}>ΔVboot = 0.2 V max droop. TI SLVA301.</small>
        </div>
      } />
      <GdrRow label="Bootstrap Diode Vr" value={`${gd.bootstrap_diode_vr.toFixed(0)} V`} tip={
        <div>
          <strong>Bootstrap diode reverse voltage</strong><br />
          <code style={{ fontSize: '10px' }}>Vr ≥ Vin_max + Vgs</code><br />
          Blocks Vin + gate supply when the high-side switch is on. Use a fast-recovery or Schottky diode.
        </div>
      } />
    </>
  )
}

/** Collapsible gate-drive design panel (Rg, timing, bootstrap). */
export function GateDriveSection({ gd, showBootstrap }: { gd: GateDriveResult; showBootstrap: boolean }): React.ReactElement {
  return (
    <details className={styles.section} open={false}>
      <summary className={styles.gdrSummary}>Gate Drive Design</summary>
      <div className={styles.gdrBody}>
        <GdrRow label="Gate Resistor (Rg)" value={`${gd.gate_resistor.toFixed(1)} Ω`} tip={
          <div><strong>External gate resistor</strong><br />Limits peak gate current to ~{gd.peak_gate_current.toFixed(1)} A.<br />Too small → fast switching, high EMI. Too large → higher losses.<br /><small>TI SLUA618</small></div>
        } />
        <GdrRow label="Peak Gate Current" value={`${gd.peak_gate_current.toFixed(2)} A`} tip={
          <div><strong>Peak gate current</strong><br /><code style={{ fontSize: '10px' }}>Ig = Vgs / (Rg + Rg_int)</code><br />Typical integrated driver limit: 1–4 A.</div>
        } />
        <GdrRow label="Gate Drive Power" value={fmtPower(gd.gate_drive_power)} tip={
          <div><strong>Gate drive dissipation</strong><br /><code style={{ fontSize: '10px' }}>Pgd = Qg × Vgs × fsw</code><br />Energy lost every cycle in the driver. Microchip AN1471.</div>
        } />
        <GdrRow label="Turn-on Time" value={fmtTime(gd.turn_on_time)} tip={
          <div><strong>Gate turn-on time</strong><br /><code style={{ fontSize: '10px' }}>t_on ≈ Qg / Ig_peak</code><br />Time to charge the gate fully. Determines dv/dt during turn-on. Infineon AN_201702_PL52_014.</div>
        } />
        <GdrRow label="Turn-off Time" value={fmtTime(gd.turn_off_time)} tip={
          <div><strong>Gate turn-off time</strong><br /><code style={{ fontSize: '10px' }}>t_off ≈ Qgd / Ig_peak</code><br />Dominated by the Miller charge Qgd, which controls dv/dt during turn-off.</div>
        } />
        <GdrRow label="Dead Time (rec.)" value={fmtTime(gd.dead_time_recommended)} tip={
          <div><strong>Recommended dead time</strong><br /><code style={{ fontSize: '10px' }}>t_dead = max(t_on, t_off) × 1.5</code><br />Prevents shoot-through. Erickson &amp; Maksimovic §4.3.</div>
        } />
        {showBootstrap && <BootstrapRows gd={gd} />}
      </div>
    </details>
  )
}

// ── Inductor card ─────────────────────────────────────────────────────────────

interface InductorCardProps {
  /** Inductor candidate from the local database. */
  inductor: InductorData
  /** Peak inductor current used to check saturation margin. */
  peakCurrent: number
  /** Rated output current used as a DCM/CCM boundary reference. */
  iout: number
  /** Whether this inductor is currently selected in the design store. */
  isSelected: boolean
  /** Tooltip content for the Isat value. */
  peakCurrentTooltip: React.ReactNode
  /** Called when the Select / Deselect button is clicked. */
  onSelect: () => void
}

/** Compute saturation margin label and colour from a checkSaturation result. */
function satLabel(inductor: InductorData, peakCurrent: number, iout: number): { label: string; color: string } {
  const sat = checkSaturation(peakCurrent, iout, inductor)
  const color = sat.is_saturated || (sat.margin_pct !== null && sat.margin_pct < 10) ? '#ef4444'
    : sat.margin_pct !== null && sat.margin_pct < 30 ? '#f59e0b' : '#4ade80'
  const label = sat.is_saturated ? 'SATURATED'
    : sat.margin_pct !== null ? `${sat.margin_pct.toFixed(0)} % headroom`
    : `B ≈ ${(sat.estimated_B_peak / sat.B_sat_material * 100).toFixed(0)} % of Bsat`
  return { label, color }
}

/** Inductor card with specs, saturation margin badge, and select toggle. */
export function InductorCard({ inductor, peakCurrent, iout, isSelected, peakCurrentTooltip, onSelect }: InductorCardProps): React.ReactElement {
  const { label, color } = satLabel(inductor, peakCurrent, iout)
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.rank}>#1</span>
        <span className={styles.partNumber}>{inductor.part_number}</span>
      </div>
      <div className={styles.manufacturer}>{inductor.manufacturer}</div>
      <div className={styles.specs}>
        <span className={styles.spec}><strong>{inductor.inductance_uh}</strong> µH</span>
        <span className={styles.spec}>DCR <strong>{inductor.dcr_mohm}</strong> mΩ</span>
        <span className={styles.spec}>
          Isat <Tooltip content={peakCurrentTooltip} side="top"><strong>{inductor.isat_a}</strong></Tooltip> A
        </span>
        <span className={styles.spec}>Irms <strong>{inductor.irms_a}</strong> A</span>
      </div>
      <div className={styles.satRow}>
        <span className={styles.satLabel}>Sat. margin</span>
        <span className={styles.satValue} style={{ color }}>{label}</span>
      </div>
      <button className={styles.selectButton} onClick={onSelect}>
        {isSelected ? 'Deselect' : 'Select'}
      </button>
    </div>
  )
}

// ── Soft-start panel ──────────────────────────────────────────────────────────

/** Yes / No badge pill with pass/fail colour. */
export function YesNo({ ok, label }: { ok: boolean; label: string }): React.ReactElement {
  return <span className={ok ? styles.ssBadgeOk : styles.ssBadgeWarn}>{ok ? `✓ ${label}` : `✗ ${label}`}</span>
}

/** Soft-start parameter display with Css tooltip and link to the transient tab. */
export function SoftStartDisplay({ ss, onTransientClick }: { ss: SoftStartResult; onTransientClick: () => void }): React.ReactElement {
  const cssTip = (
    <div>
      <strong>Soft-start capacitor</strong><br />
      <code style={{ fontSize: '10px' }}>Css = Iss × tss / Vref</code><br />
      <code style={{ fontSize: '10px' }}>= {(ss.iss * 1e6).toFixed(0)} µA × {fmtMs(ss.tss_used)} / 0.8 V</code><br />
      <small style={{ color: 'var(--text-secondary)' }}>ON Semiconductor AND9135</small>
    </div>
  )
  return (
    <div className={styles.fbBody}>
      <div className={styles.fbRow}><span className={styles.fbLabel}>tss (used)</span><span className={styles.fbValue}>{fmtMs(ss.tss_used)}</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>tss (recommended)</span><span className={styles.fbValue}>{fmtMs(ss.recommended_tss)}</span></div>
      <div className={styles.fbRow}>
        <span className={styles.fbLabel}>Css <Tooltip content={cssTip} side="left"><span className={styles.infoIcon}>ⓘ</span></Tooltip></span>
        <span className={styles.fbValue}>{fmtCap2(ss.css)}</span>
      </div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Inrush (no SS)</span><span className={styles.fbValue} style={{ color: ss.peak_inrush_a > 50 ? '#ef4444' : 'inherit' }}>{ss.peak_inrush_a.toFixed(0)} A</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Inrush (with SS)</span><span className={styles.fbValue}>{ss.peak_inrush_with_ss.toFixed(2)} A</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Monotonic startup</span><YesNo ok={ss.output_monotonic} label={ss.output_monotonic ? 'Yes' : 'No'} /></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Pre-bias safe</span><YesNo ok={ss.pre_bias_safe} label={ss.pre_bias_safe ? 'Yes' : 'No'} /></div>
      {ss.warnings.map((w, i) => <div key={i} className={styles.ssWarn}>{w}</div>)}
      <button className={styles.ssTransientLink} onClick={onTransientClick}>→ Transient tab for startup simulation</button>
    </div>
  )
}

// ── Current sensing panel ─────────────────────────────────────────────────────

/** Current-sense result display (resistor or Rds(on) method). */
export function CurrentSensingDisplay({ cs }: { cs: CurrentSenseResult }): React.ReactElement {
  return (
    <div className={styles.card} style={{ padding: '12px' }}>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Method</span><span className={styles.fbValue}>{cs.method === 'resistor' ? 'Sense Resistor' : 'Rds(on)'}</span></div>
      {cs.method === 'resistor' && (
        <>
          <div className={styles.fbRow}><span className={styles.fbLabel}>Rsense</span><span className={styles.fbValue}>{(cs.rsense * 1000).toFixed(2)} mΩ</span></div>
          <div className={styles.fbRow}><span className={styles.fbLabel}>Package</span><span className={styles.fbValue}>{cs.rsense_package}</span></div>
          <div className={styles.fbRow}><span className={styles.fbLabel}>Rsense power</span><span className={styles.fbValue}>{fmtPower(cs.rsense_power)}</span></div>
          <div className={styles.fbRow}><span className={styles.fbLabel}>Kelvin connections</span><span className={styles.fbValue} style={{ color: cs.kelvin_connection_required ? '#f59e0b' : '#4ade80' }}>{cs.kelvin_connection_required ? 'Required' : 'Not required'}</span></div>
        </>
      )}
      {cs.method === 'rdson' && <div className={styles.fbRow}><span className={styles.fbLabel}>Temp accuracy</span><span className={styles.fbValue} style={{ color: '#f59e0b' }}>±{cs.rdson_temp_error_pct.toFixed(0)} % (25–100 °C)</span></div>}
      <div className={styles.fbRow}><span className={styles.fbLabel}>Vsense peak</span><span className={styles.fbValue}>{(cs.vsense_peak * 1000).toFixed(1)} mV</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Vsense valley</span><span className={styles.fbValue}>{(cs.vsense_valley * 1000).toFixed(1)} mV</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>SNR @ 10 % load</span><span className={styles.fbValue} style={{ color: snrColor(cs.snr_at_light_load) }}>{cs.snr_at_light_load.toFixed(1)} dB</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Slope comp ramp</span><span className={styles.fbValue}>{(cs.slope_comp_ramp / 1e6).toFixed(2)} V/µs</span></div>
      {cs.warnings.map((w, i) => <div key={i} className={styles.ssWarn}>{w}</div>)}
    </div>
  )
}

// ── Feedback network panel ────────────────────────────────────────────────────

/** Feedback voltage divider result display with E96/E24 series label. */
export function FeedbackNetworkDisplay({ fb, vout }: { fb: FeedbackResult; vout: number }): React.ReactElement {
  const seriesLabel = fb.e96_values_used ? 'E96' : 'E24'
  const idealTop = fmtResistor(fb.vref / fb.divider_current * (vout / fb.vref - 1))
  const idealBot = fmtResistor(fb.vref / fb.divider_current)
  const tip = (
    <div>
      <strong>Feedback voltage divider</strong><br />
      Vout = Vref × (1 + Rtop / Rbot)<br />
      <code style={{ fontSize: '10px' }}>= {fb.vref} × (1 + {fmtResistor(fb.r_top)} / {fmtResistor(fb.r_bottom)})</code><br />
      Ideal: Rtop {idealTop}, Rbot {idealBot}. Snapped to {seriesLabel}.<br />
      <small style={{ color: 'var(--text-secondary)' }}>TI SLVA477B eq. 3</small>
    </div>
  )
  return (
    <div className={styles.fbBody}>
      <div className={styles.fbRow}><span className={styles.fbLabel}>R_top <Tooltip content={tip} side="left"><span className={styles.infoIcon}>ⓘ</span></Tooltip></span><span className={styles.fbValue}>{fmtResistor(fb.r_top)} <span className={styles.fbSeries}>{seriesLabel}</span></span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>R_bottom</span><span className={styles.fbValue}>{fmtResistor(fb.r_bottom)} <span className={styles.fbSeries}>{seriesLabel}</span></span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Actual Vout</span><span className={styles.fbValue}>{fb.actual_vout.toFixed(4)} V</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Error</span><span className={styles.fbValue} style={{ color: errorColor(fb.vout_error_pct) }}>{fb.vout_error_pct >= 0 ? '+' : ''}{fb.vout_error_pct.toFixed(3)} %</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Divider current</span><span className={styles.fbValue}>{(fb.divider_current * 1e6).toFixed(0)} µA</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Power</span><span className={styles.fbValue}>{(fb.power_dissipated * 1000).toFixed(2)} mW</span></div>
    </div>
  )
}

// ── Capacitor lifetime row ────────────────────────────────────────────────────

/** Arrhenius lifetime estimate row for electrolytic capacitors. */
export function CapLifetimeRow({ lifetime, ambientTemp }: { lifetime: CapLifetimeResult; ambientTemp: number }): React.ReactElement {
  const years = lifetime.derated_lifetime_years
  const tip = (
    <div>
      <strong>Arrhenius lifetime model</strong><br />
      Base: {lifetime.base_lifetime_hours.toLocaleString()} h at {lifetime.temp_rated} °C<br />
      Self-heating: +{lifetime.self_heating_C.toFixed(1)} °C<br />
      Operating temp: {lifetime.operating_temp.toFixed(1)} °C (ambient {ambientTemp} °C)<br />
      Ripple ratio: {(lifetime.ripple_current_ratio * 100).toFixed(0)} % of rated<br />
      Voltage stress: {(lifetime.voltage_stress_ratio * 100).toFixed(0)} % of rated<br />
      <code style={{ fontSize: '10px' }}>L = L₀ × 2^((T_rated − T_op) / 10)</code><br />
      <small style={{ color: 'var(--text-secondary)' }}>Nichicon UPS3, IEC 61709 §6</small>
    </div>
  )
  return (
    <>
      <div className={styles.lifetimeRow}>
        <span className={styles.lifetimeLabel}>Est. lifetime <Tooltip content={tip} side="left"><span className={styles.infoIcon}>ⓘ</span></Tooltip></span>
        <span className={styles.lifetimeValue} style={{ color: lifetimeColor(years) }}>{years >= 100 ? '>100 yr' : `${years.toFixed(1)} yr`} @ {ambientTemp} °C</span>
      </div>
      {lifetime.warnings.map((w, i) => <div key={i} className={styles.lifetimeWarn}>{w}</div>)}
    </>
  )
}

// ── Transformer winding panels ────────────────────────────────────────────────

/** One winding section row showing AWG, turns, layers, resistance, and fill. */
export function WindingRow({ label, w }: { label: string; w: WindingSection }): React.ReactElement {
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '2px' }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', fontSize: '12px' }}>
        <span>AWG {w.wire_gauge_awg} × {w.strands} strand{w.strands > 1 ? 's' : ''}</span>
        <span>{w.turns} turns, {w.layers} layer{w.layers > 1 ? 's' : ''}</span>
        <span>R: {w.resistance_mohm.toFixed(1)} mΩ</span>
      </div>
      <div style={{ fontSize: '11px', color: fillColor(w.fill_factor_pct) }}>Fill: {w.fill_factor_pct.toFixed(1)} %</div>
    </div>
  )
}

/** Full transformer winding details: skin depth, Fr factor, windings, leakage, creepage. */
export function TransformerDetails({ wr }: { wr: WindingResult }): React.ReactElement {
  const totalFill = wr.primary.fill_factor_pct + wr.secondary.reduce((a, s) => a + s.fill_factor_pct, 0)
  return (
    <div className={styles.gdrBody}>
      <div className={styles.gdrRow}>
        <span className={styles.gdrLabel}>Skin depth (δ) <Tooltip content={<div><strong>Skin depth</strong><br /><code style={{ fontSize: '10px' }}>δ = 66.2 / √fsw mm</code><br /><small>Copper at 20 °C. Max strand = 2δ. Kazimierczuk eq. 4.60</small></div>} side="left"><span className={styles.infoIcon}>ⓘ</span></Tooltip></span>
        <span className={styles.gdrValue}>{wr.skin_depth_mm.toFixed(3)} mm (max strand: {wr.max_strand_diameter_mm.toFixed(3)} mm)</span>
      </div>
      <div className={styles.gdrRow}>
        <span className={styles.gdrLabel}>AC loss factor (Fr) <Tooltip content={<div><strong>Dowell proximity factor</strong><br /><code style={{ fontSize: '10px' }}>Fr = Rac / Rdc</code><br />Fr &gt; 2 → significant AC losses; use litz wire.<br /><small>Dowell (1966) IEE Proc. 113(8)</small></div>} side="left"><span className={styles.infoIcon}>ⓘ</span></Tooltip></span>
        <span className={styles.gdrValue} style={{ color: frColor(wr.proximity_loss_factor) }}>{wr.proximity_loss_factor.toFixed(2)}</span>
      </div>
      <div className={styles.gdrDivider} />
      <WindingRow label="Primary" w={wr.primary} />
      {wr.secondary.map((s, i) => <WindingRow key={i} label={`Secondary ${i + 1}`} w={s} />)}
      <div className={styles.gdrRow} style={{ marginTop: '4px' }}>
        <span className={styles.gdrLabel}>Total bobbin fill</span>
        <span className={styles.gdrValue} style={{ color: fillColor(totalFill) }}>{totalFill.toFixed(1)} %</span>
      </div>
      <div className={styles.gdrDivider} />
      <div className={styles.gdrRow}>
        <span className={styles.gdrLabel}>Leakage inductance <Tooltip content={<div><strong>Estimated leakage inductance</strong><br /><code style={{ fontSize: '10px' }}>Llk = μ₀ × Np² × MLT × (b_ins/3) / bw</code><br /><small>Kazimierczuk eq. 6.28</small></div>} side="left"><span className={styles.infoIcon}>ⓘ</span></Tooltip></span>
        <span className={styles.gdrValue}>{wr.estimated_leakage_nh.toFixed(0)} nH</span>
      </div>
      <div className={styles.gdrRow}><span className={styles.gdrLabel}>Total copper loss</span><span className={styles.gdrValue}>{fmtPower(wr.total_copper_loss)}</span></div>
      <div className={styles.gdrDivider} />
      <div className={styles.gdrRow}><span className={styles.gdrLabel}>Winding order</span><span className={styles.gdrValue} style={{ fontSize: '11px' }}>{wr.winding_order.join(' → ')}</span></div>
      <div className={styles.gdrRow}>
        <span className={styles.gdrLabel}>Creepage (IEC 62368-1) <Tooltip content={<div><strong>Creepage &amp; clearance</strong><br />Reinforced insulation, pollution degree 2.<br /><small>IEC 62368-1:2018 Table F.5</small></div>} side="left"><span className={styles.infoIcon}>ⓘ</span></Tooltip></span>
        <span className={styles.gdrValue}>{wr.creepage_mm.toFixed(1)} mm creepage / {wr.clearance_mm.toFixed(1)} mm clearance</span>
      </div>
      {wr.warnings.map((w, i) => <div key={i} className={styles.ssWarn}>{w}</div>)}
    </div>
  )
}
