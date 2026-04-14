/**
 * Provenance digest and corpus-manifest schemas for normalized open-agent-trace records.
 *
 * @since 0.2.0
 */
import { digest } from "@scenesystems/digest"
import { Array as Arr, Effect, Option, Predicate, Record, Schema, Tuple } from "effect"

import { decodeOpenAgentTraceContentDigest, OpenAgentTraceContentDigest } from "./authorities.js"
import type { OpenAgentTraceRecord } from "./events.js"

const OpenAgentTraceCorpusDigestInput = Schema.Struct({
  corpusId: Schema.String,
  adapterId: Schema.String,
  adapterVersion: Schema.String,
  normalizationVersion: Schema.String,
  projectionVersion: Schema.String,
  sourceDatasetId: Schema.String,
  sourceDatasetRevision: Schema.String,
  sourceSplit: Schema.String,
  recordCount: Schema.Number,
  recordDigests: Schema.Array(OpenAgentTraceContentDigest)
})

const stripUndefinedDeep = (value: unknown): unknown =>
  Arr.isArray(value)
    ? Arr.map(value, stripUndefinedDeep)
    : Predicate.isRecord(value)
    ? Record.fromEntries(
      Arr.flatMap(Record.toEntries(value), ([key, nestedValue]) =>
        Option.match(Option.fromNullable(nestedValue), {
          onNone: () => Arr.empty<readonly [string, unknown]>(),
          onSome: (presentValue) => Arr.of(Tuple.make(key, stripUndefinedDeep(presentValue)))
        }))
    )
    : value

const digestEncodedValue = <A, I>(schema: Schema.Schema<A, I>, value: A) =>
  Effect.flatMap(
    Schema.encode(schema)(value),
    (encoded) => Effect.flatMap(digest("blake3-256", stripUndefinedDeep(encoded)), decodeOpenAgentTraceContentDigest)
  )

/**
 * Canonical source-digest surface for one normalized public trace row.
 *
 * @since 0.2.0
 * @category models
 */
export class SourceDigest extends Schema.Class<SourceDigest>("OpenAgentTrace/SourceDigest")({
  digest: OpenAgentTraceContentDigest
}) {}

/**
 * Canonical record-digest surface for one normalized public trace row.
 *
 * @since 0.2.0
 * @category models
 */
export class RecordDigest extends Schema.Class<RecordDigest>("OpenAgentTrace/RecordDigest")({
  sourceDigest: OpenAgentTraceContentDigest,
  reviewStatusDigest: OpenAgentTraceContentDigest,
  normalizedDigest: OpenAgentTraceContentDigest,
  redactedDigest: OpenAgentTraceContentDigest
}) {}

/**
 * Canonical replay-safe corpus manifest surface.
 *
 * @since 0.2.0
 * @category models
 */
export class CorpusManifest extends Schema.Class<CorpusManifest>("OpenAgentTrace/CorpusManifest")({
  corpusId: Schema.String,
  adapterId: Schema.String,
  adapterVersion: Schema.String,
  normalizationVersion: Schema.String,
  projectionVersion: Schema.String,
  sourceDatasetId: Schema.String,
  sourceDatasetRevision: Schema.String,
  sourceSplit: Schema.String,
  recordCount: Schema.Number,
  corpusDigest: OpenAgentTraceContentDigest,
  generatedAt: Schema.String
}) {
  /**
   * Projects a deterministic public corpus manifest from a normalized record set.
   *
   * @since 0.2.0
   * @category constructors
   */
  static fromRecords(options: {
    readonly corpusId: string
    readonly adapterId: string
    readonly adapterVersion: string
    readonly normalizationVersion: string
    readonly projectionVersion: string
    readonly generatedAt: string
    readonly records: readonly [OpenAgentTraceRecord, ...ReadonlyArray<OpenAgentTraceRecord>]
  }) {
    return Effect.gen(function*() {
      const [firstRecord] = options.records
      const corpusDigest = yield* digestEncodedValue(OpenAgentTraceCorpusDigestInput, {
        corpusId: options.corpusId,
        adapterId: options.adapterId,
        adapterVersion: options.adapterVersion,
        normalizationVersion: options.normalizationVersion,
        projectionVersion: options.projectionVersion,
        sourceDatasetId: firstRecord.source.datasetId,
        sourceDatasetRevision: firstRecord.source.datasetRevision,
        sourceSplit: firstRecord.source.split,
        recordCount: options.records.length,
        recordDigests: options.records.map((record) => record.redactedDigest)
      })

      return CorpusManifest.make({
        corpusId: options.corpusId,
        adapterId: options.adapterId,
        adapterVersion: options.adapterVersion,
        normalizationVersion: options.normalizationVersion,
        projectionVersion: options.projectionVersion,
        sourceDatasetId: firstRecord.source.datasetId,
        sourceDatasetRevision: firstRecord.source.datasetRevision,
        sourceSplit: firstRecord.source.split,
        recordCount: options.records.length,
        corpusDigest,
        generatedAt: options.generatedAt
      })
    })
  }
}
