// Creepage and clearance lookup per IEC 62368-1:2018 Table F.5.
// Reinforced insulation, pollution degree 2.

export function creepageMm(workingV: number): number {
  if (workingV <= 50)  return 1.5
  if (workingV <= 150) return 2.5
  if (workingV <= 300) return 4.0
  if (workingV <= 600) return 8.0
  return 12.0
}

export function clearanceMm(workingV: number): number {
  if (workingV <= 50)  return 0.8
  if (workingV <= 150) return 1.5
  if (workingV <= 300) return 3.0
  if (workingV <= 600) return 6.0
  return 10.0
}
