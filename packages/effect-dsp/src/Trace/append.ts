/**
 * Trace + usage append combinators.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, FiberRef } from "effect"
import { accumulateUsage, type UsageSample } from "../contracts/Usage.js"
import type { Entry } from "./model.js"
import { TraceEnabledRef, TraceRef, UsageEnabledRef, UsageRef } from "./refs.js"

/**
 * Appends an entry to the current tracing scope, or does nothing outside one.
 *
 * @since 0.1.0
 * @category combinators
 */
export const append = (entry: Entry): Effect.Effect<void> =>
  Effect.gen(function*() {
    const tracingEnabled = yield* FiberRef.get(TraceEnabledRef)

    return yield* Effect.if(tracingEnabled, {
      onTrue: () => FiberRef.update(TraceRef, (entries) => Arr.append(entries, entry)),
      onFalse: () => Effect.void
    })
  })

/**
 * Adds a usage sample to the current usage scope, or does nothing outside one.
 * Missing token counts contribute zero; every sample increments `callCount`.
 *
 * @since 0.1.0
 * @category combinators
 */
export const appendUsage = (sample: UsageSample): Effect.Effect<void> =>
  Effect.gen(function*() {
    const usageEnabled = yield* FiberRef.get(UsageEnabledRef)

    return yield* Effect.if(usageEnabled, {
      onTrue: () => FiberRef.update(UsageRef, (usage) => accumulateUsage(usage, sample)),
      onFalse: () => Effect.void
    })
  })

/**
 * Runs {@link append}, then {@link appendUsage}.
 *
 * @since 0.1.0
 * @category combinators
 */
export const appendExecution = (options: {
  readonly entry: Entry
  readonly usage: UsageSample
}): Effect.Effect<void> => Effect.zipRight(append(options.entry), appendUsage(options.usage))
