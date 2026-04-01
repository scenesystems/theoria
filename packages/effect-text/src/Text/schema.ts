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
  lineIndex: NonNegativeInt
})

/**
 * Typed layout cursor.
 *
 * @since 0.1.0
 * @category models
 */
export type LayoutCursorType = typeof LayoutCursor.Type

/**
 * A laid out line of text.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LayoutLine = Schema.Struct({
  index: NonNegativeInt,
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
 * Browser or runtime-specific line fitting behavior.
 *
 * @since 0.1.0
 * @category schemas
 */
export const EngineProfileSchema = Schema.Struct({
  lineFitEpsilon: FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0)),
  tabWidth: PositiveInt,
  defaultDirection: BaseTextDirection,
  preferEarlySoftHyphenBreak: Schema.Boolean,
  preferPrefixWidthsForBreakableRuns: Schema.Boolean
})

/**
 * Typed engine profile.
 *
 * @since 0.1.0
 * @category models
 */
export type EngineProfileType = typeof EngineProfileSchema.Type
