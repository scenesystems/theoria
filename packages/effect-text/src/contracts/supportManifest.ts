/**
 * Machine-readable runtime policies, browser fixtures, and benchmark budgets.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { bidiMirrorPairs } from "./bidiSupport.js"
import { BrowserSupportManifest, BrowserSupportManifestSchema } from "./browserSupport.js"
import { HyphenationSupportManifest } from "./hyphenationSupport.js"

const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const PositiveNumber = Schema.Number.pipe(Schema.greaterThan(0))
const OverflowBreakKind = Schema.Literal(
  "hard-break",
  "soft-hyphen",
  "dictionary-hyphen",
  "explicit-break",
  "grapheme-fallback"
)
const ExperimentalStabilitySchema = Schema.Literal("unstable")
const NonEmptyOverflowBreakArray = Schema.Array(OverflowBreakKind).pipe(Schema.minItems(1))
const NonEmptyMirrorPairArray = Schema.Array(Schema.Tuple(Schema.String, Schema.String)).pipe(Schema.minItems(1))

/**
 * Decodes the package's browser, hyphenation, overflow, bidi, benchmark, and
 * namespace-lane declarations.
 *
 * @since 0.2.0
 * @category schemas
 */
export const EffectTextSupportManifestSchema = Schema.Struct({
  /** Browser measurement profiles and synthetic scenario coverage. */
  browser: BrowserSupportManifestSchema,
  /** Bundled dictionaries and locale fallback policy. */
  hyphenation: Schema.Struct({
    /** Lookup order that tries an exact locale before its base language. */
    localeFallback: Schema.Literal("exact-or-base-language"),
    /** Locale tags with a bundled hyphenation dictionary. */
    locales: Schema.Array(Schema.String).pipe(Schema.minItems(1))
  }),
  /** Break ordering and single-grapheme overflow policy. */
  overflow: Schema.Struct({
    breakPrecedence: NonEmptyOverflowBreakArray,
    maxWidthPolicy: Schema.Literal("allow-overflow-only-when-single-grapheme-exceeds-width")
  }),
  /** Mirrored punctuation data and unsupported-control behavior. */
  bidi: Schema.Struct({
    mirroredPairs: NonEmptyMirrorPairArray,
    unsupportedControlPolicy: Schema.Literal("prepare-time-detect-and-decline")
  }),
  /** Iteration counts and slowdown bound used by package benchmarks. */
  benchmarks: Schema.Struct({
    walkerKernel: Schema.Struct({ iterations: PositiveInt }),
    calibrationScoring: Schema.Struct({
      iterations: PositiveInt,
      maxSlowdownRatio: PositiveNumber
    })
  }),
  /** Compatibility status of each public namespace. */
  stability: Schema.Struct({
    Browser: Schema.Literal("provisional"),
    Contracts: Schema.Literal("stable"),
    Errors: Schema.Literal("stable"),
    Experimental: ExperimentalStabilitySchema,
    React: Schema.Literal("provisional"),
    Text: Schema.Literal("provisional")
  })
})

/**
 * Decoded package support manifest.
 *
 * @since 0.2.0
 * @category models
 */
export type EffectTextSupportManifestType = typeof EffectTextSupportManifestSchema.Type

/**
 * Runtime policies and verification budgets consumed by package harnesses.
 *
 * @since 0.2.0
 * @category manifests
 */
export const EffectTextSupportManifest: EffectTextSupportManifestType = {
  browser: BrowserSupportManifest,
  hyphenation: HyphenationSupportManifest,
  overflow: {
    breakPrecedence: [
      "hard-break",
      "soft-hyphen",
      "dictionary-hyphen",
      "explicit-break",
      "grapheme-fallback"
    ],
    maxWidthPolicy: "allow-overflow-only-when-single-grapheme-exceeds-width"
  },
  bidi: {
    mirroredPairs: bidiMirrorPairs,
    unsupportedControlPolicy: "prepare-time-detect-and-decline"
  },
  benchmarks: {
    walkerKernel: { iterations: 200 },
    calibrationScoring: {
      iterations: 5_000,
      maxSlowdownRatio: 1
    }
  },
  stability: {
    Browser: "provisional",
    Contracts: "stable",
    Errors: "stable",
    Experimental: "unstable",
    React: "provisional",
    Text: "provisional"
  }
}
