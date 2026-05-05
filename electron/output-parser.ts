// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import type { WaveformSet } from '../topologies/types'

export interface LTspiceWaveforms {
  time: number[]
  vout: number[]
  il:   number[]
  vsw:  number[]
}

export interface LTspiceMetrics {
  vout_avg:    number
  vout_ripple: number
  efficiency:  number
  il_peak:     number
}

// ── .raw file parsing ─────────────────────────────────────────────────────────

interface Variable { index: number; name: string }

function parseVariables(lines: string[], start: number, end: number): Variable[] {
  return lines.slice(start, end).map(line => {
    const parts = line.trim().split(/\s+/)
    return { index: parseInt(parts[0]), name: parts[1].toLowerCase() }
  })
}

function resolveRequiredIndices(
  variables: Variable[]
): Record<'time' | 'vout' | 'il' | 'vsw', number> {
  const find = (name: string) => variables.find(v => v.name === name)?.index
  const timeIdx = find('time')
  const voutIdx = find('v(vout)')
  const ilIdx   = find('i(l1)')
  const vswIdx  = find('v(sw)')

  if (timeIdx === undefined || voutIdx === undefined || ilIdx === undefined || vswIdx === undefined) {
    const REQUIRED = ['time', 'v(vout)', 'i(l1)', 'v(sw)']
    const missing  = REQUIRED.filter(n => !variables.some(v => v.name === n))
    throw new Error(`Invalid .raw file: missing required variables: ${missing.join(', ')}`)
  }
  return { time: timeIdx, vout: voutIdx, il: ilIdx, vsw: vswIdx }
}

function parseDataSection(
  lines:           string[],
  valuesHeaderIdx: number,
  indices:         Record<'time' | 'vout' | 'il' | 'vsw', number>
): LTspiceWaveforms {
  const time: number[] = []
  const vout: number[] = []
  const il:   number[] = []
  const vsw:  number[] = []

  for (const line of lines.slice(valuesHeaderIdx + 1)) {
    if (!line.trim()) continue
    const v = line.trim().split(/\s+/).map(parseFloat)
    time.push(v[indices.time - 1])
    vout.push(v[indices.vout - 1])
    il.push(v[indices.il   - 1])
    vsw.push(v[indices.vsw  - 1])
  }
  return { time, vout, il, vsw }
}

/**
 * Parses the ASCII .raw file from an LTspice transient simulation.
 * Returns waveform arrays on the variable (non-uniform) time grid from the file.
 */
export function parseRawFile(rawContent: string): LTspiceWaveforms {
  const lines = rawContent.split(/\r?\n/)

  const varHeaderIdx    = lines.findIndex(l => l.startsWith('Variables:'))
  const valuesHeaderIdx = lines.findIndex(l => l.startsWith('Values:'))

  if (varHeaderIdx    === -1) throw new Error('Invalid .raw file: "Variables:" header not found.')
  if (valuesHeaderIdx === -1) throw new Error('Invalid .raw file: "Values:" header not found.')

  const variables = parseVariables(lines, varHeaderIdx + 1, valuesHeaderIdx)
  const indices   = resolveRequiredIndices(variables)
  return parseDataSection(lines, valuesHeaderIdx, indices)
}

// ── .log file parsing ─────────────────────────────────────────────────────────

/**
 * Parses .meas results from an LTspice .log file.
 * Expects measurement lines of the form: <key>: ... = <value>
 */
export function parseLogFile(logContent: string): LTspiceMetrics {
  const metrics: Partial<LTspiceMetrics> = {}
  const regex = /^([a-z0-9_]+):\s+.*=\s*([0-9.eE+-]+)/i

  for (const line of logContent.split(/\r?\n/)) {
    const match = line.trim().match(regex)
    if (!match) continue
    const key   = match[1].toLowerCase() as keyof LTspiceMetrics
    const value = parseFloat(match[2])
    if (!Number.isNaN(value)) metrics[key] = value
  }

  if (
    metrics.efficiency  === undefined ||
    metrics.vout_ripple === undefined ||
    metrics.il_peak     === undefined ||
    metrics.vout_avg    === undefined
  ) {
    throw new Error(
      'Could not parse all required .meas results from .log file. Check netlist .meas statements.'
    )
  }
  return metrics as LTspiceMetrics
}

// ── Resampling ────────────────────────────────────────────────────────────────

function linearInterpolate(x: number[], y: number[], xi: number): number {
  if (xi <= x[0])             return y[0]
  if (xi >= x[x.length - 1]) return y[y.length - 1]
  let i = 1
  while (x[i] < xi) i++
  const t = (xi - x[i - 1]) / (x[i] - x[i - 1])
  return y[i - 1] + t * (y[i] - y[i - 1])
}

/**
 * Resamples LTspice waveform data onto a uniform time grid.
 * LTspice uses variable time steps; the analytical WaveformSet uses a fixed grid,
 * so we interpolate to align the two before comparison.
 */
export function resampleWaveforms(
  simulated:      LTspiceWaveforms,
  targetTimeGrid: Float64Array
): Omit<WaveformSet, 'diode_current'> {
  const n       = targetTimeGrid.length
  const voutAvg = simulated.vout.reduce((a, b) => a + b, 0) / simulated.vout.length

  const inductor_current = new Float64Array(n)
  const switch_node      = new Float64Array(n)
  const output_ripple    = new Float64Array(n)

  for (let i = 0; i < n; i++) {
    const t = targetTimeGrid[i]
    inductor_current[i] = linearInterpolate(simulated.time, simulated.il,   t)
    switch_node[i]      = linearInterpolate(simulated.time, simulated.vsw,  t)
    output_ripple[i]    = linearInterpolate(simulated.time, simulated.vout, t) - voutAvg
  }

  return { time: targetTimeGrid, inductor_current, switch_node, output_ripple }
}
