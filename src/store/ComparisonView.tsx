import React, { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useDesignStore } from '../../store/design-store';
import { generateBuckNetlist } from '../../engine/ltspice/netlist-generator';
import { parseRawFile, parseLogFile, resampleWaveforms } from '../../engine/ltspice/output-parser';
import { compareWaveforms, type ComparisonResult } from '../../engine/ltspice/waveform-comparator';

type SimStatus = 'idle' | 'running' | 'complete' | 'error';

interface PairedChartProps {
  title: string;
  unit: string;
  time: Float64Array;
  analytical: Float64Array;
  simulated: Float64Array;
  delta: Float64Array;
}

const PairedChart: React.FC<PairedChartProps> = ({ title, unit, time, analytical, simulated, delta }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !time || time.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 600, height = 300;
    const margin = { top: 30, right: 40, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const deltaHeight = innerHeight * 0.25;
    const mainHeight = innerHeight * 0.75 - 10;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain(d3.extent(time) as [number, number]).range([0, innerWidth]);
    const yMax = Math.max(d3.max(analytical) || 0, d3.max(simulated) || 0);
    const yMin = Math.min(d3.min(analytical) || 0, d3.min(simulated) || 0);
    const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([mainHeight, 0]);
    const yDelta = d3.scaleLinear().domain(d3.extent(delta) as [number, number]).nice().range([mainHeight + deltaHeight, mainHeight + 10]);

    g.append('g').attr('transform', `translate(0,${mainHeight})`).call(d3.axisBottom(x).ticks(5).tickFormat(d => `${(d as number) * 1e6}µs`)).attr('color', '#9ca3af');
    g.append('g').call(d3.axisLeft(y).ticks(4)).attr('color', '#9ca3af');
    g.append('text').attr('transform', 'rotate(-90)').attr('y', -margin.left + 15).attr('x', -mainHeight / 2).attr('dy', '1em').style('text-anchor', 'middle').style('fill', '#9ca3af').text(unit);

    g.append('g').call(d3.axisLeft(yDelta).ticks(3)).attr('color', '#9ca3af');
    g.append('text').attr('transform', 'rotate(-90)').attr('y', -margin.left + 15).attr('x', -(mainHeight + deltaHeight / 2 + 5)).attr('dy', '1em').style('text-anchor', 'middle').style('fill', '#9ca3af').text(`Δ ${unit}`);

    const line = (data: Float64Array) => d3.line<number>().x((_, i) => x(time[i])).y(d => y(d))(Array.from(data));
    const deltaLine = d3.line<number>().x((_, i) => x(time[i])).y(d => yDelta(d))(Array.from(delta));

    g.append('path').attr('fill', 'none').attr('stroke', '#22d3ee').attr('stroke-width', 1.5).attr('d', line(analytical));
    g.append('path').attr('fill', 'none').attr('stroke', '#f59e0b').attr('stroke-width', 1.5).attr('d', line(simulated));
    g.append('path').attr('fill', 'none').attr('stroke', '#ef4444').attr('stroke-width', 1.5).attr('d', deltaLine);

    svg.append('text').attr('x', width / 2).attr('y', margin.top - 10).attr('text-anchor', 'middle').style('fill', '#e5e7eb').style('font-size', '16px').text(title);

  }, [time, analytical, simulated, delta, title, unit]);

  return <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} />;
};

export const ComparisonView: React.FC = () => {
  const { spec, result, waveforms, topology } = useDesignStore(state => ({
    spec: state.spec, result: state.result, waveforms: state.waveforms, topology: state.topology,
  }));
  const [status, setStatus] = useState<SimStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);

  const handleRunComparison = async () => {
    if (!result || !waveforms || topology !== 'buck') {
      setError('Comparison is currently only available for a valid Buck topology design.');
      setStatus('error');
      return;
    }
    setStatus('running');
    setError(null);
    setComparisonResult(null);

    try {
      const ascContent = generateBuckNetlist(spec, result);
      const res = await window.electron.ipcRenderer.invoke('ltspice:run-comparison', ascContent);

      if (!res.success) throw new Error(res.error);

      const simulatedRaw = parseRawFile(res.rawContent);
      const simulatedMetrics = parseLogFile(res.logContent);
      const simulatedWf = resampleWaveforms(simulatedRaw, waveforms.time);
      
      const comparison = compareWaveforms(result, waveforms, simulatedWf, simulatedMetrics);
      setComparisonResult(comparison);
      setStatus('complete');
    } catch (e: any) {
      setError(e.message);
      setStatus('error');
    }
  };

  const renderMetrics = () => {
    if (!comparisonResult) return null;
    const { metrics } = comparisonResult;
    const format = (val: number) => (val > 0 ? '+' : '') + val.toFixed(2);
    const color = (val: number) => Math.abs(val) > 10 ? 'text-red-400' : Math.abs(val) > 5 ? 'text-amber-400' : 'text-green-400';

    return (
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="p-4 bg-gray-800 rounded">
          <div className="text-sm text-gray-400">Efficiency Delta</div>
          <div className={`text-2xl font-bold ${color(metrics.efficiency_delta_pct)}`}>{format(metrics.efficiency_delta_pct)}%</div>
        </div>
        <div className="p-4 bg-gray-800 rounded">
          <div className="text-sm text-gray-400">Ripple Delta</div>
          <div className={`text-2xl font-bold ${color(metrics.ripple_delta_pct)}`}>{format(metrics.ripple_delta_pct)}%</div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto bg-gray-900 text-gray-200 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">LTspice Comparison</h1>
        <button
          onClick={handleRunComparison}
          disabled={status === 'running' || topology !== 'buck'}
          className="px-4 py-2 font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {status === 'running' ? 'Simulating...' : 'Run LTspice Comparison'}
        </button>
      </div>
      {topology !== 'buck' && <div className="p-4 text-amber-400 bg-amber-500/20 border border-amber-500 rounded">LTspice export is currently only supported for the Buck topology.</div>}
      
      {status === 'idle' && <div className="flex items-center justify-center h-64 text-gray-500">Click "Run LTspice Comparison" to start.</div>}
      {status === 'running' && <div className="flex items-center justify-center h-64 text-gray-400">Running LTspice simulation... This may take up to a minute.</div>}
      {status === 'error' && <div className="p-4 text-red-400 bg-red-500/20 border border-red-500 rounded"><strong>Error:</strong> {error}</div>}
      
      {status === 'complete' && comparisonResult && (
        <>
          {renderMetrics()}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-2 bg-gray-800 rounded border border-gray-700">
              <PairedChart title="Inductor Current (IL)" unit="A" time={comparisonResult.analytical.time} analytical={comparisonResult.analytical.inductor_current} simulated={comparisonResult.simulated.inductor_current} delta={comparisonResult.delta.il} />
            </div>
            <div className="p-2 bg-gray-800 rounded border border-gray-700">
              <PairedChart title="Switch Node (Vsw)" unit="V" time={comparisonResult.analytical.time} analytical={comparisonResult.analytical.switch_node} simulated={comparisonResult.simulated.switch_node} delta={comparisonResult.delta.vsw} />
            </div>
            <div className="p-2 bg-gray-800 rounded border border-gray-700 lg:col-span-2">
              <PairedChart title="Output Ripple (AC)" unit="V" time={comparisonResult.analytical.time} analytical={comparisonResult.analytical.output_ripple} simulated={comparisonResult.simulated.output_ripple} delta={comparisonResult.delta.ripple} />
            </div>
          </div>
          <div className="flex justify-center space-x-6 text-sm">
              <div className="flex items-center"><div className="w-4 h-1 bg-[#22d3ee] mr-2"></div>Analytical Model</div>
              <div className="flex items-center"><div className="w-4 h-1 bg-[#f59e0b] mr-2"></div>LTspice Simulation</div>
              <div className="flex items-center"><div className="w-4 h-1 bg-[#ef4444] mr-2"></div>Difference (Sim - An)</div>
          </div>
        </>
      )}
    </div>
  );
};

export default ComparisonView;