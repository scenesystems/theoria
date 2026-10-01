/**
 * GEPA common-ancestor merge — three-way crossover inspired by version
 * control, with balanced subsampling for acceptance evaluation.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import { Array as Arr, Number as Num, Option } from "effect"
import { findNearestCommonAncestor, type MergeInputs, resolveMergeInputs } from "./merge/ancestor.js"
import { mergePredictorInstructions } from "./merge/instructions.js"
import { MergePreparation, type MergePreparationEvent, type PrepareCommonAncestorMergeOptions } from "./merge/model.js"
import { classifyMergeComparisonBucket, selectBalancedMergeSubsample } from "./merge/subsample.js"
import { type MergeComparison, MergeState, ProgramCandidate } from "./model.js"

export { classifyMergeComparisonBucket, findNearestCommonAncestor, selectBalancedMergeSubsample }

const mergeSkippedNoCommonAncestorEvent = (parentAId: string, parentBId: string): MergePreparationEvent => ({
  _tag: "MergeSkippedNoCommonAncestor",
  parentAId,
  parentBId
})

const mergePreparedEvent = (
  parentAId: string,
  parentBId: string,
  commonAncestorId: string
): MergePreparationEvent => ({
  _tag: "MergePrepared",
  parentAId,
  parentBId,
  commonAncestorId
})

const buildPreparedCandidate = (
  options: PrepareCommonAncestorMergeOptions,
  inputs: MergeInputs
): ProgramCandidate =>
  new ProgramCandidate({
    candidateId: options.mergedCandidateId,
    parentIds: Arr.make(options.parentAId, options.parentBId),
    predictorInstructions: mergePredictorInstructions({
      ancestor: inputs.ancestor,
      parentA: inputs.parentA,
      parentB: inputs.parentB,
      parentAScore: options.parentAScore,
      parentBScore: options.parentBScore
    })
  })

const skipPreparation = (
  parentAId: string,
  parentBId: string,
  mergeBudgetRemaining: number
): MergePreparation =>
  new MergePreparation({
    event: mergeSkippedNoCommonAncestorEvent(parentAId, parentBId),
    candidate: Option.none(),
    subsample: Arr.empty<MergeComparison>(),
    mergeBudgetRemaining
  })

/**
 * Prepare a merge candidate from two parents by finding their nearest common
 * ancestor and performing three-way instruction crossover. Emits an explicit
 * skip event when no common ancestor exists.
 *
 * @since 0.1.0
 * @category constructors
 */
export const prepareCommonAncestorMerge = (
  options: PrepareCommonAncestorMergeOptions
): MergePreparation =>
  Option.match(resolveMergeInputs(options), {
    onNone: () => skipPreparation(options.parentAId, options.parentBId, options.mergeBudgetRemaining),
    onSome: (inputs) =>
      new MergePreparation({
        event: mergePreparedEvent(options.parentAId, options.parentBId, inputs.commonAncestorId),
        candidate: Option.some(
          buildPreparedCandidate(options, inputs)
        ),
        subsample: selectBalancedMergeSubsample(options.comparisons, options.seed),
        mergeBudgetRemaining: options.mergeBudgetRemaining
      })
  })

/**
 * Promote an accepted merge candidate into the population and decrement the
 * remaining merge budget.
 *
 * @since 0.1.0
 * @category combinators
 */
export const recordAcceptedMerge = (
  state: MergeState,
  mergedCandidate: ProgramCandidate
): MergeState =>
  new MergeState({
    candidates: Arr.append(state.candidates, mergedCandidate),
    mergeBudgetRemaining: Num.max(0, Num.decrement(state.mergeBudgetRemaining))
  })
