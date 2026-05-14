// SVG → canvas → PNG capture for embedding live charts into the PDF report.
// Tab switching is done via the store action passed in, with a settle delay before each capture.

import type { ActiveVizTab } from '../../store/design-store'
import { CSS_VARS } from './constants'

export interface Capture { dataUrl: string; w: number; h: number }

const SETTLE_MS = 550
const SCALE     = 2
const BG_HEX    = '#1a1a2e'

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function serializeSvg(el: SVGSVGElement, w: number, h: number): string {
  const clone = el.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width',  String(w))
  clone.setAttribute('height', String(h))
  clone.setAttribute('xmlns',  'http://www.w3.org/2000/svg')
  let str = new XMLSerializer().serializeToString(clone)
  for (const [cssVar, hex] of CSS_VARS) str = str.split(cssVar).join(hex)
  return str
}

function rasterise(url: string, w: number, h: number): Promise<Capture | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(w * SCALE)
      canvas.height = Math.round(h * SCALE)
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = BG_HEX
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(SCALE, SCALE)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve({ dataUrl: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height })
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

/** Capture the DOM SVG at `selector` as a base-64 PNG suitable for jsPDF.addImage. */
export async function captureSvg(selector: string): Promise<Capture | null> {
  const el = document.querySelector(selector) as SVGSVGElement | null
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const w = rect.width  || el.clientWidth  || 800
  const h = rect.height || el.clientHeight || 400
  if (w === 0 || h === 0) return null

  const svgStr = serializeSvg(el, w, h)
  const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }))
  return rasterise(url, w, h)
}

async function switchAndCapture(
  setTab: (t: ActiveVizTab) => void, tab: ActiveVizTab, selector: string,
): Promise<Capture | null> {
  setTab(tab)
  await wait(SETTLE_MS)
  return captureSvg(selector)
}

export interface Charts {
  schematicImg: Capture | null
  waveformImg:  Capture | null
  bodeImg:      Capture | null
  lossBarImg:   Capture | null
  lossEffImg:   Capture | null
}

/** Capture every chart SVG in sequence, switching tabs as needed, then restore the original tab. */
export async function captureCharts(
  setActiveVizTab: (tab: ActiveVizTab) => void,
  currentTab: ActiveVizTab,
): Promise<Charts> {
  const schematicImg = await captureSvg('[data-export-id="schematic"]')
  const waveformImg  = await switchAndCapture(setActiveVizTab, 'waveforms', '[data-export-id="waveform-chart"]')
  const bodeImg      = await switchAndCapture(setActiveVizTab, 'bode',      '[data-export-id="bode-plot"]')
  setActiveVizTab('losses')
  await wait(SETTLE_MS)
  const lossBarImg = await captureSvg('[data-export-id="loss-bar"] svg')
  const lossEffImg = await captureSvg('[data-export-id="loss-eff"]')
  setActiveVizTab(currentTab)
  return { schematicImg, waveformImg, bodeImg, lossBarImg, lossEffImg }
}
