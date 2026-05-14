import type { DesignSpec } from '../../types'

// RHPZ: Erickson & Maksimovic eq. 8.100.
function rhpzWarning(spec: DesignSpec, dutyCycle: number, inductance: number): string | null {
  const { fsw, iout } = spec
  const voutMag = Math.abs(spec.vout)
  if (iout > 0) {
    const rload = voutMag / iout
    const frhpz = ((1 - dutyCycle) ** 2 * rload) / (2 * Math.PI * inductance)
    if (frhpz > 0 && fsw / 10 > frhpz / 3)
      return `Right-half-plane zero at ${Math.round(frhpz)} Hz may limit the crossover frequency to less than ${Math.round(frhpz / 3)} Hz.`
  }
  return null
}

export function computeBuckBoostWarnings(
  spec: DesignSpec,
  dutyCycle: number,
  inductance: number,
  IL_peak: number,
  IL_dc: number,
  mosfetVdsMax: number,
  I_cin_rms: number,
  cin: number,
): string[] {
  const { iout } = spec
  const warnings: string[] = []

  if (dutyCycle >= 0.9)
    warnings.push('Buck-boost duty cycle exceeds 90% and may reduce control margin and efficiency.')
  if (dutyCycle <= 0.1)
    warnings.push('Buck-boost duty cycle is below 10% and the converter may be sensitive to noise.')
  if (IL_peak > 3 * iout)
    warnings.push('Inductor peak current exceeds 3× output current and may stress the switch and inductor.')

  const rhpz = rhpzWarning(spec, dutyCycle, inductance)
  if (rhpz) warnings.push(rhpz)

  warnings.push(
    `High component stress: switch and diode both block Vin + |Vout| = ${Math.round(mosfetVdsMax)} V. ` +
    `Input capacitor must handle ${I_cin_rms.toFixed(2)} A rms ripple ` +
    `(min Cin ≈ ${(cin * 1e6).toFixed(1)} µF, low-ESR ceramic required). ` +
    `Consider boost or SEPIC if Vin + |Vout| stress is unacceptable.`,
  )

  return warnings
}
