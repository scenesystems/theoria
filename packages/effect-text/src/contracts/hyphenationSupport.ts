/**
 * Declares the dictionaries bundled by the default hyphenation layer.
 *
 * @since 0.2.0
 */

/**
 * Bundled locale keys and exact-tag-to-base-language fallback policy.
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
