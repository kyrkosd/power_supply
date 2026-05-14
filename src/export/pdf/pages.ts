// Per-page layout functions. Each renders one A4 page; pages 2-6 begin with doc.addPage().

import type { DesignSpec, DesignResult } from '../../engine/types'
import { fmtHz } from '../format-utils'
import {
  PW, M, CW, PAGE_COUNT,
  C_DARK, C_ACCENT, C_MED, C_WARN, C_OK,
  topoLabel, nowStr,
} from './constants'
import {
  setTxt, setDraw, addHeader, addFooter, sectionRule, drawTable, addChartImage,
  type Doc,
} from './primitives'
import { buildSpecRows, buildResultRows, buildComponentRows, renderLossSection } from './rows'
import type { Capture, Charts } from './svg-capture'

function renderWarnings(doc: Doc, warnings: string[], y: number): void {
  doc.setFontSize(9)
  if (warnings.length === 0) {
    setTxt(doc, C_OK)
    doc.text('✓  No warnings — design parameters are within safe operating limits', M, y)
    return
  }
  for (const w of warnings) {
    setTxt(doc, C_WARN); doc.text('▲', M, y)
    setTxt(doc, C_DARK)
    const lines = doc.splitTextToSize(w, CW - 10)
    doc.text(lines, M + 6, y)
    y += lines.length * 5 + 3
  }
}

function renderTitleBlock(doc: Doc, topology: string): void {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); setTxt(doc, C_DARK)
  doc.text('Power Supply Design Report', PW / 2, 34, { align: 'center' })
  doc.setFontSize(13); setTxt(doc, C_ACCENT)
  doc.text(topoLabel(topology), PW / 2, 44, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); setTxt(doc, C_MED)
  doc.text(nowStr(), PW / 2, 52, { align: 'center' })
  setDraw(doc, C_ACCENT); doc.setLineWidth(0.4); doc.line(M, 57, PW - M, 57)
}

export function renderPage1(doc: Doc, topology: string, spec: DesignSpec, result: DesignResult): void {
  addHeader(doc, topology)
  addFooter(doc, 1, PAGE_COUNT)
  renderTitleBlock(doc, topology)

  let y       = 66
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
  renderWarnings(doc, result.warnings, y + 8)
}

export function renderPage2(doc: Doc, topology: string, result: DesignResult, notes: string): void {
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

/** A page that hosts a single full-width chart with a title rule. */
function singleChartPage(
  doc: Doc, topology: string, pageNum: number, title: string,
  subtitle: string | null, capture: Capture | null, maxH: number,
): void {
  doc.addPage()
  addHeader(doc, topology)
  addFooter(doc, pageNum, PAGE_COUNT)
  let y = 22
  sectionRule(doc, title, M, y)
  y += subtitle ? 5 : 8
  if (subtitle) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setTxt(doc, C_MED)
    doc.text(subtitle, M, y + 4)
    y += 10
  }
  addChartImage(doc, capture, M, y, CW, maxH)
}

export function renderPage3(doc: Doc, topology: string, schematicImg: Capture | null): void {
  singleChartPage(doc, topology, 3, `Circuit Schematic — ${topoLabel(topology)}`, null, schematicImg, 130)
}

export function renderPage4(doc: Doc, topology: string, spec: DesignSpec, waveformImg: Capture | null): void {
  const subtitle = `2 cycles at ${fmtHz(spec.fsw)}  ·  inductor current · switch node voltage · output ripple · diode current`
  singleChartPage(doc, topology, 4, 'Time-Domain Waveforms', subtitle, waveformImg, 200)
}

export function renderPage5(doc: Doc, topology: string, bodeImg: Capture | null): void {
  const subtitle = 'Plant · Compensator · Loop gain  |  Crossover frequency and phase/gain margins annotated on chart'
  singleChartPage(doc, topology, 5, 'Control Loop — Bode Plot', subtitle, bodeImg, 190)
}

export function renderPage6(doc: Doc, topology: string, charts: Pick<Charts, 'lossBarImg' | 'lossEffImg'>): void {
  doc.addPage()
  addHeader(doc, topology)
  addFooter(doc, 6, PAGE_COUNT)
  let y = 22
  sectionRule(doc, 'Loss Breakdown', M, y)
  y += 8
  y = addChartImage(doc, charts.lossBarImg, M, y, CW, 90) + 4
  sectionRule(doc, 'Efficiency vs. Load Current', M, y)
  y += 6
  addChartImage(doc, charts.lossEffImg, M, y, CW, 95)
}
