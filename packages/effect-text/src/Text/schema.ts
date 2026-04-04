/**
 * Public schemas for text preparation and layout.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

const FiniteNumber = Schema.Number.pipe(Schema.finite())
const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

/**
 * Whitespace handling strategy for preparation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const WhiteSpaceMode = Schema.Literal("normal", "pre-wrap")

/**
 * Whitespace handling strategy type.
 *
 * @since 0.1.0
 * @category models
 */
export type WhiteSpaceModeType = typeof WhiteSpaceMode.Type

/**
 * Font descriptor used during measurement.
 *
 * @since 0.1.0
 * @category schemas
 */
export const FontDescriptor = Schema.Struct({
  family: Schema.String,
  size: FiniteNumber.pipe(Schema.greaterThan(0)),
  weight: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))
})

/**
 * Font descriptor type.
 *
 * @since 0.1.0
 * @category models
 */
export type FontDescriptorType = typeof FontDescriptor.Type

/**
 * Resolved base direction for a prepared paragraph.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BaseTextDirection = Schema.Literal("ltr", "rtl")

/**
 * Resolved base direction type.
 *
 * @since 0.1.0
 * @category models
 */
export type BaseTextDirectionType = typeof BaseTextDirection.Type

/**
 * Segment kinds compiled during preparation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TextSegmentKind = Schema.Literal("text", "space", "hard-break")

/**
 * Text segment schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TextSegment = Schema.Struct({
  kind: TextSegmentKind,
  text: Schema.String
})

/**
 * Text segment type.
 *
 * @since 0.1.0
 * @category models
 */
export type TextSegmentType = typeof TextSegment.Type

/**
 * Input accepted by `Text.prepare`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PrepareInput = Schema.Struct({
  text: Schema.String,
  font: FontDescriptor,
  whiteSpace: WhiteSpaceMode
})

/**
 * Typed prepare input.
 *
 * @since 0.1.0
 * @category models
 */
export type PrepareInputType = typeof PrepareInput.Type

/**
 * Request passed to pure layout APIs.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LayoutRequest = Schema.Struct({
  maxWidth: FiniteNumber.pipe(Schema.greaterThan(0)),
  lineHeight: FiniteNumber.pipe(Schema.greaterThan(0))
})

/**
 * Typed layout request.
 *
 * @since 0.1.0
 * @category models
 */
export type LayoutRequestType = typeof LayoutRequest.Type

/**
 * Cursor for incremental line walking.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LayoutCursor = Schema.Struct({
  segmentIndex: NonNegativeInt,
  graphemeIndex: NonNegativeInt
})

/**
 * Typed layout cursor.
 *
 * @since 0.1.0
 * @category models
 */
export type LayoutCursorType = typeof LayoutCursor.Type

const LayoutVisualMetadataFields = {
  order: Schema.Literal("visual"),
  baseDirection: BaseTextDirection
}

/**
 * A laid out line of visually ordered text.
 *
 * `text` is emitted in visual order while `baseDirection` keeps the prepared
 * paragraph direction available to consumers without leaking unstable
 * permutation internals.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LayoutLine = Schema.Struct({
  index: NonNegativeInt,
  ...LayoutVisualMetadataFields,
  text: Schema.String,
  width: FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0))
})

/**
 * Typed layout line.
 *
 * @since 0.1.0
 * @category models
 */
export type LayoutLineType = typeof LayoutLine.Type

/**
 * Non-materialized line geometry and logical cursor bounds for visually ordered output.
 *
 * `start` and `end` stay in logical source order even when the materialized
 * line text is visually reordered.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LayoutLineRange = Schema.Struct({
  ...LayoutVisualMetadataFields,
  width: FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0)),
  start: LayoutCursor,
  end: LayoutCursor
})

/**
 * Typed layout line range.
 *
 * @since 0.1.0
 * @category models
 */
export type LayoutLineRangeType = typeof LayoutLineRange.Type

/**
 * Summary returned by `Text.layout`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LayoutSummary = Schema.Struct({
  lineCount: NonNegativeInt,
  height: FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0)),
  maxLineWidth: FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0))
})

/**
 * Typed layout summary.
 *
 * @since 0.1.0
 * @category models
 */
export type LayoutSummaryType = typeof LayoutSummary.Type

/**
 * Runtime engine profile used during preparation and optional calibration.
 *
 * @since 0.1.0
 * @category schemas
 */
export const EngineProfile = Schema.Struct({
  lineFitEpsilon: FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0)),
  tabWidth: PositiveInt,
  defaultDirection: BaseTextDirection,
  preferEarlySoftHyphenBreak: Schema.Boolean,
  preferPrefixWidthsForBreakableRuns: Schema.Boolean
})

/**
 * Backward-compatible schema alias for the released engine-profile surface.
 *
 * @since 0.1.0
 * @category schemas
 */
export const EngineProfileSchema = EngineProfile

/**
 * Typed engine profile.
 *
 * @since 0.1.0
 * @category models
 */
export type EngineProfileType = typeof EngineProfile.Type
