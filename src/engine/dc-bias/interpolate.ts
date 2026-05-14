type CurvePoint = { vdc_ratio: number; capacitance_ratio: number }

export function interpolateCurve(curve: CurvePoint[], vdc_ratio: number): number {
  if (vdc_ratio <= curve[0].vdc_ratio)                        return curve[0].capacitance_ratio
  if (vdc_ratio >= curve[curve.length - 1].vdc_ratio)         return curve[curve.length - 1].capacitance_ratio
  for (let i = 0; i < curve.length - 1; i++) {
    if (vdc_ratio >= curve[i].vdc_ratio && vdc_ratio <= curve[i + 1].vdc_ratio) {
      const slope = (curve[i + 1].capacitance_ratio - curve[i].capacitance_ratio) /
                    (curve[i + 1].vdc_ratio - curve[i].vdc_ratio)
      return curve[i].capacitance_ratio + slope * (vdc_ratio - curve[i].vdc_ratio)
    }
  }
  return 1.0
}
