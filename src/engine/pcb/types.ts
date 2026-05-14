// PCB layout guide — shared types. Pure types, no runtime cost.

export interface CriticalLoop {
  name: string
  components: string[]
  description: string
  priority: 1 | 2 | 3   // 1 = critical, 2 = important, 3 = nice-to-have
}

export interface TraceWidth {
  net: string
  current_a: number
  min_width_mm: number        // at 1 oz copper, 10 °C rise
  min_width_mm_2oz: number    // at 2 oz copper, 10 °C rise
  copper_weight_oz: 1 | 2     // recommended copper weight
}

export interface PlacementStep {
  step: number
  component: string
  reason: string
}

export interface ThermalVia {
  component: string
  via_count: number
  via_diameter_mm: number
  reason: string
}

export interface KeepOut {
  area: string
  reason: string
}

export interface LayoutGuidelines {
  critical_loops: CriticalLoop[]
  trace_widths: TraceWidth[]
  placement_order: PlacementStep[]
  thermal_vias: ThermalVia[]
  keep_outs: KeepOut[]
  general_tips: string[]
}
