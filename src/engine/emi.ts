// EMI estimation: harmonic spectrum of a trapezoidal switching current
// evaluated against CISPR 32 Class B conducted emission limits (150 kHz – 30 MHz).

import type { DesignSpec, EMIResult, EMIHarmonic } from './topologies/types';

/** CISPR 32 Class B limit in dBµV. Linearly interpolated in the log-frequency 150–500 kHz band. */
function getClassBLimit(f: number): number {
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

/**
 * dBµV amplitude of the n-th harmonic for a trapezoidal switching current.
 * Includes +6 dB broadband CM estimate. Erickson & Maksimovic §18 — trapezoidal pulse spectrum.
 * Voltage measured across a 50 Ω LISN impedance.
 */
function harmonicAmplitude_dbuv(
  n: number,
  fsw: number,
  D: number,
  tr: number,
  Ipeak: number,
): number {
  const x2 = n * Math.PI * D;
  const term2 = x2 === 0 ? 1 : Math.abs(Math.sin(x2) / x2);
  const x3 = n * Math.PI * tr * fsw;
  const term3 = x3 === 0 ? 1 : Math.abs(Math.sin(x3) / x3);
  const In = (2 * Ipeak * D) / (n * Math.PI) * term2 * term3;
  return 20 * Math.log10(In * 50 * 1e6) + 6;
}

/**
 * Size a balanced LC DM filter achieving the required attenuation with a 6 dB safety margin.
 * Characteristic impedance ~10 Ω; corner frequency at most 1/3 the failing harmonic.
 */
function suggestDmFilter(
  worst_margin_db: number,
  first_failing_harmonic: number,
): { Lf_uH: number; Cf_uF: number } {
  const req_atten_db = Math.abs(worst_margin_db) + 6;
  const atten_lin = Math.pow(10, req_atten_db / 20);
  const fc_atten = first_failing_harmonic / Math.sqrt(atten_lin);
  const fc = Math.min(first_failing_harmonic / 3, fc_atten);
  const Cf = 1 / (2 * Math.PI * fc * Math.sqrt(10));
  return { Lf_uH: 10 * Cf * 1e6, Cf_uF: Cf * 1e6 };
}

/**
 * Estimate conducted EMI for a switching converter design.
 * Returns per-harmonic margin against CISPR 32 Class B and an optional DM filter suggestion.
 *
 * @param _topology Topology identifier (reserved for future topology-specific adjustments)
 * @param spec      Design specification (uses fsw)
 * @param result    Computed design result (uses dutyCycle and peakCurrent)
 */
export function estimateEMI(_topology: string, spec: DesignSpec, result: EMIDesignResult): EMIResult {
  const fsw = spec.fsw || 200000;
  const D = result.dutyCycle || result.duty_cycle || 0.5;
  const Ipeak = result.peakCurrent || result.inductor?.peak_current || spec.iout_max || 1;
  const tr = 20e-9; // 20 ns rise time — conservative default

  const harmonics: EMIHarmonic[] = [];
  let worst_margin_db = Infinity;
  let first_failing_harmonic: number | null = null;
  const n_max = Math.floor(30e6 / fsw);

  for (let n = 1; n <= n_max; n++) {
    const freq = n * fsw;
    if (freq < 150e3) continue;
    const dbuv = harmonicAmplitude_dbuv(n, fsw, D, tr, Ipeak);
    const limit = getClassBLimit(freq);
    const margin = limit - dbuv;
    if (margin < worst_margin_db) worst_margin_db = margin;
    if (margin < 0 && first_failing_harmonic === null) first_failing_harmonic = freq;
    harmonics.push({ frequency: freq, amplitude_dbuv: dbuv, limit_dbuv: limit, margin_db: margin });
  }

  const suggested_filter =
    first_failing_harmonic !== null && first_failing_harmonic > 0
      ? suggestDmFilter(worst_margin_db, first_failing_harmonic)
      : null;

  return {
    harmonics,
    worst_margin_db: worst_margin_db === Infinity ? 0 : worst_margin_db,
    first_failing_harmonic,
    suggested_filter,
  };
}
