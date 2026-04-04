/**
 * Shared bidi support data used by the runtime kernel and release support manifest.
 *
 * @since 0.2.0
 */

/**
 * Mirror-pair authority for the shipped bidi visual-order envelope.
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
