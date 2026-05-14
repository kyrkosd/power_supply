import type { SweepResult } from '../../store/design-store'
import type { DesignSpec } from '../../engine/types'
import { METRICS, getParamDef } from './sweepDefs'

export function generateSweepCsv(result: SweepResult, spec: DesignSpec): string {
  const pd = getParamDef(result.sweepParam)
  const getM = (key: string) => METRICS.find((m) => m.key === key)!
  const header = `${pd.label}${pd.unit ? ` (${pd.unit})` : ''},L (µH),C (µF),D (%),η (%),P_loss (W),PM (°),Tj (°C),ΔV (mV),I_crit (A)\n`
  const rows = result.points.map((pt) => {
    const pv = (pt.paramValue / pd.displayScale).toFixed(pd.decimals)
    const r  = pt.result
    if (!r) return `${pv},,,,,,,,\n`
    const eff = getM('efficiency').get(pt, result.sweepParam, spec)
    const tj  = getM('mosfetTj').get(pt, result.sweepParam, spec)
    const rip = getM('outputRipple').get(pt, result.sweepParam, spec)
    return [pv, (r.inductance * 1e6).toFixed(4), (r.capacitance * 1e6).toFixed(4),
      (r.dutyCycle * 100).toFixed(3), eff?.toFixed(3) ?? '', r.losses?.total?.toFixed(5) ?? '',
      pt.phaseMargin?.toFixed(2) ?? '', tj?.toFixed(2) ?? '', rip?.toFixed(4) ?? '',
      r.ccm_dcm_boundary?.toFixed(4) ?? ''].join(',') + '\n'
  })
  return header + rows.join('')
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
