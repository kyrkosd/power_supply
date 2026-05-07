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
