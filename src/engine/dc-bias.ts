import { findDcBiasCurve } from './dc-bias/curve-lookup'
import { interpolateCurve } from './dc-bias/interpolate'

export interface DeratingResult {
  effective_uF: number
  ratio:        number
  curve_id:     string
}

function isExemptDielectric(d: string): boolean {
  const u = d.toUpperCase()
  const l = d.toLowerCase()
  return !d || u === 'C0G' || u === 'NP0' || l === 'electrolytic' || l === 'aluminum'
}

// Called by: topology compute() functions (all topologies that size an output capacitor) —
// inline during component sizing, not as a post-compute step. The effective_uF returned here
// replaces the nominal capacitance in ripple and bandwidth calculations so that DC-bias
// derating is automatically reflected in the design result. X7R and X5R dielectrics are
// corrected via dc-bias-curves.json; C0G/NP0 and electrolytics are exempt (ratio = 1.0).
export function derateCapacitance(
  nominal_uF: number,
  vdc: number,
  rated_voltage: number,
  dielectric: string,
  pkg: string,
): DeratingResult {
  if (isExemptDielectric(dielectric)) return { effective_uF: nominal_uF, ratio: 1.0, curve_id: 'none' }
  const vdc_ratio = Math.max(0, vdc / rated_voltage)
  const match = findDcBiasCurve(dielectric, rated_voltage, pkg)
  if (!match) return { effective_uF: nominal_uF, ratio: 1.0, curve_id: 'none' }
  const ratio = Math.max(0, interpolateCurve(match.curve, vdc_ratio))
  return { effective_uF: nominal_uF * ratio, ratio, curve_id: match.id }
}
