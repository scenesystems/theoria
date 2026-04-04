/**
 * GEPA acceptance gates — two-gate mutation acceptance and non-strict merge
 * acceptance.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option } from "effect"
import { type CandidateScoreVector, MergeAcceptance, MutationAcceptance } from "./model.js"

/**
 * Inputs for the two-gate mutation acceptance check — previous and mutated
 * minibatch scores plus a deferred full-valset evaluation.
 *
 * @since 0.1.0
 * @category models
 */
export type EvaluateMutationAcceptanceOptions<E, R> = Readonly<{
  readonly previousSubsampleScores: CandidateScoreVector
  readonly mutatedSubsampleScores: CandidateScoreVector
  readonly evaluateFullValset: Effect.Effect<CandidateScoreVector, E, R>
}>

/**
 * Inputs for the merge acceptance check — merged and both parent minibatch
 * scores.
 *
 * @since 0.1.0
 * @category models
 */
export type EvaluateMergeAcceptanceOptions = Readonly<{
  readonly mergedSubsampleScores: CandidateScoreVector
  readonly parentASubsampleScores: CandidateScoreVector
  readonly parentBSubsampleScores: CandidateScoreVector
}>

const sumScores = (scores: CandidateScoreVector): number => Arr.reduce(scores, 0, (total, score) => total + score)

/**
 * Evaluate the two-gate mutation acceptance. Gate 1 requires strict minibatch
 * improvement. Gate 2 evaluates the full validation set only when gate 1
 * passes — avoiding expensive evaluation for clearly inferior mutations.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al. (2025)}
 * @since 0.1.0
 * @category combinators
 */
export const evaluateMutationAcceptance = <E, R>(
  options: EvaluateMutationAcceptanceOptions<E, R>
): Effect.Effect<MutationAcceptance, E, R> => {
  const previousSubsampleSum = sumScores(options.previousSubsampleScores)
  const mutatedSubsampleSum = sumScores(options.mutatedSubsampleScores)
  const gate1Passed = mutatedSubsampleSum > previousSubsampleSum

  return Effect.if(gate1Passed, {
    onTrue: () =>
      options.evaluateFullValset.pipe(
        Effect.map((fullValsetScores) =>
          new MutationAcceptance({
            previousSubsampleSum,
            mutatedSubsampleSum,
            gate1Passed: true,
            fullValsetEvaluated: true,
            fullValsetScores: Option.some(fullValsetScores),
            fullValsetSum: Option.some(sumScores(fullValsetScores))
          })
        )
      ),
    onFalse: () =>
      Effect.succeed(
        new MutationAcceptance({
          previousSubsampleSum,
          mutatedSubsampleSum,
          gate1Passed: false,
          fullValsetEvaluated: false,
          fullValsetScores: Option.none(),
          fullValsetSum: Option.none()
        })
      )
  })
}

/**
 * Evaluate merge acceptance using the non-strict comparator. A merged
 * candidate is accepted when its score sum equals or exceeds the best parent.
 *
 * @since 0.1.0
 * @category combinators
 */
export const evaluateMergeAcceptance = (
  options: EvaluateMergeAcceptanceOptions
): MergeAcceptance => {
  const mergedSubsampleSum = sumScores(options.mergedSubsampleScores)
  const parentASubsampleSum = sumScores(options.parentASubsampleScores)
  const parentBSubsampleSum = sumScores(options.parentBSubsampleScores)
  const bestParentSubsampleSum = Math.max(parentASubsampleSum, parentBSubsampleSum)

  return new MergeAcceptance({
    mergedSubsampleSum,
    bestParentSubsampleSum,
    accepted: mergedSubsampleSum >= bestParentSubsampleSum
  })
}
