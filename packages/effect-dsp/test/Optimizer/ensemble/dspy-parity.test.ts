import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Record as Rec, Ref, Schema } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

import { EnsembleMajorityVoteFixtureSchema, makeFixtureRegistry } from "../../helpers/dspy-fixtures/index.js"

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

const makeProgram = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
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

describe("Optimizer.ensemble DSPy parity", () => {
  it.effect("matches fixture-backed majority vote and tie-break contracts", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry()
      const rawFixture = yield* registry.load("dspy.ensemble.majority-vote.basic")
      const fixture = yield* Schema.decodeUnknown(EnsembleMajorityVoteFixtureSchema)(rawFixture)

      yield* Effect.forEach(
        fixture.payload.cases,
        (fixtureCase) =>
          Effect.gen(function*() {
            const signature = yield* makeQaSignature()
            const indexedAnswers = Arr.map(
              fixtureCase.programAnswers,
              (answer, index) => ({
                index,
                answer,
                instruction: `DSPy parity program ${index + 1} - ${fixtureCase.name}`
              })
            )
            const programs = yield* Effect.forEach(
              indexedAnswers,
              (entry) =>
                makeProgram(
                  `qa-ensemble-dspy-parity-${fixtureCase.name}-${entry.index + 1}`,
                  signature,
                  entry.instruction
                )
            )
            const answerByInstruction = Arr.reduce(
              indexedAnswers,
              Rec.empty<string, string>(),
              (state, entry) => Rec.set(state, entry.instruction, entry.answer)
            )
            const mock = yield* MockLanguageModel.make(
              MockLanguageModel.map((prompt) => ({
                answer: Option.getOrElse(
                  Arr.findFirst(
                    Rec.toEntries(answerByInstruction),
                    ([instruction]) => prompt.includes(instruction)
                  ).pipe(Option.map(([, answer]) => answer)),
                  () => fixtureCase.programAnswers[0] ?? ""
                )
              }))
            )
            const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
            const ensemble = yield* Optimizer.ensemble({
              programs,
              name: `ensemble-dspy-parity-${fixtureCase.name}`
            })

            const result = yield* ensemble.forward({
              question: fixtureCase.question
            }).pipe(Effect.provide(layer))
            const calls = yield* Ref.get(mock.calls)

            expect(result.answer).toBe(fixtureCase.expectedAnswer)
            expect(calls).toHaveLength(fixtureCase.programAnswers.length)
          }),
        { discard: true }
      )
    }))
})
