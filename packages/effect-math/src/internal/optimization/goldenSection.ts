/**
 * Golden-section search for one-dimensional minimization.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Iterable, MutableRef, Number } from "effect"

import * as Numeric from "../../Numeric.js"

const phi = Number.multiply(0.5, Number.subtract(Numeric.sqrt(5), 1))
const complement = Number.subtract(1, phi)
const defaultTolerance = 1e-12
const defaultMaxIterations = 100
const iterationBatchSize = 64
const iterationBatch = Array.range(0, Number.decrement(iterationBatchSize))
const halve = Number.multiply(0.5)
const scaleByPhi = Number.multiply(phi)
const scaleByComplement = Number.multiply(complement)

const midpoint = (a: number, b: number): number => halve(Number.sum(a, b))

/**
 * Golden-section minimization kernel.
 *
 * @since 0.1.0
 * @category internal
 */
export const goldenSection = (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance: number = defaultTolerance,
  maxIterations: number = defaultMaxIterations
): number => {
  const left = MutableRef.make(a)
  const right = MutableRef.make(b)
  const firstPoint = MutableRef.make(Number.sum(a, scaleByComplement(Number.subtract(b, a))))
  const secondPoint = MutableRef.make(Number.sum(a, scaleByPhi(Number.subtract(b, a))))
  const firstValue = MutableRef.make(f(MutableRef.get(firstPoint)))
  const secondValue = MutableRef.make(f(MutableRef.get(secondPoint)))
  const withinTolerance = Number.lessThan(tolerance)
  const narrowLeft = () => {
    const nextRight = MutableRef.get(secondPoint)
    const nextFirstPoint = Number.sum(
      MutableRef.get(left),
      scaleByComplement(Number.subtract(nextRight, MutableRef.get(left)))
    )
    MutableRef.set(right, nextRight)
    MutableRef.set(secondPoint, MutableRef.get(firstPoint))
    MutableRef.set(secondValue, MutableRef.get(firstValue))
    MutableRef.set(firstPoint, nextFirstPoint)
    MutableRef.set(firstValue, f(nextFirstPoint))
  }
  const narrowRight = () => {
    const nextLeft = MutableRef.get(firstPoint)
    const nextSecondPoint = Number.sum(
      nextLeft,
      scaleByPhi(Number.subtract(MutableRef.get(right), nextLeft))
    )
    MutableRef.set(left, nextLeft)
    MutableRef.set(firstPoint, MutableRef.get(secondPoint))
    MutableRef.set(firstValue, MutableRef.get(secondValue))
    MutableRef.set(secondPoint, nextSecondPoint)
    MutableRef.set(secondValue, f(nextSecondPoint))
  }
  const narrow = { onTrue: narrowLeft, onFalse: narrowRight }
  const selectNarrow = Boolean.match(narrow)
  const stop = () => true
  const advance = () => {
    selectNarrow(Number.lessThan(MutableRef.get(firstValue), MutableRef.get(secondValue)))
    return false
  }
  const step = { onTrue: stop, onFalse: advance }
  const selectStep = Boolean.match(step)
  const visit = () =>
    selectStep(withinTolerance(Numeric.abs(Number.subtract(MutableRef.get(right), MutableRef.get(left)))))
  const runBatch = (batch: number) => {
    const remaining = Number.subtract(maxIterations, Number.multiply(batch, iterationBatchSize))
    const iterations = Array.take(iterationBatch, Numeric.ceil(remaining))
    return Boolean.or(Array.some(iterations, visit), Number.lessThan(Array.length(iterations), iterationBatchSize))
  }
  const continueBatches = () => Iterable.some(Iterable.range(1), runBatch)
  Boolean.match(runBatch(0), { onTrue: stop, onFalse: continueBatches })
  return midpoint(MutableRef.get(left), MutableRef.get(right))
}
