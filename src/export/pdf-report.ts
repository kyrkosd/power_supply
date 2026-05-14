// PDF report generator: produces a 6-page A4 report with spec summary, component values,
// loss breakdown, schematic, waveforms, and Bode plot. Per-page rendering lives in pdf/pages.ts;
// SVG capture lives in pdf/svg-capture.ts; jsPDF primitives in pdf/primitives.ts.

import jsPDF from 'jspdf'
import type { DesignSpec, DesignResult } from '../engine/types'
import type { ActiveVizTab } from '../store/design-store'
import { captureCharts } from './pdf/svg-capture'
import {
  renderPage1, renderPage2, renderPage3, renderPage4, renderPage5, renderPage6,
} from './pdf/pages'

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
  renderPage6(doc, topology, charts)

  return doc.output('blob')
}
