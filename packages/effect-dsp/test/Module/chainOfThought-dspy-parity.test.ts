import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Record, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"

import { ChainOfThoughtReasoningFixtureSchema, FixtureRegistry } from "../helpers/dspy-fixtures/index.js"
import { shortFactualAnswersQaSignature } from "../helpers/qa-signatures.js"

describe("Module.chainOfThought DSPy parity", () => {
  it.effect("matches the DSPy reasoning-field and trace contracts", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const rawFixture = yield* registry.load("dspy.cot.reasoning-field.basic")
      const fixture = yield* Schema.decodeUnknown(ChainOfThoughtReasoningFixtureSchema)(rawFixture)

      const qa = yield* shortFactualAnswersQaSignature
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
