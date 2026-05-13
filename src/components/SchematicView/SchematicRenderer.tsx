import React from 'react'
import type { SchematicComponent, SchematicWire, SchematicDefinition } from './schematic-types'
import { STATUS_STROKES, TEXT_COLOR, MUTED_TEXT, LINE_COLOR } from './schematic-types'
import styles from './SchematicView.module.css'

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Renders the label, value text, and optional SVG title tooltip for any component. */
function labelGroup(c: SchematicComponent): React.ReactElement {
  return (
    <>
      <text x={c.x + c.width / 2} y={c.y - 6}             fill={TEXT_COLOR} fontSize={12} fontWeight={700} textAnchor="middle">{c.label}</text>
      <text x={c.x + c.width / 2} y={c.y + c.height + 16} fill={MUTED_TEXT} fontSize={11} textAnchor="middle">{c.value}</text>
      {c.meta && <title>{c.meta}</title>}
    </>
  )
}

/** Draws the MOSFET body: bounding rect, channel, S/D taps, gate pin, and directional arrow. */
function mosfetSymbol(cx: number, cy: number, cw: number, ch: number, s: string): React.ReactElement {
  return (
    <>
      <rect x={cx} y={cy} width={cw} height={ch} rx={12} stroke={s} strokeWidth={2} fill="none" />
      <line x1={cx + cw / 2}  y1={cy + 18}     x2={cx + cw / 2}    y2={cy + ch - 18} stroke={s} strokeWidth={2} />
      <polyline points={`${cx + 18},${cy + 38} ${cx + cw - 18},${cy + 38}`}           fill="none" stroke={s} strokeWidth={2} />
      <line x1={cx + 18}      y1={cy + 84}     x2={cx + cw - 18}   y2={cy + 84}      stroke={s} strokeWidth={2} />
      <line x1={cx + cw + 6}  y1={cy + 28}     x2={cx + cw + 24}   y2={cy + 28}      stroke={s} strokeWidth={2} />
      <line x1={cx + cw + 6}  y1={cy + 86}     x2={cx + cw + 24}   y2={cy + 86}      stroke={s} strokeWidth={2} />
      <path d={`M ${cx+cw+24} ${cy+28} L ${cx+cw+24} ${cy+86}`}                       stroke={s} strokeWidth={2} fill="none" />
      <path d={`M ${cx+cw+18} ${cy+46} L ${cx+cw+24} ${cy+28} L ${cx+cw+30} ${cy+46}`} fill="none" stroke={s} strokeWidth={2} />
    </>
  )
}

// ── Per-type SVG renderers ────────────────────────────────────────────────────

function renderSource(c: SchematicComponent, s: string): React.ReactElement {
  return (
    <g key={c.id}>
      <rect x={c.x} y={c.y} width={c.width} height={c.height} rx={12} stroke={s} strokeWidth={2} fill="none" />
      <line x1={c.x + 24} y1={c.y + 18} x2={c.x + 24} y2={c.y + 50} stroke={s} strokeWidth={2} />
      <line x1={c.x + 50} y1={c.y + 34} x2={c.x + 50} y2={c.y + 74} stroke={s} strokeWidth={2} />
      {labelGroup(c)}
    </g>
  )
}

function renderSwitch(c: SchematicComponent, s: string): React.ReactElement {
  return (
    <g key={c.id}>
      {mosfetSymbol(c.x, c.y, c.width, c.height, s)}
      {labelGroup(c)}
    </g>
  )
}

function renderDiode(c: SchematicComponent, s: string): React.ReactElement {
  return (
    <g key={c.id}>
      <path d={`M ${c.x+16} ${c.y+c.height/2} L ${c.x+c.width-16} ${c.y+20} L ${c.x+c.width-16} ${c.y+c.height-20} Z`} fill="none" stroke={s} strokeWidth={2} />
      <line x1={c.x+c.width-16} y1={c.y+20}          x2={c.x+c.width-16} y2={c.y+c.height-20} stroke={s} strokeWidth={2} />
      <line x1={c.x+14}         y1={c.y+12}          x2={c.x+14}         y2={c.y+c.height-12} stroke={s} strokeWidth={2} />
      {labelGroup(c)}
    </g>
  )
}

function renderInductor(c: SchematicComponent, s: string): React.ReactElement {
  return (
    <g key={c.id}>
      <path d={`M ${c.x} ${c.y+c.height/2} h 8 q 6 -28 16 0 q 6 -28 16 0 q 6 -28 16 0 q 6 -28 16 0 h 8`} fill="none" stroke={s} strokeWidth={2} />
      {labelGroup(c)}
    </g>
  )
}

function renderCapacitor(c: SchematicComponent, s: string): React.ReactElement {
  const mid = c.y + c.height / 2
  return (
    <g key={c.id}>
      <line x1={c.x+14}         y1={c.y+12}  x2={c.x+14}         y2={c.y+c.height-12} stroke={s} strokeWidth={2} />
      <line x1={c.x+c.width-14} y1={c.y+12}  x2={c.x+c.width-14} y2={c.y+c.height-12} stroke={s} strokeWidth={2} />
      <line x1={c.x+14}         y1={mid}      x2={c.x+c.width-14} y2={mid}              stroke={s} strokeWidth={2} />
      {labelGroup(c)}
    </g>
  )
}

function renderResistor(c: SchematicComponent, s: string): React.ReactElement {
  const mid = c.y + c.height / 2
  return (
    <g key={c.id}>
      <polyline
        points={`${c.x} ${mid} ${c.x+10} ${c.y+18} ${c.x+24} ${c.y+c.height-18} ${c.x+38} ${c.y+18} ${c.x+52} ${c.y+c.height-18} ${c.x+66} ${c.y+18} ${c.x+c.width} ${mid}`}
        fill="none" stroke={s} strokeWidth={2}
      />
      {labelGroup(c)}
    </g>
  )
}

function renderGround(c: SchematicComponent, s: string): React.ReactElement {
  return (
    <g key={c.id}>
      <line x1={c.x}      y1={c.y}      x2={c.x}      y2={c.y+14} stroke={s} strokeWidth={2} />
      <line x1={c.x - 14} y1={c.y + 14} x2={c.x + 14} y2={c.y+14} stroke={s} strokeWidth={2} />
      <line x1={c.x - 10} y1={c.y + 18} x2={c.x + 10} y2={c.y+18} stroke={s} strokeWidth={2} />
      <line x1={c.x - 6}  y1={c.y + 22} x2={c.x + 6}  y2={c.y+22} stroke={s} strokeWidth={2} />
    </g>
  )
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

type Renderer = (c: SchematicComponent, stroke: string) => React.ReactElement

/** Maps each component type to its dedicated SVG renderer — avoids a switch branch for every call. */
const RENDERERS: Record<SchematicComponent['type'], Renderer> = {
  source:    renderSource,
  switch:    renderSwitch,
  diode:     renderDiode,
  inductor:  renderInductor,
  capacitor: renderCapacitor,
  resistor:  renderResistor,
  ground:    renderGround,
}

function renderComponent(c: SchematicComponent): React.ReactElement | null {
  return RENDERERS[c.type]?.(c, STATUS_STROKES[c.status]) ?? null
}

function renderWire(wire: SchematicWire): React.ReactElement {
  const pts    = wire.points.map((p) => `${p.x},${p.y}`).join(' ')
  const stroke = wire.status ? STATUS_STROKES[wire.status] : LINE_COLOR
  return <polyline key={wire.id} points={pts} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
}

// ── SVG container ─────────────────────────────────────────────────────────────

export function SchematicRenderer({ definition, viewBox = '0 0 860 320' }: { definition: SchematicDefinition; viewBox?: string }): React.ReactElement {
  return (
    <svg viewBox={viewBox} className={styles.diagram} preserveAspectRatio="xMidYMid meet" data-export-id="schematic">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" />
        </marker>
      </defs>
      <g>
        {definition.wires.map(renderWire)}
        <path d="M 102 40 L 760 40" stroke="#60a5fa" strokeWidth={2} fill="none" markerEnd="url(#arrow)" />
        <text x={430} y={30} fill="#60a5fa" fontSize={12} fontWeight={600} textAnchor="middle">Vin → Vout</text>
      </g>
      {definition.components.map(renderComponent)}
      {definition.nodes.map((n) => <circle key={n.id} cx={n.x} cy={n.y} r={2} fill={LINE_COLOR} />)}
    </svg>
  )
}
