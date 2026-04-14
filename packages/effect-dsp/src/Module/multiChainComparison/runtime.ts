/**
 * `multiChainComparison` forward runtime orchestration.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import type * as AiError from "@effect/ai/AiError"
import { Array as Arr, Effect, type Schema } from "effect"
import { withRollout } from "../../Cache/refs.js"
import { Usage } from "../../contracts/Usage.js"
import type { DspError } from "../../Errors/union.js"
import type { Signature } from "../../Signature/model.js"
import * as Trace from "../../Trace/index.js"
import type { ChainOfThoughtOutputFields } from "../chainOfThought/schema.js"
import type { Module } from "../model.js"
import { type CandidateRun, MultiChainComparisonEvidence } from "./runtime/evidence.js"
import { MultiChainComparisonProjection } from "./runtime/projection.js"
import type { ComparisonInputFields } from "./signatures.js"

const candidateTrace = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly candidateIndex: number
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly module: Module<I, ChainOfThoughtOutputFields<O>>
  readonly seed: number
}) =>
  Effect.gen(function*() {
    const [[output, traces], usage] = yield* withRollout(
      options.seed + options.candidateIndex,
      Trace.withUsageTracking(
        Trace.withTracing(options.module.forward(options.input)).pipe(
          Effect.locally(Trace.TraceRef, Arr.empty<Trace.Entry>())
        )
      )
    ).pipe(Effect.locally(Trace.UsageRef, Usage.empty))

    const candidateRun: CandidateRun<I, O> = {
      candidateIndex: options.candidateIndex,
      module: options.module,
      output,
      traces,
      usage
    }

    return candidateRun
  })

/**
 * Build the typed forward function for `Module.multiChainComparison`.
 *
 * @since 0.2.0
 * @internal
 */
export const MultiChainComparisonRuntime = {
  forward: <
    I extends Schema.Struct.Fields,
    O extends Schema.Struct.Fields
  >(options: {
    readonly candidates: ReadonlyArray<
      Readonly<{
        readonly candidateIndex: number
        readonly module: Module<I, ChainOfThoughtOutputFields<O>>
      }>
    >
    readonly compare: Module<ComparisonInputFields<I>, ChainOfThoughtOutputFields<O>>
    readonly concurrency: number
    readonly moduleName: string
    readonly seed: number
    readonly signature: Signature<I, O>
  }): Module<I, O>["forward"] =>
    Effect.fn(options.moduleName)((input) =>
      Effect.gen(function*() {
        const candidateRuns = yield* Effect.forEach(
          options.candidates,
          (candidate) =>
            candidateTrace({
              candidateIndex: candidate.candidateIndex,
              input,
              module: candidate.module,
              seed: options.seed
            }),
          { concurrency: options.concurrency }
        )

        yield* MultiChainComparisonEvidence.append(candidateRuns)

        const comparisonInput = yield* MultiChainComparisonProjection.comparisonInput({
          compareInputSchema: options.compare.signature.inputSchema,
          input,
          inputSchema: options.signature.inputSchema,
          candidateRuns,
          moduleName: options.moduleName
        })
        const comparison = yield* options.compare.forward(comparisonInput)

        return yield* MultiChainComparisonProjection.output({
          moduleName: options.moduleName,
          output: comparison,
          outputSchema: options.signature.outputSchema
        })
      }).pipe(Effect.mapError((error): AiError.AiError | DspError => error))
    )
}
