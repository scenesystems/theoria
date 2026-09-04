import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Effect, Layer, Record, Schema } from "effect"

import { ChainOfThoughtReasoningFixtureSchema, loadFixture } from "../helpers/dspy-fixtures/index.js"

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

describe("Module.chainOfThought DSPy parity", () => {
  it.effect("matches the DSPy reasoning-field and trace contracts", () =>
    Effect.gen(function*() {
      const rawFixture = yield* loadFixture("dspy.cot.reasoning-field.basic")
      const fixture = yield* Schema.decodeUnknown(ChainOfThoughtReasoningFixtureSchema)(rawFixture)

      const qa = yield* makeQaSignature()
      const cot = yield* Module.chainOfThought("qa-cot-dspy-parity", qa)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed(fixture.payload.sampleOutput)
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const traced = yield* Trace.withTracing(
        cot.forward(fixture.payload.sampleInput).pipe(
          Effect.provide(lmLayer)
        )
      )
      const result = traced[0]
      const entries = traced[1]
      const firstEntry = entries[0]

      expect(fixture.payload.reasoningFieldName).toBe("reasoning")
      expect(Record.keys(cot.signature.outputFields)).toStrictEqual(fixture.payload.outputFieldOrder)
      expect(result).toStrictEqual(fixture.payload.sampleOutput)
      expect(entries).toHaveLength(fixture.payload.traceLength)
      expect(Record.keys(firstEntry?.input ?? {})).toStrictEqual(fixture.payload.traceInputKeys)
      expect(Record.keys(firstEntry?.output ?? {})).toStrictEqual(fixture.payload.tracePredictionKeys)
    }))
})
