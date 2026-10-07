/** Full-validation selection and mean minibatch ranking for MIPROv2. @internal */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Data, Effect, Number as Num, Option, Schema } from "effect"
import { MIPROv2Error } from "../../DspError.js"
import type { TrialEvaluation } from "../../MIPROv2.js"
import { Phase3Config } from "./runtime/model.js"

const sameConfig = Schema.toEquivalence(Phase3Config)

/** Earliest full evaluation wins ties; minibatch scores never enter this ranking. @internal */
export const bestFullEvaluation = (evaluations: ReadonlyArray<TrialEvaluation>): Option.Option<TrialEvaluation> =>
  Arr.reduce(evaluations, Option.none<TrialEvaluation>(), (best, evaluation) =>
    Bool.match(evaluation.fullValidation, {
      onFalse: () => best,
      onTrue: () =>
        Option.some(Option.match(best, {
          onNone: () => evaluation,
          onSome: (current) =>
            Bool.match(Num.isGreaterThan(evaluation.score, current.score), {
              onFalse: () => current,
              onTrue: () => evaluation
            })
        }))
    }))

/** A recorded trial and the exact rounded percentage told to the study for it. @internal */
export class ToldEvaluation extends Data.Class<{
  readonly evaluation: TrialEvaluation
  readonly percent: number
}> {}

/** Highest mean minibatch score among combinations not yet checkpointed.
 * Means use the told percentages, `sum(scores) / len(scores)` with CPython's
 * builtin sum, as DSPy's get_program_with_highest_avg_score; they are never
 * reconstructed from the public fraction.
 * @internal
 */
export const nextFullEvaluation = (rows: ReadonlyArray<ToldEvaluation>) => {
  const minibatches = Arr.filter(rows, (row) => !row.evaluation.fullValidation)
  const candidates = Arr.dedupeWith(Arr.map(minibatches, (row) => row.evaluation.config), sameConfig)
  const remaining = Arr.filter(
    candidates,
    (config) =>
      !Arr.some(rows, ({ evaluation }) =>
        evaluation.fullValidation && !evaluation.sampled && evaluation.trial > 0 &&
        sameConfig(config, evaluation.config))
  )
  const ranked = Arr.map(remaining, (config) => {
    const scores = Arr.map(
      Arr.filter(minibatches, (row) => sameConfig(config, row.evaluation.config)),
      (row) => row.percent
    )
    return { config, score: Num.divideUnsafe(Numeric.sumNeumaier(scores), Arr.length(scores)) }
  })
  return Effect.fromOption(
    Arr.reduce(ranked, Option.none<typeof ranked[number]>(), (best, candidate) =>
      Option.some(Option.match(best, {
        onNone: () => candidate,
        onSome: (current) =>
          Bool.match(Num.isGreaterThan(candidate.score, current.score), {
            onFalse: () => current,
            onTrue: () => candidate
          })
      }))),
    () =>
      new MIPROv2Error({
        reason: "exhausted-candidates",
        message: "No valid program found in param_score_dict"
      })
  ).pipe(Effect.map((candidate) => candidate.config))
}
