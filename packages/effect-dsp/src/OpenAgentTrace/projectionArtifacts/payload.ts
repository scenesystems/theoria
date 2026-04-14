/**
 * Payload-specific builders for persisted open-agent-trace artifact envelopes.
 *
 * @since 0.2.0
 */
import { Array as Arr, Effect, Option, Predicate, Record, Schema, Tuple } from "effect"
import * as SearchContracts from "effect-search/Contracts"

import {
  ArtifactPayload,
  ExampleProjectionArtifact,
  RecordArtifact,
  WorkflowProjectionArtifact
} from "../projectionArtifacts.js"
import type { ArtifactLineage } from "../projectionArtifacts/lineage.js"
import { ExampleProjectionLineage, WorkflowProjectionLineage } from "../projectionArtifacts/lineage.js"
import type { Projection } from "../projectionSchema.js"
import { publishedReviewStatus } from "../provenance.js"
import { OpenAgentTraceRecord, type OpenAgentTraceRecord as OpenAgentTraceRecordModel } from "../schema.js"

const stripUndefinedDeep = (value: unknown): unknown => {
  if (Arr.isArray(value)) {
    return Arr.map(value, stripUndefinedDeep)
  }

  if (!Predicate.isRecord(value)) {
    return value
  }

  const toJSON = Reflect.get(value, "toJSON")
  const normalizedValue = typeof toJSON === "function"
    ? Reflect.apply(toJSON, value, [])
    : value

  if (!Predicate.isRecord(normalizedValue)) {
    return stripUndefinedDeep(normalizedValue)
  }

  return Record.fromEntries(
    Arr.flatMap(
      Record.toEntries(normalizedValue),
      ([key, nestedValue]) =>
        Option.match(Option.fromNullable(nestedValue), {
          onNone: () => Arr.empty<readonly [string, unknown]>(),
          onSome: (presentValue) => Arr.of(Tuple.make(key, stripUndefinedDeep(presentValue)))
        })
    )
  )
}

const decodeArtifactPayload = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(
    effect,
    (payload) => Schema.decodeUnknown(SearchContracts.ArtifactPayload)(stripUndefinedDeep(payload))
  )

const sanitizedRecord = (record: OpenAgentTraceRecordModel) =>
  OpenAgentTraceRecord.make({
    ...record,
    reviewStatus: publishedReviewStatus(record.reviewStatus)
  })

/**
 * Encodes one normalized trace payload into the canonical persisted artifact body.
 *
 * When no projection is supplied, this preserves the published normalized record.
 * When a projection is supplied, it derives the projection lineage, encodes the
 * artifact carrier, and re-decodes through `effect-search`'s `ArtifactPayload`
 * schema so the envelope composition boundary only receives the transport-owned
 * payload noun.
 *
 * @since 0.2.0
 * @category combinators
 */
export const payloadFor = (
  record: OpenAgentTraceRecordModel,
  lineage: ArtifactLineage,
  projection?: Projection
) =>
  Option.match(Option.fromNullable(projection), {
    onNone: () =>
      decodeArtifactPayload(
        Schema.encode(ArtifactPayload)(
          RecordArtifact.make({
            artifactKind: "open-agent-trace-record",
            lineage,
            record: sanitizedRecord(record)
          })
        )
      ),
    onSome: (projection) =>
      projection.projectionKind === "workflow-record"
        ? Effect.gen(function*() {
          const projectionLineage = yield* WorkflowProjectionLineage.project(projection)

          return yield* decodeArtifactPayload(
            Schema.encode(ArtifactPayload)(
              WorkflowProjectionArtifact.make({
                artifactKind: "open-agent-trace-workflow-projection",
                lineage,
                projectionLineage,
                projection
              })
            )
          )
        })
        : decodeArtifactPayload(
          Schema.encode(ArtifactPayload)(
            ExampleProjectionArtifact.make({
              artifactKind: "open-agent-trace-example-projection",
              lineage,
              projectionLineage: ExampleProjectionLineage.project(projection),
              projection
            })
          )
        )
  })
