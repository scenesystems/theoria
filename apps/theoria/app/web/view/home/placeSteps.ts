import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { Id as CardId } from "../../../contracts/id.js"

/**
 * The demo's story in four steps. Each step is one thing the visitor can see
 * happen and the packages that make it happen; the steps run in this order on
 * the server (`server/imagined-place/run.ts`) and in the browser
 * (`atoms/imagined-place-render.ts`).
 */
export const PlaceStep = Schema.Literal("compose", "propose", "record", "arrange")
export type PlaceStep = typeof PlaceStep.Type
export const placeSteps: ReadonlyArray<PlaceStep> = ["compose", "propose", "record", "arrange"]

export const PlaceStepDefinition = Schema.Struct({
  id: PlaceStep,
  name: Schema.String,
  packages: Schema.Array(CardId),
  code: Schema.String
})
export type PlaceStepDefinition = typeof PlaceStepDefinition.Type

const define = (
  id: PlaceStep,
  name: string,
  packages: ReadonlyArray<CardId>,
  code: string
): PlaceStepDefinition => ({ id, name, packages, code })

const composeCode = `// A typed program: a brief in, a schema-checked composition out. The output
// fields are the artifact's own fields, so the two cannot drift apart.
const signature = yield* Signature.make(
  "Turn a short brief for an imagined place into a structured composition.",
  { brief: Signature.describe(Schema.String, "The place, in its author's words.") },
  { title: PlaceComposition.fields.title, features: PlaceComposition.fields.features }
)
const composer = yield* Module.predict("theoria-place-composer", signature)

// The model's answer was recorded once; the program still checks it every time.
const composition = yield* composer.forward({ brief }).pipe(
  Effect.provide(InferenceTesting.staticLanguageModel(recorded))
)
const origin = { brief, composition, accepted: [] }`

const proposeCode = `// Every proposal is content-addressed and signed by whoever offered it,
// merged or not. The neighbor's note travels sealed to the author alone.
const proposalId = yield* digestSchemaValue(Proposal, proposal, "blake3-256")
const signature = yield* ed25519Sign(proposer.secretKey, utf8ToBytes(proposalId))

const shared = yield* deriveSharedSecret("x25519", neighbor.secretKey, author.publicKey)
const key = yield* hkdfSha256(shared.sharedSecret, Option.none(), context, 32)
const envelope = yield* seal("xchacha20-poly1305", key, utf8ToBytes(note))`

const recordCode = `// Version 1 is the digest of its content. Version 2 digests version 1's
// ID as its parent, so the chain cannot be reordered. The author signs each.
const originId = yield* digestSchemaValue(PlaceArtifact, origin, "blake3-256")
const merged = { ...origin, parent: originId, accepted }
const mergedId = yield* digestSchemaValue(PlaceArtifact, merged, "blake3-256")

const signed = yield* ed25519Sign(author.secretKey, utf8ToBytes(mergedId))`

const arrangeCode = `// Drawing happens where the place is shown, with that screen's font metrics.
// The description flows around the markers, one line width at a time.
const prepared = yield* Text.prepareWithSegments(descriptionInput(merged))
const lines = Text.layoutLinesWith(prepared, { maxWidth, lineHeight }, widthBesideMarkers)

// Six numbers describe how the markers meander down the stage. An arrangement
// costs more when markers crowd or lines get squeezed; lower is better.
const space = yield* SearchSpace.make({
  edge: SearchSpace.float(0.5, 0.9), swing: SearchSpace.float(0, 0.3), phase: SearchSpace.float(-Math.PI, Math.PI),
  turns: SearchSpace.float(0.5, 2.5), top: SearchSpace.float(0.04, 0.6), step: SearchSpace.float(0.03, 0.24)
})
const separation = Statistics.minimum(Chunk.map(pairs, ([a, b]) => Geometry.euclideanDistance(a, b)))
const raggedness = Statistics.standardDeviation(Chunk.map(lines, (line) => line.width / maxWidth))

// The same seeded search runs here and on the server; each trial is one frame.
const handle = yield* Study.open({ space, sampler: Sampler.tpe({ seed: 42 }), objective, trials: 36 })
const asked = yield* Study.ask(handle)
yield* Study.tell(handle, asked.trialNumber, arrange(asked.config).quality.loss)`

export const placeStepDefinition = (step: PlaceStep): PlaceStepDefinition =>
  Match.value(step).pipe(
    Match.when("compose", () => define(step, "Compose", ["effect-dsp", "effect-inference"], composeCode)),
    Match.when("propose", () => define(step, "Propose", ["sign", "seal"], proposeCode)),
    Match.when("record", () => define(step, "Record", ["digest", "sign"], recordCode)),
    Match.when(
      "arrange",
      () => define(step, "Arrange", ["effect-text", "effect-math", "effect-search"], arrangeCode)
    ),
    Match.exhaustive
  )

export const placeStepDefinitions: ReadonlyArray<PlaceStepDefinition> = Arr.map(placeSteps, placeStepDefinition)

export const placeStepIndex = (step: PlaceStep): number =>
  Option.getOrElse(Arr.findFirstIndex(placeSteps, (candidate) => candidate === step), () => 0)

export const placeStepAt = (index: number): PlaceStep =>
  Option.getOrElse(Arr.get(placeSteps, index), (): PlaceStep => "compose")
