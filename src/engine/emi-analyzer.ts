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

/**
 * Normalized sinc function: sinc(x) = sin(pi * x) / (pi * x)
 */
function sinc(x: number): number {
  if (x === 0) return 1;
  const piX = Math.PI * x;
  return Math.sin(piX) / piX;
}

/**
 * Calculates the CISPR 32 Class B conducted emission limits
 * Valid strictly from 150kHz to 30MHz.
 */
function getCISPR32ClassBLimit(freqHz: number): number | null {
  const f_MHz = freqHz / 1e6;
  if (f_MHz < 0.15) return null; // Outside of standard CISPR 32 conducted limits
  if (f_MHz < 0.5) {
    // Decreases linearly with the logarithm of frequency
    return 66 - 10 * (Math.log10(f_MHz / 0.15) / Math.log10(0.5 / 0.15));
  }
  if (f_MHz < 5) return 56;
  if (f_MHz <= 30) return 60;
  return null; // Outside of standard CISPR 32 conducted limits
}

/**
 * Calculates the conducted EMI profile using Fourier analysis of a trapezoidal switching current.
 */
export function calculateConductedEMI(
  fsw: number,
  dutyCycle: number,
  trise: number,
  _tfall: number,
  Ipeak: number
): EMIAnalysisResult {
  const dataPoints: EMIDataPoint[] = [];
  let maxExceedanceDb = -Infinity;
  let offendingFrequencyHz: number | null = null;

  // Analyze up to 30MHz (End of CISPR 32 Conducted range)
  const maxFreq = 30e6;
  const maxN = Math.floor(maxFreq / fsw);

  for (let n = 1; n <= maxN; n++) {
    const freqHz = n * fsw;

    // Amplitude A(n) = 2 * Ipeak * d * |sinc(n * d)| * |sinc(n * fsw * trise)|
    // Note: A conservative envelope assumes symmetric trise/tfall
    const An = 2 * Ipeak * dutyCycle * Math.abs(sinc(n * dutyCycle)) * Math.abs(sinc(n * fsw * trise));
    
    // Voltage across standard 50 ohm LISN
    const Vn = An * 50;

    // Convert to dBµV: 20 * log10(Vn / 1µV) -> 20 * log10(Vn * 1e6)
    const amplitude_dbuv = 20 * Math.log10(Vn * 1e6);
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

  let filterSuggestion: EMIFilterSuggestion | null = null;
  if (maxExceedanceDb > 0 && offendingFrequencyHz) {
    // Add a 6dB safety margin to the required attenuation
    const requiredAttenuationDb = maxExceedanceDb + 6;
    
    // An LC filter rolls off at 40 dB/decade
    // f_c = f_noise / 10^(A_req / 40)
    // Ensure the corner frequency is at least one decade below the offending peak
    let cornerFrequencyHz = offendingFrequencyHz / Math.pow(10, requiredAttenuationDb / 40);
    cornerFrequencyHz = Math.min(cornerFrequencyHz, offendingFrequencyHz / 10);

    // Calculate LC values assuming C = 1µF
    // f_c = 1 / (2 * pi * sqrt(L * C)) => L = 1 / ((2 * pi * f_c)^2 * C)
    const suggestedC_uF = 1.0; 
    const L_H = 1 / (Math.pow(2 * Math.PI * cornerFrequencyHz, 2) * (suggestedC_uF * 1e-6));

    filterSuggestion = {
      requiredAttenuationDb,
      cornerFrequencyHz,
      suggestedC_uF,
      suggestedL_uH: L_H * 1e6
    };
  }

  return {
    dataPoints,
    maxExceedanceDb: maxExceedanceDb === -Infinity ? 0 : maxExceedanceDb,
    offendingFrequencyHz,
    filterSuggestion
  };
}