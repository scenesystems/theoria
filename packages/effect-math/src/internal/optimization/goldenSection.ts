/**
 * Golden-section search for one-dimensional minimization.
 *
 * @since 0.1.0
 * @category internal
 */
import { SemigroupMultiply, SemigroupSum } from "@effect/typeclass/data/Number"
import { Boolean, Iterable, MutableRef, Number, Tuple } from "effect"
import { Equivalence } from "effect/Number"

import { abs, ceil, sqrt } from "../../Numeric.js"

const sum = SemigroupSum.combine
const multiply = SemigroupMultiply.combine
const phi = Number.multiply(0.5, Number.subtract(sqrt(5), 1))
const complement = Number.subtract(1, phi)
const iterationBatchSize = 256
const midpoint = (a: number, b: number): number => multiply(0.5, sum(a, b))

type Exhausted = (a: number, b: number, x1: number, x2: number, y1: number, y2: number) => number

// Contract twice per recursive call, checking tolerance and budget after each
// contraction. Bounded batches keep large, nonconverging searches stack safe.
const narrow = (
  f: (x: number) => number,
  a: number,
  b: number,
  x1: number,
  x2: number,
  y1: number,
  y2: number,
  tolerance: number,
  remaining: number,
  exhausted: Exhausted
): number => {
  if (abs(sum(b, multiply(-1, a))) < tolerance) return midpoint(a, b)
  if (Equivalence(remaining, 0)) return exhausted(a, b, x1, x2, y1, y2)
  const left = y1 < y2
  const nextA = left ? a : x1
  const nextB = left ? x2 : b
  const next = left
    ? sum(a, multiply(complement, sum(x2, multiply(-1, a))))
    : sum(x1, multiply(phi, sum(b, multiply(-1, x1))))
  const value = f(next)
  const nextX1 = left ? next : x2
  const nextX2 = left ? x1 : next
  const nextY1 = left ? value : y2
  const nextY2 = left ? y1 : value
  if (abs(sum(nextB, multiply(-1, nextA))) < tolerance) return midpoint(nextA, nextB)
  if (Equivalence(remaining, 1)) return exhausted(nextA, nextB, nextX1, nextX2, nextY1, nextY2)
  if (nextY1 < nextY2) {
    const point = sum(nextA, multiply(complement, sum(nextX2, multiply(-1, nextA))))
    return narrow(f, nextA, nextX2, point, nextX1, f(point), nextY1, tolerance, sum(remaining, -2), exhausted)
  }
  const point = sum(nextX1, multiply(phi, sum(nextB, multiply(-1, nextX1))))
  return narrow(f, nextX1, nextB, nextX2, point, nextY2, f(point), tolerance, sum(remaining, -2), exhausted)
}

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
  tolerance: number = 1e-12,
  maxIterations: number = 100
): number => {
  const x1 = sum(a, multiply(complement, sum(b, multiply(-1, a))))
  const x2 = sum(a, multiply(phi, sum(b, multiply(-1, a))))
  const y1 = f(x1)
  const y2 = f(x2)
  const budget = ceil(maxIterations)
  if (Boolean.not(Number.lessThan(iterationBatchSize, budget))) {
    return narrow(f, a, b, x1, x2, y1, y2, tolerance, Number.max(0, budget), midpoint)
  }
  const interval = MutableRef.make(Tuple.make(a, b, x1, x2, y1, y2))
  const finished = MutableRef.make(false)
  const result = MutableRef.make(0)
  const exhausted: Exhausted = (a, b, x1, x2, y1, y2) => {
    MutableRef.set(interval, Tuple.make(a, b, x1, x2, y1, y2))
    MutableRef.set(finished, false)
    return midpoint(a, b)
  }
  Iterable.some(Iterable.range(0), (batch) => {
    const remaining = Number.subtract(budget, multiply(batch, iterationBatchSize))
    const count = Number.min(iterationBatchSize, Number.max(0, remaining))
    const current = MutableRef.get(interval)
    MutableRef.set(finished, true)
    MutableRef.set(result, narrow(f, ...current, tolerance, count, exhausted))
    return Boolean.or(MutableRef.get(finished), Boolean.not(Number.lessThan(iterationBatchSize, remaining)))
  })
  return MutableRef.get(result)
}
