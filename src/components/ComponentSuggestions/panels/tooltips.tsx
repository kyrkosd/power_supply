// Static and parameterised tooltip JSX bodies used across the suggestion panels.
// Splitting them out keeps the panel files free of inline formula prose.
import React from 'react'
import type { GateDriveResult } from '../../../engine/gate-drive'
import type { SoftStartResult } from '../../../engine/soft-start'
import type { FeedbackResult } from '../../../engine/feedback'
import { fmtResistor } from '../../../engine/feedback'
import type { CapLifetimeResult } from '../../../engine/cap-lifetime'
import { fmtMs } from '../suggestionFormatters'

const small: React.CSSProperties = { fontSize: '10px' }
const muted: React.CSSProperties = { color: 'var(--text-secondary)' }

export function gateResistorTip(gd: GateDriveResult): React.ReactNode {
  return (
    <div><strong>External gate resistor</strong><br />Limits peak gate current to ~{gd.peak_gate_current.toFixed(1)} A.<br />
      Too small → fast switching, high EMI. Too large → higher losses.<br /><small>TI SLUA618</small></div>
  )
}

export const peakGateCurrentTip: React.ReactNode = (
  <div><strong>Peak gate current</strong><br /><code style={small}>Ig = Vgs / (Rg + Rg_int)</code><br />
    Typical integrated driver limit: 1–4 A.</div>
)

export const gateDrivePowerTip: React.ReactNode = (
  <div><strong>Gate drive dissipation</strong><br /><code style={small}>Pgd = Qg × Vgs × fsw</code><br />
    Energy lost every cycle in the driver. Microchip AN1471.</div>
)

export const turnOnTip: React.ReactNode = (
  <div><strong>Gate turn-on time</strong><br /><code style={small}>t_on ≈ Qg / Ig_peak</code><br />
    Time to charge the gate fully. Determines dv/dt during turn-on. Infineon AN_201702_PL52_014.</div>
)

export const turnOffTip: React.ReactNode = (
  <div><strong>Gate turn-off time</strong><br /><code style={small}>t_off ≈ Qgd / Ig_peak</code><br />
    Dominated by the Miller charge Qgd, which controls dv/dt during turn-off.</div>
)

export const deadTimeTip: React.ReactNode = (
  <div><strong>Recommended dead time</strong><br /><code style={small}>t_dead = max(t_on, t_off) × 1.5</code><br />
    Prevents shoot-through. Erickson &amp; Maksimovic §4.3.</div>
)

export const bootstrapCapTip: React.ReactNode = (
  <div><strong>Bootstrap capacitor</strong><br />
    Supplies charge to the high-side gate driver when the switch node flies above the rail.
    Charges through a diode during low-side on-time; discharges into the gate during high-side on-time.<br /><br />
    <code style={small}>Cboot ≥ 10 × Qg / ΔVboot</code><br />
    <small style={muted}>ΔVboot = 0.2 V max droop. TI SLVA301.</small></div>
)

export const bootstrapDiodeTip: React.ReactNode = (
  <div><strong>Bootstrap diode reverse voltage</strong><br /><code style={small}>Vr ≥ Vin_max + Vgs</code><br />
    Blocks Vin + gate supply when the high-side switch is on. Use a fast-recovery or Schottky diode.</div>
)

export function softStartCssTip(ss: SoftStartResult): React.ReactNode {
  return (
    <div>
      <strong>Soft-start capacitor</strong><br />
      <code style={small}>Css = Iss × tss / Vref</code><br />
      <code style={small}>= {(ss.iss * 1e6).toFixed(0)} µA × {fmtMs(ss.tss_used)} / 0.8 V</code><br />
      <small style={muted}>ON Semiconductor AND9135</small>
    </div>
  )
}

export function feedbackDividerTip(fb: FeedbackResult, vout: number, seriesLabel: string): React.ReactNode {
  const idealTop = fmtResistor(fb.vref / fb.divider_current * (vout / fb.vref - 1))
  const idealBot = fmtResistor(fb.vref / fb.divider_current)
  return (
    <div>
      <strong>Feedback voltage divider</strong><br />
      Vout = Vref × (1 + Rtop / Rbot)<br />
      <code style={small}>= {fb.vref} × (1 + {fmtResistor(fb.r_top)} / {fmtResistor(fb.r_bottom)})</code><br />
      Ideal: Rtop {idealTop}, Rbot {idealBot}. Snapped to {seriesLabel}.<br />
      <small style={muted}>TI SLVA477B eq. 3</small>
    </div>
  )
}

export function capLifetimeTip(lifetime: CapLifetimeResult, ambientTemp: number): React.ReactNode {
  return (
    <div>
      <strong>Arrhenius lifetime model</strong><br />
      Base: {lifetime.base_lifetime_hours.toLocaleString()} h at {lifetime.temp_rated} °C<br />
      Self-heating: +{lifetime.self_heating_C.toFixed(1)} °C<br />
      Operating temp: {lifetime.operating_temp.toFixed(1)} °C (ambient {ambientTemp} °C)<br />
      Ripple ratio: {(lifetime.ripple_current_ratio * 100).toFixed(0)} % of rated<br />
      Voltage stress: {(lifetime.voltage_stress_ratio * 100).toFixed(0)} % of rated<br />
      <code style={small}>L = L₀ × 2^((T_rated − T_op) / 10)</code><br />
      <small style={muted}>Nichicon UPS3, IEC 61709 §6</small>
    </div>
  )
}

export const skinDepthTip: React.ReactNode = (
  <div><strong>Skin depth</strong><br /><code style={small}>δ = 66.2 / √fsw mm</code><br />
    <small>Copper at 20 °C. Max strand = 2δ. Kazimierczuk eq. 4.60</small></div>
)

export const proximityFactorTip: React.ReactNode = (
  <div><strong>Dowell proximity factor</strong><br /><code style={small}>Fr = Rac / Rdc</code><br />
    Fr &gt; 2 → significant AC losses; use litz wire.<br /><small>Dowell (1966) IEE Proc. 113(8)</small></div>
)

export const leakageInductanceTip: React.ReactNode = (
  <div><strong>Estimated leakage inductance</strong><br />
    <code style={small}>Llk = μ₀ × Np² × MLT × (b_ins/3) / bw</code><br />
    <small>Kazimierczuk eq. 6.28</small></div>
)

export const creepageTip: React.ReactNode = (
  <div><strong>Creepage &amp; clearance</strong><br />
    Reinforced insulation, pollution degree 2.<br />
    <small>IEC 62368-1:2018 Table F.5</small></div>
)

// ── Main-component tooltips (inductance, capacitance, MOSFET, CCM boundary) ───

export function inductanceTip(inductanceH: number): React.ReactElement {
  return (
    <div><strong>Inductance</strong><br />Calculated value: {(inductanceH * 1e6).toFixed(2)} µH<br />
      <code style={small}>L = ΔIL / (fsw × Iout)</code><br />
      <small style={muted}>Larger L = smoother current, smaller ripple</small></div>
  )
}

export function capacitanceTip(capacitanceF: number): React.ReactElement {
  return (
    <div><strong>Capacitance</strong><br />Calculated value: {(capacitanceF * 1e6).toFixed(1)} µF<br />
      <code style={small}>C ≥ ΔIL / (fsw × ΔVout)</code><br />
      <small style={muted}>Larger C = lower ripple voltage</small></div>
  )
}

export function mosfetTip(vdsV: number, peakA: number): React.ReactElement {
  return (
    <div><strong>Power MOSFET (Q1)</strong><br />Vds stress: {vdsV.toFixed(0)} V<br />Peak current: {peakA.toFixed(2)} A<br />
      <small style={muted}>Sorted by lowest Rds_on × Qg figure of merit</small></div>
  )
}

export const syncFetTip: React.ReactNode = (
  <div><strong>Low-Side Sync MOSFET (Q2)</strong><br />
    Replaces freewheeling diode — eliminates 0.7 V Vf drop.<br />
    Optimised for lowest Rds_on; sorted by Rds_on ascending.<br />
    <small style={muted}>Vds same as Q1</small></div>
)

export function peakCurrentTip(peakA: number): React.ReactElement {
  return (
    <div><strong>Peak Inductor Current</strong><br />Value: {peakA.toFixed(2)} A<br />
      <small style={muted}>Must choose inductor with Isat rating higher than this</small></div>
  )
}

export function ccmBoundaryTip(boundary: number, mode?: string): React.ReactElement {
  return (
    <div><strong>CCM/DCM Boundary</strong><br />Minimum load current for CCM: {boundary.toFixed(3)} A<br />
      Operating mode: <strong>{mode ?? 'Unknown'}</strong><br />
      <small style={muted}>Design equations assume CCM. Load below this enters DCM and equations become inaccurate.</small></div>
  )
}
