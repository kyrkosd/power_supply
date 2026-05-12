// Bode plot component: control-loop plant, compensator, and loop-gain magnitude curves.
import React, { useEffect, useRef } from 'react'
import type { DesignSpec, DesignResult } from '@engine/types'
import { drawBodePlot } from './bodePlotDraw'
import styles from './BodePlot.module.css'

/** Props accepted by the BodePlot component. */
interface BodePlotProps {
  spec:   DesignSpec
  result: DesignResult
}

/**
 * Renders a D3 Bode plot for the current design.
 * Re-draws whenever spec or result changes.
 */
export function BodePlot({ spec, result }: BodePlotProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) drawBodePlot(svgRef.current, spec, result)
  }, [spec, result])

  return (
    <div className={styles.wrapper}>
      <svg ref={svgRef} className={styles.svg} data-export-id="bode-plot" />
    </div>
  )
}
