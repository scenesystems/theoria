import { Schema } from "effect"

/**
 * Shared branded scalar vocabulary for cross-domain nominal numeric identities.
 *
 * The vocabulary names the scalar contracts that M3 hardening promotes into
 * concrete branded schemas (for example: `Dimension`, `Axis`, and tolerances).
 *
 * @since 0.1.0
 * @category contracts
 */
export const BrandedScalarVocabulary = Schema.Struct({
  absoluteTolerance: Schema.String,
  relativeTolerance: Schema.String,
  dimension: Schema.String,
  iterationBudget: Schema.String
})

/**
 * Shared branded scalar vocabulary type.
 *
 * @since 0.1.0
 * @category models
 */
export type BrandedScalarVocabularyType = typeof BrandedScalarVocabulary.Type
