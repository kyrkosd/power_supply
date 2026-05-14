import type { DesignSpec } from '../../types'

// Erickson & Maksimovic §8.2.1 for RHPZ threshold.
function rhpzWarning(spec: DesignSpec, dutyCycle: number, inductance: number): string | null {
  const { fsw, vout, iout } = spec
  const rload = vout / iout
  const frhpz = ((1 - dutyCycle) ** 2 * rload) / (2 * Math.PI * inductance)
  if (frhpz > 0 && fsw / 10 > frhpz / 3)
    return `Right-half-plane zero at ${Math.round(frhpz)} Hz may limit crossover to less than one-third of the RHPZ frequency.`
  return null
}

export function computeBoostWarnings(
  spec: DesignSpec,
  dutyCycle: number,
  inductance: number,
  peakCurrent: number,
): string[] {
  const { iout } = spec
  const warnings: string[] = []

  if (dutyCycle >= 0.9)
    warnings.push('Boost duty cycle exceeds 90% and may reduce efficiency and control margin.')
  if (dutyCycle <= 0.1)
    warnings.push('Boost duty cycle is below 10% and the converter may be sensitive to noise.')
  if (peakCurrent > 3 * iout)
    warnings.push('Inductor peak current exceeds 3× output current and may stress the switch and inductor.')

  const rhpz = rhpzWarning(spec, dutyCycle, inductance)
  if (rhpz) warnings.push(rhpz)

  return warnings
}
