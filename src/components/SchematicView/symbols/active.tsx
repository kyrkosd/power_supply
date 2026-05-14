import React from 'react'
import type { SchematicComponent } from '../schematic-types'
import { labelGroup, mosfetSymbol } from './helpers'

export function renderSource(c: SchematicComponent, s: string): React.ReactElement {
  return (
    <g key={c.id}>
      <rect x={c.x} y={c.y} width={c.width} height={c.height} rx={12} stroke={s} strokeWidth={2} fill="none" />
      <line x1={c.x + 24} y1={c.y + 18} x2={c.x + 24} y2={c.y + 50} stroke={s} strokeWidth={2} />
      <line x1={c.x + 50} y1={c.y + 34} x2={c.x + 50} y2={c.y + 74} stroke={s} strokeWidth={2} />
      {labelGroup(c)}
    </g>
  )
}

export function renderSwitch(c: SchematicComponent, s: string): React.ReactElement {
  return (
    <g key={c.id}>
      {mosfetSymbol(c.x, c.y, c.width, c.height, s)}
      {labelGroup(c)}
    </g>
  )
}

export function renderDiode(c: SchematicComponent, s: string): React.ReactElement {
  return (
    <g key={c.id}>
      <path d={`M ${c.x+16} ${c.y+c.height/2} L ${c.x+c.width-16} ${c.y+20} L ${c.x+c.width-16} ${c.y+c.height-20} Z`} fill="none" stroke={s} strokeWidth={2} />
      <line x1={c.x+c.width-16} y1={c.y+20}          x2={c.x+c.width-16} y2={c.y+c.height-20} stroke={s} strokeWidth={2} />
      <line x1={c.x+14}         y1={c.y+12}          x2={c.x+14}         y2={c.y+c.height-12} stroke={s} strokeWidth={2} />
      {labelGroup(c)}
    </g>
  )
}
