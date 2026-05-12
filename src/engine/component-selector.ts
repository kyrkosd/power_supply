import inductorsData  from '../data/inductors.json'
import capacitorsData from '../data/capacitors.json'
import mosfetsData    from '../data/mosfets.json'

// ── Database types ────────────────────────────────────────────────────────────

/** Single entry from the bundled inductor database (inductors.json). */
export interface InductorData {
  manufacturer:  string
  part_number:   string
  inductance_uh: number  // µH
  dcr_mohm:      number  // mΩ — DC winding resistance
  isat_a:        number  // A  — saturation current
  irms_a:        number  // A  — continuous RMS current rating
  size_mm:       string
  core_material: string
}

/** Single entry from the bundled capacitor database (capacitors.json). */
export interface CapacitorData {
  manufacturer:    string
  part_number:     string
  capacitance_uf:  number  // µF
  voltage_v:       number  // V  — rated voltage
  esr_mohm:        number  // mΩ — equivalent series resistance
  ripple_current_a: number // A  — rated ripple current
  type:            string  // e.g. 'electrolytic', 'ceramic'
  size:            string
  lifetime_hours?: number  // h  — base lifetime at max rated temp (electrolytic only)
  temp_rating?:    number  // °C — maximum rated temperature (electrolytic only)
}

/** Single entry from the bundled MOSFET database (mosfets.json). */
export interface MosfetData {
  manufacturer:  string
  part_number:   string
  vds_v:         number  // V  — drain-source voltage rating
  rds_on_mohm:   number  // mΩ — on-resistance
  qg_nc:         number  // nC — total gate charge
  qgd_nc:        number  // nC — gate-drain charge
  coss_pf:       number  // pF — output capacitance
  id_max_a:      number  // A  — continuous drain current
  package:       string
}

/** First-choice component set assembled from the three databases. */
export interface SelectedComponents {
  inductor:  InductorData  | null
  capacitor: CapacitorData | null
  mosfet:    MosfetData    | null
}

// ── Database instances ────────────────────────────────────────────────────────

const inductors:  InductorData[]  = inductorsData  as InductorData[]
const capacitors: CapacitorData[] = capacitorsData as CapacitorData[]
const mosfets:    MosfetData[]    = mosfetsData    as MosfetData[]

// ── Selector functions ────────────────────────────────────────────────────────

/**
 * Return up to three inductors that meet both the inductance and saturation current
 * requirements, sorted ascending by DCR (lowest copper loss first).
 *
 * @param requiredInductance  Minimum inductance in µH.
 * @param requiredIsat        Minimum saturation current in A.
 */
export function suggestInductors(requiredInductance: number, requiredIsat: number): InductorData[] {
  return inductors
    .filter(ind => ind.inductance_uh >= requiredInductance && ind.isat_a >= requiredIsat)
    .sort((a, b) => a.dcr_mohm - b.dcr_mohm)
    .slice(0, 3)
}

/**
 * Return up to three capacitors that meet the capacitance and voltage requirements,
 * sorted ascending by ESR (lowest ripple heating first).
 *
 * @param requiredCapacitance  Minimum capacitance in µF.
 * @param requiredVoltage      Minimum voltage rating in V.
 * @param maxEsr               Optional upper bound on ESR in mΩ.
 */
export function suggestCapacitors(
  requiredCapacitance: number,
  requiredVoltage: number,
  maxEsr?: number,
): CapacitorData[] {
  return capacitors
    .filter(cap => cap.capacitance_uf >= requiredCapacitance && cap.voltage_v >= requiredVoltage)
    .filter(cap => !maxEsr || cap.esr_mohm <= maxEsr)
    .sort((a, b) => a.esr_mohm - b.esr_mohm)
    .slice(0, 3)
}

/**
 * Return up to three MOSFETs that meet the drain-source voltage requirement,
 * sorted by Rds_on × Qg (minimises combined conduction + switching loss figure of merit).
 *
 * @param requiredVds  Minimum V_DS rating in V.
 */
export function suggestMosfets(requiredVds: number): MosfetData[] {
  return mosfets
    .filter(mos => mos.vds_v >= requiredVds)
    .sort((a, b) => (a.rds_on_mohm * a.qg_nc) - (b.rds_on_mohm * b.qg_nc))
    .slice(0, 3)
}
