/**
 * Integer arithmetic kernels — GCD, LCM, and factorial.
 *
 * Factorial folds a lazy Effect iterable to keep large finite inputs
 * independent of the JavaScript call-stack limit.
 *
 * @since 0.1.0
 * @category internal
 */
import { BigDecimal, BigInt, Boolean, Iterable, Number, Option, Tuple } from "effect"

import { toBigInt } from "../../Numeric/index.js"

/**
 * Greatest common divisor through Effect's canonical integer arithmetic.
 * `gcd(0, b) = b`, `gcd(a, 0) = a`.
 *
 * @since 0.1.0
 * @category internal
 */
export const gcd = (a: number, b: number): number =>
  Option.match(
    Option.zipWith(toBigInt(a), toBigInt(b), (a, b) => BigInt.gcd(BigInt.abs(a), BigInt.abs(b))),
    {
      onNone: () => Number.unsafeDivide(0, 0),
      onSome: (result) => BigDecimal.unsafeToNumber(BigDecimal.make(result, 0))
    }
  )

/**
 * Least common multiple through Effect's canonical integer arithmetic.
 * `lcm(a, b) = |a · b| / gcd(a, b)`. `lcm(0, x) = 0`.
 *
 * @since 0.1.0
 * @category internal
 */
export const lcm = (a: number, b: number): number =>
  Option.match(
    Option.zipWith(toBigInt(a), toBigInt(b), (a, b) =>
      Boolean.match(Boolean.or(BigInt.Equivalence(a, 0n), BigInt.Equivalence(b, 0n)), {
        onTrue: () =>
          0n,
        onFalse: () =>
          BigInt.lcm(BigInt.abs(a), BigInt.abs(b))
      })),
    {
      onNone: () =>
        Number.unsafeDivide(0, 0),
      onSome: (result) => BigDecimal.unsafeToNumber(BigDecimal.make(result, 0))
    }
  )

/**
 * Factorial n! via a descending product. `0! = 1`.
 *
 * @since 0.1.0
 * @category internal
 */
export const factorial = (n: number): number =>
  Iterable.reduce(
    Iterable.unfold(n, (factor) =>
      Boolean.match(Number.lessThanOrEqualTo(factor, 0), {
        onTrue: Option.none,
        onFalse: () => Option.some(Tuple.make(factor, Number.decrement(factor)))
      })),
    1,
    Number.multiply
  )
