// Compute filter output impedance |Zout(f)| for the DM LC + damping network.
// Circuit: Lf in series with the parallel combination of Cf || (Rd + Cd).
export function filterOutputImpedance(
  lf: number, cf: number, rd: number, cd: number, freqs: number[],
): number[] {
  return freqs.map((f) => {
    const w = 2 * Math.PI * f
    const zCf_re = 0,    zCf_im   = -1 / (w * cf)
    const zRdCd_re = rd, zRdCd_im = -1 / (w * cd)
    const denom_re  = zCf_re + zRdCd_re
    const denom_im  = zCf_im + zRdCd_im
    const denom_mag2 = denom_re * denom_re + denom_im * denom_im
    const num_re  = zCf_re * zRdCd_re - zCf_im * zRdCd_im
    const num_im  = zCf_re * zRdCd_im + zCf_im * zRdCd_re
    const zPar_re = (num_re * denom_re + num_im * denom_im) / denom_mag2
    const zPar_im = (num_im * denom_re - num_re * denom_im) / denom_mag2
    return Math.sqrt(zPar_re * zPar_re + (w * lf + zPar_im) * (w * lf + zPar_im))
  })
}

// Converter negative input impedance magnitude vs frequency.
// Flat negative resistance up to fsw, then rises as +20 dB/dec above.
export function converterInputImpedance(zinDC: number, fsw: number, freqs: number[]): number[] {
  return freqs.map((f) =>
    f <= fsw ? zinDC : zinDC * Math.pow(f / fsw, 0.5),
  )
}
