/**
 * Module params + Ref mutation contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import {
  ModuleParams,
  withModuleParamsDemos,
  withModuleParamsDemosAndInstructions,
  withModuleParamsInstructions
} from "@scenesystems/effect-dsp/contracts"
import { Demo } from "@scenesystems/effect-dsp/Example"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, Ref, Schema } from "effect"

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

describe("Module params", () => {
  it.effect("allocates params Ref with default instructions and empty demos", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const module = yield* Module.predict("qa", qa)
      const params = yield* Ref.get(module.params)

      expect(params.instructions).toBe(qa.instructions)
      expect(params.demos).toEqual(Arr.empty())
    }))

  it.effect("supports Ref mutation/read-back for demos and instructions", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const module = yield* Module.predict("qa", qa)

      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: "Use one token answers.",
          demos: Arr.make(
            new Demo({
              input: { question: "What is the capital of France?" },
              output: { answer: "Paris" }
            })
          )
        })
      )

      const updated = yield* Ref.get(module.params)
      const demo = yield* Arr.head(updated.demos)

      expect(updated.instructions).toBe("Use one token answers.")
      expect(updated.demos).toHaveLength(1)
      expect(demo.output).toEqual({ answer: "Paris" })
    }))

  it.effect("replaces only requested parameters while retaining generation settings and demonstration values", () =>
    Effect.gen(function*() {
      const original = new ModuleParams({
        instructions: "Answer briefly",
        demos: Arr.empty(),
        outputStrategy: "text",
        temperature: 0,
        maxTokens: 512
      })
      const demos = Arr.make(new Demo({ input: { question: "Capital of Japan?" }, output: { answer: "Tokyo" } }))
      const instructionOnly = withModuleParamsInstructions(original, "Answer precisely")
      const demosOnly = withModuleParamsDemos(original, demos)
      const both = withModuleParamsDemosAndInstructions(original, demos, "Answer with a city")

      Arr.forEach(Arr.make(instructionOnly, demosOnly, both), (params) => {
        expect(params.outputStrategy).toBe("text")
        expect(params.temperature).toBe(0)
        expect(params.maxTokens).toBe(512)
      })
      expect(instructionOnly.instructions).toBe("Answer precisely")
      expect(instructionOnly.demos).toEqual(original.demos)
      expect(demosOnly.instructions).toBe(original.instructions)
      expect(demosOnly.demos).toEqual(demos)
      expect(both.instructions).toBe("Answer with a city")
      expect(both.demos).toEqual(demos)
      expect(original.instructions).toBe("Answer briefly")
      expect(original.demos).toEqual(Arr.empty())

      const defaults = new ModuleParams({ instructions: "Default", demos: Arr.empty() })
      const encoded = yield* Schema.encode(ModuleParams)(withModuleParamsInstructions(defaults, "Replaced"))
      expect(encoded).toEqual({ instructions: "Replaced", demos: Arr.empty(), outputStrategy: "auto" })
    }))
})
