// CISPR 32 Class B conducted emission limit in dBµV.
export function getClassBLimit(f: number): number {
  const f_MHz = f / 1e6
  if (f_MHz < 0.15) return 66
  if (f_MHz < 0.5)  return 66 - 10 * (Math.log10(f_MHz / 0.15) / Math.log10(0.5 / 0.15))
  if (f_MHz < 5)    return 56
  return 60
}
