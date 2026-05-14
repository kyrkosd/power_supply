import dcBiasCurves from '../../data/dc-bias-curves.json'

type Curve = typeof dcBiasCurves[number]

function exactMatch(dielectric: string, voltage_rating: number, pkg: string): Curve | undefined {
  return dcBiasCurves.find((c) => c.dielectric === dielectric && c.voltage_rating === voltage_rating && c.package === pkg)
}

function scoredFallback(dielectric: string, voltage_rating: number, pkg: string): Curve | undefined {
  let best: Curve | undefined, bestScore = -1
  for (const c of dcBiasCurves) {
    if ((dielectric.startsWith('X') && !c.dielectric.startsWith('X')) ||
        (!dielectric.startsWith('X') && c.dielectric.startsWith('X'))) continue
    let score = 0
    if (c.dielectric === dielectric)   score += 10
    if (c.package === pkg)             score += 5
    score -= Math.abs(c.voltage_rating - voltage_rating) * 0.1
    if (score > bestScore) { bestScore = score; best = c }
  }
  return best
}

export function findDcBiasCurve(dielectric: string, voltage_rating: number, pkg: string): Curve | undefined {
  return exactMatch(dielectric, voltage_rating, pkg) ?? scoredFallback(dielectric, voltage_rating, pkg)
}
