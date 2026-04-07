/**
 * Digest provenance and manifest helpers for normalized open-agent-trace records.
 *
 * @since 0.2.0
 */
import { digest } from "@scenesystems/digest"
import { Array as Arr, Effect, Option, Predicate, Record, Schema, Tuple } from "effect"

import {
  decodeOpenAgentTraceContentDigest,
  OpenAgentTraceBranch,
  OpenAgentTraceContentDigest,
  OpenAgentTraceCorpusManifest,
  OpenAgentTraceCoverage,
  OpenAgentTraceEvent,
  OpenAgentTraceRecord,
  OpenAgentTraceRecordDigest,
  OpenAgentTraceRecordId,
  OpenAgentTraceRedactionFinding,
  OpenAgentTraceRedactionKey,
  OpenAgentTraceReviewStatus,
  OpenAgentTraceSelection,
  OpenAgentTraceSession,
  OpenAgentTraceSessionId,
  OpenAgentTraceSource,
  OpenAgentTraceSourceDigest
} from "./schema.js"

const OpenAgentTraceRecordDigestInput = Schema.Struct({
  recordId: OpenAgentTraceRecordId,
  source: OpenAgentTraceSource,
  session: OpenAgentTraceSession,
  selection: OpenAgentTraceSelection,
  branches: Schema.Array(OpenAgentTraceBranch),
  events: Schema.NonEmptyArray(OpenAgentTraceEvent),
  coverageGaps: Schema.Array(OpenAgentTraceCoverage),
  redactionFindings: Schema.Array(OpenAgentTraceRedactionFinding),
  reviewStatus: OpenAgentTraceReviewStatus
})

const OpenAgentTracePublishedSource = Schema.Struct({
  datasetId: Schema.String,
  datasetRevision: Schema.String,
  split: Schema.String,
  rowKey: OpenAgentTraceSessionId,
  sourceUrl: Schema.String,
  licenseTag: Schema.String,
  harness: Schema.String,
  sessionId: OpenAgentTraceSessionId,
  fileName: Schema.String,
  redactionKey: OpenAgentTraceRedactionKey,
  redactedHash: OpenAgentTraceContentDigest
})

const OpenAgentTracePublishedRecordDigestInput = Schema.Struct({
  recordId: OpenAgentTraceRecordId,
  source: OpenAgentTracePublishedSource,
  session: OpenAgentTraceSession,
  selection: OpenAgentTraceSelection,
  branches: Schema.Array(OpenAgentTraceBranch),
  events: Schema.NonEmptyArray(OpenAgentTraceEvent),
  coverageGaps: Schema.Array(OpenAgentTraceCoverage),
  redactionFindings: Schema.Array(OpenAgentTraceRedactionFinding),
  reviewStatus: OpenAgentTraceReviewStatus
})

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
 * Removes non-public review identifiers before public digest or artifact derivation.
 *
 * @since 0.2.0
 * @category combinators
 */
export const publishedOpenAgentTraceReviewStatus = (reviewStatus: OpenAgentTraceReviewStatus) =>
  new OpenAgentTraceReviewStatus({ ...reviewStatus, reviewKey: undefined })

/**
 * Computes the canonical digest for one normalized source locator.
 *
 * @since 0.2.0
 * @category combinators
 */
export const digestOpenAgentTraceSource = (source: OpenAgentTraceSource) =>
  Effect.map(
    digestEncodedValue(OpenAgentTraceSource, source),
    (digest) => new OpenAgentTraceSourceDigest({ digest })
  )

/**
 * Computes the canonical digest set for one normalized record.
 *
 * @since 0.2.0
 * @category combinators
 */
export const digestOpenAgentTraceRecord = (record: OpenAgentTraceRecord) =>
  Effect.gen(function*() {
    const reviewStatus = publishedOpenAgentTraceReviewStatus(record.reviewStatus)
    const sourceDigest = yield* digestEncodedValue(OpenAgentTraceSource, record.source)
    const reviewStatusDigest = yield* digestEncodedValue(OpenAgentTraceReviewStatus, reviewStatus)
    const normalizedDigest = yield* digestEncodedValue(OpenAgentTraceRecordDigestInput, {
      recordId: record.recordId,
      source: record.source,
      session: record.session,
      selection: record.selection,
      branches: record.branches,
      events: record.events,
      coverageGaps: record.coverageGaps,
      redactionFindings: record.redactionFindings,
      reviewStatus
    })
    const redactedDigest = yield* digestEncodedValue(OpenAgentTracePublishedRecordDigestInput, {
      recordId: record.recordId,
      source: {
        datasetId: record.source.datasetId,
        datasetRevision: record.source.datasetRevision,
        split: record.source.split,
        rowKey: record.source.rowKey,
        sourceUrl: record.source.sourceUrl,
        licenseTag: record.source.licenseTag,
        harness: record.source.harness,
        sessionId: record.source.sessionId,
        fileName: record.source.fileName,
        redactionKey: record.source.redactionKey,
        redactedHash: record.source.redactedHash
      },
      session: record.session,
      selection: record.selection,
      branches: record.branches,
      events: record.events,
      coverageGaps: record.coverageGaps,
      redactionFindings: record.redactionFindings,
      reviewStatus
    })

    return new OpenAgentTraceRecordDigest({
      sourceDigest,
      reviewStatusDigest,
      normalizedDigest,
      redactedDigest
    })
  })

/**
 * Applies canonical digest provenance to one normalized record.
 *
 * @since 0.2.0
 * @category combinators
 */
export const attachOpenAgentTraceRecordProvenance = (record: OpenAgentTraceRecord) =>
  Effect.map(digestOpenAgentTraceRecord(record), (digests) =>
    new OpenAgentTraceRecord({
      ...record,
      sourceDigest: digests.sourceDigest,
      normalizedDigest: digests.normalizedDigest,
      redactedDigest: digests.redactedDigest
    }))

/**
 * Builds a replay-safe corpus manifest from a non-empty normalized record set.
 *
 * @since 0.2.0
 * @category combinators
 */
export const makeOpenAgentTraceCorpusManifest = (options: {
  readonly corpusId: string
  readonly adapterId: string
  readonly adapterVersion: string
  readonly normalizationVersion: string
  readonly projectionVersion: string
  readonly generatedAt: string
  readonly records: readonly [OpenAgentTraceRecord, ...ReadonlyArray<OpenAgentTraceRecord>]
}) =>
  Effect.gen(function*() {
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

    return new OpenAgentTraceCorpusManifest({
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
