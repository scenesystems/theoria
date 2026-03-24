/**
 * Bisection method for root-finding.
 *
 * Recursive tail-call style implementation that finds x where f(x) ≈ 0
 * in [a, b], assuming f(a) and f(b) have opposite signs.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

const DEFAULT_TOLERANCE = 1e-12
const DEFAULT_MAX_ITERATIONS = 100

/**
 * Bisection root-finding kernel.
 *
 * @since 0.1.0
 * @category internal
 */
export const bisectKernel = (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance: number = DEFAULT_TOLERANCE,
  maxIterations: number = DEFAULT_MAX_ITERATIONS
): number => step(f, a, b, tolerance, maxIterations, 0)

const step = (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance: number,
  maxIterations: number,
  iteration: number
): number => {
  const mid = N.multiply(0.5, N.sum(a, b))

  if (Math.abs(N.subtract(b, a)) < tolerance || iteration >= maxIterations) {
    return mid
  }

  return N.multiply(f(a), f(mid)) <= 0
    ? step(f, a, mid, tolerance, maxIterations, N.sum(iteration, 1))
    : step(f, mid, b, tolerance, maxIterations, N.sum(iteration, 1))
}
