/**
 * Bisection method for root-finding.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Iterable, MutableRef, Number } from "effect"

import * as Numeric from "../../Numeric.js"

const defaultTolerance = 1e-12
const defaultMaxIterations = 100
const iterationBatchSize = 64
const iterationBatch = Array.range(0, Number.decrement(iterationBatchSize))
const halve = Number.multiply(0.5)

const midpoint = (a: number, b: number): number => halve(Number.sum(a, b))

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
          // Endpoint roots have exited. Advancing left preserves its nonzero
          // sign, including Effect Order's positive classification of NaN.
          const leftSign = Number.sign(fa)
          const withinTolerance = Number.lessThan(tolerance)
          const stop = () => true
          const advance = () => {
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
                Boolean.match(Boolean.not(Number.Equivalence(leftSign, Number.sign(fmid))), {
                  onTrue: () => MutableRef.set(right, mid),
                  onFalse: () => MutableRef.set(left, mid)
                })
                return false
              }
            })
          }
          const step = { onTrue: stop, onFalse: advance }
          const selectStep = Boolean.match(step)
          const visit = () =>
            selectStep(withinTolerance(Numeric.abs(Number.subtract(MutableRef.get(right), MutableRef.get(left)))))
          const runBatch = (batch: number) => {
            const remaining = Number.subtract(maxIterations, Number.multiply(batch, iterationBatchSize))
            const iterations = Array.take(iterationBatch, Numeric.ceil(remaining))
            return Boolean.or(
              Array.some(iterations, visit),
              Number.lessThan(Array.length(iterations), iterationBatchSize)
            )
          }
          const continueBatches = () => Iterable.some(Iterable.range(1), runBatch)
          Boolean.match(runBatch(0), { onTrue: stop, onFalse: continueBatches })
          return midpoint(MutableRef.get(left), MutableRef.get(right))
        }
      })
    }
  })
}
