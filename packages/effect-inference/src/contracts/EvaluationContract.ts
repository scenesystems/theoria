/**
 * Evaluation authority for reusable workflow cases.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { WorkflowKindSchema } from "./WorkflowKind.js"
import { EvaluationProfileFamilySchema } from "./WorkflowVocabulary.js"

/**
 * One reusable evaluation case inside a workflow evaluation bundle.
 *
 * @since 0.2.0
 * @category schemas
 */
export const EvaluationCaseSchema = Schema.Struct({
  caseId: Schema.String,
  prompt: Schema.String,
  expectedSignals: Schema.Array(Schema.String),
  renderCritical: Schema.Boolean
})

/**
 * Package-owned evaluation-case bundle for one workflow family.
 *
 * @since 0.2.0
 * @category schemas
 */
export const EvaluationContractSchema = Schema.Struct({
  workflowKind: WorkflowKindSchema,
  profileId: Schema.String,
  profileFamily: EvaluationProfileFamilySchema,
  cases: Schema.Array(EvaluationCaseSchema)
})

/**
 * Evaluation-contract type extracted from {@link EvaluationContractSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type EvaluationContract = Schema.Schema.Type<typeof EvaluationContractSchema>

/**
 * Evaluation case extracted from {@link EvaluationCaseSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type EvaluationCase = Schema.Schema.Type<typeof EvaluationCaseSchema>
