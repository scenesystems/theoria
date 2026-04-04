/**
 * GEPA runtime helper combinators.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Option } from "effect"

import { MergeComparison } from "../model.js"
import type { CandidateScoreVector, GEPAState, ProgramCandidate } from "../model.js"
import { sampleWeightedParentPair, selectWeightedParent } from "../pareto.js"

const parseTaggedStep = (identifier: string): Option.Option<number> =>
  Arr.get(identifier.split("-"), 1).pipe(
    Option.flatMap((token) => {
      const parsed = Number(token)

      return Number.isFinite(parsed)
        ? Option.some(Math.max(0, Math.trunc(parsed)))
        : Option.none<number>()
    })
  )

const candidateStep = (candidateId: string): number => Option.getOrElse(parseTaggedStep(candidateId), () => 0)

const parseExampleIndex = (exampleId: string): number => Option.getOrElse(parseTaggedStep(exampleId), () => 0)

/**
 * Attach optional metric feedback only when available.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withFeedback = (feedback: Option.Option<string>): Readonly<Record<string, string>> =>
  Option.match(feedback, {
    onNone: () => ({}),
    onSome: (value) => ({ feedback: value })
  })

/**
 * Safe score lookup with zero fallback.
 *
 * @since 0.1.0
 * @category combinators
 */
export const scoreAt = (scores: ReadonlyArray<number>, index: number): number =>
  Option.getOrElse(Arr.get(scores, index), () => 0)

/**
 * Deterministic micro-boost used as a tie-breaker for strict mutation gate-1.
 *
 * @since 0.1.0
 * @category combinators
 */
export const candidateBoost = (candidateId: string): number =>
  Match.value(candidateId).pipe(
    Match.when((id) => id.startsWith("mut-") || id.startsWith("merge-"), (id) => (candidateStep(id) + 1) / 1000),
    Match.orElse(() => 0)
  )

/**
 * Pick one predictor instruction from a candidate by predictor name.
 *
 * @since 0.1.0
 * @category combinators
 */
export const instructionForPredictor = (
  candidate: ProgramCandidate,
  predictorName: string
): Option.Option<string> =>
  Arr.findFirst(candidate.predictorInstructions, (entry) => entry.predictorName === predictorName).pipe(
    Option.map((entry) => entry.instruction)
  )

/**
 * Derive one weighted parent index from the current Pareto snapshot.
 *
 * @since 0.1.0
 * @category combinators
 */
export const chooseParentIndex = (state: GEPAState, seed: number): number => {
  return selectWeightedParent(state.paretoSnapshot.parentWeights, seed, {
    zeroWeightFallback: "seed-modulo"
  })
}

/**
 * Derive one weighted parent pair from the current Pareto snapshot.
 *
 * @since 0.1.0
 * @category combinators
 */
export const chooseParentPairIndices = (state: GEPAState, seed: number): readonly [number, number] =>
  sampleWeightedParentPair(state.paretoSnapshot.parentWeights, seed, {
    zeroWeightFallback: "seed-modulo"
  })

/**
 * Build merge comparisons for aligned parent score vectors.
 *
 * @since 0.1.0
 * @category constructors
 */
export const buildMergeComparisons = (
  parentA: CandidateScoreVector,
  parentB: CandidateScoreVector
): ReadonlyArray<MergeComparison> =>
  Arr.map(Arr.makeBy(Math.min(parentA.length, parentB.length), (index) => index), (index) =>
    new MergeComparison({
      exampleId: `example-${index}`,
      parentAScore: scoreAt(parentA, index),
      parentBScore: scoreAt(parentB, index)
    }))

/**
 * Project full valset scores onto the merge-comparison subsample.
 *
 * @since 0.1.0
 * @category combinators
 */
export const scoreVectorForComparisons = (
  fullScores: CandidateScoreVector,
  comparisons: ReadonlyArray<MergeComparison>
): CandidateScoreVector =>
  Arr.map(comparisons, (comparison) => scoreAt(fullScores, parseExampleIndex(comparison.exampleId)))

/**
 * Gate merge attempts to successful prior mutation and remaining budget.
 *
 * @since 0.1.0
 * @category guards
 */
export const shouldAttemptMerge = (state: GEPAState): boolean =>
  state.lastIterationFoundNew && state.mergeBudgetRemaining > 0 && state.candidates.length >= 2
