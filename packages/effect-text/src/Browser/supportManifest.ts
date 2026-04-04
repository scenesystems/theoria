/**
 * Browser support data for the canvas-backed measurement layer.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { EngineProfileSchema, WhiteSpaceMode } from "../Text/schema.js"

const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

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
 * Supported browser profile identifier.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserSupportProfileIdSchema = BrowserSupportProfileId

/**
 * Supported browser profile identifier type.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserSupportProfileIdType = typeof BrowserSupportProfileIdSchema.Type

/**
 * Supported browser configuration.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserSupportProfileSchema = Schema.Struct({
  id: BrowserSupportProfileIdSchema,
  measurement: BrowserMeasurementMode,
  freshness: BrowserFreshnessMode,
  emojiCorrection: BrowserEmojiCorrectionMode,
  defaultFontFamily: Schema.String,
  fontSelection: BrowserFontSelectionMode,
  fontStack: NonEmptyStringArray,
  whiteSpaceModes: NonEmptyWhiteSpaceModeArray,
  defaultWhiteSpaceMode: WhiteSpaceMode,
  engineProfile: EngineProfileSchema,
  tabPolicy: BrowserTabPolicySchema,
  parityCases: NonEmptyParityCaseArray,
  caveats: Schema.Array(Schema.String)
})

/**
 * Supported browser configuration type.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserSupportProfileType = typeof BrowserSupportProfileSchema.Type

/**
 * Browser support data exported by `effect-text/Browser`.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserSupportManifestSchema = Schema.Struct({
  defaultProfileId: BrowserSupportProfileIdSchema,
  profiles: Schema.Array(BrowserSupportProfileSchema).pipe(Schema.minItems(1))
})

/**
 * Browser support data type.
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
  caveats: [
    "Named-font browser coverage is limited to the checked-in Mono control family and its monospace fallback stack.",
    "This control profile is the baseline browser envelope for direct named-font parity checks."
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
  caveats: [
    "The browser chooses the concrete UI font for this profile, so parity claims cover the resolved browser-default `system-ui` stack rather than one named font file.",
    "Layout stays data-driven through the profile engine settings; the pure layout plane never inspects user agents."
  ]
}

/**
 * Browser support data published by the package.
 *
 * @since 0.2.0
 * @category manifests
 */
export const BrowserSupportManifest: BrowserSupportManifestType = {
  defaultProfileId: defaultBrowserSupportProfile.id,
  profiles: [defaultBrowserSupportProfile, systemUiBrowserSupportProfile]
}

/**
 * Resolves one browser support profile from the manifest.
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
 * Default browser profile currently covered by the package support data.
 *
 * @since 0.2.0
 * @category manifests
 */
export const DefaultBrowserSupportProfile = browserSupportProfile()
