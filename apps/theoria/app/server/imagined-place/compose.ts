import { Effect, Schema } from "effect"
import * as Arr from "effect/Array"

import { Module, Signature } from "@scenesystems/effect-dsp"
import * as InferenceRuntime from "@scenesystems/effect-inference/Runtime"
import * as InferenceTesting from "@scenesystems/effect-inference/Testing"

import type { InferenceEvidence } from "../../contracts/imagined-place-result.js"
import { PlaceBuildError, PlaceComposition, ProposedFeature } from "../../contracts/imagined-place.js"

import type { PlaceScenarioDefinition } from "./scenarios.js"

export const composerProgram = "theoria-place-composer"
export const proposerProgram = "theoria-place-proposer"

/**
 * The composer: one brief in, one schema-checked composition out. Its output
 * fields are the `PlaceComposition` fields, so the artifact contract and the
 * program contract cannot drift apart.
 */
export const composerSignature = Signature.make(
  "Turn a short brief for an imagined place into a structured composition. Name the place, summarize it in one sentence, describe its atmosphere in one sentence, and list three to six named features. Give each feature a footprint weight between 0 and 1.",
  {
    brief: Signature.describe(Schema.String, "The place as its author described it, in their own words.")
  },
  {
    title: Signature.describe(PlaceComposition.fields.title, "Evocative name for the place."),
    summary: Signature.describe(PlaceComposition.fields.summary, "One sentence that says what the place is for."),
    atmosphere: Signature.describe(PlaceComposition.fields.atmosphere, "One sentence of sensory atmosphere."),
    features: Signature.describe(
      PlaceComposition.fields.features,
      "Three to six named features with a short description and a footprint weight."
    )
  }
)

/**
 * The proposer: shown a composition, it offers one more feature and says why.
 * This is the same kind of program as the composer, reused as a participant
 * whose proposals the author may accept or leave aside.
 */
export const proposerSignature = Signature.make(
  "You are shown an imagined place: its brief, title, summary, and existing features. Propose exactly one additional feature the place is missing, with a short description, a footprint weight between 0 and 1, and a one-sentence rationale grounded in what the place already says about itself.",
  {
    brief: Signature.describe(Schema.String, "The author's brief."),
    title: Signature.describe(Schema.String, "The composed title."),
    summary: Signature.describe(Schema.String, "The composed summary."),
    features: Signature.describe(Schema.String, "Existing feature names, comma separated.")
  },
  {
    name: Signature.describe(ProposedFeature.fields.name, "Name of the proposed feature."),
    description: Signature.describe(ProposedFeature.fields.description, "What the feature is."),
    weight: Signature.describe(ProposedFeature.fields.weight, "Footprint weight between 0 and 1."),
    rationale: Signature.describe(ProposedFeature.fields.rationale, "Why the place needs it.")
  }
)

const recordedEvidence = (program: string, scenario: PlaceScenarioDefinition) =>
  Effect.gen(function*() {
    const desired = InferenceTesting.makeDesiredRuntimeDescriptor({ modelRef: `theoria/${program}` })
    const resolvedRoute = InferenceTesting.makeResolvedRouteDescriptor({ desired, selectionReason: "recorded-fixture" })
    const resolver = yield* InferenceRuntime.RuntimeResolver.pipe(
      Effect.provide(
        InferenceTesting.staticRuntimeResolver(InferenceTesting.makeRuntimeResolution({ desired, resolvedRoute }))
      )
    )
    const resolution = yield* resolver.resolve(desired)
    const runtime = InferenceRuntime.makeRuntimeEvidence({
      resolution,
      resolvedRuntime: InferenceTesting.makeResolvedRuntimeDescriptor({
        responseModel: `recorded/${scenario.id}`,
        finishReason: "stop"
      })
    })
    const evidence: InferenceEvidence = {
      program,
      mode: "recorded",
      responseModel: runtime.resolvedRuntime.responseModel,
      serveMode: runtime.resolvedRoute.route.serveMode,
      selectionReason: runtime.resolvedRoute.selectionReason
    }
    return evidence
  })

const encodeComposition = Schema.encode(Schema.parseJson(PlaceComposition))
const encodeProposal = Schema.encode(Schema.parseJson(ProposedFeature))

export type Composed = {
  readonly composition: PlaceComposition
  readonly inference: InferenceEvidence
}

/**
 * Runs the brief through the composer against the recorded model response.
 * The response is parsed and decoded against the output schema exactly as a
 * live response would be; only the transport is replaced.
 */
export const compose = (
  scenario: PlaceScenarioDefinition,
  brief: string
): Effect.Effect<Composed, PlaceBuildError> =>
  Effect.gen(function*() {
    const signature = yield* composerSignature
    const program = yield* Module.predict(composerProgram, signature)
    const recorded = yield* encodeComposition(scenario.recorded)
    const composition = yield* program.forward({ brief }).pipe(
      Effect.provide(InferenceTesting.staticLanguageModel(recorded))
    )
    const inference = yield* recordedEvidence(composerProgram, scenario)
    return { composition, inference }
  }).pipe(
    Module.withDiscoveryScope,
    Effect.mapError((cause) => new PlaceBuildError({ stage: "compose", message: String(cause) }))
  )

export type Proposed = {
  readonly feature: ProposedFeature
  readonly inference: InferenceEvidence
}

/**
 * Shows the composed place to the proposer program and collects its one
 * proposal, again against the recorded response.
 */
export const propose = (
  scenario: PlaceScenarioDefinition,
  brief: string,
  composition: PlaceComposition
): Effect.Effect<Proposed, PlaceBuildError> =>
  Effect.gen(function*() {
    const signature = yield* proposerSignature
    const program = yield* Module.predict(proposerProgram, signature)
    const recorded = yield* encodeProposal(scenario.programProposal)
    const feature = yield* program.forward({
      brief,
      title: composition.title,
      summary: composition.summary,
      features: Arr.join(Arr.map(composition.features, (feature) => feature.name), ", ")
    }).pipe(Effect.provide(InferenceTesting.staticLanguageModel(recorded)))
    const inference = yield* recordedEvidence(proposerProgram, scenario)
    return { feature, inference }
  }).pipe(
    Module.withDiscoveryScope,
    Effect.mapError((cause) => new PlaceBuildError({ stage: "propose", message: String(cause) }))
  )
