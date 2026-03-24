/**
 * Integer arithmetic kernels — GCD, LCM, and factorial.
 *
 * All arithmetic uses `Number as N` from Effect. No `let` or `while` —
 * GCD and factorial use tail recursion.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

/**
 * Greatest common divisor via Euclidean algorithm (tail recursion).
 * `gcd(0, b) = b`, `gcd(a, 0) = a`.
 *
 * @since 0.1.0
 * @category internal
 */
export const gcd = (a: number, b: number): number => gcdLoop(Math.abs(a), Math.abs(b))

const gcdLoop = (a: number, b: number): number => b === 0 ? a : gcdLoop(b, N.remainder(a, b))

/**
 * Least common multiple via GCD.
 * `lcm(a, b) = |a · b| / gcd(a, b)`. `lcm(0, x) = 0`.
 *
 * @since 0.1.0
 * @category internal
 */
export const lcm = (a: number, b: number): number => {
  if (a === 0 || b === 0) return 0
  return N.unsafeDivide(Math.abs(N.multiply(a, b)), gcd(a, b))
}

/**
 * Factorial n! via tail recursion. `0! = 1`.
 *
 * @since 0.1.0
 * @category internal
 */
export const factorial = (n: number): number => factorialLoop(n, 1)

const factorialLoop = (n: number, acc: number): number =>
  n <= 0 ? acc : factorialLoop(N.subtract(n, 1), N.multiply(acc, n))
