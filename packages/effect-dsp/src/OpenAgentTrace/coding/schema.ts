/**
 * Shared coding-agent projection nouns derived from normalized traces.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { FieldRecord } from "../../contracts/FieldValue.js"

/**
 * Coarse coding-work classification derived from the initiating task request.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CodingWorkKindSchema = Schema.Literal(
  "implementation",
  "repair",
  "refactor",
  "review",
  "migration",
  "unknown"
)

/**
 * Coarse end-state classification for a coding-agent task.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CodingOutcomeKindSchema = Schema.Literal("success", "failure", "interrupted", "mixed", "unknown")

/**
 * Stable dataset splits for coding prompt studies.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CodingPromptDatasetSplitSchema = Schema.Literal("train", "validation", "holdout")

/**
 * Prompt-surface identifier carried by shared coding prompt cases.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CodingPromptSurfaceIdSchema = Schema.NonEmptyString.annotations({
  identifier: "effect-dsp/OpenAgentTrace/CodingPromptSurfaceId"
})

/**
 * Check or gate execution observed during a coding trace.
 *
 * @since 0.2.0
 * @category models
 */
export class CodingCheckRun extends Schema.Class<CodingCheckRun>("OpenAgentTrace/CodingCheckRun")({
  command: Schema.String,
  exitCode: Schema.optional(Schema.Number),
  passed: Schema.Boolean,
  cancelled: Schema.Boolean
}) {}

/**
 * Shared task projection derived from a normalized coding trace.
 *
 * @since 0.2.0
 * @category models
 */
export class CodingTaskProjection extends Schema.Class<CodingTaskProjection>("OpenAgentTrace/CodingTaskProjection")({
  taskId: Schema.String,
  sessionId: Schema.String,
  workKind: CodingWorkKindSchema,
  summary: Schema.String,
  prompt: Schema.String,
  constraints: Schema.Array(Schema.String),
  files: Schema.Array(Schema.String)
}) {}

/**
 * Shared execution evidence derived from a normalized coding trace.
 *
 * @since 0.2.0
 * @category models
 */
export class CodingEvidenceProjection
  extends Schema.Class<CodingEvidenceProjection>("OpenAgentTrace/CodingEvidenceProjection")({
    fileTouches: Schema.Array(Schema.String),
    checkRuns: Schema.Array(CodingCheckRun),
    failureSignals: Schema.Array(Schema.String),
    toolNames: Schema.Array(Schema.String),
    commandCount: Schema.Number
  })
{}

/**
 * Shared outcome projection derived from a normalized coding trace.
 *
 * @since 0.2.0
 * @category models
 */
export class CodingOutcomeProjection
  extends Schema.Class<CodingOutcomeProjection>("OpenAgentTrace/CodingOutcomeProjection")({
    outcome: CodingOutcomeKindSchema,
    completed: Schema.Boolean,
    checksPassed: Schema.optional(Schema.Boolean),
    finalAssistantMessage: Schema.optional(Schema.String),
    blockingReason: Schema.optional(Schema.String)
  })
{}

/**
 * Prompt-surface-ready case built on shared coding projections.
 *
 * @since 0.2.0
 * @category models
 */
export class CodingPromptCase extends Schema.Class<CodingPromptCase>("OpenAgentTrace/CodingPromptCase")({
  caseId: Schema.String,
  surfaceId: CodingPromptSurfaceIdSchema,
  split: CodingPromptDatasetSplitSchema,
  task: CodingTaskProjection,
  evidence: CodingEvidenceProjection,
  outcome: CodingOutcomeProjection,
  input: FieldRecord,
  expectedOutput: Schema.optional(FieldRecord)
}) {}

/**
 * Deterministic split counts for a coding prompt dataset.
 *
 * @since 0.2.0
 * @category models
 */
export class CodingPromptDatasetSplitSummary
  extends Schema.Class<CodingPromptDatasetSplitSummary>("OpenAgentTrace/CodingPromptDatasetSplitSummary")({
    train: Schema.Number,
    validation: Schema.Number,
    holdout: Schema.Number
  })
{}

/**
 * Shared dataset noun for prompt-surface-ready coding cases.
 *
 * @since 0.2.0
 * @category models
 */
export class CodingPromptDataset extends Schema.Class<CodingPromptDataset>("OpenAgentTrace/CodingPromptDataset")({
  datasetId: Schema.String,
  surfaceId: CodingPromptSurfaceIdSchema,
  cases: Schema.NonEmptyArray(CodingPromptCase),
  splitSummary: CodingPromptDatasetSplitSummary
}) {
  /**
   * Build a deterministic coding prompt dataset with derived split counts.
   *
   * @since 0.2.0
   */
  static of(options: {
    readonly datasetId: string
    readonly surfaceId: string
    readonly cases: readonly [CodingPromptCase, ...ReadonlyArray<CodingPromptCase>]
  }): CodingPromptDataset {
    const splitCount = (split: CodingPromptDatasetSplit): number =>
      options.cases.filter((value) => value.split === split).length

    return new CodingPromptDataset({
      datasetId: options.datasetId,
      surfaceId: options.surfaceId,
      cases: options.cases,
      splitSummary: new CodingPromptDatasetSplitSummary({
        train: splitCount("train"),
        validation: splitCount("validation"),
        holdout: splitCount("holdout")
      })
    })
  }
}

/**
 * Decoded coding work-kind union.
 *
 * @since 0.2.0
 * @category type-level
 */
export type CodingWorkKind = typeof CodingWorkKindSchema.Type

/**
 * Decoded coding outcome-kind union.
 *
 * @since 0.2.0
 * @category type-level
 */
export type CodingOutcomeKind = typeof CodingOutcomeKindSchema.Type

/**
 * Decoded coding dataset split union.
 *
 * @since 0.2.0
 * @category type-level
 */
export type CodingPromptDatasetSplit = typeof CodingPromptDatasetSplitSchema.Type
