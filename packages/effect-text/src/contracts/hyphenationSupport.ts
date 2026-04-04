/**
 * Shared hyphenation support data used by the runtime layer and release support manifest.
 *
 * @since 0.2.0
 */

/**
 * Support-data authority for the shipped hyphenation locale set and fallback policy.
 *
 * @since 0.2.0
 * @category support
 */
export const HyphenationSupportManifest: Readonly<{
  readonly localeFallback: "exact-or-base-language"
  readonly locales: ReadonlyArray<string>
}> = {
  localeFallback: "exact-or-base-language",
  locales: ["en-us", "en-gb", "de", "fr", "es"]
}
