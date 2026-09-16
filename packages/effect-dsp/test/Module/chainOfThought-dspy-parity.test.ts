import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { decode } from "@scenesystems/effect-dsp/Payload"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Layer, Record, Schema } from "effect"

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
        MockLanguageModel.succeed(fixture.payload.sampleOutput)
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const [result, entries] = yield* Trace.withTracing(
        cot.forward(fixture.payload.sampleInput).pipe(
          Effect.provide(lmLayer)
        )
      )
      const firstEntry = yield* Arr.head(entries)

      expect(Record.keys(cot.signature.outputFields)).toStrictEqual(fixture.payload.outputFieldOrder)
      expect(result).toStrictEqual(fixture.payload.sampleOutput)
      expect(entries).toHaveLength(fixture.payload.traceLength)
      expect(yield* decode(cot.signature.inputSchema, firstEntry.input)).toStrictEqual(
        fixture.payload.sampleInput
      )
      expect(yield* decode(cot.signature.outputSchema, firstEntry.output)).toStrictEqual(
        fixture.payload.sampleOutput
      )
    }))
})
