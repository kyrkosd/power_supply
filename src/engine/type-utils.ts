// Consolidated re-export of all analysis-module result types.
// New code should prefer importing from this file rather than directly
// from the individual analysis modules.
export type {
  SaturationResult,
  SnubberResult,
  SenseMethod,
  CurrentSenseResult,
  FilterComponent,
  InputFilterResult,
  WindingSection,
  WindingResult,
} from './types'
