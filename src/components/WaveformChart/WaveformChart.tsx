// Synchronized four-panel D3 waveform chart for the buck topology.
import React, { useEffect, useRef } from 'react'
import type { WaveformSet } from '../../engine/topologies/types'
import type { DesignSpec } from '../../engine/types'
import { drawWaveformChart } from './waveformChartDraw'
import styles from './WaveformChart.module.css'

/** Props accepted by the WaveformChart component. */
interface WaveformChartProps {
  waveforms: WaveformSet
  spec:      DesignSpec
}

/**
 * Renders synchronized D3 waveform panels (inductor current, switch node,
 * output ripple, diode current) for one switching period.
 * Re-draws whenever waveforms or spec changes.
 */
export function WaveformChart({ waveforms, spec }: WaveformChartProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) drawWaveformChart(svgRef.current, waveforms, spec)
  }, [waveforms, spec])

  return (
    <div className={styles.wrapper}>
      <svg ref={svgRef} className={styles.svg} data-export-id="waveform-chart" />
    </div>
  )
}
