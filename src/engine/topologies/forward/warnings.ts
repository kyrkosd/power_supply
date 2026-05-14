import type { DesignSpec } from '../../types'
import type { CoreData } from '../core-selector'

function ccmDcmMode(
  iout: number,
  boundary: number,
): { operating_mode: 'CCM' | 'DCM' | 'boundary'; warning: string | null } {
  if (iout < boundary)
    return { operating_mode: 'DCM', warning: 'Operating in DCM. Equations assume CCM — results may be inaccurate. Increase inductance or load current to enter CCM.' }
  if (iout < 1.2 * boundary)
    return { operating_mode: 'boundary', warning: 'Near CCM/DCM boundary. Performance may be unpredictable at light loads.' }
  return { operating_mode: 'CCM', warning: null }
}

function dutyCycleResetWarning(dutyCycle: number, dMaxRcd: number): string | null {
  if (dutyCycle > 0.4)
    return (
      `Duty cycle ${(dutyCycle * 100).toFixed(1)}% is close to the reset limit ` +
      `(${(dMaxRcd * 100).toFixed(1)}%). Increase Vclamp or reduce Vin_max/Vin_min ratio.`
    )
  return null
}

function resetLimitWarning(dMaxRcd: number, dMax: number, vinMin: number, vout: number): string | null {
  if (dMaxRcd < 0.45 && dMax < 0.3)
    return (
      `Reset mechanism limits D_max to ${(dMax * 100).toFixed(1)}%. ` +
      `Turns ratio N=${((vinMin * dMax) / vout).toFixed(2)} is designed for this limit.`
    )
  return null
}

function coreFluxWarning(selectedCore: CoreData, vinMin: number, dMax: number, fsw: number): string | null {
  const primaryTurns = Math.max(1, Math.ceil(Math.sqrt((vinMin * dMax) / (fsw * (selectedCore.AL * 1e-9)))))
  const bPeak = (vinMin * dMax) / (primaryTurns * selectedCore.Ae * fsw)
  if (bPeak > 0.3)
    return (
      `Transformer flux density ${(bPeak * 1000).toFixed(0)} mT exceeds 300 mT. ` +
      `Increase Np or choose a larger core.`
    )
  return null
}

function mosfetStressAdvisory(mosfetVdsMax: number, I_cin_rms: number, cin: number): string {
  return (
    `MOSFET must block Vin_max + Vclamp = ${Math.round(mosfetVdsMax)} V ` +
    `(use a ${Math.round(mosfetVdsMax * 1.25)} V-rated device with 25% margin). ` +
    `Input cap must handle ${I_cin_rms.toFixed(2)} A rms pulsed current ` +
    `(min Cin ≈ ${(cin * 1e6).toFixed(1)} µF).`
  )
}

function snubberLossWarning(P_dissipated: number, pout: number): string | null {
  if (P_dissipated > 0.05 * pout)
    return (
      `RCD clamp dissipates ${P_dissipated.toFixed(1)} W ` +
      `(${((P_dissipated / pout) * 100).toFixed(0)} % of Pout). ` +
      `Reduce leakage ratio or switching frequency to lower clamp losses.`
    )
  return null
}

export function computeForwardWarnings(
  spec: DesignSpec,
  dutyCycle: number,
  dMax: number,
  dMaxRcd: number,
  selectedCore: CoreData | null,
  snubber: { P_dissipated: number },
  pout: number,
  Ip_peak: number,
  primaryCurrentAvg: number,
  mosfetVdsMax: number,
  I_cin_rms: number,
  cin: number,
  ccm_dcm_boundary: number,
): { operating_mode: 'CCM' | 'DCM' | 'boundary'; warnings: string[] } {
  const { vinMin, vout, fsw } = spec
  const warnings: string[] = []

  const { operating_mode, warning: modeWarn } = ccmDcmMode(spec.iout, ccm_dcm_boundary)
  if (modeWarn) warnings.push(modeWarn)

  const dutyWarn = dutyCycleResetWarning(dutyCycle, dMaxRcd)
  if (dutyWarn) warnings.push(dutyWarn)

  const resetWarn = resetLimitWarning(dMaxRcd, dMax, vinMin, vout)
  if (resetWarn) warnings.push(resetWarn)

  if (!selectedCore)
    warnings.push('No suitable transformer core found. Add larger cores or reduce Lm requirement.')

  if (selectedCore) {
    const fluxWarn = coreFluxWarning(selectedCore, vinMin, dMax, fsw)
    if (fluxWarn) warnings.push(fluxWarn)
  }

  if (Ip_peak > 3 * primaryCurrentAvg)
    warnings.push('High peak primary current — verify transformer core does not saturate.')

  warnings.push(mosfetStressAdvisory(mosfetVdsMax, I_cin_rms, cin))

  const snubWarn = snubberLossWarning(snubber.P_dissipated, pout)
  if (snubWarn) warnings.push(snubWarn)

  return { operating_mode, warnings }
}
