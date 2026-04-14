/**
 * Prompt-surface bridge for shared coding projections.
 *
 * @since 0.2.0
 */
import type { FieldRecord } from "../../contracts/FieldValue.js"
import type { OpenAgentTraceRecord } from "../schema.js"
import { projectCodingEvidence } from "./evidence.js"
import { projectCodingOutcome } from "./outcome.js"
import {
  type CodingEvidenceProjection,
  type CodingOutcomeProjection,
  CodingPromptCase,
  type CodingPromptDatasetSplit,
  type CodingTaskProjection
} from "./schema.js"
import { projectCodingTask } from "./task.js"

/**
 * Shared prompt-surface projection input passed to prompt-case builders.
 *
 * @since 0.2.0
 * @category models
 */
export type CodingPromptSurfaceProjection = Readonly<{
  readonly record: OpenAgentTraceRecord
  readonly task: CodingTaskProjection
  readonly evidence: CodingEvidenceProjection
  readonly outcome: CodingOutcomeProjection
}>

/**
 * Shared prompt-surface contract that turns shared coding projections into an
 * optimizer-ready input record.
 *
 * @since 0.2.0
 * @category models
 */
export type CodingPromptSurface = Readonly<{
  readonly surfaceId: string
  readonly buildInput: (projection: CodingPromptSurfaceProjection) => FieldRecord
}>

/**
 * Projects one normalized coding trace into a prompt-surface-ready case.
 *
 * @since 0.2.0
 * @category constructors
 */
export const projectCodingPromptCase = (options: {
  readonly record: OpenAgentTraceRecord
  readonly split: CodingPromptDatasetSplit
  readonly surface: CodingPromptSurface
  readonly expectedOutput?: FieldRecord
}): CodingPromptCase => {
  const task = projectCodingTask(options.record)
  const evidence = projectCodingEvidence(options.record)
  const outcome = projectCodingOutcome(options.record, evidence)

  return new CodingPromptCase({
    caseId: `${task.taskId}:${options.surface.surfaceId}`,
    surfaceId: options.surface.surfaceId,
    split: options.split,
    task,
    evidence,
    outcome,
    input: options.surface.buildInput({ record: options.record, task, evidence, outcome }),
    expectedOutput: options.expectedOutput
  })
}
