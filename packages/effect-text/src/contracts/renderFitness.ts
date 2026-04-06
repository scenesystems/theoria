/**
 * Stable render-fitness identity and evidence envelopes for downstream workflow scoring.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

const NonNegativeFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
const PositiveFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const UnitInterval = NonNegativeFiniteNumber.pipe(Schema.lessThanOrEqualTo(1))

/**
 * Stable summary fields required to derive downstream render-fitness evidence.
 *
 * @since 0.2.0
 * @category schemas
 */
export const RenderFitnessLayoutSummary = Schema.Struct({
  lineCount: NonNegativeInt,
  height: NonNegativeFiniteNumber,
  maxLineWidth: NonNegativeFiniteNumber
})

/**
 * Render-fitness layout-summary type.
 *
 * @since 0.2.0
 * @category models
 */
export type RenderFitnessLayoutSummaryType = typeof RenderFitnessLayoutSummary.Type

/**
 * Stable render-fitness identity and target envelope.
 *
 * @since 0.2.0
 * @category schemas
 */
export const RenderFitnessInput = Schema.Struct({
  supportProfileRef: Schema.String,
  fontIdentityRef: Schema.String,
  fontReadinessRevision: Schema.String,
  tolerancePx: NonNegativeFiniteNumber,
  toleranceRef: Schema.String,
  targetWidthPx: PositiveFiniteNumber,
  lineHeightPx: PositiveFiniteNumber,
  aboveFoldHeightPx: PositiveFiniteNumber
})

/**
 * Render-fitness input type.
 *
 * @since 0.2.0
 * @category models
 */
export type RenderFitnessInputType = typeof RenderFitnessInput.Type

/**
 * Stable normalization identity consumed by downstream score profiles.
 *
 * @since 0.2.0
 * @category schemas
 */
export const RenderFitnessNormalization = Schema.Struct({
  kind: Schema.Literal("support-profile-tolerance"),
  direction: Schema.Literal("higher-is-better"),
  supportProfileRef: Schema.String,
  fontIdentityRef: Schema.String,
  fontReadinessRevision: Schema.String,
  toleranceRef: Schema.String
})

/**
 * Render-fitness normalization type.
 *
 * @since 0.2.0
 * @category models
 */
export type RenderFitnessNormalizationType = typeof RenderFitnessNormalization.Type

/**
 * Stable render-fitness evidence emitted from prepared-layout summaries.
 *
 * @since 0.2.0
 * @category schemas
 */
export const RenderFitnessEvidence = Schema.Struct({
  input: RenderFitnessInput,
  supportProfileRef: Schema.String,
  fontIdentityRef: Schema.String,
  fontReadinessRevision: Schema.String,
  tolerancePx: NonNegativeFiniteNumber,
  toleranceRef: Schema.String,
  totalLineCount: NonNegativeInt,
  visibleLineCount: NonNegativeInt,
  aboveFoldCoverage: UnitInterval,
  spillBelowFoldPx: NonNegativeFiniteNumber,
  widthOverflowPx: NonNegativeFiniteNumber
})

/**
 * Render-fitness evidence type.
 *
 * @since 0.2.0
 * @category models
 */
export type RenderFitnessEvidenceType = typeof RenderFitnessEvidence.Type

/**
 * Stable font-identity reference used by downstream render-fitness scoring.
 *
 * @since 0.2.0
 * @category identities
 */
export const renderFitnessFontIdentity = (font: {
  readonly family: string
  readonly size: number
  readonly weight?: number
}): string => `${font.family}:${font.size}:${font.weight ?? "default"}`

/**
 * Stable tolerance reference used by downstream render-fitness scoring.
 *
 * @since 0.2.0
 * @category identities
 */
export const renderFitnessToleranceRef = (options: {
  readonly supportProfileRef: string
  readonly tolerancePx: number
}): string => `${options.supportProfileRef}:${options.tolerancePx}`

/**
 * Builds the stable render-fitness input envelope from support and font data.
 *
 * @since 0.2.0
 * @category identities
 */
export const renderFitnessInputFor = (options: {
  readonly supportProfileRef: string
  readonly font: {
    readonly family: string
    readonly size: number
    readonly weight?: number
  }
  readonly fontReadinessRevision: string | number
  readonly tolerancePx: number
  readonly targetWidthPx: number
  readonly lineHeightPx: number
  readonly aboveFoldHeightPx: number
}): RenderFitnessInputType => ({
  supportProfileRef: options.supportProfileRef,
  fontIdentityRef: renderFitnessFontIdentity(options.font),
  fontReadinessRevision: String(options.fontReadinessRevision),
  tolerancePx: options.tolerancePx,
  toleranceRef: renderFitnessToleranceRef({
    supportProfileRef: options.supportProfileRef,
    tolerancePx: options.tolerancePx
  }),
  targetWidthPx: options.targetWidthPx,
  lineHeightPx: options.lineHeightPx,
  aboveFoldHeightPx: options.aboveFoldHeightPx
})

/**
 * Projects the stable normalization identity from a render-fitness input.
 *
 * @since 0.2.0
 * @category identities
 */
export const renderFitnessNormalizationFor = (
  input: RenderFitnessInputType
): RenderFitnessNormalizationType => ({
  kind: "support-profile-tolerance",
  direction: "higher-is-better",
  supportProfileRef: input.supportProfileRef,
  fontIdentityRef: input.fontIdentityRef,
  fontReadinessRevision: input.fontReadinessRevision,
  toleranceRef: input.toleranceRef
})

/**
 * Projects stable render-fitness evidence from a prepared-layout summary.
 *
 * @since 0.2.0
 * @category projection
 */
export const renderFitnessEvidenceFromSummary = (
  input: RenderFitnessInputType,
  summary: RenderFitnessLayoutSummaryType
): RenderFitnessEvidenceType => {
  const visibleLineLimit = Math.max(Math.floor(input.aboveFoldHeightPx / input.lineHeightPx), 1)
  const visibleLineCount = Math.min(summary.lineCount, visibleLineLimit)
  const totalLineCount = Math.max(summary.lineCount, 1)

  return {
    input,
    supportProfileRef: input.supportProfileRef,
    fontIdentityRef: input.fontIdentityRef,
    fontReadinessRevision: input.fontReadinessRevision,
    tolerancePx: input.tolerancePx,
    toleranceRef: input.toleranceRef,
    totalLineCount: summary.lineCount,
    visibleLineCount,
    aboveFoldCoverage: visibleLineCount / totalLineCount,
    spillBelowFoldPx: Math.max(summary.height - input.aboveFoldHeightPx, 0),
    widthOverflowPx: Math.max(summary.maxLineWidth - input.targetWidthPx, 0)
  }
}
