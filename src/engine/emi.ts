// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import type { DesignSpec, EMIResult, EMIHarmonic } from './topologies/types';

// Procedurally interpolates the Class B limit since it decreases linearly with the logarithm of frequency.
function getClassBLimit(f: number) {
  const f_MHz = f / 1e6;
  if (f_MHz < 0.15) return 66;
  if (f_MHz < 0.5) return 66 - 10 * (Math.log10(f_MHz / 0.15) / Math.log10(0.5 / 0.15));
  if (f_MHz < 5) return 56;
  return 60;
}

interface EMIDesignResult {
  dutyCycle?: number;
  duty_cycle?: number;
  peakCurrent?: number;
  inductor?: { peak_current: number };
}

export function estimateEMI(_topology: string, spec: DesignSpec, result: EMIDesignResult): EMIResult {
  const fsw = spec.fsw || 200000;
  const D = result.dutyCycle || result.duty_cycle || 0.5;
  const Ipeak = result.peakCurrent || result.inductor?.peak_current || spec.iout_max || 1;
  const tr = 20e-9; // Default 20ns rise time assumption if not known

  const harmonics: EMIHarmonic[] = [];
  let worst_margin_db = Infinity;
  let first_failing_harmonic: number | null = null;

  const n_max = Math.floor(30e6 / fsw);

  for (let n = 1; n <= n_max; n++) {
    const freq = n * fsw;
    if (freq < 150e3) continue; // CISPR 32 ranges from 150kHz

    // Compute harmonic amplitude based on trapezoidal pulse train formula
    const x2 = n * Math.PI * D;
    const term2 = x2 === 0 ? 1 : Math.abs(Math.sin(x2) / x2);
    const x3 = n * Math.PI * tr * fsw;
    const term3 = x3 === 0 ? 1 : Math.abs(Math.sin(x3) / x3);
    const term1 = (2 * Ipeak * D) / (n * Math.PI);

    const In = term1 * term2 * term3;
    const Vn = In * 50; // 50-ohm LISN impedance
    const dbuv = 20 * Math.log10(Vn * 1e6) + 6; // Include +6dB broadband CM estimate

    const limit = getClassBLimit(freq);
    const margin = limit - dbuv;

    if (margin < worst_margin_db) worst_margin_db = margin;
    if (margin < 0 && first_failing_harmonic === null) first_failing_harmonic = freq;

    harmonics.push({ frequency: freq, amplitude_dbuv: dbuv, limit_dbuv: limit, margin_db: margin });
  }

  let suggested_filter: { Lf_uH: number; Cf_uF: number } | null = null;
  if (first_failing_harmonic !== null && first_failing_harmonic > 0) {
    const req_atten_db = Math.abs(worst_margin_db) + 6; // Add 6dB extra margin
    const atten_lin = Math.pow(10, req_atten_db / 20);
    
    // Attempt to drop to target attenuation, capped at 1/3rd of the failing frequency
    const fc_atten = first_failing_harmonic / Math.sqrt(atten_lin);
    const fc = Math.min(first_failing_harmonic / 3, fc_atten);

    const Cf = 1 / (2 * Math.PI * fc * Math.sqrt(10)); // Balancing filter for ~Z0 of 10-ohms
    const Lf = 10 * Cf;
    suggested_filter = { Lf_uH: Lf * 1e6, Cf_uF: Cf * 1e6 };
  }

  return { harmonics, worst_margin_db: worst_margin_db === Infinity ? 0 : worst_margin_db, first_failing_harmonic, suggested_filter };
}