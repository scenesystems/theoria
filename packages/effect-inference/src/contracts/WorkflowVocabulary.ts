/**
 * Released workflow vocabulary shared across session, graph, and evaluation
 * contracts.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

/**
 * Allowed speaker roles within workflow session turns.
 *
 * @since 0.2.0
 * @category schemas
 */
export const SessionTurnRoleSchema = Schema.Literal("system", "user", "assistant", "tool")

/**
 * Session-turn role extracted from {@link SessionTurnRoleSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type SessionTurnRole = Schema.Schema.Type<typeof SessionTurnRoleSchema>

/**
 * Released workflow state lanes shared by graph nodes, projections, and
 * session state.
 *
 * @since 0.2.0
 * @category schemas
 */
export const WorkflowStateLaneSchema = Schema.Literal(
  "task",
  "context",
  "conversation",
  "retrieval",
  "tool-results",
  "render"
)

/**
 * Workflow state-lane type extracted from {@link WorkflowStateLaneSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type WorkflowStateLane = Schema.Schema.Type<typeof WorkflowStateLaneSchema>

/**
 * Released node kinds for bounded workflow graphs.
 *
 * @since 0.2.0
 * @category schemas
 */
export const WorkflowNodeKindSchema = Schema.Literal(
  "planner",
  "drafter",
  "critic",
  "synthesizer",
  "responder",
  "tool",
  "retrieval",
  "chat-handoff",
  "render-evaluator"
)

/**
 * Workflow node kind extracted from {@link WorkflowNodeKindSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type WorkflowNodeKind = Schema.Schema.Type<typeof WorkflowNodeKindSchema>

/**
 * Released edge kinds for bounded workflow graphs.
 *
 * @since 0.2.0
 * @category schemas
 */
export const WorkflowEdgeKindSchema = Schema.Literal(
  "next",
  "branch",
  "feedback",
  "tool-call",
  "retrieval",
  "handoff",
  "render-check"
)

/**
 * Workflow edge kind extracted from {@link WorkflowEdgeKindSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type WorkflowEdgeKind = Schema.Schema.Type<typeof WorkflowEdgeKindSchema>

/**
 * Released loop policies for bounded workflow execution.
 *
 * @since 0.2.0
 * @category schemas
 */
export const WorkflowLoopPolicySchema = Schema.Literal(
  "single-pass",
  "bounded-critique",
  "bounded-retry"
)

/**
 * Workflow loop policy extracted from {@link WorkflowLoopPolicySchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type WorkflowLoopPolicy = Schema.Schema.Type<typeof WorkflowLoopPolicySchema>

/**
 * Released manifest variants used to compare baseline and optimized graphs.
 *
 * @since 0.2.0
 * @category schemas
 */
export const GraphVariantSchema = Schema.Literal("baseline", "optimized")

/**
 * Graph-variant type extracted from {@link GraphVariantSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type GraphVariant = Schema.Schema.Type<typeof GraphVariantSchema>

/**
 * Explicit optimization knobs released for workflow graph search.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OptimizationKnobKindSchema = Schema.Literal(
  "instruction-profile",
  "runtime-profile",
  "candidate-count",
  "critique-pass-budget",
  "response-length-target",
  "tool-routing",
  "retrieval-depth",
  "node-enabled",
  "surface-profile"
)

/**
 * Optimization-knob kind extracted from {@link OptimizationKnobKindSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type OptimizationKnobKind = Schema.Schema.Type<typeof OptimizationKnobKindSchema>

/**
 * Released score-profile families used across bounded workflow manifests.
 *
 * @since 0.2.0
 * @category schemas
 */
export const EvaluationProfileFamilySchema = Schema.Literal(
  "task-oriented",
  "chat-oriented",
  "retrieval-oriented",
  "render-sensitive"
)

/**
 * Evaluation-profile family extracted from
 * {@link EvaluationProfileFamilySchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type EvaluationProfileFamily = Schema.Schema.Type<typeof EvaluationProfileFamilySchema>
