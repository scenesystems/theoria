import { describe, expect, it } from "@effect/vitest"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { decode } from "@scenesystems/effect-dsp/Payload"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Layer, Option, Schema, String } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"

import {
  loadFixture,
  TraceEntryShapeFixtureSchema,
  TraceFiberIsolationFixtureSchema
} from "../helpers/dspy-fixtures/index.js"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with short factual answers",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

describe("Trace DSPy contracts", () => {
  it.effect("matches entry-shape and isolation fixture contracts", () =>
    Effect.gen(function*() {
      const rawEntryFixture = yield* loadFixture("dspy.trace.entry-shape.basic")
      const rawIsolationFixture = yield* loadFixture("dspy.trace.fiber-isolation.seed-0")
      const entryFixture = yield* Schema.decodeUnknownEffect(TraceEntryShapeFixtureSchema)(rawEntryFixture)
      const isolationFixture = yield* Schema.decodeUnknownEffect(TraceFiberIsolationFixtureSchema)(rawIsolationFixture)

      const qa = yield* makeQaSignature()
      const module = yield* Module.predict("qa-trace-dspy-parity", qa)

      const singleRunMock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(entryFixture.payload.samplePrediction)
      )
      const singleRunLayer = Layer.succeed(LanguageModel.LanguageModel, singleRunMock.service)
      const singleRunTrace = yield* Trace.withTracing(
        module.forward(entryFixture.payload.sampleInput).pipe(
          Effect.provide(singleRunLayer)
        )
      )
      const singleRunEntry = Option.getOrThrow(Arr.head(singleRunTrace[1]))

      expect(singleRunTrace[1]).toHaveLength(1)
      expect(singleRunTrace[0]).toEqual(entryFixture.payload.samplePrediction)
      expect(yield* decode(qa.inputSchema, singleRunEntry.input)).toEqual(entryFixture.payload.sampleInput)
      expect(yield* decode(qa.outputSchema, singleRunEntry.output)).toEqual(
        entryFixture.payload.samplePrediction
      )
      expect(singleRunEntry.moduleName).toBe("qa-trace-dspy-parity")

      const scopeRuns = isolationFixture.payload.scopeRuns
      const answerForPrompt = (prompt: string) =>
        Option.getOrElse(
          Arr.findFirst(scopeRuns, (run) => String.includes(run.question)(prompt)).pipe(
            Option.map((run) => run.expectedAnswer)
          ),
          () => "unmatched prompt"
        )

      const scopedMock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) => ({
          answer: answerForPrompt(prompt)
        }))
      )
      const scopedLayer = Layer.succeed(LanguageModel.LanguageModel, scopedMock.service)

      const scopedTraces = yield* Effect.forEach(
        scopeRuns,
        (run) =>
          Trace.withTracing(
            module.forward({ question: run.question }).pipe(
              Effect.provide(scopedLayer)
            )
          ),
        { concurrency: "unbounded" }
      )

      yield* Effect.forEach(
        Arr.zip(scopeRuns, scopedTraces),
        (scopeTrace) =>
          Effect.gen(function*() {
            const run = scopeTrace[0]
            const traced = scopeTrace[1]
            const entries = traced[1]
            const traceEntry = Option.getOrThrow(Arr.head(entries))

            expect(entries).toHaveLength(run.traceLength)
            expect(yield* decode(qa.inputSchema, traceEntry.input)).toEqual({ question: run.traceInputQuestion })
            expect(yield* decode(qa.outputSchema, traceEntry.output)).toEqual({ answer: run.expectedAnswer })
            expect(traced[0]).toEqual({ answer: run.expectedAnswer })
          }),
        { discard: true }
      )

      const observedInputs = yield* Effect.forEach(
        scopedTraces,
        (traced) => decode(qa.inputSchema, Option.getOrThrow(Arr.head(traced[1])).input)
      )
      const observedOutputs = yield* Effect.forEach(
        scopedTraces,
        (traced) => decode(qa.outputSchema, Option.getOrThrow(Arr.head(traced[1])).output)
      )

      expect(observedInputs).toEqual(Arr.map(scopeRuns, (run) => ({ question: run.question })))
      expect(observedOutputs).toEqual(Arr.map(scopeRuns, (run) => ({ answer: run.expectedAnswer })))
    }))
})
