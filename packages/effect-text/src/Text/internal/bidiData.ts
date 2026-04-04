/**
 * Governed bidi support data.
 *
 * @since 0.2.0
 */
import * as Arr from "effect/Array"

/**
 * Mirror-pair authority for the shipped bidi visual-order envelope.
 *
 * @since 0.2.0
 * @category internals
 */
export const bidiMirrorPairs: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ["(", ")"],
  [")", "("],
  ["[", "]"],
  ["]", "["],
  ["{", "}"],
  ["}", "{"],
  ["<", ">"],
  [">", "<"],
  ["«", "»"],
  ["»", "«"],
  ["‹", "›"],
  ["›", "‹"],
  ["〈", "〉"],
  ["〉", "〈"],
  ["《", "》"],
  ["》", "《"],
  ["「", "」"],
  ["」", "「"],
  ["『", "』"],
  ["』", "『"],
  ["【", "】"],
  ["】", "【"],
  ["〔", "〕"],
  ["〕", "〔"],
  ["〖", "〗"],
  ["〗", "〖"],
  ["〘", "〙"],
  ["〙", "〘"],
  ["〚", "〛"],
  ["〛", "〚"],
  ["（", "）"],
  ["）", "（"],
  ["［", "］"],
  ["］", "［"],
  ["｛", "｝"],
  ["｝", "｛"]
])

/**
 * Unicode ranges for bidi controls intentionally left outside the shipped support envelope.
 *
 * @since 0.2.0
 * @category internals
 */
export const unsupportedBidiControlRanges: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [0x061c, 0x061c],
  [0x200e, 0x200f],
  [0x202a, 0x202e],
  [0x2066, 0x2069]
])

/**
 * Mirrors one governed bidi punctuation character when a visual rtl run requires it.
 *
 * @since 0.2.0
 * @category internals
 */
export const mirrorCharacter = (character: string): string =>
  Arr.reduce(
    bidiMirrorPairs,
    character,
    (mirrored, [source, target]) => source === character ? target : mirrored
  )

/**
 * Tests whether a character participates in the shipped mirror table.
 *
 * @since 0.2.0
 * @category internals
 */
export const isMirroredCharacter = (character: string): boolean =>
  Arr.some(bidiMirrorPairs, ([source]) => source === character)

/**
 * Detects whether any character in a string needs mirrored-glyph handling.
 *
 * @since 0.2.0
 * @category internals
 */
export const containsMirroredCharacters = (text: string): boolean =>
  Arr.some(Arr.fromIterable(text), isMirroredCharacter)

/**
 * Detects bidi control characters that stay outside the shipped visual-order envelope.
 *
 * @since 0.2.0
 * @category internals
 */
export const isUnsupportedBidiControl = (character: string): boolean => {
  const codePoint = character.codePointAt(0) ?? -1

  return Arr.some(
    unsupportedBidiControlRanges,
    ([start, end]) => codePoint >= start && codePoint <= end
  )
}

/**
 * Detects whether a string contains unsupported bidi controls.
 *
 * @since 0.2.0
 * @category internals
 */
export const containsUnsupportedBidiControls = (text: string): boolean =>
  Arr.some(Arr.fromIterable(text), isUnsupportedBidiControl)
