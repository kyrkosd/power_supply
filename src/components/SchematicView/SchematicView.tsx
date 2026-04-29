import React, { useRef, useEffect } from 'react'
import { useWorkbenchStore } from '../../store/workbenchStore'
import styles from './SchematicView.module.css'

const TOPOLOGY_DESCRIPTIONS: Record<string, string> = {
  'buck':       'Non-isolated step-down converter. Switch → Inductor → Output.',
  'boost':      'Non-isolated step-up converter. Inductor → Switch → Output.',
  'buck-boost': 'Non-isolated inverting converter. Flexible Vin/Vout ratio.',
  'flyback':    'Isolated converter derived from buck-boost. Transformer-based.',
  'llc':        'Resonant isolated converter. High efficiency at resonant frequency.'
}

export function SchematicView(): React.ReactElement {
  const { topology } = useWorkbenchStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    drawPlaceholder(ctx, rect.width, rect.height, topology)
  }, [topology])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Schematic — {topology.toUpperCase()}</span>
        <span className={styles.badge}>placeholder</span>
      </div>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.description}>
        {TOPOLOGY_DESCRIPTIONS[topology]}
      </div>
    </div>
  )
}

function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  topology: string
): void {
  ctx.clearRect(0, 0, w, h)

  // Grid
  ctx.strokeStyle = 'rgba(42,42,66,0.6)'
  ctx.lineWidth = 1
  for (let x = 0; x < w; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = 0; y < h; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  // Centre label
  ctx.fillStyle = 'rgba(74,144,217,0.08)'
  ctx.fillRect(w * 0.1, h * 0.15, w * 0.8, h * 0.7)
  ctx.strokeStyle = 'rgba(74,144,217,0.25)'
  ctx.lineWidth = 1
  ctx.strokeRect(w * 0.1, h * 0.15, w * 0.8, h * 0.7)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(74,144,217,0.4)'
  ctx.font = `bold 28px 'Segoe UI', sans-serif`
  ctx.fillText(topology.toUpperCase(), w / 2, h / 2 - 14)

  ctx.fillStyle = 'rgba(148,148,176,0.4)'
  ctx.font = `14px 'Segoe UI', sans-serif`
  ctx.fillText('Schematic renderer coming soon', w / 2, h / 2 + 18)
}
