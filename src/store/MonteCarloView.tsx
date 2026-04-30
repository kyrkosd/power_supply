import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useDesignStore } from '../../store/design-store';
import type { MCDistribution } from '../../engine/monte-carlo';

interface HistogramProps {
  title: string;
  data: MCDistribution;
  limit: number;
  isUpperLimit: boolean;
  multiplier?: number;
  unit?: string;
}

const Histogram: React.FC<HistogramProps> = ({ title, data, limit, isUpperLimit, multiplier = 1, unit = '' }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data || data.values.length === 0 || Number.isNaN(data.mean)) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 400;
    const height = 250;
    const margin = { top: 30, right: 20, bottom: 40, left: 50 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const scaledMin = data.min * multiplier;
    const scaledMax = data.max * multiplier;
    const scaledLimit = limit * multiplier;

    // Pad the domain slightly to ensure the limit line isn't chopped off if it lies on extreme edges
    const domainSpan = scaledMax - scaledMin;
    const pad = domainSpan === 0 ? 1 : domainSpan * 0.05;
    const xMin = Math.min(scaledMin - pad, isUpperLimit ? scaledMin - pad : scaledLimit - pad);
    const xMax = Math.max(scaledMax + pad, isUpperLimit ? scaledLimit + pad : scaledMax + pad);

    const x = d3.scaleLinear()
      .domain([xMin, xMax])
      .range([0, innerWidth]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data.histogram, d => d.count) || 10])
      .nice()
      .range([innerHeight, 0]);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const binWidth = innerWidth / (data.histogram.length || 1);

    g.selectAll('rect')
      .data(data.histogram)
      .enter()
      .append('rect')
      .attr('x', d => x(d.bin_center * multiplier) - binWidth / 2)
      .attr('y', d => y(d.count))
      .attr('width', Math.max(1, binWidth * 0.9))
      .attr('height', d => Math.max(0, innerHeight - y(d.count)))
      .attr('fill', d => {
        const isFail = isUpperLimit ? d.bin_center > limit : d.bin_center < limit;
        return isFail ? '#ef4444' : '#22c55e'; // Tailwind red-500 : green-500
      });

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${d}${unit}`))
      .attr('color', '#9ca3af'); // Tailwind gray-400

    g.append('g')
      .call(d3.axisLeft(y).ticks(4))
      .attr('color', '#9ca3af');

    // Vertical Spec Limit Line
    g.append('line')
      .attr('x1', x(scaledLimit))
      .attr('x2', x(scaledLimit))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,4');

    // Title
    svg.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('fill', '#e5e7eb') // Tailwind gray-200
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text(title);

    // p5 and p95 text markers
    g.append('text')
      .attr('x', x(data.p5 * multiplier))
      .attr('y', innerHeight + 35)
      .attr('text-anchor', 'middle')
      .style('fill', '#9ca3af')
      .style('font-size', '10px')
      .text(`p5: ${(data.p5 * multiplier).toFixed(1)}`);

    g.append('text')
      .attr('x', x(data.p95 * multiplier))
      .attr('y', innerHeight + 35)
      .attr('text-anchor', 'middle')
      .style('fill', '#9ca3af')
      .style('font-size', '10px')
      .text(`p95: ${(data.p95 * multiplier).toFixed(1)}`);

  }, [data, limit, isUpperLimit, title, multiplier, unit]);

  if (!data || !data.values || data.values.length === 0 || Number.isNaN(data.mean)) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-800 rounded border border-gray-700">
        <span className="text-gray-500">No data for {title}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-800 rounded border border-gray-700">
      <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid meet" />
    </div>
  );
};

export const MonteCarloView: React.FC = () => {
  const mcResult = useDesignStore((state) => state.mcResult);
  const spec = useDesignStore((state) => state.spec);

  if (!mcResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <p className="text-lg">Click 'Run Monte Carlo' in the input panel.</p>
      </div>
    );
  }

  const passRate = mcResult.pass_rate * 100;
  const passes = Math.round(mcResult.pass_rate * mcResult.iterations);

  let bannerColor = 'bg-red-500/20 text-red-400 border-red-500';
  if (passRate > 95) bannerColor = 'bg-green-500/20 text-green-400 border-green-500';
  else if (passRate >= 80) bannerColor = 'bg-amber-500/20 text-amber-400 border-amber-500';

  const renderRow = (
    label: string, limit: number, mean: number, worst: number, isUpperLimit: boolean, unit: string, multiplier = 1
  ) => {
    if (Number.isNaN(mean)) return null;

    const margin = isUpperLimit ? limit - worst : worst - limit;
    const isViolated = margin < 0;

    return (
      <tr className="border-b border-gray-700 bg-gray-800 hover:bg-gray-750">
        <td className="px-4 py-3 font-medium text-gray-200">{label}</td>
        <td className="px-4 py-3">{(limit * multiplier).toFixed(2)}{unit}</td>
        <td className="px-4 py-3">{(mean * multiplier).toFixed(2)}{unit}</td>
        <td className={`px-4 py-3 font-bold ${isViolated ? 'text-red-400' : 'text-green-400'}`}>
          {(worst * multiplier).toFixed(2)}{unit}
        </td>
        <td className={`px-4 py-3 ${isViolated ? 'text-red-400' : 'text-gray-300'}`}>
          {(margin * multiplier).toFixed(2)}{unit}
        </td>
      </tr>
    );
  };

  const metrics = mcResult.metrics;

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto bg-gray-900 text-gray-200 space-y-6">
      {/* Pass Rate Banner */}
      <div className={`p-4 rounded border ${bannerColor} flex items-center justify-between`}>
        <div>
          <h2 className="text-2xl font-bold">{passRate.toFixed(1)}% Pass Rate</h2>
          <p>{passes} of {mcResult.iterations} iterations meet all design specs</p>
        </div>
      </div>

      {/* 2x2 Histogram Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-96 min-h-[500px]">
        <Histogram title="Efficiency" data={metrics.efficiency} limit={spec.efficiency} isUpperLimit={false} multiplier={100} unit="%" />
        <Histogram title="Output Ripple" data={metrics.output_ripple} limit={spec.voutRippleMax} isUpperLimit={true} multiplier={1000} unit="mV" />
        <Histogram title="Phase Margin" data={metrics.phase_margin} limit={45} isUpperLimit={false} unit="°" />
        <Histogram title="MOSFET Tj" data={metrics.tj_mosfet} limit={125} isUpperLimit={true} unit="°C" />
      </div>

      {/* Worst Case Table */}
      <div className="rounded border border-gray-700 overflow-hidden mt-6">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 bg-gray-800 uppercase border-b border-gray-700">
            <tr>
              <th className="px-4 py-3">Metric</th>
              <th className="px-4 py-3">Spec Limit</th>
              <th className="px-4 py-3">Nominal (Mean)</th>
              <th className="px-4 py-3">Worst Case</th>
              <th className="px-4 py-3">Margin</th>
            </tr>
          </thead>
          <tbody>
            {renderRow('Efficiency', spec.efficiency, metrics.efficiency.mean, metrics.efficiency.min, false, '%', 100)}
            {renderRow('Output Ripple', spec.voutRippleMax, metrics.output_ripple.mean, metrics.output_ripple.max, true, 'mV', 1000)}
            {renderRow('Phase Margin', 45, metrics.phase_margin.mean, metrics.phase_margin.min, false, '°', 1)}
            {renderRow('MOSFET Tj', 125, metrics.tj_mosfet.mean, metrics.tj_mosfet.max, true, '°C', 1)}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonteCarloView;