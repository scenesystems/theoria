/**
 * Ensemble optimizer contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Layer, Option, Ref, type Schema } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { AllTrialsFailed } from "effect-dsp/Errors"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import type * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import { conciseFactsQaSignature } from "../../helpers/qa-signatures.js"

const allocateProgram = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  name: string,
  signature: Signature.Signature<I, O>,
  instructions: string
) =>
  Effect.gen(function*() {
    const program = yield* Module.predict(name, signature)

    yield* Ref.set(
      program.params,
      new ModuleParams({
        instructions,
        demos: [],
        outputStrategy: "structured"
      })
    )

    return program
  })

describe("Optimizer.ensemble", () => {
  it.effect("uses majorityVote by default", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const programA = yield* allocateProgram("qa-a", signature, "Program A")
      const programB = yield* allocateProgram("qa-b", signature, "Program B")
      const programC = yield* allocateProgram("qa-c", signature, "Program C")

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          prompt.includes("Program B")
            ? { answer: "London" }
            : { answer: "Paris" }
        )
      )

      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const ensemble = yield* Optimizer.ensemble({
        programs: [programA, programB, programC]
      })

      const result = yield* ensemble.forward({
        question: "What is the capital of France?"
      }).pipe(Effect.provide(layer))

      const calls = yield* Ref.get(mock.calls)

      expect(result).toEqual({ answer: "Paris" })
      expect(calls).toHaveLength(3)
    }))

  it.effect("honors custom reducer functions", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const programA = yield* allocateProgram("qa-a", signature, "Program A")
      const programB = yield* allocateProgram("qa-b", signature, "Program B")

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          prompt.includes("Program A")
            ? { answer: "Paris" }
            : { answer: "Tokyo" }
        )
      )

      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const ensemble = yield* Optimizer.ensemble({
        programs: [programA, programB],
        reduceFn: ({ outputs }) =>
          Option.match(Option.fromNullable(outputs[1]), {
            onNone: () =>
              Effect.fail(
                new AllTrialsFailed({
                  message: "Custom reducer requires at least two outputs",
                  trialCount: 0
                })
              ),
            onSome: (output) => Effect.succeed(output)
          })
      })

      const result = yield* ensemble.forward({
        question: "What is the capital of France?"
      }).pipe(Effect.provide(layer))

      expect(result).toEqual({ answer: "Tokyo" })
    }))

  it.effect("runs only the selected subset size and stays deterministic for fixed seed", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const programA = yield* allocateProgram("qa-a", signature, "Program A")
      const programB = yield* allocateProgram("qa-b", signature, "Program B")
      const programC = yield* allocateProgram("qa-c", signature, "Program C")
      const programD = yield* allocateProgram("qa-d", signature, "Program D")

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) => {
          if (prompt.includes("Program A")) {
            return { answer: "A" }
          }

          if (prompt.includes("Program B")) {
            return { answer: "B" }
          }

          if (prompt.includes("Program C")) {
            return { answer: "C" }
          }

          return { answer: "D" }
        })
      )

      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const ensemble = yield* Optimizer.ensemble({
        programs: [programA, programB, programC, programD],
        size: 2,
        seed: 17,
        reduceFn: ({ outputs }) =>
          Option.match(Option.fromNullable(outputs[0]), {
            onNone: () =>
              Effect.fail(
                new AllTrialsFailed({
                  message: "Reducer requires at least one output",
                  trialCount: 0
                })
              ),
            onSome: (output) => Effect.succeed(output)
          })
      })

      const first = yield* ensemble.forward({
        question: "What letter wins first?"
      }).pipe(Effect.provide(layer))

      const second = yield* ensemble.forward({
        question: "What letter wins second?"
      }).pipe(Effect.provide(layer))

      const calls = yield* Ref.get(mock.calls)

      expect(calls).toHaveLength(4)
      expect(first).toEqual(second)
    }))

  it.effect("breaks majority-vote ties deterministically by first observed output", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const programA = yield* allocateProgram("qa-a", signature, "Program A")
      const programB = yield* allocateProgram("qa-b", signature, "Program B")
      const programC = yield* allocateProgram("qa-c", signature, "Program C")
      const programD = yield* allocateProgram("qa-d", signature, "Program D")

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) => {
          if (prompt.includes("Program A") || prompt.includes("Program D")) {
            return { answer: "Paris" }
          }

          return { answer: "London" }
        })
      )

      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const ensemble = yield* Optimizer.ensemble({
        programs: [programA, programB, programC, programD]
      })

      const result = yield* ensemble.forward({
        question: "What is the capital of France?"
      }).pipe(Effect.provide(layer))

      expect(result).toEqual({ answer: "Paris" })
    }))

  it.effect("propagates typed program failures without reducer masking", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const successful = yield* allocateProgram("qa-success", signature, "Program Success")
      const failing = yield* Module.compose({
        name: "qa-failure",
        signature,
        subModules: {},
        forward: () =>
          Effect.fail(
            new AllTrialsFailed({
              message: "Intentional failing program",
              trialCount: 1
            })
          )
      })
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const ensemble = yield* Optimizer.ensemble({
        programs: [successful, failing]
      })

      const result = yield* Effect.either(
        ensemble.forward({
          question: "What is the capital of France?"
        }).pipe(Effect.provide(layer))
      )

      expect(result).toEqual(
        Either.left(
          new AllTrialsFailed({
            message: "Intentional failing program",
            trialCount: 1
          })
        )
      )
    }))

  it.effect("fails when no programs are provided", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const result = yield* Effect.either(
        Optimizer.ensemble({
          programs: [],
          name: `ensemble-${signature.description}`
        })
      )

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left).toEqual(
          new AllTrialsFailed({
            message: "Optimizer.ensemble requires at least one program",
            trialCount: 0
          })
        )
      }
    }))
})
