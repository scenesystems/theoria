/**
 * Generic score-kernel helpers for downstream workflow scoring.
 *
 * These kernels stay numeric and package-generic: they normalize and aggregate
 * bounded numeric evidence without importing workflow score vocabularies or
 * report semantics.
 *
 * @since 0.3.0
 * @category operations
 */
import { Chunk, Number as N } from "effect"

import { summaryStatistics } from "./operations.js"
import type { SummaryStatistics } from "./schema.js"

/**
 * Weighted arithmetic mean over aligned value and weight vectors.
 *
 * Callers are responsible for supplying matching vector lengths and a positive
 * total weight; downstream workflow adapters validate those invariants at their
 * own boundaries.
 *
 * @since 0.3.0
 * @category operations
 */
export const weightedMean = (values: Chunk.NonEmptyChunk<number>, weights: Chunk.NonEmptyChunk<number>): number => {
  const weightedSum = Chunk.reduce(Chunk.zipWith(values, weights, N.multiply), 0, N.sum)
  const totalWeight = Chunk.reduce(weights, 0, N.sum)

  return N.unsafeDivide(weightedSum, totalWeight)
}

/**
 * Normalizes a beneficial metric into the closed unit interval.
 *
 * Values below `minimum` clamp to `0`; values above `maximum` clamp to `1`.
 * Callers are responsible for ensuring `maximum > minimum`.
 *
 * @since 0.3.0
 * @category operations
 */
export const normalizeBeneficial = (
  value: number,
  options: { readonly maximum: number; readonly minimum: number }
): number =>
  N.clamp(
    N.unsafeDivide(N.subtract(value, options.minimum), N.subtract(options.maximum, options.minimum)),
    { minimum: 0, maximum: 1 }
  )

/**
 * Normalizes a cost-style metric against an explicit budget.
 *
 * `0` cost maps to `1`, hitting the full budget maps to `0`, and overspend is
 * clamped at `0`. Callers are responsible for ensuring `budget > 0`.
 *
 * @since 0.3.0
 * @category operations
 */
export const normalizeInverseBudget = (value: number, options: { readonly budget: number }): number =>
  N.subtract(1, N.clamp(N.unsafeDivide(value, options.budget), { minimum: 0, maximum: 1 }))

/**
 * Summarizes normalized loss values through the canonical statistics carrier.
 *
 * This keeps downstream loss reporting on the same `SummaryStatistics` surface
 * already used elsewhere in the package instead of introducing a second report
 * type for score-oriented numeric summaries.
 *
 * @since 0.3.0
 * @category operations
 */
export const lossSummary = (losses: Chunk.NonEmptyChunk<number>): SummaryStatistics => summaryStatistics(losses)
