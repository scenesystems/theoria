/**
 * Released score-component vocabulary for reusable workflow evaluation.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

/**
 * Released component vocabulary shared by workflow profiles and reports.
 *
 * @since 0.2.0
 * @category schemas
 */
export const ScoreComponentKindSchema = Schema.Literal(
  "taskSuccess",
  "grounding",
  "conversationContinuity",
  "routeEfficiency",
  "renderFitness",
  "tokenCost",
  "latency"
)

/**
 * Score-component kind extracted from {@link ScoreComponentKindSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type ScoreComponentKind = Schema.Schema.Type<typeof ScoreComponentKindSchema>

/**
 * Beneficial score components that normalize directly on `[0,1]`.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BeneficialScoreComponentKindSchema = Schema.Literal(
  "taskSuccess",
  "grounding",
  "conversationContinuity",
  "routeEfficiency"
)

/**
 * Beneficial score-component kind extracted from
 * {@link BeneficialScoreComponentKindSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type BeneficialScoreComponentKind = Schema.Schema.Type<typeof BeneficialScoreComponentKindSchema>

/**
 * Budget-sensitive components that normalize by explicit inverse budgets.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BudgetedScoreComponentKindSchema = Schema.Literal("tokenCost", "latency")

/**
 * Budget-sensitive score-component kind extracted from
 * {@link BudgetedScoreComponentKindSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type BudgetedScoreComponentKind = Schema.Schema.Type<typeof BudgetedScoreComponentKindSchema>
