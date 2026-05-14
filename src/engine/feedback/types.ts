export interface FeedbackOptions {
  vref: number
  divider_current_ua: number
  prefer_e24: boolean
}

export interface FeedbackResult {
  r_top:            number
  r_bottom:         number
  vref:             number
  actual_vout:      number
  vout_error_pct:   number
  divider_current:  number
  power_dissipated: number
  e96_values_used:  boolean
}
