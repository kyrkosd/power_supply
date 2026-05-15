import type { DesignResult } from '../../engine/types'
import type { ComponentStatus } from './schematic-types'

/** Formats a value with fixed decimals and a SI unit suffix. */
export function formatU(value: number, decimals: number, unit: string): string {
  return `${value.toFixed(decimals)} ${unit}`
}

/** Formats a resistance, switching to kΩ above 1 kΩ. */
export function formatResistance(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1000) return `${(value / 1000).toFixed(1)} kΩ`
  return `${value.toFixed(1)} Ω`
}

/** Formats a capacitance auto-scaling µF → nF → pF. */
export function formatCapacitance(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (value >= 1e-6) return `${(value * 1e6).toFixed(1)} µF`
  if (value >= 1e-9) return `${(value * 1e9).toFixed(1)} nF`
  return `${(value * 1e12).toFixed(1)} pF`
}

/** Derives inductor component status from saturation-check results. */
export function inductorStatusFromResult(result: DesignResult | null): ComponentStatus {
  const sat = result?.saturation_check
  if (!sat) return 'normal'
  if (sat.is_saturated) return 'violation'
  if (sat.margin_pct !== null && sat.margin_pct < 20) return 'warning'
  if (sat.estimated_B_peak > sat.B_sat_material * 0.80) return 'warning'
  return 'normal'
}

/** Returns warning/violation status when duty cycle is near the rails. */
export function switchDutyStatus(duty: number): ComponentStatus {
  if (duty >= 0.9 || duty <= 0.1) return 'violation'
  if (duty >= 0.82 || duty <= 0.15) return 'warning'
  return 'normal'
}

/** Duty-cycle status for flyback/forward topologies whose max is ~50 %. */
export function flybackDutyStatus(duty: number): ComponentStatus {
  if (duty >= 0.45) return 'violation'
  if (duty >= 0.4) return 'warning'
  return 'normal'
}

/** RCD clamp status: warning when clamp dissipates more than 5 % of output power. */
export function rcdClampStatus(
  snubber: { P_dissipated: number } | null | undefined,
  pout: number,
): ComponentStatus {
  if (snubber && snubber.P_dissipated > 0.05 * pout) return 'warning'
  return 'normal'
}

/** Builds the input-capacitor value string (rough estimate from charge balancing). */
export function cinValueLabel(iout: number, fsw: number, vin: number): string {
  return `${formatU(Math.max(0.01, iout / (fsw * vin * 0.1)) * 1e6, 1, 'µF')}`
}

/** Returns fn(result) when result is non-null, otherwise '—'. Eliminates repetitive null guards in label builders. */
export function resultLabel(result: DesignResult | null, fn: (r: DesignResult) => string): string {
  return result != null ? fn(result) : '—'
}

export interface SyncD1 { label: string; value: string; meta: string | undefined }

/** Sync-FET or diode label set for the low-side switch in non-isolated topologies. */
export function syncD1Labels(syncMode: boolean, dioLabel: string, dioValue: string): SyncD1 {
  if (syncMode) return { label: 'Q2', value: 'Sync FET (Rds=8mΩ)', meta: 'Low-side sync FET' }
  return { label: dioLabel, value: dioValue, meta: undefined }
}
