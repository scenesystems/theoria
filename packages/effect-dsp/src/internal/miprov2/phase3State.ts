/** Full-validation selection and mean minibatch ranking for MIPROv2. @internal */
import { Array as Arr, Effect, Number as Num, Option, Schema } from "effect"
import { MIPROv2Error } from "../../DspError.js"
import type { TrialEvaluation } from "../../MIPROv2.js"
import { Phase3Config } from "./runtime/model.js"

const sameConfig = Schema.toEquivalence(Phase3Config)

/** Earliest full evaluation wins ties; minibatch scores never enter this ranking. @internal */
export const bestFullEvaluation = (evaluations: ReadonlyArray<TrialEvaluation>): Option.Option<TrialEvaluation> =>
  Arr.reduce(evaluations, Option.none<TrialEvaluation>(), (best, evaluation) =>
    evaluation.fullValidation
      ? Option.some(Option.match(best, {
        onNone: () => evaluation,
        onSome: (current) => Num.isGreaterThan(evaluation.score, current.score) ? evaluation : current
      }))
      : best)

/** Highest mean minibatch score among combinations not yet checkpointed. @internal */
export const nextFullEvaluation = (evaluations: ReadonlyArray<TrialEvaluation>) => {
  const minibatches = Arr.filter(evaluations, (evaluation) => !evaluation.fullValidation)
  const candidates = Arr.dedupeWith(Arr.map(minibatches, (evaluation) => evaluation.config), sameConfig)
  const remaining = Arr.filter(
    candidates,
    (config) =>
      !Arr.some(evaluations, (evaluation) =>
        evaluation.fullValidation && !evaluation.sampled && evaluation.trial > 0 &&
        sameConfig(config, evaluation.config))
  )
  const ranked = Arr.map(remaining, (config) => {
    const scores = Arr.map(
      Arr.filter(minibatches, (evaluation) => sameConfig(config, evaluation.config)),
      (evaluation) => Num.multiply(evaluation.score, 100)
    )
    return { config, score: Num.divideUnsafe(Num.sumAll(scores), scores.length) }
  })
  return Effect.fromOption(
    Arr.reduce(ranked, Option.none<typeof ranked[number]>(), (best, candidate) =>
      Option.some(Option.match(best, {
        onNone: () => candidate,
        onSome: (current) => Num.isGreaterThan(candidate.score, current.score) ? candidate : current
      }))),
    () =>
      new MIPROv2Error({
        reason: "exhausted-candidates",
        message: "No valid program found in param_score_dict"
      })
  ).pipe(Effect.map((candidate) => candidate.config))
}
