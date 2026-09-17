/**
 * Shipped punctuation mirror pairs and explicitly unsupported bidi-control ranges.
 *
 * @since 0.2.0
 */
import { Boolean, Number, Option, Schema, String, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as Rec from "effect/Record"

/** Mirror pairs used by the shipped bidi visual-order implementation. */
export const bidiMirrorPairs = Arr.make(
  Tuple.make("(", ")"),
  Tuple.make(")", "("),
  Tuple.make("[", "]"),
  Tuple.make("]", "["),
  Tuple.make("{", "}"),
  Tuple.make("}", "{"),
  Tuple.make("<", ">"),
  Tuple.make(">", "<"),
  Tuple.make("«", "»"),
  Tuple.make("»", "«"),
  Tuple.make("‹", "›"),
  Tuple.make("›", "‹"),
  Tuple.make("〈", "〉"),
  Tuple.make("〉", "〈"),
  Tuple.make("《", "》"),
  Tuple.make("》", "《"),
  Tuple.make("「", "」"),
  Tuple.make("」", "「"),
  Tuple.make("『", "』"),
  Tuple.make("』", "『"),
  Tuple.make("【", "】"),
  Tuple.make("】", "【"),
  Tuple.make("〔", "〕"),
  Tuple.make("〕", "〔"),
  Tuple.make("〖", "〗"),
  Tuple.make("〗", "〖"),
  Tuple.make("〘", "〙"),
  Tuple.make("〙", "〘"),
  Tuple.make("〚", "〛"),
  Tuple.make("〛", "〚"),
  Tuple.make("（", "）"),
  Tuple.make("）", "（"),
  Tuple.make("［", "］"),
  Tuple.make("］", "［"),
  Tuple.make("｛", "｝"),
  Tuple.make("｝", "｛")
)

class CodePointRange extends Schema.Class<CodePointRange>("effect-text/BidiCodePointRange")({
  end: Schema.Number,
  start: Schema.Number
}) {}

const CodePointRanges = Schema.Array(CodePointRange)
type CodePointRanges = typeof CodePointRanges.Type

/** Unicode ranges for bidi controls intentionally left outside the shipped support envelope. */
export const unsupportedBidiControlRanges: CodePointRanges = Arr.make(
  new CodePointRange({ end: 0x061c, start: 0x061c }),
  new CodePointRange({ end: 0x200f, start: 0x200e }),
  new CodePointRange({ end: 0x202e, start: 0x202a }),
  new CodePointRange({ end: 0x2069, start: 0x2066 })
)

const mirrorLookup = Rec.fromEntries(bidiMirrorPairs)

/** Mirrors one governed bidi punctuation character when a visual rtl run requires it. */
export const mirrorCharacter = (character: string): string =>
  Rec.get(mirrorLookup, character).pipe(Option.getOrElse(() => character))

/** Tests whether a character participates in the shipped mirror table. */
export const isMirroredCharacter = (character: string): boolean => Rec.has(mirrorLookup, character)

/** Detects whether any character in a string needs mirrored-glyph handling. */
export const containsMirroredCharacters = (text: string): boolean =>
  Arr.some(Arr.fromIterable(text), isMirroredCharacter)

const codePointIsInRange = (codePoint: number, range: CodePointRange): boolean =>
  Boolean.and(Number.greaterThanOrEqualTo(codePoint, range.start), Number.lessThanOrEqualTo(codePoint, range.end))

/** Detects bidi control characters that stay outside the shipped visual-order envelope. */
export const isUnsupportedBidiControl = (character: string): boolean =>
  String.codePointAt(character, 0).pipe(
    Option.match({
      onNone: () => false,
      onSome: (codePoint) => Arr.some(unsupportedBidiControlRanges, (range) => codePointIsInRange(codePoint, range))
    })
  )

/** Detects whether a string contains unsupported bidi controls. */
export const containsUnsupportedBidiControls = (text: string): boolean =>
  Arr.some(Arr.fromIterable(text), isUnsupportedBidiControl)
