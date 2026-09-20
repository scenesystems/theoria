/**
 * Golden-section search for one-dimensional minimization.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Iterable, MutableRef, Number, Ordering, Tuple } from "effect"

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

type GoldenContext = readonly [
  f: (x: number) => number,
  left: MutableRef.MutableRef<number>,
  right: MutableRef.MutableRef<number>,
  firstPoint: MutableRef.MutableRef<number>,
  secondPoint: MutableRef.MutableRef<number>,
  firstValue: MutableRef.MutableRef<number>,
  secondValue: MutableRef.MutableRef<number>,
  tolerance: number,
  maxIterations: number
]

const narrowLeft = (context: GoldenContext): void => {
  const nextRight = MutableRef.get(context[4])
  const nextFirstPoint = Number.sum(
    MutableRef.get(context[1]),
    scaleByComplement(Number.subtract(nextRight, MutableRef.get(context[1])))
  )
  MutableRef.set(context[2], nextRight)
  MutableRef.set(context[4], MutableRef.get(context[3]))
  MutableRef.set(context[6], MutableRef.get(context[5]))
  MutableRef.set(context[3], nextFirstPoint)
  MutableRef.set(context[5], context[0](nextFirstPoint))
}

const narrowRight = (context: GoldenContext): void => {
  const nextLeft = MutableRef.get(context[3])
  const nextSecondPoint = Number.sum(
    nextLeft,
    scaleByPhi(Number.subtract(MutableRef.get(context[2]), nextLeft))
  )
  MutableRef.set(context[1], nextLeft)
  MutableRef.set(context[3], MutableRef.get(context[4]))
  MutableRef.set(context[5], MutableRef.get(context[6]))
  MutableRef.set(context[4], nextSecondPoint)
  MutableRef.set(context[6], context[0](nextSecondPoint))
}

const selectNarrow = Ordering.match({
  onLessThan: () => narrowLeft,
  onEqual: () => narrowRight,
  onGreaterThan: () => narrowRight
})

const stop = (_context: GoldenContext): boolean => true

const advance = (context: GoldenContext): boolean => {
  selectNarrow(Number.Order(MutableRef.get(context[5]), MutableRef.get(context[6])))(context)
  return false
}

const selectStep = Ordering.match({
  onLessThan: () => stop,
  onEqual: () => advance,
  onGreaterThan: () => advance
})

const visit = (context: GoldenContext): boolean =>
  selectStep(
    Number.Order(Numeric.abs(Number.subtract(MutableRef.get(context[2]), MutableRef.get(context[1]))), context[7])
  )(context)

const runExactBatch = (context: GoldenContext, _remaining: number): boolean =>
  Boolean.or(Array.some(iterationBatch, () => visit(context)), true)

const runPartialBatch = (context: GoldenContext, remaining: number): boolean => {
  const iterations = Array.take(iterationBatch, remaining)
  return Boolean.or(
    Array.some(iterations, () => visit(context)),
    Number.lessThan(Array.length(iterations), iterationBatchSize)
  )
}

const selectBatch = Boolean.match({
  onFalse: () => runPartialBatch,
  onTrue: () => runExactBatch
})

const runBatch = (context: GoldenContext, batch: number): boolean => {
  const remaining = Numeric.ceil(Number.subtract(context[8], Number.multiply(batch, iterationBatchSize)))
  return selectBatch(Number.Equivalence(remaining, iterationBatchSize))(context, remaining)
}

const continueBatches = (context: GoldenContext): number => {
  Iterable.some(Iterable.range(1), (batch) => runBatch(context, batch))
  return midpoint(MutableRef.get(context[1]), MutableRef.get(context[2]))
}

const finishSearch = (context: GoldenContext): number =>
  midpoint(MutableRef.get(context[1]), MutableRef.get(context[2]))

const selectSearch = Boolean.match({
  onFalse: () => continueBatches,
  onTrue: () => finishSearch
})

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
  const firstPoint = Number.sum(a, scaleByComplement(Number.subtract(b, a)))
  const secondPoint = Number.sum(a, scaleByPhi(Number.subtract(b, a)))
  const context: GoldenContext = Tuple.make(
    f,
    MutableRef.make(a),
    MutableRef.make(b),
    MutableRef.make(firstPoint),
    MutableRef.make(secondPoint),
    MutableRef.make(f(firstPoint)),
    MutableRef.make(f(secondPoint)),
    tolerance,
    maxIterations
  )
  return selectSearch(runBatch(context, 0))(context)
}
