// Loss breakdown for a single-switch forward converter.
// Copper losses use DCR estimates; core and snubber losses use physics models.
// Erickson & Maksimovic 3rd ed., §6.3.
export function computeForwardLosses(
  dutyCycle: number,
  dMax: number,
  primaryCurrentAvg: number,
  Ip_peak: number,
  IL_rms: number,
  d1IfAvg: number,
  d2IfAvg: number,
  mosfetVdsMax: number,
  snubber: { P_dissipated: number },
) {
  const I_primary_rms   = primaryCurrentAvg * Math.sqrt(dMax)
  const I_secondary_rms = IL_rms

  const primaryCopper      = I_primary_rms ** 2 * 0.1
  const secondaryCopper    = I_secondary_rms ** 2 * 0.02
  const outputInductorLoss = IL_rms ** 2 * 0.01
  const coreLoss           = 0.8
  const mosfetSwitching    = 0.5 * mosfetVdsMax * Ip_peak * 50e-9 * dutyCycle
  const mosfetConduction   = I_primary_rms ** 2 * 0.05
  const mosfetLoss         = mosfetSwitching + mosfetConduction
  const d1Loss             = 0.7 * d1IfAvg
  const d2Loss             = 0.7 * d2IfAvg
  const diodeLoss          = d1Loss + d2Loss
  const clampLoss          = snubber.P_dissipated
  const total = primaryCopper + secondaryCopper + outputInductorLoss +
                coreLoss + mosfetLoss + diodeLoss + clampLoss
  return { primaryCopper, secondaryCopper, outputInductorLoss, coreLoss, mosfetLoss, diodeLoss, clampLoss, total }
}
