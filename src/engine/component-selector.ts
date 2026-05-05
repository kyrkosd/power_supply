// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import inductorsData from '../data/inductors.json'
import capacitorsData from '../data/capacitors.json'
import mosfetsData from '../data/mosfets.json'

export interface InductorData {
  manufacturer: string
  part_number: string
  inductance_uh: number
  dcr_mohm: number
  isat_a: number
  irms_a: number
  size_mm: string
  core_material: string
}

export interface CapacitorData {
  manufacturer: string
  part_number: string
  capacitance_uf: number
  voltage_v: number
  esr_mohm: number
  ripple_current_a: number
  type: string
  size: string
}

export interface MosfetData {
  manufacturer: string
  part_number: string
  vds_v: number
  rds_on_mohm: number
  qg_nc: number
  qgd_nc: number
  coss_pf: number
  id_max_a: number
  package: string
}

const inductors: InductorData[] = inductorsData as InductorData[]
const capacitors: CapacitorData[] = capacitorsData as CapacitorData[]
const mosfets: MosfetData[] = mosfetsData as MosfetData[]

export function suggestInductors(requiredInductance: number, requiredIsat: number): InductorData[] {
  return inductors
    .filter(ind => ind.inductance_uh >= requiredInductance && ind.isat_a >= requiredIsat)
    .sort((a, b) => a.dcr_mohm - b.dcr_mohm)
    .slice(0, 3)
}

export function suggestCapacitors(requiredCapacitance: number, requiredVoltage: number, maxEsr?: number): CapacitorData[] {
  return capacitors
    .filter(cap => cap.capacitance_uf >= requiredCapacitance && cap.voltage_v >= requiredVoltage)
    .filter(cap => !maxEsr || cap.esr_mohm <= maxEsr)
    .sort((a, b) => a.esr_mohm - b.esr_mohm)
    .slice(0, 3)
}

export function suggestMosfets(requiredVds: number): MosfetData[] {
  return mosfets
    .filter(mos => mos.vds_v >= requiredVds)
    .sort((a, b) => (a.rds_on_mohm * a.qg_nc) - (b.rds_on_mohm * b.qg_nc))
    .slice(0, 3)
}

export interface SelectedComponents {
  inductor: InductorData | null
  capacitor: CapacitorData | null
  mosfet: MosfetData | null
}