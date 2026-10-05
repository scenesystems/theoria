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
  Number as Num,
  Option,
  Ref,
  Result,
  Schema,
  Semaphore,
  Tuple
} from "effect"

import type * as Emitter from "./Emitter.js"
import * as History from "./History.js"
import * as Study from "./Study.js"
import * as StudyEvent from "./StudyEvent.js"
import * as Trial from "./Trial.js"

const completedEvent = StudyEvent.Completed(Schema.Literal("Settled"))
const trialNumber = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const Planned = Schema.TaggedStruct("Planned", {})
const TrialStarted = Schema.TaggedStruct("TrialStarted", { trialNumber })
const TrialSettled = Schema.TaggedStruct("TrialSettled", {})
const Terminated = Schema.TaggedStruct("Terminated", {})

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
 * Generic fields substitute into the same schema metadata as RecordedEvent, as
 * in Trial's generic model. Only the encoded boundary adds a defect codec and
 * explicit caller-supplied TrialInterrupted evidence.
 *
 * @since 0.1.0
 * @category models
 */
export type EvaluationEvent<Config, Value, E> = Schema.Schema.Type<
  Schema.Union<
    readonly [
      Schema.Struct<typeof Planned.fields & { readonly inputs: Schema.Schema<ReadonlyArray<Config>> }>,
      Schema.Struct<typeof TrialStarted.fields & { readonly config: Schema.Schema<Config> }>,
      Schema.Struct<typeof TrialSettled.fields & { readonly trial: Schema.Schema<SettledTrial<Config, Value, E>> }>,
      typeof completedEvent,
      Schema.Struct<typeof Terminated.fields & { readonly cause: Schema.Schema<Cause.Cause<E>> }>
    ]
  >
>

const TrialInterrupted = Schema.TaggedStruct("TrialInterrupted", { trialNumber })
const NotStarted = Schema.TaggedStruct("NotStarted", {})
const Unresolved = Schema.TaggedStruct("Unresolved", {})
const LocallyInterrupted = Schema.TaggedStruct("LocallyInterrupted", {})
const Pending = Schema.Union([NotStarted, Unresolved, LocallyInterrupted])
const ViewMetadata = Schema.Struct({ status: Schema.Literals(["Unplanned", "Planned", "Completed", "Terminated"]) })

/**
 * JSON codec for evaluation observations with caller-owned input, value, error,
 * and defect codecs. Also accepts explicit per-trial local interruption evidence
 * supplied by a caller that observed local cleanup. runWithEvents does not emit
 * that additional event or infer remote cancellation. Native Causes round-trip.
 * @since 0.1.0
 * @category schemas
 */
export const RecordedEvent = <
  C extends Schema.Constraint,
  A extends Schema.Constraint,
  E extends Schema.Constraint,
  D extends Schema.Constraint
>(config: C, value: A, error: E, defect: D) =>
  Schema.Union([
    Schema.Struct({ ...Planned.fields, inputs: Schema.Array(config) }),
    Schema.Struct({ ...TrialStarted.fields, config }),
    Schema.Struct({
      ...TrialSettled.fields,
      trial: Trial.Trial(config, Schema.Union([Trial.Completed(value), Trial.Failed(error)]))
    }),
    completedEvent,
    Schema.Struct({ ...Terminated.fields, cause: Schema.Cause(error, defect) }),
    TrialInterrupted
  ]).pipe(Schema.toCodecJson).annotate({ identifier: "@scenesystems/effect-study/Evaluation/RecordedEvent" })

/** Retained observations, including optional explicit local interruption evidence. @since 0.1.0 @category models */
export type RecordedEvent<C, A, E> = EvaluationEvent<C, A, E> | typeof TrialInterrupted.Type

/**
 * JSON checkpoint codec for a reconstructed fixed plan. Unresolved means a start
 * was retained without terminal evidence; NotStarted means no start was retained.
 * Neither claims whether an external effect happened. Cause codec services remain
 * native, and callers choose how defects can be serialized (for example Schema.Defect()).
 * @since 0.1.0
 * @category schemas
 */
export const View = <
  C extends Schema.Constraint,
  A extends Schema.Constraint,
  E extends Schema.Constraint,
  D extends Schema.Constraint
>(config: C, value: A, error: E, defect: D) =>
  Schema.Struct({
    ...ViewMetadata.fields,
    trials: Schema.Array(
      Trial.Trial(
        config,
        Schema.Union([Pending, Trial.Completed(value), Trial.Failed(error)])
      )
    ),
    cause: Schema.OptionFromNullOr(Schema.toCodecJson(Schema.Cause(error, defect)))
  }).pipe(Schema.toCodecJson).annotate({ identifier: "@scenesystems/effect-study/Evaluation/View" })

/** Decoded retained evaluation state, independent of execution and scoring. @since 0.1.0 @category models */
export type View<C, A, E> = Schema.Schema.Type<
  Schema.Struct<
    typeof ViewMetadata.fields & {
      readonly trials: Schema.Schema<
        ReadonlyArray<Trial.Trial<C, typeof Pending.Type | Trial.Completed<A> | Trial.Failed<E>>>
      >
      readonly cause: Schema.Schema<Option.Option<Cause.Cause<E>>>
    }
  >
>

/** Starts reconstruction before any plan has been acknowledged. @since 0.1.0 @category constructors */
export const empty = <C, A, E>(): View<C, A, E> => ({
  status: "Unplanned",
  trials: Arr.empty(),
  cause: Option.none()
})

/**
 * Pure reduction of a single evaluation's acknowledged observations. Supply the
 * original ordered log (or its checkpoint tail); recording owns identity deduplication.
 * A run-level Terminated observation deliberately leaves unresolved trials unresolved.
 * This projection assumes observations belong to the same fixed plan and does not
 * validate an application's domain semantics or authorize execution/reconciliation.
 * @since 0.1.0
 * @category operations
 */
export const reduce = <C, A, E>(self: View<C, A, E>, event: RecordedEvent<C, A, E>): View<C, A, E> =>
  Match.value(event).pipe(
    Match.tag("Planned", (event): View<C, A, E> => ({
      status: "Planned",
      cause: Option.none(),
      trials: Arr.map(event.inputs, (config, trialNumber) => ({ config, trialNumber, state: { _tag: "NotStarted" } }))
    })),
    Match.tag("TrialStarted", (event): View<C, A, E> => ({
      ...self,
      trials: Arr.map(
        self.trials,
        (trial) =>
          Num.Equivalence(trial.trialNumber, event.trialNumber) ? { ...trial, state: { _tag: "Unresolved" } } : trial
      )
    })),
    Match.tag("TrialSettled", (event): View<C, A, E> => ({
      ...self,
      trials: Arr.map(
        self.trials,
        (trial) => Num.Equivalence(trial.trialNumber, event.trial.trialNumber) ? event.trial : trial
      )
    })),
    Match.tag("TrialInterrupted", (event): View<C, A, E> => ({
      ...self,
      trials: Arr.map(
        self.trials,
        (trial) =>
          Num.Equivalence(trial.trialNumber, event.trialNumber) && trial.state._tag === "Unresolved"
            ? { ...trial, state: { _tag: "LocallyInterrupted" } }
            : trial
      )
    })),
    Match.tag("Completed", (): View<C, A, E> => ({ ...self, status: "Completed" })),
    Match.tag(
      "Terminated",
      (event): View<C, A, E> => ({ ...self, status: "Terminated", cause: Option.some(event.cause) })
    ),
    Match.exhaustive
  )

/** Coverage counts describe retained evidence, never a grading denominator. @since 0.1.0 @category schemas */
export const Coverage = Schema.Struct({
  planKnown: Schema.Boolean,
  planned: trialNumber,
  completed: trialNumber,
  failed: trialNumber,
  locallyInterrupted: trialNumber,
  unresolved: trialNumber,
  notStarted: trialNumber
}).annotate({ identifier: "@scenesystems/effect-study/Evaluation/Coverage" })

/** Projects coverage without inventing scores, failure weights, or remote cancellation. @since 0.1.0 @category accessors */
export const coverage = <C, A, E>(self: View<C, A, E>): typeof Coverage.Type => ({
  planKnown: self.status !== "Unplanned",
  planned: Arr.length(self.trials),
  completed: Arr.length(Arr.filter(self.trials, (trial) => trial.state._tag === "Completed")),
  failed: Arr.length(Arr.filter(self.trials, (trial) => trial.state._tag === "Failed")),
  locallyInterrupted: Arr.length(Arr.filter(self.trials, (trial) => trial.state._tag === "LocallyInterrupted")),
  unresolved: Arr.length(Arr.filter(self.trials, (trial) => trial.state._tag === "Unresolved")),
  notStarted: Arr.length(Arr.filter(self.trials, (trial) => trial.state._tag === "NotStarted"))
})

const settle = <Config, Value, E, R>(
  config: Config,
  trialNumber: number,
  evaluate: (config: Config, trialNumber: number) => Effect.Effect<Value, E, R>
): Effect.Effect<SettledTrial<Config, Value, E>, E, R> =>
  Effect.suspend(() => evaluate(config, trialNumber)).pipe(
    Effect.matchCauseEffect({
      onSuccess: (value) => Effect.succeed(Result.succeed(value)),
      onFailure: (cause) => {
        if (Cause.hasDies(cause) || Cause.hasInterrupts(cause)) return Effect.failCause(cause)
        return Result.match(Cause.findError(cause), {
          onSuccess: (error) => Effect.succeed(Result.fail(error)),
          onFailure: Effect.failCause
        })
      }
    }),
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
 * E remains in the error channel solely for compound causes that also contain a
 * defect or interruption: their original typed failure reasons are not discarded.
 *
 * @since 0.1.0
 * @category operations
 */
export const runSettled = <Config, Value, E, R>(
  inputs: Iterable<Config>,
  evaluate: (config: Config, trialNumber: number) => Effect.Effect<Value, E, R>,
  options: typeof Options.Type = {}
): Effect.Effect<ReadonlyArray<SettledTrial<Config, Value, E>>, E, R> =>
  Effect.forEach(inputs, (config, trialNumber) => settle(config, trialNumber, evaluate), options)

/**
 * Settled evaluation with serialized, awaited observations. Start acknowledgment
 * precedes evaluator invocation; terminal acknowledgment precedes publication in
 * the returned records. Completed is acknowledged only after every terminal record.
 * Observer failure closes admission before releasing the observer serializer and
 * interrupts active local work, awaiting its finalizers. It is never a trial failure
 * and is never reported recursively to the same observer.
 * As in runSettled, compound fatal causes preserve their E reasons alongside OE.
 *
 * Observation order is independent of returned input order. Acknowledgment means
 * whatever the sink guarantees, not necessarily durability. A transactional observer
 * must await its enclosing commit, not just an append's provisional receipt. Keep
 * that transaction local to each observation rather than the entire evaluation.
 * Termination reporting
 * is best effort and interruptible, including inside cleanup; an already-pending
 * interruption may skip it entirely. No hidden timeout or detached callback is
 * introduced. Unavailable observers leave starts unresolved. Local interruption
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
): Effect.Effect<ReadonlyArray<SettledTrial<Config, Value, E>>, E | OE, R | OR> =>
  Effect.gen(function*() {
    const plan = Arr.fromIterable(inputs)
    const serializer = yield* Semaphore.make(1)
    const closed = yield* Ref.make(Option.none<Cause.Cause<OE>>())
    const termination = yield* Ref.make(Option.none<Cause.Cause<E>>())
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
          const trial = yield* settle(
            config,
            trialNumber,
            (input, number) => Option.isSome(Ref.getUnsafe(closed)) ? Effect.interrupt : evaluate(input, number)
          ).pipe(
            Effect.onError((cause) => Ref.update(termination, Option.orElse(() => Option.some(cause))))
          )
          yield* emit({ _tag: "TrialSettled", trial })
          return trial
        }), options)
      yield* emit(completedEvent.make({ completionReason: "Settled" }))
      return trials
    }).pipe(Effect.onError((cause) =>
      Effect.gen(function*() {
        if (Option.isSome(yield* Ref.get(closed))) {
          return
        }
        const original = yield* Ref.get(termination)
        if (Option.isSome(original)) {
          yield* emit({ _tag: "Terminated", cause: original.value }).pipe(Effect.interruptible, Effect.ignoreCause)
          return
        }
        yield* Result.match(Cause.findError(cause), {
          onSuccess: () => Effect.void,
          onFailure: (termination) =>
            emit({ _tag: "Terminated", cause: termination }).pipe(Effect.interruptible, Effect.ignoreCause)
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
