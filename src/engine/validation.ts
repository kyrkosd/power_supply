import type { DesignSpec } from './types'
import type { TopologyId } from '../store/workbenchStore'

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export function validateSpec(topology: TopologyId, spec: DesignSpec): ValidationResult {
  const errors: ValidationError[] = []

  function push(field: string, message: string, severity: 'error' | 'warning' = 'error') {
    errors.push({ field, message, severity })
  }

  const { vinMin, vinMax, vout, iout, fsw, rippleRatio, voutRippleMax } = spec
  const voutMag = Math.abs(vout)

  // ── Basic positivity ──────────────────────────────────────────────────────
  if (!Number.isFinite(vinMin) || vinMin <= 0)
    push('vinMin', 'Vin_min must be a positive number.')
  if (!Number.isFinite(vinMax) || vinMax <= 0)
    push('vinMax', 'Vin_max must be a positive number.')
  if (Number.isFinite(vinMin) && Number.isFinite(vinMax) && vinMax < vinMin)
    push('vinMax', 'Vin_max must be ≥ Vin_min.')
  if (!Number.isFinite(iout) || iout <= 0)
    push('iout', 'Iout must be a positive number.')
  if (!Number.isFinite(voutMag) || voutMag <= 0)
    push('vout', 'Vout magnitude must be positive.')

  // ── Topology-specific Vout constraints ────────────────────────────────────
  if (topology === 'buck') {
    if (Number.isFinite(vout) && Number.isFinite(vinMin) && vout >= vinMin)
      push('vout', `Buck output (${vout} V) must be less than Vin_min (${vinMin} V). Buck is a step-down converter.`)
  }

  if (topology === 'boost') {
    if (Number.isFinite(vout) && Number.isFinite(vinMax) && vout <= vinMax)
      push('vout', `Boost output (${vout} V) must exceed Vin_max (${vinMax} V). Boost is a step-up converter.`)
  }

  if (topology === 'buck-boost') {
    if (Number.isFinite(vout) && vout > 0)
      push('vout', 'Enter Vout as a negative value for buck-boost (e.g. −5 V for a −5 V rail).', 'warning')
  }

  // ── Duty-cycle advisory warnings ─────────────────────────────────────────
  if (topology === 'flyback' && Number.isFinite(vinMin) && Number.isFinite(vout)) {
    // Approximate D = Vout / (Vin_min + Vout) — assumes 1:1 turns, conservative
    const dApprox = voutMag / (vinMin + voutMag)
    if (dApprox > 0.5)
      push('vout',
        `Estimated duty cycle ≈ ${(dApprox * 100).toFixed(0)} % exceeds 50 %. ` +
        'Off-line flyback designs typically stay below D = 50 % to avoid runaway.',
        'warning')
  }

  if (topology === 'forward' && Number.isFinite(vinMin) && Number.isFinite(vout)) {
    // Forward duty cycle ≈ Vout / Vin (like buck), worst case at Vin_min
    const dApprox = vout / vinMin
    if (dApprox > 0.45)
      push('vout',
        `Estimated duty cycle ≈ ${(dApprox * 100).toFixed(0)} % exceeds 45 %. ` +
        'The reset winding constrains forward converters to D ≤ 45 %.',
        'warning')
  }

  // ── Switching frequency ───────────────────────────────────────────────────
  if (!Number.isFinite(fsw) || fsw <= 0) {
    push('fsw', 'Switching frequency must be a positive number.')
  } else if (fsw < 10_000) {
    push('fsw', `Unusually low fsw (${(fsw / 1000).toFixed(0)} kHz). Magnetic components will be very large.`, 'warning')
  } else if (fsw > 5_000_000) {
    push('fsw', `Extremely high fsw (${(fsw / 1e6).toFixed(1)} MHz). Switching losses will dominate efficiency.`, 'warning')
  }

  // ── Ripple ratio ──────────────────────────────────────────────────────────
  if (!Number.isFinite(rippleRatio)) {
    push('rippleRatio', 'Ripple ratio must be a number.')
  } else if (rippleRatio < 0.05) {
    push('rippleRatio', `Ripple ratio ${rippleRatio.toFixed(3)} < 0.05 requires an impractically large inductor.`)
  } else if (rippleRatio > 0.8) {
    push('rippleRatio', `Ripple ratio ${rippleRatio.toFixed(2)} > 0.8 causes very high peak current and likely DCM.`)
  }

  // ── Output ripple budget ──────────────────────────────────────────────────
  if (!Number.isFinite(voutRippleMax) || voutRippleMax <= 0) {
    push('voutRippleMax', 'Output ripple budget must be a positive number.')
  } else if (Number.isFinite(voutMag) && voutMag > 0 && voutRippleMax > voutMag * 0.1) {
    push('voutRippleMax',
      `Ripple budget (${(voutRippleMax * 1000).toFixed(0)} mV) exceeds 10 % of Vout ` +
      `(limit: ${(voutMag * 100).toFixed(0)} mV).`)
  }

  // ── Light-load advisory ───────────────────────────────────────────────────
  if (Number.isFinite(iout) && iout > 0 && iout < 0.01)
    push('iout', 'Very light load (< 10 mA). The converter will likely operate in DCM; CCM equations may be inaccurate.', 'warning')

  // ── Flyback multi-output secondaries ─────────────────────────────────────
  if (topology === 'flyback' && spec.secondary_outputs) {
    if (spec.secondary_outputs.length > 3)
      push('secondary_outputs', 'Maximum 3 additional secondary outputs (4 total windings).')

    spec.secondary_outputs.forEach((s, i) => {
      const tag = `secondary_outputs[${i}]`
      if (!Number.isFinite(s.vout) || s.vout <= 0)
        push(tag, `Output ${i + 2}: Vout must be a positive number.`)
      if (!Number.isFinite(s.iout) || s.iout <= 0)
        push(tag, `Output ${i + 2}: Iout must be a positive number.`)
      if (!Number.isFinite(s.diode_vf) || s.diode_vf < 0)
        push(tag, `Output ${i + 2}: Diode Vf must be ≥ 0.`)
      if (Number.isFinite(s.vout) && Number.isFinite(vinMin) && s.vout > vinMin * 2)
        push(tag,
          `Output ${i + 2}: Vout (${s.vout} V) is more than 2× Vin_min. Check turns ratio — large secondary voltages may be impractical.`,
          'warning')
    })
  }

  return { valid: errors.every((e) => e.severity !== 'error'), errors }
}
