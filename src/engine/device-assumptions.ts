// Standard device assumptions for loss calculations across all topologies.
// Used to ensure consistency between computed results and LossBreakdown.tsx.

export const DEVICE_ASSUMPTIONS = {
  // Control MOSFET (high-side switch)
  rds_on: 0.02,           // Ω — typical 30–60 V FET
  t_rise: 25e-9,          // s — switching rise time
  t_fall: 25e-9,          // s — switching fall time
  qg: 12e-9,              // C — gate charge (Vgs = 5 V)

  // Freewheeling / output diode
  vf: 0.7,                // V — forward drop

  // Inductor / transformer
  dcr: 0.045,             // Ω — inductor DCR
  core_factor: 0.02,      // — — Steinmetz core-loss coefficient (simplified)

  // Output capacitor
  esr: 0.02,              // Ω — ESR

  // Synchronous FET (low-side, replaces diode)
  rds_on_sync: 0.008,     // Ω — sync FET, lower than control FET
  t_dead: 30e-9,          // s — dead time per transition
  coss_sync: 100e-12,     // F — output capacitance (Coss)
  qg_sync: 15e-9,         // C — gate charge (Vgs = 5 V)
  vf_body: 0.7,           // V — body diode Vf during dead time
}

// Named exports used by boost, buck-boost, and SEPIC topologies.
export const RDS_ON  = DEVICE_ASSUMPTIONS.rds_on
export const T_RISE  = DEVICE_ASSUMPTIONS.t_rise
export const T_FALL  = DEVICE_ASSUMPTIONS.t_fall
export const QG      = DEVICE_ASSUMPTIONS.qg
export const VF      = DEVICE_ASSUMPTIONS.vf
export const DCR     = DEVICE_ASSUMPTIONS.dcr
export const CORE_F  = DEVICE_ASSUMPTIONS.core_factor
export const ESR     = DEVICE_ASSUMPTIONS.esr
export const RDS_SYNC = DEVICE_ASSUMPTIONS.rds_on_sync
export const T_DEAD  = DEVICE_ASSUMPTIONS.t_dead
export const COSS_S  = DEVICE_ASSUMPTIONS.coss_sync
export const QG_S    = DEVICE_ASSUMPTIONS.qg_sync
export const VF_BODY = DEVICE_ASSUMPTIONS.vf_body
