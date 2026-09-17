import { Boolean as Bool, Equal, Match, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { Id as CardId } from "../../../contracts/id.js"
import { CodeLink } from "../primitives/code/codeLinks.js"

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

const ref = (pkg: CardId, page: string, text: string, anchor: string): PlaceReference =>
  PlaceReference.make({
    text,
    package: pkg,
    href: `/docs/${pkg}/api/${page}#api-${anchor}`
  })

const composeReferences = Arr.make(
  ref("effect-dsp", "Signature", "Signature.make", "make"),
  ref("effect-dsp", "Signature", "Signature.describe", "describe"),
  ref("effect-dsp", "Module", "Module.predict", "predict"),
  ref("effect-inference", "Testing", "InferenceTesting.staticLanguageModel", "staticLanguageModel")
)

const proposeReferences = Arr.make(
  ref("digest", "ContentDigest", "ContentDigest.fromSchema", "fromSchema"),
  ref("sign", "Ed25519", "Ed25519.sign", "sign"),
  ref("sign", "X25519", "X25519.deriveSharedSecret", "deriveSharedSecret"),
  ref("digest", "Hkdf", "Hkdf.sha256", "sha256"),
  ref("seal", "Envelope", "Envelope.encrypt", "encrypt"),
  ref("sign", "Bytes", "Bytes.fromString", "fromString")
)

const recordReferences = Arr.make(
  ref("digest", "ContentDigest", "ContentDigest.fromSchema", "fromSchema"),
  ref("sign", "Ed25519", "Ed25519.sign", "sign"),
  ref("sign", "Bytes", "Bytes.fromString", "fromString")
)

const arrangeReferences = Arr.make(
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
)

export const placeReferences = (step: PlaceStep) =>
  Match.value(step).pipe(
    Match.when("compose", () => composeReferences),
    Match.when("propose", () => proposeReferences),
    Match.when("record", () => recordReferences),
    Match.when("arrange", () => arrangeReferences),
    Match.exhaustive
  )

export const referenceLinks = (step: PlaceStep) =>
  Arr.map(placeReferences(step), ({ href, text }) => CodeLink.make({ text, href }))

/**
 * The files in this repository that do what the sample shows, as paths from
 * the repository root. The server runs the first three steps; the browser
 * runs the fourth with shared contracts.
 */
export const placeSourceFiles = (step: PlaceStep) =>
  Match.value(step).pipe(
    Match.when("compose", () => Arr.make("apps/theoria/app/server/imagined-place/compose.ts")),
    Match.when("propose", () =>
      Arr.make(
        "apps/theoria/app/server/imagined-place/authority.ts",
        "apps/theoria/app/server/imagined-place/note.ts"
      )),
    Match.when("record", () =>
      Arr.make(
        "apps/theoria/app/server/imagined-place/run.ts",
        "apps/theoria/app/server/imagined-place/authority.ts"
      )),
    Match.when("arrange", () =>
      Arr.make(
        "apps/theoria/app/web/atoms/imagined-place-render.ts",
        "apps/theoria/app/contracts/demo/imagined-place-arrangement.ts",
        "apps/theoria/app/contracts/demo/imagined-place-flow.ts"
      )),
    Match.exhaustive
  )

const repository = "https://github.com/scenesystems/theoria"

/** A local dev server is built from no commit; its source is read at HEAD. */
export const isLocalBuild = (buildSha: string): boolean => Equal.equals(buildSha, "dev-local")

/** Source pinned to the commit the server was built from; a local dev server points at HEAD. */
export const sourceRef = (buildSha: string): string =>
  Bool.match(isLocalBuild(buildSha), { onTrue: () => "HEAD", onFalse: () => buildSha })

export const sourceUrl = (buildSha: string, path: string): string => `${repository}/blob/${sourceRef(buildSha)}/${path}`

export const commitUrl = (buildSha: string): string => `${repository}/tree/${sourceRef(buildSha)}`

/** The path as a reader of `apps/theoria/app` would say it. */
export const sourceLabel = (path: string): string => Str.replace(/^apps\/theoria\/app\//, "")(path)
