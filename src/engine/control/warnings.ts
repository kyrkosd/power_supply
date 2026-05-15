// Stability and mode-specific warnings emitted by the control-loop analyser.

import type { DesignSpec, DesignResult } from '../types'
import type { ControlMode } from './plant'
import type { SlopeCompensation } from './slope'

interface LoopMetrics {
  phaseMarginDeg:       number
  gainMarginDb:         number
  crossoverFrequencyHz: number
}

function subharmonicWarning(result: DesignResult, slope: SlopeCompensation): string {
  return `D = ${(result.dutyCycle * 100).toFixed(0)} % > 50 % — current-mode control requires slope compensation. ` +
         `Without it the converter will exhibit subharmonic oscillation at fsw/2. ` +
         `Add an external ramp Se ≥ ${(slope.se_required_aps / 1e6).toFixed(1)} MA/s × Rsense.`
}

function validBelow(x: number, limit: number): boolean {
  return !Number.isNaN(x) && x < limit
}

function validAbove(x: number, limit: number): boolean {
  return !Number.isNaN(x) && x > limit
}

export function buildLoopWarnings(
  controlMode: ControlMode, result: DesignResult, slope: SlopeCompensation,
  metrics: LoopMetrics, spec: DesignSpec,
): string[] {
  const warnings: string[] = []
  const { phaseMarginDeg, gainMarginDb, crossoverFrequencyHz } = metrics

  if (controlMode === 'current' && slope.subharmonic_risk) warnings.push(subharmonicWarning(result, slope))
  if (validBelow(phaseMarginDeg, 45))               warnings.push('Phase margin is below 45° — unstable or marginal control loop')
  if (validBelow(gainMarginDb, 6))                  warnings.push('Gain margin is below 6 dB — poor stability reserve')
  if (validAbove(crossoverFrequencyHz, spec.fsw / 5)) warnings.push('Crossover frequency exceeds fsw/5 — may violate switching dynamics')

  return warnings
}
