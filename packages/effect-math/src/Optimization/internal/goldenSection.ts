/**
 * Golden section search for 1D minimization.
 *
 * Uses the golden ratio φ = (√5 − 1) / 2 to progressively narrow the
 * bracket containing the minimum.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

const PHI = N.multiply(0.5, N.subtract(Math.sqrt(5), 1))
const RESP = N.subtract(1, PHI)

const DEFAULT_TOLERANCE = 1e-12
const DEFAULT_MAX_ITERATIONS = 100

/**
 * Golden section search kernel.
 *
 * @since 0.1.0
 * @category internal
 */
export const goldenSectionKernel = (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance: number = DEFAULT_TOLERANCE,
  maxIterations: number = DEFAULT_MAX_ITERATIONS
): number => {
  const x1 = N.sum(a, N.multiply(RESP, N.subtract(b, a)))
  const x2 = N.sum(a, N.multiply(PHI, N.subtract(b, a)))
  return step(f, a, b, x1, x2, f(x1), f(x2), tolerance, maxIterations, 0)
}

const step = (
  f: (x: number) => number,
  a: number,
  b: number,
  x1: number,
  x2: number,
  f1: number,
  f2: number,
  tolerance: number,
  maxIterations: number,
  iteration: number
): number => {
  if (Math.abs(N.subtract(b, a)) < tolerance || iteration >= maxIterations) {
    return N.multiply(0.5, N.sum(a, b))
  }

  if (f1 < f2) {
    const newB = x2
    const newX2 = x1
    const newF2 = f1
    const newX1 = N.sum(a, N.multiply(RESP, N.subtract(newB, a)))
    return step(f, a, newB, newX1, newX2, f(newX1), newF2, tolerance, maxIterations, N.sum(iteration, 1))
  }

  const newA = x1
  const newX1 = x2
  const newF1 = f2
  const newX2 = N.sum(newA, N.multiply(PHI, N.subtract(b, newA)))
  return step(f, newA, b, newX1, newX2, newF1, f(newX2), tolerance, maxIterations, N.sum(iteration, 1))
}
