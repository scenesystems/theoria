/**
 * GEPA runtime helper combinators.
 *
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Inspectable, Number as Num, Option, Schema, String as Str } from "effect"

import { MergeComparison } from "../model.js"
import type {
  CandidateScoreVector,
  GEPAState,
  MergeComparisons,
  ParentPairIndices,
  ProgramCandidate
} from "../model.js"
import { sampleWeightedParentPair, selectWeightedParent } from "../pareto.js"

const parseTaggedStep = (identifier: string): Option.Option<number> =>
  Arr.get(Str.split("-")(identifier), 1).pipe(
    Option.flatMap((token) => {
      return Schema.decodeOption(Schema.NumberFromString)(token).pipe(
        Option.filter(Numeric.isFinite),
        Option.map((value) => Num.max(0, Numeric.truncate(value)))
      )
    })
  )

const parseExampleIndex = (exampleId: string): number => Option.getOrElse(parseTaggedStep(exampleId), () => 0)

/**
 * Safe score lookup with zero fallback.
 *
 * @since 0.1.0
 * @category combinators
 */
export const scoreAt = (scores: CandidateScoreVector, index: number): number =>
  Option.getOrElse(Arr.get(scores, index), () => 0)

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
  Arr.findFirst(candidate.predictorInstructions, (entry) => Str.Equivalence(entry.predictorName, predictorName)).pipe(
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
export const chooseParentPairIndices = (state: GEPAState, seed: number): ParentPairIndices =>
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
): MergeComparisons =>
  Arr.map(
    Arr.makeBy(Num.min(Arr.length(parentA), Arr.length(parentB)), (index) => index),
    (index) =>
      new MergeComparison({
        exampleId: Str.concat("example-", Inspectable.toStringUnknown(index)),
        parentAScore: scoreAt(parentA, index),
        parentBScore: scoreAt(parentB, index)
      })
  )

/**
 * Project full valset scores onto the merge-comparison subsample.
 *
 * @since 0.1.0
 * @category combinators
 */
export const scoreVectorForComparisons = (
  fullScores: CandidateScoreVector,
  comparisons: MergeComparisons
): CandidateScoreVector =>
  Arr.map(comparisons, (comparison) => scoreAt(fullScores, parseExampleIndex(comparison.exampleId)))

/**
 * Gate merge attempts to successful prior mutation and remaining budget.
 *
 * @since 0.1.0
 * @category guards
 */
export const shouldAttemptMerge = (state: GEPAState): boolean =>
  Bool.every(
    Arr.make(
      state.lastIterationFoundNew,
      Num.greaterThan(state.mergeBudgetRemaining, 0),
      Num.greaterThanOrEqualTo(Arr.length(state.candidates), 2)
    )
  )
