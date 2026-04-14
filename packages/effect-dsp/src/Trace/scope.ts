/**
 * Trace + usage scoping combinators.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, FiberRef } from "effect"
import { Usage } from "../contracts/Usage.js"
import type { Entry } from "./model.js"
import { TraceEnabledRef, TraceRef, UsageEnabledRef, UsageRef } from "./refs.js"

const nestedTraceDelta = (before: ReadonlyArray<Entry>, after: ReadonlyArray<Entry>): ReadonlyArray<Entry> =>
  Arr.drop(after, before.length)

const nestedTracingScope = <A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<readonly [A, ReadonlyArray<Entry>], E, R> =>
  Effect.gen(function*() {
    const before = yield* FiberRef.get(TraceRef)
    const result = yield* program
    const after = yield* FiberRef.get(TraceRef)

    return Data.tuple(result, nestedTraceDelta(before, after))
  })

const freshTracingScope = <A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<readonly [A, ReadonlyArray<Entry>], E, R> =>
  Effect.gen(function*() {
    const result = yield* program
    const traces = yield* FiberRef.get(TraceRef)

    return Data.tuple(result, traces)
  }).pipe(
    Effect.locally(TraceEnabledRef, true),
    Effect.locally(TraceRef, [])
  )

const nestedUsageScope = <A, E, R>(program: Effect.Effect<A, E, R>): Effect.Effect<readonly [A, Usage], E, R> =>
  Effect.gen(function*() {
    const before = yield* FiberRef.get(UsageRef)
    const result = yield* program
    const after = yield* FiberRef.get(UsageRef)

    return Data.tuple(result, Usage.delta({ before, after }))
  })

const freshUsageScope = <A, E, R>(program: Effect.Effect<A, E, R>): Effect.Effect<readonly [A, Usage], E, R> =>
  Effect.gen(function*() {
    const result = yield* program
    const usage = yield* FiberRef.get(UsageRef)

    return Data.tuple(result, usage)
  }).pipe(
    Effect.locally(UsageEnabledRef, true),
    Effect.locally(UsageRef, Usage.empty)
  )

/**
 * Run a program with trace collection enabled and return the result paired
 * with all collected entries. Nested scopes return only entries added during
 * the inner run.
 *
 * @example
 * ```ts
 * import { Trace } from "effect-dsp"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // ... build and call a module ...
 *   return "done"
 * })
 *
 * // [result, traces] — traces contains all Entry records
 * const traced = Trace.withTracing(program)
 * ```
 *
 * @since 0.1.0
 * @category combinators
 */
export const withTracing = <A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<readonly [A, ReadonlyArray<Entry>], E, R> =>
  Effect.gen(function*() {
    const tracingEnabled = yield* FiberRef.get(TraceEnabledRef)

    return yield* Effect.if(tracingEnabled, {
      onTrue: () => nestedTracingScope(program),
      onFalse: () => freshTracingScope(program)
    })
  })

/**
 * Run a program with usage accounting enabled and return the result paired
 * with cumulative token usage. Nested scopes return usage deltas.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withUsageTracking = <A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<readonly [A, Usage], E, R> =>
  Effect.gen(function*() {
    const usageEnabled = yield* FiberRef.get(UsageEnabledRef)

    return yield* Effect.if(usageEnabled, {
      onTrue: () => nestedUsageScope(program),
      onFalse: () => freshUsageScope(program)
    })
  })

/**
 * Read traces collected in the current scope. Returns an empty array when
 * tracing is not enabled.
 *
 * @since 0.1.0
 * @category combinators
 */
export const get: Effect.Effect<ReadonlyArray<Entry>> = Effect.gen(function*() {
  const tracingEnabled = yield* FiberRef.get(TraceEnabledRef)

  return yield* Effect.if(tracingEnabled, {
    onTrue: () => FiberRef.get(TraceRef),
    onFalse: () => Effect.succeed(Arr.empty<Entry>())
  })
})
