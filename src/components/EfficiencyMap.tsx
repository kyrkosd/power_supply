import React, { useMemo, useState } from 'react';
import { flybackTopology } from '../engine/topologies/flyback';
import type { DesignSpec } from '../engine/types';
import type { OutputSpec } from './MultiOutputTable';

interface EfficiencyMapProps {
  spec: DesignSpec;
  componentSelection?: unknown;
}

interface HeatmapPoint {
  vin: number;
  iout: number;
  efficiency: number;
  dominantLoss: string;
  dominantLossVal: number;
  totalLoss: number;
}

const STEPS = 15;

/**
 * Maps an efficiency value to a Diverging Color Scale:
 * Red (< 80%), Yellow (~85%), Green (> 92%)
 */
function getEfficiencyColor(eff: number): string {
  let hue = 0;
  if (eff < 0.80) {
    hue = 0; // Red
  } else if (eff < 0.85) {
    // Interpolate Red (0) to Yellow (60)
    hue = 60 * ((eff - 0.80) / 0.05);
  } else if (eff < 0.92) {
    // Interpolate Yellow (60) to Green (120)
    hue = 60 + 60 * ((eff - 0.85) / 0.07);
  } else {
    hue = 120; // Green
  }
  return `hsl(${hue}, 80%, 45%)`;
}

export const EfficiencyMap: React.FC<EfficiencyMapProps> = ({ spec, componentSelection }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: HeatmapPoint } | null>(null);

  // 1. Generate Heatmap Matrix
  const matrix = useMemo(() => {
    const data: HeatmapPoint[][] = [];
    
    // Use nominal specs to establish ranges
    const vinNom = (spec.vinMin + spec.vinMax) / 2;
    const vinStart = vinNom * 0.8;
    const vinEnd = vinNom * 1.2;
    
    const ioutNom = spec.outputs ? spec.outputs[0]?.iOut : spec.iout;
    const ioutStart = ioutNom * 0.1;
    const ioutEnd = ioutNom * 1.0;

    for (let r = 0; r < STEPS; r++) {
      const row: HeatmapPoint[] = [];
      // Y-axis (Vin), rendering from highest to lowest
      const vin = vinEnd - (vinEnd - vinStart) * (r / (STEPS - 1));
      
      for (let c = 0; c < STEPS; c++) {
        // X-axis (Iout), rendering from lowest to highest
        const iout = ioutStart + (ioutEnd - ioutStart) * (c / (STEPS - 1));

        // Build temp spec for this point computation
        const tempSpec = { ...spec, vinMin: vin, vinMax: vin, iout: iout };
        if (tempSpec.outputs && tempSpec.outputs.length > 0) {
          tempSpec.outputs = tempSpec.outputs.map((out: OutputSpec, idx: number) =>
            idx === 0 ? { ...out, iOut: iout } : out
          );
        }

        // 2. Call compute engine to get losses & efficiency
        const result = flybackTopology.compute(tempSpec);
        
        let dominantLoss = 'Unknown';
        let dominantLossVal = 0;
        
        if (result.losses) {
          const conduction = result.losses.primaryCopper + result.losses.secondaryCopper;
          const switching = result.losses.mosfet + result.losses.diode + result.losses.clamp;
          const core = result.losses.core;

          if (conduction > switching && conduction > core) {
            dominantLoss = 'Conduction';
            dominantLossVal = conduction;
          } else if (switching > conduction && switching > core) {
            dominantLoss = 'Switching';
            dominantLossVal = switching;
          } else {
            dominantLoss = 'Core';
            dominantLossVal = core;
          }
        }

        row.push({
          vin,
          iout,
          efficiency: result.efficiency || 0,
          dominantLoss,
          dominantLossVal,
          totalLoss: result.losses?.total || 0
        });
      }
      data.push(row);
    }
    
    return data;
  }, [spec, componentSelection]);

  // SVG Grid Dimensions
  const svgSize = 400;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerWidth = svgSize - margin.left - margin.right;
  const innerHeight = svgSize - margin.top - margin.bottom;
  const cellWidth = innerWidth / STEPS;
  const cellHeight = innerHeight / STEPS;

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>, point: HeatmapPoint) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: bounds.left + bounds.width / 2,
      y: bounds.top - 10,
      data: point
    });
  };

  return (
    <div className="relative bg-gray-800 border border-gray-700 rounded-lg p-4 font-sans">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-bold text-gray-200">2D Efficiency Map</h2>
        <div className="flex items-center text-xs text-gray-400 gap-2">
          <span>&lt; 80%</span>
          <div className="w-16 h-2 rounded bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"></div>
          <span>&gt; 92%</span>
        </div>
      </div>

      <div className="flex justify-center items-center">
        <svg width={svgSize} height={svgSize} className="overflow-visible">
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Grid Cells */}
            {matrix.map((row, rIdx) =>
              row.map((point, cIdx) => (
                <rect
                  key={`${rIdx}-${cIdx}`}
                  x={cIdx * cellWidth}
                  y={rIdx * cellHeight}
                  width={cellWidth + 0.5} // slightly overlap to avoid sub-pixel gaps
                  height={cellHeight + 0.5}
                  fill={getEfficiencyColor(point.efficiency)}
                  onMouseMove={(e) => handleMouseMove(e, point)}
                  onMouseLeave={() => setTooltip(null)}
                  className="transition-opacity duration-150 hover:opacity-75 cursor-crosshair stroke-gray-900 stroke-[0.5px]"
                />
              ))
            )}

            {/* Y Axis Label */}
            <text x={-margin.left + 10} y={innerHeight / 2} transform={`rotate(-90, ${-margin.left + 10}, ${innerHeight / 2})`} className="fill-gray-400 text-xs text-center" textAnchor="middle">Vin (V)</text>
            <text x={-5} y={0} className="fill-gray-500 text-xs" textAnchor="end" alignmentBaseline="middle">{matrix[0][0].vin.toFixed(1)}</text>
            <text x={-5} y={innerHeight} className="fill-gray-500 text-xs" textAnchor="end" alignmentBaseline="middle">{matrix[STEPS - 1][0].vin.toFixed(1)}</text>

            {/* X Axis Label */}
            <text x={innerWidth / 2} y={innerHeight + margin.bottom - 5} className="fill-gray-400 text-xs" textAnchor="middle">Load Current (A)</text>
            <text x={0} y={innerHeight + 15} className="fill-gray-500 text-xs" textAnchor="middle">{matrix[0][0].iout.toFixed(2)}</text>
            <text x={innerWidth} y={innerHeight + 15} className="fill-gray-500 text-xs" textAnchor="middle">{matrix[0][STEPS - 1].iout.toFixed(2)}</text>
          </g>
        </svg>
      </div>

      {/* Absolute Tooltip Overlay */}
      {tooltip && (
        <div 
          className="fixed z-50 pointer-events-none bg-gray-900 border border-gray-600 text-gray-200 px-3 py-2 rounded shadow-lg text-sm transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-bold border-b border-gray-700 pb-1 mb-1">
            {tooltip.data.vin.toFixed(1)}V In @ {tooltip.data.iout.toFixed(2)}A Out
          </div>
          <div className="text-cyan-400 font-mono">Eff: {(tooltip.data.efficiency * 100).toFixed(1)}%</div>
          <div className="text-gray-400 mt-1 text-xs">Dom. Loss: <span className="text-amber-400">{tooltip.data.dominantLoss}</span></div>
          <div className="text-gray-500 text-xs font-mono">{tooltip.data.dominantLossVal.toFixed(3)} W ({((tooltip.data.dominantLossVal / tooltip.data.totalLoss) * 100).toFixed(0)}%)</div>
        </div>
      )}
    </div>
  );
};