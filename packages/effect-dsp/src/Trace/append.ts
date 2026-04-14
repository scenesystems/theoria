/**
 * Trace + usage append combinators.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, FiberRef } from "effect"
import { Usage, type UsageSample } from "../contracts/Usage.js"
import type { Entry } from "./model.js"
import { TraceEnabledRef, TraceRef, UsageEnabledRef, UsageRef } from "./refs.js"

/**
 * Append a trace entry to the fiber-local collection when tracing is enabled.
 * No-ops silently when `TraceEnabledRef` is `false`.
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
 * Accumulate a usage sample into the fiber-local usage totals when tracking is
 * enabled.
 *
 * @since 0.1.0
 * @category combinators
 */
export const appendUsage = (sample: UsageSample): Effect.Effect<void> =>
  Effect.gen(function*() {
    const usageEnabled = yield* FiberRef.get(UsageEnabledRef)

    return yield* Effect.if(usageEnabled, {
      onTrue: () => FiberRef.update(UsageRef, (usage) => Usage.accumulate(usage, sample)),
      onFalse: () => Effect.void
    })
  })

/**
 * Append both a trace entry and a usage sample in one call — the canonical
 * path for module forward functions.
 *
 * @since 0.1.0
 * @category combinators
 */
export const appendExecution = (options: {
  readonly entry: Entry
  readonly usage: UsageSample
}): Effect.Effect<void> => Effect.zipRight(append(options.entry), appendUsage(options.usage))
