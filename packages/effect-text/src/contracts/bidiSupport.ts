/**
 * Declares punctuation pairs mirrored by visual RTL materialization.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"
import * as Arr from "effect/Array"
import * as Tuple from "effect/Tuple"

/**
 * A directed source-to-rendered punctuation substitution.
 *
 * @since 0.4.0
 * @category schemas
 */
export const BidiMirrorPair = Schema.Tuple(Schema.String, Schema.String)

/**
 * A non-empty collection of directed punctuation substitutions.
 *
 * @since 0.4.0
 * @category schemas
 */
export const BidiMirrorPairs = Schema.NonEmptyArray(BidiMirrorPair)

/**
 * Directed source-to-rendered punctuation substitutions for odd bidi levels.
 *
 * @since 0.2.0
 * @category support
 */
export const bidiMirrorPairs: typeof BidiMirrorPairs.Type = Arr.make(
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
