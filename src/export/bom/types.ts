// BOM row schema and CSV serialisation primitives.

export interface BOMRow {
  ref:          string
  component:    string
  value:        string
  rating:       string
  pkg:          string
  manufacturer: string
  partNumber:   string
  qty:          number
  notes:        string
}

export const DERATING = 1.25  // 25 % voltage margin applied to passive ratings

function csvCell(value: string | number | null | undefined): string {
  const s = String(value ?? '-')
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function rowToCsv(r: BOMRow): string {
  return [
    r.ref, r.component, r.value, r.rating,
    r.pkg, r.manufacturer, r.partNumber, String(r.qty), r.notes,
  ].map(csvCell).join(',')
}
