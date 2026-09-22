/**
 * Bisection method for root-finding.
 *
 * @since 0.1.0
 * @category internal
 */
import { SemigroupMultiply, SemigroupSum } from "@effect/typeclass/data/Number"
import { Boolean, Iterable, MutableRef, Number, Tuple } from "effect"
import { Equivalence } from "effect/Number"

import { abs, ceil } from "../../Numeric.js"

const sum = SemigroupSum.combine
const multiply = SemigroupMultiply.combine
const midpoint = (a: number, b: number): number => multiply(0.5, sum(a, b))
const iterationBatchSize = 256

// Two halvings per call amortize recursive-call overhead. Each halving retains
// its own tolerance, budget, and exact-root exits, including odd budgets.
const narrow = (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance: number,
  negative: boolean,
  remaining: number,
  exhausted: (a: number, b: number) => number
): number => {
  if (abs(sum(b, multiply(a, -1))) < tolerance) return midpoint(a, b)
  if (Equivalence(remaining, 0)) return exhausted(a, b)
  const mid = midpoint(a, b)
  const value = f(mid)
  if (Equivalence(value, 0)) return mid
  const sameSign = (value < 0) === negative
  const nextA = sameSign ? mid : a
  const nextB = sameSign ? b : mid
  if (abs(sum(nextB, multiply(nextA, -1))) < tolerance) return midpoint(nextA, nextB)
  if (Equivalence(remaining, 1)) return exhausted(nextA, nextB)
  const nextMid = midpoint(nextA, nextB)
  const nextValue = f(nextMid)
  if (Equivalence(nextValue, 0)) return nextMid
  if ((nextValue < 0) === negative) {
    return narrow(f, nextMid, nextB, tolerance, negative, sum(remaining, -2), exhausted)
  }
  return narrow(f, nextA, nextMid, tolerance, negative, sum(remaining, -2), exhausted)
}

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
  tolerance: number = 1e-12,
  maxIterations: number = 100
): number => {
  const fa = f(a)
  if (Number.Equivalence(fa, 0)) return a
  if (Number.Equivalence(f(b), 0)) return b
  const negative = Number.lessThan(fa, 0)
  const budget = ceil(maxIterations)
  if (Boolean.not(Number.lessThan(iterationBatchSize, budget))) {
    return narrow(f, a, b, tolerance, negative, Number.max(0, budget), midpoint)
  }

  const interval = MutableRef.make(Tuple.make(a, b))
  const finished = MutableRef.make(false)
  const result = MutableRef.make(0)
  const exhausted = (a: number, b: number): number => {
    MutableRef.set(interval, Tuple.make(a, b))
    MutableRef.set(finished, false)
    return midpoint(a, b)
  }
  const runBatch = (batch: number): boolean => {
    const remaining = Number.subtract(budget, multiply(batch, iterationBatchSize))
    const count = Number.min(iterationBatchSize, Number.max(0, remaining))
    const current = MutableRef.get(interval)
    MutableRef.set(finished, true)
    MutableRef.set(result, narrow(f, current[0], current[1], tolerance, negative, count, exhausted))
    return Boolean.or(MutableRef.get(finished), Boolean.not(Number.lessThan(iterationBatchSize, remaining)))
  }
  Iterable.some(Iterable.range(0), runBatch)
  return MutableRef.get(result)
}
