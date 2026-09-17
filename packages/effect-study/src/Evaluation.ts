/**
 * Fixed-input studies without a search space, sampler, or numeric objective.
 *
 * @since 0.1.0
 * @module
 */
import { Cause, Data, Duration, Effect, Exit, Match, Schema, Tuple } from "effect"

import * as History from "./History.js"
import * as Study from "./Study.js"
import type * as Trial from "./Trial.js"

/**
 * Bounds concurrent evaluations. Omission runs inputs sequentially.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Options = Schema.Struct({
  concurrency: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive()))
})

/**
 * Evaluates supplied inputs and returns completed trials in input order, numbered
 * from zero. Duration measures evaluation only, in milliseconds. The evaluator's
 * errors and service requirements remain in the returned Effect; failure or
 * interruption cancels in-flight siblings and waits for their finalizers.
 *
 * This fail-fast operation returns no partial history. Use the trial schemas and
 * History module when an application needs persisted or externally reported outcomes.
 *
 * @since 0.1.0
 * @category execution
 */
export const run = <Config, Value, E, R>(
  inputs: Iterable<Config>,
  evaluate: (config: Config, trialNumber: number) => Effect.Effect<Value, E, R>,
  options: typeof Options.Type = {}
) =>
  Effect.scoped(
    Effect.gen(function*() {
      const study = yield* Study.make<Config, Trial.Completed<Value>>()
      yield* Study.transition(study, "Running")

      const evaluations = Effect.forEach(inputs, (config, trialNumber) =>
        Effect.suspend(() =>
          evaluate(config, trialNumber)
        ).pipe(
          Effect.timed,
          Effect.map(([duration, value]): Trial.Trial<Config, Trial.Completed<Value>> =>
            Data.struct({
              trialNumber,
              config,
              state: Data.struct<Trial.Completed<Value>>({
                _tag: "Completed",
                value,
                duration: Duration.toMillis(duration)
              })
            })
          ),
          Effect.tap((trial) =>
            Study.modify(study, (state) =>
              Effect.succeed(Tuple.make(
                undefined,
                new Study.State({ lifecycle: state.lifecycle, history: History.set(state.history, trial) })
              )))
          )
        ), options).pipe(
          Effect.onExit((exit) =>
            Exit.match(exit, {
              onFailure: (cause) =>
                Match.value(Cause.isInterruptedOnly(cause)).pipe(
                  Match.when(true, () =>
                    Study.transition(study, "Cancelled")),
                  Match.orElse(() => Study.transition(study, "Failed"))
                ),
              onSuccess: () => Study.transition(study, "Completed")
            })
          )
        )

      yield* evaluations
      return History.values((yield* Study.read(study)).history)
    })
  )
