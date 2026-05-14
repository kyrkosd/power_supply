// Active-component (MOSFET, diode, sync FET, transformer) row builders.

import { suggestMosfets } from '../../engine/component-selector'
import type { SelectedComponents } from '../../engine/component-selector'
import type { DesignSpec, DesignResult } from '../../engine/types'
import { fmtL, fmtHz } from '../format-utils'
import type { BOMRow } from './types'

const EMPTY_PART = { pkg: '-', manufacturer: '-', partNumber: '-' }

function mosfetRdsBudget(vds: number): number { return vds <= 60 ? 10 : 50 }

export function buildQ1Row(mosfetVds: number, result: DesignResult, selected: SelectedComponents): BOMRow {
  const mosfet = selected.mosfet ?? suggestMosfets(mosfetVds)[0] ?? null
  return {
    ref:          'Q1',
    component:    'MOSFET',
    value:        '-',
    rating:       `Vds≥${mosfetVds.toFixed(0)} V; Rds≤${mosfetRdsBudget(mosfetVds)} mΩ; Id≥${result.peakCurrent.toFixed(1)} A`,
    pkg:          mosfet?.package ?? '-',
    manufacturer: mosfet?.manufacturer ?? '-',
    partNumber:   mosfet?.part_number ?? '-',
    qty:          1,
    notes:        mosfet
      ? `Rds_on: ${mosfet.rds_on_mohm} mΩ; Qg: ${mosfet.qg_nc} nC; Id_max: ${mosfet.id_max_a} A`
      : 'No match in database — check requirements',
  }
}

function syncFetRow(mosfetVds: number, spec: DesignSpec): BOMRow {
  const syncFet = suggestMosfets(mosfetVds).slice().sort((a, b) => a.rds_on_mohm - b.rds_on_mohm)[0] ?? null
  return {
    ref:          'Q2',
    component:    'MOSFET (Sync)',
    value:        '-',
    rating:       `Vds≥${mosfetVds.toFixed(0)} V; Rds≤8 mΩ; Id≥${spec.iout.toFixed(1)} A`,
    pkg:          syncFet?.package ?? '-',
    manufacturer: syncFet?.manufacturer ?? '-',
    partNumber:   syncFet?.part_number ?? '-',
    qty:          spec.phases ?? 1,
    notes:        syncFet
      ? `Low-side sync FET: Rds=${syncFet.rds_on_mohm} mΩ; Qg=${syncFet.qg_nc} nC — optimise for low Rds_on`
      : 'Low-side sync FET — no match in database; check Rds_on < 10 mΩ',
  }
}

function schottkyRow(topology: string, spec: DesignSpec, diodeVr: number): BOMRow {
  return {
    ref:    'D1', component: 'Schottky Diode', value: '-',
    rating: `Vr≥${diodeVr.toFixed(0)} V; If≥${spec.iout.toFixed(1)} A`,
    ...EMPTY_PART,
    qty:    1,
    notes:  topology === 'flyback' || topology === 'forward'
              ? 'Secondary-side rectifier'
              : 'Asynchronous; replace with sync MOSFET to improve light-load efficiency',
  }
}

export function buildD1Row(topology: string, spec: DesignSpec, mosfetVds: number, diodeVr: number, isSyncMode: boolean): BOMRow {
  return isSyncMode ? syncFetRow(mosfetVds, spec) : schottkyRow(topology, spec, diodeVr)
}

export function buildD2Row(diodeVr: number, spec: DesignSpec): BOMRow {
  return {
    ref: 'D2', component: 'Schottky Diode', value: '-',
    rating: `Vr≥${diodeVr.toFixed(0)} V; If≥${spec.iout.toFixed(1)} A`,
    ...EMPTY_PART,
    qty: 1, notes: 'Freewheeling diode',
  }
}

function transformerSpecLine(result: DesignResult): string {
  const parts: string[] = []
  if (result.turnsRatio            != null) parts.push(`Np/Ns: ${result.turnsRatio.toFixed(2)}`)
  if (result.primaryTurns          != null) parts.push(`Np: ${result.primaryTurns}`)
  if (result.secondaryTurns        != null) parts.push(`Ns: ${result.secondaryTurns}`)
  if (result.magnetizingInductance != null) parts.push(`Lm: ${fmtL(result.magnetizingInductance)}`)
  if (result.leakageInductance     != null) parts.push(`Llk: ${fmtL(result.leakageInductance)}`)
  return parts.join('; ') || '-'
}

export function buildT1Row(topology: string, spec: DesignSpec, result: DesignResult): BOMRow {
  return {
    ref:          'T1',
    component:    topology === 'flyback' ? 'Flyback Transformer' : 'Forward Transformer',
    value:        '-',
    rating:       transformerSpecLine(result),
    pkg:          result.coreType ?? '-',
    manufacturer: '-',
    partNumber:   'Custom wound',
    qty:          1,
    notes:        `fsw: ${fmtHz(spec.fsw)}; core: ${result.coreType ?? 'TBD'}`,
  }
}
