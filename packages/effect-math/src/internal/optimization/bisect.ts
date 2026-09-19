/**
 * Bisection method for root-finding.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Iterable, MutableRef, Number, Ordering } from "effect"

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
          const narrowLeft = (mid: number) => {
            MutableRef.set(left, mid)
            return false
          }
          const narrowRight = (mid: number) => {
            MutableRef.set(right, mid)
            return false
          }
          const finish = (mid: number) => {
            MutableRef.set(left, mid)
            MutableRef.set(right, mid)
            return true
          }
          // Compare signs directly: the product can underflow to zero.
          const negative = Boolean.match(Number.Equivalence(leftSign, -1), {
            onTrue: () => narrowLeft,
            onFalse: () => narrowRight
          })
          const positive = Boolean.match(Number.Equivalence(leftSign, 1), {
            onTrue: () => narrowLeft,
            onFalse: () => narrowRight
          })
          const selectNarrow = Ordering.match({
            onLessThan: () => negative,
            onEqual: () => finish,
            onGreaterThan: () => positive
          })
          const stop = () => true
          const advance = () => {
            const mid = midpoint(MutableRef.get(left), MutableRef.get(right))
            return selectNarrow(Number.Order(f(mid), 0))(mid)
          }
          const selectStep = Ordering.match({ onLessThan: stop, onEqual: advance, onGreaterThan: advance })
          const visit = () =>
            selectStep(
              Number.Order(Numeric.abs(Number.subtract(MutableRef.get(right), MutableRef.get(left))), tolerance)
            )
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
