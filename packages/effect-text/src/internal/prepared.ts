/**
 * Runtime state retained by prepared text handles.
 *
 * Prepared state is executable data, not a serialization format. Pure records
 * retain schemas, while caches, derived trees, and handle relationships use
 * `Data.Class` and Effect-native runtime structures.
 *
 * @internal
 * @since 0.5.0
 */
import type { Option } from "effect"
import { Array as Arr, Data, Order, RedBlackTree, Schema, Tuple } from "effect"
import * as HashMap from "effect/HashMap"
import * as MutableRef from "effect/MutableRef"

import type * as Hyphenation from "../Hyphenation.js"
import * as Text from "../Text.js"
import { TextDirection } from "./analysis.js"
import { HyphenatedPiece } from "./hyphenation.js"

/** @internal */
export const SegmentKind = Schema.Union(Schema.suspend(() => Text.SegmentKind), Schema.Literal("tab"))

/** @internal */
export type SegmentKind = typeof SegmentKind.Type

/** @internal */
export const BreakOpportunity = Schema.Union(HyphenatedPiece.fields.breakOpportunity, Schema.Literal("space"))

/** @internal */
export type BreakOpportunity = typeof BreakOpportunity.Type

/** @internal */
export const BreakKind = Schema.Literal(
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

/** @internal */
export type BreakKind = typeof BreakKind.Type

const StringValues = Schema.Array(Schema.String)
const WidthValues = Schema.Array(Schema.Number)

/** @internal */
export class Segment extends Schema.Class<Segment>("effect-text/PreparedSegment")({
  bidiLevel: Schema.Number,
  breakOpportunity: BreakOpportunity,
  breakText: Schema.String,
  breakWidth: Schema.Number,
  direction: Schema.suspend(() => TextDirection),
  fitPrefixWidths: WidthValues,
  fitWidth: Schema.Number,
  graphemeAdvances: WidthValues,
  graphemeBidiLevels: WidthValues,
  graphemes: StringValues,
  kind: SegmentKind,
  mirroredGraphemes: StringValues,
  text: Schema.String,
  width: Schema.Number
}) {}

/** @internal */
export const Segments = Schema.Array(Segment)

/** @internal */
export class RuntimeSegment extends Schema.Class<RuntimeSegment>("effect-text/PreparedRuntimeSegment")({
  breakKind: BreakKind,
  breakableGraphemeWidths: WidthValues,
  breakablePrefixWidths: WidthValues,
  fitAdvance: Schema.Number,
  graphemeBidiLevels: WidthValues,
  mirroredGraphemes: StringValues,
  paintAdvance: Schema.Number
}) {}

/** @internal */
export const RuntimeSegments = Schema.Array(RuntimeSegment)

/** @internal */
export class LineChunk extends Schema.Class<LineChunk>("effect-text/PreparedLineChunk")({
  consumedEndSegmentIndex: Schema.Number,
  startSegmentIndex: Schema.Number
}) {}

/** @internal */
export const LineChunks = Schema.Array(LineChunk)

/** @internal */
export class RuntimeTables extends Data.Class<{
  readonly chunks: typeof LineChunks.Type
  readonly discretionaryHyphenWidth: number
  readonly segments: typeof RuntimeSegments.Type
  readonly tabStopAdvance: number
}> {
  readonly chunksByEnd = RedBlackTree.fromIterable(
    Arr.map(this.chunks, (chunk) => Tuple.make(chunk.consumedEndSegmentIndex, chunk)),
    Order.number
  )
}

/** @internal */
export class Meta extends Data.Class<{
  readonly font: Text.Font
  readonly hyphenationLocale: Option.Option<Hyphenation.Locale>
  readonly text: string
}> {}

/** @internal */
export class Kernel extends Data.Class<{
  readonly baseDirection: Text.Direction
  readonly lineFitEpsilon: number
  readonly preferEarlySoftHyphenBreak: boolean
  readonly runtime: RuntimeTables
  readonly whiteSpace: Text.Whitespace
}> {}

/** @internal */
export class CursorHintKey extends Schema.Class<CursorHintKey>("effect-text/CursorHintKey")({
  graphemeIndex: Schema.Number,
  maxWidth: Schema.Number,
  segmentIndex: Schema.Number
}) {}

/** @internal */
export class Surface extends Data.Class<{
  readonly segments: typeof Segments.Type
}> {
  readonly cursorHints = MutableRef.make(HashMap.empty<CursorHintKey, number>())
}

/** @internal */
export class Compilation extends Data.Class<{
  readonly core: Text.Text
  readonly surface: Surface
}> {}
