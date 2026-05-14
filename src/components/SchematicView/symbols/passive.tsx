import React from 'react'
import type { SchematicComponent } from '../schematic-types'
import { LINE_COLOR, STATUS_STROKES } from '../schematic-types'
import { labelGroup } from './helpers'

export function renderInductor(c: SchematicComponent, s: string): React.ReactElement {
  return (
    <g key={c.id}>
      <path d={`M ${c.x} ${c.y+c.height/2} h 8 q 6 -28 16 0 q 6 -28 16 0 q 6 -28 16 0 q 6 -28 16 0 h 8`} fill="none" stroke={s} strokeWidth={2} />
      {labelGroup(c)}
    </g>
  )
}

export function renderCapacitor(c: SchematicComponent, s: string): React.ReactElement {
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

export function renderResistor(c: SchematicComponent, s: string): React.ReactElement {
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

export function renderGround(c: SchematicComponent, s: string): React.ReactElement {
  return (
    <g key={c.id}>
      <line x1={c.x}      y1={c.y}      x2={c.x}      y2={c.y+14} stroke={s} strokeWidth={2} />
      <line x1={c.x - 14} y1={c.y + 14} x2={c.x + 14} y2={c.y+14} stroke={s} strokeWidth={2} />
      <line x1={c.x - 10} y1={c.y + 18} x2={c.x + 10} y2={c.y+18} stroke={s} strokeWidth={2} />
      <line x1={c.x - 6}  y1={c.y + 22} x2={c.x + 6}  y2={c.y+22} stroke={s} strokeWidth={2} />
    </g>
  )
}

export function renderWire(wire: import('../schematic-types').SchematicWire): React.ReactElement {
  const pts    = wire.points.map((p) => `${p.x},${p.y}`).join(' ')
  const stroke = wire.status ? STATUS_STROKES[wire.status] : LINE_COLOR
  return <polyline key={wire.id} points={pts} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
}
