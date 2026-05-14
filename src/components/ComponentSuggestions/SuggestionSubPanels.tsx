// Public barrel for the suggestion sub-panels. Per-panel implementations live in panels/.
// Keeping this barrel preserves the existing import path used by ComponentSuggestions.tsx.

export { selectBadge }            from './panels/badges'
export { GateDriveSection }       from './panels/GateDrivePanel'
export { InductorCard }           from './panels/InductorPanel'
export { SoftStartDisplay }       from './panels/SoftStartPanel'
export { CurrentSensingDisplay }  from './panels/CurrentSensingPanel'
export { FeedbackNetworkDisplay } from './panels/FeedbackPanel'
export { CapLifetimeRow }         from './panels/CapLifetimePanel'
export { TransformerDetails }     from './panels/TransformerPanel'
