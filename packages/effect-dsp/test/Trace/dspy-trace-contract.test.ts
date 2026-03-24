import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Record, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"

import {
  makeFixtureRegistry,
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
      const registry = makeFixtureRegistry()
      const rawEntryFixture = yield* registry.load("dspy.trace.entry-shape.basic")
      const rawIsolationFixture = yield* registry.load("dspy.trace.fiber-isolation.seed-0")
      const entryFixture = yield* Schema.decodeUnknown(TraceEntryShapeFixtureSchema)(rawEntryFixture)
      const isolationFixture = yield* Schema.decodeUnknown(TraceFiberIsolationFixtureSchema)(rawIsolationFixture)

      const qa = yield* makeQaSignature()
      const module = yield* Module.predict("qa-trace-dspy-parity", qa)

      const singleRunMock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed(entryFixture.payload.samplePrediction)
      )
      const singleRunLayer = Layer.succeed(LanguageModel.LanguageModel, singleRunMock.service)
      const singleRunTrace = yield* Trace.withTracing(
        module.forward(entryFixture.payload.sampleInput).pipe(
          Effect.provide(singleRunLayer)
        )
      )
      const singleRunEntry = singleRunTrace[1][0]

      expect(entryFixture.payload.traceEntryTupleLength).toBe(3)
      expect(singleRunTrace[1]).toHaveLength(1)
      expect(Record.keys(singleRunEntry?.input ?? {})).toStrictEqual(entryFixture.payload.inputKeys)
      expect(Record.keys(singleRunEntry?.output ?? {})).toStrictEqual(entryFixture.payload.predictionKeys)

      const scopeRuns = isolationFixture.payload.scopeRuns
      const answerForPrompt = (prompt: string): string =>
        Option.getOrElse(
          Arr.findFirst(scopeRuns, (run) => prompt.includes(run.question)).pipe(
            Option.map((run) => run.expectedAnswer)
          ),
          () => scopeRuns[0]?.expectedAnswer ?? ""
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

      expect(isolationFixture.payload.crossScopeTraceLeakDetected).toBe(false)
      yield* Effect.forEach(
        Arr.zip(scopeRuns, scopedTraces),
        ([run, traced]) =>
          Effect.sync(() => {
            const traceEntry = traced[1][0]
            expect(traced[1]).toHaveLength(run.traceLength)
            expect(String(traceEntry?.input.question ?? "")).toBe(run.traceInputQuestion)
            expect(Record.keys(traceEntry?.output ?? {})).toStrictEqual(run.tracePredictionKeys)
            expect(traced[0].answer).toBe(run.expectedAnswer)
          }),
        { discard: true }
      )
    }))
})
