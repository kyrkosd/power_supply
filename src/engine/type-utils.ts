// Consolidated re-export of all analysis-module result types.
// New code should prefer importing from this file rather than directly
// from the individual analysis modules.
export type { SaturationResult }                          from './inductor-saturation'
export type { SnubberResult }                             from './snubber'
export type { SenseMethod, CurrentSenseResult }           from './current-sense'
export type { FilterComponent, InputFilterResult }        from './input-filter'
export type { WindingSection, WindingResult }             from './transformer-winding'
