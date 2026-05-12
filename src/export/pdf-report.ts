// PDF report generator: produces a 6-page A4 report with spec summary,
// component values, loss breakdown, schematic, waveforms, and Bode plot.

import jsPDF from 'jspdf'
import type { DesignSpec, DesignResult } from '../engine/types'
import type { ActiveVizTab } from '../store/design-store'
import { fmtL, fmtC, fmtR, fmtHz } from './format-utils'

// ── Page geometry (A4, mm) ─────────────────────────────────────────────────────
const PW = 210
const PH = 297
const M  = 18
const CW = PW - 2 * M

const PAGE_COUNT = 6

// ── PDF colour palette ─────────────────────────────────────────────────────────
const C_HDR     = [20,  26,  50]  as const
const C_HDR_TXT = [155, 175, 205] as const
const C_ACCENT  = [20,  100, 210] as const
const C_DARK    = [28,  34,  55]  as const
const C_MED     = [85,  100, 130] as const
const C_ROW     = [244, 246, 252] as const
const C_WARN    = [190, 110, 20]  as const
const C_OK      = [40,  140, 75]  as const

// CSS variables → hex values used during SVG serialisation.
const CSS_VARS: [string, string][] = [
  ['var(--text-primary)',   '#e8eaf0'],
  ['var(--text-secondary)', '#a0b4c8'],
  ['var(--text-muted)',     '#606880'],
  ['var(--accent)',         '#4adcf4'],
  ['var(--surface)',        '#1e2235'],
  ['var(--surface-2)',      '#252a42'],
  ['var(--border)',         '#2a3050'],
  ['var(--bg)',             '#1a1a2e'],
]

// ── Loss breakdown type guards ────────────────────────────────────────────────

interface TransformerLosses {
  primaryCopper?:   number
  secondaryCopper?: number
  core?:            number
  mosfet?:          number
  diode?:           number
  clamp?:           number
  total:            number
}

interface SwitchingLosses {
  mosfet_conduction?: number
  mosfet_switching?:  number
  mosfet_gate?:       number
  inductor_copper?:   number
  inductor_core?:     number
  diode_conduction?:  number
  sync_conduction?:   number
  sync_dead_time?:    number
  capacitor_esr?:     number
  total:              number
}

type LossBreakdown = TransformerLosses | SwitchingLosses

function isTransformerLosses(l: LossBreakdown): l is TransformerLosses {
  return 'primaryCopper' in l
}

function isSwitchingLosses(l: LossBreakdown): l is SwitchingLosses {
  return 'mosfet_conduction' in l
}

// ── Primitive helpers ─────────────────────────────────────────────────────────

type Doc = jsPDF
type RGB = readonly [number, number, number]
type Row = [string, string]

function setTxt(doc: Doc, rgb: RGB)  { doc.setTextColor(rgb[0], rgb[1], rgb[2]) }
function setFill(doc: Doc, rgb: RGB) { doc.setFillColor(rgb[0], rgb[1], rgb[2]) }
function setDraw(doc: Doc, rgb: RGB) { doc.setDrawColor(rgb[0], rgb[1], rgb[2]) }

function fmtPct(v: number): string { return `${(v * 100).toFixed(1)} %` }

function nowStr(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const TOPOLOGY_LABELS: Record<string, string> = {
  'buck': 'Buck (Step-Down)', 'boost': 'Boost (Step-Up)', 'buck-boost': 'Buck-Boost',
  'flyback': 'Flyback', 'forward': 'Forward', 'sepic': 'SEPIC',
}

function topoLabel(id: string): string { return TOPOLOGY_LABELS[id] ?? id.toUpperCase() }

// ── SVG → canvas → PNG capture ────────────────────────────────────────────────

interface Capture { dataUrl: string; w: number; h: number }

async function captureSvg(selector: string): Promise<Capture | null> {
  const el = document.querySelector(selector) as SVGSVGElement | null
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const w = rect.width  || el.clientWidth  || 800
  const h = rect.height || el.clientHeight || 400
  if (w === 0 || h === 0) return null

  const clone = el.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  let svgStr = new XMLSerializer().serializeToString(clone)
  for (const [cssVar, hex] of CSS_VARS) svgStr = svgStr.split(cssVar).join(hex)

  const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }))
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale  = 2
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve({ dataUrl: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height })
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

function wait(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)) }

async function switchAndCapture(
  setTab: (t: ActiveVizTab) => void, tab: ActiveVizTab, selector: string,
): Promise<Capture | null> {
  setTab(tab)
  await wait(550)
  return captureSvg(selector)
}

// ── Chart capture orchestrator ────────────────────────────────────────────────

interface Charts {
  schematicImg: Capture | null
  waveformImg:  Capture | null
  bodeImg:      Capture | null
  lossBarImg:   Capture | null
  lossEffImg:   Capture | null
}

/** Capture all chart SVGs in sequence, switching tabs as needed, then restore the original tab. */
async function captureCharts(
  setActiveVizTab: (tab: ActiveVizTab) => void,
  currentTab: ActiveVizTab,
): Promise<Charts> {
  const schematicImg = await captureSvg('[data-export-id="schematic"]')
  const waveformImg  = await switchAndCapture(setActiveVizTab, 'waveforms', '[data-export-id="waveform-chart"]')
  const bodeImg      = await switchAndCapture(setActiveVizTab, 'bode',      '[data-export-id="bode-plot"]')
  setActiveVizTab('losses')
  await wait(550)
  const lossBarImg = await captureSvg('[data-export-id="loss-bar"] svg')
  const lossEffImg = await captureSvg('[data-export-id="loss-eff"]')
  setActiveVizTab(currentTab)
  return { schematicImg, waveformImg, bodeImg, lossBarImg, lossEffImg }
}

// ── PDF layout primitives ─────────────────────────────────────────────────────

function addHeader(doc: Doc, topology: string): void {
  setFill(doc, C_HDR)
  doc.rect(0, 0, PW, 13, 'F')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  setTxt(doc, C_HDR_TXT)
  doc.text('POWER SUPPLY DESIGN REPORT', M, 8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(topoLabel(topology).toUpperCase(), PW - M, 8.5, { align: 'right' })
}

function addFooter(doc: Doc, pageNum: number, total: number): void {
  setFill(doc, C_HDR)
  doc.rect(0, PH - 11, PW, 11, 'F')
  doc.setFontSize(7.5)
  setTxt(doc, C_HDR_TXT)
  doc.text('Power Supply Design Workbench', M, PH - 4)
  doc.text(`Page ${pageNum} of ${total}`, PW / 2, PH - 4, { align: 'center' })
  doc.text(nowStr(), PW - M, PH - 4, { align: 'right' })
}

function sectionRule(doc: Doc, label: string, x: number, y: number, width = CW): void {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setTxt(doc, C_DARK)
  doc.text(label.toUpperCase(), x, y)
  setDraw(doc, C_ACCENT)
  doc.setLineWidth(0.4)
  doc.line(x, y + 1.5, x + width, y + 1.5)
  doc.setFont('helvetica', 'normal')
}

function drawTable(doc: Doc, rows: Row[], x: number, y: number, colW: number): number {
  const rowH   = 6.5
  const labelW = colW * 0.56
  doc.setFontSize(8.5)
  rows.forEach(([label, value], i) => {
    const ry = y + i * rowH
    if (i % 2 === 0) { setFill(doc, C_ROW); doc.rect(x, ry - 4.5, colW, rowH, 'F') }
    setTxt(doc, C_MED); doc.setFont('helvetica', 'normal'); doc.text(label, x + 2, ry)
    setTxt(doc, C_DARK); doc.setFont('helvetica', 'bold');  doc.text(value, x + labelW, ry)
  })
  doc.setFont('helvetica', 'normal')
  return y + rows.length * rowH
}

function addChartImage(
  doc: Doc, capture: Capture | null, x: number, y: number, maxW: number, maxH: number,
): number {
  if (!capture) {
    setFill(doc, [28, 33, 55] as const); doc.rect(x, y, maxW, 36, 'F')
    doc.setFontSize(9); setTxt(doc, C_MED)
    doc.text('Chart not available — run the simulation and visit this tab first', x + maxW / 2, y + 20, { align: 'center' })
    return y + 40
  }
  const imgH = Math.min(maxW * (capture.h / capture.w), maxH)
  setFill(doc, [15, 20, 40] as const); doc.rect(x - 1, y - 1, maxW + 2, imgH + 2, 'F')
  doc.addImage(capture.dataUrl, 'PNG', x, y, maxW, imgH)
  return y + imgH + 4
}

// ── Data row builders ─────────────────────────────────────────────────────────

function buildSpecRows(spec: DesignSpec): Row[] {
  return [
    ['Input voltage (min)',        `${spec.vinMin} V`],
    ['Input voltage (max)',        `${spec.vinMax} V`],
    ['Output voltage',             `${spec.vout} V`],
    ['Output current (full load)', `${spec.iout} A`],
    ['Switching frequency',        fmtHz(spec.fsw)],
    ['Ripple ratio (ΔiL/Iout)',   `${(spec.rippleRatio * 100).toFixed(0)} %`],
    ['Ambient temperature',        `${spec.ambientTemp} °C`],
    ['Vout ripple max (p-p)',      `${(spec.voutRippleMax * 1000).toFixed(1)} mV`],
    ['Efficiency target',          `${(spec.efficiency * 100).toFixed(0)} %`],
  ]
}

function buildResultRows(result: DesignResult): Row[] {
  return [
    ['Duty cycle (D)',     fmtPct(result.dutyCycle)],
    ['Inductance (L)',     fmtL(result.inductance)],
    ['Output capacitance', fmtC(result.capacitance)],
    ['Peak ind. current', `${result.peakCurrent.toFixed(2)} A`],
    ['Efficiency (η)',     result.efficiency != null ? fmtPct(result.efficiency) : 'N/A'],
    ['Operating mode',     result.operating_mode ?? 'CCM (estimated)'],
  ]
}

function buildComponentRows(result: DesignResult): Row[] {
  const rows: Row[] = [
    ['Inductance (L)',             fmtL(result.inductance)],
    ['Inductor peak current',     `${(result.inductor?.peak_current ?? result.peakCurrent).toFixed(2)} A`],
    ['Inductor RMS current',      `${(result.inductor?.rms_current ?? 0).toFixed(2)} A`],
    ['Output capacitance (Cout)', fmtC(result.capacitance)],
    ['Output cap ESR (max)',       result.output_cap ? fmtR(result.output_cap.esr_max) : '—'],
    ['Cap ripple current (RMS)',  `${(result.output_cap?.ripple_current ?? 0).toFixed(2)} A`],
    ['Duty cycle (D)',             fmtPct(result.dutyCycle)],
    ['Peak switch current',       `${result.peakCurrent.toFixed(2)} A`],
  ]
  if (result.efficiency != null)       rows.push(['Efficiency (η)',              fmtPct(result.efficiency)])
  if (result.operating_mode)           rows.push(['Operating mode',               result.operating_mode])
  if (result.ccm_dcm_boundary != null) rows.push(['CCM→DCM boundary current',   `${result.ccm_dcm_boundary.toFixed(2)} A`])
  if (result.turnsRatio != null)       rows.push(['Turns ratio (Np/Ns)',          result.turnsRatio.toFixed(3)])
  if (result.magnetizingInductance != null) rows.push(['Magnetizing inductance', fmtL(result.magnetizingInductance)])
  if (result.leakageInductance != null)    rows.push(['Leakage inductance',       fmtL(result.leakageInductance)])
  if (result.clampVoltage != null)         rows.push(['Clamp voltage',           `${result.clampVoltage.toFixed(1)} V`])
  if (result.couplingCapacitance != null)  rows.push(['Coupling capacitor (Cc)', fmtC(result.couplingCapacitance)])
  if (result.mosfetVdsMax != null)         rows.push(['MOSFET Vds max',          `${result.mosfetVdsMax.toFixed(1)} V`])
  if (result.outputInductance != null)     rows.push(['Output inductance',        fmtL(result.outputInductance)])
  if (result.resetVoltage != null)         rows.push(['Reset winding voltage',   `${result.resetVoltage.toFixed(1)} V`])
  return rows
}

// ── Loss section renderer ─────────────────────────────────────────────────────

/** Render the topology-appropriate loss breakdown table and return the updated y position. */
function renderLossSection(doc: Doc, result: DesignResult, y: number): number {
  if (!result.losses) return y
  const losses = result.losses as LossBreakdown

  if (isTransformerLosses(losses)) {
    sectionRule(doc, 'Transformer Loss Breakdown', M, y)
    y += 8
    const lossRows: Row[] = [
      ['Primary copper loss',   `${(losses.primaryCopper ?? 0).toFixed(3)} W`],
      ['Secondary copper loss', `${(losses.secondaryCopper ?? 0).toFixed(3)} W`],
      ['Core loss',             `${(losses.core ?? 0).toFixed(3)} W`],
      ['MOSFET loss',           `${(losses.mosfet ?? 0).toFixed(3)} W`],
      ['Diode loss',            `${(losses.diode ?? 0).toFixed(3)} W`],
      ['Clamp loss',            `${(losses.clamp ?? 0).toFixed(3)} W`],
      ['Total losses',          `${losses.total.toFixed(3)} W`],
    ]
    drawTable(doc, lossRows, M, y, CW)
    y += lossRows.length * 6.5 + 14
  } else if (isSwitchingLosses(losses)) {
    sectionRule(doc, 'Loss Breakdown', M, y)
    y += 8
    const lossRows: Row[] = [
      ['MOSFET conduction', `${(losses.mosfet_conduction ?? 0).toFixed(3)} W`],
      ['MOSFET switching',  `${(losses.mosfet_switching ?? 0).toFixed(3)} W`],
      ['Gate drive',        `${(losses.mosfet_gate ?? 0).toFixed(3)} W`],
      ['Inductor copper',   `${(losses.inductor_copper ?? 0).toFixed(3)} W`],
      ['Inductor core',     `${(losses.inductor_core ?? 0).toFixed(3)} W`],
      ['Diode conduction',  `${(losses.diode_conduction ?? 0).toFixed(3)} W`],
      ['Sync conduction',   `${(losses.sync_conduction ?? 0).toFixed(3)} W`],
      ['Sync dead-time',    `${(losses.sync_dead_time ?? 0).toFixed(3)} W`],
      ['Capacitor ESR',     `${(losses.capacitor_esr ?? 0).toFixed(3)} W`],
      ['Total losses',      `${losses.total.toFixed(3)} W`],
    ]
    drawTable(doc, lossRows, M, y, CW)
    y += lossRows.length * 6.5 + 14
  }

  return y
}

// ── Page renderers ────────────────────────────────────────────────────────────

function renderPage1(doc: Doc, topology: string, spec: DesignSpec, result: DesignResult): void {
  addHeader(doc, topology)
  addFooter(doc, 1, PAGE_COUNT)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); setTxt(doc, C_DARK)
  doc.text('Power Supply Design Report', PW / 2, 34, { align: 'center' })
  doc.setFontSize(13); setTxt(doc, C_ACCENT)
  doc.text(topoLabel(topology), PW / 2, 44, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); setTxt(doc, C_MED)
  doc.text(nowStr(), PW / 2, 52, { align: 'center' })
  setDraw(doc, C_ACCENT); doc.setLineWidth(0.4); doc.line(M, 57, PW - M, 57)

  let y      = 66
  const halfW = (CW - 8) / 2
  const rX    = M + halfW + 8

  sectionRule(doc, 'Design Specifications', M,  y, halfW)
  sectionRule(doc, 'Key Results',           rX, y, halfW)
  y += 8

  const specRows   = buildSpecRows(spec)
  const resultRows = buildResultRows(result)
  drawTable(doc, specRows,   M,  y, halfW)
  drawTable(doc, resultRows, rX, y, halfW)
  y += Math.max(specRows.length, resultRows.length) * 6.5 + 14

  sectionRule(doc, 'Warnings & Advisories', M, y)
  y += 8
  doc.setFontSize(9)
  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      setTxt(doc, C_WARN); doc.text('▲', M, y)
      setTxt(doc, C_DARK)
      const lines = doc.splitTextToSize(w, CW - 10)
      doc.text(lines, M + 6, y)
      y += lines.length * 5 + 3
    }
  } else {
    setTxt(doc, C_OK)
    doc.text('✓  No warnings — design parameters are within safe operating limits', M, y)
  }
}

function renderPage2(doc: Doc, topology: string, result: DesignResult, notes: string): void {
  doc.addPage()
  addHeader(doc, topology)
  addFooter(doc, 2, PAGE_COUNT)

  let y = 22
  sectionRule(doc, 'Computed Component Values & Ratings', M, y)
  y += 8
  const compRows = buildComponentRows(result)
  drawTable(doc, compRows, M, y, CW)
  y += compRows.length * 6.5 + 14

  y = renderLossSection(doc, result, y)

  if (notes.trim()) {
    sectionRule(doc, 'Design Notes', M, y)
    y += 8
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); setTxt(doc, C_DARK)
    doc.text(doc.splitTextToSize(notes.trim(), CW), M, y)
  }
}

function renderPage3(doc: Doc, topology: string, schematicImg: Capture | null): void {
  doc.addPage()
  addHeader(doc, topology)
  addFooter(doc, 3, PAGE_COUNT)
  let y = 22
  sectionRule(doc, `Circuit Schematic — ${topoLabel(topology)}`, M, y)
  y += 8
  addChartImage(doc, schematicImg, M, y, CW, 130)
}

function renderPage4(doc: Doc, topology: string, spec: DesignSpec, waveformImg: Capture | null): void {
  doc.addPage()
  addHeader(doc, topology)
  addFooter(doc, 4, PAGE_COUNT)
  let y = 22
  sectionRule(doc, 'Time-Domain Waveforms', M, y)
  y += 5
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setTxt(doc, C_MED)
  doc.text(`2 cycles at ${fmtHz(spec.fsw)}  ·  inductor current · switch node voltage · output ripple · diode current`, M, y + 4)
  y += 10
  addChartImage(doc, waveformImg, M, y, CW, 200)
}

function renderPage5(doc: Doc, topology: string, bodeImg: Capture | null): void {
  doc.addPage()
  addHeader(doc, topology)
  addFooter(doc, 5, PAGE_COUNT)
  let y = 22
  sectionRule(doc, 'Control Loop — Bode Plot', M, y)
  y += 5
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setTxt(doc, C_MED)
  doc.text('Plant · Compensator · Loop gain  |  Crossover frequency and phase/gain margins annotated on chart', M, y + 4)
  y += 10
  addChartImage(doc, bodeImg, M, y, CW, 190)
}

function renderPage6(
  doc: Doc,
  topology: string,
  lossBarImg: Capture | null,
  lossEffImg: Capture | null,
): void {
  doc.addPage()
  addHeader(doc, topology)
  addFooter(doc, 6, PAGE_COUNT)
  let y = 22
  sectionRule(doc, 'Loss Breakdown', M, y)
  y += 8
  y = addChartImage(doc, lossBarImg, M, y, CW, 90) + 4
  sectionRule(doc, 'Efficiency vs. Load Current', M, y)
  y += 6
  addChartImage(doc, lossEffImg, M, y, CW, 95)
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ReportParams {
  topology: string
  spec: DesignSpec
  result: DesignResult
  notes: string
  setActiveVizTab: (tab: ActiveVizTab) => void
  currentTab: ActiveVizTab
}

/**
 * Generate a 6-page A4 PDF report for a completed power-supply design.
 * Pages: title/summary → components/losses → schematic → waveforms → Bode → loss breakdown.
 * Chart tabs are switched programmatically and restored to `currentTab` when done.
 */
export async function generateReport(params: ReportParams): Promise<Blob> {
  const { topology, spec, result, notes, setActiveVizTab, currentTab } = params
  const charts = await captureCharts(setActiveVizTab, currentTab)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  doc.setFont('helvetica', 'normal')

  renderPage1(doc, topology, spec, result)
  renderPage2(doc, topology, result, notes)
  renderPage3(doc, topology, charts.schematicImg)
  renderPage4(doc, topology, spec, charts.waveformImg)
  renderPage5(doc, topology, charts.bodeImg)
  renderPage6(doc, topology, charts.lossBarImg, charts.lossEffImg)

  return doc.output('blob')
}
