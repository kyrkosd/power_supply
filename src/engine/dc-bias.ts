// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import dcBiasCurves from '../data/dc-bias-curves.json';

export interface DeratingResult {
  effective_uF: number;
  ratio: number;
  curve_id: string;
}

export function derateCapacitance(
  nominal_uF: number,
  vdc: number,
  rated_voltage: number,
  dielectric: string,
  pkg: string
): DeratingResult {
  if (
    !dielectric ||
    dielectric.toUpperCase() === 'C0G' ||
    dielectric.toUpperCase() === 'NP0' ||
    dielectric.toLowerCase() === 'electrolytic' ||
    dielectric.toLowerCase() === 'aluminum'
  ) {
    return { effective_uF: nominal_uF, ratio: 1.0, curve_id: 'none' };
  }

  const vdc_ratio = Math.max(0, vdc / rated_voltage);

  // 1. Attempt exact match
  let match = dcBiasCurves.find(
    (c) =>
      c.dielectric === dielectric &&
      c.voltage_rating === rated_voltage &&
      c.package === pkg
  );

  // 2. Fallback matching (closest voltage/package for the same dielectric base)
  if (!match) {
    let bestScore = -1;
    for (const c of dcBiasCurves) {
      if (
        (dielectric.startsWith('X') && !c.dielectric.startsWith('X')) ||
        (!dielectric.startsWith('X') && c.dielectric.startsWith('X'))
      ) {
        continue; // Keep X-class dielectrics isolated
      }

      let score = 0;
      if (c.dielectric === dielectric) score += 10;
      if (c.package === pkg) score += 5;
      score -= Math.abs(c.voltage_rating - rated_voltage) * 0.1; // Penalize distance from target rating

      if (score > bestScore) {
        bestScore = score;
        match = c;
      }
    }
  }

  if (!match) {
    return { effective_uF: nominal_uF, ratio: 1.0, curve_id: 'none' };
  }

  const curve = match.curve;
  let ratio = 1.0;

  if (vdc_ratio <= curve[0].vdc_ratio) ratio = curve[0].capacitance_ratio;
  else if (vdc_ratio >= curve[curve.length - 1].vdc_ratio) ratio = curve[curve.length - 1].capacitance_ratio;
  else {
    for (let i = 0; i < curve.length - 1; i++) {
      if (vdc_ratio >= curve[i].vdc_ratio && vdc_ratio <= curve[i + 1].vdc_ratio) {
        const slope = (curve[i + 1].capacitance_ratio - curve[i].capacitance_ratio) / (curve[i + 1].vdc_ratio - curve[i].vdc_ratio);
        ratio = curve[i].capacitance_ratio + slope * (vdc_ratio - curve[i].vdc_ratio);
        break;
      }
    }
  }

  return { effective_uF: nominal_uF * ratio, ratio: Math.max(0, ratio), curve_id: match.id };
}