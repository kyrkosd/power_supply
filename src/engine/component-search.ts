// Component search abstraction — local database and optional Digi-Key integration.
// Digi-Key API reference: https://developer.digikey.com/products/product-information/v4/

import {
  suggestInductors,
  suggestCapacitors,
  suggestMosfets,
  type InductorData,
  type CapacitorData,
  type MosfetData,
} from './component-selector'

// ── Public types ──────────────────────────────────────────────────────────────

export type ComponentType = 'inductor' | 'capacitor' | 'mosfet'

/** Minimum electrical requirements for an inductor search. */
export interface InductorRequirements {
  type: 'inductor'
  inductance_uh:  number
  isat_min_a:     number
  irms_min_a:     number
  dcr_max_mohm?:  number
}

/** Minimum electrical requirements for a capacitor search. */
export interface CapacitorRequirements {
  type: 'capacitor'
  capacitance_uf: number
  voltage_min_v:  number
  esr_max_mohm?:  number
}

/** Minimum electrical requirements for a MOSFET search. */
export interface MosfetRequirements {
  type: 'mosfet'
  vds_min_v:      number
  id_min_a:       number
  rds_max_mohm?:  number
}

export type ComponentRequirements =
  | InductorRequirements
  | CapacitorRequirements
  | MosfetRequirements

/** Normalised result returned by any search provider (local or Digi-Key). */
export interface ComponentResult {
  part_number:  string
  manufacturer: string
  description:  string
  // Electrical — present for all sources
  inductance_uh?:  number
  dcr_mohm?:       number
  isat_a?:         number
  irms_a?:         number
  capacitance_uf?: number
  voltage_v?:      number
  esr_mohm?:       number
  rds_on_mohm?:    number
  vds_v?:          number
  id_max_a?:       number
  // Commercial — Digi-Key only
  price_usd?:      number
  stock_qty?:      number
  datasheet_url?:  string
  product_url?:    string
  source: 'local' | 'digikey'
}

/** Contract for any component search backend. */
export interface ComponentSearchProvider {
  search(requirements: ComponentRequirements): Promise<ComponentResult[]>
}

// ── Local database result mappers ─────────────────────────────────────────────

/** Map a raw inductor database entry to the normalised ComponentResult shape. */
function mapInductor(d: InductorData): ComponentResult {
  return {
    part_number:   d.part_number,
    manufacturer:  d.manufacturer,
    description:   `${d.inductance_uh} µH — ${d.core_material} — ${d.size_mm}`,
    inductance_uh: d.inductance_uh,
    dcr_mohm:      d.dcr_mohm,
    isat_a:        d.isat_a,
    irms_a:        d.irms_a,
    source: 'local',
  }
}

/** Map a raw capacitor database entry to the normalised ComponentResult shape. */
function mapCapacitor(d: CapacitorData): ComponentResult {
  return {
    part_number:    d.part_number,
    manufacturer:   d.manufacturer,
    description:    `${d.capacitance_uf} µF ${d.voltage_v} V — ${d.type} — ${d.size}`,
    capacitance_uf: d.capacitance_uf,
    voltage_v:      d.voltage_v,
    esr_mohm:       d.esr_mohm,
    source: 'local',
  }
}

/** Map a raw MOSFET database entry to the normalised ComponentResult shape. */
function mapMosfet(d: MosfetData): ComponentResult {
  return {
    part_number:  d.part_number,
    manufacturer: d.manufacturer,
    description:  `${d.vds_v} V — ${d.rds_on_mohm} mΩ — ${d.package}`,
    rds_on_mohm:  d.rds_on_mohm,
    vds_v:        d.vds_v,
    id_max_a:     d.id_max_a,
    source: 'local',
  }
}

// ── Local database provider ───────────────────────────────────────────────────

/**
 * Searches the bundled component database (inductors, capacitors, MOSFETs).
 * Returns up to three parts sorted by the most relevant electrical metric.
 */
export class LocalDatabaseProvider implements ComponentSearchProvider {
  async search(req: ComponentRequirements): Promise<ComponentResult[]> {
    if (req.type === 'inductor')
      return suggestInductors(req.inductance_uh, req.isat_min_a).map(mapInductor)
    if (req.type === 'capacitor')
      return suggestCapacitors(req.capacitance_uf, req.voltage_min_v, req.esr_max_mohm).map(mapCapacitor)
    return suggestMosfets(req.vds_min_v).map(mapMosfet)
  }
}

// ── Digi-Key provider (renderer side — delegates to IPC bridge) ───────────────

// HTTP requests and OAuth2 flow run in the Electron main process via
// electron/digikey-bridge.ts to keep credentials off the renderer.
// The renderer communicates through window.digikeyAPI injected by the preload script.
export class DigiKeyProvider implements ComponentSearchProvider {
  async search(req: ComponentRequirements): Promise<ComponentResult[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (globalThis as any).digikeyAPI
    if (!api) throw new Error('DigiKey bridge not available')
    return api.search(req)
  }
}

// ── Provider factory ──────────────────────────────────────────────────────────

const _local   = new LocalDatabaseProvider()
const _digikey = new DigiKeyProvider()

/** Return the local database provider or the Digi-Key provider based on the flag. */
export function getProvider(useDigiKey: boolean): ComponentSearchProvider {
  return useDigiKey ? _digikey : _local
}
