import { expect, it } from "@effect/vitest"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { Array as Arr, Effect, Option, Record, Ref, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { Demonstration } from "../../src/Demonstration.js"
import { Example } from "../../src/Example.js"
import * as MiproSampling from "../../src/internal/miprov2/sampling.js"
import * as Sampling from "../../src/internal/sampling/cpython.js"
import * as Candidates from "../../src/MIPROv2Candidates.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as Signature from "../../src/Signature.js"
import { fixture } from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"

const Demo = Schema.Struct({
  question: Schema.String,
  answer: Schema.String,
  augmented: Schema.optionalKey(Schema.Boolean)
})
const Reference = Schema.Struct({
  seed: Schema.Int,
  numInstructions: Schema.Int,
  trainSize: Schema.Int,
  programAware: Schema.Boolean,
  dataAware: Schema.Boolean,
  tipAware: Schema.Boolean,
  fewshotAware: Schema.Boolean,
  demoSets: Schema.OptionFromNullOr(Schema.Record(Schema.String, Schema.Array(Schema.Array(Demo)))),
  instructions: Schema.Record(Schema.String, Schema.Array(Schema.String)),
  nextRandom: Schema.Finite,
  calls: Schema.Array(Schema.Struct({
    field: Schema.String,
    role: Schema.String,
    rolloutId: Schema.OptionFromNullOr(Schema.Int),
    temperature: Schema.Finite,
    response: Schema.String,
    demoIds: Schema.Array(Schema.String),
    dataIds: Schema.Array(Schema.String),
    tip: Schema.OptionFromNullOr(Schema.String)
  }))
})

it.effect("matches upstream grounded proposer calls, settings, demo rotation, proposals and next RNG draw", () =>
  Effect.forEach(
    ["miprov2-grounded-proposer-001", "miprov2-proposer-no-demos-001", "miprov2-proposer-summary-skips-001"],
    (id) =>
      Effect.gen(function*() {
        const reference = yield* Schema.decodeUnknownEffect(Reference)(
          (yield* fixture(id, "upstream-execution")).payload
        )
        const module = yield* Module.predict(
          "qa",
          yield* Signature.make("baseline", { question: Schema.String }, { answer: Schema.String })
        )
        yield* Module.install(module, {
          qa: new ModuleParameters({ instructions: "baseline", demos: [], outputStrategy: "text" })
        })
        const demoCandidates = Option.match(reference.demoSets, {
          onNone: () => [],
          onSome: (sets) => [
            new Candidates.PredictorDemoCandidates({
              predictorName: "qa",
              candidates: Arr.map(Option.getOrThrow(Record.get(sets, "0")), (demos) =>
                new Candidates.DemoCandidate({
                  predictorName: "qa",
                  kind: "bootstrap-shuffled",
                  parameters: new ModuleParameters({
                    instructions: "baseline",
                    demos: Arr.map(demos, (demo) =>
                      new Demonstration({
                        input: { question: demo.question },
                        output: { answer: demo.answer },
                        augmented: demo.augmented ?? false
                      })),
                    outputStrategy: "text"
                  })
                }))
            })
          ]
        })
        const mock = yield* MockLanguageModel.make(
          MockLanguageModel.sequence(Arr.map(reference.calls, (call) => call.response))
        )
        const sampling = yield* Sampling.make(reference.seed)
        const proposals = yield* assertNoMutation(
          module,
          Candidates.proposeInstructionCandidates(
            new Candidates.ProposeInstructionCandidatesOptions({
              module,
              trainset: Arr.makeBy(reference.trainSize, (index) =>
                new Example({
                  input: { question: `train-${index}` },
                  labels: Option.some({ answer: `label-${index}` })
                })),
              demoCandidates,
              numInstructions: reference.numInstructions,
              seed: reference.seed,
              programAwareProposer: reference.programAware,
              dataAwareProposer: reference.dataAware,
              tipAwareProposer: reference.tipAware,
              fewshotAwareProposer: reference.fewshotAware
            })
          )
        ).pipe(
          Effect.provideService(MiproSampling.Current, Option.some(sampling)),
          Effect.provideService(LanguageModel.LanguageModel, mock.service),
          ModelBinder.withBinder(mock.binder)
        )
        const calls = yield* Ref.get(mock.calls)
        expect(calls, id).toHaveLength(Arr.length(reference.calls))
        expect(
          Arr.map(calls, (call) => ({
            field: Option.getOrThrow(Arr.get(Option.getOrThrow(Str.match(/Return only (\w+)\.$/)(call.prompt)), 1)),
            role: call.role,
            rolloutId: call.rolloutId,
            temperature: call.settings.temperature
          })),
          id
        ).toEqual(Arr.map(reference.calls, (call) => ({
          field: call.field,
          role: call.role,
          rolloutId: call.rolloutId,
          temperature: call.temperature
        })))
        yield* Effect.forEach(calls, (call, index) =>
          Effect.sync(() => {
            const expected = Option.getOrThrow(Arr.get(reference.calls, index))
            if (expected.field === "observations") {
              expect(
                Arr.map(
                  Arr.fromIterable(Str.matchAll(/"question":\s*"(train-\d+)"/g)(call.prompt)),
                  (match) => Option.getOrThrow(Arr.get(match, 1))
                )
              ).toEqual(expected.dataIds)
            }
            if (expected.field === "proposed_instruction") {
              expect(
                Arr.map(
                  Arr.fromIterable(Str.matchAll(/"question":"(demo-\w+)"/g)(call.prompt)),
                  (match) => Option.getOrThrow(Arr.get(match, 1))
                )
              )
                .toEqual(expected.demoIds)
              expect(Str.includes("\"question\":\"label\"")(call.prompt)).toBe(false)
              expect(Str.includes("tip:")(call.prompt)).toBe(Option.isSome(expected.tip))
              if (Option.isSome(expected.tip)) expect(call.prompt).toContain(expected.tip.value)
            }
            expect(call.prompt).not.toContain("miprov2-proposal:")
          }))
        expect(Arr.map(Option.getOrThrow(Arr.head(proposals)).candidates, (candidate) => candidate.instruction))
          .toEqual(Option.getOrThrow(Record.get(reference.instructions, "0")))
        expect(yield* sampling.random()).toBe(reference.nextRandom)
      })
  ))
