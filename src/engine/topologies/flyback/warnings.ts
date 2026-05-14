import type { SecondaryOutput } from '../../types'

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

function snubberLossWarning(P_dissipated: number, pPrimary: number): string | null {
  if (P_dissipated > 0.05 * pPrimary)
    return (
      `RCD clamp dissipates ${P_dissipated.toFixed(1)} W ` +
      `(${((P_dissipated / pPrimary) * 100).toFixed(0)} % of Pout). ` +
      `Reduce leakage ratio or switching frequency to lower clamp losses.`
    )
  return null
}

export function computeFlybackWarnings(
  iout: number,
  dMax: number,
  snubber: { P_dissipated: number },
  pPrimary: number,
  ccm_dcm_boundary: number,
  secondaries: SecondaryOutput[],
): { operating_mode: 'CCM' | 'DCM' | 'boundary'; warnings: string[] } {
  const warnings: string[] = []

  const { operating_mode, warning: modeWarn } = ccmDcmMode(iout, ccm_dcm_boundary)
  if (modeWarn) warnings.push(modeWarn)

  if (dMax > 0.45)
    warnings.push('Duty cycle exceeds 45 % — consider DCM or a different topology.')

  const snubberWarn = snubberLossWarning(snubber.P_dissipated, pPrimary)
  if (snubberWarn) warnings.push(snubberWarn)

  if (secondaries.length > 0)
    warnings.push('Cross-regulation on unregulated outputs is typically ±5–10 %. Use post-regulators (LDO) for tight regulation.')

  return { operating_mode, warnings }
}
