import type { DesignSpec } from '../types'
import type { TopologyId } from '../../store/workbenchStore'
import { isPositiveFinite } from './types'

export function isBuckOutputHigh(topology: TopologyId, spec: DesignSpec): boolean {
  return topology === 'buck'
    && Number.isFinite(spec.vout)
    && isPositiveFinite(spec.vinMin)
    && spec.vout >= spec.vinMin
}

export function isBoostOutputLow(topology: TopologyId, spec: DesignSpec): boolean {
  return topology === 'boost'
    && Number.isFinite(spec.vout)
    && isPositiveFinite(spec.vinMax)
    && spec.vout <= spec.vinMax
}

export function isBuckBoostPositive(topology: TopologyId, spec: DesignSpec): boolean {
  return topology === 'buck-boost' && Number.isFinite(spec.vout) && spec.vout > 0
}

export function isFlybackDOverrun(topology: TopologyId, spec: DesignSpec): boolean {
  return topology === 'flyback'
    && isPositiveFinite(spec.vinMin)
    && isPositiveFinite(Math.abs(spec.vout))
}

export function isForwardDOverrun(topology: TopologyId, spec: DesignSpec): boolean {
  return topology === 'forward' && isPositiveFinite(spec.vinMin) && isPositiveFinite(spec.vout)
}
