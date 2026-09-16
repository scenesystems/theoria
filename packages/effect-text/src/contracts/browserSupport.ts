/**
 * Shipped canvas-measurement profiles and synthetic regression scenarios.
 *
 * @since 0.2.0
 */
import { Match, Schema } from "effect"
import * as Arr from "effect/Array"

import { EngineProfile, WhiteSpaceMode } from "../Text/schema.js"

const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const NonNegativeFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
const BrowserSupportProfileId = Schema.Literal("canvas-monospace", "canvas-system-ui")
const BrowserMeasurementMode = Schema.Literal("canvas-2d")
const BrowserFreshnessMode = Schema.Literal("font-readiness-revision")
const BrowserEmojiCorrectionMode = Schema.Literal("optional")
const BrowserFontSelectionMode = Schema.Literal("named-family", "browser-default-stack")
const BrowserTabPolicyMode = Schema.Literal("space-columns")
/**
 * Concrete browser behavior scenarios covered by first-party contract tests.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserParityCase = Schema.Literal(
  "white-space-normal",
  "white-space-pre-wrap",
  "trailing-whitespace-hard-breaks",
  "tab-advances",
  "soft-hyphen",
  "mixed-inline-punctuation",
  "fit-paint-divergence"
)
type BrowserParityCaseType = typeof BrowserParityCase.Type
const NonEmptyStringArray = Schema.NonEmptyArray(Schema.String)
const NonEmptyWhiteSpaceModeArray = Schema.NonEmptyArray(WhiteSpaceMode)
const NonEmptyParityCaseArray = Schema.NonEmptyArray(BrowserParityCase)

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
export class BrowserSupportProfileSchema extends Schema.Class<BrowserSupportProfileSchema>(
  "effect-text/BrowserSupportProfile"
)({
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
  engineProfile: EngineProfile,
  /** Tab expansion policy used during preparation. */
  tabPolicy: BrowserTabPolicySchema,
  /** Synthetic regression scenarios exercised for this profile. */
  parityCases: NonEmptyParityCaseArray,
  /** Width tolerance metadata in CSS pixels; the synthetic renderer does not apply it. */
  parityTolerancePx: NonNegativeFiniteNumber,
  /** Explicit exclusions from the profile's support statement. */
  caveats: Schema.Array(Schema.String)
}) {}

/**
 * Decoded configuration for one canvas measurement profile.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserSupportProfileType = BrowserSupportProfileSchema

/**
 * Decodes a non-empty profile catalog whose default names one catalog entry.
 *
 * @since 0.2.0
 * @category schemas
 */
export class BrowserSupportManifestSchema extends Schema.Class<BrowserSupportManifestSchema>(
  "effect-text/BrowserSupportManifest"
)({
  /** Profile selected when a caller omits an ID. */
  defaultProfileId: BrowserSupportProfileIdSchema,
  /** Non-empty catalog of shipped profiles. */
  profiles: Schema.NonEmptyArray(BrowserSupportProfileSchema)
}) {}

/**
 * Decoded browser profile catalog.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserSupportManifestType = BrowserSupportManifestSchema

const parityCases: BrowserSupportProfileType["parityCases"] = Arr.make<Arr.NonEmptyArray<BrowserParityCaseType>>(
  "white-space-normal",
  "white-space-pre-wrap",
  "trailing-whitespace-hard-breaks",
  "tab-advances",
  "soft-hyphen",
  "mixed-inline-punctuation",
  "fit-paint-divergence"
)

const tabPolicy: BrowserSupportProfileType["tabPolicy"] = BrowserTabPolicySchema.make({
  columns: 4,
  mode: "space-columns"
})

const defaultBrowserSupportProfile = new BrowserSupportProfileSchema({
  id: "canvas-monospace",
  measurement: "canvas-2d",
  freshness: "font-readiness-revision",
  emojiCorrection: "optional",
  defaultFontFamily: "Mono",
  fontSelection: "named-family",
  fontStack: Arr.make("Mono", "monospace"),
  whiteSpaceModes: Arr.make<Arr.NonEmptyArray<typeof WhiteSpaceMode.Type>>("normal", "pre-wrap"),
  defaultWhiteSpaceMode: "normal",
  engineProfile: EngineProfile.make({
    lineFitEpsilon: 0.005,
    tabWidth: tabPolicy.columns,
    defaultDirection: "ltr",
    preferEarlySoftHyphenBreak: false,
    preferPrefixWidthsForBreakableRuns: true
  }),
  tabPolicy,
  parityCases,
  parityTolerancePx: 0,
  caveats: Arr.make(
    "The synthetic regression context uses the Mono control family and a fixed width table; it does not establish measurements for an installed font.",
    "The released scenarios cover `normal` and `pre-wrap` whitespace behavior. Browser engines, alternate fonts, fallback changes, and shaping behavior require validation in the consuming application."
  )
})

const systemUiBrowserSupportProfile = new BrowserSupportProfileSchema({
  id: "canvas-system-ui",
  measurement: "canvas-2d",
  freshness: "font-readiness-revision",
  emojiCorrection: "optional",
  defaultFontFamily: "system-ui",
  fontSelection: "browser-default-stack",
  fontStack: Arr.make("system-ui", "sans-serif"),
  whiteSpaceModes: Arr.make<Arr.NonEmptyArray<typeof WhiteSpaceMode.Type>>("normal", "pre-wrap"),
  defaultWhiteSpaceMode: "normal",
  engineProfile: EngineProfile.make({
    lineFitEpsilon: 0.01,
    tabWidth: tabPolicy.columns,
    defaultDirection: "ltr",
    preferEarlySoftHyphenBreak: false,
    preferPrefixWidthsForBreakableRuns: true
  }),
  tabPolicy,
  parityCases,
  parityTolerancePx: 0,
  caveats: Arr.make(
    "The browser chooses the concrete UI font for this profile. Widths therefore depend on the user agent, operating system, and installed fonts.",
    "The released scenarios cover `normal` and `pre-wrap` whitespace behavior. User-agent fallback changes and shaping behavior require validation in the consuming application."
  )
})

/**
 * Shipped canvas profiles and their synthetic regression coverage.
 *
 * @since 0.2.0
 * @category manifests
 */
export const BrowserSupportManifest = new BrowserSupportManifestSchema({
  defaultProfileId: defaultBrowserSupportProfile.id,
  profiles: Arr.make(defaultBrowserSupportProfile, systemUiBrowserSupportProfile)
})

const profileForId = Match.type<BrowserSupportProfileIdType>().pipe(
  Match.when("canvas-monospace", () => defaultBrowserSupportProfile),
  Match.when("canvas-system-ui", () => systemUiBrowserSupportProfile),
  Match.exhaustive
)

/**
 * Selects a shipped profile. Omission selects the manifest default; the closed
 * profile identifier is resolved exhaustively without an unknown-value fallback.
 *
 * @since 0.2.0
 * @category manifests
 */
export const browserSupportProfile = (
  profileId: BrowserSupportProfileIdType = BrowserSupportManifest.defaultProfileId
): BrowserSupportProfileType => profileForId(profileId)

/**
 * The shipped `canvas-monospace` profile used when callers omit a profile ID.
 *
 * @since 0.2.0
 * @category manifests
 */
export const DefaultBrowserSupportProfile = browserSupportProfile()
