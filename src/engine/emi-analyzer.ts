// Conducted EMI analysis: Fourier decomposition of trapezoidal switching current
// against CISPR 32 Class B limits (150 kHz – 30 MHz).

export interface EMIDataPoint {
  frequencyHz: number;
  amplitude_dbuv: number;
  limit_dbuv: number | null;
}

export interface EMIFilterSuggestion {
  requiredAttenuationDb: number;
  cornerFrequencyHz: number;
  suggestedL_uH: number;
  suggestedC_uF: number;
}

export interface EMIAnalysisResult {
  dataPoints: EMIDataPoint[];
  maxExceedanceDb: number;
  offendingFrequencyHz: number | null;
  filterSuggestion: EMIFilterSuggestion | null;
}

/** Normalized sinc function: sinc(x) = sin(π·x) / (π·x). */
function sinc(x: number): number {
  if (x === 0) return 1;
  const piX = Math.PI * x;
  return Math.sin(piX) / piX;
}

/**
 * CISPR 32 Class B conducted emission limit in dBµV.
 * Valid from 150 kHz to 30 MHz; returns null outside that range.
 */
function getCISPR32ClassBLimit(freqHz: number): number | null {
  const f_MHz = freqHz / 1e6;
  if (f_MHz < 0.15) return null;
  if (f_MHz < 0.5) return 66 - 10 * (Math.log10(f_MHz / 0.15) / Math.log10(0.5 / 0.15));
  if (f_MHz < 5) return 56;
  if (f_MHz <= 30) return 60;
  return null;
}

/**
 * dBµV amplitude of the n-th harmonic for a trapezoidal switching current across a 50 Ω LISN.
 * A(n) = 2·Ipeak·D·|sinc(n·D)|·|sinc(n·fsw·trise)|; voltage = A(n)·50 Ω.
 */
function harmonicAmplitude_dbuv(
  n: number,
  fsw: number,
  dutyCycle: number,
  trise: number,
  Ipeak: number,
): number {
  const An = 2 * Ipeak * dutyCycle
    * Math.abs(sinc(n * dutyCycle))
    * Math.abs(sinc(n * fsw * trise));
  return 20 * Math.log10(An * 50 * 1e6);
}

/**
 * Suggest an LC input filter for the worst-case exceedance, adding a 6 dB safety margin.
 * Corner frequency is placed at least one decade below the offending harmonic.
 * An LC filter rolls off at 40 dB/decade: f_c = f_noise / 10^(A_req / 40).
 */
function suggestFilter(
  maxExceedanceDb: number,
  offendingFrequencyHz: number,
): EMIFilterSuggestion {
  const requiredAttenuationDb = maxExceedanceDb + 6;
  let cornerFrequencyHz = offendingFrequencyHz / Math.pow(10, requiredAttenuationDb / 40);
  cornerFrequencyHz = Math.min(cornerFrequencyHz, offendingFrequencyHz / 10);
  const suggestedC_uF = 1.0;
  const L_H = 1 / (Math.pow(2 * Math.PI * cornerFrequencyHz, 2) * suggestedC_uF * 1e-6);
  return { requiredAttenuationDb, cornerFrequencyHz, suggestedC_uF, suggestedL_uH: L_H * 1e6 };
}

/**
 * Full conducted EMI profile using Fourier analysis of a trapezoidal switching current.
 * Evaluates each harmonic up to 30 MHz against CISPR 32 Class B limits.
 *
 * @param fsw       Switching frequency in Hz
 * @param dutyCycle Steady-state duty cycle (0–1)
 * @param trise     Current rise time in seconds
 * @param _tfall    Fall time (reserved — conservative envelope uses trise for both)
 * @param Ipeak     Peak inductor current in Amperes
 */
export function calculateConductedEMI(
  fsw: number,
  dutyCycle: number,
  trise: number,
  _tfall: number,
  Ipeak: number,
): EMIAnalysisResult {
  const dataPoints: EMIDataPoint[] = [];
  let maxExceedanceDb = -Infinity;
  let offendingFrequencyHz: number | null = null;
  const maxN = Math.floor(30e6 / fsw);

  for (let n = 1; n <= maxN; n++) {
    const freqHz = n * fsw;
    const amplitude_dbuv = harmonicAmplitude_dbuv(n, fsw, dutyCycle, trise, Ipeak);
    const limit_dbuv = getCISPR32ClassBLimit(freqHz);

    if (limit_dbuv !== null) {
      const exceedance = amplitude_dbuv - limit_dbuv;
      if (exceedance > maxExceedanceDb) {
        maxExceedanceDb = exceedance;
        offendingFrequencyHz = freqHz;
      }
    }
    dataPoints.push({ frequencyHz: freqHz, amplitude_dbuv, limit_dbuv });
  }

  const filterSuggestion =
    maxExceedanceDb > 0 && offendingFrequencyHz !== null
      ? suggestFilter(maxExceedanceDb, offendingFrequencyHz)
      : null;

  return {
    dataPoints,
    maxExceedanceDb: maxExceedanceDb === -Infinity ? 0 : maxExceedanceDb,
    offendingFrequencyHz,
    filterSuggestion,
  };
}
