/**
 * Workflow score results, loss summaries, and aggregate evaluation reports.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { ScoreComponentKindSchema } from "./ScoreComponentKind.js"
import { ScoreProfileSchema } from "./ScoreProfile.js"
import { WorkflowKindSchema } from "./WorkflowKind.js"

const FiniteNumber = Schema.Number.pipe(Schema.finite())
const NonNegativeFiniteNumber = FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0))
const ZeroToOneFiniteNumber = FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

/**
 * Per-component workflow score result with explicit raw, normalized, and
 * weighted values.
 *
 * @since 0.2.0
 * @category schemas
 */
export const ScoreComponentResultSchema = Schema.Struct({
  component: ScoreComponentKindSchema,
  rawValue: NonNegativeFiniteNumber,
  normalizedValue: ZeroToOneFiniteNumber,
  weight: NonNegativeFiniteNumber,
  weightedValue: NonNegativeFiniteNumber
})

/**
 * Score-component result extracted from {@link ScoreComponentResultSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type ScoreComponentResult = Schema.Schema.Type<typeof ScoreComponentResultSchema>

const EmptyScoreLossSummarySchema = Schema.Struct({
  count: Schema.Literal(0),
  mean: Schema.Literal(0),
  minimum: Schema.Literal(0),
  maximum: Schema.Literal(0),
  variance: Schema.Literal(0),
  standardDeviation: Schema.Literal(0)
})

const NonEmptyScoreLossSummarySchema = Schema.Struct({
  count: PositiveInt,
  mean: NonNegativeFiniteNumber,
  minimum: NonNegativeFiniteNumber,
  maximum: NonNegativeFiniteNumber,
  variance: NonNegativeFiniteNumber,
  standardDeviation: NonNegativeFiniteNumber
}).pipe(
  Schema.filter((summary) =>
    summary.minimum <= summary.maximum || "Expected minimum to be less than or equal to maximum"
  )
)

/**
 * Plain workflow loss summary kept package-local even when its shape mirrors
 * the downstream aggregation kernels used to produce it.
 *
 * @since 0.2.0
 * @category schemas
 */
export const ScoreLossSummarySchema = Schema.Union(EmptyScoreLossSummarySchema, NonEmptyScoreLossSummarySchema)

/**
 * Score-loss summary extracted from {@link ScoreLossSummarySchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type ScoreLossSummary = Schema.Schema.Type<typeof ScoreLossSummarySchema>

const WorkflowCaseEvaluationResultSchema = Schema.Struct({
  caseId: Schema.String,
  score: ZeroToOneFiniteNumber,
  loss: NonNegativeFiniteNumber,
  components: Schema.Array(ScoreComponentResultSchema)
})

/**
 * Aggregate workflow evaluation report for one reusable workflow profile.
 *
 * @since 0.2.0
 * @category schemas
 */
export const WorkflowEvaluationReportSchema = Schema.Struct({
  reportId: Schema.String,
  workflowKind: WorkflowKindSchema,
  profile: ScoreProfileSchema,
  totalCases: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  aggregateScore: ZeroToOneFiniteNumber,
  componentBreakdown: Schema.Array(ScoreComponentResultSchema),
  lossSummary: ScoreLossSummarySchema,
  caseResults: Schema.Array(WorkflowCaseEvaluationResultSchema)
})

/**
 * Workflow evaluation report extracted from
 * {@link WorkflowEvaluationReportSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type WorkflowEvaluationReport = Schema.Schema.Type<typeof WorkflowEvaluationReportSchema>
