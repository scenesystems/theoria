/**
 * Artifact-envelope transport for bounded open-agent-trace projections.
 *
 * @since 0.2.0
 */
import { digestSchemaValue } from "@scenesystems/digest"
import { Array as Arr, Effect, Option, Predicate, Record, Schema, Tuple } from "effect"
import {
  EvaluationContractSchema,
  GraphExecutionManifestSchema,
  WorkflowExecutionRecordSchema
} from "effect-inference/Contracts"
import * as SearchContracts from "effect-search/Contracts"

import {
  OpenAgentTraceArtifactLineage,
  OpenAgentTraceArtifactPayload,
  OpenAgentTraceExampleProjectionArtifact,
  OpenAgentTraceExampleProjectionLineage,
  type OpenAgentTraceProjection,
  OpenAgentTraceRecordArtifact,
  OpenAgentTraceWorkflowProjectionArtifact,
  OpenAgentTraceWorkflowProjectionLineage
} from "./projectionSchema.js"
import { PROJECTION_VERSION } from "./projectionShared.js"
import { digestOpenAgentTraceRecord, publishedOpenAgentTraceReviewStatus } from "./provenance.js"
import {
  decodeOpenAgentTraceContentDigest,
  formatOpenAgentTraceContentDigest,
  OpenAgentTraceRecord,
  type OpenAgentTraceRecord as OpenAgentTraceRecordModel
} from "./schema.js"

const ADAPTER_ID = "pi-mono"
const ADAPTER_VERSION = "1"
const NORMALIZATION_VERSION = "1"

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
  new OpenAgentTraceRecord({
    ...record,
    reviewStatus: publishedOpenAgentTraceReviewStatus(record.reviewStatus)
  })

const artifactLineageFor = (record: OpenAgentTraceRecordModel) =>
  Effect.map(digestOpenAgentTraceRecord(record), (digests) =>
    new OpenAgentTraceArtifactLineage({
      sourceDatasetId: record.source.datasetId,
      sourceDatasetRevision: record.source.datasetRevision,
      sourceSplit: record.source.split,
      sourceRowKey: record.source.rowKey,
      sourceSessionId: record.source.sessionId,
      sourceFileName: record.source.fileName,
      adapterId: ADAPTER_ID,
      adapterVersion: ADAPTER_VERSION,
      normalizationVersion: NORMALIZATION_VERSION,
      sourceDigest: digests.sourceDigest,
      normalizedDigest: digests.normalizedDigest,
      redactedDigest: digests.redactedDigest,
      reviewStatusDigest: digests.reviewStatusDigest
    }))

const payloadFor = (
  record: OpenAgentTraceRecordModel,
  lineage: OpenAgentTraceArtifactLineage,
  projection?: OpenAgentTraceProjection
) =>
  Option.match(Option.fromNullable(projection), {
    onNone: () =>
      decodeArtifactPayload(
        Schema.encode(OpenAgentTraceArtifactPayload)(
          new OpenAgentTraceRecordArtifact({
            artifactKind: "open-agent-trace-record",
            lineage,
            record: sanitizedRecord(record)
          })
        )
      ),
    onSome: (projection) =>
      projection.projectionKind === "workflow-record"
        ? Effect.gen(function*() {
          const workflowRecordDigest = yield* Effect.flatMap(
            digestSchemaValue(WorkflowExecutionRecordSchema, projection.workflowRecord),
            decodeOpenAgentTraceContentDigest
          )
          const graphManifestDigest = yield* Effect.flatMap(
            digestSchemaValue(GraphExecutionManifestSchema, projection.workflowRecord.graph),
            decodeOpenAgentTraceContentDigest
          )
          const evaluationContractDigest = yield* Effect.flatMap(
            digestSchemaValue(EvaluationContractSchema, projection.workflowRecord.evaluation),
            decodeOpenAgentTraceContentDigest
          )

          return yield* decodeArtifactPayload(
            Schema.encode(OpenAgentTraceArtifactPayload)(
              new OpenAgentTraceWorkflowProjectionArtifact({
                artifactKind: "open-agent-trace-workflow-projection",
                lineage,
                projectionLineage: new OpenAgentTraceWorkflowProjectionLineage({
                  projectionKind: "workflow-record",
                  projectionVersion: PROJECTION_VERSION,
                  workflowRecordId: projection.workflowRecord.recordId,
                  workflowRecordDigest,
                  graphManifestDigest,
                  evaluationContractDigest
                }),
                projection
              })
            )
          )
        })
        : decodeArtifactPayload(
          Schema.encode(OpenAgentTraceArtifactPayload)(
            new OpenAgentTraceExampleProjectionArtifact({
              artifactKind: "open-agent-trace-example-projection",
              lineage,
              projectionLineage: new OpenAgentTraceExampleProjectionLineage({
                projectionKind: "example-set",
                projectionVersion: PROJECTION_VERSION,
                exampleSetDigest: projection.examplesDigest,
                exampleCount: projection.examples.length,
                objectiveSurfaceId: `open-agent-trace:${projection.workflowKind}:examples`
              }),
              projection
            })
          )
        )
  })

/**
 * Wrap one normalized trace or one bounded projection in `effect-search` artifact-envelope transport.
 *
 * @since 0.2.0
 * @category combinators
 */
export const projectOpenAgentTraceToArtifact = (options: {
  readonly record: OpenAgentTraceRecordModel
  readonly packageVersion: SearchContracts.PackageVersion
  readonly runId: SearchContracts.RunId
  readonly sequence: number
  readonly emittedAt: Schema.Schema.Type<typeof Schema.DateTimeUtc>
  readonly projection?: OpenAgentTraceProjection
}) =>
  Effect.gen(function*() {
    const lineage = yield* artifactLineageFor(options.record)
    const payload = yield* payloadFor(options.record, lineage, options.projection)

    return SearchContracts.Custom({
      schemaVersion: "artifact-envelope/v1",
      producer: SearchContracts.EffectDsp({
        packageVersion: options.packageVersion,
        component: ["OpenAgentTrace", "projection"],
        runId: options.runId,
        optimizer: "open-agent-trace",
        metricName: options.projection?.projectionKind ?? "record",
        exampleName: options.record.recordId
      }),
      lineage: new SearchContracts.ArtifactLineage({
        sourceRef: new SearchContracts.SourceRef({
          origin: "effect-dsp",
          domain: "open-agent-trace",
          segments: ["projection"]
        }),
        artifactId: new SearchContracts.ArtifactId({ runId: options.runId, sequence: options.sequence }),
        emittedAt: options.emittedAt,
        integrity: options.record.source.redactedHash
      }),
      relations: [
        SearchContracts.ExternalRelation({
          ref: formatOpenAgentTraceContentDigest(options.record.source.sourceHash),
          namespace: "pi-share-hf/source"
        }),
        SearchContracts.ExternalRelation({
          ref: options.record.source.redactionKey,
          namespace: "pi-share-hf/redaction"
        }),
        SearchContracts.ExternalRelation({ ref: options.record.source.sessionId, namespace: "pi/session" })
      ],
      payload
    })
  })
