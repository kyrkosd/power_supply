// Equation catalogue for the Interactive Equation Explorer.
import { mkInductanceEq } from './equation-metadata/inductance'
import { mkCapacitanceEq } from './equation-metadata/capacitance'
import { mkDutyCycleEq } from './equation-metadata/duty-cycle'
import { mkEfficiencyEq } from './equation-metadata/efficiency'
import { mkLcCornerEq } from './equation-metadata/lc-corner'
import { mkMosfetConductionEq } from './equation-metadata/mosfet-conduction'
import { mkMosfetSwitchingEq } from './equation-metadata/mosfet-switching'

export type { EquationVar, EquationEntry } from './equation-metadata/types'
export { numSuffix } from './equation-metadata/types'

export const EQUATIONS = [
  mkInductanceEq(),
  mkCapacitanceEq(),
  mkDutyCycleEq(),
  mkEfficiencyEq(),
  mkLcCornerEq(),
  mkMosfetConductionEq(),
  mkMosfetSwitchingEq(),
]

export function findEquation(id: string) {
  return EQUATIONS.find((e) => e.id === id)
}
