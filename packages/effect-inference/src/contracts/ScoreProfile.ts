/**
 * Explicit workflow score weights, normalization policy, and profile families.
 *
 * @since 0.2.0
 */
import { Array as Arr, Record, Schema } from "effect"

import { ScoreComponentKindSchema } from "./ScoreComponentKind.js"
import { WorkflowKindSchema } from "./WorkflowKind.js"
import { EvaluationProfileFamilySchema } from "./WorkflowVocabulary.js"

const FiniteNumber = Schema.Number.pipe(Schema.finite())
const NonNegativeFiniteNumber = FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0))
const PositiveFiniteNumber = FiniteNumber.pipe(Schema.greaterThan(0))

/**
 * Released workflow weights for the shared score vocabulary.
 *
 * Zero is allowed for comparability across profiles, while positivity is
 * enforced at the profile level so every shipped profile still activates at
 * least one component.
 *
 * @since 0.2.0
 * @category schemas
 */
export const ScoreWeightsSchema = Schema.Struct({
  taskSuccess: NonNegativeFiniteNumber,
  grounding: NonNegativeFiniteNumber,
  conversationContinuity: NonNegativeFiniteNumber,
  routeEfficiency: NonNegativeFiniteNumber,
  renderFitness: NonNegativeFiniteNumber,
  tokenCost: NonNegativeFiniteNumber,
  latency: NonNegativeFiniteNumber
})

/**
 * Score-weight record extracted from {@link ScoreWeightsSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type ScoreWeights = Schema.Schema.Type<typeof ScoreWeightsSchema>

const BeneficialScoreNormalizationSchema = Schema.Struct({
  kind: Schema.Literal("identity-zero-to-one"),
  direction: Schema.Literal("higher-is-better"),
  minimum: Schema.Literal(0),
  maximum: Schema.Literal(1)
})

const RenderFitnessNormalizationSchema = Schema.Struct({
  kind: Schema.Literal("support-profile-tolerance"),
  direction: Schema.Literal("higher-is-better"),
  supportProfileRef: Schema.String,
  fontIdentityRef: Schema.String,
  fontReadinessRevision: Schema.String,
  toleranceRef: Schema.String
})

const BudgetInverseNormalizationSchema = Schema.Struct({
  kind: Schema.Literal("budget-inverse"),
  direction: Schema.Literal("lower-is-better"),
  budget: PositiveFiniteNumber,
  unit: Schema.String
})

/**
 * Explicit normalization policy for every released workflow score component.
 *
 * @since 0.2.0
 * @category schemas
 */
export const ScoreNormalizationPolicySchema = Schema.Struct({
  taskSuccess: BeneficialScoreNormalizationSchema,
  grounding: BeneficialScoreNormalizationSchema,
  conversationContinuity: BeneficialScoreNormalizationSchema,
  routeEfficiency: BeneficialScoreNormalizationSchema,
  renderFitness: RenderFitnessNormalizationSchema,
  tokenCost: BudgetInverseNormalizationSchema,
  latency: BudgetInverseNormalizationSchema
})

/**
 * Normalization-policy record extracted from
 * {@link ScoreNormalizationPolicySchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type ScoreNormalizationPolicy = Schema.Schema.Type<typeof ScoreNormalizationPolicySchema>

const hasPositiveWeight = (weights: ScoreWeights): boolean => Arr.some(Record.values(weights), (weight) => weight > 0)

/**
 * Released workflow score profile tying one family of evaluation cases to the
 * shared component vocabulary and explicit normalization policy.
 *
 * @since 0.2.0
 * @category schemas
 */
export const ScoreProfileSchema = Schema.Struct({
  profileId: Schema.String,
  profileFamily: EvaluationProfileFamilySchema,
  workflowKinds: Schema.NonEmptyArray(WorkflowKindSchema),
  components: Schema.NonEmptyArray(ScoreComponentKindSchema),
  weights: ScoreWeightsSchema,
  normalization: ScoreNormalizationPolicySchema
}).pipe(
  Schema.filter((profile) =>
    hasPositiveWeight(profile.weights) || "Expected at least one positive workflow score weight"
  )
)

/**
 * Score-profile type extracted from {@link ScoreProfileSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type ScoreProfile = Schema.Schema.Type<typeof ScoreProfileSchema>
