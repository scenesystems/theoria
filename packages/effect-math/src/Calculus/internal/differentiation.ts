/**
 * Central finite difference kernel for numerical differentiation.
 *
 * Approximates f'(x) via the symmetric difference quotient
 * (f(x+h) − f(x−h)) / (2h) with default step h = 1e-8.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

const DEFAULT_H = 1e-8

/**
 * Central finite difference approximation of the first derivative.
 *
 * @since 0.1.0
 * @category internal
 */
export const centralDifference = (f: (x: number) => number, x: number, h: number = DEFAULT_H): number =>
  N.unsafeDivide(N.subtract(f(N.sum(x, h)), f(N.subtract(x, h))), N.multiply(2, h))
