/**
 * Module discovery contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import * as Contracts from "@scenesystems/effect-dsp/contracts"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import type { Option } from "effect"
import { Array as Arr, Data, Effect, Equal, Layer, Record, Schema } from "effect"

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

class RegistrationProjection extends Data.Class<{
  readonly id: string
  readonly subModuleIds: Module.ModuleRegistration["subModuleIds"]
}> {}

const registrationProjection = (
  registrations: Iterable<Module.ModuleRegistration>
) =>
  Arr.map(Arr.fromIterable(registrations), (registration) =>
    new RegistrationProjection({
      id: registration.id,
      subModuleIds: registration.subModuleIds
    }))

const registrationById = (
  registrations: Iterable<Module.ModuleRegistration>,
  moduleId: string
): Option.Option<Module.ModuleRegistration> =>
  Arr.findFirst(
    Arr.fromIterable(registrations),
    (registration) => Equal.equals(registration.id, moduleId)
  )

describe("Module discovery", () => {
  it.effect("dedupes composed-of-composed modules by id deterministically", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const qa = yield* Module.predict("qa", signature)
      const pipeline = yield* Module.compose(
        new Module.ComposeOptions({
          name: "qa-pipeline",
          signature,
          subModules: Record.singleton("qa", qa),
          forward: ({ input }) => qa.forward(input)
        })
      )
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "qa-root",
          signature,
          subModules: Record.set(Record.singleton("pipeline", pipeline), "qa", qa),
          forward: ({ input }) =>
            Effect.gen(function*() {
              const nested = yield* pipeline.forward(input)

              yield* qa.forward(input)

              return nested
            })
        })
      )
      const qaId = yield* Schema.decodeUnknown(Contracts.ModuleId)(qa.name)
      const pipelineId = yield* Schema.decodeUnknown(Contracts.ModuleId)(pipeline.name)
      const rootId = yield* Schema.decodeUnknown(Contracts.ModuleId)(root.name)
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
      expect(Arr.map(first, (registration) => registration.id)).toEqual(Arr.make(
        qaId,
        pipelineId,
        rootId
      ))

      const qaRegistration = yield* registrationById(first, qaId)
      const pipelineRegistration = yield* registrationById(first, pipelineId)
      const rootRegistration = yield* registrationById(first, rootId)

      expect(qaRegistration.subModuleIds).toEqual(Arr.empty())
      expect(pipelineRegistration.subModuleIds).toEqual(Arr.make(qaId))
      expect(rootRegistration.subModuleIds).toEqual(Arr.make(qaId, pipelineId))
    }))
})
