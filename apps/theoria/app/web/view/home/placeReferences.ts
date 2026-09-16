import { Boolean, Match, Schema, String } from "effect"
import * as Arr from "effect/Array"

import { Id as CardId } from "../../../contracts/id.js"
import { CodeLink } from "../primitives/code/codeLinks.js"

import type { PlaceStep } from "./placeSteps.js"

/**
 * One API symbol a step's code sample uses, and where its reference page is.
 * `text` appears in that step's sample exactly so the rendered symbol links.
 */
export const PlaceReference = Schema.Struct({
  text: Schema.String,
  package: CardId,
  href: Schema.String
})
export type PlaceReference = typeof PlaceReference.Type

const PlaceReferences = Schema.Array(PlaceReference)
type PlaceReferences = typeof PlaceReferences.Type

const ReferenceLinks = Schema.Array(CodeLink)
type ReferenceLinks = typeof ReferenceLinks.Type

const PlaceSourceFiles = Schema.Array(Schema.String)
type PlaceSourceFiles = typeof PlaceSourceFiles.Type

const ref = (pkg: CardId, page: string, text: string, anchor: string): PlaceReference => ({
  text,
  package: pkg,
  href: `/docs/${pkg}/api/${page}#api-${anchor}`
})

const composeReferences: PlaceReferences = [
  ref("effect-dsp", "Signature", "Signature.make", "make"),
  ref("effect-dsp", "Signature", "Signature.describe", "describe"),
  ref("effect-dsp", "Module", "Module.predict", "predict"),
  ref("effect-inference", "Testing", "InferenceTesting.languageModel", "languageModel")
]

const proposeReferences: PlaceReferences = [
  ref("digest", "digestSchemaValue", "digestSchemaValue", "digestSchemaValue"),
  ref("sign", "algorithms/ed25519", "ed25519Sign", "ed25519Sign"),
  ref("sign", "agreement", "deriveSharedSecret", "deriveSharedSecret"),
  ref("digest", "kdf", "hkdfSha256", "hkdfSha256"),
  ref("seal", "seal", "seal", "seal"),
  ref("seal", "utf8", "utf8ToBytes", "utf8ToBytes")
]

const recordReferences: PlaceReferences = [
  ref("digest", "digestSchemaValue", "digestSchemaValue", "digestSchemaValue"),
  ref("sign", "algorithms/ed25519", "ed25519Sign", "ed25519Sign"),
  ref("seal", "utf8", "utf8ToBytes", "utf8ToBytes")
]

const arrangeReferences: PlaceReferences = [
  ref("effect-text", "Text", "Text.prepareWithSegments", "prepareWithSegments"),
  ref("effect-text", "Text", "Text.layoutLinesWith", "layoutLinesWith"),
  ref("effect-search", "SearchSpace", "SearchSpace.make", "make"),
  ref("effect-search", "SearchSpace", "SearchSpace.float", "float"),
  ref("effect-math", "Statistics", "Statistics.minimum", "minimum"),
  ref("effect-math", "Geometry", "Geometry.euclideanDistance", "euclideanDistance"),
  ref("effect-math", "Statistics", "Statistics.standardDeviation", "standardDeviation"),
  ref("effect-search", "Study", "Study.open", "open"),
  ref("effect-search", "Sampler", "Sampler.tpe", "tpe"),
  ref("effect-search", "Study", "Study.ask", "ask"),
  ref("effect-search", "Study", "Study.tell", "tell")
]

export const placeReferences = (step: PlaceStep): PlaceReferences =>
  Match.value(step).pipe(
    Match.when("compose", () => composeReferences),
    Match.when("propose", () => proposeReferences),
    Match.when("record", () => recordReferences),
    Match.when("arrange", () => arrangeReferences),
    Match.exhaustive
  )

export const referenceLinks = (step: PlaceStep): ReferenceLinks =>
  Arr.map(placeReferences(step), ({ href, text }) => ({ text, href }))

/**
 * The files in this repository that do what the sample shows, as paths from
 * the repository root. The server runs the first three steps; the browser
 * runs the fourth with shared contracts.
 */
export const placeSourceFiles = (step: PlaceStep): PlaceSourceFiles =>
  Match.value(step).pipe(
    Match.when("compose", () => ["apps/theoria/app/server/imagined-place/compose.ts"]),
    Match.when("propose", () => [
      "apps/theoria/app/server/imagined-place/authority.ts",
      "apps/theoria/app/server/imagined-place/note.ts"
    ]),
    Match.when("record", () => [
      "apps/theoria/app/server/imagined-place/run.ts",
      "apps/theoria/app/server/imagined-place/authority.ts"
    ]),
    Match.when("arrange", () => [
      "apps/theoria/app/web/atoms/imagined-place-render.ts",
      "apps/theoria/app/contracts/demo/imagined-place-arrangement.ts",
      "apps/theoria/app/contracts/demo/imagined-place-flow.ts"
    ]),
    Match.exhaustive
  )

const repository = "https://github.com/scenesystems/theoria"

/** Source pinned to the commit the server was built from; a local dev server points at HEAD. */
export const sourceRef = (buildSha: string): string =>
  Boolean.match(String.Equivalence(buildSha, "dev-local"), {
    onTrue: () => "HEAD",
    onFalse: () => buildSha
  })

export const sourceUrl = (buildSha: string, path: string): string => `${repository}/blob/${sourceRef(buildSha)}/${path}`

export const commitUrl = (buildSha: string): string => `${repository}/tree/${sourceRef(buildSha)}`

/** The path as a reader of `apps/theoria/app` would say it. */
export const sourceLabel = (path: string): string => String.replace(/^apps\/theoria\/app\//, "")(path)
