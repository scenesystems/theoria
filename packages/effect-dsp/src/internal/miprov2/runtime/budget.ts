/**
 * Phase 3 trial budget and cadence — controls how many trials to run and when
 * to evaluate the full validation set.
 *
 * @since 0.1.0
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Boolean as Bool, Match, Number as Num, Option, Schema } from "effect"

const Phase3TrialBudgetOptions = Schema.Struct({
  predictorCount: Schema.Finite,
  demoCandidateCount: Schema.Finite,
  instructionCandidateCount: Schema.Finite,
  minimum: Schema.optional(Schema.Finite)
})

type Phase3TrialBudgetOptions = typeof Phase3TrialBudgetOptions.Type

const Phase3CadenceOptions = Schema.Struct({
  seed: Schema.optional(Schema.Finite),
  minibatchSize: Schema.optional(Schema.Finite),
  fullEvalEvery: Schema.optional(Schema.Finite)
})

type Phase3CadenceOptions = typeof Phase3CadenceOptions.Type

const Phase3Cadence = Schema.Struct({
  seed: Schema.Finite,
  minibatchSize: Schema.Finite,
  fullEvalEvery: Schema.Finite
})

type Phase3Cadence = typeof Phase3Cadence.Type

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
    Match.when(Num.isLessThanOrEqualTo(0), () => fallback),
    Match.orElse((candidate) => candidate)
  )
}

/**
 * Computes the recommended number of Bayesian search trials for Phase 3.
 *
 * @remarks
 * The budget is the larger of a logarithmic estimate
 * (`2 × dimensions × log2(candidates)`) and an exploration floor
 * (`1.5 × candidates`), truncated to an integer. Few-shot search has
 * two dimensions per predictor; zero-shot has one.
 *
 * @since 0.1.0
 * @category utils
 */
export const phase3TrialBudget = (options: Phase3TrialBudgetOptions): number => {
  const safePredictorCount = normalizePositive(options.predictorCount, 1)
  const safeCandidateCount = Numeric.max(
    1,
    Numeric.max(
      normalizePositive(options.demoCandidateCount, 1),
      normalizePositive(options.instructionCandidateCount, 1)
    )
  )
  const dimensions = Num.multiply(
    safePredictorCount,
    Bool.match(Num.isGreaterThan(options.demoCandidateCount, 0), { onFalse: () => 1, onTrue: () => 2 })
  )
  const logarithmicBudget = Num.multiply(
    Num.multiply(2, dimensions),
    Num.divideUnsafe(Numeric.log(safeCandidateCount), Numeric.log(2))
  )
  const explorationBudget = Num.multiply(Num.multiply(3, safeCandidateCount), 0.5)

  return Numeric.max(
    normalizePositive(Option.getOrElse(Option.fromNullishOr(options.minimum), () => 1), 1),
    Numeric.floor(Numeric.max(logarithmicBudget, explorationBudget))
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
export const resolvePhase3Cadence = (options: Phase3CadenceOptions): Phase3Cadence => ({
  seed: Option.getOrElse(Option.fromNullishOr(options.seed), () => 9),
  minibatchSize: normalizePositive(Option.getOrElse(Option.fromNullishOr(options.minibatchSize), () => 35), 1),
  fullEvalEvery: normalizePositive(Option.getOrElse(Option.fromNullishOr(options.fullEvalEvery), () => 5), 1)
})
