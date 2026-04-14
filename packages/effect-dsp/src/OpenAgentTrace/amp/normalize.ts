/**
 * Shared record construction for Amp-derived normalized traces.
 *
 * @since 0.2.0
 */
import { digest } from "@scenesystems/digest"
import { Effect, Option, Schema } from "effect"

import type { NormalizeCaptureOptions } from "../adapter.js"
import { attachRecordProvenance } from "../provenance.js"
import { defaultOpenAgentTraceRedactionPolicy, redactOpenAgentTraceRecord } from "../redaction.js"
import {
  decodeOpenAgentTraceContentDigest,
  formatOpenAgentTraceContentDigest,
  type OpenAgentTraceCoverage,
  type OpenAgentTraceEvent,
  OpenAgentTraceRecord,
  OpenAgentTraceRecordId,
  OpenAgentTraceRedactionKey,
  OpenAgentTraceReviewStatus,
  OpenAgentTraceSession,
  OpenAgentTraceSource
} from "../schema.js"
import { resolveAmpSelection } from "./selection.js"

const digestPayload = (payload: unknown) =>
  Effect.orDie(Effect.flatMap(digest("blake3-256", payload), decodeOpenAgentTraceContentDigest))

/**
 * Inputs required to construct one canonical Amp-derived normalized record.
 *
 * @since 0.2.0
 */
export type NormalizeAmpRecordOptions = Readonly<{
  readonly adapterKind: "amp-plugin" | "amp-stream-json" | "amp-thread"
  readonly captureId: string
  readonly sourceId: string
  readonly sourceRevision: string
  readonly sourceUrl: string
  readonly licenseTag: string
  readonly harness: string
  readonly sessionId: string
  readonly fileName?: string
  readonly sourceHash?: OpenAgentTraceSource["sourceHash"]
  readonly cwd: string
  readonly startedAt: string
  readonly payload: unknown
  readonly events: readonly [OpenAgentTraceEvent, ...ReadonlyArray<OpenAgentTraceEvent>]
  readonly coverageGaps: ReadonlyArray<OpenAgentTraceCoverage>
  readonly options?: NormalizeCaptureOptions
}>

/**
 * Construct one canonical open-agent-trace record from Amp-derived normalized events.
 *
 * @since 0.2.0
 * @category combinators
 */
export const normalizeAmpRecord = (options: NormalizeAmpRecordOptions) =>
  Effect.gen(function*() {
    const payloadDigest = yield* digestPayload(options.payload)
    const sourceHash = options.sourceHash ?? payloadDigest
    const recordId = yield* Schema.decode(OpenAgentTraceRecordId)(
      `${options.sessionId}:${formatOpenAgentTraceContentDigest(payloadDigest)}`
    )
    const redactionKey = yield* Schema.decode(OpenAgentTraceRedactionKey)(`${options.adapterKind}:default-redaction:v1`)
    const { selection, branches } = resolveAmpSelection(options.events)
    const reviewStatus = options.options?.reviewStatusOverride ?? OpenAgentTraceReviewStatus.make({
      projectionSafe: false,
      manualReviewRequired: true,
      semanticReviewStatus: "not-reviewed",
      policyId: (options.options?.redactionPolicy ?? defaultOpenAgentTraceRedactionPolicy).policyId,
      policyVersion: (options.options?.redactionPolicy ?? defaultOpenAgentTraceRedactionPolicy).policyVersion
    })
    const record = OpenAgentTraceRecord.make({
      recordId,
      source: OpenAgentTraceSource.make({
        datasetId: options.sourceId,
        datasetRevision: options.sourceRevision,
        split: "capture",
        rowKey: options.sessionId,
        sourceUrl: options.sourceUrl,
        licenseTag: options.licenseTag,
        harness: options.harness,
        sessionId: options.sessionId,
        fileName: options.fileName ?? `${options.captureId}.jsonl`,
        sourceHash,
        redactionKey,
        redactedHash: payloadDigest
      }),
      session: OpenAgentTraceSession.make({
        sessionId: options.sessionId,
        sessionVersion: 1,
        cwd: options.cwd,
        startedAt: options.startedAt
      }),
      selection,
      branches,
      events: [options.events[0], ...options.events.slice(1)],
      coverageGaps: [...options.coverageGaps],
      redactionFindings: [],
      reviewStatus,
      sourceDigest: payloadDigest,
      normalizedDigest: payloadDigest,
      redactedDigest: payloadDigest
    })
    const redacted = yield* Option.match(Option.fromNullable(options.options?.redactionPolicy), {
      onNone: () => redactOpenAgentTraceRecord({ record }),
      onSome: (policy) => redactOpenAgentTraceRecord({ record, policy })
    })
    const overridden = OpenAgentTraceRecord.make({
      ...redacted,
      reviewStatus
    })

    return yield* Effect.orDie(attachRecordProvenance(overridden))
  })
