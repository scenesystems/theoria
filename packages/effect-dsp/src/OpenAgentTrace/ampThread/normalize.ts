/**
 * Amp thread export normalization into canonical OpenAgentTrace records.
 *
 * @since 0.2.0
 */
import { Effect, Option, Schema } from "effect"

import { OpenAgentTraceAdapterCoverageGap } from "../adapterSchema.js"
import { normalizeAmpRecord } from "../amp/normalize.js"
import {
  OpenAgentTraceCoverage,
  type OpenAgentTraceEvent,
  OpenAgentTraceEvent as OpenAgentTraceEventSchema
} from "../schema.js"

import { assistantEventsFor, toolUsesForMessage, userEventsFor } from "./content.js"
import { type AmpThreadExportSnapshot, type AmpThreadToolUseContent, decodeExportSnapshot } from "./schema.js"

type NormalizedState = Readonly<{
  readonly events: ReadonlyArray<OpenAgentTraceEvent>
  readonly toolUses: Readonly<Record<string, AmpThreadToolUseContent>>
}>

const emptyNormalizedState = (): NormalizedState => ({
  events: [],
  toolUses: {}
})

const coveragePair = (options: {
  readonly gapId: string
  readonly reason: string
  readonly severity: "info" | "warning" | "error"
  readonly sourceKind: string
  readonly threadId: string
}) => ({
  adapter: OpenAgentTraceAdapterCoverageGap.make({
    gapId: options.gapId,
    reason: options.reason,
    severity: options.severity,
    sourceKind: options.sourceKind,
    sourceRef: { threadId: options.threadId }
  }),
  record: OpenAgentTraceCoverage.make({
    gapId: options.gapId,
    reason: options.reason,
    severity: options.severity,
    sourceKind: options.sourceKind,
    sourceRef: { threadId: options.threadId }
  })
})

const coverageFor = (threadId: string) => {
  const gaps = [
    coveragePair({
      gapId: `amp-thread:${threadId}:tool-lifecycle`,
      sourceKind: "tool-lifecycle",
      reason: "Amp thread export snapshots omit raw tool lifecycle transport and intermediate streaming state.",
      severity: "warning",
      threadId
    }),
    coveragePair({
      gapId: `amp-thread:${threadId}:hidden-runtime-data`,
      sourceKind: "hidden-runtime-data",
      reason: "Hidden runtime data and encrypted reasoning traces are not projected into the imported thread surface.",
      severity: "info",
      threadId
    }),
    coveragePair({
      gapId: `amp-thread:${threadId}:timestamp-authority`,
      sourceKind: "timestamp-authority",
      reason:
        "Message export timestamps are preserved, but exact authoritative wall-clock timing is not fully exposed.",
      severity: "info",
      threadId
    }),
    coveragePair({
      gapId: `amp-thread:${threadId}:usage-provenance`,
      sourceKind: "usage-provenance",
      reason: "Amp thread export snapshots do not provide stable usage or cost authority for every visible event.",
      severity: "info",
      threadId
    }),
    coveragePair({
      gapId: `amp-thread:${threadId}:file-contents`,
      sourceKind: "file-contents",
      reason:
        "Referenced files remain evidentiary only; non-visible file bytes are not imported from the thread export.",
      severity: "warning",
      threadId
    }),
    coveragePair({
      gapId: `amp-thread:${threadId}:branch-lineage`,
      sourceKind: "branch-lineage",
      reason:
        "Amp thread export snapshots currently normalize to a conservative linear active path without explicit branch ancestry.",
      severity: "warning",
      threadId
    })
  ]

  return {
    adapterGaps: gaps.map((gap) => gap.adapter),
    recordGaps: gaps.map((gap) => gap.record)
  }
}

const cwdFrom = (snapshot: AmpThreadExportSnapshot): string =>
  Option.fromNullable(snapshot.env?.initial.trees?.[0]?.uri).pipe(
    Option.map((uri) => uri.startsWith("file://") ? new URL(uri).pathname : uri),
    Option.getOrElse(() => "/")
  )

const decodeLinkedEvents = (events: ReadonlyArray<OpenAgentTraceEvent>) =>
  Effect.forEach(
    events,
    (event, index) =>
      Schema.decodeUnknown(OpenAgentTraceEventSchema)({
        ...event,
        ...Option.match(Option.fromNullable(events[index - 1]?.eventId), {
          onNone: () => ({}),
          onSome: (parentEventId) => ({ parentEventId })
        })
      }),
    { concurrency: 1 }
  )

/**
 * Normalizes one decoded Amp thread export snapshot into a canonical record plus explicit coverage gaps.
 *
 * @since 0.2.0
 */
export const normalizeExportSnapshot = (options: {
  readonly snapshot: AmpThreadExportSnapshot
  readonly sourceUrl?: string
}) =>
  Effect.gen(function*() {
    const fallback = options.snapshot.created
    const normalized = yield* Effect.reduce(
      options.snapshot.messages,
      emptyNormalizedState(),
      (state, message) =>
        Effect.gen(function*() {
          const nextToolUses = message.role === "assistant"
            ? { ...state.toolUses, ...toolUsesForMessage(message) }
            : state.toolUses
          const nextEvents = yield* (message.role === "assistant"
            ? assistantEventsFor({ fallback, message })
            : userEventsFor({ fallback, message, toolUses: nextToolUses }))

          return {
            events: [...state.events, ...nextEvents],
            toolUses: nextToolUses
          }
        })
    )
    const linkedEvents = yield* decodeLinkedEvents(normalized.events)
    const events = yield* Schema.decodeUnknown(Schema.NonEmptyArray(OpenAgentTraceEventSchema))(linkedEvents)
    const coverage = coverageFor(options.snapshot.id)

    return {
      record: yield* normalizeAmpRecord({
        adapterKind: "amp-thread",
        captureId: options.snapshot.id,
        sourceId: "amp-thread-export",
        sourceRevision: `v${String(options.snapshot.v)}`,
        sourceUrl: options.sourceUrl ?? `https://ampcode.com/threads/${options.snapshot.id}`,
        licenseTag: "workspace-thread",
        harness: "amp-cli-thread-export",
        sessionId: options.snapshot.id,
        fileName: `${options.snapshot.id}.thread-export.json`,
        cwd: cwdFrom(options.snapshot),
        startedAt: options.snapshot.created,
        payload: options.snapshot,
        events,
        coverageGaps: coverage.recordGaps
      }),
      coverageGaps: coverage.adapterGaps
    }
  })

/**
 * Decodes and normalizes unknown Amp thread export data into canonical trace output.
 *
 * @since 0.2.0
 */
export const normalizeExport = (
  snapshot: unknown,
  options?: {
    readonly sourceUrl?: string
  }
) =>
  Effect.flatMap(
    decodeExportSnapshot(snapshot),
    (decodedSnapshot) =>
      Option.fromNullable(options?.sourceUrl).pipe(
        Option.match({
          onNone: () => normalizeExportSnapshot({ snapshot: decodedSnapshot }),
          onSome: (sourceUrl) => normalizeExportSnapshot({ snapshot: decodedSnapshot, sourceUrl })
        })
      )
  )
