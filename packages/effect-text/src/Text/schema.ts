/**
 * Validation contracts for text preparation and layout geometry.
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
 * Preparation policy: collapse whitespace (`normal`) or preserve spaces, tabs,
 * and hard breaks (`pre-wrap`).
 *
 * @since 0.1.0
 * @category models
 */
export type WhiteSpaceModeType = typeof WhiteSpaceMode.Type

/**
 * Measurement font in CSS pixels; omitted weight is normalized to `400`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const FontDescriptor = Schema.Struct({
  /** CSS font-family value passed to the measurement service. */
  family: Schema.String,
  /** Positive font size in CSS pixels. */
  size: FiniteNumber.pipe(Schema.greaterThan(0)),
  /** Positive integer font weight; preparation defaults omission to `400`. */
  weight: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))
})

/**
 * Font family, positive size in CSS pixels, and optional positive integer weight.
 *
 * @since 0.1.0
 * @category models
 */
export type FontDescriptorType = typeof FontDescriptor.Type

/**
 * Locale identifier used to request dictionary hyphenation during preparation.
 *
 * @remarks
 * The package treats this as an opaque, non-empty locale key, then lets the
 * hyphenation seam canonicalize case and separator spellings. The shipped
 * dictionary layer also falls back from tagged variants to a shipped base
 * language when one exists.
 *
 * @since 0.2.0
 * @category schemas
 */
export const HyphenationLocale = Schema.String.pipe(Schema.minLength(1))

/**
 * Non-empty locale key resolved by the hyphenation service at preparation time.
 *
 * @since 0.2.0
 * @category models
 */
export type HyphenationLocaleType = typeof HyphenationLocale.Type

/**
 * Resolved base direction for a prepared paragraph.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BaseTextDirection = Schema.Literal("ltr", "rtl")

/**
 * Paragraph direction retained by prepared handles and projected lines.
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
 * Decodes a logical text, collapsible-space, or hard-break segment.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TextSegment = Schema.Struct({
  /** Segment behavior during whitespace handling and line breaking. */
  kind: TextSegmentKind,
  /** Source text represented by the segment. */
  text: Schema.String
})

/**
 * Logical segment emitted by `Contracts.WordSegmenter`.
 *
 * @since 0.1.0
 * @category models
 */
export type TextSegmentType = typeof TextSegment.Type

/**
 * Input compiled by preparation; all measurement uses `font`, while an optional
 * locale activates a provided hyphenation dictionary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PrepareInput = Schema.Struct({
  /** Source text measured and compiled by preparation. */
  text: Schema.String,
  /** Font used for every measurement in the prepared handle. */
  font: FontDescriptor,
  /** Whitespace normalization policy applied before measurement. */
  whiteSpace: WhiteSpaceMode,
  /** Dictionary locale; omission disables dictionary hyphenation. */
  hyphenationLocale: Schema.optional(HyphenationLocale)
})

/**
 * Raw text and preparation policies accepted by typed constructors.
 *
 * @since 0.1.0
 * @category models
 */
export type PrepareInputType = typeof PrepareInput.Type

/**
 * Positive available width and per-line height, both in caller-defined units
 * consistent with the measurement service.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LayoutRequest = Schema.Struct({
  /** Positive available width in measurement-service units. */
  maxWidth: FiniteNumber.pipe(Schema.greaterThan(0)),
  /** Positive painted line height in the caller's coordinate units. */
  lineHeight: FiniteNumber.pipe(Schema.greaterThan(0))
})

/**
 * Geometry supplied to pure layout projections.
 *
 * @since 0.1.0
 * @category models
 */
export type LayoutRequestType = typeof LayoutRequest.Type

/**
 * Logical segment/grapheme position used to resume incremental line walking.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LayoutCursor = Schema.Struct({
  /** Zero-based logical segment position. */
  segmentIndex: NonNegativeInt,
  /** Zero-based grapheme position within the segment. */
  graphemeIndex: NonNegativeInt
})

/**
 * Logical source position between projected lines.
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
 * @remarks
 * `text` is emitted in visual order while `baseDirection` keeps the prepared
 * paragraph direction available to consumers without leaking unstable
 * permutation internals.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LayoutLine = Schema.Struct({
  /** Zero-based output line position. */
  index: NonNegativeInt,
  ...LayoutVisualMetadataFields,
  /** Materialized line contents in visual order. */
  text: Schema.String,
  /** Painted width in measurement-service units. */
  width: FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0))
})

/**
 * Materialized visual-order line; `width` uses the measurer's units.
 *
 * @since 0.1.0
 * @category models
 */
export type LayoutLineType = typeof LayoutLine.Type

/**
 * Non-materialized line geometry and logical cursor bounds for visually ordered output.
 *
 * @remarks
 * `start` and `end` stay in logical source order even when the materialized
 * line text is visually reordered.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LayoutLineRange = Schema.Struct({
  ...LayoutVisualMetadataFields,
  /** Painted width in measurement-service units. */
  width: FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0)),
  /** Inclusive logical source cursor. */
  start: LayoutCursor,
  /** Exclusive logical source cursor. */
  end: LayoutCursor
})

/**
 * Non-materialized line width and half-open logical cursor bounds.
 *
 * @since 0.1.0
 * @category models
 */
export type LayoutLineRangeType = typeof LayoutLineRange.Type

/**
 * Aggregate geometry: painted maximum width and `lineCount * lineHeight`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LayoutSummary = Schema.Struct({
  /** Number of projected lines. */
  lineCount: NonNegativeInt,
  /** Product of line count and requested line height. */
  height: FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0)),
  /** Greatest painted line width, or zero for empty text. */
  maxLineWidth: FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0))
})

/**
 * Pure aggregate projection over a prepared handle.
 *
 * @since 0.1.0
 * @category models
 */
export type LayoutSummaryType = typeof LayoutSummary.Type

/**
 * Preparation-time fit tolerance, tab columns, bidi fallback, and discretionary
 * break-measurement preferences.
 *
 * @since 0.2.0
 * @category schemas
 */
export const EngineProfile = Schema.Struct({
  /** Non-negative tolerance added when deciding whether a run fits. */
  lineFitEpsilon: FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0)),
  /** Positive number of space columns represented by a tab stop. */
  tabWidth: PositiveInt,
  /** Paragraph direction used when source text has no strong direction. */
  defaultDirection: BaseTextDirection,
  /** Whether an earlier soft-hyphen break wins over a later fit. */
  preferEarlySoftHyphenBreak: Schema.Boolean,
  /** Whether prepared prefix measurements drive breakable-run fitting. */
  preferPrefixWidthsForBreakableRuns: Schema.Boolean
})

/**
 * Compatibility name decoding the same preparation-time settings as `EngineProfile`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const EngineProfileSchema = EngineProfile

/**
 * Engine settings captured when a prepared handle is compiled.
 *
 * @since 0.1.0
 * @category models
 */
export type EngineProfileType = typeof EngineProfile.Type
