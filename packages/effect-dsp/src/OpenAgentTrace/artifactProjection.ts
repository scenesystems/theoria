/**
 * Artifact-envelope transport for bounded open-agent-trace projections.
 *
 * @since 0.2.0
 */
import { Effect } from "effect"
import * as SearchContracts from "effect-search/Contracts"

import type { ArtifactEnvelopeProjectionOptions } from "./projectionArtifacts.js"
import { ArtifactLineage } from "./projectionArtifacts/lineage.js"
import { payloadFor } from "./projectionArtifacts/payload.js"
import type { Projection } from "./projectionSchema.js"
import { formatOpenAgentTraceContentDigest } from "./schema.js"

export const projectArtifactEnvelope = (
  options: ArtifactEnvelopeProjectionOptions & {
    readonly projection?: Projection
  }
) =>
  Effect.gen(function*() {
    const lineage = yield* ArtifactLineage.project(options.record)
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
      lineage: SearchContracts.ArtifactLineage.make({
        sourceRef: SearchContracts.SourceRef.make({
          origin: "effect-dsp",
          domain: "open-agent-trace",
          segments: ["projection"]
        }),
        artifactId: SearchContracts.ArtifactId.make({ runId: options.runId, sequence: options.sequence }),
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
