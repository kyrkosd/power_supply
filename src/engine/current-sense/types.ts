export type SenseMethod = 'resistor' | 'rdson'

export interface CurrentSenseResult {
  method: SenseMethod
  rsense: number
  rsense_power: number
  rsense_package: string
  vsense_peak: number
  vsense_valley: number
  snr_at_light_load: number
  kelvin_connection_required: boolean
  rdson_temp_error_pct: number
  slope_comp_ramp: number
  warnings: string[]
}
