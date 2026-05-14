// Warnings specific to N > 1 multi-phase buck designs.

export function multiphaseWarnings(
  N: number, K_out: number, deltaIL_phase: number, I_phase_avg: number,
): string[] {
  const warnings: string[] = []
  const ripple_ratio_phase = deltaIL_phase / I_phase_avg

  if (ripple_ratio_phase > 1.5) {
    warnings.push(
      `Per-phase ripple ratio is ${(ripple_ratio_phase * 100).toFixed(0)} %. ` +
      'Consider increasing fsw or operating nearer a cancellation duty point.',
    )
  }
  if (N > 4) {
    warnings.push(`${N}-phase design: current sharing requires matched inductors (±2 % tolerance) or active balancing.`)
  }
  if (K_out < 0.05) {
    warnings.push(
      `Near-perfect ripple cancellation at this duty cycle (K = ${K_out.toFixed(3)}). ` +
      'Cout is sized at floor — verify at all Vin/Iout corners.',
    )
  }
  return warnings
}
