/**
 * Module discovery contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Schema } from "effect"
import * as Contracts from "effect-dsp/contracts"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

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

const decodeModuleId = (moduleName: string) =>
  Schema.decodeUnknown(Contracts.ModuleId)(moduleName).pipe(
    Effect.orDie
  )

const registrationProjection = (
  registrations: ReadonlyArray<Module.ModuleRegistration>
): ReadonlyArray<{
  readonly id: string
  readonly subModuleIds: ReadonlyArray<string>
}> =>
  Arr.map(registrations, (registration) => ({
    id: registration.id,
    subModuleIds: registration.subModuleIds
  }))

const registrationById = (
  registrations: ReadonlyArray<Module.ModuleRegistration>,
  moduleId: string
): Option.Option<Module.ModuleRegistration> =>
  Arr.findFirst(registrations, (registration) => registration.id === moduleId)

describe("Module discovery", () => {
  it.effect("dedupes composed-of-composed modules by id deterministically", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const qa = yield* Module.predict("qa", signature)
      const pipeline = yield* Module.compose({
        name: "qa-pipeline",
        signature,
        subModules: { qa },
        forward: ({ input }) => qa.forward(input)
      })
      const root = yield* Module.compose({
        name: "qa-root",
        signature,
        subModules: { pipeline, qa },
        forward: ({ input }) =>
          Effect.gen(function*() {
            const nested = yield* pipeline.forward(input)

            yield* qa.forward(input)

            return nested
          })
      })
      const qaId = yield* decodeModuleId(qa.name)
      const pipelineId = yield* decodeModuleId(pipeline.name)
      const rootId = yield* decodeModuleId(root.name)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const program = root.forward({ question: "What is the capital of France?" }).pipe(
        Effect.provide(lmLayer)
      )
      const first = yield* Module.discoverModules(program)
      const second = yield* Module.discoverModules(program)

      expect(registrationProjection(first)).toEqual(registrationProjection(second))
      expect(Arr.map(first, (registration) => registration.id)).toEqual([
        qaId,
        pipelineId,
        rootId
      ])

      const qaRegistration = registrationById(first, qaId)
      const pipelineRegistration = registrationById(first, pipelineId)
      const rootRegistration = registrationById(first, rootId)

      expect(Option.isSome(qaRegistration)).toBe(true)
      expect(Option.isSome(pipelineRegistration)).toBe(true)
      expect(Option.isSome(rootRegistration)).toBe(true)

      if (Option.isSome(qaRegistration)) {
        expect(qaRegistration.value.subModuleIds).toEqual([])
      }

      if (Option.isSome(pipelineRegistration)) {
        expect(pipelineRegistration.value.subModuleIds).toEqual([qaId])
      }

      if (Option.isSome(rootRegistration)) {
        expect(rootRegistration.value.subModuleIds).toEqual([
          qaId,
          pipelineId
        ])
      }
    }))
})
