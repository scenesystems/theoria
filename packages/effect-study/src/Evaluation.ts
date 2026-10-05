/**
 * Fixed-input studies without a search space, sampler, or numeric objective.
 *
 * @since 0.1.0
 * @module
 */
import {
  Array as Arr,
  Cause,
  Duration,
  Effect,
  Exit,
  Match,
  Option,
  Ref,
  Result,
  Schema,
  Semaphore,
  Tuple
} from "effect"
import type { Data } from "effect"

import type * as Emitter from "./Emitter.js"
import * as History from "./History.js"
import * as Study from "./Study.js"
import * as StudyEvent from "./StudyEvent.js"
import type * as Trial from "./Trial.js"

const completedEvent = StudyEvent.Completed(Schema.Literal("Settled"))

/**
 * Bounds concurrent evaluations. Omission runs inputs sequentially.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Options = Schema.Struct({
  concurrency: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0)))
}).annotate({ identifier: "@scenesystems/effect-study/Evaluation/Options" })

/** An expected outcome, retaining caller-owned values and failures. @since 0.1.0 @category models */
export type SettledTrial<Config, Value, E> = Trial.Trial<Config, Trial.Completed<Value> | Trial.Failed<E>>

/**
 * Incremental evidence for one fixed-input evaluation. Planned input positions are
 * trial numbers. TrialSettled contains the full expected outcome and duration.
 * Terminated carries a native defect/interruption cause, not a domain failure.
 * These generic in-memory events do not require codecs for caller-owned values.
 *
 * @since 0.1.0
 * @category models
 */
export type EvaluationEvent<Config, Value, E> = Data.TaggedEnum<{
  Planned: { readonly inputs: ReadonlyArray<Config> }
  TrialStarted: { readonly trialNumber: number; readonly config: Config }
  TrialSettled: { readonly trial: SettledTrial<Config, Value, E> }
  Completed: { readonly completionReason: "Settled" }
  Terminated: { readonly cause: Cause.Cause<never> }
}>

const settle = <Config, Value, E, R>(
  config: Config,
  trialNumber: number,
  evaluate: (config: Config, trialNumber: number) => Effect.Effect<Value, E, R>
): Effect.Effect<SettledTrial<Config, Value, E>, never, R> =>
  Effect.suspend(() => evaluate(config, trialNumber)).pipe(
    Effect.result,
    Effect.timed,
    Effect.map(([duration, outcome]) => ({
      config,
      trialNumber,
      state: Result.match(outcome, {
        onSuccess: (value): Trial.Completed<Value> => ({
          _tag: "Completed",
          value,
          duration: Duration.toMillis(duration)
        }),
        onFailure: (error): Trial.Failed<E> => ({ _tag: "Failed", error, duration: Duration.toMillis(duration) })
      })
    }))
  )

/**
 * Returns every expected outcome in input order, including typed evaluator failures.
 * Empty inputs succeed with no records. Defects and interruption terminate the Effect
 * and await active sibling finalizers; they never become failed trial records.
 * Duration measures evaluation only. Services required by the evaluator are retained.
 *
 * @since 0.1.0
 * @category operations
 */
export const runSettled = <Config, Value, E, R>(
  inputs: Iterable<Config>,
  evaluate: (config: Config, trialNumber: number) => Effect.Effect<Value, E, R>,
  options: typeof Options.Type = {}
): Effect.Effect<ReadonlyArray<SettledTrial<Config, Value, E>>, never, R> =>
  Effect.forEach(inputs, (config, trialNumber) => settle(config, trialNumber, evaluate), options)

/**
 * Settled evaluation with serialized, awaited observations. Start acknowledgment
 * precedes evaluator invocation; terminal acknowledgment precedes publication in
 * the returned records. Completed is acknowledged only after every terminal record.
 * Observer failure closes admission before releasing the observer serializer and
 * interrupts active local work, awaiting its finalizers. It is never a trial failure
 * and is never reported recursively to the same observer.
 *
 * Observation order is independent of returned input order. Acknowledgment means
 * whatever the sink guarantees, not necessarily durability. Termination reporting
 * is best effort: unavailable observers leave starts unresolved. Local interruption
 * does not confirm remote cancellation or authorize repeating external effects.
 * Use Emitter.toStream to derive a scoped stream (queue acceptance only).
 *
 * @since 0.1.0
 * @category operations
 */
export const runWithEvents = <Config, Value, E, R, OE, OR>(
  inputs: Iterable<Config>,
  evaluate: (config: Config, trialNumber: number) => Effect.Effect<Value, E, R>,
  options: typeof Options.Type,
  observe: Emitter.Emitter<EvaluationEvent<Config, Value, E>, OE, OR>
): Effect.Effect<ReadonlyArray<SettledTrial<Config, Value, E>>, OE, R | OR> =>
  Effect.gen(function*() {
    const plan = Arr.fromIterable(inputs)
    const serializer = yield* Semaphore.make(1)
    const closed = yield* Ref.make(Option.none<Cause.Cause<OE>>())
    const emit = (event: EvaluationEvent<Config, Value, E>): Effect.Effect<void, OE, OR> =>
      serializer.withPermit(Effect.gen(function*() {
        const failure = yield* Ref.get(closed)
        if (Option.isSome(failure)) return yield* Effect.failCause(failure.value)
        yield* Effect.suspend(() => observe(event)).pipe(
          Effect.onError((cause) => Ref.set(closed, Option.some(cause)))
        )
      }))
    return yield* Effect.gen(function*() {
      yield* emit({ _tag: "Planned", inputs: plan })
      const trials = yield* Effect.forEach(plan, (config, trialNumber) =>
        Effect.gen(function*() {
          yield* emit({ _tag: "TrialStarted", config, trialNumber })
          const trial = yield* Effect.suspend(() => {
            const failure = Ref.getUnsafe(closed)
            if (Option.isSome(failure)) return Effect.failCause(failure.value)
            return settle(config, trialNumber, evaluate)
          })
          yield* emit({ _tag: "TrialSettled", trial })
          return trial
        }), options)
      yield* emit(completedEvent.make({ completionReason: "Settled" }))
      return trials
    }).pipe(Effect.onError((cause) =>
      Effect.gen(function*() {
        if (Option.isSome(yield* Ref.get(closed))) return
        yield* Result.match(Cause.findError(cause), {
          onSuccess: () => Effect.void,
          onFailure: (termination) => emit({ _tag: "Terminated", cause: termination }).pipe(Effect.ignoreCause)
        })
      })
    ))
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
