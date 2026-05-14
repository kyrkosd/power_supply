export interface FlybackLosses {
  primaryCopperLoss:   number
  secondaryCopperLoss: number
  coreLoss:   number
  mosfetLoss: number
  diodeLoss:  number
  clampLoss:  number
  total:      number
}

// Simplified flyback loss model.
// Copper losses use DCR estimates; core and switching losses use fixed placeholders.
export function computeFlybackLosses(
  primaryCurrentAvg: number,
  iout: number,
  snubber: { P_dissipated: number },
): FlybackLosses {
  const primaryCopperLoss   = primaryCurrentAvg ** 2 * 0.1
  const secondaryCopperLoss = iout ** 2 * 0.05
  const coreLoss   = 0.5
  const mosfetLoss = 2
  const diodeLoss  = 1
  const clampLoss  = snubber.P_dissipated
  const total = primaryCopperLoss + secondaryCopperLoss + coreLoss + mosfetLoss + diodeLoss + clampLoss
  return { primaryCopperLoss, secondaryCopperLoss, coreLoss, mosfetLoss, diodeLoss, clampLoss, total }
}
