/**
 * Branch evidence accumulation for `Module.parallel`.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import type { Schema } from "effect"
import { Effect, FiberRef } from "effect"

import { Usage } from "../../../contracts/Usage.js"
import * as Trace from "../../../Trace/index.js"

/**
 * Branch-local output, trace, and usage evidence captured during one parallel
 * branch execution before it is replayed into the parent fiber.
 *
 * @since 0.2.0
 * @category type-level
 */
export type BranchResult<O extends Schema.Struct.Fields> = Readonly<{
  readonly branchIndex: number
  readonly output: Schema.Schema.Type<Schema.Struct<O>>
  readonly traces: ReadonlyArray<Trace.Entry>
  readonly usage: Usage
}>

const appendUsage = (usage: Usage) =>
  Effect.gen(function*() {
    const usageEnabled = yield* FiberRef.get(Trace.UsageEnabledRef)

    return yield* Effect.if(usageEnabled, {
      onTrue: () =>
        FiberRef.update(
          Trace.UsageRef,
          (current) =>
            Usage.make({
              inputTokens: current.inputTokens + usage.inputTokens,
              outputTokens: current.outputTokens + usage.outputTokens,
              callCount: current.callCount + usage.callCount,
              cachedCount: current.cachedCount + usage.cachedCount
            })
        ),
      onFalse: () => Effect.void
    })
  })

/**
 * Replays branch-local trace and usage evidence back into the parent fiber.
 *
 * @since 0.2.0
 * @category constructors
 * @internal
 */
export const ParallelEvidence = {
  append: <O extends Schema.Struct.Fields>(branches: ReadonlyArray<BranchResult<O>>) =>
    Effect.forEach(
      branches,
      (branch) =>
        Effect.zipRight(
          Effect.forEach(branch.traces, Trace.append, { discard: true }),
          appendUsage(branch.usage)
        ),
      { discard: true }
    )
}
