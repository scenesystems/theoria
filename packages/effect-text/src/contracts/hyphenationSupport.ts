/**
 * Declares the dictionaries bundled by the default hyphenation layer.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"
import * as Arr from "effect/Array"

/**
 * Candidate UTF-16 break offsets returned by a hyphenation dictionary.
 *
 * @since 0.2.0
 * @category schemas
 */
export const HyphenationBreakPoints = Schema.Array(Schema.Number.pipe(Schema.int()))

/**
 * Candidate UTF-16 break offsets returned by a hyphenation dictionary.
 *
 * @since 0.2.0
 * @category models
 */
export type HyphenationBreakPointsType = typeof HyphenationBreakPoints.Type

/**
 * Bundled locale keys and locale fallback policy.
 *
 * @since 0.2.0
 * @category schemas
 */
export class HyphenationSupportManifestSchema extends Schema.Class<HyphenationSupportManifestSchema>(
  "effect-text/HyphenationSupportManifest"
)({
  localeFallback: Schema.Literal("exact-or-base-language"),
  locales: Schema.NonEmptyArray(Schema.String)
}) {}

/**
 * Bundled locale keys and locale fallback policy.
 *
 * @since 0.2.0
 * @category models
 */
export type HyphenationSupportManifestType = HyphenationSupportManifestSchema

/**
 * Bundled locale keys and exact-tag-to-base-language fallback policy.
 *
 * @since 0.2.0
 * @category support
 */
export const HyphenationSupportManifest = new HyphenationSupportManifestSchema({
  localeFallback: "exact-or-base-language",
  locales: Arr.make("en-us", "en-gb", "de", "fr", "es")
})
