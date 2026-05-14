import { axisBottom } from 'd3-axis'
import type { Selection } from 'd3-selection'
import type { ScaleLinear } from 'd3-scale'

type G = Selection<SVGGElement, unknown, null, undefined>

export function drawGridAndAxis(root: G, xScale: ScaleLinear<number, number>, N: number, rowH: number): void {
  root.append('g')
    .attr('transform', `translate(0,${N * rowH})`)
    .call(axisBottom(xScale).ticks(6).tickSize(-(N * rowH)).tickFormat(() => ''))
    .call((g) => {
      g.selectAll('line').attr('stroke', 'rgba(255,255,255,0.05)')
      g.select('.domain').remove()
    })

  const xGrp = root.append('g')
    .attr('transform', `translate(0,${N * rowH})`)
    .call(axisBottom(xScale).ticks(6).tickFormat((d) => `${(+d).toFixed(1)} ms`))
  xGrp.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '9px')
  xGrp.selectAll('line,path').attr('stroke', 'var(--border)')
}
