/**
 * Checked-in release support manifest for the shipped `effect-text` envelope.
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
 * Checked-in support envelope used by docs, harnesses, and proof scripts.
 *
 * @since 0.2.0
 * @category schemas
 */
export const EffectTextSupportManifestSchema = Schema.Struct({
  browser: BrowserSupportManifestSchema,
  hyphenation: Schema.Struct({
    localeFallback: Schema.Literal("exact-or-base-language"),
    locales: Schema.Array(Schema.String).pipe(Schema.minItems(1))
  }),
  overflow: Schema.Struct({
    breakPrecedence: NonEmptyOverflowBreakArray,
    maxWidthPolicy: Schema.Literal("allow-overflow-only-when-single-grapheme-exceeds-width")
  }),
  bidi: Schema.Struct({
    mirroredPairs: NonEmptyMirrorPairArray,
    unsupportedControlPolicy: Schema.Literal("prepare-time-detect-and-decline")
  }),
  benchmarks: Schema.Struct({
    walkerKernel: Schema.Struct({ iterations: PositiveInt }),
    calibrationScoring: Schema.Struct({
      iterations: PositiveInt,
      maxSlowdownRatio: PositiveNumber
    })
  }),
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
 * Checked-in support envelope type.
 *
 * @since 0.2.0
 * @category models
 */
export type EffectTextSupportManifestType = typeof EffectTextSupportManifestSchema.Type

/**
 * Checked-in support envelope for the shipped `v0.2` surface.
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
