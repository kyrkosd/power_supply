import React, { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useDesignStore } from '../../store/design-store';
import { runTransientSimulation } from '../../engine/transient';
import { buckTopology } from '../../engine/topologies/buck';
import type { TransientMode } from '../../engine/topologies/types';

const TransientChart: React.FC<{ title: string, unit: string, time: Float64Array, value: Float64Array, color: string }> = ({ title, unit, time, value, color }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !time || time.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800, height = 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Downsample dataset so D3 doesn't choke on 40,000 nodes (~1-2 points per screen pixel is max visual fidelity)
    const stride = Math.max(1, Math.ceil(time.length / 2000));
    const plotData: [number, number][] = [];
    for (let i = 0; i < time.length; i += stride) plotData.push([time[i], value[i]]);

    const x = d3.scaleLinear().domain([0, d3.max(time) || 0]).range([0, innerWidth]);
    const yMin = Math.min(0, d3.min(value) || 0); // Include 0
    const y = d3.scaleLinear().domain([yMin, d3.max(value) || 0]).nice().range([innerHeight, 0]);

    g.append('g').attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat(d => `${((d as number) * 1000).toFixed(1)}ms`))
      .attr('color', '#9ca3af');

    g.append('g').call(d3.axisLeft(y).ticks(5)).attr('color', '#9ca3af');

    const line = d3.line<[number, number]>().x(d => x(d[0])).y(d => y(d[1]));

    g.append('path').datum(plotData).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5).attr('d', line);
    
    svg.append('text').attr('x', margin.left).attr('y', margin.top - 5)
      .style('fill', '#e5e7eb').style('font-size', '12px').text(`${title} (${unit})`);
  }, [time, value, title, unit, color]);

  return <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 800 200`} preserveAspectRatio="xMidYMid meet" />;
};

export const TransientView: React.FC = () => {
  const { spec, result, topology, transientResult, setTransientResult } = useDesignStore(state => ({
    spec: state.spec, result: state.result, topology: state.topology,
    transientResult: state.transientResult, setTransientResult: state.setTransientResult
  }));
  
  const [mode, setMode] = useState<TransientMode>('startup');

  const handleRun = () => {
    if (!result || topology !== 'buck') return;
    if (!buckTopology.getStateSpaceModel) return;
    
    // Math block execution is 1-5ms, unnoticeable frame drop without explicit workers.
    const res = runTransientSimulation(spec, result, mode, buckTopology.getStateSpaceModel);
    setTransientResult(res);
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto bg-gray-900 text-gray-200 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">Transient Explorer</h1>
          <select value={mode} onChange={e => setMode(e.target.value as TransientMode)} className="bg-gray-800 border border-gray-700 text-sm rounded p-2">
            <option value="startup">Startup & Soft-Start</option>
            <option value="load-step">Load Step (50% &rarr; 100%)</option>
            <option value="line-step">Line Step (Min Vin &rarr; Max Vin)</option>
          </select>
        </div>
        <button onClick={handleRun} disabled={topology !== 'buck' || !result} className="px-4 py-2 font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed">
          Run Simulation
        </button>
      </div>

      {topology !== 'buck' && <div className="p-4 text-amber-400 bg-amber-500/20 border border-amber-500 rounded">Transient analysis is currently in active development and only available for Buck topology.</div>}

      {!transientResult && topology === 'buck' && (
        <div className="flex flex-1 items-center justify-center text-gray-500">Select a mode and click "Run Simulation".</div>
      )}

      {transientResult && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-800 p-4 border border-gray-700 rounded"><div className="text-gray-400 text-xs">Peak Inrush Current</div><div className="text-xl font-bold text-amber-400">{transientResult.metrics.peak_inrush_A.toFixed(2)} A</div></div>
            <div className="bg-gray-800 p-4 border border-gray-700 rounded"><div className="text-gray-400 text-xs">Settling Time (2% band)</div><div className="text-xl font-bold text-cyan-400">{transientResult.metrics.settling_time_ms.toFixed(2)} ms</div></div>
            <div className="bg-gray-800 p-4 border border-gray-700 rounded"><div className="text-gray-400 text-xs">Voltage Overshoot</div><div className="text-xl font-bold text-red-400">{transientResult.metrics.overshoot_pct.toFixed(2)} %</div></div>
          </div>
          <div className="flex flex-col space-y-4">
            <div className="bg-gray-800 border border-gray-700 rounded"><TransientChart title="Output Voltage (Vout)" unit="V" time={transientResult.time} value={transientResult.vout} color="#22d3ee" /></div>
            <div className="bg-gray-800 border border-gray-700 rounded"><TransientChart title="Inductor Current (IL)" unit="A" time={transientResult.time} value={transientResult.iL} color="#f59e0b" /></div>
            <div className="bg-gray-800 border border-gray-700 rounded"><TransientChart title="Duty Cycle (D)" unit="%" time={transientResult.time} value={transientResult.duty} color="#22c55e" /></div>
          </div>
        </>
      )}
    </div>
  );
};