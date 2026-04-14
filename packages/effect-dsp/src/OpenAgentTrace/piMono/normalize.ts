/**
 * `pi-mono` normalization helpers.
 *
 * @since 0.2.0
 */
import { Array as Arr, Effect, Option, Schema } from "effect"
import { attachRecordProvenance } from "../provenance.js"
import {
  defaultOpenAgentTraceRedactionPolicy,
  type OpenAgentTraceRedactionPolicy,
  redactOpenAgentTraceRecord
} from "../redaction.js"
import {
  decodeOpenAgentTraceContentDigest,
  formatOpenAgentTraceContentDigest,
  OpenAgentTraceRecord,
  OpenAgentTraceRecordId,
  OpenAgentTraceReviewStatus,
  OpenAgentTraceSession,
  OpenAgentTraceSource,
  type PiMonoDatasetRow,
  type PiShareHfManifestEntry,
  type PiShareHfReviewSidecar
} from "../schema.js"
import { normalizePiSessionEntry } from "./content.js"
import { migratePiSessionEntries } from "./migrate.js"
import { resolvePiSessionContext } from "./resolve.js"

/**
 * Derives the published content-addressable integrity identity from one `pi-share-hf` manifest entry.
 *
 * @since 0.2.0
 * @category combinators
 */
export const publishedIntegrityDigest = (entry: PiShareHfManifestEntry) =>
  decodeOpenAgentTraceContentDigest(entry.redacted_hash)

/**
 * Normalizes one `badlogicgames/pi-mono` row into the canonical open-agent-trace record.
 *
 * @since 0.2.0
 * @category combinators
 */
export const normalizeDatasetRow = (options: {
  readonly datasetId: string
  readonly datasetRevision: string
  readonly split: string
  readonly sourceUrl: string
  readonly licenseTag: string
  readonly row: PiMonoDatasetRow
  readonly manifestEntry: PiShareHfManifestEntry
  readonly reviewSidecar?: PiShareHfReviewSidecar
  readonly redactionPolicy?: OpenAgentTraceRedactionPolicy
}) =>
  Effect.gen(function*() {
    const migrated = yield* migratePiSessionEntries(options.row.traces)
    const resolved = resolvePiSessionContext(migrated.entries)
    const publishedDigest = yield* publishedIntegrityDigest(options.manifestEntry)
    const sourceHash = yield* decodeOpenAgentTraceContentDigest(options.manifestEntry.source_hash)
    const recordId = yield* Schema.decode(OpenAgentTraceRecordId)(
      `${options.row.session_id}:${formatOpenAgentTraceContentDigest(publishedDigest)}`
    )
    const events = yield* Effect.forEach(resolved.liveContext, normalizePiSessionEntry, { concurrency: 1 })
    const firstEvent = Arr.head(events).pipe(Option.getOrElse(() => events[0]!))

    const normalizedRecord = OpenAgentTraceRecord.make({
      recordId,
      source: OpenAgentTraceSource.make({
        datasetId: options.datasetId,
        datasetRevision: options.datasetRevision,
        split: options.split,
        rowKey: options.row.session_id,
        sourceUrl: options.sourceUrl,
        licenseTag: options.licenseTag,
        harness: options.row.harness,
        sessionId: options.row.session_id,
        fileName: options.row.file_name,
        sourceHash,
        redactionKey: options.manifestEntry.redaction_key,
        redactedHash: publishedDigest
      }),
      session: OpenAgentTraceSession.make({
        sessionId: migrated.header.id,
        sessionVersion: migrated.header.version ?? 3,
        cwd: migrated.header.cwd,
        parentSession: migrated.header.parentSession,
        startedAt: migrated.header.timestamp
      }),
      selection: resolved.selection,
      branches: resolved.branches,
      events: [firstEvent, ...events.slice(1)],
      coverageGaps: [],
      redactionFindings: [],
      reviewStatus: OpenAgentTraceReviewStatus.make({
        projectionSafe: false,
        manualReviewRequired: true,
        semanticReviewStatus: "not-reviewed",
        policyId: (options.redactionPolicy ?? defaultOpenAgentTraceRedactionPolicy).policyId,
        policyVersion: (options.redactionPolicy ?? defaultOpenAgentTraceRedactionPolicy).policyVersion
      }),
      sourceDigest: publishedDigest,
      normalizedDigest: publishedDigest,
      redactedDigest: publishedDigest
    })

    const redactedRecord = yield* Option.match(Option.fromNullable(options.redactionPolicy), {
      onNone: () =>
        Option.match(Option.fromNullable(options.reviewSidecar), {
          onNone: () => redactOpenAgentTraceRecord({ record: normalizedRecord }),
          onSome: (reviewSidecar) => redactOpenAgentTraceRecord({ record: normalizedRecord, reviewSidecar })
        }),
      onSome: (policy) =>
        Option.match(Option.fromNullable(options.reviewSidecar), {
          onNone: () => redactOpenAgentTraceRecord({ record: normalizedRecord, policy }),
          onSome: (reviewSidecar) => redactOpenAgentTraceRecord({ record: normalizedRecord, policy, reviewSidecar })
        })
    })

    return yield* attachRecordProvenance(redactedRecord)
  })
