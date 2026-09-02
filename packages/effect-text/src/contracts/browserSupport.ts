/**
 * Shipped canvas-measurement profiles and synthetic regression scenarios.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { EngineProfileSchema, WhiteSpaceMode } from "../Text/schema.js"

const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const NonNegativeFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
const BrowserSupportProfileId = Schema.Literal("canvas-monospace", "canvas-system-ui")
const BrowserMeasurementMode = Schema.Literal("canvas-2d")
const BrowserFreshnessMode = Schema.Literal("font-readiness-revision")
const BrowserEmojiCorrectionMode = Schema.Literal("optional")
const BrowserFontSelectionMode = Schema.Literal("named-family", "browser-default-stack")
const BrowserTabPolicyMode = Schema.Literal("space-columns")
const BrowserParityCase = Schema.Literal(
  "white-space-normal",
  "white-space-pre-wrap",
  "trailing-whitespace-hard-breaks",
  "tab-advances",
  "soft-hyphen",
  "mixed-inline-punctuation",
  "fit-paint-divergence"
)
const NonEmptyStringArray = Schema.Array(Schema.String).pipe(Schema.minItems(1))
const NonEmptyWhiteSpaceModeArray = Schema.Array(WhiteSpaceMode).pipe(Schema.minItems(1))
const NonEmptyParityCaseArray = Schema.Array(BrowserParityCase).pipe(Schema.minItems(1))

const BrowserTabPolicySchema = Schema.Struct({
  columns: PositiveInt,
  mode: BrowserTabPolicyMode
})

/**
 * Decodes the two shipped canvas measurement profile identifiers.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserSupportProfileIdSchema = BrowserSupportProfileId

/**
 * Identifier accepted by browser measurement caches and parity helpers.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserSupportProfileIdType = typeof BrowserSupportProfileIdSchema.Type

/**
 * Decodes a canvas profile's font policy, preparation profile, synthetic
 * scenarios, comparison tolerance metadata, and documented limitations.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserSupportProfileSchema = Schema.Struct({
  /** Stable profile identifier used in cache keys and artifacts. */
  id: BrowserSupportProfileIdSchema,
  /** Browser measurement API used by the profile. */
  measurement: BrowserMeasurementMode,
  /** Cache invalidation mechanism for font availability changes. */
  freshness: BrowserFreshnessMode,
  /** Availability of the optional emoji width correction. */
  emojiCorrection: BrowserEmojiCorrectionMode,
  /** Font family used when synthetic scenarios omit an explicit family. */
  defaultFontFamily: Schema.String,
  /** Whether the profile names a family or delegates to the browser stack. */
  fontSelection: BrowserFontSelectionMode,
  /** Ordered browser font fallback list. */
  fontStack: NonEmptyStringArray,
  /** Whitespace policies covered by the profile. */
  whiteSpaceModes: NonEmptyWhiteSpaceModeArray,
  /** Whitespace policy used when a consumer does not choose one. */
  defaultWhiteSpaceMode: WhiteSpaceMode,
  /** Preparation settings paired with the measurement profile. */
  engineProfile: EngineProfileSchema,
  /** Tab expansion policy used during preparation. */
  tabPolicy: BrowserTabPolicySchema,
  /** Synthetic regression scenarios exercised for this profile. */
  parityCases: NonEmptyParityCaseArray,
  /** Width tolerance metadata in CSS pixels; the synthetic renderer does not apply it. */
  parityTolerancePx: NonNegativeFiniteNumber,
  /** Explicit exclusions from the profile's support statement. */
  caveats: Schema.Array(Schema.String)
})

/**
 * Decoded configuration for one canvas measurement profile.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserSupportProfileType = typeof BrowserSupportProfileSchema.Type

/**
 * Decodes a non-empty profile catalog whose default names one catalog entry.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserSupportManifestSchema = Schema.Struct({
  /** Profile selected when a caller omits an ID. */
  defaultProfileId: BrowserSupportProfileIdSchema,
  /** Non-empty catalog of shipped profiles. */
  profiles: Schema.Array(BrowserSupportProfileSchema).pipe(Schema.minItems(1))
})

/**
 * Decoded browser profile catalog.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserSupportManifestType = typeof BrowserSupportManifestSchema.Type

const parityCases: BrowserSupportProfileType["parityCases"] = [
  "white-space-normal",
  "white-space-pre-wrap",
  "trailing-whitespace-hard-breaks",
  "tab-advances",
  "soft-hyphen",
  "mixed-inline-punctuation",
  "fit-paint-divergence"
]

const tabPolicy: BrowserSupportProfileType["tabPolicy"] = {
  columns: 4,
  mode: "space-columns"
}

const defaultBrowserSupportProfile: BrowserSupportProfileType = {
  id: "canvas-monospace",
  measurement: "canvas-2d",
  freshness: "font-readiness-revision",
  emojiCorrection: "optional",
  defaultFontFamily: "Mono",
  fontSelection: "named-family",
  fontStack: ["Mono", "monospace"],
  whiteSpaceModes: ["normal", "pre-wrap"],
  defaultWhiteSpaceMode: "normal",
  engineProfile: {
    lineFitEpsilon: 0.005,
    tabWidth: tabPolicy.columns,
    defaultDirection: "ltr",
    preferEarlySoftHyphenBreak: false,
    preferPrefixWidthsForBreakableRuns: true
  },
  tabPolicy,
  parityCases,
  parityTolerancePx: 0,
  caveats: [
    "The synthetic regression context uses the Mono control family and a fixed width table; it does not establish measurements for an installed font.",
    "The released scenarios cover `normal` and `pre-wrap` whitespace behavior. Browser engines, alternate fonts, fallback changes, and shaping behavior require validation in the consuming application."
  ]
}

const systemUiBrowserSupportProfile: BrowserSupportProfileType = {
  id: "canvas-system-ui",
  measurement: "canvas-2d",
  freshness: "font-readiness-revision",
  emojiCorrection: "optional",
  defaultFontFamily: "system-ui",
  fontSelection: "browser-default-stack",
  fontStack: ["system-ui", "sans-serif"],
  whiteSpaceModes: ["normal", "pre-wrap"],
  defaultWhiteSpaceMode: "normal",
  engineProfile: {
    lineFitEpsilon: 0.01,
    tabWidth: tabPolicy.columns,
    defaultDirection: "ltr",
    preferEarlySoftHyphenBreak: false,
    preferPrefixWidthsForBreakableRuns: true
  },
  tabPolicy,
  parityCases,
  parityTolerancePx: 0,
  caveats: [
    "The browser chooses the concrete UI font for this profile. Widths therefore depend on the user agent, operating system, and installed fonts.",
    "The released scenarios cover `normal` and `pre-wrap` whitespace behavior. User-agent fallback changes and shaping behavior require validation in the consuming application."
  ]
}

/**
 * Shipped canvas profiles and their synthetic regression coverage.
 *
 * @since 0.2.0
 * @category manifests
 */
export const BrowserSupportManifest: BrowserSupportManifestType = {
  defaultProfileId: defaultBrowserSupportProfile.id,
  profiles: [defaultBrowserSupportProfile, systemUiBrowserSupportProfile]
}

/**
 * Selects a shipped profile. Omission and unknown runtime values both return
 * `canvas-monospace`.
 *
 * @since 0.2.0
 * @category manifests
 */
export const browserSupportProfile = (
  profileId: BrowserSupportProfileIdType = BrowserSupportManifest.defaultProfileId
): BrowserSupportProfileType =>
  Arr.findFirst(BrowserSupportManifest.profiles, (profile) => profile.id === profileId).pipe(
    Option.getOrElse(() => defaultBrowserSupportProfile)
  )

/**
 * The shipped `canvas-monospace` profile used when callers omit a profile ID.
 *
 * @since 0.2.0
 * @category manifests
 */
export const DefaultBrowserSupportProfile = browserSupportProfile()
