import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import * as Ensemble from "@scenesystems/effect-dsp/Ensemble"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import {
  Array as Arr,
  Effect,
  Inspectable,
  Layer,
  Number as Num,
  Option,
  Record as Rec,
  Ref,
  Schema,
  String as Str
} from "effect"

import { EnsembleMajorityVoteFixtureSchema, loadFixture } from "../helpers/dspy-fixtures/index.js"

const QaInput = Schema.Struct({
  question: Signature.describe(Schema.String, "The question to answer")
})

const QaOutput = Schema.Struct({
  answer: Signature.describe(Schema.String, "A concise factual answer")
})

const IndexedAnswer = Schema.Struct({
  index: Schema.Number,
  answer: Schema.String,
  instruction: Schema.String
})

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    QaInput.fields,
    QaOutput.fields
  )

const formatProgramInstruction = (index: number, caseName: string) =>
  Arr.join(
    Arr.make(
      "DSPy parity program ",
      Inspectable.toStringUnknown(Num.increment(index)),
      " - ",
      caseName
    ),
    ""
  )

const formatProgramName = (index: number, caseName: string) =>
  Arr.join(
    Arr.make(
      "qa-ensemble-dspy-parity-",
      caseName,
      "-",
      Inspectable.toStringUnknown(Num.increment(index))
    ),
    ""
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
      new ModuleParameters({
        instructions,
        demos: Arr.empty(),
        outputStrategy: "structured"
      })
    )

    return program
  })

describe("Ensemble.make DSPy parity", () => {
  it.effect("matches fixture-backed majority vote and tie-break contracts", () =>
    Effect.gen(function*() {
      const rawFixture = yield* loadFixture("dspy.ensemble.majority-vote.basic")
      const fixture = yield* Schema.decodeUnknown(EnsembleMajorityVoteFixtureSchema)(rawFixture)

      yield* Effect.forEach(
        fixture.payload.cases,
        (fixtureCase) =>
          Effect.gen(function*() {
            const signature = yield* makeQaSignature()
            const indexedAnswers = Arr.map(
              fixtureCase.programAnswers,
              (answer, index) =>
                IndexedAnswer.make({
                  index,
                  answer,
                  instruction: formatProgramInstruction(index, fixtureCase.name)
                })
            )
            const programs = yield* Effect.forEach(
              indexedAnswers,
              (entry) =>
                makeProgram(
                  formatProgramName(entry.index, fixtureCase.name),
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
              MockLanguageModel.map((prompt) =>
                QaOutput.make({
                  answer: Option.getOrElse(
                    Arr.findFirst(
                      Rec.toEntries(answerByInstruction),
                      ([instruction]) => Str.includes(instruction)(prompt)
                    ).pipe(Option.map(([, answer]) => answer)),
                    () => Option.getOrElse(Arr.head(fixtureCase.programAnswers), () => "")
                  )
                })
              )
            )
            const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
            const ensemble = yield* Ensemble.make({
              programs,
              name: Str.concat("ensemble-dspy-parity-", fixtureCase.name)
            })

            const result = yield* ensemble.forward({
              question: fixtureCase.question
            }).pipe(Effect.provide(layer))
            const calls = yield* Ref.get(mock.calls)

            expect(result.answer).toBe(fixtureCase.expectedAnswer)
            expect(calls).toHaveLength(Arr.length(fixtureCase.programAnswers))
          }),
        { discard: true }
      )
    }))
})
