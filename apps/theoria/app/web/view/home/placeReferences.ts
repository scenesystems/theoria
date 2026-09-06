import { Match, Schema } from "effect"
import * as Arr from "effect/Array"

import { Id as CardId } from "../../../contracts/id.js"
import type { CodeLink } from "../primitives/code/codeLinks.js"

import type { PlaceStep } from "./placeSteps.js"

/**
 * One API symbol a step's code sample uses, and where its reference page is.
 * `text` must appear in that step's sample exactly; a unit test checks it.
 */
export const PlaceReference = Schema.Struct({
  text: Schema.String,
  package: CardId,
  href: Schema.String
})
export type PlaceReference = typeof PlaceReference.Type

const ref = (pkg: CardId, page: string, text: string, anchor: string): PlaceReference => ({
  text,
  package: pkg,
  href: `/docs/${pkg}/api/${page}#api-${anchor}`
})

const composeReferences: ReadonlyArray<PlaceReference> = [
  ref("effect-dsp", "Signature", "Signature.make", "make"),
  ref("effect-dsp", "Signature", "Signature.describe", "describe"),
  ref("effect-dsp", "Module", "Module.predict", "predict"),
  ref("effect-inference", "Testing", "InferenceTesting.staticLanguageModel", "staticLanguageModel")
]

const proposeReferences: ReadonlyArray<PlaceReference> = [
  ref("digest", "digestSchemaValue", "digestSchemaValue", "digestSchemaValue"),
  ref("sign", "algorithms/ed25519", "ed25519Sign", "ed25519Sign"),
  ref("sign", "agreement", "deriveSharedSecret", "deriveSharedSecret"),
  ref("digest", "kdf", "hkdfSha256", "hkdfSha256"),
  ref("seal", "seal", "seal", "seal"),
  ref("seal", "utf8", "utf8ToBytes", "utf8ToBytes")
]

const recordReferences: ReadonlyArray<PlaceReference> = [
  ref("digest", "digestSchemaValue", "digestSchemaValue", "digestSchemaValue"),
  ref("sign", "algorithms/ed25519", "ed25519Sign", "ed25519Sign"),
  ref("seal", "utf8", "utf8ToBytes", "utf8ToBytes")
]

const arrangeReferences: ReadonlyArray<PlaceReference> = [
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

export const placeReferences = (step: PlaceStep): ReadonlyArray<PlaceReference> =>
  Match.value(step).pipe(
    Match.when("compose", () => composeReferences),
    Match.when("propose", () => proposeReferences),
    Match.when("record", () => recordReferences),
    Match.when("arrange", () => arrangeReferences),
    Match.exhaustive
  )

export const referenceLinks = (step: PlaceStep): ReadonlyArray<CodeLink> =>
  Arr.map(placeReferences(step), ({ href, text }) => ({ text, href }))

/**
 * The files in this repository that do what the sample shows, as paths from
 * the repository root. The server runs the first three steps; the browser
 * runs the fourth with shared contracts.
 */
export const placeSourceFiles = (step: PlaceStep): ReadonlyArray<string> =>
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
export const sourceRef = (buildSha: string): string => buildSha === "dev-local" ? "HEAD" : buildSha

export const sourceUrl = (buildSha: string, path: string): string => `${repository}/blob/${sourceRef(buildSha)}/${path}`

export const commitUrl = (buildSha: string): string => `${repository}/tree/${sourceRef(buildSha)}`

/** The path as a reader of `apps/theoria/app` would say it. */
export const sourceLabel = (path: string): string => path.replace(/^apps\/theoria\/app\//, "")
