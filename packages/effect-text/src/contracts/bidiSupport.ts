/**
 * Declares punctuation pairs mirrored by visual RTL materialization.
 *
 * @since 0.2.0
 */

/**
 * Directed source-to-rendered punctuation substitutions for odd bidi levels.
 *
 * @since 0.2.0
 * @category support
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
