import React from 'react'
import type { SchematicComponent } from '../schematic-types'
import { TEXT_COLOR, MUTED_TEXT } from '../schematic-types'

export function labelGroup(c: SchematicComponent): React.ReactElement {
  return (
    <>
      <text x={c.x + c.width / 2} y={c.y - 6}             fill={TEXT_COLOR} fontSize={12} fontWeight={700} textAnchor="middle">{c.label}</text>
      <text x={c.x + c.width / 2} y={c.y + c.height + 16} fill={MUTED_TEXT} fontSize={11} textAnchor="middle">{c.value}</text>
      {c.meta && <title>{c.meta}</title>}
    </>
  )
}

export function mosfetSymbol(cx: number, cy: number, cw: number, ch: number, s: string): React.ReactElement {
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
