/**
 * Module.save / Module.load persistence contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { SaveLoadError } from "@scenesystems/effect-dsp/DspError"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, Order, Ref, Schema } from "effect"

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

describe("Module.save / Module.load", () => {
  it.effect("round-trips module params through save/load on predict modules", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const expectedParams = new ModuleParameters({
        instructions: "Use one-word factual answers.",
        outputStrategy: "text",
        demos: Arr.make(
          new Demonstration({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          })
        ),
        temperature: 0.2,
        maxTokens: 12
      })

      yield* Ref.set(module.params, expectedParams)

      const saved = yield* Module.save(module)

      yield* Ref.set(
        module.params,
        new ModuleParameters({
          instructions: signature.instructions,
          demos: Arr.empty()
        })
      )

      yield* Module.load(module, saved)

      const restored = yield* Ref.get(module.params)

      expect(saved.modules).toHaveLength(1)
      expect((yield* Arr.head(saved.modules)).name).toBe("qa")
      expect(restored).toEqual(expectedParams)
    }))

  it.effect("persists and restores composed-module parameter graphs", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const qa = yield* Module.predict("qa", signature)
      const root = yield* Module.compose({
        name: "qa-root",
        signature,
        subModules: { qa },
        forward: ({ input }) => qa.forward(input)
      })

      const rootExpected = new ModuleParameters({
        instructions: "Root instructions",
        demos: Arr.make(
          new Demonstration({
            input: { question: "Root question" },
            output: { answer: "Root answer" }
          })
        ),
        outputStrategy: "structured"
      })
      const qaExpected = new ModuleParameters({
        instructions: "Leaf instructions",
        demos: Arr.make(
          new Demonstration({
            input: { question: "Leaf question" },
            output: { answer: "Leaf answer" }
          })
        ),
        outputStrategy: "text"
      })

      yield* Ref.set(root.params, rootExpected)
      yield* Ref.set(qa.params, qaExpected)

      const saved = yield* Module.save(root)

      yield* Ref.set(
        root.params,
        new ModuleParameters({
          instructions: "mutated-root",
          demos: Arr.empty()
        })
      )
      yield* Ref.set(
        qa.params,
        new ModuleParameters({
          instructions: "mutated-leaf",
          demos: Arr.empty()
        })
      )

      yield* Module.load(root, saved)

      const restoredRoot = yield* Ref.get(root.params)
      const restoredQa = yield* Ref.get(qa.params)

      expect(Arr.sort(Arr.map(saved.modules, (entry) => entry.name), Order.string)).toEqual(Arr.make("qa", "qa-root"))
      expect(restoredRoot).toEqual(rootExpected)
      expect(restoredQa).toEqual(qaExpected)
    }))

  it.effect("fails with SaveLoadError when saved state is missing module parameter entries", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const qa = yield* Module.predict("qa", signature)
      const root = yield* Module.compose({
        name: "qa-root",
        signature,
        subModules: { qa },
        forward: ({ input }) => qa.forward(input)
      })

      const invalid = new Module.SavedState({
        version: 1,
        modules: Arr.make(
          {
            name: "qa-root",
            params: new ModuleParameters({
              instructions: "root-only",
              demos: Arr.empty()
            })
          }
        )
      })
      const originalRootParams = yield* Ref.get(root.params)

      const result = yield* Effect.flip(Module.load(root, invalid))
      const rootParamsAfterFailure = yield* Ref.get(root.params)

      expect(result).toEqual(
        new SaveLoadError({
          message: "Saved state is missing params for module 'qa'",
          operation: "load"
        })
      )

      expect(rootParamsAfterFailure).toBe(originalRootParams)
    }))
})
