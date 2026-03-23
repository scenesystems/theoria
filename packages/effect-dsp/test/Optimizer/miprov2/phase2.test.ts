/**
 * MIPROv2 Phase 2 instruction-proposal contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Ref, Schema } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Example } from "effect-dsp/Example"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import { generateDemoCandidates } from "../../../src/optimizers/MIPROv2/bootstrap.js"
import { proposeInstructionCandidates } from "../../../src/optimizers/MIPROv2/propose.js"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

const trainingSet = Arr.make(
  new Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  }),
  new Example({
    input: { question: "What is the capital of Italy?" },
    output: { answer: "Rome" }
  })
)

const markerFromPrompt = (prompt: string): string =>
  Option.getOrElse(
    Option.fromNullable(prompt.match(/\[miprov2-proposal:[^\]]+\]/)?.[0]),
    () => ""
  )

const canonicalTipVocabulary = Arr.make("none", "creative", "simple", "description", "high_stakes", "persona")

describe("MIPROv2 Phase 2", () => {
  it.effect("keeps baseline instruction at index 0 and enforces canonical tip vocabulary", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: "Original baseline instruction",
          demos: [],
          outputStrategy: "text"
        })
      )

      const demoCandidates = yield* generateDemoCandidates({
        module,
        trainset: trainingSet,
        numCandidates: 4,
        seed: 17
      })
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) => `${markerFromPrompt(prompt)} generated instruction`)
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const proposals = yield* proposeInstructionCandidates({
        module,
        trainset: trainingSet,
        demoCandidates,
        numInstructions: 5,
        seed: 29
      }).pipe(Effect.provide(layer))
      const calls = yield* Ref.get(mock.calls)

      const rootOption = Arr.head(proposals)

      expect(Option.isSome(rootOption)).toBe(true)

      if (Option.isNone(rootOption)) {
        return
      }

      const root = rootOption.value

      expect(root.candidates[0]?.isBaseline).toBe(true)
      expect(root.candidates[0]?.instruction).toBe("Original baseline instruction")
      expect(
        Arr.every(
          Arr.drop(root.candidates, 1),
          (candidate) => Option.isSome(Arr.findFirst(canonicalTipVocabulary, (tip) => tip === candidate.tip))
        )
      ).toBe(true)
      expect(Arr.every(calls, (call) => call.prompt.includes("Diversity Temperature: 1"))).toBe(true)
    }))

  it.effect("injects grounded context signals and deterministic cache-busting markers", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const demoCandidates = yield* generateDemoCandidates({
        module,
        trainset: trainingSet,
        numCandidates: 3,
        seed: 3
      })
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) => `${markerFromPrompt(prompt)} instruction`)
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const first = yield* proposeInstructionCandidates({
        module,
        trainset: trainingSet,
        demoCandidates,
        numInstructions: 4,
        seed: 5
      }).pipe(Effect.provide(layer))
      const second = yield* proposeInstructionCandidates({
        module,
        trainset: trainingSet,
        demoCandidates,
        numInstructions: 4,
        seed: 5
      }).pipe(Effect.provide(layer))
      const calls = yield* Ref.get(mock.calls)

      expect(first).toEqual(second)
      expect(
        Arr.every(calls, (call) =>
          call.prompt.includes("Dataset Summary:") &&
          call.prompt.includes("Program Description:") &&
          call.prompt.includes("Bootstrapped Demos:") &&
          call.prompt.includes("Tip:") &&
          call.prompt.includes("[miprov2-proposal:"))
      ).toBe(true)
      expect(
        Arr.every(
          Arr.flatMap(first, (proposalSet) => Arr.drop(proposalSet.candidates, 1)),
          (candidate) => candidate.cacheBustMarker.includes("[miprov2-proposal:")
        )
      ).toBe(true)
    }))
})
