/**
 * Fixed-input studies without a search space, sampler, or numeric objective.
 *
 * @since 0.1.0
 * @module
 */
import {
  Array as Arr,
  Cause,
  Chunk,
  Duration,
  Effect,
  Exit,
  Match,
  Number,
  Option,
  Ref,
  Result,
  Schema,
  Tuple
} from "effect"

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
  concurrency: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0)))
}).annotate({ identifier: "@scenesystems/effect-study/Evaluation/Options" })

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
 * @category operations
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
          Effect.map(([duration, value]): Trial.Trial<Config, Trial.Completed<Value>> => ({
            trialNumber,
            config,
            state: {
              _tag: "Completed",
              value,
              duration: Duration.toMillis(duration)
            }
          })),
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
                Match.value(Cause.hasInterruptsOnly(cause)).pipe(
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

/** Expected failure budget exhausted after active evaluators finish.
 * @since 0.2.0
 * @category errors
 */
export class TooManyFailures
  extends Schema.TaggedError<TooManyFailures>("@scenesystems/effect-study/Evaluation/TooManyFailures")(
    "TooManyFailures",
    {
      count: Schema.Int,
      limit: Schema.Int
    }
  )
{}

/** Ordered collection with an optional expected-failure budget.
 * @since 0.2.0
 * @category schemas
 */
export const CollectingOptions = Schema.Struct({
  ...Options.fields,
  maxFailures: Schema.Option(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  onFailure: Schema.Literal("record")
}).annotate({ identifier: "@scenesystems/effect-study/Evaluation/CollectingOptions" })

/** Collects expected failures as trials in input order. Exceeding the failure
 * budget stops new evaluations, drains active work, then fails with the final
 * failure count. Defects and interruption propagate and interrupt siblings.
 * Durations include the evaluator's finalizers, not queue time.
 * @since 0.2.0
 * @category operations
 */
export const runCollecting = <Config, Value, E, R>(
  inputs: Iterable<Config>,
  evaluate: (config: Config, trialNumber: number) => Effect.Effect<Value, E, R>,
  options: typeof CollectingOptions.Type
): Effect.Effect<Chunk.Chunk<Trial.Trial<Config, Trial.Completed<Value> | Trial.Failed<E>>>, TooManyFailures, R> =>
  Effect.gen(function*() {
    const failures = yield* Ref.make(0)
    const trials = yield* Effect.forEach(inputs, (config, trialNumber) =>
      Effect.gen(function*() {
        const count = yield* Ref.get(failures)
        if (Option.exists(options.maxFailures, (limit) => count > limit)) return Option.none()
        const [duration, result] = yield* Effect.suspend(() => evaluate(config, trialNumber)).pipe(
          Effect.result,
          Effect.timed
        )
        if (Result.isFailure(result)) yield* Ref.update(failures, Number.increment)
        const state = Result.match(result, {
          onFailure: (error): Trial.Failed<E> => ({ _tag: "Failed", error, duration: Duration.toMillis(duration) }),
          onSuccess: (value): Trial.Completed<Value> => ({
            _tag: "Completed",
            value,
            duration: Duration.toMillis(duration)
          })
        })
        return Option.some({ trialNumber, config, state })
      }), { concurrency: Option.getOrElse(Option.fromUndefinedOr(options.concurrency), () => 1) })
    const count = yield* Ref.get(failures)
    if (Option.isSome(options.maxFailures) && count > options.maxFailures.value) {
      return yield* new TooManyFailures({ count, limit: options.maxFailures.value })
    }
    return Chunk.fromIterable(Arr.filterMap(trials, (trial) => Result.fromOption(trial, () => void 0)))
  })
