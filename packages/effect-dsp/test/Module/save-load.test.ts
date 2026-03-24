/**
 * Module.save / Module.load persistence contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Ref, Schema } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { SaveLoadError } from "effect-dsp/Errors"
import { Demo } from "effect-dsp/Example"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"

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
      const expectedParams = new ModuleParams({
        instructions: "Use one-word factual answers.",
        outputStrategy: "text",
        demos: [
          new Demo({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          })
        ],
        temperature: 0.2,
        maxTokens: 12
      })

      yield* Ref.set(module.params, expectedParams)

      const saved = yield* Module.save(module)

      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: signature.instructions,
          demos: []
        })
      )

      yield* Module.load(module, saved)

      const restored = yield* Ref.get(module.params)

      expect(saved.modules).toHaveLength(1)
      expect(saved.modules[0]?.name).toBe("qa")
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

      const rootExpected = new ModuleParams({
        instructions: "Root instructions",
        demos: [
          new Demo({
            input: { question: "Root question" },
            output: { answer: "Root answer" }
          })
        ],
        outputStrategy: "structured"
      })
      const qaExpected = new ModuleParams({
        instructions: "Leaf instructions",
        demos: [
          new Demo({
            input: { question: "Leaf question" },
            output: { answer: "Leaf answer" }
          })
        ],
        outputStrategy: "text"
      })

      yield* Ref.set(root.params, rootExpected)
      yield* Ref.set(qa.params, qaExpected)

      const saved = yield* Module.save(root)

      yield* Ref.set(
        root.params,
        new ModuleParams({
          instructions: "mutated-root",
          demos: []
        })
      )
      yield* Ref.set(
        qa.params,
        new ModuleParams({
          instructions: "mutated-leaf",
          demos: []
        })
      )

      yield* Module.load(root, saved)

      const restoredRoot = yield* Ref.get(root.params)
      const restoredQa = yield* Ref.get(qa.params)

      expect(saved.modules.map((entry) => entry.name).sort()).toEqual(["qa", "qa-root"])
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
        modules: [
          {
            name: "qa-root",
            params: new ModuleParams({
              instructions: "root-only",
              demos: []
            })
          }
        ]
      })

      const result = yield* Effect.either(Module.load(root, invalid))

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("SaveLoadError")
        expect(result.left).toEqual(
          new SaveLoadError({
            message: "Saved state is missing params for module 'qa'",
            operation: "load"
          })
        )
      }
    }))
})
