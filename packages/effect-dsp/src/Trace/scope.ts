/**
 * Trace + usage scoping combinators.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, FiberRef } from "effect"
import { emptyUsage, type Usage, usageDelta } from "../contracts/Usage.js"
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

    return Data.tuple(result, usageDelta({ before, after }))
  })

const freshUsageScope = <A, E, R>(program: Effect.Effect<A, E, R>): Effect.Effect<readonly [A, Usage], E, R> =>
  Effect.gen(function*() {
    const result = yield* program
    const usage = yield* FiberRef.get(UsageRef)

    return Data.tuple(result, usage)
  }).pipe(
    Effect.locally(UsageEnabledRef, true),
    Effect.locally(UsageRef, emptyUsage)
  )

/**
 * Collects entries appended while a program runs.
 *
 * @remarks
 * A top-level scope starts with an empty fiber-local collection. A nested
 * scope shares its parent's collection but returns only entries appended
 * during the nested program; those entries remain visible to the parent.
 * Concurrent top-level scopes keep separate collections. If the program
 * fails, its failure and requirements are preserved and no tuple is returned.
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
 * Accumulates usage samples while a program runs.
 *
 * @remarks
 * A top-level scope starts from zero. A nested scope returns the difference
 * between usage before and after its program, while the parent retains the
 * same additions. Program failures and requirements are preserved.
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
 * Reads all entries currently visible in this fiber's tracing scope.
 * Returns an empty array outside a scope.
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
