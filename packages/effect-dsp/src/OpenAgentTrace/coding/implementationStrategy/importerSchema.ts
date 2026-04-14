/**
 * Checked-in Amp corpus labels for the implementation-strategy surface.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { CodingPromptDatasetSplitSchema } from "../schema.js"

/**
 * Supported Amp capture lanes for the checked-in implementation-strategy corpus.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CaptureLaneSchema = Schema.Literal("plugin", "stream-json")

/**
 * Checked-in sidecar label for one curated implementation-strategy case.
 *
 * @since 0.2.0
 * @category models
 */
export class CaseLabel extends Schema.Class<CaseLabel>("OpenAgentTrace/ImplementationStrategy/CaseLabel")({
  caseId: Schema.String,
  threadId: Schema.String,
  captureLane: CaptureLaneSchema,
  split: CodingPromptDatasetSplitSchema,
  task: Schema.String,
  constraints: Schema.Array(Schema.String),
  files: Schema.Array(Schema.String),
  rejectedMoves: Schema.Array(Schema.String),
  expectedStrategy: Schema.String
}) {}

/**
 * Ordered manifest for the checked-in Amp implementation-strategy corpus.
 *
 * @since 0.2.0
 * @category models
 */
export class CorpusManifest extends Schema.Class<CorpusManifest>(
  "OpenAgentTrace/ImplementationStrategy/CorpusManifest"
)({
  datasetId: Schema.String,
  caseFiles: Schema.NonEmptyArray(Schema.String)
}) {}

/**
 * Decoded Amp capture-lane union for implementation-strategy labels.
 *
 * @since 0.2.0
 * @category type-level
 */
export type CaptureLane = typeof CaptureLaneSchema.Type
