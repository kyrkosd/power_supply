import type { WaveformSet } from '../topologies/types';

export interface LTspiceWaveforms {
  time: number[];
  vout: number[];
  il: number[];
  vsw: number[];
}

export interface LTspiceMetrics {
  vout_avg: number;
  vout_ripple: number;
  efficiency: number;
  il_peak: number;
}

/**
 * Parses the ASCII .raw file from an LTspice transient simulation.
 * @param rawContent The string content of the .raw file.
 * @returns An object containing the parsed waveform data with variable time steps.
 */
export function parseRawFile(rawContent: string): LTspiceWaveforms {
  const lines = rawContent.split(/\r?\n/);
  
  const varHeaderIndex = lines.findIndex(line => line.startsWith('Variables:'));
  if (varHeaderIndex === -1) throw new Error('Invalid .raw file: "Variables:" header not found.');

  const valuesHeaderIndex = lines.findIndex(line => line.startsWith('Values:'));
  if (valuesHeaderIndex === -1) throw new Error('Invalid .raw file: "Values:" header not found.');

  const varLines = lines.slice(varHeaderIndex + 1, valuesHeaderIndex);
  const variables = varLines.map(line => {
    const parts = line.trim().split(/\s+/);
    return { index: parseInt(parts[0]), name: parts[1].toLowerCase(), type: parts[2] };
  });

  const timeIdx = variables.find(v => v.name === 'time')?.index;
  const voutIdx = variables.find(v => v.name === 'v(vout)')?.index;
  const ilIdx = variables.find(v => v.name === 'i(l1)')?.index;
  const vswIdx = variables.find(v => v.name === 'v(sw)')?.index;

  if (timeIdx === undefined || voutIdx === undefined || ilIdx === undefined || vswIdx === undefined) {
    const missing = ['time', 'v(vout)', 'i(l1)', 'v(sw)'].filter(n => !variables.some(v => v.name === n));
    throw new Error(`Invalid .raw file: missing required variables: ${missing.join(', ')}`);
  }

  const dataLines = lines.slice(valuesHeaderIndex + 1).filter(line => line.trim() !== '');
  
  const time: number[] = [];
  const vout: number[] = [];
  const il: number[] = [];
  const vsw: number[] = [];

  dataLines.forEach(line => {
    const values = line.trim().split(/\s+/).map(parseFloat);
    time.push(values[timeIdx - 1]);
    vout.push(values[voutIdx - 1]);
    il.push(values[ilIdx - 1]);
    vsw.push(values[vswIdx - 1]);
  });

  return { time, vout, il, vsw };
}

/**
 * Parses the .log file from an LTspice simulation to extract .meas results.
 * @param logContent The string content of the .log file.
 * @returns An object containing the parsed metrics.
 */
export function parseLogFile(logContent: string): LTspiceMetrics {
  const metrics: Partial<LTspiceMetrics> = {};
  const lines = logContent.split(/\r?\n/);

  const regex = /^([a-z0-9_]+):\s+.*=\s*([0-9.eE+-]+)/i;

  for (const line of lines) {
    const match = line.trim().match(regex);
    if (match) {
      const key = match[1].toLowerCase() as keyof LTspiceMetrics;
      const value = parseFloat(match[2]);
      if (!Number.isNaN(value)) {
        metrics[key] = value;
      }
    }
  }

  if (metrics.efficiency === undefined || metrics.vout_ripple === undefined || metrics.il_peak === undefined || metrics.vout_avg === undefined) {
    throw new Error('Could not parse all required .meas results from .log file. Check netlist .meas statements.');
  }

  return metrics as LTspiceMetrics;
}

/**
 * Resamples LTspice waveform data onto a uniform time grid.
 * @param simulated The non-uniform data from parseRawFile.
 * @param targetTimeGrid The uniform time grid (e.g., from the analytical WaveformSet).
 * @returns A WaveformSet-like object with uniformly sampled data.
 */
export function resampleWaveforms(simulated: LTspiceWaveforms, targetTimeGrid: Float64Array): Omit<WaveformSet, 'diode_current'> {
  const n = targetTimeGrid.length;
  const resampled = {
    time: targetTimeGrid,
    inductor_current: new Float64Array(n),
    switch_node: new Float64Array(n),
    output_ripple: new Float64Array(n),
  };

  const vout_avg = simulated.vout.reduce((a, b) => a + b, 0) / simulated.vout.length;

  const interpolate = (x: number[], y: number[], xi: number): number => {
    if (xi <= x[0]) return y[0];
    if (xi >= x[x.length - 1]) return y[y.length - 1];

    let i = 1;
    while (x[i] < xi) i++;

    const x0 = x[i - 1], y0 = y[i - 1];
    const x1 = x[i], y1 = y[i];
    
    return y0 + (y1 - y0) * ((xi - x0) / (x1 - x0));
  };

  for (let i = 0; i < n; i++) {
    const t = targetTimeGrid[i];
    resampled.inductor_current[i] = interpolate(simulated.time, simulated.il, t);
    resampled.switch_node[i] = interpolate(simulated.time, simulated.vsw, t);
    const vout = interpolate(simulated.time, simulated.vout, t);
    resampled.output_ripple[i] = vout - vout_avg;
  }

  return resampled;
}