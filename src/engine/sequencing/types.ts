import type { DesignSpec } from '../types'

export interface SequencingRail {
  id: string
  name: string
  vout: number
  tss: number
  pg_delay: number
  spec?: DesignSpec
}

export interface RailTiming {
  name: string
  vout: number
  tss: number
  pg_delay: number
  enable_time_ms: number
  pg_time_ms: number
}

export interface TimingEvent {
  rail: string
  event: 'enable' | 'pg'
  time_ms: number
}

export interface SequencingResult {
  rails: RailTiming[]
  sequencing_order: string[]
  timing_diagram: TimingEvent[]
  warnings: string[]
  total_time_ms: number
}
