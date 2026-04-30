import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useDesignStore } from '../../store/design-store';
import { estimateEMI } from '../../engine/emi';
import type { EMIResult, EMIHarmonic } from '../../engine/topologies/types';

const EMISpectrumChart: React.FC<{ data: EMIResult }> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data || data.harmonics.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800, height = 300;
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLog().domain([150e3, 30e6]).range([0, innerWidth]);
    const y = d3.scaleLinear().domain([0, 120]).nice().range([innerHeight, 0]);

    // Class B Limit Path
    const classBPath = [
      [150e3, 66], [500e3, 56], [5e6, 56], [5e6, 60], [30e6, 60]
    ];

    // Class A Limit Path
    const classAPath = [
      [150e3, 79], [500e3, 79], [500e3, 73], [30e6, 73]
    ];

    const lineGen = d3.line<number[]>()
      .x(d => x(d[0]))
      .y(d => y(d[1]));

    // Render X Axis
    const xAxis = d3.axisBottom(x)
      .tickValues([150e3, 500e3, 1e6, 5e6, 10e6, 30e6])
      .tickFormat(d => {
        const val = d as number;
        return val >= 1e6 ? `${val / 1e6}M` : `${val / 1e3}k`;
      });
    
    g.append('g').attr('transform', `translate(0,${innerHeight})`).call(xAxis).attr('color', '#9ca3af');
    g.append('g').call(d3.axisLeft(y).ticks(6)).attr('color', '#9ca3af');

    // Gridlines
    g.append('g').attr('class', 'grid').attr('opacity', 0.1)
      .call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(() => ''));

    // Harmonics
    g.selectAll('.harmonic')
      .data(data.harmonics)
      .enter()
      .append('line')
      .attr('x1', (d: EMIHarmonic) => x(d.frequency))
      .attr('x2', (d: EMIHarmonic) => x(d.frequency))
      .attr('y1', y(0))
      .attr('y2', (d: EMIHarmonic) => y(Math.max(0, d.amplitude_dbuv)))
      .attr('stroke', (d: EMIHarmonic) => d.margin_db < 0 ? '#ef4444' : '#22d3ee') // Red if fail, Cyan if pass
      .attr('stroke-width', 2);

    // Draw limits last so they appear on top
    g.append('path').datum(classBPath).attr('fill', 'none').attr('stroke', '#ef4444').attr('stroke-width', 2).attr('d', lineGen);
    g.append('path').datum(classAPath).attr('fill', 'none').attr('stroke', '#f59e0b').attr('stroke-width', 2).attr('stroke-dasharray', '5,5').attr('d', lineGen);

    // Axes Labels
    svg.append('text').attr('transform', 'rotate(-90)').attr('y', margin.left - 40).attr('x', -margin.top - innerHeight / 2).attr('dy', '1em').style('text-anchor', 'middle').style('fill', '#9ca3af').text('Amplitude (dBµV)');
    svg.append('text').attr('x', margin.left + innerWidth / 2).attr('y', height - 5).attr('text-anchor', 'middle').style('fill', '#9ca3af').text('Frequency (Hz)');

  }, [data]);

  return <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet" />;
};

export const EMIView: React.FC = () => {
  const { spec, result, topology, emiResult, setEmiResult } = useDesignStore(state => ({
    spec: state.spec, result: state.result, topology: state.topology,
    emiResult: state.emiResult, setEmiResult: state.setEmiResult
  }));

  const handleRun = () => {
    if (!result) return;
    // Executes synchronously—negligible loop complexity (30M/100k = ~300 iterations). 
    const res = estimateEMI(topology, spec, result);
    setEmiResult(res);
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto bg-gray-900 text-gray-200 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Conducted EMI Estimator</h1>
        <button onClick={handleRun} disabled={!result} className="px-4 py-2 font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed">
          Estimate Spectrum
        </button>
      </div>

      {!emiResult ? (
        <div className="flex flex-1 items-center justify-center text-gray-500">Calculate steady-state first, then click "Estimate Spectrum".</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 p-4 border border-gray-700 rounded"><div className="text-gray-400 text-xs">Worst Margin (Class B)</div><div className={`text-xl font-bold ${emiResult.worst_margin_db < 0 ? 'text-red-400' : 'text-green-400'}`}>{emiResult.worst_margin_db.toFixed(1)} dB</div></div>
            <div className="bg-gray-800 p-4 border border-gray-700 rounded"><div className="text-gray-400 text-xs">First Failing Harmonic</div><div className="text-xl font-bold text-gray-200">{emiResult.first_failing_harmonic ? `${(emiResult.first_failing_harmonic / 1e6).toFixed(2)} MHz` : 'None'}</div></div>
            <div className="bg-gray-800 p-4 border border-gray-700 rounded col-span-2 md:col-span-1"><div className="text-gray-400 text-xs">Suggested Input Filter</div><div className="text-sm font-bold text-cyan-400 mt-1">{emiResult.suggested_filter ? `Lf = ${emiResult.suggested_filter.Lf_uH.toFixed(2)} µH, Cf = ${emiResult.suggested_filter.Cf_uF.toFixed(2)} µF` : 'Not required'}</div></div>
          </div>
          <div className="bg-gray-800 p-4 border border-gray-700 rounded min-h-[350px]">
            <EMISpectrumChart data={emiResult} />
          </div>
          <div className="flex space-x-6 text-sm justify-center"><div className="flex items-center"><div className="w-4 h-1 bg-[#ef4444] mr-2"></div>CISPR 32 Class B</div><div className="flex items-center"><div className="w-4 h-1 border-t-2 border-dashed border-[#f59e0b] mr-2"></div>CISPR 32 Class A</div></div>
        </>
      )}
    </div>
  );
};