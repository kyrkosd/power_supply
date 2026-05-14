// Classic 4th-order Runge-Kutta for a linear state-space system.

export function computeDX(
  A: [[number, number], [number, number]],
  B: [[number], [number]],
  x: [number, number],
): [number, number] {
  return [
    A[0][0] * x[0] + A[0][1] * x[1] + B[0][0],
    A[1][0] * x[0] + A[1][1] * x[1] + B[1][0],
  ]
}

export function rk4Step(
  x: [number, number],
  A: [[number, number], [number, number]],
  B: [[number], [number]],
  dt: number,
): [number, number] {
  const k1 = computeDX(A, B, x)
  const x2: [number, number] = [x[0] + k1[0] * dt / 2, x[1] + k1[1] * dt / 2]
  const k2 = computeDX(A, B, x2)
  const x3: [number, number] = [x[0] + k2[0] * dt / 2, x[1] + k2[1] * dt / 2]
  const k3 = computeDX(A, B, x3)
  const x4: [number, number] = [x[0] + k3[0] * dt, x[1] + k3[1] * dt]
  const k4 = computeDX(A, B, x4)
  return [
    x[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    x[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
  ]
}
