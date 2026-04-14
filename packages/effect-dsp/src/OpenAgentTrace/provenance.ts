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
  OpenAgentTraceCoverage,
  OpenAgentTraceEvent,
  OpenAgentTraceRecord,
  OpenAgentTraceRecordId,
  OpenAgentTraceRedactionFinding,
  OpenAgentTraceRedactionKey,
  OpenAgentTraceReviewStatus,
  OpenAgentTraceSelection,
  OpenAgentTraceSession,
  OpenAgentTraceSessionId,
  OpenAgentTraceSource,
  RecordDigest,
  SourceDigest
} from "./schema.js"

const RecordDigestInput = Schema.Struct({
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
export const publishedReviewStatus = (reviewStatus: OpenAgentTraceReviewStatus) =>
  OpenAgentTraceReviewStatus.make({ ...reviewStatus, reviewKey: undefined })

/**
 * Computes the canonical digest for one normalized source locator.
 *
 * @since 0.2.0
 * @category combinators
 */
export const digestSource = (source: OpenAgentTraceSource) =>
  Effect.map(
    digestEncodedValue(OpenAgentTraceSource, source),
    (digest) => SourceDigest.make({ digest })
  )

/**
 * Computes the canonical digest set for one normalized record.
 *
 * @since 0.2.0
 * @category combinators
 */
export const digestRecord = (record: OpenAgentTraceRecord) =>
  Effect.gen(function*() {
    const reviewStatus = publishedReviewStatus(record.reviewStatus)
    const sourceDigest = yield* digestEncodedValue(OpenAgentTraceSource, record.source)
    const reviewStatusDigest = yield* digestEncodedValue(OpenAgentTraceReviewStatus, reviewStatus)
    const normalizedDigest = yield* digestEncodedValue(RecordDigestInput, {
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

    return RecordDigest.make({
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
export const attachRecordProvenance = (record: OpenAgentTraceRecord) =>
  Effect.map(digestRecord(record), (digests) =>
    OpenAgentTraceRecord.make({
      ...record,
      sourceDigest: digests.sourceDigest,
      normalizedDigest: digests.normalizedDigest,
      redactedDigest: digests.redactedDigest
    }))
