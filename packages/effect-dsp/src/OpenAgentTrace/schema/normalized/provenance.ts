/**
 * Provenance digest and corpus-manifest schemas for normalized open-agent-trace records.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { OpenAgentTraceContentDigest } from "./authorities.js"

/**
 * Canonical source-digest surface for one normalized public trace row.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceSourceDigest extends Schema.Class<OpenAgentTraceSourceDigest>("OpenAgentTraceSourceDigest")({
  digest: OpenAgentTraceContentDigest
}) {}

/**
 * Canonical record-digest surface for one normalized public trace row.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceRecordDigest extends Schema.Class<OpenAgentTraceRecordDigest>("OpenAgentTraceRecordDigest")({
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
export class OpenAgentTraceCorpusManifest
  extends Schema.Class<OpenAgentTraceCorpusManifest>("OpenAgentTraceCorpusManifest")({
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
  })
{}
