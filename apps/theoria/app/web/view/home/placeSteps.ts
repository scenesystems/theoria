import { Match, Option } from "effect"
import * as Arr from "effect/Array"

import type { Id as CardId } from "../../../contracts/id.js"

/**
 * The demo's story in four steps. Each step is one thing the visitor can see
 * happen and the packages that make it happen; the steps run in this order on
 * the server (`server/imagined-place/run.ts`) and in the browser
 * (`atoms/imagined-place-render.ts`).
 */
export type PlaceStep = "compose" | "propose" | "record" | "arrange"
export const placeSteps: ReadonlyArray<PlaceStep> = ["compose", "propose", "record", "arrange"]

export type PlaceStepDefinition = {
  readonly id: PlaceStep
  readonly name: string
  readonly packages: ReadonlyArray<CardId>
  readonly code: string
}

const define = (
  id: PlaceStep,
  name: string,
  packages: ReadonlyArray<CardId>,
  code: string
): PlaceStepDefinition => ({ id, name, packages, code })

const composeCode = `// A typed program turns the brief into a composition. The runtime is
// recorded: the same answer every time, still checked against the schema.
const composer = yield* Module.predict("theoria-place-composer", composerSignature)
const composition = yield* composer.forward({ brief })

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
// Six numbers describe an arrangement; a search finds the one that reads best.
const prepared = yield* Text.prepareWithSegments(descriptionInput(merged))
const handle = yield* Study.open({
  space: meanderSpace,
  sampler: Sampler.tpe({ seed: 42 }),
  objective: (meander) => Effect.succeed(arrange(prepared, stage)(meander).quality.loss),
  trials: 36
})
const asked = yield* Study.ask(handle)        // one trial per frame
yield* Study.tell(handle, asked.trialNumber, loss)`

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
