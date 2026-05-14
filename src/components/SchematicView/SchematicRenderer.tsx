import React from 'react'
import type { SchematicComponent, SchematicDefinition } from './schematic-types'
import { STATUS_STROKES, LINE_COLOR } from './schematic-types'
import styles from './SchematicView.module.css'
import { renderSource, renderSwitch, renderDiode } from './symbols/active'
import { renderInductor, renderCapacitor, renderResistor, renderGround, renderWire } from './symbols/passive'

type Renderer = (c: SchematicComponent, stroke: string) => React.ReactElement

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
