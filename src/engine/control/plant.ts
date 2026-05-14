// Buck converter plant transfer-function polynomials, voltage- and current-mode.

import type { DesignSpec } from '../types'

export type ControlMode = 'voltage' | 'current'

export interface PlantPolynomials {
  numerator:   readonly number[]
  denominator: readonly number[]
  z0: number   // compensator zero (rad/s)
  p0: number   // compensator pole (rad/s)
}

/**
 * Voltage-mode buck plant (double LC pole + ESR zero).
 * Erickson & Maksimovic §8.1 — buck converter averaged model.
 */
function voltageModePolynomials(spec: DesignSpec, L: number, C: number, Esr: number, Rload: number): PlantPolynomials {
  return {
    numerator:   [spec.vinMax * Esr * C, spec.vinMax],
    denominator: [L * C, Esr * C + L / Rload, 1],
    z0: 1 / Math.sqrt(L * C),
    p0: 1 / (Esr * C),
  }
}

/**
 * Peak current-mode buck plant (single-pole; inductor absorbed by inner loop).
 * Ridley (1991) simplified single-pole approximation below fsw/2.
 */
function currentModePolynomials(C: number, Esr: number, Rload: number, fsw: number): PlantPolynomials {
  return {
    numerator:   [Rload * Esr * C, Rload],
    denominator: [Rload * C, 1],
    z0: 1 / (Rload * C),
    p0: Math.min(1 / (Esr * C), 2 * Math.PI * fsw / 5),
  }
}

export function selectPlant(
  controlMode: ControlMode, spec: DesignSpec, L: number, C: number, Esr: number, Rload: number,
): PlantPolynomials {
  return controlMode === 'current'
    ? currentModePolynomials(C, Esr, Rload, spec.fsw)
    : voltageModePolynomials(spec, L, C, Esr, Rload)
}
