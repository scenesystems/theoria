/**
 * Bisection method for root-finding.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Iterable, MutableRef, Number } from "effect"

import * as Numeric from "../../Numeric.js"

const defaultTolerance = 1e-12
const defaultMaxIterations = 100

const midpoint = (a: number, b: number): number => Number.multiply(0.5, Number.sum(a, b))

/**
 * Bisection root-finding kernel.
 *
 * @since 0.1.0
 * @category internal
 */
export const bisect = (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance: number = defaultTolerance,
  maxIterations: number = defaultMaxIterations
): number => {
  const fa = f(a)
  return Boolean.match(Number.Equivalence(fa, 0), {
    onTrue: () => a,
    onFalse: () => {
      const fb = f(b)
      return Boolean.match(Number.Equivalence(fb, 0), {
        onTrue: () => b,
        onFalse: () => {
          const left = MutableRef.make(a)
          const right = MutableRef.make(b)
          const leftValue = MutableRef.make(fa)
          Iterable.findFirst(Iterable.range(0), (iteration) =>
            Boolean.match(
              Boolean.or(
                Number.lessThan(Numeric.abs(Number.subtract(MutableRef.get(right), MutableRef.get(left))), tolerance),
                Number.greaterThanOrEqualTo(iteration, maxIterations)
              ),
              {
                onTrue: () => true,
                onFalse: () => {
                  const mid = midpoint(MutableRef.get(left), MutableRef.get(right))
                  const fmid = f(mid)
                  return Boolean.match(Number.Equivalence(fmid, 0), {
                    onTrue: () => {
                      MutableRef.set(left, mid)
                      MutableRef.set(right, mid)
                      return true
                    },
                    onFalse: () => {
                      // Compare signs directly: the product can underflow to zero.
                      const oppositeSigns = Boolean.or(
                        Boolean.and(Number.lessThan(MutableRef.get(leftValue), 0), Number.greaterThan(fmid, 0)),
                        Boolean.and(Number.greaterThan(MutableRef.get(leftValue), 0), Number.lessThan(fmid, 0))
                      )
                      Boolean.match(oppositeSigns, {
                        onTrue: () => MutableRef.set(right, mid),
                        onFalse: () => {
                          MutableRef.set(left, mid)
                          MutableRef.set(leftValue, fmid)
                        }
                      })
                      return false
                    }
                  })
                }
              }
            ))
          return midpoint(MutableRef.get(left), MutableRef.get(right))
        }
      })
    }
  })
}
