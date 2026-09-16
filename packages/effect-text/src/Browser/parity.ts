/**
 * Synthetic canvas scenarios and deterministic regression artifact rendering.
 *
 * @since 0.2.0
 */
import { Boolean, Effect, Equal, Layer, Match, Number, Schema, String } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import { EngineProfile } from "../contracts/index.js"
import type { MeasurementFailed } from "../Errors/index.js"
import * as Text from "../Text/index.js"
import { initialFontReadinessRevision } from "./fontReadiness.js"
import {
  BrowserMeasurementCacheLive,
  type CanvasTextBaselineType,
  type CanvasTextDirectionType,
  CanvasTextMeasurerLive,
  type CanvasTextMetricsType
} from "./layers.js"
import {
  BrowserParityArtifactCaseSchema,
  type BrowserParityArtifactCaseType,
  BrowserParityArtifactSchema,
  type BrowserParityArtifactType,
  BrowserParityCaseIdSchema
} from "./paritySchema.js"
import { type BrowserSupportProfileIdType, type BrowserSupportProfileType } from "./supportManifest.js"

/**
 * Canonical schemas and models for deterministic browser parity artifacts.
 *
 * @since 0.2.0
 */
export {
  BrowserParityArtifactCaseSchema,
  type BrowserParityArtifactCaseType,
  BrowserParityArtifactJsonSchema,
  BrowserParityArtifactSchema,
  type BrowserParityArtifactType,
  BrowserParityCaseIdSchema,
  type BrowserParityCaseIdType
} from "./paritySchema.js"

const baseFontSize = 10
class BrowserParityCaseTemplate extends Schema.Class<BrowserParityCaseTemplate>(
  "effect-text/BrowserParityCaseTemplate"
)({
  caseId: BrowserParityCaseIdSchema,
  request: Text.LayoutRequest,
  text: Schema.String,
  whiteSpace: Text.WhiteSpaceMode
}) {}

class MeasurementOverride extends Schema.Class<MeasurementOverride>("effect-text/MeasurementOverride")({
  text: Schema.String,
  width: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
}) {}

const MeasurementOverrides = Schema.NonEmptyArray(MeasurementOverride)
type MeasurementOverridesType = typeof MeasurementOverrides.Type

/**
 * Resolved synthetic scenario inputs for one browser profile.
 *
 * @since 0.2.0
 * @category models
 */
export class BrowserParityResolvedCase extends Schema.Class<BrowserParityResolvedCase>(
  "effect-text/BrowserParityResolvedCase"
)({
  /** Released scenario identifier. */
  caseId: BrowserParityCaseIdSchema,
  /** Profile-specific input prepared by the harness. */
  prepare: Text.PrepareInput,
  /** Fixed geometry for the scenario. */
  request: Text.LayoutRequest
}) {}
const BrowserParityResolvedCases = Schema.NonEmptyArray(BrowserParityResolvedCase)
type BrowserParityResolvedCasesType = typeof BrowserParityResolvedCases.Type
const browserParityCaseTemplates = Arr.make(
  new BrowserParityCaseTemplate({
    caseId: "white-space-normal",
    request: Text.LayoutRequest.make({ lineHeight: 12, maxWidth: 100 }),
    text: "alpha beta gamma",
    whiteSpace: "normal"
  }),
  new BrowserParityCaseTemplate({
    caseId: "white-space-pre-wrap",
    request: Text.LayoutRequest.make({ lineHeight: 12, maxWidth: 200 }),
    text: "alpha  beta",
    whiteSpace: "pre-wrap"
  }),
  new BrowserParityCaseTemplate({
    caseId: "trailing-whitespace-hard-breaks",
    request: Text.LayoutRequest.make({ lineHeight: 12, maxWidth: 200 }),
    text: "alpha  \nbeta",
    whiteSpace: "pre-wrap"
  }),
  new BrowserParityCaseTemplate({
    caseId: "tab-advances",
    request: Text.LayoutRequest.make({ lineHeight: 12, maxWidth: 100 }),
    text: "a\tb",
    whiteSpace: "pre-wrap"
  }),
  new BrowserParityCaseTemplate({
    caseId: "soft-hyphen",
    request: Text.LayoutRequest.make({ lineHeight: 12, maxWidth: 60 }),
    text: "alpha\u00adbeta",
    whiteSpace: "normal"
  }),
  new BrowserParityCaseTemplate({
    caseId: "mixed-inline-punctuation",
    request: Text.LayoutRequest.make({ lineHeight: 12, maxWidth: 200 }),
    text: "(שלום) hello",
    whiteSpace: "normal"
  }),
  new BrowserParityCaseTemplate({
    caseId: "fit-paint-divergence",
    request: Text.LayoutRequest.make({ lineHeight: 12, maxWidth: 24 }),
    text: "ffi",
    whiteSpace: "normal"
  })
)
const browserParityMeasurementOverrides = (
  profileId: BrowserSupportProfileIdType
): MeasurementOverridesType =>
  Match.value(profileId).pipe(
    Match.when("canvas-monospace", () =>
      Arr.make(
        new MeasurementOverride({ text: "f", width: 10 }),
        new MeasurementOverride({ text: "i", width: 10 }),
        new MeasurementOverride({ text: "ff", width: 18 }),
        new MeasurementOverride({ text: "fi", width: 16 }),
        new MeasurementOverride({ text: "ffi", width: 24 })
      )),
    Match.when("canvas-system-ui", () =>
      Arr.make(
        new MeasurementOverride({ text: "f", width: 10 }),
        new MeasurementOverride({ text: "i", width: 10 }),
        new MeasurementOverride({ text: "ff", width: 19 }),
        new MeasurementOverride({ text: "fi", width: 17 }),
        new MeasurementOverride({ text: "ffi", width: 25 })
      )),
    Match.exhaustive
  )
const defaultMeasurementWidth = (text: string): number =>
  Number.multiply(Arr.length(Arr.fromIterable(text)), baseFontSize)
const measurementWidth = (profileId: BrowserSupportProfileIdType, text: string): number =>
  Arr.findFirst(browserParityMeasurementOverrides(profileId), (entry) => Equal.equals(entry.text, text)).pipe(
    Option.match({
      onNone: () => defaultMeasurementWidth(text),
      onSome: (entry) => entry.width
    })
  )
class BrowserParityCanvasContext {
  direction: CanvasTextDirectionType = "inherit"
  font = "10px Mono"
  textBaseline: CanvasTextBaselineType = "alphabetic"

  constructor(readonly profileId: BrowserSupportProfileIdType) {}

  measureText(text: string): CanvasTextMetricsType {
    return { width: measurementWidth(this.profileId, text) }
  }
}
/**
 * Ordered set of released synthetic canvas scenarios.
 *
 * @since 0.2.0
 * @category parity
 */
export const browserParityCaseIds = Arr.map(
  browserParityCaseTemplates,
  (template) => template.caseId
)
/**
 * Resolves the released synthetic scenarios for one browser support profile.
 *
 * @since 0.2.0
 * @category parity
 */
export const browserParityCasesForProfile = (
  profile: BrowserSupportProfileType
): BrowserParityResolvedCasesType =>
  Arr.map(browserParityCaseTemplates, (template) =>
    new BrowserParityResolvedCase({
      caseId: template.caseId,
      prepare: Text.PrepareInput.make({
        text: template.text,
        font: Text.FontDescriptor.make({ family: profile.defaultFontFamily, size: baseFontSize }),
        whiteSpace: template.whiteSpace
      }),
      request: template.request
    }))

/**
 * Installs the synthetic canvas context used to reproduce checked-in parity
 * artifacts. It does not measure with a browser's live canvas implementation.
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
 * Returns the repository-relative synthetic artifact path for a shipped profile.
 *
 * @since 0.2.0
 * @category parity
 */
export const browserParityArtifactRelativePath = (profileId: BrowserSupportProfileIdType): string =>
  String.concat("examples/live/artifacts/", String.concat(profileId, ".json"))

/**
 * A browser profile does not declare every released synthetic scenario, so no
 * artifact can be rendered for it.
 *
 * @since 0.4.0
 * @category errors
 */
export class BrowserParityCasesMissing extends Schema.TaggedError<BrowserParityCasesMissing>()(
  "BrowserParityCasesMissing",
  {
    /** The profile whose `parityCases` are incomplete. */
    profileId: Schema.String,
    /** Released scenarios the profile does not declare. */
    missing: Schema.Array(BrowserParityCaseIdSchema)
  }
) {}

/**
 * Evaluates every released synthetic scenario and returns a serializable
 * artifact. A profile missing any released case fails with
 * `BrowserParityCasesMissing` before preparation; a scenario whose text cannot
 * be measured fails with that measurement's `MeasurementFailed`.
 *
 * @since 0.2.0
 * @category parity
 */
export const renderBrowserParityArtifact = (
  profile: BrowserSupportProfileType
): Effect.Effect<BrowserParityArtifactType, BrowserParityCasesMissing | MeasurementFailed> =>
  Arr.match(
    Arr.filter(browserParityCaseIds, (caseId) => Boolean.not(Arr.contains(profile.parityCases, caseId))),
    {
      onEmpty: () =>
        Effect.forEach(
          browserParityCasesForProfile(profile),
          (entry) =>
            Text.prepareWithSegments(entry.prepare).pipe(
              Effect.provide(browserParityLayer(profile)),
              Effect.map((prepared): BrowserParityArtifactCaseType =>
                BrowserParityArtifactCaseSchema.make({
                  caseId: entry.caseId,
                  prepare: entry.prepare,
                  request: entry.request,
                  summary: Text.layout(prepared, entry.request),
                  lines: Text.layoutLines(prepared, entry.request)
                })
              )
            )
        ).pipe(
          Effect.map((cases) =>
            BrowserParityArtifactSchema.make({
              profileId: profile.id,
              fontFamily: profile.defaultFontFamily,
              fontSelection: profile.fontSelection,
              fontStack: profile.fontStack,
              parityCases: profile.parityCases,
              cases
            })
          )
        ),
      onNonEmpty: (missing) => Effect.fail(new BrowserParityCasesMissing({ profileId: profile.id, missing }))
    }
  )
