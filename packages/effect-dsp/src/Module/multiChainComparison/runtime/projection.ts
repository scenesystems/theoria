/**
 * Candidate and comparison projection helpers for `Module.multiChainComparison`.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import { Effect, Match, Record, Schema } from "effect"

import { CANDIDATE_COMPARISONS_FIELD, type ComparisonInputFields } from "../signatures.js"
import { MultiChainComparisonFailure } from "./errors.js"
import type { CandidateRun } from "./evidence.js"

const UnknownRecordSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown })

const encodeRecord = <A, I, R>(options: {
  readonly message: string
  readonly moduleName: string
  readonly schema: Schema.Schema<A, I, R>
  readonly value: A
}) =>
  Schema.encodeUnknown(options.schema)(options.value).pipe(
    Effect.mapError(() => MultiChainComparisonFailure.projection(options)),
    Effect.flatMap((encoded) => Schema.decodeUnknown(UnknownRecordSchema)(encoded)),
    Effect.mapError(() => MultiChainComparisonFailure.projection(options))
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

const candidateSummary = <
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

const payload = <
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
          candidateSummary({
            candidateRun,
            encodedOutput
          })
        )
      ))

    return Record.set(encodedInput, CANDIDATE_COMPARISONS_FIELD, candidateSummaries.join("\n\n"))
  })

/**
 * Noun-owned comparison input/output projection for `Module.multiChainComparison`.
 *
 * @since 0.2.0
 * @category constructors
 * @internal
 */
export const MultiChainComparisonProjection = {
  comparisonInput: <
    I extends Schema.Struct.Fields,
    O extends Schema.Struct.Fields
  >(options: {
    readonly compareInputSchema: Schema.Struct<ComparisonInputFields<I>>
    readonly input: Schema.Schema.Type<Schema.Struct<I>>
    readonly inputSchema: Schema.Struct<I>
    readonly candidateRuns: ReadonlyArray<CandidateRun<I, O>>
    readonly moduleName: string
  }) =>
    payload(options).pipe(
      Effect.flatMap((rawInput) => Schema.decodeUnknown(options.compareInputSchema)(rawInput)),
      Effect.mapError(() =>
        MultiChainComparisonFailure.projection({
          message: "MultiChainComparison candidate projection failed.",
          moduleName: options.moduleName
        })
      )
    ),
  output: <O extends Schema.Struct.Fields>(options: {
    readonly moduleName: string
    readonly output: unknown
    readonly outputSchema: Schema.Struct<O>
  }) =>
    Schema.decodeUnknown(options.outputSchema)(options.output).pipe(
      Effect.mapError(() =>
        MultiChainComparisonFailure.projection({
          message: "MultiChainComparison final output projection failed.",
          moduleName: options.moduleName
        })
      )
    )
}
