/**
 * Recording operations used by traced module execution.
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
 * @param entry - Complete invocation record added without copying or redaction.
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
 * @param sample - Provider usage and cache status for one model call.
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
 * Records an invocation and its usage sample in the active scopes.
 *
 * @remarks
 * The trace entry is appended before usage is accumulated. Either operation is a
 * no-op when its corresponding scope is disabled.
 *
 * @param options - Invocation record and usage sample from the same model call.
 *
 * @since 0.1.0
 * @category combinators
 */
export const appendExecution = (options: {
  readonly entry: Entry
  readonly usage: UsageSample
}): Effect.Effect<void> => Effect.zipRight(append(options.entry), appendUsage(options.usage))
