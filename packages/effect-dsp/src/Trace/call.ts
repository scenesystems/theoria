/**
 * Per-invocation usage observation and call lifecycle tracking.
 *
 * @since 0.1.0
 */
import type * as Response from "@effect/ai/Response"
import { Boolean, Cause, Clock, Context, Data, Effect, Exit, Number, Option, Ref } from "effect"
import { appendCall } from "./append.js"
import { Call } from "./model.js"

class InvocationUsage extends Context.Tag("effect-dsp/Trace/InvocationUsage")<
  InvocationUsage,
  Ref.Ref<Option.Option<Response.Usage>>
>() {}

/**
 * Retains provider usage for the innermost tracked model invocation.
 * Outside a tracked invocation this operation does nothing.
 *
 * @param usage - Native usage observed from a provider response.
 *
 * @since 0.4.0
 * @category combinators
 */
export const observeUsage = (usage: Response.Usage): Effect.Effect<void> =>
  Effect.serviceOption(InvocationUsage).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.void,
        onSome: (usageRef) => Ref.set(usageRef, Option.some(usage))
      })
    )
  )

const outcomeFromExit = <A, E>(exit: Exit.Exit<A, E>): Call["outcome"] =>
  Exit.match(exit, {
    onSuccess: () => "success",
    onFailure: (cause) =>
      Boolean.match(Cause.isInterruptedOnly(cause), {
        onFalse: () => "failure",
        onTrue: () => "interrupted"
      })
  })

/**
 * Tracks one DSP-visible model invocation and appends exactly one terminal call.
 *
 * @remarks
 * This helper is intentionally omitted from the public Trace entry point.
 * Success pairs the unchanged response with the same usage recorded in the call.
 * Early {@link observeUsage} evidence wins wholesale, including unknown counters;
 * successful response usage is only a fallback when no observation was made.
 * Typed failures, defects, and interruption propagate unchanged. Only accounting
 * is masked; the provider retains its original interruptibility. One DSP-visible
 * call is not guaranteed to correspond to one physical provider attempt.
 *
 * @since 0.1.0
 * @category combinators
 */
export const trackCall = <A, E, R>(
  operation: Call["operation"],
  program: Effect.Effect<A, E, R>,
  usageOf: (value: A) => Response.Usage
) =>
  Effect.uninterruptibleMask((restore) =>
    Effect.gen(function*() {
      const startedAt = yield* Clock.currentTimeMillis
      const usageRef = yield* Ref.make<Option.Option<Response.Usage>>(Option.none())
      const invocation: Effect.Effect<A, E, R> = restore(program).pipe(
        Effect.provideService(InvocationUsage, usageRef)
      )
      const exit = yield* Effect.exit(invocation)
      const observed = yield* Ref.get(usageRef)
      const result = Exit.map(exit, (value) => Data.tuple(value, Option.getOrElse(observed, () => usageOf(value))))
      const timestamp = yield* Clock.currentTimeMillis

      yield* appendCall(
        new Call({
          operation,
          usage: Exit.match(result, {
            onFailure: () => observed,
            onSuccess: ([, usage]) => Option.some(usage)
          }),
          outcome: outcomeFromExit(exit),
          durationMs: Number.subtract(timestamp, startedAt),
          timestamp
        })
      )

      return yield* result
    })
  )
