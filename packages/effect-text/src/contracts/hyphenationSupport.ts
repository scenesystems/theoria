/**
 * Declares the dictionaries bundled by the default hyphenation layer.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

const HyphenationSupportManifestSchema = Schema.Struct({
  localeFallback: Schema.Literal("exact-or-base-language"),
  locales: Schema.Array(Schema.String)
})

export type HyphenationSupportManifestType = typeof HyphenationSupportManifestSchema.Type

/**
 * Bundled locale keys and exact-tag-to-base-language fallback policy.
 *
 * @since 0.2.0
 * @category support
 */
export const HyphenationSupportManifest: HyphenationSupportManifestType = {
  localeFallback: "exact-or-base-language",
  locales: ["en-us", "en-gb", "de", "fr", "es"]
}
