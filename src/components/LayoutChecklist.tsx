import React, { useMemo } from 'react'
import { calculateTraceWidth, getCriticalLoop, calculateCopperPour } from '../engine/pcb-rules'

interface LayoutChecklistProps {
  topology:      'buck' | 'boost' | 'flyback' | string
  primaryIrms:   number
  secondaryIrms: number
  mosfetPloss:   number
}

// ── Loop diagram ──────────────────────────────────────────────────────────────

const LoopDiagram: React.FC<{ topology: string }> = ({ topology }) => (
  <svg className="w-full h-40 bg-gray-900 border border-gray-700 rounded" viewBox="0 0 400 160">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
      </marker>
    </defs>

    {topology.toLowerCase() === 'buck' && (
      <g transform="translate(50, 30)">
        <rect x="0"   y="0" width="40" height="80" fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4" />
        <text x="20"  y="45" textAnchor="middle" fill="#9ca3af" fontSize="12">Cin</text>
        <rect x="100" y="0"  width="40" height="30" fill="none" stroke="#9ca3af" strokeWidth="2" />
        <text x="120" y="20" textAnchor="middle" fill="#9ca3af" fontSize="12">Q_hi</text>
        <rect x="100" y="50" width="40" height="30" fill="none" stroke="#9ca3af" strokeWidth="2" />
        <text x="120" y="70" textAnchor="middle" fill="#9ca3af" fontSize="12">D_lo</text>
        <path d="M 40 15 L 100 15 M 120 30 L 120 50 M 100 65 L 40 65" fill="none" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrow)" />
        <text x="170" y="45" fill="#ef4444" fontSize="14" fontWeight="bold">← High di/dt Loop</text>
      </g>
    )}

    {topology.toLowerCase() === 'boost' && (
      <g transform="translate(50, 30)">
        <rect x="0"   y="50" width="40" height="30" fill="none" stroke="#9ca3af" strokeWidth="2" />
        <text x="20"  y="70" textAnchor="middle" fill="#9ca3af" fontSize="12">Q_lo</text>
        <rect x="60"  y="0"  width="40" height="30" fill="none" stroke="#9ca3af" strokeWidth="2" />
        <text x="80"  y="20" textAnchor="middle" fill="#9ca3af" fontSize="12">D_out</text>
        <rect x="140" y="0"  width="40" height="80" fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4" />
        <text x="160" y="45" textAnchor="middle" fill="#9ca3af" fontSize="12">Cout</text>
        <path d="M 40 65 L 140 65 M 100 15 L 140 15 M 20 50 L 20 15 L 60 15" fill="none" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrow)" />
        <text x="200" y="45" fill="#ef4444" fontSize="14" fontWeight="bold">← High di/dt Loop</text>
      </g>
    )}

    {topology.toLowerCase() === 'flyback' && (
      <g transform="translate(20, 30)">
        <path d="M 20 10 L 80 10 L 80 80 L 20 80 Z"   fill="none" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrow)" />
        <text x="50"  y="45" textAnchor="middle" fill="#9ca3af" fontSize="12">Pri Loop</text>
        <path d="M 200 10 L 260 10 L 260 80 L 200 80 Z" fill="none" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrow)" />
        <text x="230" y="45" textAnchor="middle" fill="#9ca3af" fontSize="12">Sec Loop</text>
        <rect x="120" y="10" width="40" height="70" fill="none" stroke="#3b82f6" strokeWidth="2" />
        <text x="140" y="50" textAnchor="middle" fill="#3b82f6" fontSize="12">T1</text>
      </g>
    )}
  </svg>
)

// ── Sub-sections ──────────────────────────────────────────────────────────────

interface TraceWidthSectionProps {
  primaryIrms:   number
  secondaryIrms: number
}

const TraceWidthSection: React.FC<TraceWidthSectionProps> = ({ primaryIrms, secondaryIrms }) => {
  const priTrace = calculateTraceWidth(primaryIrms)
  const secTrace = calculateTraceWidth(secondaryIrms)
  return (
    <div className="mb-6">
      <h3 className="text-md font-semibold text-gray-300 mb-2">2. Minimum Trace Widths (IPC-2221)</h3>
      <p className="text-xs text-gray-500 mb-2">Based on 1 oz copper, external layer, 20 °C temp rise allowance.</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-700 p-3 rounded">
          <div className="text-xs text-gray-400 mb-1">Primary Power Path ({primaryIrms.toFixed(2)} A)</div>
          <div className="text-lg font-mono text-cyan-400">
            {priTrace.width_mm.toFixed(2)} mm{' '}
            <span className="text-sm text-gray-500">({priTrace.width_mils.toFixed(0)} mils)</span>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 p-3 rounded">
          <div className="text-xs text-gray-400 mb-1">Secondary Power Path ({secondaryIrms.toFixed(2)} A)</div>
          <div className="text-lg font-mono text-cyan-400">
            {secTrace.width_mm.toFixed(2)} mm{' '}
            <span className="text-sm text-gray-500">({secTrace.width_mils.toFixed(0)} mils)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const ThermalSection: React.FC<{ mosfetPloss: number }> = ({ mosfetPloss }) => {
  const copperPourArea = calculateCopperPour(mosfetPloss)
  return (
    <div>
      <h3 className="text-md font-semibold text-gray-300 mb-2">3. Thermal Management</h3>
      <div className="bg-gray-900 border border-gray-700 p-3 rounded flex items-center justify-between">
        <div className="text-sm text-gray-300">
          MOSFET Copper Pour Area
          <br />
          <span className="text-xs text-gray-500">
            For {mosfetPloss.toFixed(2)} W loss to maintain T_j &lt; 100 °C
          </span>
        </div>
        <div className="text-lg font-mono text-amber-400">
          {copperPourArea > 0 ? `${copperPourArea.toFixed(0)} mm²` : 'Not Required'}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export const LayoutChecklist: React.FC<LayoutChecklistProps> = ({
  topology,
  primaryIrms,
  secondaryIrms,
  mosfetPloss,
}) => {
  const criticalLoop = useMemo(() => getCriticalLoop(topology), [topology])

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 border border-gray-700 rounded p-4">
        <h2 className="text-lg font-bold text-gray-200 mb-4">Critical Layout Guidelines</h2>

        <div className="mb-6">
          <h3 className="text-md font-semibold text-gray-300 mb-2">1. High di/dt Loop (Top Priority)</h3>
          <p className="text-sm text-gray-400 mb-3">{criticalLoop.description}</p>
          <LoopDiagram topology={topology} />
          <ul className="mt-3 space-y-1">
            {criticalLoop.placementOrder.map((rule, idx) => (
              <li key={idx} className="text-sm text-gray-300 flex items-start">
                <span className="text-indigo-400 mr-2">➜</span> {rule}
              </li>
            ))}
          </ul>
        </div>

        <TraceWidthSection primaryIrms={primaryIrms} secondaryIrms={secondaryIrms} />
        <ThermalSection mosfetPloss={mosfetPloss} />
      </div>
    </div>
  )
}
