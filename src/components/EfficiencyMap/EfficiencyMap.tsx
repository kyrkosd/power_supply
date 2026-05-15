// Efficiency heatmap component: 10×10 Vin × Iout grid with hover tooltip and crosshair.
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useDesignStore } from '../../store/design-store'
import { drawHeatmap } from './efficiencyMapDraw'
import type { DrawParams } from './efficiencyMapDraw'
import styles from './EfficiencyMap.module.css'

/** Topologies whose efficiency is derived from a loss model (vs. fixed target). */
const LOSS_MODEL_TOPOLOGIES = new Set(['buck-boost', 'flyback', 'forward', 'sepic'])

function outOfBounds(vi: number, ii: number, N: number): boolean {
  return vi < 0 || vi >= N || ii < 0 || ii >= N
}

function computeLoss(eff: number, pout: number): number {
  if (eff <= 0 || eff >= 1) return 0
  return pout * (1 / eff - 1)
}

/** Hover tooltip data: grid cell values and cursor position. */
interface HoverInfo { vin: number; iout: number; eff: number; lossW: number; x: number; y: number }

/** Toolbar: refresh button, empty-state hint, and loss-model note. */
function MapToolbar({ topology, efficiencyMapResult, efficiencyMapLoading, onRefresh }: {
  topology: string
  efficiencyMapResult: unknown
  efficiencyMapLoading: boolean
  onRefresh: () => void
}): React.ReactElement {
  return (
    <div className={styles.toolbar}>
      <button className={styles.refreshBtn} onClick={onRefresh}
        disabled={efficiencyMapLoading} title="Compute efficiency across the full Vin × Iout space">
        {efficiencyMapLoading ? '⏳ Computing…' : '↻ Refresh Map'}
      </button>
      {!efficiencyMapResult && !efficiencyMapLoading && (
        <span className={styles.hint}>Click Refresh Map to compute the 10×10 operating grid.</span>
      )}
      {!LOSS_MODEL_TOPOLOGIES.has(topology) && (
        <span className={styles.noModelNote}>
          {topology} uses a fixed target efficiency — map will be uniform until a loss model is added.
        </span>
      )}
    </div>
  )
}

/** Four-row hover tooltip showing Vin, Iout, η, and loss. */
function HoverTooltip({ info }: { info: HoverInfo }): React.ReactElement {
  const rows: [string, string][] = [
    ['Vin',  `${info.vin.toFixed(1)} V`],
    ['Iout', `${info.iout.toFixed(2)} A`],
    ['η',    `${(info.eff * 100).toFixed(1)} %`],
    ['Loss', `${info.lossW.toFixed(2)} W`],
  ]
  return (
    <div className={styles.tooltip} style={{ left: info.x + 14, top: info.y - 8 }}>
      {rows.map(([label, value]) => (
        <div key={label} className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  )
}

/** Efficiency heatmap: refresh button, colour-coded SVG grid, and hover tooltip. */
export function EfficiencyMap(): React.ReactElement {
  const svgRef   = useRef<SVGSVGElement>(null)
  const drawRef  = useRef<DrawParams | null>(null)
  const spec                 = useDesignStore((s) => s.spec)
  const topology             = useDesignStore((s) => s.topology)
  const efficiencyMapResult  = useDesignStore((s) => s.efficiencyMapResult)
  const efficiencyMapLoading = useDesignStore((s) => s.efficiencyMapLoading)
  const requestEfficiencyMap = useDesignStore((s) => s.requestEfficiencyMap)
  const [hover, setHover]    = useState<HoverInfo | null>(null)

  useEffect(() => {
    if (!svgRef.current || !efficiencyMapResult) return
    drawRef.current = drawHeatmap(svgRef.current, efficiencyMapResult, spec)
  }, [efficiencyMapResult, spec])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const params = drawRef.current
    if (!params || !efficiencyMapResult) return
    const { margin, cellW, cellH, data } = params
    const rect = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left - margin.left
    const my = e.clientY - rect.top  - margin.top
    const N  = 10
    const vi = Math.floor(mx / cellW), ii = N - 1 - Math.floor(my / cellH)
    if (outOfBounds(vi, ii, N)) { setHover(null); return }
    const eff  = data.matrix[vi][ii]
    const pout = spec.vout * data.ioutPoints[ii]
    setHover({ vin: data.vinPoints[vi], iout: data.ioutPoints[ii], eff, lossW: computeLoss(eff, pout),
      x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [efficiencyMapResult, spec])

  return (
    <div className={styles.wrapper}>
      <MapToolbar topology={topology} efficiencyMapResult={efficiencyMapResult}
        efficiencyMapLoading={efficiencyMapLoading} onRefresh={requestEfficiencyMap} />

      <div className={styles.svgWrap}>
        {efficiencyMapLoading && (
          <div className={styles.loadingOverlay}>
            <span className={styles.spinner} />Computing 100 operating points…
          </div>
        )}
        <svg ref={svgRef} className={styles.svg}
          onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)} />
        {hover && <HoverTooltip info={hover} />}
      </div>
    </div>
  )
}
