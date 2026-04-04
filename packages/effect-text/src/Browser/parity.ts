/**
 * Browser parity artifact schemas and package-owned harness helpers.
 *
 * @since 0.2.0
 */
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import { EngineProfile } from "../contracts/index.js"
import * as Text from "../Text/index.js"
import { initialFontReadinessRevision } from "./fontReadiness.js"
import { BrowserMeasurementCacheLive, CanvasTextMeasurerLive } from "./layers.js"
import {
  type BrowserParityArtifactCaseType,
  type BrowserParityArtifactType,
  type BrowserParityCaseIdType
} from "./paritySchema.js"
export {
  BrowserParityArtifactCaseSchema,
  BrowserParityArtifactJsonSchema,
  BrowserParityArtifactSchema,
  BrowserParityCaseIdSchema
} from "./paritySchema.js"
export type {
  BrowserParityArtifactCaseType,
  BrowserParityArtifactType,
  BrowserParityCaseIdType
} from "./paritySchema.js"
import { type BrowserSupportProfileIdType, type BrowserSupportProfileType } from "./supportManifest.js"
const baseFontSize = 10
type BrowserParityCaseTemplate = Readonly<{
  caseId: BrowserParityCaseIdType
  request: {
    readonly lineHeight: number
    readonly maxWidth: number
  }
  text: string
  whiteSpace: Text.WhiteSpaceModeType
}>
type MeasurementOverride = readonly [text: string, width: number]

/**
 * Resolved parity case inputs for one browser profile.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserParityResolvedCase = Readonly<{
  caseId: BrowserParityCaseIdType
  prepare: Text.PrepareInputType
  request: {
    readonly lineHeight: number
    readonly maxWidth: number
  }
}>
const browserParityCaseTemplates: ReadonlyArray<BrowserParityCaseTemplate> = [
  {
    caseId: "white-space-normal",
    request: { lineHeight: 12, maxWidth: 100 },
    text: "alpha beta gamma",
    whiteSpace: "normal"
  },
  {
    caseId: "white-space-pre-wrap",
    request: { lineHeight: 12, maxWidth: 200 },
    text: "alpha  beta",
    whiteSpace: "pre-wrap"
  },
  {
    caseId: "trailing-whitespace-hard-breaks",
    request: { lineHeight: 12, maxWidth: 200 },
    text: "alpha  \nbeta",
    whiteSpace: "pre-wrap"
  },
  {
    caseId: "tab-advances",
    request: { lineHeight: 12, maxWidth: 100 },
    text: "a\tb",
    whiteSpace: "pre-wrap"
  },
  {
    caseId: "soft-hyphen",
    request: { lineHeight: 12, maxWidth: 60 },
    text: "alpha\u00adbeta",
    whiteSpace: "normal"
  },
  {
    caseId: "mixed-inline-punctuation",
    request: { lineHeight: 12, maxWidth: 200 },
    text: "(שלום) hello",
    whiteSpace: "normal"
  },
  {
    caseId: "fit-paint-divergence",
    request: { lineHeight: 12, maxWidth: 24 },
    text: "ffi",
    whiteSpace: "normal"
  }
]
const browserParityMeasurementOverrides = (
  profileId: BrowserSupportProfileIdType
): ReadonlyArray<MeasurementOverride> =>
  profileId === "canvas-system-ui"
    ? [
      ["f", 10],
      ["i", 10],
      ["ff", 19],
      ["fi", 17],
      ["ffi", 25]
    ]
    : [
      ["f", 10],
      ["i", 10],
      ["ff", 18],
      ["fi", 16],
      ["ffi", 24]
    ]
const defaultMeasurementWidth = (text: string): number => Arr.fromIterable(text).length * baseFontSize
const measurementWidth = (profileId: BrowserSupportProfileIdType, text: string): number =>
  Arr.findFirst(browserParityMeasurementOverrides(profileId), (entry) => entry[0] === text).pipe(
    Option.match({
      onNone: () => defaultMeasurementWidth(text),
      onSome: (entry) => entry[1]
    })
  )
class BrowserParityCanvasContext {
  direction: "ltr" | "rtl" | "inherit" = "inherit"
  font = `${baseFontSize}px Mono`
  textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom" = "alphabetic"

  constructor(readonly profileId: BrowserSupportProfileIdType) {}

  measureText(text: string): { readonly width: number } {
    return { width: measurementWidth(this.profileId, text) }
  }
}
/**
 * Ordered set of released browser parity cases.
 *
 * @since 0.2.0
 * @category parity
 */
export const browserParityCaseIds: ReadonlyArray<BrowserParityCaseIdType> = Arr.map(
  browserParityCaseTemplates,
  (template) => template.caseId
)
/**
 * Resolves the released parity cases for one browser support profile.
 *
 * @since 0.2.0
 * @category parity
 */
export const browserParityCasesForProfile = (
  profile: BrowserSupportProfileType
): ReadonlyArray<BrowserParityResolvedCase> =>
  Arr.map(browserParityCaseTemplates, (template) => ({
    caseId: template.caseId,
    prepare: {
      text: template.text,
      font: { family: profile.defaultFontFamily, size: baseFontSize },
      whiteSpace: template.whiteSpace
    },
    request: template.request
  }))
/**
 * Deterministic browser-style layer used by the parity artifact harness.
 *
 * @since 0.2.0
 * @category parity
 */
export const browserParityLayer = (profile: BrowserSupportProfileType) =>
  Layer.mergeAll(
    Text.WordSegmenterLive,
    Text.HyphenationDictionaryLive(),
    Layer.succeed(EngineProfile, profile.engineProfile),
    BrowserMeasurementCacheLive({
      fontReadinessRevision: initialFontReadinessRevision(),
      profileId: profile.id
    }).pipe(
      Layer.provide(
        CanvasTextMeasurerLive({
          context: new BrowserParityCanvasContext(profile.id)
        })
      )
    )
  )
/**
 * Relative path for one checked-in parity artifact.
 *
 * @since 0.2.0
 * @category parity
 */
export const browserParityArtifactRelativePath = (profileId: BrowserSupportProfileIdType): string =>
  `examples/live/artifacts/${profileId}.json`
/**
 * Renders one machine-readable parity artifact for a support profile.
 *
 * @since 0.2.0
 * @category parity
 */
export const renderBrowserParityArtifact = (
  profile: BrowserSupportProfileType
): Effect.Effect<BrowserParityArtifactType> =>
  Effect.gen(function*() {
    if (!Arr.every(browserParityCaseIds, (caseId) => profile.parityCases.includes(caseId))) {
      return yield* Effect.dieMessage(`Browser parity case mismatch for profile: ${profile.id}`)
    }

    return {
      profileId: profile.id,
      fontFamily: profile.defaultFontFamily,
      fontSelection: profile.fontSelection,
      fontStack: profile.fontStack,
      parityCases: profile.parityCases,
      cases: yield* Effect.forEach(
        browserParityCasesForProfile(profile),
        (entry) =>
          Text.prepareWithSegments(entry.prepare).pipe(
            Effect.provide(browserParityLayer(profile)),
            Effect.map((prepared): BrowserParityArtifactCaseType => ({
              caseId: entry.caseId,
              prepare: entry.prepare,
              request: entry.request,
              summary: Text.layout(prepared, entry.request),
              lines: Text.layoutLines(prepared, entry.request)
            })),
            Effect.orDie
          )
      )
    }
  })
