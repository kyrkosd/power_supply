/**
 * Canonical device assumptions used across all topology loss models.
 *
 * All values represent a generic mid-range 30–60 V power FET and a standard
 * Schottky diode. They are intentionally conservative so that computed losses
 * give a realistic upper bound rather than an optimistic estimate.
 *
 * Sources:
 *   - MOSFET parameters: typical values from Vishay/Infineon 30–60 V datasheets.
 *   - Diode Vf: Schottky barrier diode forward drop at rated current.
 *   - Core factor: simplified Steinmetz coefficient for MnZn ferrite (Micrometals T50).
 *
 * Physical units: Ω, s, C, V, F — all SI base units as required by the engine layer.
 */
export const DEVICE_ASSUMPTIONS = {
  // ── Control MOSFET (high-side switch) ──────────────────────────────────────
  rds_on:  0.02,   // Ω — on-resistance (typical 30–60 V FET at Vgs = 10 V)
  t_rise:  25e-9,  // s — current rise time during turn-on
  t_fall:  25e-9,  // s — current fall time during turn-off
  qg:      12e-9,  // C — total gate charge at Vgs = 5 V

  // ── Freewheeling / output diode ────────────────────────────────────────────
  vf: 0.7,         // V — Schottky diode forward drop at rated current

  // ── Inductor / transformer ─────────────────────────────────────────────────
  dcr:         0.045,  // Ω — winding DC resistance (typical 1–10 µH power inductor)
  core_factor: 0.02,   // — — simplified Steinmetz core-loss coefficient

  // ── Output capacitor ───────────────────────────────────────────────────────
  esr: 0.02,       // Ω — equivalent series resistance (ceramic / polymer)

  // ── Synchronous FET (low-side, replaces freewheeling diode) ───────────────
  rds_on_sync: 0.008,   // Ω — lower Rds_on than the control FET (larger die)
  t_dead:      30e-9,   // s — dead time per switching transition
  coss_sync:   100e-12, // F — output capacitance Coss
  qg_sync:     15e-9,   // C — gate charge at Vgs = 5 V
  vf_body:     0.7,     // V — body diode forward drop during dead time
} as const

// ── Named exports ─────────────────────────────────────────────────────────────
// Individual constants for direct use in topology files via named imports.

export const RDS_ON   = DEVICE_ASSUMPTIONS.rds_on
export const T_RISE   = DEVICE_ASSUMPTIONS.t_rise
export const T_FALL   = DEVICE_ASSUMPTIONS.t_fall
export const QG       = DEVICE_ASSUMPTIONS.qg
export const VF       = DEVICE_ASSUMPTIONS.vf
export const DCR      = DEVICE_ASSUMPTIONS.dcr
export const CORE_F   = DEVICE_ASSUMPTIONS.core_factor
export const ESR      = DEVICE_ASSUMPTIONS.esr
export const RDS_SYNC = DEVICE_ASSUMPTIONS.rds_on_sync
export const T_DEAD   = DEVICE_ASSUMPTIONS.t_dead
export const COSS_S   = DEVICE_ASSUMPTIONS.coss_sync
export const QG_S     = DEVICE_ASSUMPTIONS.qg_sync
export const VF_BODY  = DEVICE_ASSUMPTIONS.vf_body
