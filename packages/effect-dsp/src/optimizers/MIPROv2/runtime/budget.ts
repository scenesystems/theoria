/**
 * Phase 3 trial budget and cadence — controls how many trials to run and when
 * to evaluate the full validation set.
 *
 * @since 0.1.0
 * @internal
 */
import { Match, Option } from "effect"

/**
 * Clamps a number to a positive value, substituting `fallback` when the
 * input is zero or negative.
 *
 * @since 0.1.0
 * @category utils
 */
export const normalizePositive = (value: number, fallback: number): number =>
  Match.value(value).pipe(
    Match.when((candidate) => candidate <= 0, () => fallback),
    Match.orElse((candidate) => candidate)
  )

/**
 * Computes the recommended number of Bayesian search trials for Phase 3.
 *
 * The budget is the larger of a logarithmic estimate
 * (`2 × predictors × ln(candidates)`) and an exploration floor
 * (`1.5 × candidates`), then ceiled and clamped to the provided minimum.
 *
 * @since 0.1.0
 * @category utils
 */
export const phase3TrialBudget = (options: {
  readonly predictorCount: number
  readonly demoCandidateCount: number
  readonly instructionCandidateCount: number
  readonly minimum?: number
}): number => {
  const safePredictorCount = Math.max(1, options.predictorCount)
  const safeCandidateCount = Math.max(1, Math.max(options.demoCandidateCount, options.instructionCandidateCount))
  const logarithmicBudget = 2 * safePredictorCount * Math.log(safeCandidateCount)
  const explorationBudget = (3 * safeCandidateCount) / 2

  return Math.max(
    Option.getOrElse(Option.fromNullable(options.minimum), () => 1),
    Math.ceil(Math.max(logarithmicBudget, explorationBudget))
  )
}

/**
 * Resolves Phase 3 evaluation cadence with safe defaults.
 *
 * Returns the concrete seed, minibatch size, and full-evaluation interval
 * to use during Bayesian search, normalizing any missing or non-positive
 * values to sensible defaults.
 *
 * @since 0.1.0
 * @category utils
 */
export const resolvePhase3Cadence = (options: {
  readonly seed?: number
  readonly minibatchSize?: number
  readonly fullEvalEvery?: number
}) => ({
  seed: Option.getOrElse(Option.fromNullable(options.seed), () => 1),
  minibatchSize: normalizePositive(Option.getOrElse(Option.fromNullable(options.minibatchSize), () => 50), 1),
  fullEvalEvery: normalizePositive(Option.getOrElse(Option.fromNullable(options.fullEvalEvery), () => 5), 1)
})
