/**
 * Governed bidi support data.
 *
 * @since 0.2.0
 */
import * as Arr from "effect/Array"

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

export const unsupportedBidiControlRanges: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [0x061c, 0x061c],
  [0x200e, 0x200f],
  [0x202a, 0x202e],
  [0x2066, 0x2069]
])

export const mirrorCharacter = (character: string): string =>
  Arr.reduce(
    bidiMirrorPairs,
    character,
    (mirrored, [source, target]) => source === character ? target : mirrored
  )

export const isMirroredCharacter = (character: string): boolean =>
  Arr.some(bidiMirrorPairs, ([source]) => source === character)

export const containsMirroredCharacters = (text: string): boolean =>
  Arr.some(Arr.fromIterable(text), isMirroredCharacter)

export const isUnsupportedBidiControl = (character: string): boolean => {
  const codePoint = character.codePointAt(0) ?? -1

  return Arr.some(
    unsupportedBidiControlRanges,
    ([start, end]) => codePoint >= start && codePoint <= end
  )
}

export const containsUnsupportedBidiControls = (text: string): boolean =>
  Arr.some(Arr.fromIterable(text), isUnsupportedBidiControl)
