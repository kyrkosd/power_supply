// Bill of Materials generator: assembles per-component BOM rows and serialises to CSV.
// Per-row builders live in bom/{active,passive,control}.ts; voltage stress in bom/stress.ts.

import type { SelectedComponents } from '../engine/component-selector'
import type { DesignSpec, DesignResult } from '../engine/types'
import type { FeedbackOptions } from '../engine/feedback'
import type { SoftStartOptions } from '../engine/soft-start'
import { rowToCsv, type BOMRow } from './bom/types'
import { voltageStress } from './bom/stress'
import {
  buildQ1Row, buildD1Row, buildD2Row, buildT1Row,
} from './bom/active'
import {
  buildL1Row, buildCcRow, buildCoutRow, buildCinRow,
} from './bom/passive'
import {
  buildCssRow, buildRsenseRow, buildFeedbackRows, buildEmiFilterRows,
} from './bom/control'

export type { SelectedComponents }

const CSV_HEADER = 'Reference,Component,Value,Rating,Package,Manufacturer,Part Number,Quantity,Notes'

const NON_ISOLATED_TOPOLOGIES = new Set(['buck', 'boost', 'buck-boost', 'sepic'])

/**
 * Generate a CSV Bill of Materials for a computed switching-supply design.
 * Rows are ordered by circuit position: switch → rectifier → magnetics →
 * passives → sense/feedback → EMI filter.
 */
export function generateBOM(
  topology: string,
  spec: DesignSpec,
  result: DesignResult,
  selected: SelectedComponents,
  feedbackOpts?: Partial<FeedbackOptions>,
  softStartOpts?: Partial<SoftStartOptions>,
): string {
  const { mosfetVds, diodeVr } = voltageStress(topology, spec, result)
  const isSyncMode = spec.rectification === 'synchronous' && NON_ISOLATED_TOPOLOGIES.has(topology)
  const isIsolated = topology === 'flyback' || topology === 'forward'

  const rows: BOMRow[] = [
    buildQ1Row(mosfetVds, result, selected),
    buildD1Row(topology, spec, mosfetVds, diodeVr, isSyncMode),
  ]
  if (topology === 'forward')                                     rows.push(buildD2Row(diodeVr, spec))
  if (isIsolated)                                                 rows.push(buildT1Row(topology, spec, result))
  rows.push(buildL1Row(spec, result, selected))
  if (topology === 'sepic' && result.couplingCapacitance != null) rows.push(buildCcRow(spec, result))
  rows.push(buildCoutRow(spec, result, selected))
  rows.push(buildCinRow(spec, result))
  rows.push(buildCssRow(topology, spec, result, softStartOpts))

  const rsRow = buildRsenseRow(result)
  if (rsRow) rows.push(rsRow)

  if (!isIsolated) rows.push(...buildFeedbackRows(spec, feedbackOpts))
  rows.push(...buildEmiFilterRows(result))

  return [CSV_HEADER, ...rows.map(rowToCsv)].join('\r\n')
}
