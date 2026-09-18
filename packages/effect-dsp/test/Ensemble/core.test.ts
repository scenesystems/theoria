/**
 * Ensemble optimizer contracts.
 */
import type * as AiError from "@effect/ai/AiError"
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import { AllTrialsFailed, type DspError } from "@scenesystems/effect-dsp/DspError"
import * as Ensemble from "@scenesystems/effect-dsp/Ensemble"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import {
  Array as Arr,
  Boolean,
  Cause,
  Context,
  Effect,
  Either,
  identity,
  Layer,
  Match,
  Option,
  Record,
  Ref,
  Schema,
  String as Str
} from "effect"

const QaInput = Schema.Struct({
  question: Signature.describe(Schema.String, "The question to answer")
})

const QaOutput = Schema.Struct({
  answer: Signature.describe(Schema.String, "A concise factual answer")
})

class MemberRejected extends Schema.TaggedError<MemberRejected>()(
  "MemberRejected",
  { message: Schema.String }
) {}

class MemberBehavior extends Context.Tag("effect-dsp/test/ensemble/MemberBehavior")<
  MemberBehavior,
  Effect.Effect<typeof QaOutput.Type, MemberRejected>
>() {}

class ReducerRejected extends Schema.TaggedError<ReducerRejected>()(
  "ReducerRejected",
  { message: Schema.String }
) {}

class ReducerDependency extends Context.Tag("effect-dsp/test/ensemble/ReducerDependency")<
  ReducerDependency,
  string
>() {}

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    QaInput.fields,
    QaOutput.fields
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

describe("Ensemble.make", () => {
  it.effect("unions member and reducer channels while preserving reducer failure identity", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const program = yield* Module.compose({
        name: "qa-member-channels",
        signature,
        subModules: Record.empty(),
        forward: () => Effect.flatMap(MemberBehavior, identity)
      })
      const failure = new ReducerRejected({ message: "reducer unavailable" })
      const ensemble = yield* Ensemble.make({
        programs: Arr.make(program),
        reduceFn: () => ReducerDependency.pipe(Effect.zipRight(Effect.fail(failure)))
      })
      const operation = ensemble.forward({ question: "Reduce this" })

      expectTypeOf<Effect.Effect.Error<typeof operation>>().toEqualTypeOf<
        AiError.AiError | DspError | MemberRejected | ReducerRejected
      >()
      expectTypeOf<Effect.Effect.Context<typeof operation>>().toEqualTypeOf<
        LanguageModel.LanguageModel | MemberBehavior | ReducerDependency
      >()

      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Candidate" }))
      const observed = yield* operation.pipe(
        Effect.provideService(MemberBehavior, Effect.succeed(QaOutput.make({ answer: "Candidate" }))),
        Effect.provideService(ReducerDependency, "available"),
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )

      expect(Cause.originalError(observed)).toBe(failure)
    }))

  it.effect("uses majorityVote by default", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const programA = yield* makeProgram("qa-a", signature, "Program A")
      const programB = yield* makeProgram("qa-b", signature, "Program B")
      const programC = yield* makeProgram("qa-c", signature, "Program C")

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Boolean.match(Str.includes("Program B")(prompt), {
            onTrue: () => QaOutput.make({ answer: "London" }),
            onFalse: () => QaOutput.make({ answer: "Paris" })
          })
        )
      )

      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const ensemble = yield* Ensemble.make({
        programs: Arr.make(programA, programB, programC)
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
      const signature = yield* makeQaSignature()
      const programA = yield* makeProgram("qa-a", signature, "Program A")
      const programB = yield* makeProgram("qa-b", signature, "Program B")

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Boolean.match(Str.includes("Program A")(prompt), {
            onTrue: () => QaOutput.make({ answer: "Paris" }),
            onFalse: () => QaOutput.make({ answer: "Tokyo" })
          })
        )
      )

      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const ensemble = yield* Ensemble.make({
        programs: Arr.make(programA, programB),
        reduceFn: ({ outputs }) =>
          Option.match(Arr.get(outputs, 1), {
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
      const signature = yield* makeQaSignature()
      const programA = yield* makeProgram("qa-a", signature, "Program A")
      const programB = yield* makeProgram("qa-b", signature, "Program B")
      const programC = yield* makeProgram("qa-c", signature, "Program C")
      const programD = yield* makeProgram("qa-d", signature, "Program D")

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Match.value(prompt).pipe(
            Match.when(Str.includes("Program A"), () => QaOutput.make({ answer: "A" })),
            Match.when(Str.includes("Program B"), () => QaOutput.make({ answer: "B" })),
            Match.when(Str.includes("Program C"), () => QaOutput.make({ answer: "C" })),
            Match.orElse(() => QaOutput.make({ answer: "D" }))
          )
        )
      )

      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const ensemble = yield* Ensemble.make({
        programs: Arr.make(programA, programB, programC, programD),
        size: 2,
        seed: 17,
        reduceFn: ({ outputs }) =>
          Option.match(Arr.head(outputs), {
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

  it.effect("runs one selected program when a positive fractional size rounds below one", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const programA = yield* makeProgram("qa-a", signature, "Program A")
      const programB = yield* makeProgram("qa-b", signature, "Program B")
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Boolean.match(Str.includes("Program A")(prompt), {
            onTrue: () => QaOutput.make({ answer: "A" }),
            onFalse: () => QaOutput.make({ answer: "B" })
          })
        )
      )
      const ensemble = yield* Ensemble.make({
        programs: Arr.make(programA, programB),
        size: 0.5,
        seed: 1
      })

      const result = yield* ensemble.forward({
        question: "Which program was selected?"
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const calls = yield* Ref.get(mock.calls)

      expect(result).toEqual({ answer: "A" })
      expect(calls).toHaveLength(1)
    }))

  it.effect("breaks majority-vote ties deterministically by first observed output", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const programA = yield* makeProgram("qa-a", signature, "Program A")
      const programB = yield* makeProgram("qa-b", signature, "Program B")
      const programC = yield* makeProgram("qa-c", signature, "Program C")
      const programD = yield* makeProgram("qa-d", signature, "Program D")

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Boolean.match(
            Boolean.or(
              Str.includes("Program A")(prompt),
              Str.includes("Program D")(prompt)
            ),
            {
              onTrue: () => QaOutput.make({ answer: "Paris" }),
              onFalse: () => QaOutput.make({ answer: "London" })
            }
          )
        )
      )

      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const ensemble = yield* Ensemble.make({
        programs: Arr.make(programA, programB, programC, programD)
      })

      const result = yield* ensemble.forward({
        question: "What is the capital of France?"
      }).pipe(Effect.provide(layer))

      expect(result).toEqual({ answer: "Paris" })
    }))

  it.effect("propagates typed program failures without reducer masking", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const successful = yield* makeProgram("qa-success", signature, "Program Success")
      const failing = yield* Module.compose({
        name: "qa-failure",
        signature,
        subModules: Record.empty(),
        forward: () =>
          Effect.fail(
            new AllTrialsFailed({
              message: "Intentional failing program",
              trialCount: 1
            })
          )
      })
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const ensemble = yield* Ensemble.make({
        programs: Arr.make(successful, failing)
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
      const signature = yield* makeQaSignature()
      const result = yield* Effect.either(
        Ensemble.make({
          programs: Arr.empty(),
          name: Str.concat("ensemble-", signature.description)
        })
      )

      expect(result).toEqual(Either.left(
        new AllTrialsFailed({
          message: "Ensemble.make requires at least one program",
          trialCount: 0
        })
      ))
    }))
})
