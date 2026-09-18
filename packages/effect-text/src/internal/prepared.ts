/**
 * Runtime state retained by prepared text handles.
 *
 * Prepared state is executable data, not a serialization format. Canonical
 * enums remain schemas, while records, caches, derived trees, and handle
 * relationships use `Data.Class` and Effect-native runtime structures.
 *
 * @internal
 * @since 0.5.0
 */
import { Chunk, Data, Order, RedBlackTree, Schema, Tuple } from "effect"
import * as HashMap from "effect/HashMap"
import * as MutableRef from "effect/MutableRef"

import { SegmentKind as TextSegmentKind } from "../Text.js"
import type { Direction, Whitespace } from "../Text.js"
import type { TextDirection } from "./analysis.js"
import { BreakOpportunity as HyphenatedBreakOpportunity } from "./hyphenation.js"

/** @internal */
export const SegmentKind = Schema.Union(Schema.suspend(() => TextSegmentKind), Schema.Literal("tab"))

/** @internal */
export type SegmentKind = typeof SegmentKind.Type

/** @internal */
export const BreakOpportunity = Schema.Union(HyphenatedBreakOpportunity, Schema.Literal("space"))

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

type StringValues = Chunk.Chunk<string>
type WidthValues = Chunk.Chunk<number>
type IndexedStringValues = ReadonlyArray<string>
type IndexedWidthValues = ReadonlyArray<number>

/** @internal */
export class Segment extends Data.Class<{
  readonly bidiLevel: number
  readonly breakOpportunity: BreakOpportunity
  readonly breakText: string
  readonly breakWidth: number
  readonly direction: TextDirection
  readonly fitPrefixWidths: WidthValues
  readonly fitWidth: number
  readonly graphemeAdvances: WidthValues
  readonly graphemeBidiLevels: WidthValues
  readonly graphemes: StringValues
  readonly kind: SegmentKind
  readonly mirroredGraphemes: StringValues
  readonly text: string
  readonly width: number
}> {}

/** @internal */
export type Segments = Chunk.Chunk<Segment>

/** @internal */
export class RuntimeSegment extends Data.Class<{
  readonly breakKind: BreakKind
  readonly breakableGraphemeCount: number
  readonly breakableGraphemeWidths: IndexedWidthValues
  readonly breakableFitAdvances: IndexedWidthValues
  readonly fitAdvance: number
  readonly graphemeBidiLevels: IndexedWidthValues
  readonly mirroredGraphemes: IndexedStringValues
  readonly paintAdvance: number
}> {}

/** @internal */
export type RuntimeSegments = ReadonlyArray<RuntimeSegment>

/** @internal */
export class LineChunk extends Data.Class<{
  readonly consumedEndSegmentIndex: number
  readonly startSegmentIndex: number
}> {}

/** @internal */
export type LineChunks = Chunk.Chunk<LineChunk>

/** @internal */
export class RuntimeTables extends Data.Class<{
  readonly chunks: LineChunks
  readonly discretionaryHyphenWidth: number
  readonly segments: RuntimeSegments
  readonly tabStopAdvance: number
}> {
  readonly chunksByEnd = RedBlackTree.fromIterable(
    Chunk.map(this.chunks, (chunk) => Tuple.make(chunk.consumedEndSegmentIndex, chunk)),
    Order.number
  )
}

/** @internal */
export class Kernel extends Data.Class<{
  readonly baseDirection: Direction
  readonly lineFitEpsilon: number
  readonly preferEarlySoftHyphenBreak: boolean
  readonly runtime: RuntimeTables
  readonly whiteSpace: Whitespace
}> {}

/** @internal */
export class CursorHintKey extends Data.Class<{
  readonly graphemeIndex: number
  readonly maxWidth: number
  readonly segmentIndex: number
}> {}

/** @internal */
export class Surface extends Data.Class<{
  readonly segments: ReadonlyArray<Segment>
}> {
  readonly cursorHints = MutableRef.make(HashMap.empty<CursorHintKey, number>())
}

/** @internal */
export class Compilation extends Data.Class<{
  readonly kernel: Kernel
  readonly surface: Surface
}> {}
