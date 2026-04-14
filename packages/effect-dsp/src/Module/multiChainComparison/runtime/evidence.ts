/**
 * Candidate evidence accumulation for `Module.multiChainComparison`.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import type { Schema } from "effect"
import { Effect, FiberRef } from "effect"

import { Usage } from "../../../contracts/Usage.js"
import * as Trace from "../../../Trace/index.js"
import type { ChainOfThoughtOutputFields } from "../../chainOfThought/schema.js"
import type { Module } from "../../model.js"

/**
 * Candidate-local output, trace, and usage evidence captured during one
 * multi-chain comparison run before it is replayed into the parent fiber.
 *
 * @since 0.2.0
 * @category type-level
 */
export type CandidateRun<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> = Readonly<{
  readonly candidateIndex: number
  readonly module: Module<I, ChainOfThoughtOutputFields<O>>
  readonly output: Schema.Schema.Type<Schema.Struct<ChainOfThoughtOutputFields<O>>>
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
 * Replays candidate-local trace and usage evidence back into the parent fiber.
 *
 * @since 0.2.0
 * @category constructors
 * @internal
 */
export const MultiChainComparisonEvidence = {
  append: <
    I extends Schema.Struct.Fields,
    O extends Schema.Struct.Fields
  >(candidateRuns: ReadonlyArray<CandidateRun<I, O>>) =>
    Effect.forEach(
      candidateRuns,
      (candidateRun) =>
        Effect.zipRight(
          Effect.forEach(candidateRun.traces, Trace.append, { discard: true }),
          appendUsage(candidateRun.usage)
        ),
      { discard: true }
    )
}
