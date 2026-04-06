/**
 * `multiChainComparison` forward runtime orchestration.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import type * as AiError from "@effect/ai/AiError"
import { Array as Arr, Effect, FiberRef, Match, Record, Schema } from "effect"
import { withRollout } from "../../Cache/refs.js"
import { emptyUsage, type Usage, Usage as UsageTotals } from "../../contracts/Usage.js"
import { CompositionError } from "../../Errors/module.js"
import type { DspError } from "../../Errors/union.js"
import type { Signature } from "../../Signature/model.js"
import * as Trace from "../../Trace/index.js"
import type { ChainOfThoughtOutputFields } from "../chainOfThought/schema.js"
import type { Module } from "../model.js"
import { CANDIDATE_COMPARISONS_FIELD } from "./signatures.js"
import type { ComparisonInputFields } from "./signatures.js"

const UnknownRecordSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown })

const compositionProjectionError = (moduleName: string, message: string): CompositionError =>
  new CompositionError({
    message,
    moduleName
  })

type CandidateRun<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> = Readonly<{
  readonly candidateIndex: number
  readonly module: Module<I, ChainOfThoughtOutputFields<O>>
  readonly output: Schema.Schema.Type<Schema.Struct<ChainOfThoughtOutputFields<O>>>
  readonly traces: ReadonlyArray<Trace.Entry>
  readonly usage: Usage
}>

const encodeRecord = <A, I, R>(options: {
  readonly message: string
  readonly moduleName: string
  readonly schema: Schema.Schema<A, I, R>
  readonly value: A
}) =>
  Schema.encodeUnknown(options.schema)(options.value).pipe(
    Effect.mapError(() => compositionProjectionError(options.moduleName, options.message)),
    Effect.flatMap((encoded) => Schema.decodeUnknown(UnknownRecordSchema)(encoded)),
    Effect.mapError(() => compositionProjectionError(options.moduleName, options.message))
  )

const candidateValueText = (value: unknown): string =>
  Match.value(value).pipe(
    Match.when((candidate: unknown): candidate is string => typeof candidate === "string", (candidate) => candidate),
    Match.when(
      (
        candidate: unknown
      ): candidate is number | boolean | null =>
        typeof candidate === "number" || typeof candidate === "boolean" || candidate === null,
      (candidate) => String(candidate)
    ),
    Match.orElse(() => "[structured-value]")
  )

const appendCandidateEvidence = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(candidateRuns: ReadonlyArray<CandidateRun<I, O>>) =>
  Effect.forEach(
    candidateRuns,
    (candidateRun) =>
      Effect.zipRight(
        Effect.forEach(candidateRun.traces, Trace.append, { discard: true }),
        Effect.gen(function*() {
          const usageEnabled = yield* FiberRef.get(Trace.UsageEnabledRef)

          return yield* Effect.if(usageEnabled, {
            onTrue: () =>
              FiberRef.update(
                Trace.UsageRef,
                (usage) =>
                  new UsageTotals({
                    inputTokens: usage.inputTokens + candidateRun.usage.inputTokens,
                    outputTokens: usage.outputTokens + candidateRun.usage.outputTokens,
                    callCount: usage.callCount + candidateRun.usage.callCount,
                    cachedCount: usage.cachedCount + candidateRun.usage.cachedCount
                  })
              ),
            onFalse: () => Effect.void
          })
        })
      ),
    { discard: true }
  )

const candidateSummaryText = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly candidateRun: CandidateRun<I, O>
  readonly encodedOutput: Readonly<Record<string, unknown>>
}) =>
  [
    `Candidate ${options.candidateRun.candidateIndex + 1}`,
    ...Record.keys(options.encodedOutput).map(
      (fieldName) => `${fieldName}: ${candidateValueText(options.encodedOutput[fieldName])}`
    )
  ].join("\n")

const comparisonPayload = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly inputSchema: Schema.Struct<I>
  readonly candidateRuns: ReadonlyArray<CandidateRun<I, O>>
  readonly moduleName: string
}) =>
  Effect.gen(function*() {
    const encodedInput = yield* encodeRecord({
      message: "MultiChainComparison input projection failed.",
      moduleName: options.moduleName,
      schema: options.inputSchema,
      value: options.input
    })
    const candidateSummaries = yield* Effect.forEach(options.candidateRuns, (candidateRun) =>
      encodeRecord({
        message: "MultiChainComparison candidate output projection failed.",
        moduleName: options.moduleName,
        schema: candidateRun.module.signature.outputSchema,
        value: candidateRun.output
      }).pipe(
        Effect.map((encodedOutput) =>
          candidateSummaryText({
            candidateRun,
            encodedOutput
          })
        )
      ))

    return Record.set(encodedInput, CANDIDATE_COMPARISONS_FIELD, candidateSummaries.join("\n\n"))
  })

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
    ).pipe(Effect.locally(Trace.UsageRef, emptyUsage))

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
export const makeMultiChainComparisonForward = <
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

      yield* appendCandidateEvidence(candidateRuns)

      const rawComparisonInput = yield* comparisonPayload({
        input,
        inputSchema: options.signature.inputSchema,
        candidateRuns,
        moduleName: options.moduleName
      })
      const comparisonInput = yield* Schema.decodeUnknown(options.compare.signature.inputSchema)(rawComparisonInput)
        .pipe(
          Effect.mapError(() =>
            compositionProjectionError(options.moduleName, "MultiChainComparison candidate projection failed.")
          )
        )
      const comparison = yield* options.compare.forward(comparisonInput)

      return yield* Schema.decodeUnknown(options.signature.outputSchema)(comparison).pipe(
        Effect.mapError(() =>
          compositionProjectionError(options.moduleName, "MultiChainComparison final output projection failed.")
        )
      )
    }).pipe(Effect.mapError((error): AiError.AiError | DspError => error))
  )
