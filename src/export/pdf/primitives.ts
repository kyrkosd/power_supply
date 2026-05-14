// jsPDF drawing primitives: colour setters, headers, footers, section rules, tables, chart images.

import type jsPDF from 'jspdf'
import {
  PW, PH, M, CW,
  C_HDR, C_HDR_TXT, C_ACCENT, C_DARK, C_MED, C_ROW,
  type RGB,
  topoLabel, nowStr,
} from './constants'
import type { Capture } from './svg-capture'

export type Doc = jsPDF
export type Row = [string, string]

export function setTxt(doc: Doc, rgb: RGB):  void { doc.setTextColor(rgb[0], rgb[1], rgb[2]) }
export function setFill(doc: Doc, rgb: RGB): void { doc.setFillColor(rgb[0], rgb[1], rgb[2]) }
export function setDraw(doc: Doc, rgb: RGB): void { doc.setDrawColor(rgb[0], rgb[1], rgb[2]) }

export function addHeader(doc: Doc, topology: string): void {
  setFill(doc, C_HDR)
  doc.rect(0, 0, PW, 13, 'F')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  setTxt(doc, C_HDR_TXT)
  doc.text('POWER SUPPLY DESIGN REPORT', M, 8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(topoLabel(topology).toUpperCase(), PW - M, 8.5, { align: 'right' })
}

export function addFooter(doc: Doc, pageNum: number, total: number): void {
  setFill(doc, C_HDR)
  doc.rect(0, PH - 11, PW, 11, 'F')
  doc.setFontSize(7.5)
  setTxt(doc, C_HDR_TXT)
  doc.text('Power Supply Design Workbench', M, PH - 4)
  doc.text(`Page ${pageNum} of ${total}`, PW / 2, PH - 4, { align: 'center' })
  doc.text(nowStr(), PW - M, PH - 4, { align: 'right' })
}

export function sectionRule(doc: Doc, label: string, x: number, y: number, width = CW): void {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setTxt(doc, C_DARK)
  doc.text(label.toUpperCase(), x, y)
  setDraw(doc, C_ACCENT)
  doc.setLineWidth(0.4)
  doc.line(x, y + 1.5, x + width, y + 1.5)
  doc.setFont('helvetica', 'normal')
}

/** Render a 2-column label/value table. Returns the y position after the last row. */
export function drawTable(doc: Doc, rows: Row[], x: number, y: number, colW: number): number {
  const rowH   = 6.5
  const labelW = colW * 0.56
  doc.setFontSize(8.5)
  rows.forEach(([label, value], i) => {
    const ry = y + i * rowH
    if (i % 2 === 0) { setFill(doc, C_ROW); doc.rect(x, ry - 4.5, colW, rowH, 'F') }
    setTxt(doc, C_MED);  doc.setFont('helvetica', 'normal'); doc.text(label, x + 2, ry)
    setTxt(doc, C_DARK); doc.setFont('helvetica', 'bold');   doc.text(value, x + labelW, ry)
  })
  doc.setFont('helvetica', 'normal')
  return y + rows.length * rowH
}

const FRAME_RGB: RGB = [15, 20, 40]
const MISSING_RGB: RGB = [28, 33, 55]

/** Embed a captured chart, or draw a placeholder if capture failed. Returns the y position below it. */
export function addChartImage(
  doc: Doc, capture: Capture | null, x: number, y: number, maxW: number, maxH: number,
): number {
  if (!capture) {
    setFill(doc, MISSING_RGB); doc.rect(x, y, maxW, 36, 'F')
    doc.setFontSize(9); setTxt(doc, C_MED)
    doc.text('Chart not available — run the simulation and visit this tab first', x + maxW / 2, y + 20, { align: 'center' })
    return y + 40
  }
  const imgH = Math.min(maxW * (capture.h / capture.w), maxH)
  setFill(doc, FRAME_RGB); doc.rect(x - 1, y - 1, maxW + 2, imgH + 2, 'F')
  doc.addImage(capture.dataUrl, 'PNG', x, y, maxW, imgH)
  return y + imgH + 4
}
