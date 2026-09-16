/**
 * Schema-owned handles compiled once for repeated text-layout projections.
 *
 * @since 0.1.0
 */
import { Array as Arr, Order, RedBlackTree, Schema, Tuple } from "effect"
import * as HashMap from "effect/HashMap"
import * as MutableRef from "effect/MutableRef"

import { BaseTextDirection, FontDescriptor, HyphenationLocale, WhiteSpaceMode } from "./schema.js"

const NonNegativeFinite = Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const StringValues = Schema.Array(Schema.String)
const NonNegativeFiniteValues = Schema.Array(NonNegativeFinite)
const NonNegativeIntValues = Schema.Array(NonNegativeInt)

/** Internal prepared segment kinds. */
export const PreparedSegmentKind = Schema.Literal("text", "space", "hard-break", "tab")

/** Internal prepared segment directions. */
export const PreparedSegmentDirection = Schema.Literal("ltr", "rtl", "neutral")

/** Internal discretionary break opportunities. */
export const PreparedBreakOpportunity = Schema.Literal("none", "space", "soft-hyphen", "dictionary-hyphen")

/** Internal break kinds consumed by the walker. */
export const PreparedBreakKind = Schema.Literal(
  "text",
  "space",
  "preserved-space",
  "soft-hyphen",
  "dictionary-hyphen",
  "hard-break",
  "tab",
  "glue",
  "zero-width-break"
)

/** Internal prepared segment representation. */
export class PreparedSegment extends Schema.Class<PreparedSegment>("effect-text/PreparedSegment")({
  bidiLevel: NonNegativeInt,
  breakOpportunity: PreparedBreakOpportunity,
  breakText: Schema.String,
  breakWidth: NonNegativeFinite,
  direction: PreparedSegmentDirection,
  fitPrefixWidths: NonNegativeFiniteValues,
  fitWidth: NonNegativeFinite,
  graphemeAdvances: NonNegativeFiniteValues,
  graphemeBidiLevels: NonNegativeIntValues,
  graphemes: StringValues,
  kind: PreparedSegmentKind,
  mirroredGraphemes: StringValues,
  text: Schema.String,
  width: NonNegativeFinite
}) {}

/** One coherent walker record compiled for a logical segment. */
export class PreparedRuntimeSegment extends Schema.Class<PreparedRuntimeSegment>(
  "effect-text/PreparedRuntimeSegment"
)({
  breakKind: PreparedBreakKind,
  breakableGraphemeWidths: NonNegativeFiniteValues,
  breakablePrefixWidths: NonNegativeFiniteValues,
  fitAdvance: NonNegativeFinite,
  graphemeBidiLevels: NonNegativeIntValues,
  mirroredGraphemes: StringValues,
  paintAdvance: NonNegativeFinite
}) {}

/** Hard-break-delimited walker chunk. */
export class PreparedLineChunk extends Schema.Class<PreparedLineChunk>("effect-text/PreparedLineChunk")({
  consumedEndSegmentIndex: NonNegativeInt,
  startSegmentIndex: NonNegativeInt
}) {}

/** Coherent runtime records compiled during preparation. */
export class PreparedRuntimeTables extends Schema.Class<PreparedRuntimeTables>(
  "effect-text/PreparedRuntimeTables"
)({
  chunks: Schema.Array(PreparedLineChunk),
  discretionaryHyphenWidth: NonNegativeFinite,
  segments: Schema.Array(PreparedRuntimeSegment),
  tabStopAdvance: NonNegativeFinite
}) {
  readonly chunksByEnd = RedBlackTree.fromIterable(
    Arr.map(this.chunks, (chunk) => Tuple.make(chunk.consumedEndSegmentIndex, chunk)),
    Order.number
  )
}

/** Stable metadata retained alongside the kernel. */
export class PreparedTextMeta extends Schema.Class<PreparedTextMeta>("effect-text/PreparedTextMeta")({
  font: FontDescriptor,
  hyphenationLocale: Schema.OptionFromSelf(HyphenationLocale),
  text: Schema.String
}) {}

/** Runtime tables and policies consumed by the line walker. */
export class PreparedTextKernel extends Schema.Class<PreparedTextKernel>("effect-text/PreparedTextKernel")({
  baseDirection: BaseTextDirection,
  lineFitEpsilon: NonNegativeFinite,
  preferEarlySoftHyphenBreak: Schema.Boolean,
  runtime: PreparedRuntimeTables,
  whiteSpace: WhiteSpaceMode
}) {}

/** Retained logical surface used only for materialization support. */
export class PreparedTextLogicalSurface extends Schema.Class<PreparedTextLogicalSurface>(
  "effect-text/PreparedTextLogicalSurface"
)({
  segments: Schema.Array(PreparedSegment)
}) {}

/**
 * Marks prepared-handle representation and layout projection contracts as provisional.
 *
 * @since 0.1.0
 * @category stability
 */
export const TextStability = "provisional"

/** @since 0.1.0 @category internals */
export type PreparedBreakKindType = typeof PreparedBreakKind.Type
/** @since 0.1.0 @category internals */
export type PreparedSegmentType = PreparedSegment
/** @since 0.1.0 @category internals */
export type PreparedLineChunkType = PreparedLineChunk
/** @since 0.1.0 @category internals */
export type PreparedRuntimeSegmentType = PreparedRuntimeSegment
/** @since 0.1.0 @category internals */
export type PreparedRuntimeTablesType = PreparedRuntimeTables
/** @since 0.2.0 @category internals */
export type PreparedTextMetaType = PreparedTextMeta
/** @since 0.2.0 @category internals */
export type PreparedTextKernelType = PreparedTextKernel
/** @since 0.2.0 @category internals */
export type PreparedTextLogicalSurfaceType = PreparedTextLogicalSurface

/** Handle-local cursor hint key with structural Effect equality. */
export class PreparedTextCursorHintKey extends Schema.Class<PreparedTextCursorHintKey>(
  "effect-text/PreparedTextCursorHintKey"
)({
  graphemeIndex: Schema.Number,
  maxWidth: Schema.Number,
  segmentIndex: Schema.Number
}) {}

/**
 * Summary-only result of `Text.prepare` and `Text.prepareUnknown`.
 *
 * @remarks
 * The representation is provisional. It retains only the state required by
 * `Text.layout` and `Text.measureNaturalWidth`; request
 * `PreparedTextWithSegments` for materialized lines, ranges, cursors, or streams.
 *
 * @since 0.1.0
 * @category models
 */
export class PreparedText extends Schema.Class<PreparedText>("effect-text/PreparedText")({
  kernel: PreparedTextKernel,
  meta: PreparedTextMeta
}) {}

/**
 * Prepared handle retaining the logical segments needed for materialization.
 *
 * @since 0.1.0
 * @category models
 */
export class PreparedTextWithSegments extends PreparedText.extend<PreparedTextWithSegments>(
  "effect-text/PreparedTextWithSegments"
)({
  logicalSurface: PreparedTextLogicalSurface
}) {
  readonly cursorHints = MutableRef.make(HashMap.empty<PreparedTextCursorHintKey, number>())
}

const PreparedTextWithSegmentsCoreSchema = Schema.Struct(PreparedTextWithSegments.fields)

/** @since 0.1.0 @category internals */
export type PreparedTextCore = PreparedText
/** @since 0.2.0 @category internals */
export type PreparedTextWithSegmentsCore = typeof PreparedTextWithSegmentsCoreSchema.Type
