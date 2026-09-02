/**
 * Phase 3 trial budget and cadence — controls how many trials to run and when
 * to evaluate the full validation set.
 *
 * @since 0.1.0
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Match, Option } from "effect"
import { normalizeSeed } from "./random.js"

/**
 * Converts a finite value to a positive integer. Fractional values round down;
 * zero, negative, and non-finite values use `fallback`.
 *
 * @since 0.1.0
 * @category utils
 */
export const normalizePositive = (value: number, fallback: number): number => {
  const integer = Match.value(value).pipe(
    Match.when(Numeric.isFinite, Numeric.floor),
    Match.orElse(() => fallback)
  )

  return Match.value(integer).pipe(
    Match.when((candidate) => candidate <= 0, () => fallback),
    Match.orElse((candidate) => candidate)
  )
}

/**
 * Computes the recommended number of Bayesian search trials for Phase 3.
 *
 * @remarks
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
  const safePredictorCount = normalizePositive(options.predictorCount, 1)
  const safeCandidateCount = Numeric.max(
    1,
    Numeric.max(
      normalizePositive(options.demoCandidateCount, 1),
      normalizePositive(options.instructionCandidateCount, 1)
    )
  )
  const logarithmicBudget = 2 * safePredictorCount * Numeric.log(safeCandidateCount)
  const explorationBudget = (3 * safeCandidateCount) / 2

  return Numeric.max(
    normalizePositive(Option.getOrElse(Option.fromNullable(options.minimum), () => 1), 1),
    Numeric.ceil(Numeric.max(logarithmicBudget, explorationBudget))
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
  seed: normalizeSeed(Option.getOrElse(Option.fromNullable(options.seed), () => 1)),
  minibatchSize: normalizePositive(Option.getOrElse(Option.fromNullable(options.minibatchSize), () => 50), 1),
  fullEvalEvery: normalizePositive(Option.getOrElse(Option.fromNullable(options.fullEvalEvery), () => 5), 1)
})
