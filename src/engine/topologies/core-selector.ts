// Core database and selection utilities — shared by flyback and forward topologies
// Both topologies use the same core database and selection algorithm

import coresData from '../../data/cores.json'

// ── Core database types ────────────────────────────────────────────────────────

export interface CoreData {
  type: string
  Ae: number       // m²
  Aw: number       // m²
  le: number       // m
  Ve: number       // m³
  AL: number       // nH/N²
  MLT_mm: number           // mean length per turn, mm
  bobbin_width_mm: number  // usable winding width, mm
  bobbin_height_mm: number // usable winding height, mm
}

// ── Core selection ────────────────────────────────────────────────────────────

const cores: CoreData[] = coresData as CoreData[]

/**
 * Select the core with the smallest area product that meets or exceeds the requirement.
 * @param areaProduct Minimum required area product (Ae × Aw) in m⁴
 * @returns Suitable core or null if none available
 */
export function selectCore(areaProduct: number): CoreData | null {
  const suitable = cores.filter(core => core.Ae * core.Aw >= areaProduct)
  if (suitable.length === 0) return null
  return suitable.reduce((min, core) =>
    (core.Ae * core.Aw < min.Ae * min.Aw) ? core : min
  )
}

/**
 * Look up a core by its type string (e.g. "EE25").
 * @returns Matching core entry or null if not found
 */
export function getCoreByType(type: string): CoreData | null {
  return cores.find(c => c.type === type) ?? null
}
