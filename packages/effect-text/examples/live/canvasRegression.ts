/**
 * Synthetic canvas scenarios and artifact models used by examples and tests.
 *
 * @since 0.5.0
 * @module
 */
import { Effect, Equal, Layer, Match, Number, Option, Schema, String } from "effect"
import * as Arr from "effect/Array"

import {
  CanvasProfile,
  CanvasTextMeasurer,
  Hyphenation,
  MeasurementCache,
  Text,
  type TextMeasurer
} from "@scenesystems/effect-text"

/** Identifier of one synthetic behavior scenario. */
export const ScenarioId = Schema.Literal(
  "white-space-normal",
  "white-space-pre-wrap",
  "trailing-whitespace-hard-breaks",
  "tab-advances",
  "soft-hyphen",
  "mixed-inline-punctuation",
  "fit-paint-divergence"
)

/** One resolved synthetic scenario. */
export class Scenario extends Schema.Class<Scenario>("effect-text/example/CanvasScenario")({
  id: ScenarioId,
  prepare: Text.Input,
  request: Text.Request
}) {}

/** One rendered synthetic scenario. */
export const ArtifactCase = Schema.Struct({
  caseId: ScenarioId,
  prepare: Text.Input,
  request: Text.Request,
  summary: Text.Summary,
  lines: Text.Lines
})

/** A deterministic artifact for one canvas profile. */
export const Artifact = Schema.Struct({
  profileId: CanvasProfile.Id,
  fontFamily: Schema.String,
  fontSelection: Schema.String,
  fontStack: Schema.NonEmptyArray(Schema.String),
  cases: Schema.Array(ArtifactCase)
})

/** JSON codec for a deterministic canvas artifact. */
export const ArtifactJson = Schema.parseJson(Artifact)

class Template extends Schema.Class<Template>("effect-text/example/CanvasScenarioTemplate")({
  id: ScenarioId,
  request: Text.Request,
  text: Schema.String,
  whiteSpace: Text.Whitespace
}) {}

class Override extends Schema.Class<Override>("effect-text/example/CanvasMeasurementOverride")({
  text: Schema.String,
  width: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
}) {}

const baseFontSize = 10
const templates = Arr.make(
  new Template({
    id: "white-space-normal",
    request: Text.Request.make({ lineHeight: 12, maxWidth: 100 }),
    text: "alpha beta gamma",
    whiteSpace: "normal"
  }),
  new Template({
    id: "white-space-pre-wrap",
    request: Text.Request.make({ lineHeight: 12, maxWidth: 200 }),
    text: "alpha  beta",
    whiteSpace: "pre-wrap"
  }),
  new Template({
    id: "trailing-whitespace-hard-breaks",
    request: Text.Request.make({ lineHeight: 12, maxWidth: 200 }),
    text: "alpha  \nbeta",
    whiteSpace: "pre-wrap"
  }),
  new Template({
    id: "tab-advances",
    request: Text.Request.make({ lineHeight: 12, maxWidth: 100 }),
    text: "a\tb",
    whiteSpace: "pre-wrap"
  }),
  new Template({
    id: "soft-hyphen",
    request: Text.Request.make({ lineHeight: 12, maxWidth: 60 }),
    text: "alpha\u00adbeta",
    whiteSpace: "normal"
  }),
  new Template({
    id: "mixed-inline-punctuation",
    request: Text.Request.make({ lineHeight: 12, maxWidth: 200 }),
    text: "(שלום) hello",
    whiteSpace: "normal"
  }),
  new Template({
    id: "fit-paint-divergence",
    request: Text.Request.make({ lineHeight: 12, maxWidth: 24 }),
    text: "ffi",
    whiteSpace: "normal"
  })
)

const overrides = (id: CanvasProfile.Id) =>
  Match.value(id).pipe(
    Match.when("canvas-monospace", () =>
      Arr.make(
        new Override({ text: "f", width: 10 }),
        new Override({ text: "i", width: 10 }),
        new Override({ text: "ff", width: 18 }),
        new Override({ text: "fi", width: 16 }),
        new Override({ text: "ffi", width: 24 })
      )),
    Match.when("canvas-system-ui", () =>
      Arr.make(
        new Override({ text: "f", width: 10 }),
        new Override({ text: "i", width: 10 }),
        new Override({ text: "ff", width: 19 }),
        new Override({ text: "fi", width: 17 }),
        new Override({ text: "ffi", width: 25 })
      )),
    Match.exhaustive
  )

const width = (id: CanvasProfile.Id, text: string): number =>
  Arr.findFirst(overrides(id), (entry) => Equal.equals(entry.text, text)).pipe(
    Option.match({
      onNone: () => Number.multiply(Arr.length(Arr.fromIterable(text)), baseFontSize),
      onSome: (entry) => entry.width
    })
  )

/** Synthetic canvas context with deterministic per-profile widths. */
export class Context {
  direction: CanvasTextMeasurer.Direction = "inherit"
  font = "10px Mono"
  textBaseline: CanvasTextMeasurer.Baseline = "alphabetic"

  constructor(readonly profileId: CanvasProfile.Id) {}

  measureText(text: string): CanvasTextMeasurer.Metrics {
    return { width: width(this.profileId, text) }
  }
}

/** Resolves all synthetic scenarios for a canvas profile. */
export const scenarios = (profile: CanvasProfile.CanvasProfile): Arr.NonEmptyArray<Scenario> =>
  Arr.map(templates, (template) =>
    new Scenario({
      id: template.id,
      prepare: Text.Input.make({
        text: template.text,
        font: Text.Font.make({ family: profile.defaultFontFamily, size: baseFontSize }),
        whiteSpace: template.whiteSpace
      }),
      request: template.request
    }))

/** Layer that composes real text preparation with the synthetic canvas context. */
export const layer = (profile: CanvasProfile.CanvasProfile) =>
  Layer.mergeAll(
    Text.layerSegmenter,
    Layer.succeed(Text.CurrentProfile, profile.engineProfile),
    Hyphenation.layer(),
    MeasurementCache.layer.pipe(
      Layer.provide(CanvasTextMeasurer.layer(new CanvasTextMeasurer.Options({ context: new Context(profile.id) })))
    )
  )

/** Repository-relative path of a checked-in synthetic artifact. */
export const artifactPath = (id: CanvasProfile.Id): string =>
  String.concat("examples/live/artifacts/", String.concat(id, ".json"))

/** Renders every synthetic scenario through canvas measurement and text layout. */
export const render = (
  profile: CanvasProfile.CanvasProfile
): Effect.Effect<typeof Artifact.Type, TextMeasurer.Failed> =>
  Effect.forEach(scenarios(profile), (scenario) =>
    Text.prepareWithSegments(scenario.prepare).pipe(
      Effect.map((prepared) => {
        const result = Text.layout(prepared, scenario.request)
        return ArtifactCase.make({
          caseId: scenario.id,
          prepare: scenario.prepare,
          request: scenario.request,
          summary: result.summary,
          lines: result.lines
        })
      })
    )).pipe(
      Effect.provide(layer(profile)),
      Effect.map((cases) =>
        Artifact.make({
          profileId: profile.id,
          fontFamily: profile.defaultFontFamily,
          fontSelection: profile.fontSelection,
          fontStack: profile.fontStack,
          cases
        })
      )
    )
