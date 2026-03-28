/**
 * Adaptive Simpson quadrature over continuous scalar functions.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

const DEFAULT_ABSOLUTE_TOLERANCE = 1e-10
const DEFAULT_RELATIVE_TOLERANCE = 1e-10
const DEFAULT_MAX_DEPTH = 16

const absolute = (value: number): number => N.max(value, N.negate(value))

const midpoint = (a: number, b: number): number => N.unsafeDivide(N.sum(a, b), 2)

const segment = (
  a: number,
  b: number,
  fa: number,
  fm: number,
  fb: number
): number =>
  N.multiply(
    N.unsafeDivide(N.subtract(b, a), 6),
    N.sum(N.sum(fa, N.multiply(4, fm)), fb)
  )

const localTolerance = (
  estimate: number,
  absoluteTolerance: number,
  relativeTolerance: number
): number => N.max(absoluteTolerance, N.multiply(relativeTolerance, absolute(estimate)))

const recurse = (
  f: (x: number) => number,
  a: number,
  b: number,
  fa: number,
  fm: number,
  fb: number,
  whole: number,
  absoluteTolerance: number,
  relativeTolerance: number,
  depth: number
): number => {
  const m = midpoint(a, b)
  const leftMid = midpoint(a, m)
  const rightMid = midpoint(m, b)

  const fLeftMid = f(leftMid)
  const fRightMid = f(rightMid)

  const left = segment(a, m, fa, fLeftMid, fm)
  const right = segment(m, b, fm, fRightMid, fb)
  const combined = N.sum(left, right)

  const correction = N.subtract(combined, whole)
  const tolerance = localTolerance(combined, absoluteTolerance, relativeTolerance)
  const converged = N.lessThanOrEqualTo(absolute(correction), N.multiply(15, tolerance))

  if (N.lessThanOrEqualTo(depth, 0) || converged) {
    return N.sum(combined, N.unsafeDivide(correction, 15))
  }

  const nextAbsolute = N.unsafeDivide(absoluteTolerance, 2)
  const nextRelative = N.unsafeDivide(relativeTolerance, 2)

  return N.sum(
    recurse(f, a, m, fa, fLeftMid, fm, left, nextAbsolute, nextRelative, N.subtract(depth, 1)),
    recurse(f, m, b, fm, fRightMid, fb, right, nextAbsolute, nextRelative, N.subtract(depth, 1))
  )
}

/**
 * Adaptive Simpson quadrature with independent absolute and relative tolerances.
 *
 * @since 0.1.0
 * @category internal
 */
export const adaptiveSimpsonIntegral = (
  f: (x: number) => number,
  a: number,
  b: number,
  absoluteTolerance: number = DEFAULT_ABSOLUTE_TOLERANCE,
  relativeTolerance: number = DEFAULT_RELATIVE_TOLERANCE,
  maxDepth: number = DEFAULT_MAX_DEPTH
): number => {
  const normalizedDepth = Number.isFinite(maxDepth) ? N.max(0, maxDepth) : DEFAULT_MAX_DEPTH

  const m = midpoint(a, b)
  const fa = f(a)
  const fm = f(m)
  const fb = f(b)
  const whole = segment(a, b, fa, fm, fb)

  return recurse(
    f,
    a,
    b,
    fa,
    fm,
    fb,
    whole,
    N.max(absoluteTolerance, Number.MIN_VALUE),
    N.max(relativeTolerance, Number.MIN_VALUE),
    normalizedDepth
  )
}
