/**
 * Bisection method for root-finding.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Iterable, MutableRef, Number, Ordering, Tuple } from "effect"

import * as Numeric from "../../Numeric.js"

const defaultTolerance = 1e-12
const defaultMaxIterations = 100
const iterationBatchSize = 64
const iterationBatch = Array.range(0, Number.decrement(iterationBatchSize))
const halve = Number.multiply(0.5)

const midpoint = (a: number, b: number): number => halve(Number.sum(a, b))

type Narrow = (context: BisectContext, mid: number) => boolean
type SelectNarrow = (ordering: Ordering.Ordering) => Narrow
type BisectContext = readonly [
  f: (x: number) => number,
  left: MutableRef.MutableRef<number>,
  right: MutableRef.MutableRef<number>,
  tolerance: number,
  maxIterations: number,
  selectNarrow: SelectNarrow
]

const narrowLeft: Narrow = (context, mid) => {
  MutableRef.set(context[1], mid)
  return false
}

const narrowRight: Narrow = (context, mid) => {
  MutableRef.set(context[2], mid)
  return false
}

const finish: Narrow = (context, mid) => {
  MutableRef.set(context[1], mid)
  MutableRef.set(context[2], mid)
  return true
}

const selectNegative: SelectNarrow = Ordering.match({
  onLessThan: () => narrowLeft,
  onEqual: () => finish,
  onGreaterThan: () => narrowRight
})

const selectPositive: SelectNarrow = Ordering.match({
  onLessThan: () => narrowRight,
  onEqual: () => finish,
  onGreaterThan: () => narrowLeft
})

const selectByLeftSign = Ordering.match({
  onLessThan: () => selectNegative,
  onEqual: () => selectPositive,
  onGreaterThan: () => selectPositive
})

const stop = (_context: BisectContext): boolean => true

const advance = (context: BisectContext): boolean => {
  const mid = midpoint(MutableRef.get(context[1]), MutableRef.get(context[2]))
  return context[5](Number.Order(context[0](mid), 0))(context, mid)
}

const selectStep = Ordering.match({
  onLessThan: () => stop,
  onEqual: () => advance,
  onGreaterThan: () => advance
})

const visit = (context: BisectContext): boolean =>
  selectStep(
    Number.Order(Numeric.abs(Number.subtract(MutableRef.get(context[2]), MutableRef.get(context[1]))), context[3])
  )(context)

const runExactBatch = (context: BisectContext, _remaining: number): boolean =>
  Boolean.or(Array.some(iterationBatch, () => visit(context)), true)

const runPartialBatch = (context: BisectContext, remaining: number): boolean => {
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

const runBatch = (context: BisectContext, batch: number): boolean => {
  const remaining = Numeric.ceil(Number.subtract(context[4], Number.multiply(batch, iterationBatchSize)))
  return selectBatch(Number.Equivalence(remaining, iterationBatchSize))(context, remaining)
}

const continueBatches = (context: BisectContext): number => {
  Iterable.some(Iterable.range(1), (batch) => runBatch(context, batch))
  return midpoint(MutableRef.get(context[1]), MutableRef.get(context[2]))
}

const finishSearch = (context: BisectContext): number =>
  midpoint(MutableRef.get(context[1]), MutableRef.get(context[2]))

const selectSearch = Boolean.match({
  onFalse: () => continueBatches,
  onTrue: () => finishSearch
})

const search = (
  f: (x: number) => number,
  a: number,
  b: number,
  fa: number,
  tolerance: number,
  maxIterations: number
): number => {
  const context: BisectContext = Tuple.make(
    f,
    MutableRef.make(a),
    MutableRef.make(b),
    tolerance,
    maxIterations,
    selectByLeftSign(Number.sign(fa))
  )
  return selectSearch(runBatch(context, 0))(context)
}

const returnRight = (_f: (x: number) => number, _a: number, b: number): number => b

const selectRightEndpoint = Boolean.match({
  onFalse: () => search,
  onTrue: () => returnRight
})

const checkRightEndpoint = (
  f: (x: number) => number,
  a: number,
  b: number,
  fa: number,
  tolerance: number,
  maxIterations: number
): number => selectRightEndpoint(Number.Equivalence(f(b), 0))(f, a, b, fa, tolerance, maxIterations)

const returnLeft = (_f: (x: number) => number, a: number): number => a

const selectLeftEndpoint = Boolean.match({
  onFalse: () => checkRightEndpoint,
  onTrue: () => returnLeft
})

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
  return selectLeftEndpoint(Number.Equivalence(fa, 0))(f, a, b, fa, tolerance, maxIterations)
}
