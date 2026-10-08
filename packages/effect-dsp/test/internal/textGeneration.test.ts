/**
 * GEPA instruction extraction against pinned InstructionProposalSignature.output_extractor.
 */
import { expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Match, Option, Ref, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { Example } from "../../src/Example.js"
import * as GEPA from "../../src/GEPA.js"
import { extractInstruction } from "../../src/internal/module/textGeneration.js"
import * as Metric from "../../src/Metric.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as Signature from "../../src/Signature.js"
import { fixture } from "../kit/Fixtures.js"

const Cases = Schema.Struct({
  cases: Schema.NonEmptyArray(
    Schema.Struct({ name: Schema.String, response: Schema.String, instruction: Schema.String })
  )
})

it.effect("gepa-instruction-extractor: first-to-last fences, language tags, incomplete and empty replies", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Cases)(
      (yield* fixture("gepa-instruction-extractor", "upstream-kernel")).payload
    )
    expect(Arr.map(reference.cases, ({ name, response }) => ({ name, instruction: extractInstruction(response) })))
      .toEqual(Arr.map(reference.cases, ({ name, instruction }) => ({ name, instruction })))
  }))

const criticPrompt = "I provided an assistant with the following instructions"

const proposedInstruction = (reply: string) =>
  Effect.gen(function*() {
    const module = yield* Module.predict(
      "qa",
      yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
    )
    yield* Module.install(module, {
      qa: new ModuleParameters({ instructions: "original", demos: [], outputStrategy: "text" })
    })
    const mock = yield* MockLanguageModel.make(MockLanguageModel.fromFunction((prompt) =>
      Effect.succeed(Bool.match(Str.includes(criticPrompt)(prompt), {
        onTrue: () => reply,
        onFalse: () => "[[ ## answer ## ]]\nwrong"
      }))
    ))
    const proposed = yield* Ref.make(Arr.empty<string>())
    yield* GEPA.runWithEvents(
      new GEPA.Options({
        module,
        trainset: Arr.map(Arr.range(0, 2), (index) =>
          new Example({ input: { question: `q-${index}` }, labels: Option.some({ answer: "right" }) })),
        maxMetricCalls: 4,
        useMerge: false,
        metric: Metric.exactMatch("answer")
      }),
      (event) =>
        Match.value(event).pipe(
          Match.tag("MutationProposed", ({ instruction }) =>
            Ref.update(proposed, Arr.append(instruction))),
          Match.orElse(() =>
            Effect.void
          )
        )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    return yield* Ref.get(proposed)
  })

it.effect("GEPA proposes the upstream extraction of a multi-fence critic reply and an empty reply verbatim", () =>
  Effect.gen(function*() {
    expect(yield* proposedInstruction("pre ```\nfirst\n``` middle ```md\nsecond\n``` post"))
      .toEqual(["first\n``` middle ```md\nsecond"])
    expect(yield* proposedInstruction("")).toEqual([""])
  }))
